# Demo Script — SolveWave (4-Minute Live Demo)

**Duration:** 3:50 (10-second buffer under the 4-minute limit)
**Audience:** Gemini Live Agent Challenge judges
**Goal:** Hit all three judging criteria — Innovation & Multimodal UX (40%), Technical Implementation (30%), Demo & Presentation (30%)
**Version:** v0.9.0
**Live URL:** https://solvewave-frontend-872506223416.us-central1.run.app

---

## Script

### [0:00–0:15] Hook — The Problem (15 seconds)

**[Show the session page, idle state. Camera/mic off. Clean obsidian dark UI with the "Your Live Math Tutor is Ready" empty state. Status strip shows "Ready".]**

> "Most AI tutoring tools are just glorified chat boxes — you type a question, wait, get a wall of text. That's not how real tutoring works.
>
> Real tutoring is a conversation. You talk, you interrupt, you point at a problem. That's what **SolveWave** does."

**Why this works for judges:** Opens with the "breaks beyond text-box paradigm" criterion (40% of score). Sets up the contrast immediately.

---

### [0:15–0:30] Start Session — Show It's Live (15 seconds)

**[Click the green "Start Session" button (top-right of header)]**

> "One click to start a live session."

**[Point to the status strip as it transitions: "Connecting..." (yellow) → "Live" (emerald). The background grid dots and ambient glow also shift color. The mic activates automatically.]**

> "Watch the status indicator — **Connecting**… **Live**. The mic activates automatically. Audio is now streaming full-duplex to Gemini's Live API via WebRTC, with WebSocket binary fallback on Cloud Run. No latency. No turn-taking."

**Why this works for judges:** Shows "truly live, not fragmented/turn-based" (Innovation criterion). Real-time state changes are visible in the status strip and background effects.

---

### [0:30–1:15] Voice Explanation — Explain Mode (45 seconds)

**[Speak clearly into mic — the Explain tab should be selected by default]**

> "Explain how to solve 2x plus 5 equals 17."

**[As you speak, your words appear in the transcript as a student message (right-aligned dark bubble). Status changes: "Listening" (rose) → "Thinking" (sky blue) → "Speaking" (emerald).]**

> "My words appear live in the transcript. Watch the status shift to **Thinking**, then **Speaking**."

**[SolveWave starts responding. Point to the streaming text appearing word-by-word in the transcript, with the emerald highlight moving across the current phrase.]**

> "And here's the key feature — the tutor's response appears in real-time, word by word, synced with the voice. See the green highlight moving across the text? That's word-level tracking — you can follow along as the tutor speaks, just like reading subtitles."

**[Let SolveWave speak for ~15-20 seconds. Point to the "Speaking" badge and the emerald side indicator bar glowing on the active message.]**

> "The tutor response has numbered steps, math rendering, and a pulsing 'Speaking' badge so you always know what's happening."

---

### [1:15–1:55] Barge-in — The Hero Moment (40 seconds)

**[CRITICAL: Time this so SolveWave is mid-sentence when you interrupt. This is the most important feature for the Live Agents category.]**

**[METHOD 1 — Voice barge-in: While SolveWave is still speaking, speak loudly and clearly:]**

> "Wait — what happens to the 5?"

