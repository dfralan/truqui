const SUITS = {
  e: { name: 'espada', symbol: '⚔', color: '#111' },
  b: { name: 'basto', symbol: '🍃', color: '#2ecc71' },
  o: { name: 'oro', symbol: '🪙', color: '#f1c40f' },
  c: { name: 'copa', symbol: '🏆', color: '#e74c3c' },
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

function trickWinner(p0Card, p1Card) {
  const p0 = cardPower(p0Card);
  const p1 = cardPower(p1Card);
  if (p0 > p1) return 0;
  if (p1 > p0) return 1;
  return null; // parda
}

function dealNewHand() {
  const deck = createDeck();
  return {
    hands: {
      0: [deck[0], deck[2], deck[4]],
      1: [deck[1], deck[3], deck[5]],
    },
    trick: 0,
    trickCards: { 0: null, 1: null },
    trickWinners: [],
    trickLeader: 0,
    turn: 0,
    truco: 0,
    trucoPending: null,
    trucoCaller: null,
    handPoints: TRUCO_POINTS[0],
    phase: 'playing',
    winner: null,
  };
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
  if (hand.phase !== 'playing') return hand;
  if (hand.turn !== player) return hand;
  if (!hand.hands[player].includes(cardId)) return hand;

  const next = structuredClone(hand);
  const leader = next.trickLeader;
  next.hands[player] = next.hands[player].filter(c => c !== cardId);
  next.trickCards[player] = cardId;

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
    next.turn = player === 0 ? 1 : 0;
  }

  return next;
}

function applyTrucoCall(hand, caller) {
  if (hand.phase !== 'playing' || hand.trucoPending) return hand;
  if (hand.truco >= 3) return hand;

  const next = structuredClone(hand);
  next.trucoPending = hand.truco + 1;
  next.trucoCaller = caller;
  return next;
}

function applyTrucoResponse(hand, responder, accept) {
  if (!hand.trucoPending) return hand;

  const next = structuredClone(hand);
  if (accept) {
    next.truco = hand.trucoPending;
    next.handPoints = TRUCO_POINTS[next.truco];
  } else {
    next.phase = 'hand_end';
    next.winner = hand.trucoCaller === 0 ? 0 : 1;
  }
  next.trucoPending = null;
  next.trucoCaller = null;
  return next;
}

function finishHand(state) {
  const next = structuredClone(state);
  const pts = next.hand.handPoints;
  if (next.hand.winner !== null) {
    next.scores[next.hand.winner] += pts;
  }
  if (next.scores[0] >= 30 || next.scores[1] >= 30) {
    next.status = 'finished';
    next.hand = null;
  } else {
    next.hand = dealNewHand();
  }
  next.updatedAt = Date.now();
  return next;
}

function cardLabel(id) {
  const c = parseCard(id);
  return `${RANK_LABELS[c.rank]} ${c.symbol}`;
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
