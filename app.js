const playerId = localStorage.getItem('truqui-id') || crypto.randomUUID();
localStorage.setItem('truqui-id', playerId);

const params = new URLSearchParams(location.search);
const link = parseLink();
let roomId = link.r || params.get('r');
let mySlot = null;
let p2p = null;
let roomState = null;
let lastUpdatedAt = 0;
let gameStarted = false;

const $ = (id) => document.getElementById(id);
const layout = $('layout');
const hero = $('hero');
const lobby = $('lobby');
const game = $('game');
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
const opponentHand = $('opponent-hand');
const opponentArea = $('opponent-area');
const trickArea = $('trick-area');
const myHand = $('my-hand');
const actionsEl = $('actions');
const msgEl = $('msg');

function setStatus(text) {
  statusEl.textContent = text;
}

function setMsg(text) {
  msgEl.textContent = text || '';
}

function showLobby() {
  lobby.hidden = false;
  game.hidden = true;
}

function showGame() {
  lobby.hidden = true;
  game.hidden = false;
  hero.classList.add('compact');
}

function showChat() {
  if (layout.classList.contains('with-chat')) return;
  layout.classList.add('with-chat');
  chatInput.disabled = false;
  chatSend.disabled = false;
}

function onP2POpen() {
  showChat();
  appendChat({ text: '— CONECTADO P2P —', system: true });
  onGameReady();
  if (p2p.role === 'guest') {
    p2p.requestSync();
    setTimeout(() => p2p.requestSync(), 500);
    setTimeout(() => p2p.requestSync(), 1500);
  }
}

function onSyncRequest() {
  if (p2p?.role === 'host' && roomState?.status === 'playing') {
    p2p.sendState(roomState);
  }
}

function onGameReady() {
  if (gameStarted) return;
  gameStarted = true;
  responseBox.hidden = true;
  answerBox.hidden = true;

  if (p2p.role === 'host') {
    mySlot = 0;
    const room = roomState || initialRoomState();
    room.players[playerId] = { slot: 0, joinedAt: Date.now() };
    room.players['_guest'] = { slot: 1, joinedAt: Date.now() };
    writeRoom({ ...room, ...newGameState([0, 0]) });
    setTimeout(() => p2p?.sendState(roomState), 300);
    setTimeout(() => p2p?.sendState(roomState), 1000);
  } else {
    mySlot = 1;
    setStatus('CONECTADO — ARRANCANDO…');
  }
}

