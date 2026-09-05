export type PlayerSlot = 0 | 1;
export type CqId = `cq:sha256:${string}`;
export interface CqProvenance {
    parents: CqId[];
    derived_from: CqId[];
    caused_by: CqId[];
}
export interface CqLifecycle {
    issued_at: number;
    not_before: number | null;
    expires_at: number | null;
    supersedes: CqId[];
    revokes: CqId[];
}
export interface CqObjectDraft {
    kind: string;
    coords?: Record<string, string>;
    payload?: Record<string, unknown>;
    provenance?: Partial<CqProvenance>;
    operations?: unknown[];
    lifecycle?: Partial<CqLifecycle>;
}
export interface CqObject extends CqObjectDraft {
    cq: '2';
    id: CqId;
    coords: Record<string, string>;
    payload: Record<string, unknown>;
    provenance: CqProvenance;
    operations: unknown[];
    lifecycle: CqLifecycle;
}
export interface CqRecord {
    id: CqId;
    room: string;
    kind: string;
    issued_at: number;
    derived_from: CqId[];
    object: CqObject;
}
export interface CqPersistEnvelope {
    v: 1;
    room: string;
    seq: number;
    cq_id: CqId;
    ciphertext: string;
    author: string;
}
export interface PointerHint {
    room: string;
    relays: string[];
    tag: string;
    since: number;
    expires_at: number;
}
export type SessionMode = 'ephemeral' | 'cqpersist';
export type P2PRole = 'host' | 'guest';
export interface DcMessageBase {
    type: string;
}
export interface DcStateMessage extends DcMessageBase {
    type: 'state';
    data: unknown;
}
export interface DcChatMessage extends DcMessageBase {
    type: 'chat';
    text: string;
    from: PlayerSlot;
    ts: number;
}
export interface DcReadyMessage extends DcMessageBase {
    type: 'ready';
}
export interface DcCqMessage extends DcMessageBase {
    type: 'cq';
    object: CqObject;
}
export interface DcCqSyncMessage extends DcMessageBase {
    type: 'cq_sync';
    since: CqId | null;
}
export type DcMessage = DcStateMessage | DcChatMessage | DcReadyMessage | DcCqMessage | DcCqSyncMessage;
export interface P2PCallbacks {
    onState: (data: unknown) => void;
    onStatus: (text: string) => void;
    onOpen?: () => void;
    onChat?: (msg: Omit<DcChatMessage, 'type'>) => void;
    onReady?: () => void;
    onCq?: (object: CqObject) => void;
    onCqSync?: (since: CqId | null) => void;
}
export interface ParsedLink {
    r: string | null;
    o: string | null;
    a: string | null;
    room: string | null;
    k: string | null;
}
