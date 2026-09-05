import type { Identity } from './crypto.js';
export declare const DEFAULT_RELAYS: string[];
export interface NostrEvent {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig: string;
}
export interface NostrFilter {
    kinds?: number[];
    '#r'?: string[];
    '#t'?: string[];
    since?: number;
    limit?: number;
}
export declare function signEvent(identity: Identity, kind: number, content: string, tags: string[][]): Promise<NostrEvent>;
export declare function publish(relay: string, event: NostrEvent): Promise<void>;
export declare function subscribe(relay: string, filters: NostrFilter[], onEvent: (event: NostrEvent) => void): () => void;
export declare function publishToRelays(relays: string[], event: NostrEvent): Promise<string>;
