const API = "http://localhost:5000";

const URGENCY_COLORS =
{
    high: "#A32D2D",
    medium: "#EF9F27",
    low: "#97C459"
};

let map;
window.hazards = [];

function initMap()
{
    const osu = { lat: 44.5638, lng: -123.2797 };
    map = new google.maps.Map(document.getElementById("map"),
    {
        zoom: 16,
        center: osu,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: true,
    });
}

async function loadHazards()
{
    try
    {
        const res = await fetch(`${API}/hazards`);
        const data = await res.json();
        window.hazards = data;
    

        data.forEach(h => 
        {
            const marker = new google.maps.Marker(
            {
                position: {lat: h.lat, lng: h.lng },
                map: map,
                icon: 
                {
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
    } catch (err)
    {
    console.error("Cound not load hazards:", err)
    }
}