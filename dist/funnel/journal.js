import * as cq from './cq.js';
import * as store from './store.js';
export const KIND = {
    nip: 'funnel.nip/1',
    snap: 'funnel.snap/1',
    meet: 'funnel.meet/1',
};
export async function publish(room, draft, p2p) {
    const head = await store.latest(room);
    const obj = await cq.finalize({
        ...draft,
        coords: { room, ...draft.coords },
        provenance: { derived_from: head ? [head.id] : [], ...draft.provenance },
    });
    await store.append(obj, room);
    p2p?.sendCq(obj);
    return obj;
}
export async function ingest(obj, room) {
    if (await store.has(obj.id))
        return false;
    const expected = await cq.computeId({ ...obj, id: undefined });
    if (expected !== obj.id)
        return false;
    await store.append(obj, room);
    return true;
}
export async function query(room, q = {}) {
    let rows = await store.getByRoom(room);
    if (q.kind)
        rows = rows.filter((r) => r.kind === q.kind);
    if (q.text) {
        const needle = q.text.toLowerCase();
        rows = rows.filter((r) => JSON.stringify(r.object.payload).toLowerCase().includes(needle));
    }
    return rows.map((r) => r.object);
}
export function parseQuery(raw) {
    const q = {};
    for (const part of raw.trim().split(/\s+/)) {
        if (!part)
            continue;
        const eq = part.indexOf('=');
        if (eq === -1) {
            q.text = part;
            continue;
        }
        const key = part.slice(0, eq);
        const val = part.slice(eq + 1);
        if (key === 'kind')
            q.kind = val;
        else if (key === 'text')
            q.text = val;
    }
    return q;
}
export async function syncSince(room, since, p2p) {
    const rows = await store.after(room, since);
    for (const row of rows)
        p2p.sendCq(row.object);
}
export async function loadFeed(room, q = {}) {
    const all = await query(room, q);
    return all.filter((obj) => !isExpired(obj));
}
function isExpired(obj) {
    const exp = obj.lifecycle.expires_at;
    return exp != null && exp < Math.floor(Date.now() / 1000);
}
export function nipLabel(kind) {
    if (kind === KIND.snap)
        return 'snap';
    if (kind === KIND.meet)
        return 'meet';
    return 'nip';
}
//# sourceMappingURL=journal.js.map