import { escapeHtml } from '../funnel/util.js';
export const MESSAGE_KIND = 'funnel.message/1';
export function previewMessage(obj) {
    if (obj.kind !== MESSAGE_KIND)
        return '';
    return typeof obj.payload.text === 'string' ? obj.payload.text : '';
}
export function htmlPreview(obj) {
    const text = previewMessage(obj);
    return text ? escapeHtml(text) : '';
}
function renderInto(log, obj) {
    const text = previewMessage(obj);
    if (!text)
        return;
    const row = document.createElement('div');
    row.className = 'chat-msg';
    row.textContent = text;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
}
export function mountChat(el, channel) {
    el.innerHTML = '';
    const log = document.createElement('div');
    log.className = 'chat-log';
    const form = document.createElement('form');
    form.className = 'row';
    const input = document.createElement('input');
    input.className = 'input';
    input.type = 'text';
    input.placeholder = 'Mensaje';
    input.maxLength = 500;
    input.autocomplete = 'off';
    const send = document.createElement('button');
    send.type = 'submit';
    send.className = 'btn btn-primary';
    send.textContent = 'Enviar';
    form.append(input, send);
    el.append(log, form);
    for (const obj of channel.query(MESSAGE_KIND))
        renderInto(log, obj);
    const stop = channel.onObject((obj) => renderInto(log, obj));
    const onSubmit = (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text)
            return;
        input.value = '';
        void channel.publish({ kind: MESSAGE_KIND, payload: { text } });
    };
    form.addEventListener('submit', onSubmit);
    return () => {
        stop();
        form.removeEventListener('submit', onSubmit);
        el.innerHTML = '';
    };
}
export const chatScript = {
    id: 'chat',
    label: 'Chat',
    kinds: [MESSAGE_KIND],
    mount: mountChat,
};
//# sourceMappingURL=chat.js.map