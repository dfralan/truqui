const STUN = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function pack(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unpack(str) {
  if (!str) throw new Error('Datos vacíos');
  let b64 = decodeURIComponent(str).replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function toDesc(init) {
  if (window.RTCSessionDescription) return new RTCSessionDescription(init);
  return init;
}

function waitIce(pc, ms = 10000) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return Promise.race([
    new Promise((resolve) => {
      const done = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', done);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', done);
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout esperando ICE')), ms);
    }),
  ]);
}

function getQueryParam(name) {
  const search = location.search.slice(1);
  if (!search) return null;
  for (const part of search.split('&')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

function parseLink() {
  return {
    r: getQueryParam('r'),
    o: getQueryParam('o'),
    a: getQueryParam('a'),
  };
}

function buildUrl(roomId, extraParams) {
  const u = new URL(location.origin + location.pathname);
  const parts = [`r=${encodeURIComponent(roomId)}`];
  for (const [key, val] of Object.entries(extraParams)) {
    parts.push(`${key}=${encodeURIComponent(val)}`);
  }
  u.search = `?${parts.join('&')}`;
  return u.toString();
}

function parseUrlParams(url) {
  const u = new URL(url);
  const params = {};
  for (const part of u.search.slice(1).split('&')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    params[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
  }
  const hash = u.hash.slice(1);
  if (hash) {
    for (const part of hash.split('&')) {
      const eq = part.indexOf('=');
      if (eq === -1) continue;
      params[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
    }
  }
  return params;
}

function hostKey(roomId) {
  return `truqui-host-${roomId}`;
}

function createP2P(roomId, { onState, onStatus, onOpen }) {
  let pc = null;
  let dc = null;
  let role = null;
  let bc = null;

  try {
    bc = new BroadcastChannel(`truqui-${roomId}`);
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'answer' && role === 'host') {
        acceptAnswer(ev.data.sdp).catch((err) => onStatus(`Error: ${err.message}`));
      }
    };
  } catch { /* sin BroadcastChannel */ }

  function setupChannel(channel) {
    dc = channel;
    dc.onopen = () => {
      onStatus('Conectado P2P');
      onOpen?.();
    };
    dc.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'state') onState(msg.data);
      } catch { /* ignore */ }
    };
  }

  function sendState(data) {
    if (dc?.readyState === 'open') {
      dc.send(JSON.stringify({ type: 'state', data }));
    }
  }

  async function restoreHost() {
    role = 'host';
    const saved = sessionStorage.getItem(hostKey(roomId));
    if (!saved) throw new Error('Sesión de host no encontrada');

    pc = new RTCPeerConnection(STUN);
    setupChannel(pc.createDataChannel('game', { ordered: true }));
    pc.onicecandidate = () => {};
    await pc.setLocalDescription(toDesc(unpack(saved)));
  }

  async function createInvite() {
    role = 'host';
    onStatus('Generando link…');
    pc = new RTCPeerConnection(STUN);
    setupChannel(pc.createDataChannel('game', { ordered: true }));
    pc.onicecandidate = () => {};

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIce(pc);
    sessionStorage.setItem(hostKey(roomId), pack(pc.localDescription));

    return buildUrl(roomId, { o: pack(pc.localDescription) });
  }

  async function joinInvite(offerPacked) {
    role = 'guest';
    onStatus('Conectando con el host…');
    const offer = unpack(offerPacked);
    pc = new RTCPeerConnection(STUN);
    pc.onicecandidate = () => {};
    pc.ondatachannel = (ev) => setupChannel(ev.channel);

    await pc.setRemoteDescription(toDesc(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitIce(pc);

    const answerUrl = buildUrl(roomId, { a: pack(pc.localDescription) });
    try {
      bc?.postMessage({ type: 'answer', sdp: pc.localDescription });
    } catch { /* ignore */ }
    return answerUrl;
  }

  async function acceptAnswer(answerPacked) {
    if (role !== 'host') role = 'host';
    if (!pc) await restoreHost();

    const answer = typeof answerPacked === 'string' ? unpack(answerPacked) : answerPacked;
    if (pc.remoteDescription) return;
    await pc.setRemoteDescription(toDesc(answer));
  }

  function acceptAnswerFromUrl(url) {
    const params = parseUrlParams(url);
    if (!params.a) throw new Error('Link sin respuesta');
    return acceptAnswer(params.a);
  }

  function close() {
    bc?.close();
    dc?.close();
    pc?.close();
  }

  return {
    createInvite,
    joinInvite,
    acceptAnswer,
    acceptAnswerFromUrl,
    sendState,
    close,
    get role() { return role; },
  };
}
