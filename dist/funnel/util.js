export function pack(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    for (const b of bytes)
        bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unpack(str) {
    if (!str)
        throw new Error('Datos vacíos');
    let b64 = decodeURIComponent(str).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4)
        b64 += '=';
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
}
export function b64Encode(bytes) {
    let bin = '';
    for (const b of bytes)
        bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64Decode(str) {
    let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4)
        b64 += '=';
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
export function getQueryParam(name) {
    for (const source of [location.search.slice(1), location.hash.slice(1)]) {
        if (!source)
            continue;
        for (const part of source.split('&')) {
            const eq = part.indexOf('=');
            if (eq === -1)
                continue;
            if (part.slice(0, eq) === name)
                return decodeURIComponent(part.slice(eq + 1));
        }
    }
    return null;
}
export function parseUrlParams(url) {
    const u = new URL(url);
    const params = {};
    for (const part of u.search.slice(1).split('&')) {
        const eq = part.indexOf('=');
        if (eq === -1)
            continue;
        params[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
    }
    for (const part of u.hash.slice(1).split('&')) {
        const eq = part.indexOf('=');
        if (eq === -1)
            continue;
        params[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
    }
    return params;
}
export function buildUrl(roomId, extra, path = location.pathname) {
    const u = new URL(location.origin + path);
    const parts = [`r=${encodeURIComponent(roomId)}`];
    for (const [key, val] of Object.entries(extra)) {
        parts.push(`${key}=${encodeURIComponent(val)}`);
    }
    u.search = `?${parts.join('&')}`;
    return u.toString();
}
export function $(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`#${id} no encontrado`);
    return el;
}
export function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
//# sourceMappingURL=util.js.map