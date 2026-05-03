// ============================================================
// voice.js  —  ClearPath  |  3rd coder's main file
// Handles: voice alerts, proximity detection, distance calc
// ============================================================

// ----------------------------------------------------------
// 1. ALERT SCRIPTS
//    These are the sentences the app reads aloud.
//    Gemini returns a hazard_type string → we look it up here.
// ----------------------------------------------------------
const ALERTS = {
  blocked_ramp:    "Blocked wheelchair ramp ahead. Consider an alternate route.",
  robot:           "Delivery robot blocking the path ahead. Allow extra space.",
  construction:    "Construction zone ahead. Use an alternate route.",
  broken_sidewalk: "Cracked pavement ahead. Keep to the left side.",
  vehicle:         "Vehicle blocking the sidewalk ahead. Proceed with caution.",
  other:           "Hazard reported ahead. Proceed carefully.",
};

// ----------------------------------------------------------
// 2. SPEAK  —  the core function
//    Takes any text string and reads it aloud.
//    cancel() first so two alerts don't overlap.
// ----------------------------------------------------------
function speakAlert(text) {
  if (!window.speechSynthesis) return; // browser doesn't support it → do nothing

  window.speechSynthesis.cancel(); // stop anything currently playing

  const msg = new SpeechSynthesisUtterance(text);
  msg.rate   = 0.9;  // slightly slower than default — easier to understand
  msg.pitch  = 1.0;
  msg.volume = 1.0;

  window.speechSynthesis.speak(msg);
}

// ----------------------------------------------------------
// 3. ANNOUNCE HAZARD
//    Called when a new pin appears or user taps a pin.
//    Updates the screen-reader live region AND speaks aloud.
// ----------------------------------------------------------
function announceHazard(hazard) {
  const text = hazard.alert_text || ALERTS[hazard.hazard_type] || ALERTS.other;

  // Update the invisible <div> that screen readers watch
  const liveRegion = document.getElementById("hazard-announcement");
  if (liveRegion) liveRegion.textContent = text;

  speakAlert(text);
}

// ----------------------------------------------------------
// 4. DISTANCE CALCULATOR
//    Returns distance in FEET between two GPS coordinates.
//    Uses the Haversine formula (curved earth math).
// ----------------------------------------------------------
function getDistanceFt(lat1, lng1, lat2, lng2) {
  const R       = 20902464; // Earth radius in feet
  const dLat    = (lat2 - lat1) * Math.PI / 180;
  const dLng    = (lng2 - lng1) * Math.PI / 180;
  const a       = Math.sin(dLat / 2) ** 2
                + Math.cos(lat1 * Math.PI / 180)
                * Math.cos(lat2 * Math.PI / 180)
                * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ----------------------------------------------------------
// 5. PROXIMITY WATCHER
//    Runs in the background while the user navigates.
//    Every time GPS updates, checks all active hazards.
//    If one is within 300ft and hasn't been alerted yet → speak.
//
//    "hazards" is the live array from map.js (Firebase data)
// ----------------------------------------------------------
function watchUserLocation() {
  if (!navigator.geolocation) return; // device has no GPS

  navigator.geolocation.watchPosition(
    (pos) => {
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;
      checkNearbyHazards(userLat, userLng);
    },
    (err) => console.warn("GPS error:", err),
    { enableHighAccuracy: true }
  );
}

function checkNearbyHazards(userLat, userLng) {
  if (!window.hazards) return; // hazards not loaded yet

  window.hazards.forEach((h) => {
    const dist = getDistanceFt(userLat, userLng, h.lat, h.lng);

    if (dist < 300 && !h.alerted) {
      const text = (h.alert_text || ALERTS[h.hazard_type] || ALERTS.other)
                 + " In " + Math.round(dist) + " feet.";
      speakAlert(text);
      h.alerted = true; // don't repeat the same hazard
    }
  });
}

// ----------------------------------------------------------
// 6. TURN-BY-TURN VOICE
//    Called by the navigation logic when a new direction step
//    is ready. Reads it aloud + checks for hazards on the route.
// ----------------------------------------------------------
function speakDirection(stepText) {
  speakAlert(stepText);
}

// ----------------------------------------------------------
// 7. EXPORT  —  makes these functions available to other files
// ----------------------------------------------------------
window.speakAlert      = speakAlert;
window.announceHazard  = announceHazard;
window.watchUserLocation = watchUserLocation;
window.speakDirection  = speakDirection;
window.getDistanceFt   = getDistanceFt;
