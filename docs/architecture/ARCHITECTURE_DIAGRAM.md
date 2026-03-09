# Architecture Diagram — Faheem Math (v0.6.0)

This document describes the architecture diagram for Faheem Math. Use this as a reference to create a visual diagram (PNG/SVG).

---

## Overview

Faheem Math uses **WebRTC for real-time audio transport** (with WebSocket fallback) and a **WebSocket control channel** for text, images, and signaling, with three main layers:

1. **Browser (Frontend)** — Next.js 14, React, Framer Motion, WebRTC, Web Speech API
2. **Backend (API Layer)** — FastAPI, asyncio, aiortc (WebRTC), WebSocket, mode routing
3. **Gemini Live API (Google Cloud)** — Audio, text, and vision processing

### Audio Transport: WebRTC (Primary) vs WebSocket (Fallback)

| Aspect | WebRTC (Primary) | WebSocket (Fallback) |
|--------|------------------|----------------------|
| **Transport** | DTLS/SRTP over UDP | TCP (binary frames) |
| **Codec** | Opus (browser-native) | Raw PCM (16-bit) |
| **Echo Cancellation** | Browser-level AEC | Software guard only |
| **Noise Suppression** | Browser-level NS | None |
| **Auto Gain Control** | Browser-level AGC | None |
| **Playback** | Automatic (remote track) | Manual PCM scheduling |
| **Signaling** | Via existing WebSocket | N/A |
| **Fallback trigger** | ICE failure / no UDP | Automatic |

**Competition compliance**: Gemini Live API remains the mandatory AI engine. WebRTC is only the browser ↔ backend audio transport layer. All audio is still processed by Gemini Live API on Google Cloud.

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
|  |  | useSessionSocket.ts       |  | useWebRTC.ts                     | | |
|  |  | - WebSocket control chan.  |  | - RTCPeerConnection management   | | |
|  |  | - Send text/image (JSON)  |  | - getUserMedia (AEC/NS/AGC)      | | |
|  |  | - WebRTC negotiation      |  | - SDP offer/answer via WS        | | |
|  |  | - Live state management   |  | - Mic mute/unmute for voice      | | |
|  |  | - WS binary fallback      |  | - Remote audio auto-playback     | | |
|  |  +---------------------------+  +----------------------------------+ | |
|  |                                                                       | |
|  |  +---------------------------+  +----------------------------------+ | |
|  |  | useVoiceTranscription.ts  |  | useSessionTimer.ts               | | |
|  |  | - Web Speech API          |  | - Start on WS connect            | | |
|  |  | - Partial & final transc. |  | - Freeze on stop                 | | |
|  |  | - Echo suppression        |  | - mm:ss display                  | | |
|  |  | - Auto-send to text API   |  +----------------------------------+ | |
|  |  +---------------------------+                                       | |
|  +---------------------------------------------------------------------+ |
+---------------------------------------------------------------------------+
                            |
                            | WebRTC: audio (primary)
                            | - Opus-encoded bidirectional audio
                            | - Browser AEC/NS/AGC applied
                            |
                            | WebSocket: /ws/session (control + fallback)
                            | - JSON frames (text, image, signaling, control)
                            | - Binary frames (PCM audio -- fallback only)
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
|  |  session_manager.py -- WebSocket Lifecycle + WebRTC Signaling        | |
|  |                                                                       | |
|  |  +--- handle_session() -- async entry point -----------------------+ | |
|  |  |  1. Accept WebSocket connection                                 | | |
|  |  |  2. Send {"type":"status","value":"connected", "ice_servers":…} | | |
|  |  |  3. Create asyncio.Queue (decouples receive from Gemini)        | | |
|  |  |  4. Run two concurrent tasks:                                   | | |
|  |  |     - receive_loop() -- Browser -> Queue (+ RTC signaling)      | | |
|  |  |     - LiveClient.run() -- Queue -> Gemini -> Browser            | | |
|  |  |  5. On disconnect: close WebRTC + build & send recap            | | |
|  |  +----------------------------------------------------------------+ | |
|  |                                                                       | |
|  |  +--- Message Routing (based on JSON "type") ---------------------+ | |
|  |  |  - "rtc_offer" -> WebRTCHandler.handle_offer() -> rtc_answer    | | |
|  |  |  - "text"  -> LiveClient.generate_text_reply()                  | | |
|  |  |  - "image" -> LiveClient.generate_image_reply()                 | | |
|  |  |  - binary  -> audio_queue.put(bytes) [WS fallback only]         | | |
|  |  |  - "END"   -> audio_queue.put(None) -> graceful shutdown        | | |
|  |  +----------------------------------------------------------------+ | |
|  |                                                                       | |
|  |  +--- webrtc_handler.py -- WebRTC Audio Transport -----------------+ | |
|  |  |  - aiortc RTCPeerConnection (STUN/TURN configurable)            | | |
|  |  |  - Incoming: browser audio -> decode Opus -> resample 16kHz     | | |
|  |  |  - Outgoing: Gemini 24kHz PCM -> resample 48kHz -> encode Opus  | | |
|  |  |  - GeminiOutputTrack (custom MediaStreamTrack for response)     | | |
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

