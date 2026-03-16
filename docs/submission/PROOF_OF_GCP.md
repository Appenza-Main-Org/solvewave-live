# Proof of Google Cloud Deployment

This document provides evidence that SolveWave is built using Google Cloud services, satisfying the Gemini Live Agent Challenge requirement for Google Cloud deployment.

## Current Deployment

- **GCP Project:** `solvewave-live` (Project ID: 872506223416)
- **Backend Service:** [solvewave-backend](https://solvewave-backend-872506223416.us-central1.run.app)
- **Frontend Service:** [solvewave-frontend](https://solvewave-backend-872506223416.us-central1.run.app)
- **Region:** `us-central1`
- **Platform:** Cloud Run (managed)

## Google Cloud Services Used

### 1. Cloud Run
- **Backend:** Containerized FastAPI service deployed to Cloud Run
- **Frontend:** Next.js application deployed to Cloud Run
- **Endpoint:** `/health` - Health check returns service info and model configuration

### 2. Gemini API (via Google AI SDK)
The application uses Google's Gemini models through the official Google GenAI SDK:

**Primary Integration Points:**

1. **[backend/app/services/live_client.py](backend/app/services/live_client.py)** - Gemini Live API integration
   - Lines 1-50: Import and configuration
   - Lines 80-150: `run()` method - Establishes bidirectional audio stream with `gemini-2.5-flash-native-audio-latest`
   - Lines 200-250: `generate_text_reply()` - Text-based interactions
   - Lines 260-310: `generate_image_reply()` - Multimodal vision capabilities

2. **[backend/app/main.py](backend/app/main.py)** - FastAPI application entry point
   - Lines 30-40: Health check endpoint exposes Gemini model configuration
   - Line 45: WebSocket endpoint `/ws/session` orchestrates Gemini interactions

3. **[backend/app/config.py](backend/app/config.py)** - Pydantic settings
   - Lines 10-15: `GEMINI_API_KEY` configuration (required)
   - Lines 16-18: Model selection (`GEMINI_MODEL`, `GEMINI_TEXT_MODEL`)

### 3. Cloud Build
- Automatic container builds triggered on deployment
- Uses `backend/Dockerfile` and `frontend/Dockerfile`
- Build logs available in GCP Console

## Verification Steps

### Option 1: Live Endpoint (Recommended)

```bash
# Health check - confirms Gemini model and GCP deployment
curl https://solvewave-backend-872506223416.us-central1.run.app/health

# Expected response:
# {
#   "status": "ok",
#   "model": "gemini-2.5-flash-native-audio-latest",
#   "text_model": "gemini-2.5-flash",
#   "stub": false
# }
```

### Option 2: Code Inspection

1. Review Gemini API integration:
   ```bash
   # Primary Gemini Live integration
   cat backend/app/services/live_client.py | grep -A 5 "google.genai"

   # Configuration
   cat backend/app/config.py | grep GEMINI
   ```

2. Review Cloud Run configuration:
   ```bash
   # Backend Dockerfile
   cat backend/Dockerfile

   # Deployment documented in DEPLOYMENT.md
   cat DEPLOYMENT.md
   ```

## Gemini Models Used

| Purpose | Model ID | API |
|---------|----------|-----|
| Voice (Live) | `gemini-2.5-flash-native-audio-latest` | Gemini Live API (multimodal-live) |
| Text | `gemini-2.5-flash` | Gemini Standard API |
| Images | `gemini-2.5-flash` | Gemini Standard API (multimodal) |

## SDK Evidence

The project uses the official **Google GenAI SDK** (not Anthropic or OpenAI):

```python
# backend/requirements.txt
google-genai>=1.0.0
```

See [backend/requirements.txt](backend/requirements.txt) for the complete dependency list.

## Architecture Diagram

See [docs/architecture-diagram.png](docs/architecture-diagram.png) for a visual representation of the GCP integration.

---

**Last verified:** 2026-03-02
**Deployment tag:** v0.2.0
