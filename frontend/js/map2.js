let map, directionsService, directionsRenderer, userMarker;
let currentRoute = null;
let currentStep = 0;
let watchId = null;
let navigationActive = false;
let lastDestination = null;
let hazardMarkers = [];
let warnedRouteHazards = new Set();
let warnedNearbyHazards = new Set();
let lastDeviationAlertAt = 0;

const FALLBACK_HAZARDS = [
  { id: "demo-1", lat: 44.5650, lng: -123.2780, urgency: "high", alert_text: "Blocked ramp near MU Quad" },
  { id: "demo-2", lat: 44.5625, lng: -123.2810, urgency: "medium", alert_text: "Robot blocking path near Valley Library" },
  { id: "demo-3", lat: 44.5640, lng: -123.2760, urgency: "low", alert_text: "Uneven sidewalk near Dixon Rec" },
];

const PIN_COLORS = {
  high: "#D32F2F",
  medium: "#F57C00",
  low: "#FFC107",
  resolved: "#388E3C",
  default: "#1976D2",
};

const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#FFC107" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#000000" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0a0a" }] },
];

function initMap() {
  const osu = { lat: 44.5638, lng: -123.2794 };

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 16,
    center: osu,
    mapTypeId: "roadmap",
    disableDefaultUI: true,
    zoomControl: true,
    styles: MAP_STYLE,
  });

  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map,
    suppressMarkers: false,
    polylineOptions: {
      strokeColor: "#FFC107",
      strokeWeight: 5,
      strokeOpacity: 0.9,
    },
  });

  fetchHazards();
  setInterval(fetchHazards, 10000);
  getUserLocation();
}

function normalizeHazard(hazard, index) {
  const urgency = hazard.urgency || hazard.type || "medium";
  const alertText = hazard.alert_text || hazard.label || hazard.description || "Hazard reported ahead";

  return {
    id: hazard.id || `hazard-${index}`,
    lat: Number(hazard.lat),
    lng: Number(hazard.lng),
    urgency,
    alert_text: alertText,
    hazard_type: hazard.hazard_type || "other",
    source: hazard.source || "demo",
  };
}

async function fetchHazards() {
  try {
    const res = await fetch(`${API_BASE}/hazards`);
    if (!res.ok) throw new Error("Hazards request failed");

    const data = await res.json();
    const hazards = data
      .map(normalizeHazard)
      .filter(h => Number.isFinite(h.lat) && Number.isFinite(h.lng));

    window.hazards = hazards.length ? hazards : FALLBACK_HAZARDS;
  } catch (error) {
    console.warn("Using fallback hazards:", error);
    window.hazards = FALLBACK_HAZARDS;
  }

  placeHazardPins();

  if (currentRoute) {
    checkHazardsOnRoute();
  }
}

