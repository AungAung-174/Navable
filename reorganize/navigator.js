let lastDirection = "Waiting for route...";
let voiceEnabled = true;
let currentVolume = 1.0;
let selectedDestination = null;
let recognition = null;

// Initialization logic
window.addEventListener("load", () => {
    const contrast = localStorage.getItem("highContrast") === "true";
    const largeText = localStorage.getItem("largeText") === "true";
    const frequency = localStorage.getItem("alertFrequency") || "high";
    voiceEnabled = localStorage.getItem("voiceAlerts") !== "false";

    if (contrast) applyHighContrast();
    if (largeText) applyLargeText();
    
    setFrequency(frequency);
    loadGoogleMaps();
    watchUserLocation();
});

async function loadGoogleMaps() {
    const res = await fetch(`${API_BASE}/config/maps`);
    const config = await res.json();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${config.googleMapsApiKey}&libraries=geometry&callback=initMap`;
    script.async = true;
    document.head.appendChild(script);
}

function setFrequency(level) {
    currentVolume = level;
    localStorage.setItem("alertFrequency", level);
    ["low", "medium", "high"].forEach(l => {
        document.getElementById("vol-" + l).classList.toggle("active", l === level);
    });
    if (voiceEnabled) speakAlert(`Alert level set to ${level}`);
}

function onSearchInput(value) {
    const results = document.getElementById("search-results");
    if (value.length < 2) {
        results.style.display = "none";
        document.getElementById("go-btn").disabled = true;
        return;
    }
    // Mock results logic...
    results.style.display = "block";
    results.innerHTML = `<div class="search-result-item" onclick="selectDestination('${value}')">${value} near OSU</div>`;
}

function selectDestination(place) {
    selectedDestination = place;
    document.getElementById("destination-input").value = place;
    document.getElementById("search-results").style.display = "none";
    document.getElementById("go-btn").disabled = false;
    if (voiceEnabled) speakAlert("Destination set to " + place);
}

function startNavigation() {
    if (!selectedDestination) return;
    if (voiceEnabled) speakAlert("Starting navigation to " + selectedDestination);
    setDirection("Head toward " + selectedDestination, "↑");
}

function setDirection(text, arrow = "↓") {
    lastDirection = text;
    document.getElementById("direction-text").textContent = text;
    document.getElementById("direction-arrow").textContent = arrow;
    if (voiceEnabled) speakDirection(text);
}

// Utility for highlighting buttons when voice is active
function highlightBtn(btn, text) {
    const words = text.split(" ").length;
    const duration = words * 450;
    btn.classList.add("speaking");
    setTimeout(() => btn.classList.remove("speaking"), duration);
}

function repeatDirection() {
    const btn = document.querySelector('[aria-label="Repeat directions"]');
    highlightBtn(btn, lastDirection);
    speakAlert(lastDirection);
}

function callForHelp() {
    const text = "Calling for help. Please stay where you are.";
    const btn = document.querySelector('[aria-label="Call for help"]');
    highlightBtn(btn, text);
    speakAlert(text);
}

// Contrast and Accessibility Helpers
function applyHighContrast() {
    document.body.classList.add("high-contrast-mode");
    // (You can move the specific color overrides to a CSS class .high-contrast-mode)
}