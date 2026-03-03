# I Built a Live AI Math Tutor You Can Interrupt Mid-Sentence

_How Gemini's Live API made real-time, voice-first tutoring possible — and what I learned along the way._

**#GeminiLiveAgentChallenge**

---

## The 10-Second Pitch

**Faheem Math** is a live AI math tutor where students speak a problem, get an instant audio explanation, and can interrupt mid-sentence to ask "wait, what?" — just like with a real tutor. It also reads handwritten homework from photos and adapts its teaching style on the fly.

Try it live: https://faheem-math-frontend-872506223416.us-central1.run.app
Code: https://github.com/Appenza-Main-Org/faheem-live-competition

---

## Why I Built This

Every AI tutoring tool I've seen works the same way: type a question, click send, wait, read a wall of text, repeat. That's not tutoring — that's a search engine with extra steps.

Real tutoring is messy. A student says "I don't get fractions," the tutor starts explaining, the student interrupts with "wait, why did you flip it?" — and the tutor pivots instantly. There's no "submit" button in a real conversation.

When I saw that Google's Gemini Live API supported full-duplex audio with native barge-in detection, I knew I could build something that actually felt like a conversation.

---

## What Faheem Math Does

**Three ways to ask:**
- **Speak** a problem — "How do I solve 2x + 5 = 17?" — and hear a step-by-step explanation instantly
- **Upload a photo** of handwritten homework — Faheem reads it and walks you through the solution
- **Type** if you prefer — same tutor, same quality

**Three tutoring modes:**
- **Explain** — walks through solutions step by step
- **Quiz** — flips the script and asks *you* questions to test understanding
- **Homework** — works through full problem sets, showing every step

**The key feature: barge-in.** You can interrupt Faheem mid-explanation. He stops immediately, listens to your follow-up, and responds — no button press, no waiting. This is what makes it feel like a real tutor instead of a voice assistant.

---

## How It Works: One WebSocket, Three Modalities

The architecture is deliberately simple. Everything flows through a **single WebSocket connection**:

```
Browser  <--WebSocket-->  FastAPI Backend  <--Live API-->  Gemini
```

Three message types share one connection:
1. **Binary frames** — raw PCM audio (16kHz from mic, 24kHz from tutor)
2. **JSON text** — typed messages, status updates, session recap
3. **JSON image** — base64-encoded homework photos for vision

No separate connections for audio vs. text. No complex state sync. One pipe, three modalities.

### The Backend

FastAPI with two concurrent `asyncio` tasks:
- **Upstream:** mic audio flows from the browser through an `asyncio.Queue` to Gemini Live
- **Downstream:** Gemini's audio response streams back to the browser speaker

The `asyncio.Queue` was a critical design choice — it decouples the WebSocket receive loop from the Gemini send loop, preventing audio backpressure from blocking the connection.

Text and image requests use Gemini's standard generate API (`gemini-2.5-flash`) rather than the Live API, since they don't need streaming audio.

### The Frontend

Next.js 14 with three key browser APIs:
- **Web Audio API** — captures mic at 16kHz PCM, plays tutor audio at 24kHz
- **Web Speech API** — live transcription of what the student says (partial results update word-by-word)
- **KaTeX** — renders LaTeX math notation in the chat transcript

The UI tracks eight distinct live states (Idle, Connecting, Live, Listening, Thinking, Speaking, Seeing, Interrupted) — each with its own visual indicator so students always know what the tutor is doing.

---

## The Hard Parts

### Barge-in UX

Gemini's Live API detects interruptions automatically — but surfacing that in the UI required care. When the backend receives an interruption signal, it:
1. Stops sending audio to the browser
2. Discards any partial response text
3. Sends an "interrupted" control message to the frontend
4. The UI flashes an orange "Interrupted" indicator for 900ms

The result: the student talks over Faheem, Faheem stops within a fraction of a second, and the UI confirms it happened. It feels natural.

### Web Speech API Auto-Restart

Chrome's Web Speech API has a quirk: even with `continuous: true`, it sometimes stops recognition after a final result. If you don't handle this, the student asks one question by voice and then transcription silently dies.

The fix: a `wantRunningRef` flag that tracks whether the user wants transcription active. When the recognition's `onend` fires unexpectedly, we check the flag and auto-restart a new instance — reusing the same event handlers. The user never notices.

### Partial vs. Final Transcripts

The Web Speech API fires interim results (`isFinal: false`) and final results (`isFinal: true`). I maintain a "partial transcript index" that updates a single row in place as the student speaks, then locks it in when the utterance is complete. This gives word-by-word feedback without flooding the chat with duplicate lines.

### Mode Switching Without Losing Context

Rather than maintaining three separate system prompts, I inject short mode-specific addendums at runtime:

```python
effective_prompt = base_prompt + MODE_ADDENDUM[mode]
```

The base tutor persona stays consistent. Only the behavioral instructions change — "ask questions" in Quiz mode, "show all work" in Homework mode.

---

## Deployment: Cloud Run

Both frontend and backend deploy to **Google Cloud Run** with a single command each:

```bash
gcloud run deploy faheem-math-backend \
  --source backend \
  --region us-central1 \
  --allow-unauthenticated
```

Cloud Run handles container builds, TLS termination (so WebSockets upgrade to `wss://` automatically), and scales to zero when idle. I wrote deployment scripts (`scripts/deploy.sh` and `scripts/deploy.ps1`) for one-command deploys on any platform.

For judges and reviewers who don't have a Gemini API key, there's a **stub mode** (`GEMINI_STUB=true`) that returns canned responses — so you can test the full UX pipeline without any credentials.

---

## The Stack

| Layer | Technology |
|-------|-----------|
| AI Model | Gemini 2.5 Flash — native audio (`gemini-2.5-flash-native-audio-latest`) + text/vision (`gemini-2.5-flash`) |
| SDK | Google GenAI SDK (`google-genai` Python package) |
| Backend | FastAPI + asyncio + WebSockets |
| Frontend | Next.js 14 (App Router) + Tailwind CSS + TypeScript |
| Audio | Web Audio API (capture/playback) + Web Speech API (transcription) |
| Math Rendering | KaTeX (LaTeX in chat bubbles) |
| Cloud | Google Cloud Run (us-central1) |
| Tools | 4 structured tools — problem type detection, answer checking, hint generation, session recap |

---

## What I'd Build Next

- **Session persistence** — save transcripts and recaps to Firestore so students can review past sessions
- **Progress tracking** — track which topics a student struggles with across sessions
- **Multi-subject expansion** — the architecture generalizes beyond math (science, language arts)
- **Collaborative mode** — multiple students in one session, taking turns

---

## Try It

**Live app:** https://faheem-math-frontend-872506223416.us-central1.run.app

**Run locally (no API key needed):**
```bash
# Backend with stub mode
cd backend && pip install -r requirements.txt
GEMINI_STUB=true uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

**Full source:** https://github.com/Appenza-Main-Org/faheem-live-competition

---

Built for the **Google Gemini Live Agent Challenge** #GeminiLiveAgentChallenge

**Tags:** #GeminiLiveAgentChallenge #GoogleGemini #LiveAgents #AI #EdTech #MathTutor #CloudRun #GeminiLiveAPI

---

_Adapt this for your preferred platform: Dev.to, Medium, LinkedIn, or your blog. Make sure to keep the #GeminiLiveAgentChallenge hashtag for bonus points._
