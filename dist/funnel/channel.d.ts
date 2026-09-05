import { type P2PConnection } from './ephemeral.js';
import type { CqObject, CqObjectDraft } from './types.js';
export type ObjectListener = (obj: CqObject) => void;
export interface Channel {
    readonly room: string;
    readonly p2p: P2PConnection;
    objects(): CqObject[];
    head(): CqObject | null;
    query(kind?: string): CqObject[];
    publish(draft: CqObjectDraft): Promise<CqObject>;
    onObject(fn: ObjectListener): () => void;
}
export interface ChannelOptions {
    onStatus: (text: string) => void;
    onOpen?: () => void;
}
export declare function openChannel(room: string, opts: ChannelOptions): Channel;
