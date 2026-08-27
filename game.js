const SUITS = {
  e: { name: 'espada', img: 'img/palos/espada.png', color: '#0ff' },
  b: { name: 'basto', img: 'img/palos/basto.png', color: '#2ecc71' },
  o: { name: 'oro', img: 'img/palos/oro.png', color: '#f1c40f' },
  c: { name: 'copa', img: 'img/palos/copa.png', color: '#e74c3c' },
};

const RANK_LABELS = {
  1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  10: '10', 11: '11', 12: '12',
};

// Fuerza para el truco (mayor = más fuerte)
const TRUCO_POWER = {
  '1-e': 14, '1-b': 13, '7-e': 12, '7-o': 11,
  '3-e': 10, '3-b': 10, '3-o': 10, '3-c': 10,
  '2-e': 9, '2-b': 9, '2-o': 9, '2-c': 9,
  '1-o': 8, '1-c': 8,
  '12-e': 7, '12-b': 7, '12-o': 7, '12-c': 7,
  '11-e': 6, '11-b': 6, '11-o': 6, '11-c': 6,
  '10-e': 5, '10-b': 5, '10-o': 5, '10-c': 5,
  '7-b': 4, '7-c': 4,
  '6-e': 3, '6-b': 3, '6-o': 3, '6-c': 3,
  '5-e': 2, '5-b': 2, '5-o': 2, '5-c': 2,
  '4-e': 1, '4-b': 1, '4-o': 1, '4-c': 1,
};

const TRUCO_POINTS = [1, 2, 3, 4];
const TRUCO_NAMES = ['', 'Truco', 'Retruco', 'Vale 4'];

const ENVIDO_NAMES = { 2: 'Envido', 3: 'Real Envido', falta: 'Falta Envido' };
const ENVIDO_ACCEPT_PTS = { 2: 2, 3: 3 };
const ENVIDO_DECLINE_PTS = { 2: 1, 3: 2, falta: 1 };

function createDeck() {
  const deck = [];
  for (const suit of Object.keys(SUITS)) {
    for (const rank of [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]) {
      deck.push(`${rank}-${suit}`);
    }
  }
  return shuffle(deck);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function parseCard(id) {
  const [rank, suit] = id.split('-');
  return { id, rank: Number(rank), suit, ...SUITS[suit] };
}

function cardPower(id) {
  return TRUCO_POWER[id] || 0;
}

function envidoCardValue(rank) {
  if (rank === 10 || rank === 11 || rank === 12) return 0;
  if (rank === 1) return 1;
  return rank;
}

function envidoPoints(cards) {
  if (!cards?.length) return 0;
  let best = 0;
  for (const id of cards) {
    best = Math.max(best, envidoCardValue(parseCard(id).rank));
  }
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = parseCard(cards[i]);
      const b = parseCard(cards[j]);
      if (a.suit === b.suit) {
        best = Math.max(best, envidoCardValue(a.rank) + envidoCardValue(b.rank));
      }
    }
  }
  return best;
}

function allHandCards(hand, player) {
  const p = slotIndex(player);
  return [...(hand.hands[p] || []), ...(hand.playedCards[p] || [])];
}

function faltaEnvidoPoints(scores) {
  return 30 - Math.max(scores[0], scores[1]);
}

function envidoWinner(hand) {
  const p0 = envidoPoints(allHandCards(hand, 0));
  const p1 = envidoPoints(allHandCards(hand, 1));
  if (p0 > p1) return 0;
  if (p1 > p0) return 1;
  return slotIndex(hand.mano);
}

function canCallEnvido(hand) {
  const h = normalizeHand(hand);
  if (h.phase !== 'playing' || h.envidoResolved || h.envidoPending || h.trucoPending) return false;
  if (h.trick > 0) return false;
  return h.playedCards[0].length === 0 && h.playedCards[1].length === 0;
}

