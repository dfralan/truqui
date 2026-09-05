import type { PointerHint } from './types.js';
export declare function putPointer(hint: PointerHint, base?: string): Promise<void>;
export declare function getPointer(room: string, base?: string): Promise<PointerHint | null>;
