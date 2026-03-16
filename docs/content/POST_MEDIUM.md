# I Built a Live AI Math Tutor You Can Interrupt Mid-Sentence

How Gemini's Live API made real-time, voice-first tutoring possible — and what I learned building WebRTC audio transport on top of it.

#GeminiLiveAgentChallenge


The 10-Second Pitch

**SolveWave** is a live AI math tutor where students speak a problem, get an instant audio explanation, and can interrupt mid-sentence to ask "wait, what?" — just like with a real tutor. It also reads handwritten homework from photos and adapts its teaching style on the fly.

**See it. Say it. Solve it.**

Try it live: https://solvewave-frontend-872506223416.us-central1.run.app
Code: https://github.com/Appenza-Main-Org/solvewave-live


Why I Built This

Every AI tutoring tool I've seen works the same way: type a question, click send, wait, read a wall of text, repeat. That's not tutoring — that's a search engine with extra steps.

Real tutoring is messy. A student says "I don't get fractions," the tutor starts explaining, the student interrupts with "wait, why did you flip it?" — and the tutor pivots instantly. There's no "submit" button in a real conversation.

When I saw that Google's Gemini Live API supported full-duplex audio with native barge-in detection, I knew I could build something that actually felt like a conversation.


What SolveWave Does

Three ways to ask:

Speak a problem — "How do I solve 2x + 5 = 17?" — and hear a step-by-step explanation instantly.

Upload a photo of handwritten homework — SolveWave reads it and walks you through the solution.

Type if you prefer — same tutor, same quality.

Three tutoring modes:

Explain — walks through solutions step by step.

Quiz — flips the script and asks you questions to test understanding.

Homework — works through full problem sets, showing every step.

The key feature is barge-in. You can interrupt SolveWave mid-explanation. It stops immediately, listens to your follow-up, and responds — no button press, no waiting. This is what makes it feel like a real tutor instead of a voice assistant.


How It Works: WebRTC Audio + WebSocket Control

The architecture uses two communication channels working together:

```
Browser  <--WebRTC (Opus audio)--->  FastAPI Backend  <--Live API-->  Gemini
Browser  <--WebSocket (control)---->  FastAPI Backend
```

**WebRTC** handles real-time audio transport (primary path). The browser captures audio with echo cancellation, noise suppression, and auto gain control enabled at the hardware level. Audio is Opus-encoded and sent over DTLS/SRTP — lower latency than TCP.

**WebSocket** handles everything else — text messages, image uploads, signaling, status updates, and session control. It also serves as the fallback audio path (raw PCM binary frames) when WebRTC can't establish a connection (e.g., on Cloud Run without a TURN server).

The Backend

FastAPI with two concurrent asyncio tasks:

Upstream: audio (from WebRTC or WS fallback) flows through an asyncio.Queue to Gemini Live.

Downstream: Gemini's audio response streams back — either through WebRTC (Opus-encoded via a custom GeminiOutputTrack) or WebSocket binary frames.

The asyncio.Queue was a critical design choice. Both WebRTC and WebSocket audio sources feed the same queue, which decouples the receive path from the Gemini send loop. This prevents audio backpressure from blocking either connection and makes the fallback seamless.

Text and image requests use Gemini's standard generate API (gemini-2.5-flash) rather than the Live API, since they don't need streaming audio.

The Frontend

Next.js 14 with four key hooks:

useSessionSocket — WebSocket control channel, live state management, text/image messaging, WebRTC negotiation.

useWebRTC — RTCPeerConnection lifecycle, getUserMedia with AEC/NS/AGC, SDP offer/answer exchange, mic mute/unmute, remote audio auto-playback.

useVoiceTranscription — Web Speech API for live transcription (partial results update word-by-word, echo suppression while tutor speaks).

useSessionTimer — Session duration tracking in mm:ss format.

The UI tracks eight distinct live states (Idle, Connecting, Live, Listening, Thinking, Speaking, Seeing, Interrupted) — each with its own visual indicator so students always know what the tutor is doing.


