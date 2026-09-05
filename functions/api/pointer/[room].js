export async function onRequest(context) {
  const { request, env, params } = context;
  const room = params.room;
  if (!room) return new Response('room required', { status: 400 });

  const kv = env.POINTER_KV;
  if (!kv) return new Response('KV not configured', { status: 503 });

  if (request.method === 'GET') {
    const val = await kv.get(room);
    if (!val) return new Response('not found', { status: 404 });
    return new Response(val, { headers: { 'Content-Type': 'application/json' } });
  }

  if (request.method === 'PUT') {
    const body = await request.text();
    let hint;
    try {
      hint = JSON.parse(body);
    } catch {
      return new Response('invalid json', { status: 400 });
    }
    const ttl = hint.expires_at
      ? Math.max(60, hint.expires_at - Math.floor(Date.now() / 1000))
      : 3600;
    await kv.put(room, body, { expirationTtl: ttl });
    return new Response('ok', { status: 204 });
  }

  return new Response('method not allowed', { status: 405 });
}
