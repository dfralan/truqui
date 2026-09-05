import type { PointerHint } from './types.js';

const DEFAULT_BASE = '/api/pointer';

export async function putPointer(hint: PointerHint, base = DEFAULT_BASE): Promise<void> {
  const res = await fetch(`${base}/${encodeURIComponent(hint.room)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hint),
  });
  if (!res.ok) throw new Error(`pointer PUT ${res.status}`);
}

export async function getPointer(room: string, base = DEFAULT_BASE): Promise<PointerHint | null> {
  const res = await fetch(`${base}/${encodeURIComponent(room)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`pointer GET ${res.status}`);
  return res.json() as Promise<PointerHint>;
}
