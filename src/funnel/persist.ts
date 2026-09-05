import * as cq from './cq.js';
import * as funnelCrypto from './crypto.js';
import { createP2P, type P2PConnection } from './ephemeral.js';
import * as nostr from './nostr.js';
import * as pointer from './pointer.js';
import * as store from './store.js';
import type { CqId, CqObject, CqObjectDraft, CqPersistEnvelope, P2PCallbacks, P2PRole, SessionMode } from './types.js';
import { buildUrl } from './util.js';

const EPHEMERAL_KIND = 20000;

export interface PersistSession {
  mode: SessionMode;
  room: string;
  key: string;
  identity: funnelCrypto.Identity;
  seq: number;
  role: P2PRole | null;
  p2p: P2PConnection | null;
  stopNostr: (() => void) | null;
  signaling: 'idle' | 'offered' | 'answered' | 'connected';
}

export interface PersistOptions {
  onObject: (obj: CqObject) => void;
  onStatus: (text: string) => void;
  onOpen?: () => void;
  p2p?: P2PCallbacks;
}

export async function createPersistRoom(opts: PersistOptions): Promise<PersistSession> {
  const room = globalThis.crypto.randomUUID().slice(0, 8);
  const key = await funnelCrypto.randomKey();
  const identity = funnelCrypto.loadIdentity();
  const head = await store.latest(room);
  const open = await cq.finalize({
    kind: 'funnel.room_open/1',
    coords: { room },
    payload: { npub: identity.npub },
    provenance: { derived_from: head ? [head.id] : [] },
  });
  await ingestLocal(open, room);
  const envelope = await seal(open, room, key, identity, 1);
  await publishEnvelope(identity, room, envelope);
  await pointer.putPointer({
    room,
    relays: nostr.DEFAULT_RELAYS,
    tag: `cqpersist-${room}`,
    since: open.lifecycle.issued_at,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }).catch(() => { /* pointer server opcional */ });
  const session: PersistSession = {
    mode: 'cqpersist',
    room,
    key,
    identity,
    seq: 1,
    role: 'host',
    p2p: null,
    stopNostr: null,
    signaling: 'idle',
  };
  session.stopNostr = startNostrListener(session, opts);
  opts.onObject(open);
  return session;
}

export async function joinPersistRoom(
  room: string,
  key: string,
  opts: PersistOptions,
): Promise<PersistSession> {
  const identity = funnelCrypto.loadIdentity();
  const session: PersistSession = {
    mode: 'cqpersist',
    room,
    key,
    identity,
    seq: 0,
    role: 'guest',
    p2p: null,
    stopNostr: null,
    signaling: 'idle',
  };
  session.stopNostr = startNostrListener(session, opts);
  const hint = await pointer.getPointer(room).catch(() => null);
  if (hint) {
    for (const relay of hint.relays) {
      nostr.subscribe(relay, [{ '#r': [room], since: hint.since }], (ev) => {
        void handleNostrEvent(session, ev, opts);
      });
    }
  }
  return session;
}

export function joinUrl(session: PersistSession): string {
  const base = buildUrl(session.room, { room: session.room }, location.pathname);
  return `${base}#k=${encodeURIComponent(session.key)}`;
}

export async function appendObject(
  session: PersistSession,
  draft: CqObjectDraft,
  opts: PersistOptions,
): Promise<CqObject> {
  const head = await store.latest(session.room);
  const obj = await cq.finalize({
    ...draft,
    coords: { room: session.room, ...draft.coords },
    provenance: { derived_from: head ? [head.id] : [], ...draft.provenance },
  });
  await ingestLocal(obj, session.room);
  session.seq += 1;
  const envelope = await seal(obj, session.room, session.key, session.identity, session.seq);
  await publishEnvelope(session.identity, session.room, envelope);
  session.p2p?.sendCq(obj);
  opts.onObject(obj);
  return obj;
}

export function attachP2P(session: PersistSession, callbacks: P2PCallbacks): P2PConnection {
  const p2p = createP2P(session.room, {
    ...callbacks,
    onCq: async (object) => {
      if (await store.has(object.id)) return;
      await ingestLocal(object, session.room);
      callbacks.onCq?.(object);
    },
    onCqSync: (since) => {
      void fillCqGap(session, p2p, since);
    },
    onOpen: () => {
      session.signaling = 'connected';
      void store.latest(session.room).then((h) => p2p.requestCqSync(h?.id ?? null));
      callbacks.onOpen?.();
    },
  });
  session.p2p = p2p;
  return p2p;
}

export async function connectHybrid(session: PersistSession, opts: PersistOptions): Promise<P2PConnection> {
  const p2p = attachP2P(session, {
    onState: () => {},
    onStatus: opts.onStatus,
    onOpen: opts.onOpen,
    onChat: opts.p2p?.onChat,
    onCq: (obj) => {
      opts.p2p?.onCq?.(obj);
      void handleSignalingObject(session, p2p, obj, opts);
    },
  });

  await processPendingSignaling(session, p2p, opts);

  if (session.role === 'host' && session.signaling === 'idle') {
    opts.onStatus('Publicando offer WebRTC…');
    const sdp = await p2p.createOffer();
    await appendObject(session, {
      kind: 'funnel.webrtc_offer/1',
      payload: { sdp },
    }, opts);
    session.signaling = 'offered';
  }

  return p2p;
}

