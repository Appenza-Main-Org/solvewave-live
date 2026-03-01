# CLAUDE.md

## Project
Faheem Live is a real-time bilingual math tutoring MVP for the Gemini Live Agent Challenge.

## Stack
- Next.js 14 frontend (Tailwind CSS, TypeScript)
- FastAPI backend (WebSocket + Gemini Live API)
- Google Cloud Run (us-central1)
- Gemini 2.5 Flash (native audio + text)

## Project Structure
```
├── frontend/          # Next.js app
│   ├── src/app/       # Pages (/, /session)
│   ├── src/components/  # UI components
│   ├── src/hooks/     # useSessionSocket, useAudioSession
│   └── Dockerfile     # Cloud Run deployment
├── backend/           # FastAPI app
│   ├── app/main.py    # Entry point (/, /health, /ws/session)
│   ├── app/config.py  # Pydantic settings
│   ├── app/services/  # live_client.py (Gemini bridge)
│   ├── app/ws/        # session_manager.py (WebSocket lifecycle)
│   ├── app/agents/    # tutor_agent.py (tools + system prompt)
│   ├── app/tools/     # detect_problem_type, check_answer, hints, recap
│   └── Dockerfile     # Cloud Run deployment
├── tailwind.config.js # Root re-export (for dev server path resolution)
└── postcss.config.js  # Root re-export (for dev server path resolution)
```

## Deployment
- **GCP Project:** faheem-live-competition (872506223416)
- **Frontend:** https://faheem-math-frontend-872506223416.us-central1.run.app
- **Backend:** https://faheem-math-backend-872506223416.us-central1.run.app
- **Current tag:** v0.2.0

### Deploy commands
```bash
export PATH="$HOME/google-cloud-sdk/bin:$PATH"

# Backend
gcloud run deploy faheem-math-backend \
  --source backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=<KEY>,CORS_ORIGINS=[\"*\"]" \
  --quiet

# Frontend
gcloud run deploy faheem-math-frontend \
  --source frontend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-build-env-vars "NEXT_PUBLIC_WS_URL=wss://faheem-math-backend-872506223416.us-central1.run.app/ws/session" \
  --quiet
```

## Local Development
```bash
# Backend (from backend/)
source .venv/bin/activate
GEMINI_API_KEY=<KEY> uvicorn app.main:app --reload

# Frontend (from frontend/)
npm run dev
```

### Preview tool note
Running `next dev` via the preview tool uses `next dev frontend` from the project root. Root-level `tailwind.config.js` and `postcss.config.js` re-export `frontend/` configs to fix Tailwind path resolution.

## Environment Variables
- `GEMINI_API_KEY` (required) — Gemini API key
- `GEMINI_MODEL` — Live audio model (default: gemini-2.5-flash-native-audio-latest)
- `GEMINI_TEXT_MODEL` — Text model (default: gemini-2.5-flash)
- `GEMINI_STUB` — Set true to skip real API calls for testing
- `CORS_ORIGINS` — JSON array of allowed origins
- `NEXT_PUBLIC_WS_URL` — WebSocket URL for frontend → backend

## API Endpoints
- `GET /` — Service info
- `GET /health` — Health check
- `WS /ws/session` — Main tutoring session (audio/text/image)

## Rules
- Keep changes minimal and modular
- Do not overengineer
- Prioritize working vertical slices
- Preserve existing folder structure
