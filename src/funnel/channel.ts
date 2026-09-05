import * as cq from './cq.js';
import { createP2P, type P2PConnection } from './ephemeral.js';
import type { CqId, CqObject, CqObjectDraft } from './types.js';

export type ObjectListener = (obj: CqObject) => void;

export interface Channel {
  readonly room: string;
  readonly p2p: P2PConnection;
  objects(): CqObject[];
  head(): CqObject | null;
  query(kind?: string): CqObject[];
  publish(draft: CqObjectDraft): Promise<CqObject>;
  onObject(fn: ObjectListener): () => void;
}

export interface ChannelOptions {
  onStatus: (text: string) => void;
  onOpen?: () => void;
}

export function openChannel(room: string, opts: ChannelOptions): Channel {
  const log: CqObject[] = [];
  const seen = new Set<CqId>();
  const listeners = new Set<ObjectListener>();

  const p2p = createP2P(room, {
    onState: () => {},
    onStatus: opts.onStatus,
    onOpen: () => {
      p2p.requestCqSync(head()?.id ?? null);
      opts.onOpen?.();
    },
    onCq: (object) => {
      void ingest(object);
    },
    onCqSync: (since) => {
      for (const obj of after(since)) p2p.sendCq(obj);
    },
  });

  function head(): CqObject | null {
    return log.at(-1) ?? null;
  }

  function after(since: CqId | null): CqObject[] {
    if (!since) return [...log];
    const idx = log.findIndex((o) => o.id === since);
    return idx === -1 ? [...log] : log.slice(idx + 1);
  }

  async function ingest(obj: CqObject): Promise<boolean> {
    if (seen.has(obj.id)) return false;
    const expected = await cq.computeId({ ...obj, id: undefined });
    if (expected !== obj.id) return false;
    seen.add(obj.id);
    log.push(obj);
    for (const fn of listeners) fn(obj);
    return true;
  }

  const channel: Channel = {
    room,
    p2p,
    objects: () => [...log],
    head,
    query: (kind) => kind ? log.filter((o) => o.kind === kind) : [...log],
    publish: async (draft) => {
      const prev = head();
      const obj = await cq.finalize({
        ...draft,
        coords: { room, ...draft.coords },
        provenance: {
          derived_from: prev ? [prev.id] : [],
          ...draft.provenance,
        },
      });
      await ingest(obj);
      if (p2p.isOpen()) p2p.sendCq(obj);
      return obj;
    },
    onObject: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  return channel;
}
