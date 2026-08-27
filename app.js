const gun = Gun({ peers: [`${location.origin}/gun`], localStorage: true });
const playerId = localStorage.getItem('truqui-id') || crypto.randomUUID();
localStorage.setItem('truqui-id', playerId);

const params = new URLSearchParams(location.search);
let roomId = params.get('r');
let mySlot = null;
let roomRef = null;
let lastUpdatedAt = 0;
let joinTimer = null;
let pollTimer = null;

const $ = (id) => document.getElementById(id);
const lobby = $('lobby');
const game = $('game');
const statusEl = $('status');
const shareBox = $('share-box');
const shareLink = $('share-link');
const scoresEl = $('scores');
const opponentArea = $('opponent-area');
const trickArea = $('trick-area');
const myHand = $('my-hand');
const actionsEl = $('actions');
const msgEl = $('msg');

function roomUrl(id) {
  const u = new URL(location.href);
  u.searchParams.set('r', id);
  return u.toString();
}

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

function connectRoom(id) {
  roomId = id;
  roomRef = gun.get('truqui-v2').get(id);
  roomRef.get('state').on((raw) => {
    if (!raw || typeof raw !== 'string') return;
    try {
      render(JSON.parse(raw));
    } catch {
      /* ignore corrupt state */
    }
  });
  startPolling();
}

function apiUrl() {
  return `/api/room/${roomId}`;
}

async function fetchRoom() {
  const res = await fetch(apiUrl(), { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  return data && data.players ? data : null;
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const room = await fetchRoom();
    if (room) render(room);
  }, 400);
}

async function readRoom(cb) {
  cb(await fetchRoom());
}

async function writeRoom(data) {
  data.updatedAt = Date.now();
  const body = JSON.stringify(data);
  roomRef.get('state').put(body);
  await fetch(apiUrl(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

function joinRoom() {
  clearTimeout(joinTimer);

  readRoom((room) => {
    if (!room?.players || Object.keys(room.players).length === 0) {
      setStatus('Conectando…');
      joinTimer = setTimeout(joinRoom, 400);
      return;
    }

    const players = { ...room.players };

    if (players[playerId]) {
      mySlot = players[playerId].slot;
      return;
    }

    const taken = Object.values(players).map((p) => p.slot);
    if (taken.length >= 2) {
      setStatus('Partida llena');
      return;
    }

    mySlot = taken.includes(0) ? 1 : 0;
    players[playerId] = { slot: mySlot, joinedAt: Date.now() };
    writeRoom({ ...room, players });
  });
}

function maybeStartGame(data) {
  if (data.status !== 'waiting') return;
  if (Object.keys(data.players).length < 2) return;
  if (mySlot !== 0) return;

  readRoom((room) => {
    if (room?.status !== 'waiting') return;
    if (Object.keys(room.players).length < 2) return;
    writeRoom({ ...room, ...newGameState([0, 0]) });
  });
}

function startPartida() {
  const id = crypto.randomUUID().slice(0, 8);
  history.replaceState(null, '', roomUrl(id));
  connectRoom(id);

  const room = initialRoomState();
  room.players[playerId] = { slot: 0, joinedAt: Date.now() };
  mySlot = 0;
  writeRoom(room);

  shareLink.value = roomUrl(id);
  shareBox.hidden = false;
  $('btn-start').hidden = true;
  setStatus('Esperando rival…');
}

function render(data) {
  if (!data || !data.players) return;
  if (data.updatedAt && data.updatedAt <= lastUpdatedAt) return;
  lastUpdatedAt = data.updatedAt || 0;

  if (!data.players[playerId]) {
    joinRoom();
    return;
  }

  mySlot = data.players[playerId].slot;
  maybeStartGame(data);
  const playerCount = Object.keys(data.players).length;
  const rivalSlot = mySlot === 0 ? 1 : 0;

  if (data.status === 'waiting') {
    showLobby();
    shareBox.hidden = playerCount < 1;
    if (mySlot === 0) shareLink.value = roomUrl(roomId);
    setStatus(playerCount < 2 ? 'Esperando rival…' : 'Arrancando…');
    return;
  }

  showGame();
  const hand = data.hand;
  if (!hand) return;

  const myScore = data.scores[mySlot];
  const rivalScore = data.scores[rivalSlot];
  scoresEl.textContent = `Vos: ${myScore} — Rival: ${rivalScore}`;

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
    if (canPlay) {
      el.addEventListener('click', () => playCard(id));
    }
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
    btn.addEventListener('click', () => {
      readRoom((room) => writeRoom({ ...room, ...newGameState([0, 0]) }));
    });
    actionsEl.appendChild(btn);
    return;
  }

  if (hand.phase === 'hand_end') {
    const iWon = hand.winner === mySlot;
    setMsg(iWon ? `Ganaste la mano (+${hand.handPoints})` : `Perdiste la mano (+${hand.handPoints})`);
    if (mySlot === 0) {
      const btn = document.createElement('button');
      btn.textContent = 'Siguiente mano';
      btn.addEventListener('click', () => {
        readRoom((room) => writeRoom(finishHand(room)));
      });
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

  if (hand.turn === mySlot) setMsg('Jugá una carta');
  else setMsg('Esperando al rival…');
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
  readRoom((room) => {
    if (!room?.hand) return;
    const next = structuredClone(room);
    next.hand = mutator(room.hand);
    writeRoom(next);
  });
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

$('btn-start').addEventListener('click', startPartida);

$('btn-copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(shareLink.value);
  $('btn-copy').textContent = 'Copiado';
  setTimeout(() => { $('btn-copy').textContent = 'Copiar'; }, 1500);
});

if (roomId) {
  connectRoom(roomId);
  joinRoom();
  shareBox.hidden = false;
  shareLink.value = roomUrl(roomId);
  setStatus('Uniéndote a la partida…');
  $('btn-start').hidden = true;
}
