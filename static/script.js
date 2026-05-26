const messagesEl  = document.getElementById("messages");
const inputEl     = document.getElementById("userInput");
const sendBtn     = document.getElementById("sendBtn");
const sidebar     = document.getElementById("sidebar");
const overlay     = document.getElementById("overlay");
const menuBtn     = document.getElementById("menuBtn");
const newChatBtn  = document.getElementById("newChatBtn");
const historyList = document.getElementById("historyList");

let chatSessions = [];   // [{id, title, messages:[]}]
let currentId    = null;

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
  currentId = null;
  messagesEl.innerHTML = `
    <div class="welcome">
      <div class="welcome-icon">&#128214;</div>
      <h2>How can I help you today?</h2>
      <p>Ask me anything — I'm here to chat.</p>
    </div>`;
  document.querySelector(".topbar-title").textContent = "New Conversation";
  renderHistory();
  closeSidebar();
  inputEl.focus();
}

// ── Auto-resize textarea ────────────────────────────────
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
});

// ── Send on Enter (Shift+Enter = newline) ───────────────
inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
sendBtn.addEventListener("click", sendMessage);

// ── Core send flow ──────────────────────────────────────
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  // Clear welcome screen on first message
  if (messagesEl.querySelector(".welcome")) {
    messagesEl.innerHTML = "";
  }

  // Init session if needed
  if (!currentId) {
    currentId = Date.now();
    chatSessions.unshift({ id: currentId, title: text.slice(0, 40), messages: [] });
  }

  const session = chatSessions.find(s => s.id === currentId);
  session.messages.push({ role: "user", content: text });
  document.querySelector(".topbar-title").textContent = session.title;

  appendBubble("user", text);
  inputEl.value = "";
  inputEl.style.height = "auto";
  sendBtn.disabled = true;

  renderHistory();

  // Typing indicator
  const typingId = appendTyping();

  try {
    const res  = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: session.messages }),
    });
    const data = await res.json();
    removeTyping(typingId);

    const reply = data.reply || "Sorry, something went wrong.";
    session.messages.push({ role: "assistant", content: reply });
    appendBubble("ai", reply);
    renderHistory();
  } catch {
    removeTyping(typingId);
    appendBubble("ai", "Connection error. Please try again.");
  }

  sendBtn.disabled = false;
  inputEl.focus();
}

// ── DOM helpers ─────────────────────────────────────────
function appendBubble(role, text) {
  const row    = document.createElement("div");
  row.className = `msg-row ${role}`;

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
  row.innerHTML = `<div class="bubble"><div class="typing-dots">
    <span></span><span></span><span></span>
  </div></div>`;
  messagesEl.appendChild(row);
  scrollBottom();
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollBottom() {
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: "smooth" });
}

// ── History sidebar ─────────────────────────────────────
function renderHistory() {
  historyList.innerHTML = "";
  chatSessions.forEach(s => {
    const li = document.createElement("li");
    li.textContent = s.title || "New Chat";
    if (s.id === currentId) li.classList.add("active");
    li.addEventListener("click", () => loadSession(s.id));
    historyList.appendChild(li);
  });
}

function loadSession(id) {
  currentId = id;
  const session = chatSessions.find(s => s.id === id);
  messagesEl.innerHTML = "";
  session.messages.forEach(m => appendBubble(m.role === "assistant" ? "ai" : m.role, m.content));
  document.querySelector(".topbar-title").textContent = session.title;
  renderHistory();
  closeSidebar();
}
