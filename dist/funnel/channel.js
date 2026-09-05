import * as cq from './cq.js';
import { createP2P } from './ephemeral.js';
export function openChannel(room, opts) {
    const log = [];
    const seen = new Set();
    const listeners = new Set();
    const p2p = createP2P(room, {
        onState: () => { },
        onStatus: opts.onStatus,
        onOpen: () => {
            p2p.requestCqSync(head()?.id ?? null);
            opts.onOpen?.();
        },
        onCq: (object) => {
            void ingest(object);
        },
        onCqSync: (since) => {
            for (const obj of after(since))
                p2p.sendCq(obj);
        },
    });
    function head() {
        return log.at(-1) ?? null;
    }
    function after(since) {
        if (!since)
            return [...log];
        const idx = log.findIndex((o) => o.id === since);
        return idx === -1 ? [...log] : log.slice(idx + 1);
    }
    async function ingest(obj) {
        if (seen.has(obj.id))
            return false;
        const expected = await cq.computeId({ ...obj, id: undefined });
        if (expected !== obj.id)
            return false;
        seen.add(obj.id);
        log.push(obj);
        for (const fn of listeners)
            fn(obj);
        return true;
    }
    const channel = {
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
            if (p2p.isOpen())
                p2p.sendCq(obj);
            return obj;
        },
        onObject: (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };
    return channel;
}
//# sourceMappingURL=channel.js.map