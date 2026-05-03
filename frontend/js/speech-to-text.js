const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition)
{
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;

    function startVoiceReporting()
    {
        const micBtn = document.getElementById("mic-btn");
        const notesInput = document.getElementById("notes-input");

        recognition.start();

        recognition.onstart = () =>
        {
            micBtn.style.backgroundColor = "#FF5252";
            micBtn.style.color = "white";
            micBtn.textContent = "🛑 Listening... Speak now";
        };

        recognition.onresult = (event) =>
        {
            const transcript = event.results[0][0].transcript;
            notesInput.value = transcript;

            console.log("Speech captured: " + transcript);
        };

        recognition.onend = () =>
        {
            micBtn.style.backgroundColor = "#2a2a2a";
            micBtn.style.color = "#FFC107";
            micBtn.textContent = "🎤 Use Voice to Describe";
        };
    
        recognition.onerror = (event) =>
        {
            console.error("Speech error: " + event.error);
            micBtn.textContent = "⚠️ Mic error. Try again";
        };
    }
} else
{
    document.getElementById("mic-btn").style.display = "none";
}