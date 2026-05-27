import os
import json
import uuid
from datetime import datetime, timezone
from flask import Flask, render_template, request, jsonify, session
from groq import Groq
import firebase_admin
from firebase_admin import credentials, firestore

app = Flask(__name__)

# Secret key for signing session cookies (stored in Replit Secrets)
app.secret_key = os.environ["SESSION_SECRET"]

# ── Groq client setup ────────────────────────────────────
# Groq uses an OpenAI-compatible API, so the SDK works the same way.
# The API key is loaded from the GROQ_API_KEY environment secret.
groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])

# The model we want to use — fast and capable open-source LLM via Groq
GROQ_MODEL = "llama-3.3-70b-versatile"

# ── Firebase init ────────────────────────────────────────
# Load Firestore credentials from the secret and connect to the database
service_account_info = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"])
cred = credentials.Certificate(service_account_info)
firebase_admin.initialize_app(cred)
db = firestore.client()


def get_user_id():
    """Return this browser's persistent user ID, creating one if first visit."""
    if "user_id" not in session:
        session["user_id"] = str(uuid.uuid4())
    return session["user_id"]


@app.route("/")
def index():
    get_user_id()  # ensure user_id cookie is set on first visit
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    user_id = get_user_id()
    data    = request.get_json()

    # Pull values from the request body
    messages = data.get("messages", [])  # full conversation history
    conv_id  = data.get("conv_id")       # unique ID for this conversation thread
    title    = data.get("title", "")     # first message, used as sidebar label

    # Basic validation — both fields are required
    if not messages or not conv_id:
        return jsonify({"error": "Missing messages or conv_id"}), 400

    user_message = messages[-1]["content"]

    try:
        # ── Call the Groq API ────────────────────────────
        # System prompt keeps Aura concise — added fresh each call, not stored.
        system_prompt = {
            "role": "system",
            "content": (
                "You are Aura AI, a concise and professional assistant. "
                "Keep responses short, clear, modern, and under 80 words "
                "unless the user explicitly asks for a detailed explanation."
            ),
        }

        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[system_prompt] + messages,
            max_tokens=120,   # cap output for clean, readable replies
            temperature=0.7,  # balanced — not too random, not too dry
            timeout=30,       # fail fast if Groq doesn't respond in time
        )

        reply = response.choices[0].message.content

        # ── Save the exchange to Firestore ───────────────
        # Each document stores one user↔AI exchange, tagged with
        # user_id and conv_id so we can load history per user/conversation.
        db.collection("chats").add({
            "user_id":   user_id,
            "conv_id":   conv_id,
            "title":     title or user_message[:60],
            "user":      user_message,
            "ai":        reply,
            "timestamp": datetime.now(timezone.utc),
        })

        return jsonify({"reply": reply})

    except Exception as e:
        # Log the real error server-side, return a clean message to the client
        print(f"[ERROR] Groq request failed: {e}")
        return jsonify({"error": "Could not get a response. Please try again."}), 500


@app.route("/history", methods=["GET"])
def history():
    """Return this user's conversations, grouped by conv_id."""
    user_id = get_user_id()

    # Fetch all messages for this user.
    # We sort in Python to avoid needing a Firestore composite index.
    docs = db.collection("chats").where("user_id", "==", user_id).stream()

    entries = sorted(
        [doc.to_dict() for doc in docs],
        key=lambda e: e.get("timestamp") or 0,
    )

    # Group individual message pairs into conversation objects
    conversations = {}  # conv_id → {title, messages[]}
    for entry in entries:
        cid = entry["conv_id"]
        if cid not in conversations:
            conversations[cid] = {
                "conv_id":  cid,
                "title":    entry.get("title", entry["user"][:60]),
                "messages": [],
            }
        conversations[cid]["messages"].append(
            {"role": "user",      "content": entry["user"]}
        )
        conversations[cid]["messages"].append(
            {"role": "assistant", "content": entry["ai"]}
        )

    # Return newest conversations first
    result = list(reversed(list(conversations.values())))
    return jsonify(result)


if __name__ == "__main__":
    # debug=True is fine locally; on Render use gunicorn instead
    app.run(host="0.0.0.0", port=5000, debug=True)
