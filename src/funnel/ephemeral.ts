import type { CqId, CqObject, CqPersistEnvelope, P2PCallbacks, ParsedLink, P2PRole } from './types.js';
import { buildUrl, getQueryParam, pack, parseUrlParams, unpack } from './util.js';

const STUN: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function toDesc(init: RTCSessionDescriptionInit): RTCSessionDescription | RTCSessionDescriptionInit {
  return typeof RTCSessionDescription !== 'undefined' ? new RTCSessionDescription(init) : init;
}

function waitIce(pc: RTCPeerConnection, ms = 10000): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return Promise.race([
    new Promise<void>((resolve) => {
      const done = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', done);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', done);
    }),
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Timeout ICE')), ms)),
  ]);
}

function hostKey(roomId: string): string {
  return `truqui-host-${roomId}`;
}

export function parseLink(): ParsedLink {
  return {
    r: getQueryParam('r'),
    o: getQueryParam('o'),
    a: getQueryParam('a'),
    room: getQueryParam('room'),
    k: getQueryParam('k'),
  };
}

export interface P2PConnection {
  createOffer: () => Promise<string>;
  createAnswer: (offerPacked: string) => Promise<string>;
  createInvite: () => Promise<string>;
  joinInvite: (offerPacked: string) => Promise<string>;
  acceptAnswer: (answerPacked: string | RTCSessionDescriptionInit) => Promise<void>;
  acceptAnswerFromUrl: (url: string) => Promise<void>;
  sendState: (data: unknown) => void;
  sendChat: (text: string, from: 0 | 1) => void;
  sendCq: (object: CqObject) => void;
  requestSync: () => void;
  requestCqSync: (since: string | null) => void;
  isOpen: () => boolean;
  close: () => void;
  readonly role: P2PRole | null;
}

export function createP2P(roomId: string, callbacks: P2PCallbacks): P2PConnection {
  let pc: RTCPeerConnection | null = null;
  let dc: RTCDataChannel | null = null;
  let role: P2PRole | null = null;
  let opened = false;
  let bc: BroadcastChannel | null = null;

  try {
    bc = new BroadcastChannel(`truqui-${roomId}`);
    bc.onmessage = (ev: MessageEvent<{ type?: string; sdp?: RTCSessionDescriptionInit }>) => {
      if (ev.data?.type === 'answer' && role === 'host' && ev.data.sdp) {
        acceptAnswer(ev.data.sdp).catch((err: Error) => callbacks.onStatus(`Error: ${err.message}`));
      }
    };
  } catch { /* sin BroadcastChannel */ }

  function fireOpen(): void {
    if (opened) return;
    opened = true;
    callbacks.onStatus('Conectado P2P');
    callbacks.onOpen?.();
  }

  function attachPeerConnection(peer: RTCPeerConnection): void {
    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      if (state === 'connected' && dc?.readyState === 'open') fireOpen();
      if (state === 'failed' || state === 'disconnected') {
        callbacks.onStatus('Conexión perdida — recargá e intentá de nuevo');
      }
    };
    peer.onicecandidate = () => {};
  }

  function setupChannel(channel: RTCDataChannel): void {
    dc = channel;
    dc.onopen = () => fireOpen();
    dc.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type: string; data?: unknown; text?: string; from?: 0 | 1; ts?: number; object?: CqObject; since?: string | null };
        if (msg.type === 'state' && msg.data !== undefined) callbacks.onState(msg.data);
        if (msg.type === 'chat' && msg.text != null && msg.from != null) {
          callbacks.onChat?.({ text: msg.text, from: msg.from, ts: msg.ts ?? Date.now() });
        }
        if (msg.type === 'ready') callbacks.onReady?.();
        if (msg.type === 'cq' && msg.object) callbacks.onCq?.(msg.object);
        if (msg.type === 'cq_sync') callbacks.onCqSync?.((msg.since as CqId | null) ?? null);
      } catch { /* ignore */ }
    };
  }

  function send(payload: unknown): void {
    if (dc?.readyState === 'open') dc.send(JSON.stringify(payload));
  }

  async function restoreHost(): Promise<void> {
    role = 'host';
    const saved = sessionStorage.getItem(hostKey(roomId));
    if (!saved) throw new Error('Sesión de host no encontrada');
    pc = new RTCPeerConnection(STUN);
    attachPeerConnection(pc);
    setupChannel(pc.createDataChannel('game', { ordered: true }));
    await pc.setLocalDescription(toDesc(unpack(saved)));
  }

  async function createOffer(): Promise<string> {
    role = 'host';
    callbacks.onStatus('Generando offer…');
    pc = new RTCPeerConnection(STUN);
    attachPeerConnection(pc);
    setupChannel(pc.createDataChannel('game', { ordered: true }));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIce(pc);
    sessionStorage.setItem(hostKey(roomId), pack(pc.localDescription));
    return pack(pc.localDescription);
  }

  async function createAnswer(offerPacked: string): Promise<string> {
    role = 'guest';
    callbacks.onStatus('Generando answer…');
    const offer = unpack<RTCSessionDescriptionInit>(offerPacked);
    pc = new RTCPeerConnection(STUN);
    attachPeerConnection(pc);
    pc.ondatachannel = (ev) => setupChannel(ev.channel);
    await pc.setRemoteDescription(toDesc(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitIce(pc);
    try {
      bc?.postMessage({ type: 'answer', sdp: pc.localDescription });
    } catch { /* ignore */ }
    return pack(pc.localDescription);
  }

  async function createInvite(): Promise<string> {
    const packed = await createOffer();
    return buildUrl(roomId, { o: packed }, location.pathname);
  }

  async function joinInvite(offerPacked: string): Promise<string> {
    callbacks.onStatus('Conectando con el host…');
    const packed = await createAnswer(offerPacked);
    return buildUrl(roomId, { a: packed }, location.pathname);
  }

  async function acceptAnswer(answerPacked: string | RTCSessionDescriptionInit): Promise<void> {
    if (role !== 'host') role = 'host';
    if (!pc) await restoreHost();
    if (!pc) throw new Error('PeerConnection no inicializado');
    if (pc.remoteDescription) return;
    const answer = typeof answerPacked === 'string' ? unpack<RTCSessionDescriptionInit>(answerPacked) : answerPacked;
    await pc.setRemoteDescription(toDesc(answer));
  }

  async function acceptAnswerFromUrl(url: string): Promise<void> {
    const params = parseUrlParams(url);
    if (!params.a) throw new Error('Link sin respuesta');
    await acceptAnswer(params.a);
  }

  return {
    createOffer,
    createAnswer,
    createInvite,
    joinInvite,
    acceptAnswer,
    acceptAnswerFromUrl,
    sendState: (data) => send({ type: 'state', data }),
    sendChat: (text, from) => send({ type: 'chat', text, from, ts: Date.now() }),
    sendCq: (object) => send({ type: 'cq', object }),
    requestSync: () => send({ type: 'ready' }),
    requestCqSync: (since) => send({ type: 'cq_sync', since }),
    isOpen: () => dc?.readyState === 'open',
    close: () => {
      bc?.close();
      dc?.close();
      pc?.close();
    },
    get role() { return role; },
  };
}

export type { CqPersistEnvelope };
