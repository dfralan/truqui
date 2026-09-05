import type { CqObject, CqPersistEnvelope, P2PCallbacks, ParsedLink, P2PRole } from './types.js';
export declare function parseLink(): ParsedLink;
export interface P2PConnection {
    createOffer: () => Promise<string>;
    createAnswer: (offerPacked: string) => Promise<string>;
    createInvite: () => Promise<string>;
    joinInvite: (offerPacked: string) => Promise<string>;
    acceptAnswer: (answerPacked: string | RTCSessionDescriptionInit) => Promise<void>;
    acceptAnswerFromUrl: (url: string) => Promise<void>;
    sendState: (data: unknown) => void;
    sendChat: (text: string, from: 0 | 1) => void;
    sendCq: (object: CqObject) => void;
    requestSync: () => void;
    requestCqSync: (since: string | null) => void;
    isOpen: () => boolean;
    close: () => void;
    readonly role: P2PRole | null;
}
export declare function createP2P(roomId: string, callbacks: P2PCallbacks): P2PConnection;
export type { CqPersistEnvelope };