function placeHazardPins() {
  if (!map) return;

  hazardMarkers.forEach(marker => marker.setMap(null));
  hazardMarkers = [];

  (window.hazards || []).forEach(h => {
    const marker = new google.maps.Marker({
      position: { lat: h.lat, lng: h.lng },
      map,
      title: h.alert_text,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: PIN_COLORS[h.urgency] || PIN_COLORS.default,
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 2.5,
        scale: 10,
      },
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="background:#111;color:#FFC107;padding:6px 10px;border-radius:6px;font-size:12px;font-weight:600;">${h.alert_text}</div>`,
    });

    marker.addListener("click", () => {
      info.open(map, marker);
      speakAlert(h.alert_text + ". Proceed with caution.");
    });

    hazardMarkers.push(marker);
  });
}

function getUserLocation() {
  if (!navigator.geolocation || !map) return;

  navigator.geolocation.getCurrentPosition(
    pos => {
      const userPos = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };

      updateUserMarker(userPos);
      map.setCenter(userPos);
    },
    () => {
      console.log("Location access denied. Centering on OSU.");
    },
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0,
    }
  );
}

function updateUserMarker(userPos) {
  if (!map) return;

  if (!userMarker) {
    userMarker = new google.maps.Marker({
      position: userPos,
      map,
      title: "You are here",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: "#1976D2",
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 3,
        scale: 10,
      },
    });
    return;
  }

  userMarker.setPosition(userPos);
}

function buildDestinationQuery(destination) {
  const text = String(destination || "").trim();

  if (!text) return "";
  if (/osu|oregon state|corvallis/i.test(text)) return text;

  return `${text}, Oregon State University, Corvallis, OR`;
}

function showRoute(destinationText) {
  if (!directionsService || !directionsRenderer) {
    speakAlert("Map is still loading. Please try again.");
    return;
  }

  if (!navigator.geolocation) {
    speakAlert("Location not available on this device.");
    return;
  }

  const destination = buildDestinationQuery(destinationText || lastDestination);
  if (!destination) {
    speakAlert("Please enter a destination.");
    return;
  }

  lastDestination = destination;

  navigator.geolocation.getCurrentPosition(
    pos => {
      const origin = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };

      updateUserMarker(origin);

      directionsService.route(
        {
          origin,
          destination,
          travelMode: google.maps.TravelMode.WALKING,
        },
        (result, status) => {
          if (status === "OK") {
            directionsRenderer.setDirections(result);
            currentRoute = result;
            currentStep = 0;
            navigationActive = true;
            warnedRouteHazards.clear();

            const leg = result.routes[0].legs[0];
            const step = stripHtml(leg.steps[0].instructions);

            setDirectionText(step);
            speakAlert(`Route found. ${leg.duration.text} away. ${step}`);

            checkHazardsOnRoute();
            startRealTimeNavigation();
          } else {
            console.error("Directions failed:", status);
            speakAlert("Could not find a route. Please try another destination.");
            setDirectionText("Could not find a route.");
          }
        }
      );
    },
    error => {
      console.error("Geolocation failed:", error);
      speakAlert("Location permission is needed to start navigation.");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, "");
}

function setDirectionText(text) {
  const directionText = document.getElementById("direction-text");
  if (directionText) directionText.textContent = text;

  if (typeof lastDirection !== "undefined") {
    lastDirection = text;
  }
}

function startRealTimeNavigation() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }

  watchId = navigator.geolocation.watchPosition(
    position => updateUserPosition(position),
    error => console.error("Geolocation watch error:", error),
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    }
  );
}

function updateUserPosition(position) {
  const userPos = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };

  updateUserMarker(userPos);

  if (!navigationActive || !currentRoute) return;

  checkRouteDeviation(userPos);
  checkNearbyHazards(userPos);
  updateNavigationStep(userPos);

  map.setCenter(userPos);
}

function checkRouteDeviation(userPos) {
  if (!currentRoute || !currentRoute.routes.length) return;

  const routePath = currentRoute.routes[0].overview_path;
  const deviationThreshold = 45;
  let minDistance = Infinity;

  routePath.forEach(point => {
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(userPos.lat, userPos.lng),
      point
    );
    minDistance = Math.min(minDistance, distance);
  });

  const now = Date.now();
  if (minDistance > deviationThreshold && now - lastDeviationAlertAt > 30000) {
    lastDeviationAlertAt = now;
    speakAlert("You have moved away from the route. Recalculating.");
    showRoute(lastDestination);
  }
}

function distanceToRouteMeters(hazard, routePath) {
  let minDistance = Infinity;

  routePath.forEach(point => {
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(hazard.lat, hazard.lng),
      point
    );
    minDistance = Math.min(minDistance, distance);
  });

  return minDistance;
}

function checkHazardsOnRoute() {
  if (!currentRoute || !currentRoute.routes.length) return;

  const routePath = currentRoute.routes[0].overview_path;
  const routeThreshold = 55;

  (window.hazards || []).forEach(hazard => {
    const distance = distanceToRouteMeters(hazard, routePath);

    if (distance <= routeThreshold && !warnedRouteHazards.has(hazard.id)) {
      warnedRouteHazards.add(hazard.id);

      const text = `Hazard on route: ${hazard.alert_text}`;
      showHazardWarning(text);
    }
  });
}

function checkNearbyHazards(userPos) {
  const proximityThreshold = 80;

  (window.hazards || []).forEach(hazard => {
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(userPos.lat, userPos.lng),
      new google.maps.LatLng(hazard.lat, hazard.lng)
    );

    if (distance <= proximityThreshold && !warnedNearbyHazards.has(hazard.id)) {
      warnedNearbyHazards.add(hazard.id);

      const meters = Math.round(distance);
      showHazardWarning(`Alert: ${hazard.alert_text} in ${meters} meters. Use caution.`);
    }
  });
}

function showHazardWarning(text) {
  if (typeof showHazardBanner === "function") {
    showHazardBanner(text);
  } else {
    speakAlert(text);
  }
}

function updateNavigationStep(userPos) {
  if (!currentRoute || !currentRoute.routes[0]) return;

  const steps = currentRoute.routes[0].legs[0].steps;

  if (currentStep >= steps.length) {
    speakAlert("You have arrived at your destination.");
    stopRealTimeNavigation();
    return;
  }

  const currentStepData = steps[currentStep];
  const stepEnd = currentStepData.end_location;

  const distanceToStepEnd = google.maps.geometry.spherical.computeDistanceBetween(
    new google.maps.LatLng(userPos.lat, userPos.lng),
    new google.maps.LatLng(stepEnd.lat(), stepEnd.lng())
  );

  if (distanceToStepEnd < 30) {
    currentStep++;

    if (currentStep < steps.length) {
      const nextStep = steps[currentStep];
      const instruction = stripHtml(nextStep.instructions);
      const distance = nextStep.distance.text;

      setDirectionText(instruction);
      speakAlert(`Next: ${instruction}. Distance: ${distance}`);
    }
  }
}

function stopRealTimeNavigation() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  navigationActive = false;
}

function watchUserLocation() {
  getUserLocation();
}
