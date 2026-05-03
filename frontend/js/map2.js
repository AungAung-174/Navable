let map, directionsService, directionsRenderer, userMarker;
let currentRoute = null;
let currentStep = 0;
let watchId = null;
let lastHeading = null;
let navigationActive = false;

const HAZARDS = [
  { lat: 44.5650, lng: -123.2780, type: "high",     label: "Blocked ramp — MU Quad" },
  { lat: 44.5625, lng: -123.2810, type: "medium",   label: "Stuck robot — Valley Library" },
  { lat: 44.5640, lng: -123.2760, type: "resolved", label: "Resolved — Dixon Rec" },
];

const PIN_COLORS = {
  high:     "#D32F2F",
  medium:   "#F57C00",
  resolved: "#388E3C"
};

const MAP_STYLE = [
  { elementType: "geometry",            stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.fill",    stylers: [{ color: "#FFC107" }] },
  { elementType: "labels.text.stroke",  stylers: [{ color: "#000000" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
  { featureType: "poi",  elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "water",elementType: "geometry", stylers: [{ color: "#0a0a0a" }] },
];

function initMap() {
  const osu = { lat: 44.5638, lng: -123.2794 };

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 16,
    center: osu,
    mapTypeId: "roadmap",
    disableDefaultUI: true,
    zoomControl: true,
    styles: MAP_STYLE
  });

  directionsService  = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: false,
    polylineOptions: {
      strokeColor:   "#FFC107",
      strokeWeight:  5,
      strokeOpacity: 0.9
    }
  });

  placeHazardPins();
  getUserLocation();
}

function placeHazardPins() {
  HAZARDS.forEach(h => {
    const marker = new google.maps.Marker({
      position: { lat: h.lat, lng: h.lng },
      map: map,
      title: h.label,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor:   PIN_COLORS[h.type],
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 2.5,
        scale: 10
      }
    });

    const info = new google.maps.InfoWindow({
      content: `<div style="background:#111;color:#FFC107;padding:6px 10px;
                border-radius:6px;font-size:12px;font-weight:600;">${h.label}</div>`
    });

    marker.addListener("click", () => {
      info.open(map, marker);
      speakAlert(h.label + ". Proceed with caution.");
    });
  });
}

function getUserLocation() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(pos => {
    const userPos = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };

    userMarker = new google.maps.Marker({
      position: userPos,
      map: map,
      title: "You are here",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor:   "#1976D2",
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 3,
        scale: 10
      }
    });

    map.setCenter(userPos);

  }, () => {
    console.log("Location access denied — centering on OSU");
  });
}

function showRoute() {
  if (!navigator.geolocation) {
    speakAlert("Location not available on this device.");
    return;
  }

  const destination = { lat: 44.5648, lng: -123.2803 };

  navigator.geolocation.getCurrentPosition(pos => {
    const origin = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };

    directionsService.route({
      origin:      origin,
      destination: destination,
      travelMode:  google.maps.TravelMode.WALKING,
    }, (result, status) => {
      if (status === "OK") {
        directionsRenderer.setDirections(result);
        currentRoute = result;
        currentStep = 0;
        navigationActive = true;
        
        const leg = result.routes[0].legs[0];
        const step = leg.steps[0].instructions.replace(/<[^>]*>/g, "");
        document.getElementById("direction-text").textContent = step;
        speakAlert("Route found. " + leg.duration.text + " away. " + step);
        
        // Start real-time navigation tracking
        startRealTimeNavigation();
      } else {
        speakAlert("Could not find a route. Please try again.");
      }
    });
  });
}

function startRealTimeNavigation() {
  // Stop any existing watch
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }

  // Watch position continuously for real-time updates
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      updateUserPosition(position);
    },
    (error) => {
      console.error("Geolocation error:", error);
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    }
  );
}

function updateUserPosition(position) {
  if (!navigationActive || !currentRoute) return;

  const userPos = {
    lat: position.coords.latitude,
    lng: position.coords.longitude
  };

  // Update user marker
  if (userMarker) {
    userMarker.setPosition(userPos);
  }

  // Update heading if available
  if (position.coords.heading !== null && position.coords.heading !== undefined) {
    lastHeading = position.coords.heading;
  }

  // Check for route deviation
  checkRouteDeviation(userPos);

  // Check for nearby hazards
  checkNearbyHazards(userPos, position.coords.accuracy);

  // Update navigation step if user has moved far enough
  updateNavigationStep(userPos);

  // Center map on user
  map.setCenter(userPos);
}

function checkRouteDeviation(userPos) {
  if (!currentRoute || currentRoute.routes.length === 0) return;

  const routePath = currentRoute.routes[0].overview_path;
  const deviationThreshold = 30; // meters

  // Calculate distance from user to nearest point on route
  let minDistance = Infinity;
  
  routePath.forEach(point => {
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(userPos.lat, userPos.lng),
      point
    );
    minDistance = Math.min(minDistance, distance);
  });

  if (minDistance > deviationThreshold) {
    speakAlert("You have deviated from the route. Recalculating...");
    // Recalculate route from current position
    showRoute();
  }
}

function checkNearbyHazards(userPos, accuracy) {
  const proximityThreshold = 100; // meters

  HAZARDS.forEach(hazard => {
    const distance = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(userPos.lat, userPos.lng),
      new google.maps.LatLng(hazard.lat, hazard.lng)
    );

    if (distance < proximityThreshold && distance < (accuracy || 20)) {
      const meters = Math.round(distance);
      speakAlert(`Alert: ${hazard.label} in ${meters} meters ahead. Use caution.`);
    }
  });
}

function updateNavigationStep(userPos) {
  if (!currentRoute || !currentRoute.routes[0]) return;

  const legs = currentRoute.routes[0].legs;
  const steps = legs[0].steps;

  if (currentStep >= steps.length) {
    speakAlert("You have arrived at your destination.");
    navigationActive = false;
    stopRealTimeNavigation();
    return;
  }

  const currentStepData = steps[currentStep];
  const stepEnd = currentStepData.end_location;
  
  // Check if user is close to the end of current step
  const distanceToStepEnd = google.maps.geometry.spherical.computeDistanceBetween(
    new google.maps.LatLng(userPos.lat, userPos.lng),
    new google.maps.LatLng(stepEnd.lat(), stepEnd.lng())
  );

  if (distanceToStepEnd < 30) { // 30 meters
    currentStep++;
    
    if (currentStep < steps.length) {
      const nextStep = steps[currentStep];
      const instruction = nextStep.instructions.replace(/<[^>]*>/g, "");
      const distance = nextStep.distance.text;
      
      document.getElementById("nav-text").textContent = instruction;
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