function appendChat({ text, from, ts, system }) {
  const el = document.createElement('div');
  el.className = 'chat-msg' + (system ? ' system' : from === mySlot ? ' mine' : '');
  if (system) {
    el.textContent = text;
  } else {
    const who = from === mySlot ? 'VOS' : 'RIVAL';
    el.innerHTML = `<span class="who">${who}</span>${escapeHtml(text)}`;
  }
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sendChatMessage(text) {
  const t = text.trim();
  if (!t || !p2p?.isOpen()) return;
  p2p.sendChat(t, mySlot);
  appendChat({ text: t, from: mySlot, ts: Date.now() });
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

function readRoom(cb) {
  cb(roomState);
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
  if (!offerPacked) return;
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
  } catch (err) {
    console.error(err);
    setStatus(`ERROR: ${err.message}`);
  }
}

async function restoreHostSession() {
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
  if (!p2p) return;
  try {
    setStatus('CONECTANDO…');
    await p2p.acceptAnswerFromUrl(url.trim());
  } catch {
    setStatus('LINK DE RESPUESTA INVÁLIDO');
  }
}

function render(data) {
  if (!data?.players) return;
  if (data.updatedAt && data.updatedAt <= lastUpdatedAt) return;
  lastUpdatedAt = data.updatedAt || 0;
  roomState = data;

  if (!data.players[playerId] && !data.players['_guest']) return;

  if (data.players[playerId]) {
    mySlot = data.players[playerId].slot;
  } else if (data.players['_guest'] && mySlot === 1) {
    /* guest */
  } else {
    return;
  }

  const rivalSlot = mySlot === 0 ? 1 : 0;

  if (data.status === 'waiting') {
    showLobby();
    return;
  }

  showGame();
  const hand = data.hand;
  if (!hand) return;

  scoresEl.innerHTML = `<span>VOS: ${data.scores[mySlot]}</span><span>RIVAL: ${data.scores[rivalSlot]}</span>`;

  opponentArea.textContent = hand.phase === 'playing'
    ? (hand.turn === rivalSlot ? '▶ TURNO DEL RIVAL' : '▶ TURNO TUYO')
    : '';

  renderOpponentHand(hand, rivalSlot);
  renderTrick(hand, mySlot, rivalSlot);
  renderHand(hand, mySlot);
  renderActions(data, hand, mySlot, rivalSlot);
  renderMessage(data, hand, mySlot, rivalSlot);
}

function renderOpponentHand(hand, rivalSlot) {
  opponentHand.innerHTML = '';
  const count = (hand.hands[rivalSlot] || []).length;
  for (let i = 0; i < count; i++) {
    opponentHand.appendChild(backEl());
  }
}

function renderTrick(hand, mySlot, rivalSlot) {
  trickArea.innerHTML = '';
  const mine = hand.trickCards[mySlot];
  const theirs = hand.trickCards[rivalSlot];

  const leftSlot = document.createElement('div');
  leftSlot.className = 'card-slot';
  leftSlot.appendChild(theirs ? cardEl(theirs, { played: true }) : emptySlotEl());

  const rightSlot = document.createElement('div');
  rightSlot.className = 'card-slot';
  rightSlot.appendChild(mine ? cardEl(mine, { played: true }) : emptySlotEl());

  trickArea.append(leftSlot, rightSlot);
}

function emptySlotEl() {
  const el = document.createElement('div');
  el.className = 'card empty-slot';
  return el;
}

function renderHand(hand, mySlot) {
  myHand.innerHTML = '';
  const cards = hand.hands[mySlot] || [];
  const canPlay = hand.phase === 'playing' && hand.turn === mySlot && !hand.trucoPending;

  for (const id of cards) {
    const el = cardEl(id, { disabled: !canPlay });
    if (canPlay) el.addEventListener('click', () => playCard(id));
    myHand.appendChild(el);
  }
}

function renderActions(data, hand, mySlot, rivalSlot) {
  actionsEl.innerHTML = '';

  if (data.status === 'finished') {
    const w = data.scores[0] >= 30 ? 0 : 1;
    setMsg(w === mySlot ? '¡GANASTE LA PARTIDA!' : 'PERDISTE LA PARTIDA.');
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'NUEVA PARTIDA';
    btn.addEventListener('click', () => writeRoom({ ...data, ...newGameState([0, 0]) }));
    actionsEl.appendChild(btn);
    return;
  }

  if (hand.phase === 'hand_end') {
    const iWon = hand.winner === mySlot;
    setMsg(iWon ? `GANASTE LA MANO (+${hand.handPoints})` : `PERDISTE LA MANO (+${hand.handPoints})`);
    if (mySlot === 0) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-cyan';
      btn.textContent = 'SIGUIENTE MANO';
      btn.addEventListener('click', () => writeRoom(finishHand(data)));
      actionsEl.appendChild(btn);
    }
    return;
  }

  if (hand.trucoPending) {
    const caller = hand.trucoCaller;
    const level = TRUCO_NAMES[hand.trucoPending].toUpperCase();
    if (caller !== mySlot) {
      setMsg(`${level}! ¿QUERÉS?`);
      const yes = document.createElement('button');
      yes.className = 'btn btn-cyan';
      yes.textContent = 'QUIERO';
      yes.addEventListener('click', () => respondTruco(true));
      const no = document.createElement('button');
      no.className = 'btn btn-danger';
      no.textContent = 'NO QUIERO';
      no.addEventListener('click', () => respondTruco(false));
      actionsEl.append(yes, no);
    } else {
      setMsg(`CANTASTE ${level}. ESPERANDO…`);
    }
    return;
  }

  if (hand.phase === 'playing' && hand.turn === mySlot && hand.truco < 3) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-magenta';
    btn.textContent = hand.truco === 0 ? 'TRUCO' : hand.truco === 1 ? 'RETRUCO' : 'VALE 4';
    btn.addEventListener('click', callTruco);
    actionsEl.appendChild(btn);
  }
}

