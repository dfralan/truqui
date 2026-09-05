const DB_NAME = 'funnel-cq';
const STORE = 'objects';
const DB_VER = 1;
const memory = new Map();
function recordFrom(obj, room) {
    return {
        id: obj.id,
        room: room ?? obj.coords.room ?? '',
        kind: obj.kind,
        issued_at: obj.lifecycle.issued_at,
        derived_from: obj.provenance.derived_from,
        object: obj,
    };
}
function openDb() {
    if (typeof indexedDB === 'undefined')
        return Promise.resolve(null);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                const os = db.createObjectStore(STORE, { keyPath: 'id' });
                os.createIndex('room', 'room', { unique: false });
                os.createIndex('kind', 'kind', { unique: false });
                os.createIndex('issued_at', 'issued_at', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
function txPut(db, record) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(record);
        tx.oncomplete = () => resolve(record);
        tx.onerror = () => reject(tx.error);
    });
}
function txGet(db, id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(id);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
    });
}
function txByRoom(db, room) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).index('room').getAll(room);
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror = () => reject(req.error);
    });
}
export async function append(obj, room) {
    const record = recordFrom(obj, room);
    const db = await openDb();
    if (!db) {
        memory.set(record.id, record);
        return record;
    }
    const saved = await txPut(db, record);
    db.close();
    return saved;
}
export async function get(id) {
    const db = await openDb();
    if (!db)
        return memory.get(id) ?? null;
    const row = await txGet(db, id);
    db.close();
    return row;
}
export async function getByRoom(room, query = {}) {
    const db = await openDb();
    let rows;
    if (!db) {
        rows = [...memory.values()].filter((r) => r.room === room);
    }
    else {
        rows = await txByRoom(db, room);
        db.close();
    }
    if (query.kind)
        rows = rows.filter((r) => r.kind === query.kind);
    if (query.since != null)
        rows = rows.filter((r) => r.issued_at >= query.since);
    return rows.sort((a, b) => a.issued_at - b.issued_at);
}
export async function latest(room) {
    const rows = await getByRoom(room);
    return rows.at(-1) ?? null;
}
export async function chain(fromId, limit = 100) {
    const out = [];
    const seen = new Set();
    let cur = fromId;
    while (cur && out.length < limit && !seen.has(cur)) {
        seen.add(cur);
        const row = await get(cur);
        if (!row)
            break;
        out.push(row);
        cur = row.derived_from[0] ?? null;
    }
    return out;
}
export async function after(room, sinceId) {
    const rows = await getByRoom(room);
    if (!sinceId)
        return rows;
    const idx = rows.findIndex((r) => r.id === sinceId);
    return idx === -1 ? rows : rows.slice(idx + 1);
}
export async function has(id) {
    return (await get(id)) !== null;
}
export async function allRooms() {
    const db = await openDb();
    if (!db)
        return [...new Set([...memory.values()].map((r) => r.room))];
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => {
            const rows = req.result ?? [];
            db.close();
            resolve([...new Set(rows.map((r) => r.room).filter(Boolean))]);
        };
        req.onerror = () => reject(req.error);
    });
}
//# sourceMappingURL=store.js.map