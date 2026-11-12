// ── Sly Sculpted — Live Chat Widget ──────────────────────────
// WebSocket-based. AI (Ollama) by default.
// Admin can take over by replying on WhatsApp; falls back to AI after 60s of silence.
(function () {

  // ── Styles ───────────────────────────────────────────────
  const css = `
.ss-chat-btn{position:fixed;bottom:24px;right:24px;z-index:9999;background:#1A1410;color:#fff;border:none;border-radius:100px;padding:12px 20px 12px 16px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 24px rgba(0,0,0,0.18);transition:all 0.22s;white-space:nowrap}
.ss-chat-btn:hover{background:#E8608A;transform:translateY(-2px);box-shadow:0 8px 28px rgba(232,96,138,0.32)}
.ss-chat-btn svg{width:16px;height:16px;flex-shrink:0}

.ss-chat-panel{position:fixed;bottom:88px;right:24px;z-index:9998;width:360px;height:520px;background:#F7F4F1;border-radius:20px;border:1px solid rgba(26,20,16,0.1);box-shadow:0 24px 64px rgba(0,0,0,0.14);display:flex;flex-direction:column;overflow:hidden;transform:translateY(16px) scale(0.97);opacity:0;pointer-events:none;transition:all 0.26s cubic-bezier(0.16,1,0.3,1);transform-origin:bottom right}
.ss-chat-panel.ss-open{transform:translateY(0) scale(1);opacity:1;pointer-events:all}

.ss-chat-hdr{background:#1A1410;color:#fff;padding:14px 18px;display:flex;align-items:center;gap:10px;flex-shrink:0;transition:background 0.4s}
.ss-chat-hdr.ss-admin-mode{background:#1a2e1a}
.ss-chat-hdr-av{width:34px;height:34px;border-radius:50%;background:rgba(232,96,138,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px;transition:background 0.3s}
.ss-admin-mode .ss-chat-hdr-av{background:rgba(16,185,129,0.2)}
.ss-chat-hdr-info{flex:1;min-width:0}
.ss-chat-hdr-name{font-size:13px;font-weight:500;letter-spacing:0.02em}
.ss-chat-hdr-sub{font-size:10px;opacity:0.55;margin-top:1px;font-family:'DM Mono',monospace;letter-spacing:0.06em;text-transform:uppercase;display:flex;align-items:center;gap:5px}
.ss-live-dot{width:5px;height:5px;border-radius:50%;background:#10B981;animation:ss-pulse 2s infinite;display:none;flex-shrink:0}
.ss-admin-mode .ss-live-dot{display:inline-block}
.ss-chat-close{background:none;border:none;color:rgba(255,255,255,0.55);cursor:pointer;padding:6px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:all 0.15s}
.ss-chat-close:hover{color:#fff;background:rgba(255,255,255,0.1)}
.ss-chat-close svg{width:14px;height:14px}

.ss-chat-msgs{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}
.ss-chat-msgs::-webkit-scrollbar{width:3px}
.ss-chat-msgs::-webkit-scrollbar-thumb{background:rgba(232,96,138,0.25);border-radius:4px}

.ss-msg{display:flex;gap:8px;max-width:86%;animation:ss-in 0.2s ease}
@keyframes ss-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.ss-msg.ss-user{align-self:flex-end;flex-direction:row-reverse}
.ss-msg.ss-ai,.ss-msg.ss-admin{align-self:flex-start}
.ss-msg-av{width:26px;height:26px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;margin-top:3px}
.ss-msg.ss-ai .ss-msg-av{background:#E8E2DC;color:#4A3F38}
.ss-msg.ss-admin .ss-msg-av{background:rgba(16,185,129,0.15);color:#10B981}
.ss-msg.ss-user .ss-msg-av{background:#E8608A;color:#fff}
.ss-msg-bub{padding:9px 13px;border-radius:16px;font-size:13px;line-height:1.55;word-break:break-word}
.ss-msg.ss-ai .ss-msg-bub{background:#F0ECE8;color:#1A1410;border-bottom-left-radius:4px}
.ss-msg.ss-admin .ss-msg-bub{background:#edf7f2;color:#0d4a2e;border-bottom-left-radius:4px}
.ss-msg.ss-user .ss-msg-bub{background:#1A1410;color:#fff;border-bottom-right-radius:4px}
.ss-msg-label{font-size:10px;color:#9A8C82;font-family:'DM Mono',monospace;letter-spacing:0.06em;margin-bottom:3px;padding-left:1px}

.ss-notice{align-self:center;background:rgba(26,20,16,0.06);border-radius:100px;padding:5px 12px;font-size:11px;color:#4A3F38;font-family:'DM Mono',monospace;letter-spacing:0.06em;text-align:center;animation:ss-in 0.2s ease}

.ss-typing-wrap{display:flex;gap:8px;align-self:flex-start;align-items:flex-end;animation:ss-in 0.2s ease}
.ss-typing{display:flex;align-items:center;gap:4px;padding:10px 14px;background:#F0ECE8;border-radius:16px;border-bottom-left-radius:4px}
.ss-typing span{width:6px;height:6px;border-radius:50%;background:#9A8C82;animation:ss-dot 1.2s ease infinite}
.ss-typing span:nth-child(2){animation-delay:.2s}
.ss-typing span:nth-child(3){animation-delay:.4s}
@keyframes ss-dot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}
@keyframes ss-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.8)}}

.ss-chat-foot{padding:10px 14px;border-top:1px solid rgba(26,20,16,0.08);display:flex;gap:8px;background:#F7F4F1;flex-shrink:0;align-items:center}
.ss-chat-inp{flex:1;border:1.5px solid rgba(26,20,16,0.14);border-radius:100px;padding:9px 16px;font-family:'DM Sans',sans-serif;font-size:13px;background:#fff;color:#1A1410;outline:none;transition:border-color 0.18s}
.ss-chat-inp:focus{border-color:#E8608A}
.ss-chat-inp::placeholder{color:#9A8C82}
.ss-chat-send{width:36px;height:36px;border-radius:50%;background:#1A1410;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.18s;flex-shrink:0}
.ss-chat-send:hover:not(:disabled){background:#E8608A}
.ss-chat-send:disabled{opacity:0.35;cursor:not-allowed}
.ss-chat-send svg{width:15px;height:15px}
.ss-chat-credit{text-align:center;font-size:10px;color:#9A8C82;padding:6px 0 10px;font-family:'DM Mono',monospace;letter-spacing:0.08em;flex-shrink:0}

@media(max-width:480px){
  .ss-chat-panel{bottom:0;right:0;left:0;width:100%;height:70vh;border-radius:20px 20px 0 0;transform-origin:bottom center}
  .ss-chat-btn{bottom:16px;right:16px}
}
`;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── HTML ─────────────────────────────────────────────────
  document.body.insertAdjacentHTML('beforeend', `
<button class="ss-chat-btn" id="ss-chat-btn" aria-label="Open chat">
  <svg viewBox="0 0 20 20" fill="none"><path d="M2 4a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H6l-4 3V4z" fill="currentColor"/></svg>
  Chat with us
</button>
<div class="ss-chat-panel" id="ss-chat-panel" role="dialog" aria-label="Chat support">
  <div class="ss-chat-hdr" id="ss-chat-hdr">
    <div class="ss-chat-hdr-av" id="ss-chat-hdr-av">✦</div>
    <div class="ss-chat-hdr-info">
      <div class="ss-chat-hdr-name" id="ss-chat-hdr-name">Sly Sculpted Support</div>
      <div class="ss-chat-hdr-sub"><span class="ss-live-dot"></span><span id="ss-chat-hdr-sub">AI · Usually instant</span></div>
    </div>
    <button class="ss-chat-close" id="ss-chat-close" aria-label="Close chat">
      <svg viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>
  </div>
  <div class="ss-chat-msgs" id="ss-chat-msgs"></div>
  <div class="ss-chat-foot">
    <input class="ss-chat-inp" id="ss-chat-inp" placeholder="Ask about your order, products…" autocomplete="off" maxlength="600"/>
    <button class="ss-chat-send" id="ss-chat-send" aria-label="Send">
      <svg viewBox="0 0 16 16" fill="none"><path d="M2 8l12-6-5 6 5 6-12-6z" fill="currentColor"/></svg>
    </button>
  </div>
  <div class="ss-chat-credit">POWERED BY AI · SLY SCULPTED</div>
</div>
`);

  // ── State ────────────────────────────────────────────────
  let open = false;
  let mode = 'ai';        // 'ai' | 'admin'
  let sessionId = null;
  let ws = null;
  let wsReady = false;
  let reconnectTimer = null;

  // ── DOM refs ─────────────────────────────────────────────
  const panel   = document.getElementById('ss-chat-panel');
  const msgs    = document.getElementById('ss-chat-msgs');
  const inp     = document.getElementById('ss-chat-inp');
  const sendBtn = document.getElementById('ss-chat-send');
  const hdr     = document.getElementById('ss-chat-hdr');
  const hdrAv   = document.getElementById('ss-chat-hdr-av');
  const hdrName = document.getElementById('ss-chat-hdr-name');
  const hdrSub  = document.getElementById('ss-chat-hdr-sub');

  // ── WebSocket ─────────────────────────────────────────────
  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new window.WebSocket(`${proto}//${location.host}`);

    ws.addEventListener('open', () => {
      wsReady = true;
      clearTimeout(reconnectTimer);
    });

    ws.addEventListener('message', e => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }

      if (data.type === 'init') {
        sessionId = data.sessionId;
        return;
      }

      if (data.type === 'typing') {
        showTyping();
        return;
      }

      if (data.type === 'mode') {
        setMode(data.mode);
        return;
      }

      if (data.type === 'message') {
        hideTyping();
        addBubble(data.role, data.content);
        return;
      }
    });

    ws.addEventListener('close', () => {
      wsReady = false;
      // Reconnect after 3s
      reconnectTimer = setTimeout(connect, 3000);
    });

    ws.addEventListener('error', () => {
      ws.close();
    });
  }

  // ── Mode indicator ────────────────────────────────────────
  function setMode(newMode) {
    mode = newMode;
    if (newMode === 'admin') {
      hdr.classList.add('ss-admin-mode');
      hdrAv.textContent = '👤';
      hdrSub.textContent = 'Support Team · Live';
      addNotice('You\'re now chatting with our support team');
    } else {
      hdr.classList.remove('ss-admin-mode');
      hdrAv.textContent = '✦';
      hdrSub.textContent = 'AI · Usually instant';
    }
  }

  // ── Message bubbles ───────────────────────────────────────
  function addBubble(role, text) {
    const el = document.createElement('div');
    el.className = `ss-msg ss-${role}`;
    const av = role === 'user' ? 'You' : role === 'admin' ? '👤' : '✦';
    el.innerHTML = `<div class="ss-msg-av">${av}</div><div class="ss-msg-bub">${esc(text).replace(/\n/g, '<br>')}</div>`;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addNotice(text) {
    const el = document.createElement('div');
    el.className = 'ss-notice';
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  // ── Typing indicator ──────────────────────────────────────
  function showTyping() {
    if (document.getElementById('ss-typing')) return;
    const el = document.createElement('div');
    el.className = 'ss-typing-wrap';
    el.id = 'ss-typing';
    el.innerHTML = `<div class="ss-msg-av" style="width:26px;height:26px;background:#E8E2DC;color:#4A3F38;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;margin-top:3px;">✦</div><div class="ss-typing"><span></span><span></span><span></span></div>`;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function hideTyping() { document.getElementById('ss-typing')?.remove(); }

  // ── Send ──────────────────────────────────────────────────
  function send() {
    const text = inp.value.trim();
    if (!text || sendBtn.disabled) return;
    inp.value = '';
    addBubble('user', text);
    sendBtn.disabled = true;

    if (!wsReady) {
      connect();
      // Queue via small delay once connection opens
      const t = setInterval(() => {
        if (wsReady) {
          clearInterval(t);
          wsSend(text);
          sendBtn.disabled = false;
        }
      }, 200);
      return;
    }

    wsSend(text);
    sendBtn.disabled = false;
  }

  function wsSend(text) {
    ws.send(JSON.stringify({ type: 'message', content: text }));
  }

  // ── Toggle panel ──────────────────────────────────────────
  function toggle() {
    open = !open;
    panel.classList.toggle('ss-open', open);
    if (open) {
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) connect();
      if (msgs.children.length === 0) {
        addBubble('ai', "Hey! 👋 Welcome to Sly Sculpted. Ask me anything — orders, products, shipping, returns, or anything else.");
      }
      setTimeout(() => inp.focus(), 280);
    }
  }

  document.getElementById('ss-chat-btn').addEventListener('click', toggle);
  document.getElementById('ss-chat-close').addEventListener('click', toggle);
  sendBtn.addEventListener('click', send);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) toggle(); });

  // ── Utility ───────────────────────────────────────────────
  function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Pre-connect in background so first message is faster
  connect();

})();