**[If voice barge-in triggers, point to the status flashing orange "Interrupted" and the ✋ emoji appended to the tutor's truncated message.]**

**[METHOD 2 — Tap interrupt: If voice isn't picked up, tap the orange ✋ interrupt button that appears in the composer bar while the tutor is speaking.]**

> "Watch — SolveWave stopped mid-sentence. I just interrupted, exactly like you'd interrupt a real tutor. There's an orange interrupt button for guaranteed barge-in, or you can just speak over it — the app uses energy-based voice detection to distinguish your actual voice from speaker echo.
>
> This is **barge-in handling** — Gemini's Live API gracefully stops its output when it detects I'm speaking."

**[SolveWave answers the follow-up. Let it speak ~10 seconds.]**

> "And now it's answering my follow-up — context preserved, no confusion."

**Why this works for judges:** Barge-in is the #1 differentiator for the Live Agents category. The truncated message with ✋ makes the interruption visually undeniable.

---

### [1:55–2:20] Quiz Mode — Behavior Adapts (25 seconds)

**[Click "Quiz" tab in the ModeSelector (segmented control in header on desktop, or top row on mobile)]**

> "I'll switch to **Quiz mode** mid-session."

**[Speak:]**

> "Quiz me on solving equations."

**[SolveWave asks a question instead of explaining. Response streams in with word highlighting.]**

> "Same tutor, different behavior — instead of explaining, it's testing me with a question. The system injects mode-specific instructions at runtime, so the tutor persona stays consistent but the pedagogical approach changes.
>
> There's also **Homework mode** for working through full problem sets."

---

### [2:20–3:05] Vision — Camera Auto-Send (45 seconds)

**[Click "Homework" tab, then tap the Camera button in the floating composer at the bottom]**

> "Now the multimodal part — I'll snap a photo of a handwritten math problem."

**[The native camera/file picker opens. Capture or select the test image. Image is sent INSTANTLY — a brief "Image Sent" toast appears.]**

> "Notice — no upload step, no preview, no extra button. The moment I capture the image, it's sent directly to Gemini. Zero friction."

**[Status changes to "Seeing..." (violet). Image appears in the transcript as a student message with the photo embedded.]**

> "Status turns violet — **Seeing** — Gemini 2.5 Flash's vision model is reading my handwriting."

**[SolveWave responds with a step-by-step solution. The response streams in with word highlighting. Let it speak ~15 seconds.]**

> "And here's the step-by-step solution — read directly from handwriting. Voice, text, and vision all flowing through a **single WebSocket connection**. The streaming transcript shows every word as it's spoken."

**Why this works for judges:** Demonstrates "See, Hear, Speak" (Innovation criterion), shows the streamlined camera flow, and mentions technical architecture (Technical criterion).

---

### [3:05–3:35] Architecture & Cloud — Technical Proof (30 seconds)

> "Under the hood: **WebRTC** carries full-duplex audio with Opus codec — the browser handles echo cancellation, noise suppression, and auto gain control natively. On Cloud Run where WebRTC ICE fails, it falls back to **WebSocket binary PCM** with energy-based echo gating.
>
> A **single WebSocket** carries all three modalities — binary audio frames, JSON text messages, and base64 images. The FastAPI backend uses `asyncio` with concurrent upstream and downstream tasks.
>
> Audio transcription comes from Gemini's `output_audio_transcription` feature — so the streaming text you see is the actual transcription of the tutor's voice, synced word-by-word."

> "The whole stack runs on **Google Cloud Run** — both frontend and backend, `us-central1`. Gemini 2.5 Flash handles voice through the Live API with Kore voice, and text and vision go through the standard generate API. All built with the **Google GenAI SDK**."

**Why this works for judges:** Directly addresses "effective utilization of GenAI SDK" and "robustly hosted on Google Cloud" (Technical criterion, 30%).

---

### [3:35–3:45] End Session & Recap (10 seconds)

**[Click "End Session" button (red, top-right)]**

> "When the session ends, SolveWave sends a recap — topics covered, session duration."

**[Point to recap message (✓ badge) in transcript and timer display in the header. Status returns to "Ready" (slate).]**

---

### [3:45–3:50] Closing (5 seconds)

> "That's **SolveWave** — a live, voice-first AI math tutor with streaming transcripts, word-level highlighting, and real-time interruption. Gemini Live API. Google Cloud Run. Real tutoring.
>
> Thanks for watching."

---

## Feature Checklist (Demonstrated)

- [x] **Real-time voice** — Gemini Live API, full-duplex audio (WebRTC + WS fallback)
- [x] **Barge-in / interruption** — Energy-based detection + tap-to-interrupt button
- [x] **Streaming transcript** — Word-by-word text via `output_audio_transcription`
- [x] **Word-level highlighting** — Emerald highlight tracks current spoken phrase
- [x] **Live transcription** — Web Speech API for student captions (echo-suppressed)
- [x] **Mode switching** — Explain / Quiz / Homework, mid-session
- [x] **Vision (camera auto-send)** — Tap camera, capture, auto-send (no upload step)
- [x] **State visualization** — Status strip with 9 color-coded states + background effects
- [x] **Architecture narration** — WebRTC/WS, asyncio tasks, audio resampling, Cloud Run
- [x] **Cloud deployment proof** — Live app IS the demo
- [x] **Session timer & recap** — Accountability and closure
- [x] **GenAI SDK** — Mentioned explicitly
- [x] **Echo prevention** — Mic gating during tutor speech, energy-based barge-in detection

## Judging Criteria Coverage

| Criterion | Weight | Where in Demo |
|-----------|--------|---------------|
| Innovation & Multimodal UX | 40% | 0:00 hook, 0:15 status strip, 0:30 streaming transcript + word highlight, 1:15 barge-in, 2:20 camera auto-send |
| Technical Implementation | 30% | 3:05 architecture narration (WebRTC, WS fallback, echo gating, audio transcription), SDK/Cloud mentions throughout |
| Demo & Presentation | 30% | Clean obsidian UI, word-level highlight animations, real software, live responses, interrupt button UX |

---

## Recording Tips

- **Barge-in timing is everything.** Practice the 1:15 interruption so SolveWave is clearly mid-sentence when you cut in. If voice barge-in doesn't trigger cleanly, use the orange ✋ interrupt button as backup.
- **Let SolveWave talk.** Don't narrate over its responses — let judges hear the Kore voice quality and see the streaming text for 10-15 seconds at a time.
- **Point out the word highlight.** This is a differentiator — call attention to the emerald highlight moving across text.
- **Camera auto-send is fast.** Have your test image ready. The moment you select/capture it, it sends — so make sure to call attention to the speed.
- **Zoom to 110%.** UI elements read better on video at slight zoom.
- **Record at 1080p.** Export at 1920x1080 minimum.
- **Trim aggressively.** Any silence over 2 seconds should be cut.
- **Don't show the console.** F12 closed. Clean UI only.
- **Use desktop width if possible.** The aside panel (ExamplesPanel, Quick Tip) only shows on xl screens (>=1280px).
- **Use headphones while recording.** This prevents speaker echo and makes voice barge-in more reliable.

## Fallback Plan

| Problem | Fallback |
|---------|----------|
| Mic doesn't work | Use text input. Say "voice works identically" |
| Deployed app is down | Switch to localhost. Say "same app deployed on Cloud Run" |
| WebSocket disconnects | Refresh and restart. If persistent, use `GEMINI_STUB=true` |
| Barge-in doesn't trigger via voice | Use the orange ✋ interrupt button. Say "voice interruption and tap interruption both work" |
| Streaming text doesn't appear | Text API still works — type a question. Mention "streaming transcript from Live API audio transcription" |
| Camera doesn't open | Use a pre-saved image from file picker. Same auto-send behavior applies |

---

**Last updated:** 2026-03-16 (v0.9.0)
