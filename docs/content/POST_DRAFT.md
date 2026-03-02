# Building Faheem Math: A Live AI Tutor with Gemini Live API

_A real-time, voice-first math tutor that you can interrupt — built for the #GeminiLiveAgentChallenge_

---

## TL;DR

I built **Faheem Math**, a live AI math tutor powered by Gemini's Live API. Students can:
- **Speak** a math problem and get instant, step-by-step explanations
- **Interrupt** mid-explanation (barge-in) to ask follow-up questions
- **Upload** photos of homework — Faheem reads and solves handwritten or printed problems
- **Switch modes** (Explain/Quiz/Homework) mid-session without losing context

All running on **Google Cloud Run** with full-duplex audio, live transcription, and a sub-second response time.

🚀 **Try it live:** https://faheem-math-frontend-872506223416.us-central1.run.app
📦 **GitHub:** [Your repo URL]

---

## The Problem: Math Help Shouldn't Feel Like Filling Out a Form

Most AI tutoring tools are text-in/text-out. You type a question, wait, get a wall of text, then type another question. It's slow, unnatural, and breaks the flow of learning.

Real tutoring is a **conversation**. A student asks a question, the tutor explains, the student interrupts with "wait, what?" — and the tutor adjusts in real time. That's what I wanted to build.

---

## Enter Gemini Live API

Google's [Gemini Live API](https://ai.google.dev/gemini-api/docs/live) is a game-changer for this use case. It provides:
- **Native audio I/O** — Gemini processes raw PCM audio, no speech-to-text middleware
- **Full-duplex streaming** — The model can speak and listen at the same time
- **Barge-in detection** — Gemini knows when the user starts speaking mid-response and stops gracefully

This is exactly what you need for a real-time tutoring experience.

---

## Architecture: Single WebSocket, Three Modalities

The app uses a **single WebSocket connection** (`/ws/session`) for all interactions:

```
Browser ←→ WebSocket ←→ FastAPI Backend ←→ Gemini Live API
```

**Three message types over one connection:**
1. **Binary frames** — PCM audio (16kHz in, 24kHz out) for voice
2. **JSON (text)** — Text messages and control signals (status, errors, recap)
3. **JSON (image)** — Base64-encoded homework photos for vision-enabled help

This keeps the architecture simple — no separate connections, no complex state sync.

### Backend: FastAPI + `asyncio`

The backend uses FastAPI's WebSocket support + `asyncio.Queue` to decouple:
- **Receive loop** — Reads from WebSocket (mic audio, text, images)
- **Gemini Live bridge** — Streams audio to/from Gemini, handles text/image via standard API

Two concurrent `asyncio` tasks run in parallel:
- **Upstream:** Browser mic → Queue → Gemini Live
- **Downstream:** Gemini Live → Browser speaker

### Frontend: React + Web Audio API + Web Speech API

The frontend uses:
- **Web Audio API** — Capture mic (16kHz), play tutor audio (24kHz)
- **Web Speech API** — Live transcription of what the student says (Chrome/Edge)
- **React state** — Manages live states (Idle, Connecting, Listening, Thinking, Speaking, Interrupted)

---

## Key Features

### 1. **Live Voice Interaction**
Speak a math problem — Faheem responds instantly with audio + transcript. No delays, no "submit" button.

### 2. **Barge-in Support**
Interrupt mid-explanation. Gemini detects the interruption, stops speaking, and listens to your follow-up. The UI shows an "Interrupted" state (orange pulse) for 900ms to confirm.

### 3. **Three Tutoring Modes**
- **Explain** — Step-by-step explanations with worked examples
- **Quiz** — Asks questions to test understanding
- **Homework** — Walks through actual problem sets, shows all steps

Mode-specific "addendums" are injected into the system prompt at runtime, so the base tutor persona stays consistent while behavior adapts.

### 4. **Vision-Enabled Homework Help**
Snap or upload a photo of homework — Faheem reads handwritten or printed math and explains the solution step by step. Uses `gemini-2.5-flash` (standard API) for multimodal vision.

### 5. **Live Transcription**
The Web Speech API transcribes what the student says in real time (partial results update live, final results lock in after each utterance). This gives instant visual feedback and helps students see what Gemini "heard."

### 6. **Session Timer & Recap**
Each session tracks elapsed time (`mm:ss`). At the end, Faheem sends a recap:
- Summary of topics covered
- Session duration
- Problem count

This adds accountability and closure.

