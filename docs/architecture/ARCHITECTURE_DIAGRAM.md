# Architecture Diagram — Faheem Math (v0.5.1)

This document describes the architecture diagram for Faheem Math. Use this as a reference to create a visual diagram (PNG/SVG).

---

## Overview

Faheem Math uses a **single WebSocket connection** for all modalities (voice, text, images), with three main layers:

1. **Browser (Frontend)** — Next.js 14, React, Framer Motion, Web Audio API, Web Speech API
2. **Backend (API Layer)** — FastAPI, asyncio, WebSocket, mode routing
3. **Gemini Live API (Google Cloud)** — Audio, text, and vision processing

---

## Diagram Layout (Left -> Right)

```
+---------------------------------------------------------------------------+
|                    BROWSER (Next.js 14 + Framer Motion)                   |
|                    Deployed on: Google Cloud Run                           |
|                                                                           |
|  +---------------------------------------------------------------------+ |
|  |  User Interface (React Components)                                   | |
|  |                                                                       | |
|  |  +-- Header Bar (h-16) ----------------------------------------+     | |
|  |  |  FaheemLogo  Brand Title  ModeSelector  Timer  Help  Start  |     | |
|  |  +-------------------------------------------------------------+     | |
|  |                                                                       | |
|  |  +-- Main Layout (flex-row on lg) ----+---+-- Aside (xl only) --+    | |
|  |  |                                     |   |                     |    | |
|  |  |  +-- Ambient State Vis (h-56) --+  |   | ExamplesPanel       |    | |
|  |  |  |  AmbientOrb (animated SVG)   |  |   | (Study Curriculum)  |    | |
|  |  |  |  Live State Label + Body     |  |   |                     |    | |
|  |  |  +------------------------------+  |   | Quick Tip Card      |    | |
|  |  |                                     |   |                     |    | |
|  |  |  +-- Transcript Canvas ----------+ |   +---------------------+    | |
|  |  |  |  TranscriptPanel (scrollable) | |                              | |
|  |  |  |  - Tutor messages (avatar: F) | |                              | |
|  |  |  |  - Student messages (avt: U)  | |                              | |
|  |  |  |  - Partial transcripts (dim)  | |                              | |
|  |  |  +-------------------------------+ |                              | |
|  |  +------------------------------------+                              | |
|  |                                                                       | |
|  |  +-- Floating Composer (rounded-[2.5rem]) ----------------------+    | |
|  |  |  [Camera] [Mic/MicOff]  [Text Input]  [Send]                |    | |
|  |  |  - Camera: auto-capture + send (no upload step)              |    | |
|  |  |  - Mic: toggles voice + Web Speech transcription             |    | |
|  |  +--------------------------------------------------------------+    | |
|  |                                                                       | |
|  |  +-- HelpPanel (modal overlay) ---+                                  | |
|  |  |  Session info, usage guide     |                                  | |
|  |  +--------------------------------+                                  | |
|  +---------------------------------------------------------------------+ |
|                                                                           |
|  +---------------------------------------------------------------------+ |
|  |  Core Hooks & Services                                               | |
|  |                                                                       | |
|  |  +---------------------------+  +----------------------------------+ | |
|  |  | useSessionSocket.ts       |  | useVoiceTranscription.ts         | | |
|  |  | - WebSocket client        |  | - Web Speech API                 | | |
|  |  | - Send text/image         |  | - Partial & final transcripts    | | |
|  |  | - Audio playback (24kHz)  |  | - Echo suppression (isSpeaking)  | | |
|  |  | - Live state management   |  | - Auto-send finals to text API   | | |
|  |  | - Mic capture + resample  |  +----------------------------------+ | |
|  |  +---------------------------+                                       | |
|  |                                                                       | |
|  |  +---------------------------+  +----------------------------------+ | |
|  |  | Web Audio API             |  | useSessionTimer.ts               | | |
|  |  | - Mic: native rate -> 16k |  | - Start on WS connect            | | |
|  |  |   (linear interpolation)  |  | - Freeze on stop                 | | |
|  |  | - Playback: 24kHz PCM     |  | - mm:ss display                  | | |
|  |  | - ScriptProcessorNode     |  +----------------------------------+ | |
|  |  +---------------------------+                                       | |
|  +---------------------------------------------------------------------+ |
+---------------------------------------------------------------------------+
                            |
                            | WebSocket: /ws/session
                            | - Binary frames (PCM audio, 16kHz -> 24kHz)
                            | - JSON frames (text, image, control)
                            |
                            v
+---------------------------------------------------------------------------+
|                   BACKEND (FastAPI + asyncio)                              |
|                   Deployed on: Google Cloud Run                            |
|                                                                           |
|  +---------------------------------------------------------------------+ |
|  |  main.py -- FastAPI Application                                      | |
|  |  - CORS middleware (CORS_ORIGINS)                                    | |
|  |  - GET /health (model info, stub mode indicator)                     | |
|  |  - WS /ws/session (single endpoint for all interactions)             | |
|  +---------------------------------------------------------------------+ |
|                                                                           |
|  +---------------------------------------------------------------------+ |
|  |  session_manager.py -- WebSocket Lifecycle                           | |
|  |                                                                       | |
|  |  +--- handle_session() -- async entry point -----------------------+ | |
|  |  |  1. Accept WebSocket connection                                 | | |
|  |  |  2. Send {"type":"status","value":"connected"}                  | | |
|  |  |  3. Create asyncio.Queue (decouples receive from Gemini)        | | |
|  |  |  4. Run two concurrent tasks:                                   | | |
|  |  |     - receive_loop() -- Browser -> Queue                        | | |
|  |  |     - LiveClient.run() -- Queue -> Gemini -> Browser            | | |
|  |  |  5. On disconnect: build & send recap                           | | |
|  |  +----------------------------------------------------------------+ | |
|  |                                                                       | |
|  |  +--- Message Routing (based on JSON "type") ---------------------+ | |
|  |  |  - "text"  -> LiveClient.generate_text_reply()                  | | |
|  |  |  - "image" -> LiveClient.generate_image_reply()                 | | |
|  |  |  - binary  -> audio_queue.put(bytes)                            | | |
|  |  |  - "END"   -> audio_queue.put(None) -> graceful shutdown        | | |
|  |  +----------------------------------------------------------------+ | |
|  |                                                                       | |
|  |  +--- Mode Addendums (injected at runtime) -----------------------+ | |
|  |  |  - base_prompt + MODE_ADDENDUM[mode]                            | | |
|  |  |  - "explain" -> step-by-step coaching                           | | |
|  |  |  - "quiz"    -> ask questions, check answers                    | | |
|  |  |  - "homework"-> full solution walkthrough                       | | |
|  |  +----------------------------------------------------------------+ | |
|  +---------------------------------------------------------------------+ |
|                                                                           |
|  +---------------------------------------------------------------------+ |
|  |  live_client.py -- Gemini Live API Bridge                            | |
|  |                                                                       | |
|  |  +--------------------------------------+                            | |
|  |  |  run() -- Bidirectional audio stream |                            | |
|  |  |  1. Connect to Gemini Live API       |                            | |
|  |  |  2. Send system prompt + config      |                            | |
|  |  |  3. Concurrent tasks:                |                            | |
|  |  |     - upstream:   mic -> Gemini      |                            | |
|  |  |     - downstream: Gemini -> speaker  |                            | |
|  |  |  4. Detect barge-in -> send interr.  |                            | |
|  |  +--------------------------------------+                            | |
|  |                                                                       | |
|  |  +--------------------------------------+                            | |
|  |  |  generate_text_reply()               |                            | |
|  |  |  - Uses standard Gemini API          |                            | |
|  |  |  - Multi-turn chat history           |                            | |
|  |  +--------------------------------------+                            | |
|  |                                                                       | |
|  |  +--------------------------------------+                            | |
|  |  |  generate_image_reply()              |                            | |
|  |  |  - Decode base64 image               |                            | |
|  |  |  - Send to Gemini multimodal API     |                            | |
|  |  +--------------------------------------+                            | |
|  +---------------------------------------------------------------------+ |
|                                                                           |
|  +---------------------------------------------------------------------+ |
|  |  tutor_agent.py -- Faheem Persona & Tools                            | |
|  |  - system_prompt.md (math tutor persona)                             | |
|  |  - Tool schemas: detect_problem_type, check_answer,                  | |
|  |                  generate_next_hint, build_session_recap              | |
|  +---------------------------------------------------------------------+ |
+---------------------------------------------------------------------------+
                            |
                            | google-genai SDK (Python)
                            | - GEMINI_API_KEY
                            |
                            v
+---------------------------------------------------------------------------+
|                      GEMINI LIVE API (Google Cloud)                        |
|                                                                           |
|  +---------------------------------------------------------------------+ |
|  |  gemini-2.5-flash-native-audio-latest (Voice)                        | |
|  |  - Real-time audio streaming (16kHz in, 24kHz out)                   | |
|  |  - Full-duplex (can listen and speak simultaneously)                 | |
|  |  - Barge-in detection (knows when user interrupts)                   | |
|  |  - Tool use: calls structured functions defined by TutorAgent        | |
|  |  - Voice: Charon                                                     | |
|  +---------------------------------------------------------------------+ |
|                                                                           |
|  +---------------------------------------------------------------------+ |
|  |  gemini-2.5-flash (Text + Vision)                                    | |
|  |  - Text-based interactions (multi-turn chat history)                 | |
|  |  - Multimodal vision (reads handwritten/printed math from images)    | |
|  |  - Tool use: same structured functions as audio model                | |
|  +---------------------------------------------------------------------+ |
+---------------------------------------------------------------------------+
```

