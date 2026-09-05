import { openChannel } from '../funnel/channel.js';
import { parseLink } from '../funnel/ephemeral.js';
import { $, escapeHtml } from '../funnel/util.js';
import { htmlPreview, MESSAGE_KIND, mountChat } from '../scripts/chat.js';
const link = parseLink();
let roomId = link.r ?? link.room;
let channel = null;
let unmountScript = null;
let activeScript = 'chat';
const statusEl = $('status');
const lobbyEl = $('lobby');
const canalEl = $('canal');
const timelineEl = $('timeline');
const scriptView = $('script-view');
const composerEl = $('composer');
const shareBox = $('share-box');
const shareLink = $('share-link');
const answerBox = $('answer-box');
const answerLink = $('answer-link');
const responseBox = $('response-box');
const responseLink = $('response-link');
const kindInput = $('obj-kind');
const payloadInput = $('obj-payload');
function setStatus(text) {
    statusEl.textContent = text;
}
function showCanal() {
    lobbyEl.hidden = true;
    canalEl.hidden = false;
    mountActiveScript();
}
function objectPreview(obj) {
    const msg = htmlPreview(obj);
    if (msg)
        return msg;
    try {
        return escapeHtml(JSON.stringify(obj.payload));
    }
    catch {
        return '';
    }
}
function renderObject(obj) {
    const el = document.createElement('div');
    el.className = 'event-row';
    const time = new Date(obj.lifecycle.issued_at * 1000).toLocaleTimeString();
    el.innerHTML = `<time>${time}</time><code>${escapeHtml(obj.kind)}</code><span>${objectPreview(obj)}</span>`;
    timelineEl.prepend(el);
}
function mountActiveScript() {
    unmountScript?.();
    unmountScript = null;
    if (!channel)
        return;
    if (activeScript === 'chat')
        unmountScript = mountChat(scriptView, channel);
}
function initChannel(id) {
    roomId = id;
    channel = openChannel(id, {
        onStatus: setStatus,
        onOpen: () => {
            showCanal();
            setStatus('Canal activo');
        },
    });
    channel.onObject(renderObject);
    return channel;
}
async function copyBtn(btn, text) {
    await navigator.clipboard.writeText(text);
    const prev = btn.textContent;
    btn.textContent = 'Copiado';
    setTimeout(() => { btn.textContent = prev; }, 1500);
}
async function startRoom() {
    const id = crypto.randomUUID().slice(0, 8);
    const ch = initChannel(id);
    sessionStorage.setItem(`funnel-host-${id}`, '1');
    const inviteUrl = await ch.p2p.createInvite();
    history.replaceState(null, '', inviteUrl);
    shareLink.value = inviteUrl;
    shareBox.hidden = false;
    answerBox.hidden = false;
    $('btn-start').hidden = true;
    setStatus('Compartí el link con tu par');
}
async function joinFromInvite(offer) {
    if (!roomId)
        return;
    const ch = initChannel(roomId);
    shareBox.hidden = true;
    $('btn-start').hidden = true;
    try {
        const answerUrl = await ch.p2p.joinInvite(offer);
        responseLink.value = answerUrl;
        responseBox.hidden = false;
        setStatus('Mandale el link de respuesta al host');
    }
    catch (err) {
        setStatus(err instanceof Error ? err.message : 'Error al conectar');
    }
}
async function restoreHost() {
    if (!roomId)
        return;
    initChannel(roomId);
    $('btn-start').hidden = true;
    shareBox.hidden = false;
    answerBox.hidden = false;
    shareLink.value = location.href;
    setStatus('Esperando par…');
}
async function hostAcceptAnswer(url) {
    if (!channel)
        return;
    try {
        setStatus('Conectando…');
        await channel.p2p.acceptAnswerFromUrl(url.trim());
    }
    catch {
        setStatus('Link de respuesta inválido');
    }
}
async function publishFromComposer() {
    if (!channel)
        return;
    const kind = kindInput.value.trim() || MESSAGE_KIND;
    let payload = {};
    const raw = payloadInput.value.trim();
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                setStatus('Payload tiene que ser un objeto JSON');
                return;
            }
            payload = parsed;
        }
        catch {
            payload = { text: raw };
        }
    }
    await channel.publish({ kind, payload });
    payloadInput.value = '';
    composerEl.hidden = true;
}
$('btn-start').addEventListener('click', () => void startRoom());
$('btn-copy').addEventListener('click', () => void copyBtn($('btn-copy'), shareLink.value));
$('btn-copy-response').addEventListener('click', () => void copyBtn($('btn-copy-response'), responseLink.value));
$('btn-connect').addEventListener('click', () => void hostAcceptAnswer(answerLink.value));
$('btn-plus').addEventListener('click', () => {
    composerEl.hidden = !composerEl.hidden;
    if (!composerEl.hidden)
        payloadInput.focus();
});
$('btn-publish').addEventListener('click', () => void publishFromComposer());
$('script-select').addEventListener('change', (e) => {
    activeScript = e.target.value;
    mountActiveScript();
});
if (roomId && link.o && sessionStorage.getItem(`funnel-host-${roomId}`) === '1') {
    void restoreHost();
}
else if (roomId && link.o) {
    void joinFromInvite(link.o);
}
else if (roomId && link.a) {
    const ch = initChannel(roomId);
    $('btn-start').hidden = true;
    shareBox.hidden = true;
    answerBox.hidden = true;
    ch.p2p.acceptAnswer(link.a)
        .then(() => setStatus('Conectando…'))
        .catch(() => setStatus('Abrí en la pestaña donde creaste la sala'));
}
else if (roomId) {
    setStatus('Link incompleto — pedile al host el link con &o=');
    $('btn-start').hidden = true;
}
//# sourceMappingURL=main.js.map