function trickWinner(p0Card, p1Card) {
  const p0 = cardPower(p0Card);
  const p1 = cardPower(p1Card);
  if (p0 > p1) return 0;
  if (p1 > p0) return 1;
  return null; // parda
}

function slotIndex(n) {
  return Number(n) === 0 ? 0 : 1;
}

function rivalIndex(n) {
  return slotIndex(n) === 0 ? 1 : 0;
}

function normalizeHand(hand) {
  if (!hand) return hand;
  const h = structuredClone(hand);
  h.hands = {
    0: [...(h.hands?.[0] ?? h.hands?.['0'] ?? [])],
    1: [...(h.hands?.[1] ?? h.hands?.['1'] ?? [])],
  };
  h.trickCards = {
    0: h.trickCards?.[0] ?? h.trickCards?.['0'] ?? null,
    1: h.trickCards?.[1] ?? h.trickCards?.['1'] ?? null,
  };
  h.playedCards = {
    0: [...(h.playedCards?.[0] ?? h.playedCards?.['0'] ?? [])],
    1: [...(h.playedCards?.[1] ?? h.playedCards?.['1'] ?? [])],
  };
  h.turn = slotIndex(h.turn);
  h.trickLeader = slotIndex(h.trickLeader);
  h.mano = slotIndex(h.mano ?? h.trickLeader ?? 0);
  if (h.trucoCaller != null) h.trucoCaller = slotIndex(h.trucoCaller);
  if (h.envidoWaitingOn != null) h.envidoWaitingOn = slotIndex(h.envidoWaitingOn);
  if (h.envidoSinger != null) h.envidoSinger = slotIndex(h.envidoSinger);
  h.envidoResolved = !!h.envidoResolved;
  return h;
}

function dealNewHand(previousMano = null) {
  const mano = previousMano == null ? 0 : rivalIndex(previousMano);
  const deck = createDeck();
  return normalizeHand({
    hands: {
      0: [deck[0], deck[2], deck[4]],
      1: [deck[1], deck[3], deck[5]],
    },
    trick: 0,
    trickCards: { 0: null, 1: null },
    playedCards: { 0: [], 1: [] },
    trickWinners: [],
    mano,
    trickLeader: mano,
    turn: mano,
    truco: 0,
    trucoPending: null,
    trucoCaller: null,
    envidoResolved: false,
    envidoPending: null,
    envidoWaitingOn: null,
    envidoSinger: null,
    handPoints: TRUCO_POINTS[0],
    phase: 'playing',
    winner: null,
  });
}

function initialRoomState() {
  return {
    status: 'waiting',
    players: {},
    scores: [0, 0],
    hand: null,
    updatedAt: Date.now(),
  };
}

function newGameState(existingScores) {
  return {
    status: 'playing',
    scores: existingScores || [0, 0],
    hand: dealNewHand(),
    updatedAt: Date.now(),
  };
}

function applyPlay(hand, player, cardId) {
  const h = normalizeHand(hand);
  const p = slotIndex(player);
  if (h.phase !== 'playing') return h;
  if (h.envidoPending) return h;
  if (h.turn !== p) return h;
  if (!h.hands[p].includes(cardId)) return h;

  const next = structuredClone(h);
  const leader = next.trickLeader;
  next.hands[p] = next.hands[p].filter(c => c !== cardId);
  next.trickCards[p] = cardId;
  next.playedCards[p] = [...next.playedCards[p], cardId];

  const p0 = next.trickCards[0];
  const p1 = next.trickCards[1];

  if (p0 && p1) {
    const w = trickWinner(p0, p1);
    next.trickWinners.push(w);
    next.trick++;
    next.trickCards = { 0: null, 1: null };
    next.trickLeader = w ?? leader;

    if (next.trick >= 3) {
      next.phase = 'hand_end';
      next.winner = handWinner(next.trickWinners);
    } else {
      next.turn = w ?? leader;
    }
  } else {
    next.turn = rivalIndex(p);
  }

  return normalizeHand(next);
}