---

## Data Flow Examples

### 1. Voice Interaction (Listening -> Speaking)

```
Student speaks -> AudioContext captures at native rate ->
  ScriptProcessorNode resamples to 16kHz via linear interpolation ->
    WebSocket sends binary frame (Int16Array) ->
      Backend audio_queue.put(bytes) ->
        LiveClient streams to Gemini Live API ->
          Gemini processes & responds with PCM (24kHz) ->
            Backend sends binary frame to WebSocket ->
              Browser plays audio via AudioContext (24kHz)
```

**Live States:** Listening -> Thinking -> Speaking

### 2. Voice Transcription + Text API (Dual Path)

```
Student speaks -> Web Speech API transcribes locally ->
  onPartialTranscript: update transcript in-place (partial=true) ->
    onFinalTranscript: finalize transcript entry + send to text API ->
      Backend routes to generate_text_reply() ->
        Gemini standard API responds with text ->
          Backend sends {"type":"message","role":"tutor","text":"..."} ->
            Frontend adds tutor message to transcript
```

> Note: Student speech is simultaneously sent to Gemini Live (audio) AND
> transcribed to text API. This ensures both voice and text responses.

### 3. Barge-in (Interruption)

```
Student speaks while Faheem is speaking ->
  Web Audio API continues sending mic input ->
    Gemini Live API detects interruption ->
      Backend receives interruption signal ->
        Backend sends {"type":"status","value":"interrupted"} ->
          Frontend shows "Interrupted" state (orange pulse, 900ms)
```

