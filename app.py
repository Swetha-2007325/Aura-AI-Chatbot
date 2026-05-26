import os
import json
from datetime import datetime, timezone
from flask import Flask, render_template, request, jsonify
from openai import OpenAI

app = Flask(__name__)

# Replit-managed AI proxy — no personal API key needed
client = OpenAI(
    base_url=os.environ["AI_INTEGRATIONS_OPENAI_BASE_URL"],
    api_key=os.environ["AI_INTEGRATIONS_OPENAI_API_KEY"],
)

HISTORY_FILE = "chat_history.json"


def load_history():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    return []


def save_exchange(user_message, ai_response):
    history = load_history()
    history.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user": user_message,
        "ai": ai_response,
    })
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    messages = data.get("messages", [])

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    # The latest user message is the last one in the list
    user_message = messages[-1]["content"]

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=1024,
        )
        reply = response.choices[0].message.content

        # Save the exchange to the JSON history file
        save_exchange(user_message, reply)

        return jsonify({"reply": reply})

    except Exception as e:
        print(f"[AI ERROR] {e}")
        return jsonify({"error": "Could not get a response. Please try again."}), 500


@app.route("/history", methods=["GET"])
def history():
    return jsonify(load_history())


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
