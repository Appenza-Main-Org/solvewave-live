# CLAUDE.md

## Project
Faheem Math is a real-time math tutoring MVP for the Google Gemini Live Agent Challenge.
Single-subject math tutor with voice, text, and image input. English UI.

## Stack
- Next.js 14 frontend (Tailwind CSS, TypeScript, Framer Motion, Lucide icons)
- FastAPI backend (WebSocket + Gemini Live API)
- Google Cloud Run (us-central1)
- Gemini 2.5 Flash (native audio via Live API + text via standard API)
- Cairo font via next/font/google

## Project Structure
```
├── frontend/                   # Next.js app
│   ├── src/app/
│   │   ├── layout.tsx          # Root layout (Cairo font, metadata)
│   │   ├── globals.css         # Tailwind + custom scrollbar
│   │   ├── page.tsx            # Redirects to /session
│   │   └── session/page.tsx    # Main session UI (orb, transcript, composer)
│   ├── src/components/
│   │   ├── AmbientOrb.tsx      # Animated state visualization orb
│   │   ├── FaheemLogo.tsx      # SVG logo (radical sign on emerald gradient)
│   │   ├── TranscriptPanel.tsx # Chat transcript (tutor/student, LaTeX)
│   │   ├── ModeSelector.tsx    # Explain/Quiz/Homework segmented tabs
│   │   ├── ExamplesPanel.tsx   # Example prompts per mode
│   │   └── HelpPanel.tsx       # Help modal
│   ├── src/hooks/
│   │   ├── useSessionSocket.ts # PRIMARY: single WS for text/image/voice
│   │   ├── useVoiceTranscription.ts # Web Speech API for live captions
│   │   └── useSessionTimer.ts  # Session duration timer
│   ├── .env.production         # NEXT_PUBLIC_WS_URL for Cloud Run builds
│   └── Dockerfile              # Multi-stage build (no ARG needed)
├── backend/                    # FastAPI app
│   ├── app/main.py             # Entry point (/, /health, /ws/session)
│   ├── app/config.py           # Pydantic settings
│   ├── app/services/live_client.py  # Gemini Live bridge (audio) + text/image APIs
│   ├── app/ws/session_manager.py    # WebSocket lifecycle, mode addendums
│   ├── app/agents/tutor_agent.py    # TutorAgent + tool schemas + Live config
│   ├── app/tools/              # detect_problem_type, check_answer, hints, recap
│   ├── app/prompts/system_prompt.md # Math tutor system prompt
│   └── Dockerfile              # Cloud Run deployment
├── tailwind.config.js          # Root re-export → frontend/tailwind.config.js
└── postcss.config.js           # Root re-export → frontend/postcss.config.js
```

## UI Design
- **Theme:** Obsidian dark (#02040a background) with faheem-emerald (#10B981) accents
- **AmbientOrb:** Central animated orb reflects live state (idle/listening/speaking/thinking/etc.)
- **Floating Composer:** Rounded glass-morphism input bar with camera, mic, text, send
- **Transcript:** Rounded canvas with tutor (emerald accent) / student bubbles, LaTeX rendering
- **Responsive:** Mobile mode selector in second row, side panel hidden below xl breakpoint
- **Font:** Cairo (loaded via next/font/google with CSS variable --font-cairo)

## Key Architecture
- Single WebSocket `/ws/session` handles ALL: text (JSON), image (JSON), voice (binary PCM)
- Binary frames = PCM audio (16kHz in, 24kHz out)
- JSON frames = text/image messages + status/error/recap control
- Voice audio: browser captures at native sample rate, resamples to 16kHz before sending
- Web Speech API provides live transcription captions alongside Gemini Live audio
- Final transcripts always sent to text API for guaranteed text response
- Camera auto-sends captured images immediately (no staging/upload step)
- Mode addendums (explain/quiz/homework) injected per-request at runtime
- Gemini Live config: response_modalities=["AUDIO", "TEXT"], voice="Charon"

## Deployment
- **GCP Project:** faheem-live-competition (872506223416)
- **Frontend:** https://faheem-math-frontend-872506223416.us-central1.run.app
- **Backend:** https://faheem-math-backend-872506223416.us-central1.run.app
- **Current tag:** v0.5.0

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

# Frontend (NEXT_PUBLIC_WS_URL comes from frontend/.env.production — no --set-build-env-vars needed)
gcloud run deploy faheem-math-frontend \
  --source frontend \
  --region us-central1 \
  --allow-unauthenticated \
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
- `NEXT_PUBLIC_WS_URL` — WebSocket URL for frontend → backend (set in frontend/.env.production for Cloud Run)

## API Endpoints
- `GET /` — Service info
- `GET /health` — Health check
- `WS /ws/session` — Main tutoring session (audio/text/image)

## Rules
- Keep changes minimal and modular
- Do not overengineer
- Prioritize working vertical slices
- Preserve existing folder structure
- English-only UI (no Arabic)
