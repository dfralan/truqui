export declare function pack(obj: unknown): string;
export declare function unpack<T>(str: string): T;
export declare function b64Encode(bytes: Uint8Array): string;
export declare function b64Decode(str: string): Uint8Array;
export declare function getQueryParam(name: string): string | null;
export declare function parseUrlParams(url: string): Record<string, string>;
export declare function buildUrl(roomId: string, extra: Record<string, string>, path?: string): string;
export declare function $(id: string): HTMLElement;
export declare function escapeHtml(s: string): string;
