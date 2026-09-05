import { createP2P, parseLink } from '../funnel/ephemeral.js';
import { $, escapeHtml } from '../funnel/util.js';
import { ENVIDO_ACCEPT_PTS, ENVIDO_NAMES, TRUCO_NAMES, allHandCards, applyEnvidoCall, applyEnvidoResponse, applyPlay, applyTrucoCall, applyTrucoResponse, canCallEnvido, envidoPoints, faltaEnvidoPoints, finishHand, initialRoomState, newGameState, normalizeHand, parseCard, RANK_LABELS, rivalIndex, slotIndex, } from './game.js';
const playerId = localStorage.getItem('truqui-id') ?? crypto.randomUUID();
localStorage.setItem('truqui-id', playerId);
const link = parseLink();
let roomId = link.r ?? link.room;
let mySlot = null;
let p2p = null;
let roomState = null;
let lastUpdatedAt = 0;
let gameStarted = false;
const layout = $('layout');
const hero = $('hero');
const lobby = $('lobby');
const gameEl = $('game');
const statusEl = $('status');
const shareBox = $('share-box');
const shareLink = $('share-link');
const answerBox = $('answer-box');
const answerLink = $('answer-link');
const responseBox = $('response-box');
const responseLink = $('response-link');
const chatPanel = $('chat-panel');
const chatLog = $('chat-log');
const chatForm = $('chat-form');
const chatInput = $('chat-input');
const chatSend = $('chat-send');
const scoresEl = $('scores');
const opponentArea = $('opponent-area');
const opponentHand = $('opponent-hand');
const rivalPlayed = $('rival-played');
const myPlayed = $('my-played');
const myHand = $('my-hand');
const actionsEl = $('actions');
const msgEl = $('msg');
function setStatus(text) {
    statusEl.textContent = text;
}
function setMsg(text) {
    msgEl.textContent = text;
}
function showLobby() {
    lobby.hidden = false;
    gameEl.hidden = true;
}
function showGame() {
    lobby.hidden = true;
    gameEl.hidden = false;
    hero.classList.add('compact');
}
function showChat() {
    if (layout.classList.contains('with-chat'))
        return;
    layout.classList.add('with-chat');
    chatInput.disabled = false;
    chatSend.disabled = false;
}
function resolveMySlot() {
    if (p2p?.role === 'host')
        return 0;
    if (p2p?.role === 'guest')
        return 1;
    return slotIndex(mySlot ?? 0);
}
function onP2POpen() {
    showChat();
    appendChat({ text: '— CONECTADO P2P —', system: true });
    onGameReady();
    if (p2p?.role === 'guest') {
        p2p.requestSync();
        setTimeout(() => p2p?.requestSync(), 500);
        setTimeout(() => p2p?.requestSync(), 1500);
    }
}
function onSyncRequest() {
    if (p2p?.role === 'host' && roomState?.status === 'playing') {
        p2p.sendState(roomState);
    }
}
function onGameReady() {
    if (gameStarted)
        return;
    gameStarted = true;
    responseBox.hidden = true;
    answerBox.hidden = true;
    if (p2p?.role === 'host') {
        mySlot = 0;
        const room = roomState ?? initialRoomState();
        room.players[playerId] = { slot: 0, joinedAt: Date.now() };
        room.players['_guest'] = { slot: 1, joinedAt: Date.now() };
        writeRoom({ ...room, ...newGameState([0, 0]) });
        setTimeout(() => p2p?.sendState(roomState), 300);
        setTimeout(() => p2p?.sendState(roomState), 1000);
    }
    else {
        mySlot = 1;
        setStatus('CONECTADO — ARRANCANDO…');
    }
}
function appendChat(msg) {
    const el = document.createElement('div');
    el.className = 'chat-msg' + (msg.system ? ' system' : msg.from === mySlot ? ' mine' : '');
    if (msg.system) {
        el.textContent = msg.text;
    }
    else {
        const who = msg.from === mySlot ? 'VOS' : 'RIVAL';
        el.innerHTML = `<span class="who">${who}</span>${escapeHtml(msg.text)}`;
    }
    chatLog.appendChild(el);
    chatLog.scrollTop = chatLog.scrollHeight;
}
function sendChatMessage(text) {
    const t = text.trim();
    if (!t || !p2p?.isOpen() || mySlot == null)
        return;
    p2p.sendChat(t, resolveMySlot());
    appendChat({ text: t, from: mySlot });
}
function initP2P(id) {
    roomId = id;
    p2p = createP2P(id, {
        onState: (data) => render(data),
        onStatus: setStatus,
        onOpen: onP2POpen,
        onChat: (msg) => appendChat(msg),
        onReady: onSyncRequest,
    });
}
function writeRoom(data) {
    data.updatedAt = Date.now();
    roomState = data;
    p2p?.sendState(data);
    render(data);
}
function render(data) {
    if (!data?.players)
        return;
    if (data.updatedAt && data.updatedAt <= lastUpdatedAt)
        return;
    lastUpdatedAt = data.updatedAt || 0;
    roomState = data;
    if (!data.players[playerId] && !data.players['_guest'] && !p2p?.role)
        return;
    mySlot = resolveMySlot();
    const rival = rivalIndex(mySlot);
    if (data.status === 'waiting') {
        showLobby();
        return;
    }
    showGame();
    const hand = data.hand ? normalizeHand(data.hand) : null;
    if (!hand)
        return;
    scoresEl.innerHTML = `<span>VOS: ${data.scores[mySlot]}</span><span>RIVAL: ${data.scores[rival]}</span>`;
    opponentArea.textContent = hand.phase === 'playing'
        ? (hand.turn === rival ? '▶ TURNO DEL RIVAL' : '▶ TURNO TUYO')
        : '';
    renderTable(hand, mySlot);
    renderHand(hand, mySlot);
    renderActions(data, hand, mySlot);
    renderMessage(data, hand, mySlot);
}
function renderTable(hand, slot) {
    const me = slotIndex(slot);
    const rival = rivalIndex(me);
    opponentHand.innerHTML = '';
    for (let i = 0; i < (hand.hands[rival]?.length ?? 0); i++) {
        opponentHand.appendChild(backEl());
    }
    renderPlayedRow(rivalPlayed, hand.playedCards[rival]);
    renderPlayedRow(myPlayed, hand.playedCards[me]);
}
function renderPlayedRow(container, cards) {
    container.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const slotEl = document.createElement('div');
        slotEl.className = 'played-slot';
        if (cards[i])
            slotEl.appendChild(cardEl(cards[i], { played: true }));
        container.appendChild(slotEl);
    }
}
function renderHand(hand, slot) {
    myHand.innerHTML = '';
    const me = slotIndex(slot);
    const cards = hand.hands[me];
    const canPlay = hand.phase === 'playing' && hand.turn === me && !hand.trucoPending && !hand.envidoPending;
    for (const id of cards) {
        const el = cardEl(id, { disabled: !canPlay });
        if (canPlay)
            el.addEventListener('click', () => playCard(id));
        myHand.appendChild(el);
    }
}
function renderActions(data, hand, slot) {
    actionsEl.innerHTML = '';
    if (data.status === 'finished') {
        const w = data.scores[0] >= 30 ? 0 : 1;
        setMsg(w === slot ? '¡GANASTE LA PARTIDA!' : 'PERDISTE LA PARTIDA.');
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.textContent = 'NUEVA PARTIDA';
        btn.addEventListener('click', () => writeRoom({ ...data, ...newGameState([0, 0]) }));
        actionsEl.appendChild(btn);
        return;
    }
    if (hand.phase === 'hand_end') {
        setMsg(hand.winner === slot ? `GANASTE LA MANO (+${hand.handPoints})` : `PERDISTE LA MANO (+${hand.handPoints})`);
        if (slot === 0) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-cyan';
            btn.textContent = 'SIGUIENTE MANO';
            btn.addEventListener('click', () => writeRoom(finishHand(data)));
            actionsEl.appendChild(btn);
        }
        return;
    }
    if (hand.envidoPending) {
        renderEnvidoActions(hand, slot);
        return;
    }
    if (hand.trucoPending) {
        renderTrucoActions(hand, slot);
        return;
    }
    if (canCallEnvido(hand)) {
        const pts = envidoPoints(allHandCards(hand, slotIndex(slot)));
        setMsg(`TU ENVIDO: ${pts} — PODÉS CANTAR ANTES DE JUGAR`);
        const btn = document.createElement('button');
        btn.className = 'btn btn-cyan';
        btn.textContent = 'ENVIDO';
        btn.addEventListener('click', callEnvido);
        actionsEl.appendChild(btn);
    }
    if (hand.phase === 'playing' && hand.turn === slot && hand.truco < 3) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-magenta';
        btn.textContent = hand.truco === 0 ? 'TRUCO' : hand.truco === 1 ? 'RETRUCO' : 'VALE 4';
        btn.addEventListener('click', callTruco);
        actionsEl.appendChild(btn);
    }
}
function renderEnvidoActions(hand, slot) {
    const level = hand.envidoPending;
    const label = ENVIDO_NAMES[level].toUpperCase();
    const pts = level === 'falta' ? faltaEnvidoPoints(roomState.scores) : ENVIDO_ACCEPT_PTS[level];
    const me = slotIndex(slot);
    if (hand.envidoWaitingOn === me) {
        setMsg(`${label} (${pts} PTS)! ¿QUERÉS?`);
        actionsEl.append(btn('QUIERO', 'btn btn-cyan', () => respondEnvido('accept')), btn('NO QUIERO', 'btn btn-danger', () => respondEnvido('decline')));
        if (level === 2)
            actionsEl.appendChild(btn('REAL ENVIDO', 'btn btn-magenta', () => respondEnvido('real')));
        if (level === 2 || level === 3)
            actionsEl.appendChild(btn('FALTA ENVIDO', 'btn btn-magenta', () => respondEnvido('falta')));
    }
    else {
        setMsg(`CANTASTE ${label}. ESPERANDO…`);
    }
}
function renderTrucoActions(hand, slot) {
    const level = TRUCO_NAMES[hand.trucoPending].toUpperCase();
    if (hand.trucoCaller !== slot) {
        setMsg(`${level}! ¿QUERÉS?`);
        actionsEl.append(btn('QUIERO', 'btn btn-cyan', () => respondTruco(true)), btn('NO QUIERO', 'btn btn-danger', () => respondTruco(false)));
    }
    else {
        setMsg(`CANTASTE ${level}. ESPERANDO…`);
    }
}
function btn(text, cls, fn) {
    const el = document.createElement('button');
    el.className = cls;
    el.textContent = text;
    el.addEventListener('click', fn);
    return el;
}
function renderMessage(data, hand, slot) {
    if (data.status === 'finished' || hand.phase === 'hand_end' || hand.trucoPending || hand.envidoPending)
        return;
    if (hand.phase !== 'playing')
        return;
    if (canCallEnvido(hand))
        return;
    setMsg(hand.turn === slot ? 'JUGÁ UNA CARTA' : 'ESPERANDO AL RIVAL…');
}
function cardEl(id, opts = {}) {
    const c = parseCard(id);
    const el = document.createElement('div');
    el.className = 'card' + (opts.played ? ' played' : '') + (opts.disabled ? ' disabled' : '');
    el.style.borderColor = c.color;
    el.innerHTML = `<span class="rank">${RANK_LABELS[c.rank]}</span><img class="suit" src="${c.img}" alt="${c.name}">`;
    return el;
}
function backEl() {
    const el = document.createElement('div');
    el.className = 'card back';
    el.innerHTML = '<img class="back-art" src="img/dorso.png" alt="Dorso">';
    return el;
}
function updateHand(mutator) {
    if (!roomState?.hand)
        return;
    const next = structuredClone(roomState);
    next.hand = normalizeHand(mutator(normalizeHand(roomState.hand)));
    writeRoom(next);
}
function updateEnvido(action) {
    if (!roomState?.hand)
        return;
    const next = structuredClone(roomState);
    const result = applyEnvidoResponse(roomState.hand, roomState.scores, resolveMySlot(), action);
    next.hand = result.hand;
    next.scores = result.scores;
    if (next.scores[0] >= 30 || next.scores[1] >= 30) {
        next.status = 'finished';
        next.hand = null;
    }
    writeRoom(next);
}
function playCard(cardId) {
    updateHand((hand) => applyPlay(hand, resolveMySlot(), cardId));
}
function callTruco() {
    const level = roomState?.hand?.truco === 0 ? 'TRUCO!' : roomState?.hand?.truco === 1 ? 'RETRUCO!' : 'VALE 4!';
    updateHand((hand) => applyTrucoCall(hand, resolveMySlot()));
    sendChatMessage(level);
}
function respondTruco(accept) {
    updateHand((hand) => applyTrucoResponse(hand, accept));
    sendChatMessage(accept ? 'QUIERO' : 'NO QUIERO');
}
function callEnvido() {
    updateHand((hand) => applyEnvidoCall(hand, resolveMySlot(), 2));
    sendChatMessage('ENVIDO!');
}
function respondEnvido(action) {
    updateEnvido(action);
    const msg = { accept: 'QUIERO', decline: 'NO QUIERO', real: 'REAL ENVIDO!', falta: 'FALTA ENVIDO!' }[action];
    sendChatMessage(msg);
}
async function copyBtn(btnEl, text) {
    await navigator.clipboard.writeText(text);
    const prev = btnEl.textContent;
    btnEl.textContent = 'COPIADO';
    setTimeout(() => { btnEl.textContent = prev; }, 1500);
}
async function startPartida() {
    const id = crypto.randomUUID().slice(0, 8);
    initP2P(id);
    sessionStorage.setItem(`truqui-role-${id}`, 'host');
    hero.classList.add('compact');
    const inviteUrl = await p2p.createInvite();
    history.replaceState(null, '', inviteUrl);
    roomState = initialRoomState();
    roomState.players[playerId] = { slot: 0, joinedAt: Date.now() };
    mySlot = 0;
    shareLink.value = inviteUrl;
    shareBox.hidden = false;
    answerBox.hidden = false;
    $('btn-start').hidden = true;
    setStatus('ESPERANDO RIVAL…');
}
async function joinFromInvite(offerPacked) {
    if (!roomId)
        return;
    initP2P(roomId);
    mySlot = 1;
    hero.classList.add('compact');
    shareBox.hidden = true;
    $('btn-start').hidden = true;
    try {
        const answerUrl = await p2p.joinInvite(offerPacked);
        responseLink.value = answerUrl;
        responseBox.hidden = false;
        setStatus('MANDALE EL LINK DE RESPUESTA AL HOST');
    }
    catch (err) {
        setStatus(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
}
async function restoreHostSession() {
    if (!roomId)
        return;
    initP2P(roomId);
    mySlot = 0;
    hero.classList.add('compact');
    $('btn-start').hidden = true;
    shareBox.hidden = false;
    answerBox.hidden = false;
    shareLink.value = location.href;
    setStatus('ESPERANDO RIVAL…');
}
async function hostAcceptAnswer(url) {
    if (!p2p)
        return;
    try {
        setStatus('CONECTANDO…');
        await p2p.acceptAnswerFromUrl(url.trim());
    }
    catch {
        setStatus('LINK DE RESPUESTA INVÁLIDO');
    }
}
$('btn-start').addEventListener('click', () => void startPartida());
$('btn-copy').addEventListener('click', () => void copyBtn($('btn-copy'), shareLink.value));
$('btn-copy-response').addEventListener('click', () => void copyBtn($('btn-copy-response'), responseLink.value));
$('btn-connect').addEventListener('click', () => void hostAcceptAnswer(answerLink.value));
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendChatMessage(chatInput.value);
    chatInput.value = '';
});
if (roomId && link.o && sessionStorage.getItem(`truqui-role-${roomId}`) === 'host') {
    void restoreHostSession();
}
else if (roomId && link.o) {
    void joinFromInvite(link.o);
}
else if (roomId && link.a) {
    initP2P(roomId);
    mySlot = 0;
    hero.classList.add('compact');
    $('btn-start').hidden = true;
    shareBox.hidden = true;
    answerBox.hidden = true;
    p2p.acceptAnswer(link.a)
        .then(() => setStatus('CONECTANDO…'))
        .catch(() => setStatus('ABRÍ EN LA PESTAÑA DONDE CREASTE LA PARTIDA'));
}
else if (roomId) {
    setStatus('LINK INCOMPLETO — PEDILE AL HOST EL LINK CON &o=');
    $('btn-start').hidden = true;
    hero.classList.add('compact');
}
//# sourceMappingURL=app.js.map