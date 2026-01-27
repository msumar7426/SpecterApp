## Website vs Mobile Pipeline - Parity Summary

This document explains how the SpecterApp mobile client mirrors the existing Urdu FIR extraction website.

### 1. End-to-End Pipelines

#### Website

- User selects or drops a file in `FileUpload.jsx`.
- Browser creates `FormData` and appends the file as `file`.
- `axios.post("/api/upload", formData, { headers: { "Content-Type": "multipart/form-data" } })` sends a multipart request.
- Vite proxy forwards `/api` to FastAPI backend at `http://localhost:8000`.
- FastAPI `/api/upload`:
  - Reads `UploadFile` bytes.
  - Saves to a temp file under `backend/temp_uploads`.
  - Calls `LlamaExtract` agent `FIR_TextExtraction` **once** via `agent.extract(abs_path)`.
  - Returns JSON containing `raw_urdu_text`, `corrected_urdu_text`, `fir_structured_data`, and metadata.
- Frontend maps response to a chat object in `createNewChat` and renders it via `MessageList` + `FIRDisplay`.

#### Mobile (SpecterApp)

- User taps **Select FIR Image** in `App.js`.
- Expo `ImagePicker` returns `{ uri, fileName, mimeType }`.
- React Native creates `FormData` and appends the file as:
  - `formData.append("file", { uri, name, type })`.
- `fetch(UPLOAD_ENDPOINT, { method: "POST", body: formData })` sends a multipart request to:
  - `UPLOAD_ENDPOINT = API_BASE_URL + "/api/upload"` from `config.js`.
- FastAPI `/api/upload` receives the file in exactly the same way as from the website:
  - Same field name (`file`), same multipart encoding semantics, no extra mobile preprocessing.
- The same `LlamaExtract` `FIR_TextExtraction` agent is invoked once.
- Mobile client maps response fields into a `chat` object that mirrors `createNewChat` and renders structured FIR data and Urdu text.

### 2. Model, Prompts, and Parameters

- **Model & Agent**:
  - Both website and mobile app call the **same FastAPI `/api/upload`** endpoint.
  - `/api/upload` uses `llama_cloud_services.LlamaExtract` with agent name `FIR_TextExtraction`.
  - All prompts, temperature, top-p, max tokens, Urdu grammar and correction rules live inside the LlamaCloud agent configuration.
  - Because the mobile app never talks directly to LlamaCloud, it automatically reuses the exact same model and configuration.
- **Message Structure**:
  - The backend encapsulates the system/user message structure when it calls the agent.
  - Mobile client does not alter or re-wrap prompts; it only uploads the file and consumes the JSON result.

### 3. Image / File Handling Parity

- **Website frontend**:
  - Accepts PDF, DOC, DOCX, TXT, and image files via browser file APIs.
  - Does **not** resize, compress, grayscale, or base64-encode images.
  - Sends raw file bytes via `FormData` multipart upload.
- **Mobile client**:
  - Uses Expo `ImagePicker` for camera/gallery image selection.
  - Wraps the file URI in a FormData part: `{ uri, name, type }`.
  - Does **not** perform any extra processing (no manual resize, compression, grayscale, or base64).
  - Relies on React Native + `fetch` to stream the file bytes to FastAPI, matching browser behavior as closely as possible.

### 4. Response Mapping Parity

The website’s `createNewChat` constructs a chat object as:

- `filename` ← `fileData.filename`
- `fileSize` ← `fileData.file_size`
- `originalText` ← `fileData.original_text || fileData.raw_urdu_text`
- `correctedText` ← `fileData.corrected_text || fileData.corrected_urdu_text`
- `rawUrduText` ← `fileData.raw_urdu_text`
- `firStructuredData` ← `fileData.fir_structured_data`
- `extractionType` ← `fileData.extraction_type || "text"`
- `correctionsApplied` ← `fileData.corrections_applied`
- `correctionStats` ← `fileData.correction_stats || {}`

The mobile app’s `App.js` mirrors this mapping for each upload:

