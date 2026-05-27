const messagesEl  = document.getElementById("messages");
const inputEl     = document.getElementById("userInput");
const sendBtn     = document.getElementById("sendBtn");
const sidebar     = document.getElementById("sidebar");
const overlay     = document.getElementById("overlay");
const menuBtn     = document.getElementById("menuBtn");
const newChatBtn  = document.getElementById("newChatBtn");
const historyList = document.getElementById("historyList");
const topbarTitle = document.getElementById("topbarTitle");

// In-memory sessions: [{conv_id, title, messages:[]}]
// Seeded from the server on page load, then updated as the user chats.
let chatSessions = [];
let currentConvId = null;  // active conversation ID

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

function showWelcome() {
  messagesEl.innerHTML = `
    <div class="welcome">
      <div class="welcome-glow"></div>
      <div class="welcome-orb">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/>
          <path d="M12 8v4l3 3"/>
        </svg>
      </div>
      <h1>Good to see you.</h1>
      <p>Ask me anything — I think clearly, respond fast,<br>and remember our conversation.</p>
      <div class="welcome-chips">
        <button class="chip" data-prompt="Explain quantum computing simply">Explain quantum computing</button>
        <button class="chip" data-prompt="Write a short poem about the ocean">Write me a poem</button>
        <button class="chip" data-prompt="Give me 5 productivity tips">Productivity tips</button>
      </div>
    </div>`;

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

// ── Send on Enter (Shift+Enter = newline) ───────────────
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

  // Clear welcome screen on first message
  if (messagesEl.querySelector(".welcome")) {
    messagesEl.innerHTML = "";
  }

  // Start a new conversation if none is active
  if (!currentConvId) {
    currentConvId = crypto.randomUUID();  // unique ID for this thread
    chatSessions.unshift({
      conv_id:  currentConvId,
      title:    text.slice(0, 42),
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
    appendBubble("ai", "Connection error. Please try again.");
  }

  updateSendBtn();
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
      // Populate chatSessions with server data (newest first)
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
