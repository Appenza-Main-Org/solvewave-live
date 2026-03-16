# SolveWave — Live AI Math Tutor

**See it. Say it. Solve it.** Real-time, voice-first, vision-enabled math tutor powered by the [Gemini Live API](https://ai.google.dev/api/multimodal-live).

**Built for the Google Gemini Live Agent Challenge — Live Agents Track**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Try%20Now-brightgreen)](https://solvewave-frontend-872506223416.us-central1.run.app)
[![Cloud Run](https://img.shields.io/badge/Google%20Cloud-Cloud%20Run-blue)](https://cloud.google.com/run)
[![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-orange)](https://ai.google.dev/gemini-api/docs/live)

---

## What it Does

SolveWave is a **live, multimodal AI math tutor** that students can interrupt mid-sentence — just like a real tutor. It combines:

- **Voice sessions** — speak a math problem; get real-time audio explanations (full-duplex via Gemini Live API)
- **Barge-in support** — interrupt mid-explanation; the tutor stops instantly and listens
- **Image upload** — snap or upload handwritten homework; instant recognition and step-by-step solve
- **Text chat** — multi-turn conversation with persistent session context
- **Three modes** — Explain / Quiz / Homework, switchable mid-session
- **Real math teacher voice** — warm, patient Kore voice with natural teaching style and everyday analogies
- **Live transcription** — see spoken words transcribed in real-time (Web Speech API)
- **WebRTC audio** — low-latency Opus audio transport with WebSocket PCM fallback
- **Session timer & recap** — track duration and get a summary at the end
- **Tool use** — Gemini calls structured tools to check answers, generate hints, detect problem types, and build recaps
- **Demo mode** — full pipeline testable without an API key (`GEMINI_STUB=true`)

---

## Try it Out

### Live Deployed App (No Setup Required)

**[Launch SolveWave](https://solvewave-frontend-872506223416.us-central1.run.app)**

1. Click **Start Session**
2. Allow microphone access
3. Speak or type a math problem
4. SolveWave responds in real-time with voice + transcript

**Backend API:** https://solvewave-backend-872506223416.us-central1.run.app

---

## For Judges: Testing Access

Three ways to test, all free and unrestricted:

### Option 1: Use the Deployed App (Recommended)
- **URL:** https://solvewave-frontend-872506223416.us-central1.run.app
- No API key required — backend is pre-configured
- No time limits — available through end of judging
- Full features — voice, vision, text, barge-in, all modes

### Option 2: Run Locally with Demo Mode (No API Key)
```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
GEMINI_STUB=true uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend && npm install && npm run dev

# Visit http://localhost:3000
```

### Option 3: Run Locally with Your Own API Key
1. Get a free API key: https://aistudio.google.com/app/apikey
2. Follow [Local Development](#local-development) instructions below

---

## Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                      Browser (Next.js 14)                         │
│                                                                   │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ useWebRTC.ts    │  │ useSession   │  │ useVoiceTranscript  │  │
│  │ WebRTC audio    │  │ Socket.ts    │  │ ion.ts              │  │
│  │ (Opus/DTLS)     │  │ WS control   │  │ Web Speech API      │  │
│  │ AEC/NS/AGC      │  │ + fallback   │  │ live captions       │  │
│  └────────┬────────┘  └──────┬───────┘  └─────────────────────┘  │
│           │                  │                                    │
└───────────┼──────────────────┼────────────────────────────────────┘
            │ WebRTC           │ WebSocket (/ws/session)
            │ (Opus audio)     │ (JSON + binary PCM fallback)
            ▼                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (Cloud Run)                       │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  session_manager.py — WebSocket lifecycle + WebRTC signaling │  │
│  │  ┌─────────────────┐    ┌────────────────────────────────┐  │  │
│  │  │ webrtc_handler  │    │ asyncio.Queue (audio buffer)   │  │  │
│  │  │ aiortc peer     │───►│ Decouples receive from send    │  │  │
│  │  │ connection      │    │ Both WebRTC + WS feed this     │  │  │
│  │  └─────────────────┘    └──────────────┬─────────────────┘  │  │
│  │                                        │                     │  │
│  │  ┌─────────────────────────────────────▼─────────────────┐  │  │
│  │  │  live_client.py — Gemini bridge                       │  │  │
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │  │  │
│  │  │  │ upstream    │  │ downstream   │  │ text/image   │  │  │  │
│  │  │  │ PCM→Gemini  │  │ Gemini→audio │  │ standard API │  │  │  │
│  │  │  └─────────────┘  └──────────────┘  └─────────────┘  │  │  │
│  │  └───────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────┐     │  │
│  │  │  tutor_agent.py — Persona + Tools                   │     │  │
│  │  │  Tools: detect_problem_type, check_answer,          │     │  │
│  │  │         generate_next_hint, build_session_recap      │     │  │
│  │  └─────────────────────────────────────────────────────┘     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────────────────────────┬───────────────────────────────────────┘
                            │ google-genai SDK
                            ▼
┌───────────────────────────────────────────────────────────────────┐
│                    Gemini (Google Cloud)                           │
│                                                                   │
│  gemini-2.5-flash-native-audio-latest  ← Live API (voice)        │
│  gemini-2.5-flash                      ← Standard API (text/img) │
│  Voice: Kore (warm, teacher-like)                                 │
│  response_modalities: ["AUDIO"]                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Architecture Diagram

![SolveWave Architecture](docs/architecture-diagram.png)

### Key Design Decisions

| Decision | Why |
|----------|-----|
| **WebRTC primary, WS fallback** | WebRTC gives sub-100ms latency with Opus codec + hardware AEC/NS/AGC. Cloud Run doesn't support raw UDP, so WS binary PCM is the automatic fallback. Student never knows which transport is active. |
| **asyncio.Queue audio buffer** | Both WebRTC and WebSocket audio sources feed the same queue, decoupling the receive path from the Gemini send loop. Prevents audio backpressure and makes fallback seamless. |
| **Dual response path** | Voice audio goes to Gemini Live API (returns audio). Final transcript also goes to text API (returns text for the chat). Student always gets both a spoken answer and a written transcript. |
| **Kore voice + teacher prompt** | Warm, patient teaching voice with natural speech patterns ("okay so", "right?", "here's the cool part"), everyday analogies, and gentle corrections. |
| **Mode addendums at runtime** | Base tutor persona stays consistent. Only behavioral instructions change per mode — no separate system prompts to maintain. |
| **SDP signaling over existing WS** | No separate signaling server needed. WebRTC offer/answer flows through the same WebSocket used for control messages. |

### Audio Pipeline

```
Student speaks
    │
    ├──► WebRTC track (Opus) ──► aiortc decode ──► 16kHz PCM ──┐
    │                                                           │
    └──► WS binary (fallback) ──► raw 16kHz PCM ───────────────┤
                                                                │
                                                    asyncio.Queue
                                                                │
                                                                ▼
                                                    Gemini Live API
                                                                │
                                                    24kHz PCM response
                                                                │
    ┌──► WebRTC: Opus encode ──► GeminiOutputTrack ──► browser autoplay
    │
    └──► WS binary (fallback) ──► scheduleAudioChunk ──► Web Audio API
```

### Live States

The UI tracks eight distinct states, each with a visual indicator:

| State | Color | Meaning |
|-------|-------|---------|
| Ready | Gray | Session not started |
| Connecting | Yellow | WebSocket + WebRTC negotiation |
| Live | Emerald | Connected, awaiting input |
| Listening | Rose | Mic active, capturing audio |
| Thinking | Sky | Processing text/image request |
| Speaking | Emerald | Tutor audio playing |
| Seeing | Violet | Processing uploaded image |
| Interrupted | Orange | Barge-in detected (900ms flash) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **AI Model** | Gemini 2.5 Flash — native audio (`gemini-2.5-flash-native-audio-latest`) + text/vision (`gemini-2.5-flash`) |
| **SDK** | Google GenAI SDK (`google-genai` Python package) |
| **Backend** | FastAPI + asyncio + aiortc (WebRTC) + WebSockets |
| **Frontend** | Next.js 14 (App Router) + Tailwind CSS + TypeScript + Framer Motion |
| **Audio Transport** | WebRTC (Opus, DTLS/SRTP) with WebSocket PCM fallback |
| **Transcription** | Web Speech API (browser-native, real-time) |
| **Math Rendering** | KaTeX (LaTeX in chat bubbles) |
| **Cloud** | Google Cloud Run (us-central1) |
| **Voice** | Kore — warm, clear, teacher-like |
| **Tools** | 4 structured tools — problem type detection, answer checking, hint generation, session recap |

---

## Challenge Compliance

This project satisfies all requirements for the **Live Agents** track:

### What to Build
- [x] New project created during contest period
- [x] Multimodal inputs and outputs (audio + vision + text)
- [x] Voice-first, real-time interaction
- [x] Handles interruptions/barge-in naturally

### All Projects MUST
- [x] Leverages Gemini model — `gemini-2.5-flash-native-audio-latest` + `gemini-2.5-flash`
- [x] Built using Google GenAI SDK — official Python SDK (`google-genai>=1.0.0`)
- [x] Uses Google Cloud service — Cloud Run (backend + frontend), Cloud Build

### What to Submit
- [x] Text description with summary, technologies, findings → [docs/submission/SUBMISSION.md](docs/submission/SUBMISSION.md)
- [x] Public code repository with spin-up instructions (this README)
- [x] Proof of Google Cloud deployment → [docs/submission/PROOF_OF_GCP.md](docs/submission/PROOF_OF_GCP.md)
- [x] Architecture diagram → [docs/architecture-diagram.png](docs/architecture-diagram.png)
- [x] Demo video under 4 minutes → [docs/demo/demo-script.md](docs/demo/demo-script.md)

### Bonus Points
- [x] Automated deployment scripts → [scripts/deploy.sh](scripts/deploy.sh), [scripts/deploy.ps1](scripts/deploy.ps1)
- [x] Content with #GeminiLiveAgentChallenge → [Medium](https://medium.com/@ghareeb_45146/i-built-a-live-ai-math-tutor-you-can-interrupt-mid-sentence-b2a48c59403b) | [Dev.to](https://dev.to/mohamed_ghareeb_d1dab4200/i-built-a-live-ai-math-tutor-you-can-interrupt-mid-sentence-290d)
- [x] GDG profile → [gdg.community.dev/u/mb2zpv](https://gdg.community.dev/u/mb2zpv/#/about)

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Gemini API key (or use stub mode)

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — set GEMINI_API_KEY (or set GEMINI_STUB=true for demo mode)
uvicorn app.main:app --reload
```

**Verify:**
```bash
curl http://localhost:8000/health
# → {"status":"ok","model":"gemini-2.5-flash-native-audio-latest","stub":false}
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

**Open:** [http://localhost:3000](http://localhost:3000)

### Demo Mode (No API Key)

```bash
# In backend/.env
GEMINI_STUB=true
```

Stub mode returns canned responses — full UI pipeline works without any API calls.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes* | — | [Get a key](https://aistudio.google.com/app/apikey) (*not needed if `GEMINI_STUB=true`) |
| `GEMINI_MODEL` | No | `gemini-2.5-flash-native-audio-latest` | Live API model (audio) |
| `GEMINI_TEXT_MODEL` | No | `gemini-2.5-flash` | Standard API model (text + image) |
| `GEMINI_STUB` | No | `false` | Demo mode — no API calls |
| `CORS_ORIGINS` | No | `["http://localhost:3000"]` | Allowed origins (JSON array) |
| `STUN_URLS` | No | Google STUN servers | ICE STUN server URLs |
| `TURN_URL` | No | — | TURN server for NAT traversal |
| `TURN_USERNAME` | No | — | TURN credentials |
| `TURN_CREDENTIAL` | No | — | TURN credentials |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_WS_URL` | No | `ws://localhost:8000/ws/session` | Backend WebSocket URL |

---

## Cloud Run Deployment

### Quick Deploy

```bash
# Unix/macOS
./scripts/deploy.sh

# Windows (PowerShell)
.\scripts\deploy.ps1
```

### Manual Deploy

```bash
# Backend
gcloud run deploy solvewave-backend \
  --source backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=<KEY>,CORS_ORIGINS=[\"*\"]"

# Frontend
gcloud run deploy solvewave-frontend \
  --source frontend \
  --region us-central1 \
  --allow-unauthenticated
```

**Production URLs:**
- **Frontend:** https://solvewave-frontend-872506223416.us-central1.run.app
- **Backend:** https://solvewave-backend-872506223416.us-central1.run.app
- **Region:** us-central1
- **GCP Project:** solvewave-live (872506223416)
- **Current tag:** v0.8.0

---

## Project Structure

```
solvewave-live/
├── README.md                           ← You are here
├── CLAUDE.md                           ← Project instructions (dev reference)
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py                     ← FastAPI app, CORS, /health, /ws/session
│       ├── config.py                   ← Pydantic Settings (env vars)
│       ├── agents/tutor_agent.py       ← Persona, Kore voice, tool schemas, recap
│       ├── models/schemas.py           ← Shared Pydantic models
│       ├── prompts/system_prompt.md    ← Math teacher system prompt
│       ├── services/live_client.py     ← Gemini Live + text + image bridge
│       ├── tools/                      ← detect_problem_type, check_answer,
│       │                                  generate_next_hint, build_session_recap
│       └── ws/
│           ├── session_manager.py      ← WebSocket lifecycle, audio queue, signaling
│           └── webrtc_handler.py       ← aiortc peer connection, Opus encode/decode
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app/
│       │   ├── layout.tsx              ← Root layout (Cairo font, metadata)
│       │   ├── globals.css             ← Tailwind + custom scrollbar
│       │   └── session/page.tsx        ← Main session UI (status, transcript, composer)
│       ├── components/
│       │   ├── TranscriptPanel.tsx      ← Chat transcript (tutor/student, LaTeX)
│       │   ├── ModeSelector.tsx         ← Explain/Quiz/Homework tabs
│       │   ├── ExamplesPanel.tsx        ← Example prompts per mode
│       │   ├── HelpPanel.tsx            ← Help modal
│       │   └── SolveWaveLogo.tsx        ← SVG logo
│       ├── hooks/
│       │   ├── useSessionSocket.ts      ← WS control + WebRTC integration + live state
│       │   ├── useWebRTC.ts             ← RTCPeerConnection, Opus, AEC/NS/AGC
│       │   ├── useVoiceTranscription.ts ← Web Speech API live captions
│       │   └── useSessionTimer.ts       ← Session duration timer
│       └── lib/log.ts                   ← Structured console logging
│
├── docs/
│   ├── architecture-diagram.png         ← Architecture diagram (PNG)
│   ├── architecture/                    ← Detailed diagrams + Mermaid source
│   ├── submission/                      ← Devpost submission documents
│   ├── demo/                            ← Demo video script + checklist
│   ├── content/                         ← Blog post draft
│   └── development/                     ← Dev reference docs
│
└── scripts/
    ├── deploy.sh                        ← One-command deploy (Unix/macOS)
    └── deploy.ps1                       ← One-command deploy (Windows)
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/submission/SUBMISSION.md](docs/submission/SUBMISSION.md) | Devpost submission template |
| [docs/submission/DEPLOYMENT.md](docs/submission/DEPLOYMENT.md) | Cloud Run deployment guide |
| [docs/submission/PROOF_OF_GCP.md](docs/submission/PROOF_OF_GCP.md) | Google Cloud usage evidence |
| [docs/demo/demo-script.md](docs/demo/demo-script.md) | 4-minute demo script |
| [docs/content/POST_DRAFT.md](docs/content/POST_DRAFT.md) | Blog post ([Medium](https://medium.com/@ghareeb_45146/i-built-a-live-ai-math-tutor-you-can-interrupt-mid-sentence-b2a48c59403b) / [Dev.to](https://dev.to/mohamed_ghareeb_d1dab4200/i-built-a-live-ai-math-tutor-you-can-interrupt-mid-sentence-290d)) |
| [docs/architecture/](docs/architecture/) | Architecture diagrams & Mermaid source |

---

## License

MIT

---

## Acknowledgments

Built for the **Google Gemini Live Agent Challenge** (Live Agents Track).

Powered by:
- [Gemini Live API](https://ai.google.dev/gemini-api/docs/live) — Real-time multimodal AI
- [Google Cloud Run](https://cloud.google.com/run) — Serverless container deployment
- [Next.js](https://nextjs.org/) — React framework
- [FastAPI](https://fastapi.tiangolo.com/) — High-performance Python web framework
- [aiortc](https://github.com/aiortc/aiortc) — WebRTC for Python

---

**Current version:** v0.8.0 | **Last updated:** 2026-03-16
