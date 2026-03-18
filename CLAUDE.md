# CLAUDE.md

## Project
SolveWave is a real-time math tutoring MVP for the Google Gemini Live Agent Challenge.
Single-subject math tutor with voice, text, and image input. English UI.

## Stack
- Next.js 14 frontend (Tailwind CSS, TypeScript, Framer Motion, Lucide icons)
- FastAPI backend (WebSocket + Gemini Live API)
- Google Cloud Run (us-central1)
- Gemini 2.5 Flash (native audio via Live API + text via standard API)
- WebSocket binary audio transport (PCM 16kHz/24kHz)
- Cairo font via next/font/google

## Project Structure
```
├── frontend/                   # Next.js app
│   ├── src/app/
│   │   ├── layout.tsx          # Root layout (Cairo font, metadata)
│   │   ├── globals.css         # Tailwind + custom scrollbar
│   │   ├── page.tsx            # Redirects to /session
│   │   └── session/page.tsx    # Main session UI (status strip, transcript, composer)
│   ├── src/components/
│   │   ├── AmbientOrb.tsx      # Animated state visualization orb (standalone, not used in session page)
│   │   ├── SolveWaveLogo.tsx   # SVG logo (wave pulse on emerald gradient)
│   │   ├── TranscriptPanel.tsx # Chat transcript (tutor/student, LaTeX)
│   │   ├── ModeSelector.tsx    # Explain/Quiz/Homework segmented tabs
│   │   ├── ExamplesPanel.tsx   # Example prompts per mode
│   │   └── HelpPanel.tsx       # Help modal
│   ├── src/hooks/
│   │   ├── useSessionSocket.ts # PRIMARY: WS control + audio playback + barge-in
│   │   ├── useVoiceTranscription.ts # Web Speech API for live captions
│   │   └── useSessionTimer.ts  # Session duration timer
│   ├── .env.production         # NEXT_PUBLIC_WS_URL for Cloud Run builds
│   └── Dockerfile              # Multi-stage build (no ARG needed)
├── backend/                    # FastAPI app
│   ├── app/main.py             # Entry point (/, /health, /ws/session)
│   ├── app/config.py           # Pydantic settings
│   ├── app/services/live_client.py  # Gemini Live bridge (audio) + text/image APIs
│   ├── app/ws/session_manager.py    # WebSocket lifecycle + interrupt handling
│   ├── app/agents/tutor_agent.py    # TutorAgent + tool schemas + Live config
│   ├── app/tools/              # detect_problem_type, check_answer, hints, recap
│   ├── app/prompts/system_prompt.md # Math tutor system prompt
│   └── Dockerfile              # Cloud Run deployment
├── tailwind.config.js          # Root re-export → frontend/tailwind.config.js
└── postcss.config.js           # Root re-export → frontend/postcss.config.js
```