The Hard Parts

WebRTC on Cloud Run

Cloud Run doesn't support raw UDP traffic, which WebRTC media requires. I solved this with a graceful fallback architecture:

1. Browser sends an SDP offer via the existing WebSocket
2. Backend (using aiortc) creates a peer connection and responds with an SDP answer
3. If ICE succeeds (local dev, or with a TURN server) — WebRTC audio flows
4. If ICE fails — the system automatically falls back to WebSocket binary audio

The browser still benefits from getUserMedia's AEC/NS/AGC constraints even in fallback mode. The student never knows which transport is active.

Barge-in UX

Gemini's Live API detects interruptions automatically — but surfacing that in the UI required care. When the backend receives an interruption signal, it:

1. Stops sending audio to the browser
2. Discards any partial response text
3. Sends an "interrupted" control message to the frontend
4. The UI flashes an orange "Interrupted" indicator for 900ms

The result: the student talks over SolveWave, it stops within a fraction of a second, and the UI confirms it happened. It feels natural.

Web Speech API Auto-Restart

Chrome's Web Speech API has a quirk: even with continuous mode enabled, it sometimes stops recognition after a final result. If you don't handle this, the student asks one question by voice and then transcription silently dies.

The fix: a wantRunningRef flag that tracks whether the user wants transcription active. When the recognition's onend fires unexpectedly, we check the flag and auto-restart a new instance — reusing the same event handlers. The user never notices.

Dual Audio + Text Response Path

When a student speaks, two things happen simultaneously:

1. Audio goes to Gemini Live API (via WebRTC/WS) for a voice response
2. Web Speech API transcribes locally, and the final transcript is sent to the standard text API for a guaranteed text response

This dual path means the student always gets both a spoken answer and a written transcript — even if one path hiccups.


Deployment: Cloud Run

Both frontend and backend deploy to Google Cloud Run with a single command each:

```
gcloud run deploy solvewave-backend \
  --source backend \
  --region us-central1 \
  --allow-unauthenticated
```

Cloud Run handles container builds, TLS termination (so WebSockets upgrade to wss:// automatically), and scales to zero when idle. I wrote deployment scripts for one-command deploys on any platform.

For judges and reviewers who don't have a Gemini API key, there's a stub mode (GEMINI_STUB=true) that returns canned responses — so you can test the full UX pipeline without any credentials.


The Stack

AI Model: Gemini 2.5 Flash — native audio (gemini-2.5-flash-native-audio-latest) + text/vision (gemini-2.5-flash)

SDK: Google GenAI SDK (google-genai Python package)

Backend: FastAPI + asyncio + aiortc (WebRTC) + WebSockets

Frontend: Next.js 14 (App Router) + Tailwind CSS + TypeScript + Framer Motion

Audio Transport: WebRTC (Opus, DTLS/SRTP) with WebSocket PCM fallback

Transcription: Web Speech API (browser-native, real-time)

Math Rendering: KaTeX (LaTeX in chat bubbles)

Cloud: Google Cloud Run (us-central1)

Tools: 4 structured tools — problem type detection, answer checking, hint generation, session recap


What I'd Build Next

Session persistence — save transcripts and recaps to Firestore so students can review past sessions.

Progress tracking — track which topics a student struggles with across sessions.

Multi-subject expansion — the architecture generalizes beyond math (science, language arts).

TURN server on GCE — full WebRTC audio on Cloud Run without fallback.


Try It

Live app: https://solvewave-frontend-872506223416.us-central1.run.app

Run locally (no API key needed):

```
# Backend with stub mode
cd backend && pip install -r requirements.txt
GEMINI_STUB=true uvicorn app.main:app --reload

# Frontend
cd frontend && npm install && npm run dev
```

Full source: https://github.com/Appenza-Main-Org/solvewave-live


Built for the Google Gemini Live Agent Challenge.

#GeminiLiveAgentChallenge #GoogleGemini #LiveAgents #AI #EdTech #MathTutor #CloudRun #GeminiLiveAPI #WebRTC
