# Navable

> Crowdsourced accessible navigation for wheelchair users and visually impaired pedestrians.
> Built at BeaverHacks 2026 · Social Impact Track · Oregon State University

Navable is a hazard reporting and navigation web app that crowdsources ADA-specific obstacles — blocked ramps, stuck delivery robots, broken sidewalks, construction — and surfaces them to nearby users with automatic voice alerts before they reach the obstacle. Google Maps doesn't have this data. Waze doesn't have this data. Our community layer fills the gap.

## How It Works

1. **Report** — Any user reports a hazard in under 10 seconds. Photo optional.
2. **AI Triage** — Google Gemini Vision analyzes the photo and returns hazard type, urgency, and a voice alert string.
3. **Live Map** — Firebase Firestore syncs the report to every user's map in real time.
4. **Voice Alert** — Navigator Mode reads the nearest hazard aloud as the user walks toward it.
5. **Reroute** — Waze API data is merged in as a background layer; the app warns when a hazard is on the user's planned route.

## Team & Contributions

| Member | Role | Contributions |
|---|---|---|
| **Aung Aung Myint Myat** | Backend Developer | Flask REST API, Google Gemini Vision integration, Firebase Firestore schema and sync, Waze API integration, Render deployment, environment-based credential management |
| **Tisya Tomar** | Frontend Developer | HTML/CSS/JS UI, Google Maps integration, route generation, hazard pin rendering, report form |
| **Taichi Yoshikawa** | Accessibility & Voice | Web Speech API voice alerts, proximity detection, screen reader support, settings + accessibility presets |
| **Zakia Yesmin** | Product & UX | Screen designs, Gemini prompt design, hazard taxonomy, pitch deck, demo script |

## Tech Stack

**Backend:** Python · Flask · Firebase Admin SDK · Google Generative AI SDK (`gemini-2.5-flash`) · Render
**Frontend:** HTML · CSS · JavaScript · Google Maps JS SDK · Web Speech API
**Data Sources:** User-submitted reports (Firestore) · Waze live road hazards · Google Maps Directions

## Backend Architecture

The Flask API ([`backend/app.py`](backend/app.py)) exposes:

- `POST /report` — Accepts hazard photo + GPS + description. Sends photo to Gemini Vision with a structured prompt that returns JSON with `hazard_type`, `urgency`, and `alert_text`. Writes result to Firestore. Falls back to user-selected hazard type if Gemini fails.
- `GET /hazards` — Returns all active reports merged with live Waze road hazards in the OSU campus bounding box.
- `POST /resolve/<id>` — Marks a hazard as resolved.
- `GET /config/maps` — Serves Google Maps API key to the frontend (keeps it out of the HTML).
- `GET /health` — Service health check.

The Gemini prompt is intentionally conservative — false positives in an accessibility app erode user trust, so the model defaults to `hazard_type: "none"` unless there's a clear blocker.

## Getting Started

### Backend

```bash
cd backend
pip install -r requirements.txt

# Create .env with:
# GEMINI_API_KEY=your_key
# GOOGLE_MAPS_API_KEY=your_key
# FIREBASE_CREDENTIALS_JSON=<paste service account JSON> (or use serviceAccountKey.json file)

python app.py
```

Backend runs at `http://localhost:5000`.

### Frontend

Open `frontend/home.html` in a browser, or serve with any static file server:

```bash
cd frontend
python -m http.server 8000
```

The frontend auto-detects whether it's running locally or in production and points to the right backend (see `js/config.js`).

## Deployment

Backend is deployed on Render at `https://clearpath-aaii.onrender.com`. Environment variables (Gemini key, Firebase credentials, Maps key) are managed through the Render dashboard — never committed to the repo.

## What's Next

- User testing with wheelchair users and blind/visually impaired students at OSU
- Native mobile app (background GPS, offline cache)
- Community verification system for reported hazards
- Face blurring for privacy on uploaded photos
- Operator notification pipeline (e.g., for blocked Starship robots)

---

*Built in 24 hours · BeaverHacks 2026*
