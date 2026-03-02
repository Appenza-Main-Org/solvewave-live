# Faheem Math — Live AI Math Tutor

Real-time, voice-first, vision-enabled math tutor powered by the [Gemini Live API](https://ai.google.dev/api/multimodal-live).

**Built for the Google Gemini Live Agent Challenge — Live Agents 🗣️ Track**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Try%20Now-brightgreen)](https://faheem-math-frontend-872506223416.us-central1.run.app)
[![Cloud Run](https://img.shields.io/badge/Google%20Cloud-Cloud%20Run-blue)](https://cloud.google.com/run)
[![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-orange)](https://ai.google.dev/gemini-api/docs/live)

---

## 📖 Table of Contents

- [What it Does](#what-it-does)
- [Challenge Compliance Checklist](#challenge-compliance-checklist)
- [Try it Out](#try-it-out)
- [For Judges: Testing Access](#for-judges-testing-access)
- [Architecture](#architecture)
- [Local Development](#local-development)
- [Cloud Run Deployment](#cloud-run-deployment)
- [Project Structure](#project-structure)
- [Documentation](#documentation)

---

## What it Does

Faheem Math is a **live, multimodal AI math tutor** that students can interrupt, just like a real tutor. It combines:

- ✅ **Voice sessions** — speak a math problem; Faheem explains it in real time (full-duplex audio via Gemini Live)
- ✅ **Barge-in support** — interrupt mid-explanation; Faheem stops and listens to your follow-up question
- ✅ **Image upload** — snap or upload homework; Faheem reads and solves it step by step (vision-enabled)
- ✅ **Text chat** — multi-turn conversation with persistent session context
- ✅ **Three modes** — Explain / Quiz / Homework, switchable mid-session without losing context
- ✅ **Live agent states** — Ready → Connecting → Live → Listening → Thinking → Speaking → Interrupted (visible in UI)
- ✅ **Live transcription** — see your spoken words transcribed in real-time (Web Speech API)
- ✅ **Session timer & recap** — track duration and get a summary at the end
- ✅ **Tool use** — Gemini calls structured local tools to check answers, generate hints, and build recaps
- ✅ **Demo mode** — full pipeline testable without an API key (`GEMINI_STUB=true`)

---

## Challenge Compliance Checklist

This project satisfies all requirements for the **Live Agents 🗣️** track:

### ✅ What to Build (Live Agents Track)
- [x] **New project** created during contest period
- [x] **Multimodal** inputs and outputs (audio + vision + text)
- [x] **Voice-first**, real-time interaction
- [x] **Handles interruptions/barge-in** naturally — user can cut in at any time

### ✅ All Projects MUST
- [x] **Leverages a Gemini model** — `gemini-2.5-flash-native-audio-latest` (voice), `gemini-2.5-flash` (text/images)
- [x] **Built using Google GenAI SDK** — official Python SDK (`google-genai>=1.0.0`)
- [x] **Uses Google Cloud service** — Cloud Run (backend + frontend), Cloud Build

### ✅ What to Submit
- [x] **Text description** with summary, technologies, data sources, findings → [docs/submission/SUBMISSION.md](docs/submission/SUBMISSION.md)
- [x] **Public code repository** with spin-up instructions (this README)
- [x] **Proof of Google Cloud deployment** → [docs/submission/PROOF_OF_GCP.md](docs/submission/PROOF_OF_GCP.md)
- [x] **Architecture diagram** → [docs/architecture-diagram.png](docs/architecture-diagram.png)
- [x] **Demo video** under 4 minutes → [docs/demo/demo-script.md](docs/demo/demo-script.md), [docs/demo/DEMO_CHECKLIST.md](docs/demo/DEMO_CHECKLIST.md)

### ✅ Rules Compliance
- [x] **Testing access provided** — Free demo mode + deployed app (no restrictions)
- [x] **Free for judges** through end of judging (stub mode works without API key)
- [x] **English UI** and submission materials

### ✅ Bonus Points
- [x] **Automated deployment scripts** → [scripts/deploy.sh](scripts/deploy.sh), [scripts/deploy.ps1](scripts/deploy.ps1)
- [x] **Content with #GeminiLiveAgentChallenge** → [docs/content/POST_DRAFT.md](docs/content/POST_DRAFT.md)
- [x] **GDG profile URL field** → Add in [docs/submission/SUBMISSION.md](docs/submission/SUBMISSION.md)

---

## Try it Out

### Live Deployed App (No Setup Required)

🚀 **[Launch Faheem Math](https://faheem-math-frontend-872506223416.us-central1.run.app)**

1. Click "Start session"
2. Allow microphone access
3. Speak or type a math problem
4. Faheem responds in real-time with voice + transcript

**Backend API:** https://faheem-math-backend-872506223416.us-central1.run.app

---

## For Judges: Testing Access

We provide **three ways** to test the app, all free and unrestricted:

### Option 1: Use the Deployed App (Recommended)
- **URL:** https://faheem-math-frontend-872506223416.us-central1.run.app
- **No API key required** — backend is pre-configured
- **No time limits** — available through end of judging
- **Full features** — voice, vision, text, barge-in, all modes

### Option 2: Run Locally with Demo Mode (No API Key)
```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export GEMINI_STUB=true  # ← Demo mode: no API calls
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev

# Visit http://localhost:3000
```

**Demo mode features:**
- ✅ All UI states work (Connecting, Listening, Speaking, Interrupted)
- ✅ Canned tutor responses for text, voice, and image
- ✅ Full WebSocket pipeline exercised
- ✅ Session timer, recap, transcript, all modes
- ⚠️ Responses are pre-scripted (not real Gemini)

### Option 3: Run Locally with Your Own API Key
1. Get a free API key: https://aistudio.google.com/app/apikey
2. Follow [Local Development](#local-development) instructions below
3. Set `GEMINI_API_KEY` in `backend/.env`

**Questions?** See [docs/submission/DEPLOYMENT.md](docs/submission/DEPLOYMENT.md) for detailed setup instructions.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Next.js)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  useSessionSocket.ts (WebSocket client)              │   │
│  │  - Text messages (JSON)                              │   │
│  │  - Image uploads (base64 JSON)                       │   │
│  │  - Voice audio (binary PCM frames, 16kHz)            │   │
│  │  - Playback (binary PCM frames, 24kHz)               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ WebSocket (/ws/session)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           FastAPI Backend (Cloud Run)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  session_manager.py                                  │   │
│  │  - Route text → LiveClient.generate_text_reply       │   │
│  │  - Route image → LiveClient.generate_image_reply     │   │
│  │  - Route audio → LiveClient.run (bidirectional)      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │ google-genai SDK
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Gemini Live API (Google Cloud)                 │
│  - gemini-2.5-flash-native-audio-latest (voice)             │
│  - gemini-2.5-flash (text + images)                         │
│  - Tool use: detect_problem_type, check_answer, hints       │
└─────────────────────────────────────────────────────────────┘
```

**Visual Diagram:** [docs/architecture-diagram.png](docs/architecture-diagram.png)

**Single WebSocket for all modalities:**
- Binary frames = PCM audio (voice in/out)
- JSON frames = text messages, image uploads, control signals (status, error, recap, interruption)

**Key Architecture Details:**
- `asyncio.Queue` decouples WebSocket receive from Gemini Live upstream (prevents backpressure)
- Two concurrent tasks: upstream (mic → Gemini) + downstream (Gemini → browser)
- Mode addendums injected at runtime (explain/quiz/homework) without changing base system prompt

---

## Architecture

```
Browser (Next.js)
  │  binary PCM frames (mic → speaker)
  │  JSON frames (text / image / control)
  ▼
FastAPI  /ws/session  (single WebSocket)
  ├─ text  → LiveClient.generate_text_reply  → Gemini text API
  ├─ image → LiveClient.generate_image_reply → Gemini multimodal API
  └─ audio → LiveClient.run                 → Gemini Live API (bidirectional)
```

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Gemini API key (or use stub mode — see below)

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — set GEMINI_API_KEY (or set GEMINI_STUB=true for demo mode)
uvicorn app.main:app --reload
```

**Verify backend is running:**
```bash
curl http://localhost:8000/health
# → {"status":"ok","model":"gemini-2.5-flash-native-audio-latest","stub":false}
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local  # (optional — defaults to localhost:8000)
npm run dev
```

**Open:** [http://localhost:3000](http://localhost:3000)

### Demo Mode (No API Key Required)

To run the app without a Gemini API key (for testing or judging):

```bash
# In backend/.env
GEMINI_STUB=true
```

**What stub mode does:**
- ✅ Returns canned tutor responses for text, image, and voice
- ✅ Full WebSocket pipeline works (UI states, transcript, timer, recap)
- ✅ No external API calls — works offline
- ⚠️ Responses are pre-scripted (not real Gemini)

This is ideal for judges or contributors who want to test the UX flow without an API key.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | **Yes*** | — | [Get a key](https://aistudio.google.com/app/apikey) (*required unless `GEMINI_STUB=true`) |
| `GEMINI_MODEL` | No | `gemini-2.5-flash-native-audio-latest` | Gemini Live model (audio) |
| `GEMINI_TEXT_MODEL` | No | `gemini-2.5-flash` | Standard model (text + image) |
| `GEMINI_STUB` | No | `false` | Set `true` to enable demo mode (no API calls) |
| `CORS_ORIGINS` | No | `["http://localhost:3000"]` | Allowed origins (JSON array) |
| `LOG_LEVEL` | No | `INFO` | Python log level |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_WS_URL` | No | `ws://localhost:8000/ws/session` | Backend WebSocket URL |

---

## Cloud Run Deployment

### Quick Deploy (Automated)

We provide deployment scripts for one-command deployment:

```bash
# Unix/Linux/macOS
./scripts/deploy.sh

# Windows (PowerShell)
.\scripts\deploy.ps1
```

These scripts deploy both backend and frontend to Cloud Run automatically.

### Manual Deployment

See [docs/submission/DEPLOYMENT.md](docs/submission/DEPLOYMENT.md) for detailed step-by-step instructions, including:
- Prerequisites and gcloud setup
- Backend deployment with environment variables
- Frontend deployment with WebSocket URL configuration
- Verification steps
- Troubleshooting

**Current production deployment:**
- **Backend:** https://faheem-math-backend-872506223416.us-central1.run.app
- **Frontend:** https://faheem-math-frontend-872506223416.us-central1.run.app
- **Region:** us-central1
- **Project:** faheem-live-competition (872506223416)

---

## Project Structure

```
faheem-live-gemini/
├── README.md                        ← You are here
├── CLAUDE.md                        ← Project instructions (dev reference)
│
├── docs/                            ← All documentation (see docs/README.md)
│   ├── README.md                    ← Documentation index
│   ├── submission/                  ← Devpost submission documents
│   │   ├── SUBMISSION.md            ← Devpost submission template
│   │   ├── DEPLOYMENT.md            ← Cloud Run deployment guide
│   │   └── PROOF_OF_GCP.md          ← Evidence of Google Cloud usage
│   ├── demo/                        ← Demo video resources
│   │   ├── demo-script.md           ← Narrated 4-minute demo script
│   │   └── DEMO_CHECKLIST.md        ← Demo preparation checklist
│   ├── development/                 ← Dev reference docs
│   │   ├── FINAL_STEPS.md           ← Complete to-do guide for submission
│   │   ├── IMPLEMENTATION_SUMMARY.md ← Full changelog
│   │   └── FOLDER_STRUCTURE.md      ← Project structure reference
│   ├── content/                     ← Public content
│   │   └── POST_DRAFT.md            ← Blog post draft (#GeminiLiveAgentChallenge)
│   ├── architecture/                ← Architecture diagrams and documentation
│   │   ├── ARCHITECTURE_DIAGRAM.md  ← Architecture description (text)
│   │   ├── ARCHITECTURE_MERMAID.md  ← Mermaid diagram source
│   │   └── *.png                    ← Generated architecture diagrams
│   └── architecture-diagram.png     ← Symlink to main architecture diagram
│
├── scripts/
│   ├── deploy.sh                    ← Automated deployment (Unix/macOS)
│   └── deploy.ps1                   ← Automated deployment (Windows)
│
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py                  ← FastAPI app, CORS, /health, /ws/session
│       ├── config.py                ← Pydantic Settings
│       ├── agents/tutor_agent.py    ← Faheem persona, tool schemas, recap
│       ├── models/schemas.py        ← Shared Pydantic models
│       ├── prompts/system_prompt.md ← Math tutor system prompt
│       ├── services/live_client.py  ← Gemini Live + text + image bridge
│       ├── tools/                   ← detect_problem_type, check_answer,
│       │                               generate_next_hint, build_session_recap
│       └── ws/session_manager.py    ← WebSocket lifecycle, audio queue
│
└── frontend/
    ├── Dockerfile
    ├── .env.local.example
    ├── package.json
    └── src/
        ├── app/session/page.tsx     ← Main session UI
        ├── components/              ← TranscriptPanel, ModeSelector, ExamplesPanel, HelpPanel
        ├── hooks/
        │   ├── useSessionSocket.ts  ← Primary hook (WS + audio + live state)
        │   ├── useVoiceTranscription.ts ← Web Speech API live captions
        │   └── useSessionTimer.ts   ← Session timer (elapsed time)
        └── lib/log.ts               ← Structured console logging
```

---

## Documentation

**📋 See [docs/README.md](docs/README.md) for the complete documentation index.**

### Quick Links

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Project overview, setup instructions, testing access (this file) |
| [docs/submission/SUBMISSION.md](docs/submission/SUBMISSION.md) | Devpost submission template with all required fields |
| [docs/submission/DEPLOYMENT.md](docs/submission/DEPLOYMENT.md) | Step-by-step Cloud Run deployment guide |
| [docs/submission/PROOF_OF_GCP.md](docs/submission/PROOF_OF_GCP.md) | Evidence of Google Cloud usage (code references + endpoints) |
| [docs/demo/demo-script.md](docs/demo/demo-script.md) | Narrated 4-minute demo script |
| [docs/demo/DEMO_CHECKLIST.md](docs/demo/DEMO_CHECKLIST.md) | Pre-demo setup and recording checklist |
| [docs/development/FINAL_STEPS.md](docs/development/FINAL_STEPS.md) | Complete step-by-step guide to submission |
| [docs/content/POST_DRAFT.md](docs/content/POST_DRAFT.md) | Blog post draft with #GeminiLiveAgentChallenge |
| [docs/architecture-diagram.png](docs/architecture-diagram.png) | Visual architecture diagram |

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

---

**Last updated:** 2026-03-02
