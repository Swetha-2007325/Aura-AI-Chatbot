import os
import json
import uuid
from datetime import datetime, timezone
from flask import Flask, render_template, request, jsonify, session
from google import genai
import firebase_admin
from firebase_admin import credentials, firestore

app = Flask(__name__)

# Secret key for signing session cookies (stored in Replit Secrets)
app.secret_key = os.environ["SESSION_SECRET"]

# ── Google Gemini setup ──────────────────────────────────
# Use the stable v1 API so gemini-1.5-flash is available
gemini = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"],
    http_options={"api_version": "v1"},
)

# ── Firebase init ────────────────────────────────────────
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
    get_user_id()  # ensure user_id is set in the session cookie
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    user_id = get_user_id()
    data     = request.get_json()
    messages = data.get("messages", [])
    conv_id  = data.get("conv_id")   # unique ID for this conversation thread
    title    = data.get("title", "")  # first message used as conversation title

    if not messages or not conv_id:
        return jsonify({"error": "Missing messages or conv_id"}), 400

    user_message = messages[-1]["content"]

    try:
        # Convert message history to Gemini format.
        # Gemini uses "model" instead of "assistant" for AI turns.
        contents = [
            {
                "role": "user" if m["role"] == "user" else "model",
                "parts": [{"text": m["content"]}],
            }
            for m in messages
        ]

        # Call Gemini and get the reply text
        result = gemini.models.generate_content(
            model="gemini-2.0-flash",
            contents=contents,
        )
        reply = result.text

        # Save this exchange to Firestore, tagged with user + conversation
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
        print(f"[ERROR] {e}")
        return jsonify({"error": "Could not get a response. Please try again."}), 500


@app.route("/history", methods=["GET"])
def history():
    """Return this user's conversations, grouped by conv_id."""
    user_id = get_user_id()

    # Fetch all messages belonging to this user (sort in Python to avoid
    # needing a Firestore composite index on user_id + timestamp)
    docs = db.collection("chats").where("user_id", "==", user_id).stream()

    # Sort by timestamp in Python (avoids needing a composite Firestore index)
    entries = sorted(
        [doc.to_dict() for doc in docs],
        key=lambda e: e.get("timestamp") or 0,
    )

    # Group individual message pairs into conversations
    conversations = {}  # conv_id → {title, messages[]}
    for entry in entries:
        cid     = entry["conv_id"]
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
    app.run(host="0.0.0.0", port=5000, debug=True)
