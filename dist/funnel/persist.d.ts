import * as funnelCrypto from './crypto.js';
import { type P2PConnection } from './ephemeral.js';
import type { CqObject, CqObjectDraft, P2PCallbacks, P2PRole, SessionMode } from './types.js';
export interface PersistSession {
    mode: SessionMode;
    room: string;
    key: string;
    identity: funnelCrypto.Identity;
    seq: number;
    role: P2PRole | null;
    p2p: P2PConnection | null;
    stopNostr: (() => void) | null;
    signaling: 'idle' | 'offered' | 'answered' | 'connected';
}
export interface PersistOptions {
    onObject: (obj: CqObject) => void;
    onStatus: (text: string) => void;
    onOpen?: () => void;
    p2p?: P2PCallbacks;
}
export declare function createPersistRoom(opts: PersistOptions): Promise<PersistSession>;
export declare function joinPersistRoom(room: string, key: string, opts: PersistOptions): Promise<PersistSession>;
export declare function joinUrl(session: PersistSession): string;
export declare function appendObject(session: PersistSession, draft: CqObjectDraft, opts: PersistOptions): Promise<CqObject>;
export declare function attachP2P(session: PersistSession, callbacks: P2PCallbacks): P2PConnection;
export declare function connectHybrid(session: PersistSession, opts: PersistOptions): Promise<P2PConnection>;
export declare function queryRoom(room: string): Promise<CqObject[]>;
export declare function listRooms(): Promise<string[]>;
