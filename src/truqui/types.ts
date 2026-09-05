export type PlayerSlot = 0 | 1;

export type CardId = string;

export type EnvidoLevel = 2 | 3 | 'falta';

export type EnvidoAction = 'accept' | 'decline' | 'real' | 'falta';

export interface HandState {
  hands: Record<PlayerSlot, CardId[]>;
  trick: number;
  trickCards: Record<PlayerSlot, CardId | null>;
  playedCards: Record<PlayerSlot, CardId[]>;
  trickWinners: (PlayerSlot | null)[];
  mano: PlayerSlot;
  trickLeader: PlayerSlot;
  turn: PlayerSlot;
  truco: number;
  trucoPending: number | null;
  trucoCaller: PlayerSlot | null;
  envidoResolved: boolean;
  envidoPending: EnvidoLevel | null;
  envidoWaitingOn: PlayerSlot | null;
  envidoSinger: PlayerSlot | null;
  handPoints: number;
  phase: 'playing' | 'hand_end';
  winner: PlayerSlot | null;
}

export interface RoomState {
  status: 'waiting' | 'playing' | 'finished';
  players: Record<string, { slot: PlayerSlot; joinedAt: number }>;
  scores: [number, number];
  hand: HandState | null;
  updatedAt: number;
}

export interface ParsedCard {
  id: CardId;
  rank: number;
  suit: string;
  name: string;
  img: string;
  color: string;
}
