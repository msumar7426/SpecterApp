// API configuration for SpecterApp
// IMPORTANT: This mirrors the web app's use of `/api/upload`,
// but keeps all AI keys strictly on the FastAPI backend.
//
// Set API_BASE_URL to your backend host, e.g.:
//  - http://localhost:8000           (emulator / local testing)
//  - http://YOUR-LAN-IP:8000        (physical device on same Wi‑Fi)
//
// The mobile app will POST to `${API_BASE_URL}/api/upload`
// with multipart/form-data, exactly like the website.

export const API_BASE_URL = "http://192.168.100.35:8000";

export const UPLOAD_ENDPOINT = `${API_BASE_URL}/api/upload`;

