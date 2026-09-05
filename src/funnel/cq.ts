import type { CqId, CqObject, CqObjectDraft } from './types.js';

const SET_KEYS = new Set(['derived_from', 'parents', 'caused_by', 'supersedes', 'revokes']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function sortSet(arr: unknown[]): string[] {
  return [...new Set(arr.map(String))].sort();
}

function normalizeForHash(obj: unknown, parentKey: string): unknown {
  if (obj === null || typeof obj === 'string' || typeof obj === 'boolean') return obj;
  if (typeof obj === 'number') {
    if (!Number.isInteger(obj)) throw new Error('CQ: floats no permitidos');
    return obj;
  }
  if (Array.isArray(obj)) {
    const items = obj.map((item, i) => normalizeForHash(item, `${parentKey}[${i}]`));
    return SET_KEYS.has(parentKey) ? sortSet(items) : items;
  }
  if (!isPlainObject(obj)) throw new Error('CQ: tipo no soportado');
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k === 'id' || k === 'signatures') continue;
    out[k] = normalizeForHash(obj[k], k);
  }
  return out;
}

export function canonicalize(obj: unknown): string {
  return JSON.stringify(normalizeForHash(obj, ''));
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeId(obj: unknown): Promise<CqId> {
  return `cq:sha256:${await sha256Hex(canonicalize(obj))}`;
}

export function build(partial: CqObjectDraft): Omit<CqObject, 'id'> {
  const now = Math.floor(Date.now() / 1000);
  return {
    cq: '2',
    kind: partial.kind,
    coords: partial.coords ?? {},
    payload: partial.payload ?? {},
    provenance: {
      parents: partial.provenance?.parents ?? [],
      derived_from: partial.provenance?.derived_from ?? [],
      caused_by: partial.provenance?.caused_by ?? [],
    },
    operations: partial.operations ?? [],
    lifecycle: {
      issued_at: partial.lifecycle?.issued_at ?? now,
      not_before: partial.lifecycle?.not_before ?? null,
      expires_at: partial.lifecycle?.expires_at ?? null,
      supersedes: partial.lifecycle?.supersedes ?? [],
      revokes: partial.lifecycle?.revokes ?? [],
    },
  };
}

export async function finalize(partial: CqObjectDraft): Promise<CqObject> {
  const body = build(partial);
  const id = await computeId(body);
  return { ...body, id };
}