**Live States:** Speaking -> Interrupted -> Listening

### 4. Text Message

```
Student types text -> Click Send ->
  WebSocket sends JSON {"type":"text","text":"...","mode":"explain"} ->
    Backend routes to generate_text_reply() ->
      LiveClient calls Gemini standard API (gemini-2.5-flash) ->
        Gemini responds with text ->
          Backend sends {"type":"message","role":"tutor","text":"..."} ->
            Frontend adds to transcript
```

**Live States:** Connected -> Thinking -> Connected

### 5. Camera Auto-Send (Vision)

```
Student taps Camera button -> native file picker opens (capture="environment") ->
  Student captures photo -> handleImagePick fires ->
    sendImage(file, "", mode) called immediately (no staging) ->
      WebSocket sends JSON {"type":"image","mimeType":"...","data":"base64..."} ->
        Backend decodes base64 ->
          LiveClient calls Gemini multimodal API (gemini-2.5-flash) ->
            Gemini reads image & generates text response ->
              Backend sends {"type":"message","role":"tutor","text":"..."} ->
                Frontend adds to transcript + shows feedback toast
```

**Live States:** Connected -> Seeing -> Connected

### 6. Session Timer & Recap

```
Session starts -> Frontend starts timer (mm:ss) ->
  Timer updates every second ->
    Student clicks "End Session" ->
      WebSocket sends "END" ->
        Backend stops audio_queue ->
          Backend calls build_session_recap(duration_seconds) ->
            Backend sends {"type":"recap","data":{...,"duration_seconds":123}} ->
              Frontend displays recap (summary + duration)
```

---

## Key Architectural Decisions

1. **Single WebSocket** -- All modalities (voice, text, images) use one connection
   - Simplifies state management
   - Reduces connection overhead
   - Easier to track session lifecycle

