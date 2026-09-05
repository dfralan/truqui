const DEFAULT_BASE = '/api/pointer';
export async function putPointer(hint, base = DEFAULT_BASE) {
    const res = await fetch(`${base}/${encodeURIComponent(hint.room)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hint),
    });
    if (!res.ok)
        throw new Error(`pointer PUT ${res.status}`);
}
export async function getPointer(room, base = DEFAULT_BASE) {
    const res = await fetch(`${base}/${encodeURIComponent(room)}`);
    if (res.status === 404)
        return null;
    if (!res.ok)
        throw new Error(`pointer GET ${res.status}`);
    return res.json();
}
//# sourceMappingURL=pointer.js.map