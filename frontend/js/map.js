/*

const API = "http://localhost:5000";

const URGENCY_COLORS = {
    high: "#A32D2D",
    medium: "#EF9F27",
    low: "#97C459"
};

let map;
let directionsService;
let directionsRenderer;

window.hazards = [];

function initMap() {
    const osu = { lat: 44.5638, lng: -123.2797 };

    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 16,
        center: osu,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: true,
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: false,
    });

    loadHazards();

    // Temporary test route
    routeFromAToB(
        { lat: 44.5638, lng: -123.2797 },
        { lat: 44.5656, lng: -123.2766 }
    );
}

window.initMap = initMap;

function routeFromAToB(start, end) {
    directionsService.route(
        {
            origin: start,
            destination: end,
            travelMode: google.maps.TravelMode.WALKING,
        },
        (result, status) => {
            if (status === "OK") {
                directionsRenderer.setDirections(result);

                const step = result.routes[0].legs[0].steps[0];
                setDirection(stripHtml(step.instructions), "↓");
            } else {
                console.error("Directions request failed:", status);
                setDirection("Could not calculate route", "⚠️");
            }
        }
    );
}

function stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
}

async function loadHazards() {
    try {
        const res = await fetch(`${API}/hazards`);
        const data = await res.json();
        window.hazards = data;

        data.forEach(h => {
            const marker = new google.maps.Marker({
                position: { lat: h.lat, lng: h.lng },
                map: map,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: URGENCY_COLORS[h.urgency] || "#888",
                    fillOpacity: 1,
                    strokeColor: "#fff",
                    strokeWeight: 2,
                    scale: 10,
                },
            });

            marker.addListener("click", () => announceHazard(h));
        });
    } catch (err) {
        console.error("Could not load hazards:", err);
    }
}
*/