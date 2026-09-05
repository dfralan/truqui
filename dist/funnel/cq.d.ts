import type { CqId, CqObject, CqObjectDraft } from './types.js';
export declare function canonicalize(obj: unknown): string;
export declare function computeId(obj: unknown): Promise<CqId>;
export declare function build(partial: CqObjectDraft): Omit<CqObject, 'id'>;
export declare function finalize(partial: CqObjectDraft): Promise<CqObject>;
