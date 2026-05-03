import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
import os
import json
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials, firestore
import google.generativeai as genai

# ---------- Setup ----------
load_dotenv()

# Firebase
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-1.5-flash-lite")

# Flask
app = Flask(__name__)
CORS(app)  # let the frontend (different port) call us


# ---------- Gemini hazard analysis ----------
def analyze_hazard(photo_bytes, description=""):
    """Send photo + description to Gemini, get back hazard JSON."""

    prompt = f"""
You are an accessibility hazard analyzer for wheelchair users and visually impaired pedestrians.

Analyze the photo and the user description. Identify whether there is an accessibility hazard.

Return ONLY valid JSON. Do not include markdown, explanation, or code fences.

Use this exact JSON format:
{{
  "hazard_type": "blocked_ramp|robot|construction|broken_sidewalk|vehicle|stairs|crowded_path|other|none",
  "urgency": "high|medium|low",
  "alert_text": "one short voice alert under 15 words"
}}

Rules:
- Use "high" if the hazard blocks wheelchair access, blocks a curb ramp, creates a fall risk, or forces a person into the road.
- Use "medium" if the hazard makes travel harder but does not fully block the path.
- Use "low" if it is minor or only requires awareness.
- Use "none" if there is no clear accessibility hazard.
- The alert_text should be short, clear, and useful for voice navigation.
- Do not invent exact distance unless the description gives one.
- Do not mention uncertainty in the alert_text.
- If the photo is unclear, use the description to decide.
- If both photo and description are unclear, return hazard_type "other" and urgency "low".

User description:
{description}
"""

    img = {
        "mime_type": "image/jpeg",
        "data": base64.b64encode(photo_bytes).decode(),
    }
    response = model.generate_content([prompt, img])
    text = response.text.strip()

    # Gemini sometimes wraps JSON in ```json ... ``` — strip it
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    return json.loads(text)


# ---------- Routes ----------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "clearpath-backend"})


@app.route("/report", methods=["POST"])
def submit_report():
    data = request.form
    photo = request.files.get("photo")

    try:
        lat = float(data.get("lat"))
        lng = float(data.get("lng"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "lat/lng required"}), 400

    manual_type = data.get("hazard_type", "other")
    description = data.get("description", "")

    if photo:
        try:
            result = analyze_hazard(photo.read(), description)
        except Exception as e:
            print(f"Gemini error: {e}")
            # Fall back to manual data so report still goes through
            result = {
                "hazard_type": manual_type,
                "urgency": "medium",
                "alert_text": f"{manual_type.replace('_', ' ')} reported at this location",
            }
    else:
        result = {
            "hazard_type": manual_type,
            "urgency": "medium",
            "alert_text": f"{manual_type.replace('_', ' ')} reported at this location",
        }

    doc_ref = db.collection("reports").add({
        "lat": lat,
        "lng": lng,
        "hazard_type": result["hazard_type"],
        "urgency": result["urgency"],
        "alert_text": result["alert_text"],
        "description": description,
        "status": "active",
        "timestamp": firestore.SERVER_TIMESTAMP,
    })

    return jsonify({"success": True, "id": doc_ref[1].id, **result})


@app.route("/hazards", methods=["GET"])
def get_hazards():
    docs = db.collection("reports").where("status", "==", "active").stream()
    hazards = []
    for d in docs:
        item = d.to_dict()
        item["id"] = d.id
        # Firestore timestamp isn't JSON-serializable; drop or stringify
        if "timestamp" in item and item["timestamp"] is not None:
            item["timestamp"] = item["timestamp"].isoformat()
        hazards.append(item)
    return jsonify(hazards)


if __name__ == "__main__":
    app.run(debug=True, port=5000)