const PRESETS =
{
    wheelchair:
    {
        voiceAlerts: false,
        alertFrequency: "medium",
        speechRate: "normal",
        alertDistance: 300,
        autoReroute: true,
        largeText: false,
        highContrast: false
    },

    vi:
    {
        voiceAlerts: true,
        alertFrequency: "medium",
        speechRate: "slow",
        alertDistance: 500,
        autoReroute: true,
        largeText: true,
        highContrast: true
    },

    reporter:
    {
        voiceAlerts: false,
        alertFrequency: "medium",
        speechRate: "normal", 
        alertDistance: 100,
        autoReroute: false,
        largeText: false,
        highContrast: false
    }
};

function applyPreset(mode)
{
    const settings = PRESETS[mode];

    localStorage.setItem("currentMode", mode);

    if (localStorage.getItem("voiceAlerts") === null)
    {
        localStorage.setItem("voiceAlerts", settings.voiceAlerts);
    }

    if (localStorage.getItem("alertFrequency") === null)
    {
        localStorage.setItem("alertFrequency", settings.alertFrequency);
    }

    window.location.href = "navigator.html";
}