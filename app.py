from flask import Flask, render_template, request, jsonify
import random
import time

app = Flask(__name__)

MOCK_RESPONSES = [
    "That's a great question! I'm a demo AI assistant, so I can't actually browse the web or run code — but I'm happy to chat!",
    "Interesting! Tell me more about what you're thinking.",
    "I understand. Here's what I think about that: it really depends on the context and what you're trying to achieve.",
    "Great point! There are a few ways to approach this. First, consider the problem from a high level, then break it into smaller steps.",
    "I'm just a mock AI for now, but a real language model would give you a much more detailed answer here!",
    "That's something worth exploring. Have you thought about looking at it from a different angle?",
    "Sure! Let me think about that... Based on what you've said, I'd suggest starting with the basics and building up from there.",
    "Absolutely! This is a common question. The short answer is: it depends. The long answer involves a few nuances worth discussing.",
    "Thanks for sharing that. Here's my take: focus on what matters most to you and work backwards from your goal.",
    "Good thinking! I'd approach this step by step to keep things manageable.",
]

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    user_message = data.get("message", "").strip()

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    time.sleep(0.8)

    response = random.choice(MOCK_RESPONSES)
    return jsonify({"reply": response})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
