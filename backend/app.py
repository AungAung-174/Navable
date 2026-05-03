import warnings
warnings.filterwarnings("ignore", category=FutureWarning)
import os
import json
import base64
import requests
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
model = genai.GenerativeModel("gemini-2.5-flash")

# Flask
app = Flask(__name__)
CORS(app, origins=["http://localhost:5500", "http://127.0.0.1:5500",
                   "http://localhost:3000", "http://127.0.0.1:3000",
                   "null"])  # "null" covers opening HTML files directly


# ---------- Gemini hazard analysis ----------
def analyze_hazard(photo_bytes, description=""):
    """Send photo + description to Gemini, get back hazard JSON."""

    prompt = f"""
You are an accessibility hazard analyzer for wheelchair users and visually impaired pedestrians.

Analyze the photo and the user description. Be CONSERVATIVE — only flag actual hazards.

Return ONLY valid JSON. Do not include markdown, explanation, or code fences.

Use this exact JSON format:
{{
  "hazard_type": "blocked_ramp|robot|construction|broken_sidewalk|vehicle|stairs|crowded_path|other|none",
  "urgency": "high|medium|low",
  "alert_text": "one short voice alert under 15 words"
}}

CRITICAL RULES:
- DEFAULT to hazard_type "none" and urgency "low" unless you see a CLEAR accessibility blocker.
- Normal pedestrian activity, parked cars in parking spots, buses at stops, and people walking are NOT hazards.
- A vehicle is only a hazard if it is on a sidewalk, blocking a curb ramp, or actively blocking the only accessible path.
- A crosswalk with a vehicle stopped at it (waiting for pedestrians, at a stop) is NORMAL, not a hazard.
- Construction is only "high" if it blocks the sidewalk completely with no clear alternative.
- Cracked pavement is "low" unless severe enough to flip a wheelchair.

Urgency definitions:
- "high": fully blocks wheelchair access OR forces a wheelchair user into vehicle traffic
- "medium": makes travel meaningfully harder but a workaround exists
- "low": minor issue, awareness only
- For hazard_type "none", always use urgency "low"

The alert_text should be specific to what is shown. Avoid generic warnings.

User description (use this to disambiguate):
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


# ---------- Waze hazard fetch ----------
def get_waze_hazards():
    """Fetch road hazards from Waze for the OSU campus area."""
    try:
        url = "https://www.waze.com/row-rtserver/web/TGeoRSS"
        params = {
            "bottom": 44.555,
            "top":    44.572,
            "left":  -123.290,
            "right": -123.268,
            "ma": 200,
            "mj": 200,
            "mu": 200,
        }
        r = requests.get(url, params=params, timeout=5)
        data = r.json()

        alerts = []
        for alert in data.get("alerts", []):
            loc = alert.get("location", {})
            lat = loc.get("y")
            lng = loc.get("x")
            if lat is None or lng is None:
                continue

            alerts.append({
                "id":          alert.get("uuid", "waze-unknown"),
                "lat":         lat,
                "lng":         lng,
                "hazard_type": "construction",
                "urgency":     "medium",
                "alert_text":  alert.get("reportDescription", "Road hazard ahead. Proceed with caution."),
                "status":      "active",
                "source":      "waze",
            })

        return alerts

    except Exception as e:
        print(f"Waze fetch failed (non-fatal): {e}")
        return []  # fail silently — never break the app over Waze


# ---------- Routes ----------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "clearpath-backend"})


@app.route("/report", methods=["POST"])
def submit_report():
    data  = request.form
    photo = request.files.get("photo")

    try:
        lat = float(data.get("lat"))
        lng = float(data.get("lng"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "lat/lng required"}), 400

    manual_type = data.get("hazard_type", "other")
    description = data.get("description", "")

    # Gemini analysis (if photo provided)
    if photo:
        try:
            result = analyze_hazard(photo.read(), description)
        except Exception as e:
            print(f"Gemini error: {e}")
            result = {
                "hazard_type": manual_type,
                "urgency":     "medium",
                "alert_text":  f"{manual_type.replace('_', ' ')} reported at this location",
            }
    else:
        result = {
            "hazard_type": manual_type,
            "urgency":     "medium",
            "alert_text":  f"{manual_type.replace('_', ' ')} reported at this location",
        }

    # Write to Firebase
    doc_ref = db.collection("reports").add({
        "lat":         lat,
        "lng":         lng,
        "hazard_type": result["hazard_type"],
        "urgency":     result["urgency"],
        "alert_text":  result["alert_text"],
        "description": description,
        "status":      "active",
        "timestamp":   firestore.SERVER_TIMESTAMP,
    })

    # Count nearby active reports for confirmed.html impact display
    nearby_docs  = db.collection("reports").where("status", "==", "active").stream()
    nearby_count = sum(1 for _ in nearby_docs)

    return jsonify({
        "success":      True,
        "id":           doc_ref[1].id,
        "nearby_count": nearby_count,
        **result
    })


@app.route("/hazards", methods=["GET"])
def get_hazards():
    # Firebase reports
    docs    = db.collection("reports").where("status", "==", "active").stream()
    hazards = []
    for d in docs:
        item = d.to_dict()
        item["id"] = d.id
        # Firestore timestamp isn't JSON-serializable
        if "timestamp" in item and item["timestamp"] is not None:
            item["timestamp"] = item["timestamp"].isoformat()
        item["source"] = "user"
        hazards.append(item)

    # Merge Waze road hazards
    hazards += get_waze_hazards()

    return jsonify(hazards)


@app.route("/resolve/<report_id>", methods=["POST"])
def resolve_report(report_id):
    """Mark a report as resolved so it disappears from the map."""
    try:
        db.collection("reports").document(report_id).update({"status": "resolved"})
        return jsonify({"success": True, "id": report_id})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)

@app.route("/config/maps", methods=["GET"])
def maps_config():
    return jsonify({
        "googleMapsApiKey": os.getenv("GOOGLE_MAPS_API_KEY")
    })