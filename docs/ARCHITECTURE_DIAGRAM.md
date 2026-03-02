# Architecture Diagram — Faheem Math

This document describes the architecture diagram for Faheem Math. Use this as a reference to create a visual diagram (PNG/SVG).

---

## Overview

Faheem Math uses a **single WebSocket connection** for all modalities (voice, text, images), with three main layers:

1. **Browser (Frontend)** — Next.js 14, React, Web Audio API, Web Speech API
2. **Backend (API Layer)** — FastAPI, asyncio, WebSocket, mode routing
3. **Gemini Live API (Google Cloud)** — Audio, text, and vision processing

---

## Diagram Layout (Left → Right)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Next.js 14)                              │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  User Interface (React Components)                                   │ │
│  │                                                                       │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │ │
│  │  │ Transcript  │  │    Mode     │  │  Examples   │  │Help/About  │  │ │
│  │  │   Panel     │  │  Selector   │  │   Panel     │  │   Panel    │  │ │
│  │  │  (F / U)    │  │(Exp/Qz/HW)  │  │ (Hints)     │  │(Status,WS) │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Live State Indicator                                            │ │ │
│  │  │  (Idle, Connecting, Live, Listening, Thinking, Speaking,         │ │ │
│  │  │   Seeing, Interrupted, Error)                                    │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Composer (Input Bar)                                            │ │ │
│  │  │  [📷 Image] [🎙 Voice] [Text Input] [↑ Send]                    │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Session Timer (mm:ss)                                           │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  Core Hooks & Services                                               │ │
│  │                                                                       │ │
│  │  ┌───────────────────────┐  ┌────────────────────────────────────┐  │ │
│  │  │ useSessionSocket.ts   │  │ useVoiceTranscription.ts           │  │ │
│  │  │ - WebSocket client    │  │ - Web Speech API                   │  │ │
│  │  │ - Send text/image     │  │ - Partial & final transcripts      │  │ │
│  │  │ - Audio playback      │  │ - Auto-send captions to backend    │  │ │
│  │  │ - Live state mgmt     │  │   (optional toggle)                │  │ │
│  │  └───────────────────────┘  └────────────────────────────────────┘  │ │
│  │                                                                       │ │
│  │  ┌───────────────────────┐  ┌────────────────────────────────────┐  │ │
│  │  │ Web Audio API         │  │ Session Timer                      │  │ │
│  │  │ - Mic capture 16kHz   │  │ - Start on WS connect              │  │ │
│  │  │ - Playback 24kHz      │  │ - Freeze on stop                   │  │ │
│  │  │ - PCM <-> Int16       │  │ - Include in recap                 │  │ │
│  │  └───────────────────────┘  └────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬───────────────────────────────────────────────┘
                             │
                             │ WebSocket: /ws/session
                             │ - Binary frames (PCM audio, 16kHz → 24kHz)
                             │ - JSON frames (text, image, control)
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI + asyncio)                              │
│                   Deployed on: Google Cloud Run                            │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  main.py — FastAPI Application                                       │ │
│  │  - CORS middleware (CORS_ORIGINS)                                    │ │
│  │  - GET /health (model info, stub mode indicator)                     │ │
│  │  - WS /ws/session (single endpoint for all interactions)             │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  session_manager.py — WebSocket Lifecycle                            │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │  handle_session() — async entry point                           │ │ │
│  │  │  1. Accept WebSocket connection                                 │ │ │
│  │  │  2. Send {"type":"status","value":"connected"}                  │ │ │
│  │  │  3. Create asyncio.Queue (decouples receive from Gemini)        │ │ │
│  │  │  4. Run two concurrent tasks:                                   │ │ │
│  │  │     - receive_loop() — Browser → Queue                          │ │ │
│  │  │     - LiveClient.run() — Queue → Gemini → Browser               │ │ │
│  │  │  5. On disconnect: build & send recap                           │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Message Routing (based on JSON "type")                         │ │ │
│  │  │  - "text"  → LiveClient.generate_text_reply()                   │ │ │
│  │  │  - "image" → LiveClient.generate_image_reply()                  │ │ │
│  │  │  - binary  → audio_queue.put(bytes)                             │ │ │
│  │  │  - "END"   → audio_queue.put(None) → graceful shutdown          │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │  Mode Addendums (injected at runtime)                           │ │ │
│  │  │  - base_prompt + MODE_ADDENDUM[mode]                            │ │ │
│  │  │  - "explain" → step-by-step coaching                            │ │ │
│  │  │  - "quiz"    → ask questions, check answers                     │ │ │
│  │  │  - "homework"→ full solution walkthrough                        │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  live_client.py — Gemini Live API Bridge                             │ │
│  │                                                                       │ │
│  │  ┌────────────────────────────────────────┐                         │ │
│  │  │  run() — Bidirectional audio stream    │                         │ │
│  │  │  1. Connect to Gemini Live API         │                         │ │
│  │  │  2. Send system prompt + config        │                         │ │
│  │  │  3. Concurrent tasks:                  │                         │ │
│  │  │     - upstream:   mic → Gemini         │                         │ │
│  │  │     - downstream: Gemini → speaker     │                         │ │
│  │  │  4. Detect barge-in → send interrupt   │                         │ │
│  │  └────────────────────────────────────────┘                         │ │
│  │                                                                       │ │
│  │  ┌────────────────────────────────────────┐                         │ │
│  │  │  generate_text_reply()                 │                         │ │
│  │  │  - Uses standard Gemini API            │                         │ │
│  │  │  - Multi-turn chat history             │                         │ │
│  │  └────────────────────────────────────────┘                         │ │
│  │                                                                       │ │
│  │  ┌────────────────────────────────────────┐                         │ │
│  │  │  generate_image_reply()                │                         │ │
│  │  │  - Decode base64 image                 │                         │ │
│  │  │  - Send to Gemini multimodal API       │                         │ │
│  │  └────────────────────────────────────────┘                         │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  tutor_agent.py — Faheem Persona & Tools                             │ │
│  │  - system_prompt.md (math tutor persona)                             │ │
│  │  - Tool schemas: detect_problem_type, check_answer,                  │ │
│  │                  generate_next_hint, build_session_recap             │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬───────────────────────────────────────────────┘
                             │
                             │ google-genai SDK (Python)
                             │ - GEMINI_API_KEY
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                      GEMINI LIVE API (Google Cloud)                        │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  gemini-2.5-flash-native-audio-latest (Voice)                        │ │
│  │  - Real-time audio streaming (16kHz in, 24kHz out)                   │ │
│  │  - Full-duplex (can listen and speak simultaneously)                 │ │
│  │  - Barge-in detection (knows when user interrupts)                   │ │
│  │  - Tool use: calls structured functions defined by TutorAgent        │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │  gemini-2.5-flash (Text + Vision)                                    │ │
│  │  - Text-based interactions (multi-turn chat history)                 │ │
│  │  - Multimodal vision (reads handwritten/printed math from images)    │ │
│  │  - Tool use: same structured functions as audio model                │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Examples

