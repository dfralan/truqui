import { schnorr } from '@noble/secp256k1';
import type { Identity } from './crypto.js';

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
];

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface NostrFilter {
  kinds?: number[];
  '#r'?: string[];
  '#t'?: string[];
  since?: number;
  limit?: number;
}

async function eventHash(event: Omit<NostrEvent, 'id' | 'sig'>): Promise<Uint8Array> {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized)));
}

function hexPk(pk: Uint8Array): string {
  const x = pk.length === 33 ? pk.slice(1) : pk;
  return Array.from(x).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexSig(sig: Uint8Array): string {
  return Array.from(sig).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signEvent(
  identity: Identity,
  kind: number,
  content: string,
  tags: string[][],
): Promise<NostrEvent> {
  const draft = {
    pubkey: hexPk(identity.pk),
    created_at: Math.floor(Date.now() / 1000),
    kind,
    tags,
    content,
  };
  const idBytes = await eventHash(draft);
  const id = hexSig(idBytes);
  const sig = await schnorr.sign(idBytes, identity.sk);
  return { ...draft, id, sig: hexSig(sig) };
}

export function publish(relay: string, event: NostrEvent): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(relay);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('relay timeout'));
    }, 8000);
    ws.onopen = () => ws.send(JSON.stringify(['EVENT', event]));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as [string, string, boolean, string];
      clearTimeout(timer);
      ws.close();
      if (msg[0] === 'OK' && msg[2]) resolve();
      else reject(new Error(msg[3] ?? 'relay rejected'));
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error('relay error'));
    };
  });
}

export function subscribe(
  relay: string,
  filters: NostrFilter[],
  onEvent: (event: NostrEvent) => void,
): () => void {
  const ws = new WebSocket(relay);
  ws.onopen = () => ws.send(JSON.stringify(['REQ', crypto.randomUUID(), ...filters]));
  ws.onmessage = (ev) => {
    const msg = JSON.parse(String(ev.data)) as [string, ...unknown[]];
    if (msg[0] === 'EVENT') onEvent(msg[2] as NostrEvent);
  };
  return () => ws.close();
}

export async function publishToRelays(
  relays: string[],
  event: NostrEvent,
): Promise<string> {
  let lastErr: Error | null = null;
  for (const relay of relays) {
    try {
      await publish(relay, event);
      return relay;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error('sin relays');
}
