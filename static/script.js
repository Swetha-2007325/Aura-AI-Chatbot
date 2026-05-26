const messagesEl  = document.getElementById("messages");
const inputEl     = document.getElementById("userInput");
const sendBtn     = document.getElementById("sendBtn");
const sidebar     = document.getElementById("sidebar");
const overlay     = document.getElementById("overlay");
const menuBtn     = document.getElementById("menuBtn");
const newChatBtn  = document.getElementById("newChatBtn");
const historyList = document.getElementById("historyList");

// Hugging Face model and endpoint (called directly from the browser)
const HF_MODEL  = "mistralai/Mistral-7B-Instruct-v0.3";
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}/v1/chat/completions`;

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

  // Init a new session if this is the first message
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

  // Show typing indicator while waiting for the response
  const typingId = appendTyping();

  try {
    // Call Hugging Face Inference API directly from the browser
    const res = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: session.messages,  // full conversation history for context
        max_tokens: 1024,
      }),
    });

    removeTyping(typingId);

    if (!res.ok) {
      const err = await res.text();
      console.error("[HF API ERROR]", res.status, err);
      appendBubble("ai", `Error ${res.status}: Could not get a response. Please try again.`);
    } else {
      const data  = await res.json();
      const reply = data.choices[0].message.content;
      session.messages.push({ role: "assistant", content: reply });
      appendBubble("ai", reply);
      renderHistory();
    }
  } catch (err) {
    removeTyping(typingId);
    console.error("[HF API ERROR]", err);
    appendBubble("ai", "Connection error. Please check your internet and try again.");
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
  session.messages.forEach(m =>
    appendBubble(m.role === "assistant" ? "ai" : m.role, m.content)
  );
  document.querySelector(".topbar-title").textContent = session.title;
  renderHistory();
  closeSidebar();
}
