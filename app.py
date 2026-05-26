import os
from flask import Flask, render_template, request, jsonify
from openai import OpenAI

app = Flask(__name__)

# OpenAI client — key loaded from environment
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    messages = data.get("messages", [])

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=1024,
        )
        reply = response.choices[0].message.content
        return jsonify({"reply": reply})

    except Exception as e:
        print(f"[OpenAI ERROR] {e}")
        return jsonify({"error": "Could not get a response. Please try again."}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