**WebRTC mode (primary):**
```
Student speaks -> getUserMedia (AEC/NS/AGC enabled) ->
  WebRTC audio track -> Opus encoded -> DTLS/SRTP ->
    Backend aiortc decodes Opus -> resample to 16kHz PCM ->
      audio_queue -> LiveClient streams to Gemini Live API ->
        Gemini responds with 24kHz PCM ->
          Backend resamples to 48kHz -> GeminiOutputTrack -> Opus encode ->
            WebRTC audio track -> Browser auto-plays via <audio> element
```

**WebSocket fallback mode:**
```
Student speaks -> getUserMedia (AEC/NS/AGC enabled) ->
  ScriptProcessorNode resamples to 16kHz via linear interpolation ->
    WebSocket sends binary frame (Int16Array) ->
      Backend audio_queue.put(bytes) ->
        LiveClient streams to Gemini Live API ->
          Gemini responds with 24kHz PCM ->
            Backend sends binary frame via WebSocket ->
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

1. **WebRTC audio transport** -- Browser ↔ backend audio via WebRTC (aiortc)
   - Opus codec with browser-native AEC, noise suppression, auto gain control
   - UDP-based transport (lower latency than TCP WebSocket)
   - Automatic fallback to WebSocket binary audio if WebRTC fails
   - Signaling via existing WebSocket (no separate signaling server)
   - STUN/TURN servers configurable for NAT traversal

2. **WebSocket control channel** -- Text, images, signaling, and state over one WS
   - Simplifies state management
   - Reduces connection overhead
   - WebRTC signaling (SDP offer/answer) flows over same WS

3. **asyncio.Queue decoupling** -- Audio source (WebRTC or WS) -> Queue -> Gemini
   - Both WebRTC and WS fallback feed the same audio queue
   - Prevents backpressure
   - Clean separation of concerns

4. **Mode addendums at runtime** -- Base prompt + injected mode behavior
   - Keeps tutor persona consistent
   - Allows mode switching without restarting session
   - Easier to maintain than 3 separate prompts

5. **Two models** -- Live API for voice, standard API for text/images
   - Gemini Live is optimized for audio streaming
   - Standard API is faster for text-only and more cost-effective

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
  |   +-- useWebRTC()                          <-- NEW: WebRTC audio transport
  |   |   +-- RTCPeerConnection management
  |   |   +-- getUserMedia (AEC/NS/AGC)
  |   |   +-- SDP offer/answer exchange via WS
  |   |   +-- Remote audio track auto-playback
  |   |   +-- Mic mute/unmute for voice toggle
  |   +-- WebSocket control channel
  |   +-- startSession / stopSession
  |   +-- sendText / sendTextQuiet / sendImage
  |   +-- startVoice / stopVoice (WebRTC or WS fallback)
  |   +-- WS fallback: ScriptProcessorNode + resample + PCM playback
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

## Cloud Run Deployment Note

Cloud Run supports HTTP/1.1, HTTP/2, gRPC, and WebSocket — but **not raw UDP traffic**.
WebRTC media transport requires UDP, so for Cloud Run deployments:

- **Without TURN server**: WebRTC falls back to WebSocket binary audio automatically.
  The browser still benefits from `getUserMedia` AEC/NS/AGC constraints.
- **With TURN server** (on a GCE VM or managed service): Full WebRTC audio works.
  Configure via `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` environment variables.
- **Local development**: WebRTC works directly (host candidates on same machine/LAN).

---

**Last updated:** 2026-03-09 (v0.6.0 — WebRTC audio transport)
