const messagesEl  = document.getElementById("messages");
const inputEl     = document.getElementById("userInput");
const sendBtn     = document.getElementById("sendBtn");
const sidebar     = document.getElementById("sidebar");
const overlay     = document.getElementById("overlay");
const menuBtn     = document.getElementById("menuBtn");
const newChatBtn  = document.getElementById("newChatBtn");
const historyList = document.getElementById("historyList");
const topbarTitle = document.getElementById("topbarTitle");

// Simple UUID generator (no HTTPS required)
function makeId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// In-memory sessions: [{conv_id, title, messages:[]}]
let chatSessions  = [];
let currentConvId = null;

// ── Sidebar toggle ──────────────────────────────────────
menuBtn.addEventListener("click", () => {
  sidebar.classList.toggle("open");
  overlay.classList.toggle("show");
});
overlay.addEventListener("click", closeSidebar);

function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
}

// ── New chat ────────────────────────────────────────────
newChatBtn.addEventListener("click", startNewChat);

function startNewChat() {
  currentConvId = null;
  showWelcome();
  topbarTitle.textContent = "New Conversation";
  renderHistory();
  closeSidebar();
  inputEl.focus();
}

// ── Welcome / empty state ───────────────────────────────
function showWelcome() {
  messagesEl.innerHTML = `
    <div class="welcome">
      <div class="welcome-glow"></div>

      <div class="welcome-orb">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      </div>

      <h1>Hello, I'm Aura AI.</h1>
      <p class="welcome-greeting">How can I assist you today?<br>I think clearly, respond fast, and remember our conversations.</p>

      <div class="welcome-chips">
        <button class="chip" data-prompt="Explain quantum computing in simple terms">
          ⚡ Explain quantum computing
        </button>
        <button class="chip" data-prompt="Write a short poem about the ocean">
          ✦ Write me a poem
        </button>
        <button class="chip" data-prompt="Give me 5 actionable productivity tips">
          📋 Productivity tips
        </button>
        <button class="chip" data-prompt="What are the biggest trends in AI right now?">
          🤖 AI trends 2025
        </button>
      </div>
    </div>`;

  // Wire chip buttons to auto-send
  messagesEl.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      inputEl.value = chip.dataset.prompt;
      updateSendBtn();
      sendMessage();
    });
  });
}

// ── Send button state ───────────────────────────────────
function updateSendBtn() {
  sendBtn.disabled = inputEl.value.trim() === "";
}

inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
  updateSendBtn();
});

// ── Keyboard shortcut: Enter to send, Shift+Enter = newline ──
inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});
sendBtn.addEventListener("click", sendMessage);

// ── Core send flow ──────────────────────────────────────
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  // Remove welcome screen on first message
  if (messagesEl.querySelector(".welcome")) {
    messagesEl.innerHTML = "";
  }

  // Create a new conversation if one isn't active
  if (!currentConvId) {
    currentConvId = makeId();
    chatSessions.unshift({
      conv_id:  currentConvId,
      title:    text.slice(0, 44),
      messages: [],
    });
  }

  const session = chatSessions.find(s => s.conv_id === currentConvId);
  session.messages.push({ role: "user", content: text });
  topbarTitle.textContent = session.title;

  appendBubble("user", text);
  inputEl.value = "";
  inputEl.style.height = "auto";
  sendBtn.disabled = true;
  renderHistory();

  const typingId = appendTyping();

  try {
    const res = await fetch("/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        messages: session.messages,
        conv_id:  session.conv_id,
        title:    session.title,
      }),
    });

    removeTyping(typingId);
    const data = await res.json();

    if (!res.ok) {
      appendBubble("ai", data.error || "Something went wrong. Please try again.");
    } else {
      session.messages.push({ role: "assistant", content: data.reply });
      appendBubble("ai", data.reply);
      renderHistory();
    }
  } catch {
    removeTyping(typingId);
    appendBubble("ai", "Connection error. Please check your network and try again.");
  }

  updateSendBtn();
  inputEl.focus();
}

// ── DOM helpers ─────────────────────────────────────────

// Aura avatar SVG used inside AI bubbles
const AVATAR_SVG = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"
       stroke-linecap="round" stroke-linejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>`;

function appendBubble(role, text) {
  const row = document.createElement("div");
  row.className = `msg-row ${role}`;

  // Show the Aura avatar icon to the left of every AI reply
  if (role === "ai") {
    const avatar = document.createElement("div");
    avatar.className = "ai-avatar";
    avatar.innerHTML = AVATAR_SVG;
    row.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.appendChild(bubble);

  messagesEl.appendChild(row);
  scrollBottom();
}

function appendTyping() {
  const id  = "typing-" + Date.now();
  const row = document.createElement("div");
  row.className = "msg-row ai";
  row.id = id;

  const avatar = document.createElement("div");
  avatar.className = "ai-avatar";
  avatar.innerHTML = AVATAR_SVG;
  row.appendChild(avatar);

  row.innerHTML += `<div class="bubble">
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>
  </div>`;

  messagesEl.appendChild(row);
  scrollBottom();
  return id;
}

function removeTyping(id) {
  document.getElementById(id)?.remove();
}

function scrollBottom() {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
}

// ── Sidebar history ─────────────────────────────────────
function renderHistory() {
  historyList.innerHTML = "";
  chatSessions.forEach(s => {
    const li = document.createElement("li");
    li.textContent = s.title || "New Chat";
    if (s.conv_id === currentConvId) li.classList.add("active");
    li.addEventListener("click", () => loadSession(s.conv_id));
    historyList.appendChild(li);
  });
}

function loadSession(convId) {
  currentConvId = convId;
  const session = chatSessions.find(s => s.conv_id === convId);
  messagesEl.innerHTML = "";
  session.messages.forEach(m =>
    appendBubble(m.role === "assistant" ? "ai" : m.role, m.content)
  );
  topbarTitle.textContent = session.title;
  renderHistory();
  closeSidebar();
}

// ── Load history from server on page load ───────────────
async function loadHistoryFromServer() {
  try {
    const res  = await fetch("/history");
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      chatSessions = data.map(conv => ({
        conv_id:  conv.conv_id,
        title:    conv.title,
        messages: conv.messages,
      }));
      renderHistory();
    }
  } catch (e) {
    console.warn("Could not load history:", e);
  }
}

// ── Init ────────────────────────────────────────────────
showWelcome();
loadHistoryFromServer();