---

## Technical Challenges & Learnings

### 1. **Audio Backpressure**
Initially, I piped WebSocket audio directly to Gemini. Under heavy traffic, this caused blocking. Solution: `asyncio.Queue` decouples receive from send — the WebSocket can buffer audio chunks without blocking the Gemini upstream.

### 2. **Partial vs. Final Transcripts**
The Web Speech API fires `onresult` events with `isFinal=false` (partial) and `isFinal=true` (final). I update a "partial" transcript row in place until `isFinal`, then lock it in. This gives real-time feedback without flooding the UI with duplicate rows.

### 3. **Barge-in UX**
Detecting interruptions is easy (Gemini does it automatically). Surfacing it in the UI is harder. I added:
- `setIsSpeaking(false)` on interruption signal
- `setIsInterrupted(true)` for 900ms (orange pulse)
- Clear the "Speaking" timer immediately

This makes the interruption feel responsive.

### 4. **Mode Switching Without Losing Context**
Instead of hardcoding three separate system prompts, I inject short mode-specific addendums at runtime:
```python
effective_prompt = base_prompt + MODE_ADDENDUM[mode]
```
This keeps the tutor persona consistent while adapting behavior (e.g., "ask questions" in Quiz mode, "show all steps" in Homework mode).

### 5. **Demo Mode for Judges**
Not everyone has a Gemini API key. I added `GEMINI_STUB=true` to return canned responses without hitting the API. This lets judges test the full UX flow (WebSocket, audio playback, UI states) without needing credentials.

---

## Cloud Run Deployment

Deploying to **Google Cloud Run** was surprisingly smooth:

```bash
gcloud run deploy faheem-math-backend \
  --source backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=...,CORS_ORIGINS=[\"*\"]"
```

Cloud Run:
- Auto-builds the container from `Dockerfile`
- Injects `PORT` (backend binds `0.0.0.0:$PORT`)
- Handles TLS (WebSocket upgrade to `wss://`)
- Scales to zero when idle (no cost)

I wrote deployment scripts (`scripts/deploy.sh`, `scripts/deploy.ps1`) for one-command deploys.

---

## Demo Video (Under 4 Minutes)

Watch the full demo here: [Video URL]

**Timestamps:**
- 0:00 — Introduction
- 0:35 — Voice explanation (Explain mode)
- 1:15 — Barge-in / interruption
- 1:45 — Quiz mode
- 2:10 — Vision (homework photo upload)
- 3:15 — Session recap & timer

---

## What's Next?

- **Session persistence** — Save transcripts + recaps to Firestore
- **Multi-subject support** — Expand beyond math (science, history, etc.)
- **Arabic voice** — Add bilingual support (Arabic + English voice switching)
- **Collaborative sessions** — Multi-student group tutoring

---

## Try It Yourself

🚀 **Live app:** https://faheem-math-frontend-872506223416.us-central1.run.app
📦 **GitHub:** [Your repo URL]
📄 **Docs:** See [SUBMISSION.md](../../SUBMISSION.md) for full details

Or run locally with demo mode (no API key):
```bash
cd backend
pip install -r requirements.txt
export GEMINI_STUB=true
uvicorn app.main:app --reload

# In another terminal
cd frontend
npm install && npm run dev
```

---

## Built With

- **Gemini Live API** — `gemini-2.5-flash-native-audio-latest` (voice), `gemini-2.5-flash` (text/images)
- **Google GenAI SDK** — Official Python SDK
- **Google Cloud Run** — Serverless container deployment
- **FastAPI** — High-performance Python web framework
- **Next.js 14** — React framework (App Router)
- **Web Audio API** — Audio capture + playback
- **Web Speech API** — Live transcription

---

## Acknowledgments

Built for the **Google Gemini Live Agent Challenge** (#GeminiLiveAgentChallenge).

Thanks to:
- The Gemini team for an incredible API
- The Google Cloud DevRel team for clear docs
- The FastAPI and Next.js communities

---

**Tags:** #GeminiLiveAgentChallenge #GoogleGemini #LiveAgents #AI #EdTech #MathTutor #CloudRun #NextJS #FastAPI

---

**Published:** 2026-03-02
**Author:** [Your Name]
**License:** MIT

---

_Ready to publish? Adapt this draft to your preferred platform (Dev.to, Medium, personal blog, LinkedIn, etc.). Include the #GeminiLiveAgentChallenge hashtag for bonus points!_