- `filename` ← `data.filename`
- `fileSize` ← `data.file_size`
- `originalText` ← `data.original_text || data.raw_urdu_text`
- `correctedText` ← `data.corrected_text || data.corrected_urdu_text`
- `rawUrduText` ← `data.raw_urdu_text`
- `firStructuredData` ← `data.fir_structured_data`
- `extractionType` ← `data.extraction_type || "text"`
- `correctionsApplied` ← `data.corrections_applied`
- `correctionStats` ← `data.correction_stats || {}`

This ensures that any change in backend behavior (e.g., improved corrections) is reflected identically in both web and mobile clients.

### 5. FIR Display Parity

- **Website (`FIRDisplay.jsx` + `MessageList.jsx`)**:
  - Renders:
    - FIR details, registration info, investigating officer, complainant, accused, occurrence details, brief facts, witnesses.
    - Complete Urdu text section (raw / corrected) with RTL alignment and Nastaliq-friendly fonts.
    - Basic text statistics (character and word counts).
- **Mobile (`App.js`)**:
  - Renders the same conceptual sections using React Native views:
    - FIR details, registration info, investigating officer, complainant, accused, occurrence details, brief facts, witnesses.
    - Complete Urdu text in a dedicated section with `textAlign: "right"` and `writingDirection: "rtl"` for Urdu.
    - Character and word counts computed from `correctedText || rawUrduText`, mimicking `MessageList`.

### 6. History and Error Handling

- **Website**:
  - Persists chat history in `localStorage` via `chatStorage.js`.
  - Displays a sidebar to switch between extractions.
  - Shows error banners for failed uploads or backend issues.
- **Mobile**:
  - Keeps a simple history of recent extractions (up to 20) in memory and persists it to `AsyncStorage` under the key `specter_history`.
  - Renders a horizontal history bar where tapping an item selects that extraction.
  - Shows an error banner at the top when upload or backend errors occur.

### 7. Environment and Secrets

- **Backend**:
  - Holds all AI secrets:
    - `LLAMA_CLOUD_API_KEY`
    - `OPENAI_API_KEY`
  - Controls which model, prompts, and parameters the `FIR_TextExtraction` agent uses.
- **Mobile**:
  - Only knows `API_BASE_URL` (in `config.js`).
  - Does **not** store or use any LlamaCloud or OpenAI keys.
  - All AI/OCR work happens on the backend, guaranteeing identical behavior across clients.

### 8. Final Parity Checklist

- **Same model & agent**:
  - ✅ Both clients call FastAPI `/api/upload`, which calls the same `LlamaExtract` `FIR_TextExtraction` agent.
- **Same prompts & parameters**:
  - ✅ All prompt engineering and parameter settings live in the LlamaCloud agent, reused by both clients.
- **Same preprocessing**:
  - ✅ Both send raw file bytes via multipart FormData with field name `file` and no additional transformations.
- **Same output behavior**:
  - ✅ Response JSON is mapped into equivalent chat/result objects, and all structured fields and Urdu text are displayed.

### 9. Run Instructions

1. **Start FastAPI backend** (from the website project, ensuring `.env` has valid keys):
   - `cd /path/to/Urdu_Text_Extraction/backend`
   - `uvicorn app:app --host 0.0.0.0 --port 8000 --reload`

2. **Configure mobile API base URL**:
   - Open `config.js` in SpecterApp.
   - Set `API_BASE_URL` to match your backend host, for example:
     - `http://localhost:8000` (Android emulator)
     - `http://<your-lan-ip>:8000` (physical device)

3. **Run the mobile app**:
   - `cd ~/Downloads/SpecterApp`
   - `npm install` (first time only)
   - `npx expo start --clear`

4. **Verify parity**:
   - Use the same FIR image in both the website and the mobile app.
   - Confirm that:
     - Structured fields (FIR number, complainant, accused, occurrence, etc.) match.
     - Urdu text (including punctuation and diacritics) is identical.
     - Any subsequent backend improvements automatically appear in both clients.