function applyTrucoCall(hand, caller) {
  const h = normalizeHand(hand);
  const c = slotIndex(caller);
  if (h.phase !== 'playing' || h.trucoPending || h.envidoPending) return h;
  if (h.truco >= 3) return h;

  const next = structuredClone(h);
  next.trucoPending = h.truco + 1;
  next.trucoCaller = c;
  return next;
}

function applyTrucoResponse(hand, responder, accept) {
  const h = normalizeHand(hand);
  if (!h.trucoPending) return h;

  const next = structuredClone(h);
  if (accept) {
    next.truco = h.trucoPending;
    next.handPoints = TRUCO_POINTS[next.truco];
  } else {
    next.phase = 'hand_end';
    next.winner = slotIndex(h.trucoCaller) === 0 ? 0 : 1;
  }
  next.trucoPending = null;
  next.trucoCaller = null;
  return next;
}

function applyEnvidoCall(hand, caller, level = 2) {
  const h = normalizeHand(hand);
  const c = slotIndex(caller);
  if (!canCallEnvido(h)) return h;

  const next = structuredClone(h);
  next.envidoPending = level;
  next.envidoSinger = c;
  next.envidoWaitingOn = rivalIndex(c);
  return normalizeHand(next);
}

function applyEnvidoResponse(hand, scores, responder, action) {
  const h = normalizeHand(hand);
  const r = slotIndex(responder);
  if (!h.envidoPending || h.envidoWaitingOn !== r) {
    return { hand: h, scores: [...scores] };
  }

  const next = structuredClone(h);
  const level = h.envidoPending;
  const singer = h.envidoSinger;
  const newScores = [...scores];

  if (action === 'decline') {
    newScores[singer] += ENVIDO_DECLINE_PTS[level];
    next.envidoPending = null;
    next.envidoWaitingOn = null;
    next.envidoSinger = null;
    next.envidoResolved = true;
  } else if (action === 'accept') {
    const pts = level === 'falta' ? faltaEnvidoPoints(scores) : ENVIDO_ACCEPT_PTS[level];
    const winner = envidoWinner(h);
    newScores[winner] += pts;
    next.envidoPending = null;
    next.envidoWaitingOn = null;
    next.envidoSinger = null;
    next.envidoResolved = true;
  } else if (action === 'real' && level === 2) {
    next.envidoPending = 3;
    next.envidoSinger = r;
    next.envidoWaitingOn = rivalIndex(r);
  } else if (action === 'falta' && (level === 2 || level === 3)) {
    next.envidoPending = 'falta';
    next.envidoSinger = r;
    next.envidoWaitingOn = rivalIndex(r);
  }

  return { hand: normalizeHand(next), scores: newScores };
}

function finishHand(state) {
  const next = structuredClone(state);
  const pts = next.hand.handPoints;
  if (next.hand.winner !== null) {
    next.scores[next.hand.winner] += pts;
  }
  const mano = next.hand.mano;
  if (next.scores[0] >= 30 || next.scores[1] >= 30) {
    next.status = 'finished';
    next.hand = null;
  } else {
    next.hand = dealNewHand(mano);
  }
  next.updatedAt = Date.now();
  return next;
}

function cardLabel(id) {
  const c = parseCard(id);
  return `${RANK_LABELS[c.rank]} ${c.name}`;
}

function handWinner(trickWinners) {
  const w0 = trickWinners.filter(x => x === 0).length;
  const w1 = trickWinners.filter(x => x === 1).length;
  if (w0 > w1) return 0;
  if (w1 > w0) return 1;
  for (let i = trickWinners.length - 1; i >= 0; i--) {
    if (trickWinners[i] !== null) return trickWinners[i];
  }
  return 0;
}

function opponentName(players, me) {
  const other = Object.entries(players).find(([id]) => id !== me);
  return other ? (other[1].name || 'Rival') : 'Rival';
}
