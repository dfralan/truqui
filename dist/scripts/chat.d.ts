import type { Channel } from '../funnel/channel.js';
import type { CqObject } from '../funnel/types.js';
import type { Script } from './types.js';
export declare const MESSAGE_KIND = "funnel.message/1";
export declare function previewMessage(obj: CqObject): string;
export declare function htmlPreview(obj: CqObject): string;
export declare function mountChat(el: HTMLElement, channel: Channel): () => void;
export declare const chatScript: Script;