function renderMessage(data, hand, mySlot, rivalSlot) {
  if (data.status === 'finished' || hand.phase === 'hand_end' || hand.trucoPending) return;
  if (hand.phase !== 'playing') return;
  setMsg(hand.turn === mySlot ? 'JUGÁ UNA CARTA' : 'ESPERANDO AL RIVAL…');
}

function cardEl(id, opts = {}) {
  const c = parseCard(id);
  const el = document.createElement('div');
  el.className = 'card' + (opts.played ? ' played' : '') + (opts.disabled ? ' disabled' : '');
  el.innerHTML = `<span>${RANK_LABELS[c.rank]}</span><span class="suit">${c.symbol}</span>`;
  el.style.color = c.color;
  if (!opts.played) {
    el.style.borderColor = c.color === '#111' ? '#333' : c.color;
  }
  return el;
}

function backEl() {
  const el = document.createElement('div');
  el.className = 'card back';
  el.textContent = '?';
  return el;
}

function updateHand(mutator) {
  if (!roomState?.hand) return;
  const next = structuredClone(roomState);
  next.hand = mutator(roomState.hand);
  writeRoom(next);
}

function playCard(cardId) {
  updateHand((hand) => applyPlay(hand, mySlot, cardId));
}

function callTruco() {
  const level = roomState?.hand?.truco === 0 ? 'TRUCO!' : roomState?.hand?.truco === 1 ? 'RETRUCO!' : 'VALE 4!';
  updateHand((hand) => applyTrucoCall(hand, mySlot));
  sendChatMessage(level);
}

function respondTruco(accept) {
  updateHand((hand) => applyTrucoResponse(hand, mySlot, accept));
  sendChatMessage(accept ? 'QUIERO' : 'NO QUIERO');
}

async function copyBtn(btn, text) {
  await navigator.clipboard.writeText(text);
  const prev = btn.textContent;
  btn.textContent = 'COPIADO';
  setTimeout(() => { btn.textContent = prev; }, 1500);
}

$('btn-start').addEventListener('click', startPartida);
$('btn-copy').addEventListener('click', () => copyBtn($('btn-copy'), shareLink.value));
$('btn-copy-response').addEventListener('click', () => copyBtn($('btn-copy-response'), responseLink.value));
$('btn-connect').addEventListener('click', () => hostAcceptAnswer(answerLink.value));

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendChatMessage(chatInput.value);
  chatInput.value = '';
});

if (roomId && link.o && sessionStorage.getItem(`truqui-role-${roomId}`) === 'host') {
  restoreHostSession();
} else if (roomId && link.o) {
  joinFromInvite(link.o);
} else if (roomId && link.a) {
  initP2P(roomId);
  mySlot = 0;
  hero.classList.add('compact');
  $('btn-start').hidden = true;
  shareBox.hidden = true;
  answerBox.hidden = true;
  p2p.acceptAnswer(link.a)
    .then(() => setStatus('CONECTANDO…'))
    .catch(() => setStatus('ABRÍ EN LA PESTAÑA DONDE CREASTE LA PARTIDA'));
} else if (roomId) {
  setStatus('LINK INCOMPLETO — PEDILE AL HOST EL LINK CON &o=');
  $('btn-start').hidden = true;
  hero.classList.add('compact');
}
