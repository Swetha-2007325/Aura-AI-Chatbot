import os
from flask import Flask, render_template

app = Flask(__name__)

# Read the Hugging Face API key from environment
HF_API_KEY = os.environ.get("HF_API_KEY") or os.environ.get("HUGGINGFACE_API_KEY", "")

@app.route("/")
def index():
    # Pass the key to the template so the browser can call HF directly
    return render_template("index.html", hf_api_key=HF_API_KEY)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
