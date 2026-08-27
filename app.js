const playerId = localStorage.getItem('truqui-id') || crypto.randomUUID();
localStorage.setItem('truqui-id', playerId);

const params = new URLSearchParams(location.search);
const link = parseLink();
let roomId = link.r || params.get('r');
let mySlot = null;
let p2p = null;
let roomState = null;
let lastUpdatedAt = 0;

const $ = (id) => document.getElementById(id);
const lobby = $('lobby');
const game = $('game');
const statusEl = $('status');
const shareBox = $('share-box');
const shareLink = $('share-link');
const answerBox = $('answer-box');
const answerLink = $('answer-link');
const responseBox = $('response-box');
const responseLink = $('response-link');
const scoresEl = $('scores');
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
}

function initP2P(id) {
  roomId = id;
  p2p = createP2P(id, {
    onState: (data) => render(data),
    onStatus: setStatus,
    onOpen: onConnected,
  });
}

function onConnected() {
  responseBox.hidden = true;
  answerBox.hidden = true;

  if (p2p.role === 'host') {
    mySlot = 0;
    const room = roomState || initialRoomState();
    room.players[playerId] = { slot: 0, joinedAt: Date.now() };
    room.players['_guest'] = { slot: 1, joinedAt: Date.now() };
    writeRoom({ ...room, ...newGameState([0, 0]) });
  } else {
    mySlot = 1;
    setStatus('Conectado — arrancando…');
  }
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

  const inviteUrl = await p2p.createInvite();
  history.replaceState(null, '', inviteUrl);

  roomState = initialRoomState();
  roomState.players[playerId] = { slot: 0, joinedAt: Date.now() };
  mySlot = 0;

  shareLink.value = inviteUrl;
  shareBox.hidden = false;
  answerBox.hidden = false;
  $('btn-start').hidden = true;
  $('share-label').textContent = 'Compartí este link con tu rival:';
  setStatus('Esperando rival…');
}

