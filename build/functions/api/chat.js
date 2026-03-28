export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];

    if (!messages.length) {
      return json({ ok: false, reply: '沒有收到訊息' }, 400);
    }

    const hfKey = env?.HF_API_KEY || env?.HF_TOKEN || '';
    const model = env?.HF_MODEL || 'openai/gpt-oss-120b:groq';

    const outgoing = messages.some(m => m && m.role === 'system')
      ? messages
      : [{
          role: 'system',
          content: '你是個助理。當使用者使用中文或包含中文漢字時，請以 繁體中文（臺灣常用表達） 回答；若使用者使用英文或其他語言，請以使用者使用的語言回答。請保持回答清楚、友善並避免使用簡體字。'
        }, ...messages];

    if (!hfKey) {
      const lastUser = [...messages].reverse().find(m => m && m.role === 'user')?.content ?? '';
      return json({
        ok: true,
        reply: `（本地測試回應）我收到：${lastUser}`
      });
    }

    const resp = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: outgoing
      })
    });

    const text = await resp.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) {}

    if (!resp.ok) {
      const friendly = buildFriendlyError(resp.status, data, text, model);
      return json({
        ok: false,
        error: friendly,
        reply: friendly
      }, 500);
    }

    const reply = data?.choices?.[0]?.message?.content
      ?? data?.output_text
      ?? data?.message?.content
      ?? text
      ?? '（空回覆）';

    return json({ ok: true, reply });
  } catch (error) {
    return json({
      ok: false,
      error: String(error?.message || error),
      reply: '呼叫 Hugging Face Router 失敗'
    }, 500);
  }
}

function buildFriendlyError(status, data, rawText, model) {
  const detail = data?.error?.message || data?.error || data?.message || rawText || '';
  if (status === 404) {
    return `找不到可用的模型或 provider：${model}。請確認這個模型有支援 Inference Providers / Router。`;
  }
  if (status === 401) {
    return 'HF_API_KEY / HF_TOKEN 無效，或沒有 Inference Providers 權限。';
  }
  if (status === 429) {
    return '請求太頻繁或額度不足，請稍後再試。';
  }
  return detail ? `Hugging Face Router 回傳錯誤（${status}）：${detail}` : `Hugging Face Router 回傳錯誤（${status}）`;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