2. **asyncio.Queue decoupling** -- WebSocket receive -> Queue -> Gemini
   - Prevents backpressure (WebSocket can buffer faster than Gemini consumes)
   - Clean separation of concerns

3. **Mode addendums at runtime** -- Base prompt + injected mode behavior
   - Keeps tutor persona consistent
   - Allows mode switching without restarting session
   - Easier to maintain than 3 separate prompts

4. **Two models** -- Live API for voice, standard API for text/images
   - Gemini Live is optimized for audio streaming
   - Standard API is faster for text-only and more cost-effective

5. **Audio resampling** -- Native rate -> 16kHz via linear interpolation
   - Mobile browsers (iOS Safari) may ignore AudioContext sampleRate option
   - ScriptProcessorNode captures at native rate (44.1/48kHz)
   - Linear interpolation resamples to 16kHz before sending to backend
   - Ensures correct PCM format regardless of device

6. **Dual response path** -- Voice + text API for speech input
   - Web Speech API provides local transcription (no backend cost)
   - Final transcripts always sent to text API for guaranteed text response
   - Gemini Live may also provide voice response via audio stream
   - Echo suppression: transcription ignores audio while isSpeaking

7. **Camera auto-send** -- No staging step for images
   - `capture="environment"` opens native camera directly
   - Image sent immediately on file selection (no upload button)
   - Visual feedback toast shows "Image Sent" briefly

8. **Obsidian theme** -- Deep dark UI with state-reactive colors
   - Custom obsidian color palette (50-950)
   - AmbientOrb SVG visualization reacts to liveState
   - Background grid + glow animate with state color
   - Framer Motion for smooth state transitions

9. **Live state indicator** -- 9 distinct states visible in UI
   - Transparent "what is Faheem doing right now"
   - AmbientOrb + dot indicator + label all reflect state
   - Helps students understand when to speak
   - Makes barge-in detection visible

---

## Frontend Component Tree

```
RootLayout (layout.tsx)
  +-- Cairo font (next/font/google, --font-cairo)
  +-- SessionPage (/session/page.tsx)
      |
      +-- Background Logic Grid (radial gradient, state-colored)
      +-- Background Glow (Framer Motion, animated blur)
      |
      +-- Header Bar
      |   +-- FaheemLogo (custom SVG)
      |   +-- Brand Title ("Faheem Math")
      |   +-- Status Dot (animated, state-colored)
      |   +-- ModeSelector (segmented: Explain/Quiz/Homework) [desktop]
      |   +-- Timer Display (mm:ss, mono font)
      |   +-- HelpCircle Button
      |   +-- Start/End Session Button
      |
      +-- Main Layout
      |   +-- ModeSelector [mobile only]
      |   +-- Center Section
      |   |   +-- Ambient State Visualization
      |   |   |   +-- AmbientOrb (animated SVG, state-reactive)
      |   |   |   +-- Live State Label + Description
      |   |   +-- Transcript Canvas (rounded glass card)
      |   |       +-- TranscriptPanel (scrollable, F/U avatars)
      |   |
      |   +-- Aside (xl only)
      |       +-- ExamplesPanel (Study Curriculum)
      |       +-- Quick Tip Card
      |
      +-- Floating Composer (rounded-[2.5rem], glass blur)
      |   +-- Camera Button (auto-capture + send)
      |   +-- Mic Toggle (voice + transcription)
      |   +-- Text Input (textarea)
      |   +-- Send Button
      |
      +-- HelpPanel (modal overlay)
```

---

## Hooks Dependency Graph

```
SessionPage
  |
  +-- useSessionSocket()
  |   +-- WebSocket connection management
  |   +-- startSession / stopSession
  |   +-- sendText / sendTextQuiet / sendImage
  |   +-- startVoice / stopVoice
  |   +-- Mic capture (AudioContext + ScriptProcessorNode + resample)
  |   +-- Audio playback (24kHz PCM via AudioContext)
  |   +-- LiveState management (9 states)
  |   +-- Transcript state (messages array)
  |
  +-- useVoiceTranscription({ onPartial, onFinal })
  |   +-- Web Speech API (SpeechRecognition)
  |   +-- Partial transcripts -> update in-place
  |   +-- Final transcripts -> finalize + send to text API
  |   +-- Echo suppression (skip if isSpeaking)
  |
  +-- useSessionTimer(isActive)
      +-- Start counting on isActive=true
      +-- Returns formatted mm:ss string
```

---

**Last updated:** 2026-03-04 (v0.5.1)