## UI Design
- **Theme:** Obsidian dark (#02040a background) with solvewave-emerald (#10B981) accents
- **Status Strip:** Compact h-12 inline strip with mini state orb + label (replaced full AmbientOrb)
- **Transcript Canvas:** Maximized area — minimal padding (px-2/3/4), full height, edge-to-edge
- **Floating Composer:** Rounded glass-morphism input bar with camera, mic, text, send
- **Transcript:** Rounded canvas with tutor (emerald accent) / student bubbles, LaTeX rendering
- **Sidebar:** 280px tools panel (xl+ only), narrow to maximize transcript space
- **Responsive:** Mobile mode selector in second row, side panel hidden below xl breakpoint
- **Font:** Cairo (loaded via next/font/google with CSS variable --font-cairo)

## Key Architecture
- **WebSocket audio transport**: browser mic → 16kHz PCM → WS binary → Gemini Live API → 24kHz PCM → WS binary → browser AudioContext playback
  - Browser getUserMedia with AEC, noise suppression, auto gain control
  - ScriptProcessorNode resamples native rate → 16kHz, sends Int16 PCM over WS
- WebSocket `/ws/session` = single channel: binary PCM audio + JSON control frames (text/image/status)
- **Echo suppression**: single `echoSuppressRef` (synchronous ref) — true during tutor speech, cleared instantly on barge-in. Web Speech API stays running continuously, results are just filtered.
- **Barge-in**: unified `_performInterrupt()` function handles both auto (RMS energy detection) and manual (button) interrupts identically
- **Backend interrupt**: frontend sends `{"type": "interrupt"}` (informational only); Gemini Live detects barge-in natively via the audio stream and sends `interrupted` + `speaking_end` through `live_client._downstream`
- **Post-interrupt grace period**: 4-second window after interrupt where `echoSuppressRef` stays false even if Gemini starts a new response (prevents user speech from being suppressed)
- **Interrupt debounce**: 1-second minimum between interrupts to prevent rapid-fire
- Web Speech API provides live transcription captions alongside Gemini Live audio
- Final transcripts sent via `voice_text` to text API for guaranteed text response
- Camera auto-sends captured images immediately (no staging/upload step)
- Mode addendums (explain/quiz/homework) injected per-request at runtime
- Gemini Live config: response_modalities=["AUDIO"], voice="Charon"

## Deployment
- **GCP Project:** solvewave-live (872506223416)
- **Frontend:** https://solvewave-frontend-872506223416.us-central1.run.app
- **Backend:** https://solvewave-backend-872506223416.us-central1.run.app
- **Current tag:** v1.0.0

### Deploy commands
```bash
export PATH="$HOME/google-cloud-sdk/bin:$PATH"

# Backend
gcloud run deploy solvewave-backend \
  --source backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=<KEY>,CORS_ORIGINS=[\"*\"]" \
  --quiet

# Frontend (NEXT_PUBLIC_WS_URL comes from frontend/.env.production — no --set-build-env-vars needed)
gcloud run deploy solvewave-frontend \
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

## Speech/Text Architecture (v0.9.0 revamp)

**What was fixed:**
- Bug 1 (speech not transcribed after interrupt): replaced 3-layer echo suppression with single `echoSuppressRef`
- Bug 2 (interrupt button unreliable): button always enabled when voice active, no `isSpeaking` gate
- Bug 3 (no response after interrupt): backend now sends `interrupted` + `speaking_end` on `{"type": "interrupt"}`; unified `_performInterrupt()` clears all blocking refs synchronously
- Bug 4 (thinking text in transcript): only `output_transcription` is displayed; `part.text` is logged only
- Removed all WebRTC code (never worked on Cloud Run); WebSocket binary is the only audio path
- Removed `sendTextQuiet` — `sendText` now takes `{ quiet: true }` option
- Removed dead refs: `speakingEndReceivedRef`, `micMuteTimerRef`, `speakingCooldownRef`, `wasTranscribingRef`, `isSpeakingRef`

**Remaining known issues (CRITICAL — must fix before submission):**

### P0: Web Speech API transcription fails silently
- **Symptom**: User speaks, Gemini hears them (barge-in detected via audio stream), but NO text appears in transcript. Web Speech API `onresult` never fires despite "Recognition started" log.
- **Root cause**: `getUserMedia` (for audio capture to Gemini) and Web Speech API both try to access the mic simultaneously. Chrome may prioritize one, starving the other. Both are started at the same time in the auto-start useEffect and `handleVoiceToggle`.
- **Impact**: User has NO visual feedback that they spoke. Transcript shows only tutor messages.
- **Potential fixes**:
  1. Delay Web Speech API start by 500-1000ms after getUserMedia succeeds
  2. Use a single mic stream shared between both consumers (Web Speech API doesn't support custom audio sources though)
  3. Add fallback: show "🎤 Speaking..." in transcript when RMS energy detected (even without text transcription)
  4. Consider replacing Web Speech API with Deepgram/Whisper or Gemini's own input transcription if available

### P0: No student speech in transcript at all
- **Symptom**: Even when Web Speech API IS working, the voice_text path sends text to the backend but doesn't reliably show it in the transcript panel.
- **Impact**: Conversation appears one-sided (tutor only). User can't see what they said.

### P1: Interrupt button UX issues
- **Symptom**: User presses interrupt button rapidly; despite 1s debounce, multiple "Interrupt performed (manual)" + "Interrupt debounced" logs fire. No visual feedback that the interrupt was processed.
- **Fix needed**: Disable the button visually during debounce cooldown. Show brief "Interrupted!" toast or animation.

### P1: LaTeX rendering in StreamingTextRenderer
- **Fixed in latest**: `isActiveStreaming` now only uses `StreamingTextRenderer` for entries with `streaming: true` flag (not all entries when `isSpeaking` is globally true). StreamingTextRenderer now uses `processInlineContent` + `dangerouslySetInnerHTML` for proper math rendering.
- **Remaining edge case**: Backtick-wrapped math with `$` inside (e.g. `` `$x^2$` ``) — now stripped, but other malformed LaTeX from Gemini may still cause issues.

### P2: ScriptProcessorNode deprecated
- Chrome shows deprecation warning; should migrate to AudioWorklet for better performance and no main-thread blocking.

### P2: `output_transcription` attribute name may vary
- Attribute name may differ across google-genai SDK versions. Current code checks multiple names (`output_transcription`, `output_audio_transcription`).

### P2: Echo leak edge case
- Echo from speakers can occasionally leak through if `speaking_end` arrives slightly before audio buffers fully drain (acceptable for demo).

### P2: Double interrupt path
- Both frontend `_performInterrupt()` and Gemini's native barge-in detection can fire for the same interrupt event, causing duplicate `interrupted` + `speaking_end` status frames. The `interrupted` handler in the frontend handles this gracefully but it's not ideal.

## Rules
- Keep changes minimal and modular
- Do not overengineer
- Prioritize working vertical slices
- Preserve existing folder structure
- English-only UI (no Arabic)