async function joinFromInvite(offerPacked) {
  if (!offerPacked) return;
  initP2P(roomId);
  mySlot = 1;

  shareBox.hidden = true;
  $('btn-start').hidden = true;

  try {
    const answerUrl = await p2p.joinInvite(offerPacked);
    responseLink.value = answerUrl;
    responseBox.hidden = false;
    setStatus('Mandale el link de respuesta al host');
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`);
  }
}

async function restoreHostSession() {
  initP2P(roomId);
  mySlot = 0;
  $('btn-start').hidden = true;
  shareBox.hidden = false;
  answerBox.hidden = false;
  shareLink.value = location.href;
  setStatus('Esperando rival…');
}

async function hostAcceptAnswer(url) {
  if (!p2p) return;
  try {
    await p2p.acceptAnswerFromUrl(url.trim());
    setStatus('Rival conectado');
  } catch {
    setStatus('Link de respuesta inválido');
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
    /* guest slot */
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

  scoresEl.textContent = `Vos: ${data.scores[mySlot]} — Rival: ${data.scores[rivalSlot]}`;

  opponentArea.textContent = hand.phase === 'playing'
    ? (hand.turn === rivalSlot ? 'Turno del rival' : 'Turno tuyo')
    : '';

  renderTrick(hand, mySlot, rivalSlot);
  renderHand(hand, mySlot);
  renderActions(data, hand, mySlot, rivalSlot);
  renderMessage(data, hand, mySlot, rivalSlot);
}

function renderTrick(hand, mySlot, rivalSlot) {
  trickArea.innerHTML = '';
  const mine = hand.trickCards[mySlot];
  const theirs = hand.trickCards[rivalSlot];
  if (theirs) trickArea.appendChild(cardEl(theirs, { played: true }));
  else trickArea.appendChild(backEl());
  if (mine) trickArea.appendChild(cardEl(mine, { played: true }));
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
    setMsg(w === mySlot ? '¡Ganaste la partida!' : 'Perdiste la partida.');
    const btn = document.createElement('button');
    btn.textContent = 'Nueva partida';
    btn.addEventListener('click', () => writeRoom({ ...data, ...newGameState([0, 0]) }));
    actionsEl.appendChild(btn);
    return;
  }

  if (hand.phase === 'hand_end') {
    const iWon = hand.winner === mySlot;
    setMsg(iWon ? `Ganaste la mano (+${hand.handPoints})` : `Perdiste la mano (+${hand.handPoints})`);
    if (mySlot === 0) {
      const btn = document.createElement('button');
      btn.textContent = 'Siguiente mano';
      btn.addEventListener('click', () => writeRoom(finishHand(data)));
      actionsEl.appendChild(btn);
    }
    return;
  }

  if (hand.trucoPending) {
    const caller = hand.trucoCaller;
    const level = TRUCO_NAMES[hand.trucoPending];
    if (caller !== mySlot) {
      setMsg(`${level}! ¿Querés?`);
      const yes = document.createElement('button');
      yes.textContent = 'Quiero';
      yes.addEventListener('click', () => respondTruco(true));
      const no = document.createElement('button');
      no.textContent = 'No quiero';
      no.className = 'danger';
      no.addEventListener('click', () => respondTruco(false));
      actionsEl.append(yes, no);
    } else {
      setMsg(`Cantaste ${level}. Esperando respuesta…`);
    }
    return;
  }

  if (hand.phase === 'playing' && hand.turn === mySlot && hand.truco < 3) {
    const btn = document.createElement('button');
    btn.className = 'secondary';
    btn.textContent = hand.truco === 0 ? 'Truco' : hand.truco === 1 ? 'Retruco' : 'Vale 4';
    btn.addEventListener('click', callTruco);
    actionsEl.appendChild(btn);
  }
}

function renderMessage(data, hand, mySlot, rivalSlot) {
  if (data.status === 'finished' || hand.phase === 'hand_end' || hand.trucoPending) return;
  if (hand.phase !== 'playing') return;
  setMsg(hand.turn === mySlot ? 'Jugá una carta' : 'Esperando al rival…');
}

function cardEl(id, opts = {}) {
  const c = parseCard(id);
  const el = document.createElement('div');
  el.className = 'card' + (opts.played ? ' played' : '') + (opts.disabled ? ' disabled' : '');
  el.innerHTML = `<span>${RANK_LABELS[c.rank]}</span><span class="suit">${c.symbol}</span>`;
  el.style.color = c.color;
  return el;
}

function backEl() {
  const el = document.createElement('div');
  el.className = 'card back';
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
  updateHand((hand) => applyTrucoCall(hand, mySlot));
}

function respondTruco(accept) {
  updateHand((hand) => applyTrucoResponse(hand, mySlot, accept));
}

async function copyBtn(btn, text) {
  await navigator.clipboard.writeText(text);
  const prev = btn.textContent;
  btn.textContent = 'Copiado';
  setTimeout(() => { btn.textContent = prev; }, 1500);
}

$('btn-start').addEventListener('click', startPartida);
$('btn-copy').addEventListener('click', () => copyBtn($('btn-copy'), shareLink.value));
$('btn-copy-response').addEventListener('click', () => copyBtn($('btn-copy-response'), responseLink.value));
$('btn-connect').addEventListener('click', () => hostAcceptAnswer(answerLink.value));

if (roomId && link.o && sessionStorage.getItem(`truqui-role-${roomId}`) === 'host') {
  restoreHostSession();
} else if (roomId && link.o) {
  joinFromInvite(link.o);
} else if (roomId && link.a) {
  initP2P(roomId);
  mySlot = 0;
  $('btn-start').hidden = true;
  shareBox.hidden = true;
  answerBox.hidden = true;
  p2p.acceptAnswer(link.a)
    .then(() => setStatus('Rival conectado'))
    .catch(() => setStatus('Abrí esto en la misma pestaña donde creaste la partida'));
} else if (roomId) {
  setStatus('Link incompleto — copiá el link completo del host (con &o=…)');
  $('btn-start').hidden = true;
}
