const API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "")
  ? "http://localhost:5000"
  : "https://your-render-backend.onrender.com";