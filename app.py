import os
import requests
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Read API key — supports both HF_API_KEY and HUGGINGFACE_API_KEY
API_KEY = os.environ.get("HF_API_KEY") or os.environ.get("HUGGINGFACE_API_KEY")

# Model to use via Hugging Face Inference API
MODEL = "mistralai/Mistral-7B-Instruct-v0.3"

# Hugging Face chat completions endpoint (OpenAI-compatible format)
HF_API_URL = f"https://api-inference.huggingface.co/models/{MODEL}/v1/chat/completions"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    messages = data.get("messages", [])

    if not messages:
        return jsonify({"error": "No messages provided"}), 400

    # Build the request to Hugging Face Inference API
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": MODEL,
        "messages": messages,   # list of {role, content} dicts from frontend
        "max_tokens": 1024,
    }

    try:
        response = requests.post(HF_API_URL, headers=headers, json=payload, timeout=30)

        # Print the raw response for debugging if something goes wrong
        if not response.ok:
            print(f"[HF API ERROR] Status {response.status_code}: {response.text}")
            return jsonify({"error": f"Hugging Face API error: {response.status_code}"}), 502

        result = response.json()
        reply = result["choices"][0]["message"]["content"]
        return jsonify({"reply": reply})

    except requests.exceptions.Timeout:
        print("[HF API ERROR] Request timed out")
        return jsonify({"error": "Request timed out. Please try again."}), 504

    except Exception as e:
        print(f"[HF API ERROR] Unexpected error: {e}")
        return jsonify({"error": "An unexpected error occurred."}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
