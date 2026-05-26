import os
import json
from datetime import datetime, timezone
from flask import Flask, render_template, request, jsonify
from openai import OpenAI
import firebase_admin
from firebase_admin import credentials, firestore

app = Flask(__name__)

# ── Replit-managed AI proxy ──────────────────────────────
client = OpenAI(
    base_url=os.environ["AI_INTEGRATIONS_OPENAI_BASE_URL"],
    api_key=os.environ["AI_INTEGRATIONS_OPENAI_API_KEY"],
)

# ── Firebase init ────────────────────────────────────────
# Parse the service account JSON stored in the secret
service_account_info = json.loads(os.environ["FIREBASE_SERVICE_ACCOUNT_JSON"])
cred = credentials.Certificate(service_account_info)
firebase_admin.initialize_app(cred)
db = firestore.client()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    messages = data.get("messages", [])

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    user_message = messages[-1]["content"]

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=1024,
        )
        reply = response.choices[0].message.content

        # Save the exchange to Firestore "chats" collection
        db.collection("chats").add({
            "user": user_message,
            "ai": reply,
            "timestamp": datetime.now(timezone.utc),
        })

        return jsonify({"reply": reply})

    except Exception as e:
        print(f"[ERROR] {e}")
        return jsonify({"error": "Could not get a response. Please try again."}), 500


@app.route("/history", methods=["GET"])
def history():
    # Return all chats sorted by timestamp
    docs = db.collection("chats").order_by("timestamp").stream()
    result = []
    for doc in docs:
        entry = doc.to_dict()
        # Convert Firestore timestamp to ISO string for JSON serialisation
        entry["timestamp"] = entry["timestamp"].isoformat()
        result.append(entry)
    return jsonify(result)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
