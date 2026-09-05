import { buildUrl, getQueryParam, pack, parseUrlParams, unpack } from './util.js';
const STUN = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};
function toDesc(init) {
    return typeof RTCSessionDescription !== 'undefined' ? new RTCSessionDescription(init) : init;
}
function waitIce(pc, ms = 10000) {
    if (pc.iceGatheringState === 'complete')
        return Promise.resolve();
    return Promise.race([
        new Promise((resolve) => {
            const done = () => {
                if (pc.iceGatheringState === 'complete') {
                    pc.removeEventListener('icegatheringstatechange', done);
                    resolve();
                }
            };
            pc.addEventListener('icegatheringstatechange', done);
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout ICE')), ms)),
    ]);
}
function hostKey(roomId) {
    return `truqui-host-${roomId}`;
}
export function parseLink() {
    return {
        r: getQueryParam('r'),
        o: getQueryParam('o'),
        a: getQueryParam('a'),
        room: getQueryParam('room'),
        k: getQueryParam('k'),
    };
}
export function createP2P(roomId, callbacks) {
    let pc = null;
    let dc = null;
    let role = null;
    let opened = false;
    let bc = null;
    try {
        bc = new BroadcastChannel(`truqui-${roomId}`);
        bc.onmessage = (ev) => {
            if (ev.data?.type === 'answer' && role === 'host' && ev.data.sdp) {
                acceptAnswer(ev.data.sdp).catch((err) => callbacks.onStatus(`Error: ${err.message}`));
            }
        };
    }
    catch { /* sin BroadcastChannel */ }
    function fireOpen() {
        if (opened)
            return;
        opened = true;
        callbacks.onStatus('Conectado P2P');
        callbacks.onOpen?.();
    }
    function attachPeerConnection(peer) {
        peer.onconnectionstatechange = () => {
            const state = peer.connectionState;
            if (state === 'connected' && dc?.readyState === 'open')
                fireOpen();
            if (state === 'failed' || state === 'disconnected') {
                callbacks.onStatus('Conexión perdida — recargá e intentá de nuevo');
            }
        };
        peer.onicecandidate = () => { };
    }
    function setupChannel(channel) {
        dc = channel;
        dc.onopen = () => fireOpen();
        dc.onmessage = (ev) => {
            try {
                const msg = JSON.parse(String(ev.data));
                if (msg.type === 'state' && msg.data !== undefined)
                    callbacks.onState(msg.data);
                if (msg.type === 'chat' && msg.text != null && msg.from != null) {
                    callbacks.onChat?.({ text: msg.text, from: msg.from, ts: msg.ts ?? Date.now() });
                }
                if (msg.type === 'ready')
                    callbacks.onReady?.();
                if (msg.type === 'cq' && msg.object)
                    callbacks.onCq?.(msg.object);
                if (msg.type === 'cq_sync')
                    callbacks.onCqSync?.(msg.since ?? null);
            }
            catch { /* ignore */ }
        };
    }
    function send(payload) {
        if (dc?.readyState === 'open')
            dc.send(JSON.stringify(payload));
    }
    async function restoreHost() {
        role = 'host';
        const saved = sessionStorage.getItem(hostKey(roomId));
        if (!saved)
            throw new Error('Sesión de host no encontrada');
        pc = new RTCPeerConnection(STUN);
        attachPeerConnection(pc);
        setupChannel(pc.createDataChannel('game', { ordered: true }));
        await pc.setLocalDescription(toDesc(unpack(saved)));
    }
    async function createOffer() {
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
    async function createAnswer(offerPacked) {
        role = 'guest';
        callbacks.onStatus('Generando answer…');
        const offer = unpack(offerPacked);
        pc = new RTCPeerConnection(STUN);
        attachPeerConnection(pc);
        pc.ondatachannel = (ev) => setupChannel(ev.channel);
        await pc.setRemoteDescription(toDesc(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitIce(pc);
        try {
            bc?.postMessage({ type: 'answer', sdp: pc.localDescription });
        }
        catch { /* ignore */ }
        return pack(pc.localDescription);
    }
    async function createInvite() {
        const packed = await createOffer();
        return buildUrl(roomId, { o: packed }, location.pathname);
    }
    async function joinInvite(offerPacked) {
        callbacks.onStatus('Conectando con el host…');
        const packed = await createAnswer(offerPacked);
        return buildUrl(roomId, { a: packed }, location.pathname);
    }
    async function acceptAnswer(answerPacked) {
        if (role !== 'host')
            role = 'host';
        if (!pc)
            await restoreHost();
        if (!pc)
            throw new Error('PeerConnection no inicializado');
        if (pc.remoteDescription)
            return;
        const answer = typeof answerPacked === 'string' ? unpack(answerPacked) : answerPacked;
        await pc.setRemoteDescription(toDesc(answer));
    }
    async function acceptAnswerFromUrl(url) {
        const params = parseUrlParams(url);
        if (!params.a)
            throw new Error('Link sin respuesta');
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
//# sourceMappingURL=ephemeral.js.map