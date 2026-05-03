const PRESETS =
{
    wheelchair:
    {
        voiceAlerts: true,
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
        alertFrequency: "high",
        speechRate: "slow",
        alertDistance: 500,
        autoReroute: true,
        largeText: true,
        highContrast: true
    },

    reporter:
    {
        voiceAlerts: false,
        alertFrequency: "low",
        speechRate: "normal", 
        alertDistance: 100,
        autoReroute: false,
        largeText: false,
        highContrast: false
    }
};

function applyPreset(mode)
{
    const p = PRESETS[mode];

    localStorage.setItem("disabilityMode", mode);

    Object.keys(p).forEach(key =>
    {
        localStorage.setItem(key, p[key]);
    });

    window.location.href = "navigator.html";
}