// functions/api/chat.js
export async function onRequestGet() {
  return new Response('API alive');
}

export async function onRequestPost({ request, env }) {
  return new Response(JSON.stringify({ ok: true, reply: 'POST alive' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
