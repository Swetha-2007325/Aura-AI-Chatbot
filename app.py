import os
from flask import Flask, render_template, request, jsonify
from huggingface_hub import InferenceClient

app = Flask(__name__)
client = InferenceClient(
    provider="hf-inference",
    api_key=os.environ["HUGGINGFACE_API_KEY"],
)

MODEL = "mistralai/Mistral-7B-Instruct-v0.3"

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    messages = data.get("messages", [])

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        max_tokens=1024,
    )

    reply = response.choices[0].message.content
    return jsonify({"reply": reply})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
