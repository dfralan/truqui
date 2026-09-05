import { openChannel, type Channel } from '../funnel/channel.js';
import { parseLink } from '../funnel/ephemeral.js';
import type { CqObject } from '../funnel/types.js';
import { $, escapeHtml } from '../funnel/util.js';
import { htmlPreview, MESSAGE_KIND, mountChat } from '../scripts/chat.js';

const link = parseLink();
let roomId = link.r ?? link.room;
let channel: Channel | null = null;
let unmountScript: (() => void) | null = null;
let activeScript = 'chat';

const statusEl = $('status');
const lobbyEl = $('lobby') as HTMLElement;
const canalEl = $('canal') as HTMLElement;
const timelineEl = $('timeline');
const scriptView = $('script-view');
const composerEl = $('composer') as HTMLElement;
const shareBox = $('share-box') as HTMLElement;
const shareLink = $('share-link') as HTMLInputElement;
const answerBox = $('answer-box') as HTMLElement;
const answerLink = $('answer-link') as HTMLInputElement;
const responseBox = $('response-box') as HTMLElement;
const responseLink = $('response-link') as HTMLInputElement;
const kindInput = $('obj-kind') as HTMLInputElement;
const payloadInput = $('obj-payload') as HTMLTextAreaElement;

function setStatus(text: string): void {
  statusEl.textContent = text;
}

function showCanal(): void {
  lobbyEl.hidden = true;
  canalEl.hidden = false;
  mountActiveScript();
}

function objectPreview(obj: CqObject): string {
  const msg = htmlPreview(obj);
  if (msg) return msg;
  try {
    return escapeHtml(JSON.stringify(obj.payload));
  } catch {
    return '';
  }
}

function renderObject(obj: CqObject): void {
  const el = document.createElement('div');
  el.className = 'event-row';
  const time = new Date(obj.lifecycle.issued_at * 1000).toLocaleTimeString();
  el.innerHTML = `<time>${time}</time><code>${escapeHtml(obj.kind)}</code><span>${objectPreview(obj)}</span>`;
  timelineEl.prepend(el);
}

function mountActiveScript(): void {
  unmountScript?.();
  unmountScript = null;
  if (!channel) return;
  if (activeScript === 'chat') unmountScript = mountChat(scriptView, channel);
}

function initChannel(id: string): Channel {
  roomId = id;
  channel = openChannel(id, {
    onStatus: setStatus,
    onOpen: () => {
      showCanal();
      setStatus('Canal activo');
    },
  });
  channel.onObject(renderObject);
  return channel;
}

async function copyBtn(btn: HTMLButtonElement, text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  const prev = btn.textContent;
  btn.textContent = 'Copiado';
  setTimeout(() => { btn.textContent = prev; }, 1500);
}

async function startRoom(): Promise<void> {
  const id = crypto.randomUUID().slice(0, 8);
  const ch = initChannel(id);
  sessionStorage.setItem(`funnel-host-${id}`, '1');
  const inviteUrl = await ch.p2p.createInvite();
  history.replaceState(null, '', inviteUrl);
  shareLink.value = inviteUrl;
  shareBox.hidden = false;
  answerBox.hidden = false;
  ($('btn-start') as HTMLButtonElement).hidden = true;
  setStatus('Compartí el link con tu par');
}

async function joinFromInvite(offer: string): Promise<void> {
  if (!roomId) return;
  const ch = initChannel(roomId);
  shareBox.hidden = true;
  ($('btn-start') as HTMLButtonElement).hidden = true;
  try {
    const answerUrl = await ch.p2p.joinInvite(offer);
    responseLink.value = answerUrl;
    responseBox.hidden = false;
    setStatus('Mandale el link de respuesta al host');
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Error al conectar');
  }
}

async function restoreHost(): Promise<void> {
  if (!roomId) return;
  initChannel(roomId);
  ($('btn-start') as HTMLButtonElement).hidden = true;
  shareBox.hidden = false;
  answerBox.hidden = false;
  shareLink.value = location.href;
  setStatus('Esperando par…');
}

async function hostAcceptAnswer(url: string): Promise<void> {
  if (!channel) return;
  try {
    setStatus('Conectando…');
    await channel.p2p.acceptAnswerFromUrl(url.trim());
  } catch {
    setStatus('Link de respuesta inválido');
  }
}

async function publishFromComposer(): Promise<void> {
  if (!channel) return;
  const kind = kindInput.value.trim() || MESSAGE_KIND;
  let payload: Record<string, unknown> = {};
  const raw = payloadInput.value.trim();
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setStatus('Payload tiene que ser un objeto JSON');
        return;
      }
      payload = parsed as Record<string, unknown>;
    } catch {
      payload = { text: raw };
    }
  }
  await channel.publish({ kind, payload });
  payloadInput.value = '';
  composerEl.hidden = true;
}

($('btn-start') as HTMLButtonElement).addEventListener('click', () => void startRoom());
($('btn-copy') as HTMLButtonElement).addEventListener('click', () => void copyBtn($('btn-copy') as HTMLButtonElement, shareLink.value));
($('btn-copy-response') as HTMLButtonElement).addEventListener('click', () => void copyBtn($('btn-copy-response') as HTMLButtonElement, responseLink.value));
($('btn-connect') as HTMLButtonElement).addEventListener('click', () => void hostAcceptAnswer(answerLink.value));
($('btn-plus') as HTMLButtonElement).addEventListener('click', () => {
  composerEl.hidden = !composerEl.hidden;
  if (!composerEl.hidden) payloadInput.focus();
});
($('btn-publish') as HTMLButtonElement).addEventListener('click', () => void publishFromComposer());
($('script-select') as HTMLSelectElement).addEventListener('change', (e) => {
  activeScript = (e.target as HTMLSelectElement).value;
  mountActiveScript();
});

if (roomId && link.o && sessionStorage.getItem(`funnel-host-${roomId}`) === '1') {
  void restoreHost();
} else if (roomId && link.o) {
  void joinFromInvite(link.o);
} else if (roomId && link.a) {
  const ch = initChannel(roomId);
  ($('btn-start') as HTMLButtonElement).hidden = true;
  shareBox.hidden = true;
  answerBox.hidden = true;
  ch.p2p.acceptAnswer(link.a)
    .then(() => setStatus('Conectando…'))
    .catch(() => setStatus('Abrí en la pestaña donde creaste la sala'));
} else if (roomId) {
  setStatus('Link incompleto — pedile al host el link con &o=');
  ($('btn-start') as HTMLButtonElement).hidden = true;
}
