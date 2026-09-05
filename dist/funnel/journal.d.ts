import type { CqId, CqObject, CqObjectDraft } from './types.js';
import type { P2PConnection } from './ephemeral.js';
export declare const KIND: {
    readonly nip: "funnel.nip/1";
    readonly snap: "funnel.snap/1";
    readonly meet: "funnel.meet/1";
};
export type NipKind = (typeof KIND)[keyof typeof KIND];
export interface Query {
    kind?: string;
    text?: string;
}
export declare function publish(room: string, draft: CqObjectDraft, p2p: P2PConnection | null): Promise<CqObject>;
export declare function ingest(obj: CqObject, room: string): Promise<boolean>;
export declare function query(room: string, q?: Query): Promise<CqObject[]>;
export declare function parseQuery(raw: string): Query;
export declare function syncSince(room: string, since: CqId | null, p2p: P2PConnection): Promise<void>;
export declare function loadFeed(room: string, q?: Query): Promise<CqObject[]>;
export declare function nipLabel(kind: string): string;
