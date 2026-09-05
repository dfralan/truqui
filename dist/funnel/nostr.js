import { schnorr } from '@noble/secp256k1';
export const DEFAULT_RELAYS = [
    'wss://relay.damus.io',
    'wss://nos.lol',
];
async function eventHash(event) {
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
function hexPk(pk) {
    const x = pk.length === 33 ? pk.slice(1) : pk;
    return Array.from(x).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function hexSig(sig) {
    return Array.from(sig).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function signEvent(identity, kind, content, tags) {
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
export function publish(relay, event) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(relay);
        const timer = setTimeout(() => {
            ws.close();
            reject(new Error('relay timeout'));
        }, 8000);
        ws.onopen = () => ws.send(JSON.stringify(['EVENT', event]));
        ws.onmessage = (ev) => {
            const msg = JSON.parse(String(ev.data));
            clearTimeout(timer);
            ws.close();
            if (msg[0] === 'OK' && msg[2])
                resolve();
            else
                reject(new Error(msg[3] ?? 'relay rejected'));
        };
        ws.onerror = () => {
            clearTimeout(timer);
            reject(new Error('relay error'));
        };
    });
}
export function subscribe(relay, filters, onEvent) {
    const ws = new WebSocket(relay);
    ws.onopen = () => ws.send(JSON.stringify(['REQ', crypto.randomUUID(), ...filters]));
    ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data));
        if (msg[0] === 'EVENT')
            onEvent(msg[2]);
    };
    return () => ws.close();
}
export async function publishToRelays(relays, event) {
    let lastErr = null;
    for (const relay of relays) {
        try {
            await publish(relay, event);
            return relay;
        }
        catch (e) {
            lastErr = e instanceof Error ? e : new Error(String(e));
        }
    }
    throw lastErr ?? new Error('sin relays');
}
//# sourceMappingURL=nostr.js.map