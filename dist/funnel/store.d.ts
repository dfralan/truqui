import type { CqId, CqObject, CqRecord } from './types.js';
export interface RoomQuery {
    kind?: string;
    since?: number;
}
export declare function append(obj: CqObject, room?: string): Promise<CqRecord>;
export declare function get(id: CqId): Promise<CqRecord | null>;
export declare function getByRoom(room: string, query?: RoomQuery): Promise<CqRecord[]>;
export declare function latest(room: string): Promise<CqRecord | null>;
export declare function chain(fromId: CqId, limit?: number): Promise<CqRecord[]>;
export declare function after(room: string, sinceId: CqId | null): Promise<CqRecord[]>;
export declare function has(id: CqId): Promise<boolean>;
export declare function allRooms(): Promise<string[]>;
