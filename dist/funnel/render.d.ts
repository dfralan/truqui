import type { CqObject } from './types.js';
export interface RenderOpts {
    mine?: boolean;
}
export declare function renderNip(obj: CqObject, opts?: RenderOpts): HTMLElement;
export declare function renderSystem(text: string): HTMLElement;