async function fillCqGap(
  session: PersistSession,
  p2p: P2PConnection,
  since: CqId | null,
): Promise<void> {
  const rows = await store.after(session.room, since);
  for (const row of rows) {
    p2p.sendCq(row.object);
  }
}

async function processPendingSignaling(
  session: PersistSession,
  p2p: P2PConnection,
  opts: PersistOptions,
): Promise<void> {
  const offers = await store.getByRoom(session.room, { kind: 'funnel.webrtc_offer/1' });
  const answers = await store.getByRoom(session.room, { kind: 'funnel.webrtc_answer/1' });

  if (session.role === 'guest' && offers.length && session.signaling === 'idle') {
    await handleOffer(session, p2p, offers.at(-1)!.object, opts);
  }
  if (session.role === 'host' && answers.length && session.signaling !== 'connected') {
    await handleAnswer(session, p2p, answers.at(-1)!.object, opts);
  }
}

async function handleSignalingObject(
  session: PersistSession,
  p2p: P2PConnection,
  obj: CqObject,
  opts: PersistOptions,
): Promise<void> {
  if (obj.kind === 'funnel.webrtc_offer/1' && session.role === 'guest') {
    await handleOffer(session, p2p, obj, opts);
  }
  if (obj.kind === 'funnel.webrtc_answer/1' && session.role === 'host') {
    await handleAnswer(session, p2p, obj, opts);
  }
}

async function handleOffer(
  session: PersistSession,
  p2p: P2PConnection,
  obj: CqObject,
  opts: PersistOptions,
): Promise<void> {
  if (session.signaling !== 'idle') return;
  const sdp = obj.payload.sdp;
  if (typeof sdp !== 'string') return;
  session.signaling = 'offered';
  opts.onStatus('Respondiendo offer WebRTC…');
  const answer = await p2p.createAnswer(sdp);
  await appendObject(session, {
    kind: 'funnel.webrtc_answer/1',
    payload: { sdp: answer, offer_id: obj.id },
  }, opts);
  session.signaling = 'answered';
}

async function handleAnswer(
  session: PersistSession,
  p2p: P2PConnection,
  obj: CqObject,
  opts: PersistOptions,
): Promise<void> {
  if (session.signaling === 'connected') return;
  const sdp = obj.payload.sdp;
  if (typeof sdp !== 'string') return;
  opts.onStatus('Aceptando answer WebRTC…');
  await p2p.acceptAnswer(sdp);
  session.signaling = 'answered';
}

async function ingestLocal(obj: CqObject, room: string): Promise<void> {
  const expected = await cq.computeId({ ...obj, id: undefined });
  if (expected !== obj.id) throw new Error('CQ id mismatch');
  await store.append(obj, room);
}

async function seal(
  obj: CqObject,
  room: string,
  key: string,
  identity: funnelCrypto.Identity,
  seq: number,
): Promise<CqPersistEnvelope> {
  const plaintext = cq.canonicalize(obj);
  return {
    v: 1,
    room,
    seq,
    cq_id: obj.id,
    ciphertext: await funnelCrypto.encrypt(key, plaintext),
    author: identity.npub,
  };
}

async function publishEnvelope(
  identity: funnelCrypto.Identity,
  room: string,
  envelope: CqPersistEnvelope,
): Promise<void> {
  const event = await nostr.signEvent(
    identity,
    EPHEMERAL_KIND,
    JSON.stringify(envelope),
    [['r', room], ['t', 'cqpersist']],
  );
  await nostr.publishToRelays(nostr.DEFAULT_RELAYS, event);
}

function startNostrListener(session: PersistSession, opts: PersistOptions): () => void {
  const stops = nostr.DEFAULT_RELAYS.map((relay) =>
    nostr.subscribe(relay, [{ '#r': [session.room], kinds: [EPHEMERAL_KIND] }], (ev) => {
      void handleNostrEvent(session, ev, opts);
    }),
  );
  return () => stops.forEach((stop) => stop());
}

async function handleNostrEvent(
  session: PersistSession,
  event: nostr.NostrEvent,
  opts: PersistOptions,
): Promise<void> {
  try {
    const envelope = JSON.parse(event.content) as CqPersistEnvelope;
    if (envelope.room !== session.room) return;
    if (await store.has(envelope.cq_id)) return;
    const plaintext = await funnelCrypto.decrypt(session.key, envelope.ciphertext);
    const obj = JSON.parse(plaintext) as CqObject;
    if (obj.id !== envelope.cq_id) return;
    await ingestLocal(obj, session.room);
    opts.onObject(obj);
    if (session.p2p) {
      void handleSignalingObject(session, session.p2p, obj, opts);
    }
  } catch { /* ignore malformed */ }
}

export async function queryRoom(room: string): Promise<CqObject[]> {
  const rows = await store.getByRoom(room);
  return rows.map((r) => r.object);
}

export async function listRooms(): Promise<string[]> {
  return store.allRooms();
}
