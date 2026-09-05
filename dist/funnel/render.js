import { nipLabel } from './journal.js';
import { escapeHtml } from './util.js';
export function renderNip(obj, opts = {}) {
    const el = document.createElement('article');
    el.className = 'nip' + (opts.mine ? ' mine' : '');
    el.dataset.id = obj.id;
    el.dataset.kind = obj.kind;
    const meta = document.createElement('header');
    meta.className = 'nip-meta';
    meta.innerHTML = `<span class="nip-kind">${escapeHtml(nipLabel(obj.kind))}</span><time>${formatTime(obj.lifecycle.issued_at)}</time>`;
    el.appendChild(meta);
    const body = document.createElement('div');
    body.className = 'nip-body';
    if (obj.kind === 'funnel.meet/1') {
        const title = String(obj.payload.title ?? 'Sin título');
        const at = obj.payload.at ? formatMeet(String(obj.payload.at)) : '';
        body.innerHTML = `<strong>${escapeHtml(title)}</strong>${at ? `<span class="nip-meet-at">${escapeHtml(at)}</span>` : ''}`;
    }
    else {
        const text = String(obj.payload.text ?? '');
        body.textContent = text;
        if (obj.kind === 'funnel.snap/1' && obj.lifecycle.expires_at) {
            const badge = document.createElement('span');
            badge.className = 'nip-badge';
            badge.textContent = 'efímero';
            body.appendChild(badge);
        }
    }
    el.appendChild(body);
    return el;
}
function formatTime(ts) {
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatMeet(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}
export function renderSystem(text) {
    const el = document.createElement('div');
    el.className = 'nip system';
    el.textContent = text;
    return el;
}
//# sourceMappingURL=render.js.map