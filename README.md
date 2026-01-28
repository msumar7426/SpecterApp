# SpecterApp

SpecterApp is a React Native mobile application designed for processing and extracting structured information from Urdu First Information Reports (FIRs). It interfaces with a Python FastAPI backend that leverages LlamaCloud agents for high-accuracy Urdu OCR and text analysis.

## Features

*   **Mobile Image Capture**: Select or capture images of FIR documents directly from your mobile device.
*   **AI-Powered Extraction**: Utilizes LlamaCloud agents to extract raw Urdu text and structured data (Complainant, Accused, Timestamp, etc.).
*   **Parity with Web**: Maintains full functional parity with the web dashboard pipeline, ensuring consistent results across platforms.
*   **Bilingual Display**: Renders both the original Urdu text (in Nastaliq style) and structured English fields.

## Architecture

1.  **Mobile App (React Native/Expo)**: Handles UI and image selection. Sends raw file data to the backend.
2.  **Backend (FastAPI)**: Acts as a bridge. Receives images and forwards them to the LlamaCloud agent.
3.  **LlamaCloud Agent**: Performs the heavy lifting—OCR, text extraction, and structuring of data.

## Prerequisites

*   **Node.js**: Required for the React Native frontend.
*   **Python 3.8+**: Required for the FastAPI backend.
*   **Expo Go**: Recommended for running the app on a physical device.

## Setup Instructions

### 1. Backend Setup

The backend handles the communication with LlamaCloud. You need a valid `LLAMA_CLOUD_API_KEY`.

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create and activate a virtual environment:
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows use: venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Configure Environment Variables:
    *   Ensure a `.env` file exists in the `backend` directory.
    *   It must contain your LlamaCloud key:
        ```env
        LLAMA_CLOUD_API_KEY=llx-your-key-here
        ```

### 2. Mobile App Setup

1.  Navigate to the project root:
    ```bash
    cd ..
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  **Critical Configuration**:
    *   Open `config.js` in the project root.
    *   Update `API_BASE_URL` to point to your backend's IP address.
    *   **Emulator**: Use `http://10.0.2.2:8000` (Android) or `http://localhost:8000` (iOS).
    *   **Physical Device**: Use your computer's LAN IP, e.g., `http://192.168.1.5:8000`.

## Running the Application

### Step 1: Start the Backend

Open a terminal in the `backend` folder and run:

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### Step 2: Start the Mobile App

Open a new terminal in the project root and run:

```bash
npx expo start --clear
```

- Scan the QR code with the **Expo Go** app on your phone.
- Or press `a` to run on an Android Emulator, `i` for iOS Simulator.

## Troubleshooting

*   **Network Errors**: If the app says "Network request failed," double-check your `config.js`. Your phone must be on the same Wi-Fi network as your computer, and you must use the computer's LAN IP address, not `localhost`.
*   **Extraction Failures**: Check the backend terminal logs. If LlamaCloud fails, ensure your API key is valid and you have sufficient credits.
