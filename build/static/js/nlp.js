const STORAGE_KEY = 'ting_ai_conversation';
const recentLimit = 40;
const STORAGE_WARNING_BYTES = 2.4 * 1024 * 1024;
const SYSTEM_PROMPT = (
  "你是個助理。當使用者使用中文或包含中文漢字時，請以 繁體中文（臺灣常用表達） 回答；"
  + "若使用者使用英文或其他語言，請以使用者使用的語言回答。"
  + "請保持回答清楚、友善並避免使用簡體字。"
);

let viewMode = 'replies';

function approximateBytes(str) {
  try { return new Blob([str]).size; }
  catch (e) { return str.length * 2; }
}

function loadMemory() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('parse storage fail', e);
    return [];
  }
}

function isQuotaExceeded(e) {
  return (
    e instanceof DOMException &&
    (e.code === 22 || e.code === 1014 || e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  ) || (e && e.message && e.message.toLowerCase().includes('quota'));
}

function saveMemory(arr) {
  let toSave = arr.slice(-recentLimit);
  let json = JSON.stringify(toSave);
  try {
    localStorage.setItem(STORAGE_KEY, json);
    const used = approximateBytes(json);
    if (used >= STORAGE_WARNING_BYTES) {
      if (confirm('本機儲存空間已接近上限，是否現在清除最舊 10 筆以釋放空間？')) {
        toSave = toSave.slice(10);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
          alert('已清除最舊 10 筆。');
        } catch (e) {
          console.warn('再次寫入失敗', e);
        }
      }
    }
    return true;
  } catch (e) {
    console.warn('initial save failed:', e);
    if (isQuotaExceeded(e)) {
      let fallback = toSave.slice();
      while (fallback.length > 0) {
        fallback.shift();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
          alert('本機儲存空間不足，已自動刪除最舊的對話。');
          return true;
        } catch (err2) {
          if (!isQuotaExceeded(err2)) break;
        }
      }
      alert('本機儲存空間不足，無法儲存對話。');
      return false;
    }
    return false;
  }
}

function addMessage(role, content) {
  const arr = loadMemory();
  arr.push({ role, content, ts: Date.now() });
  saveMemory(arr);
}

function renderMessages() {
  const container = document.getElementById('aiMessages');
  if (!container) return;
  container.innerHTML = '';
  const data = loadMemory();

  if (viewMode === 'memory') {
    const ul = document.createElement('ul');
    ul.className = 'memory-list';
    const userMsgs = data.filter(m => m.role === 'user');
    if (userMsgs.length === 0) {
      ul.innerHTML = '<li>暫無本機提問記錄</li>';
    } else {
      userMsgs.forEach(m => {
        const li = document.createElement('li');
        const d = new Date(m.ts);
        li.textContent = `${d.toLocaleString()} — ${m.content}`;
        ul.appendChild(li);
      });
    }
    container.appendChild(ul);
    container.scrollTop = container.scrollHeight;
  } else {
    const slice = data.slice(-recentLimit);
    slice.forEach(m => {
      const div = document.createElement('div');
      div.className = 'msg ' + (m.role === 'user' ? 'user' : 'assistant');
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = m.content;
      div.appendChild(bubble);
      container.appendChild(div);
    });
    if (slice.length === 0) {
      container.innerHTML = '<div style="opacity:0.8">目前沒有對話，請在左下方輸入你的問題並按發送。</div>';
    }
    container.scrollTop = container.scrollHeight;
  }
}

function buildOutgoingMessages(additionalUserMessage) {
  const mem = loadMemory();
  let msgs = mem.map(m => ({ role: m.role, content: m.content }));
  if (additionalUserMessage) msgs.push({ role: 'user', content: additionalUserMessage });
  const hasSystem = msgs.some(m => m.role === 'system');
  if (!hasSystem) msgs = [{ role: 'system', content: SYSTEM_PROMPT }].concat(msgs);
  const systemPart = msgs.filter(m => m.role === 'system');
  const other = msgs.filter(m => m.role !== 'system').slice(-12);
  return systemPart.concat(other);
}

async function sendToServerAndRender(userText) {
  const container = document.getElementById('aiMessages');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'msg assistant';
  typingDiv.innerHTML = '<div class="bubble">AI 回覆中…</div>';
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;

  const outgoing = buildOutgoingMessages(userText);
  addMessage('user', userText);

  try {
    const resp = await fetch('/functions/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: outgoing })
    });
    const j = await resp.json();
    const reply = j && j.ok ? (j.reply || '（空回覆）') : (j.reply || ('伺服器錯誤：' + (j.error || '未知錯誤')));
    addMessage('assistant', reply);
    renderMessages();
  } catch (e) {
    console.error(e);
    const errMsg = '發送失敗（請檢查伺服器 / 網路）。';
    addMessage('assistant', errMsg);
    renderMessages();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const sendBtn = document.getElementById('sendBtn');
  const userInput = document.getElementById('userInput');
  const clearMemoryBtn = document.getElementById('clearMemoryBtn');
  const toggleMemoryBtn = document.getElementById('toggleMemoryBtn');

  if (sendBtn && userInput) {
    sendBtn.addEventListener('click', () => {
      const text = userInput.value.trim();
      if (!text) return;
      userInput.value = '';
      sendToServerAndRender(text);
    });

    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  }

  if (toggleMemoryBtn) {
    toggleMemoryBtn.addEventListener('click', () => {
      viewMode = (viewMode === 'replies') ? 'memory' : 'replies';
      toggleMemoryBtn.textContent = '顯示：' + (viewMode === 'replies' ? '回覆' : '過去提問');
      renderMessages();
    });
  }

  if (clearMemoryBtn) {
    clearMemoryBtn.addEventListener('click', () => {
      if (confirm('確定要清除本機記憶（localStorage）嗎？')) {
        localStorage.removeItem(STORAGE_KEY);
        renderMessages();
        alert('本機記憶已清除。');
      }
    });
  }

  renderMessages();
});