### 1. Voice Interaction (Listening → Speaking)

```
Student speaks → Web Audio API captures PCM (16kHz) →
  WebSocket sends binary frame →
    Backend audio_queue.put(bytes) →
      LiveClient streams to Gemini Live API →
        Gemini processes & responds with PCM (24kHz) →
          Backend sends binary frame to WebSocket →
            Browser plays audio via Web Audio API
```

**Live States:** Listening → Thinking → Speaking

### 2. Barge-in (Interruption)

```
Student speaks while Faheem is speaking →
  Web Audio API continues sending mic input →
    Gemini Live API detects interruption →
      Backend receives interruption signal →
        Backend sends {"type":"status","value":"interrupted"} →
          Frontend shows "Interrupted" state (orange pulse, 900ms)
```

**Live States:** Speaking → Interrupted → Listening

### 3. Text Message

```
Student types text → Click Send →
  WebSocket sends JSON {"type":"text","text":"...","mode":"explain"} →
    Backend routes to generate_text_reply() →
      LiveClient calls Gemini standard API (gemini-2.5-flash) →
        Gemini responds with text →
          Backend sends {"type":"message","role":"tutor","text":"..."} →
            Frontend adds to transcript
```

**Live States:** Connected → Thinking → Connected

### 4. Image Upload (Vision)

```
Student uploads photo → Composer converts to base64 →
  WebSocket sends JSON {"type":"image","mimeType":"...","data":"base64..."} →
    Backend decodes base64 →
      LiveClient calls Gemini multimodal API (gemini-2.5-flash) →
        Gemini reads image & generates text response →
          Backend sends {"type":"message","role":"tutor","text":"..."} →
            Frontend adds to transcript
```

**Live States:** Connected → Seeing → Connected

### 5. Session Timer & Recap

```
Session starts → Frontend starts timer (mm:ss) →
  Timer updates every second →
    Student clicks "End session" →
      WebSocket sends "END" →
        Backend stops audio_queue →
          Backend calls build_session_recap(duration_seconds) →
            Backend sends {"type":"recap","data":{...,"duration_seconds":123}} →
              Frontend displays recap (summary + duration)
```

---

## Key Architectural Decisions

1. **Single WebSocket** — All modalities (voice, text, images) use one connection
   - Simplifies state management
   - Reduces connection overhead
   - Easier to track session lifecycle

2. **asyncio.Queue decoupling** — WebSocket receive → Queue → Gemini
   - Prevents backpressure (WebSocket can buffer faster than Gemini consumes)
   - Clean separation of concerns

3. **Mode addendums at runtime** — Base prompt + injected mode behavior
   - Keeps tutor persona consistent
   - Allows mode switching without restarting session
   - Easier to maintain than 3 separate prompts

4. **Two models** — Live API for voice, standard API for text/images
   - Gemini Live is optimized for audio streaming
   - Standard API is faster for text-only and more cost-effective

5. **Web Speech API for transcription** — Browser-native, no backend cost
   - Real-time partial transcripts (live captions)
   - Final transcripts lock in after utterance
   - Optional: send final transcripts to Gemini for context

6. **Live state indicator** — 9 distinct states visible in UI
   - Transparent "what is Faheem doing right now"
   - Helps students understand when to speak
   - Makes barge-in detection visible

---

## Tools to Create the Diagram

Recommended tools for creating the visual diagram:
- **Excalidraw** (https://excalidraw.com) — Hand-drawn style, PNG export
- **Draw.io / diagrams.net** — Professional flowcharts, SVG/PNG export
- **Figma** — Design-focused, shareable links
- **Mermaid** (in Markdown) — Code-based diagrams (less visual but version-controlled)

**Export to:** `docs/architecture-diagram.png`

---

## Diagram Checklist

- [ ] Show all 3 layers (Browser, Backend, Gemini API)
- [ ] Indicate WebSocket connection (bidirectional arrow)
- [ ] Label binary frames (audio) vs JSON frames (control/text/image)
- [ ] Show asyncio.Queue in backend
- [ ] Show two concurrent tasks (upstream/downstream)
- [ ] Show mode routing (explain/quiz/homework)
- [ ] Show two Gemini models (Live vs standard)
- [ ] Include live state flow (Idle → Connecting → Live → Listening → ...)
- [ ] Include session timer & recap flow
- [ ] Label deployment platform (Google Cloud Run)

---

**Last updated:** 2026-03-02
