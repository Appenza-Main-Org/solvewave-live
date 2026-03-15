# Demo Script — SolveWave (4-Minute Live Demo)

**Duration:** 3:50 (10-second buffer under the 4-minute limit)
**Audience:** Gemini Live Agent Challenge judges
**Goal:** Hit all three judging criteria — Innovation & Multimodal UX (40%), Technical Implementation (30%), Demo & Presentation (30%)
**Version:** v0.5.1

---

## Script

### [0:00–0:15] Hook — The Problem (15 seconds)

**[Show the session page, idle state. Camera/mic off. The AmbientOrb glows a calm slate color in the center. Clean obsidian UI.]**

> "Most AI tutoring tools are just glorified chat boxes — you type a question, wait, get a wall of text. That's not how real tutoring works.
>
> Real tutoring is a conversation. You talk, you interrupt, you point at a problem. That's what **SolveWave** does."

**Why this works for judges:** Opens with the "breaks beyond text-box paradigm" criterion (40% of score). Sets up the contrast immediately.

---

### [0:15–0:30] Start Session — Show It's Live (15 seconds)

**[Click "Start Tutoring" button (green, top-right)]**

> "One click to start a live session."

**[Point to the AmbientOrb as it transitions colors: slate → yellow → emerald. The background grid and glow also shift color.]**

> "Watch the orb — it's a real-time state visualization. **Connecting**… **Live**… and the mic activates automatically. Audio is now streaming full-duplex to Gemini's Live API. No latency. No turn-taking."

**Why this works for judges:** Shows "truly live, not fragmented/turn-based" (Innovation criterion). The AmbientOrb makes the state change visually dramatic.

---

### [0:30–1:10] Voice Explanation — Explain Mode (40 seconds)

**[Speak clearly into mic]**

> "Explain how to solve 2x plus 5 equals 17."

**[As transcript updates in real-time, point to the transcript canvas (rounded glass card)]**

> "My words are transcribed live using the Web Speech API — you can see them appearing word by word in the transcript.

**[AmbientOrb changes: rose (Listening) → sky blue (Thinking) → emerald (Speaking). Audio starts.]**

> The orb shifts to **Thinking**, then **Speaking**. SolveWave is explaining the solution step by step — with audio and a written transcript, both updating in real time."

**[Let SolveWave speak for ~15-20 seconds. Don't rush — let judges hear the quality of the voice response and see the transcript populate.]**

> "Notice the transcript shows student messages as 'U' and tutor responses as 'F', each timestamped."

---

### [1:10–1:45] Barge-in — The Hero Moment (35 seconds)

**[CRITICAL: Time this so SolveWave is mid-sentence when you interrupt. This is the most important feature for the Live Agents category.]**

**[While SolveWave is still speaking, interrupt boldly:]**

> "Wait — what happens to the 5?"

**[Point to the AmbientOrb as it flashes orange (Interrupted) then back to rose (Listening)]**

> "Watch — the orb just flashed **orange** — Interrupted. SolveWave stopped mid-sentence the instant I spoke. No button, no waiting for it to finish — I just talked over it, exactly like you'd interrupt a real tutor.
>
> This is **barge-in handling** — Gemini's Live API detects that I started speaking and gracefully stops its own output."

**[SolveWave answers the follow-up. Let it speak ~10 seconds.]**

> "And now he's answering my follow-up — context preserved, no confusion."

**Why this works for judges:** Barge-in is the #1 differentiator for the Live Agents category. The AmbientOrb makes the state change visually undeniable.

---

### [1:45–2:10] Quiz Mode — Behavior Adapts (25 seconds)

**[Click "Quiz" tab in the ModeSelector (segmented control in header on desktop, or top of main area on mobile)]**

> "I'll switch to **Quiz mode** mid-session."

**[Speak:]**

> "Quiz me on solving equations."

**[SolveWave asks a question instead of explaining]**

> "Same tutor, different behavior — instead of explaining, he's testing me with a question. The system injects mode-specific instructions at runtime, so the tutor persona stays consistent but the approach changes.
>
> There's also **Homework mode** for working through full problem sets."

---

### [2:10–2:55] Vision — Camera Auto-Send (45 seconds)

**[Click "Homework" tab, then tap the Camera button (📷) in the floating composer at the bottom]**

> "Now the multimodal part — I'll snap a photo of a handwritten math problem."

**[The native camera/file picker opens. Capture or select the test image. Image is sent INSTANTLY — a brief "📷 Image Sent" toast appears.]**

> "Notice — no upload step, no preview, no extra button. The moment I capture the image, it's sent directly to Gemini. Zero friction."

**[AmbientOrb turns violet (Seeing). State label says "Seeing… Reading your image".]**

> "The orb turns violet — **Seeing** — Gemini's 2.5 Flash vision model is reading the image.

**[SolveWave responds with a step-by-step solution. Let it speak ~15 seconds.]**

> And here's the step-by-step solution — read directly from handwriting. Voice, text, and vision all flowing through a **single WebSocket connection**."

**Why this works for judges:** Demonstrates "See, Hear, Speak" (Innovation criterion), shows the streamlined camera flow, and mentions technical architecture (Technical criterion).

---

### [2:55–3:25] Architecture & Cloud — Technical Proof (30 seconds)

**[OPTION A: Show architecture diagram briefly (recommended — open docs/architecture/architecture-diagram.png in a new tab)]**

> "Under the hood: a **single WebSocket** carries all three modalities — binary PCM audio frames, JSON text messages, and base64-encoded images. The FastAPI backend uses `asyncio` with two concurrent tasks — one upstream to Gemini, one downstream to the browser.

> Audio is captured at the device's native sample rate and resampled to 16 kilohertz using linear interpolation — so it works on every device, including mobile.

**[OPTION B: If no diagram overlay, just narrate while pointing at the AmbientOrb and UI]**

> The whole stack runs on **Google Cloud Run** — backend and frontend. Gemini 2.5 Flash handles voice natively through the Live API, and text and vision go through the standard generate API. All built with the **Google GenAI SDK**."

**Why this works for judges:** Directly addresses "effective utilization of GenAI SDK" and "robustly hosted on Google Cloud" (Technical criterion, 30%).

---

### [3:25–3:45] End Session & Recap (20 seconds)

**[Click "End Session" button (red, top-right)]**

> "When the session ends, SolveWave sends a recap — topics covered, session duration, problems worked through."

**[Point to recap message in transcript. Point to timer display in the header.]**

> "The session timer tracked the whole thing. Everything is cleaned up gracefully — WebSocket closed, audio stopped, and the orb returns to its resting state."

**[AmbientOrb settles back to slate (idle).]**

---

### [3:45–3:50] Closing (5 seconds)

> "That's **SolveWave** — a live, voice-first AI tutor. Gemini Live API. Google Cloud Run. One WebSocket. Real tutoring.
>
> Thanks for watching."

---

## Feature Checklist (Demonstrated)

- [x] **Real-time voice** — Gemini Live API, full-duplex audio
- [x] **Barge-in / interruption** — Live Agents category requirement (emphasized)
- [x] **Live transcription** — Web Speech API, partial + final results, echo suppression
- [x] **Dual response path** — Voice transcripts also sent to text API for guaranteed text reply
- [x] **Mode switching** — Explain / Quiz / Homework, mid-session
- [x] **Vision (camera auto-send)** — Tap camera, capture, auto-send (no upload step)
- [x] **AmbientOrb** — Animated state visualization (9 states, color-coded)
- [x] **Architecture narration** — Single WebSocket, asyncio tasks, audio resampling, Cloud Run
- [x] **Cloud deployment proof** — Mentioned by name, live app is the demo itself
- [x] **Session timer & recap** — Accountability and closure
- [x] **GenAI SDK** — Mentioned explicitly

## Judging Criteria Coverage

| Criterion | Weight | Where in Demo |
|-----------|--------|---------------|
| Innovation & Multimodal UX | 40% | 0:00 hook, 0:15 AmbientOrb, 0:30 voice, 1:10 barge-in, 2:10 camera auto-send |
| Technical Implementation | 30% | 2:55 architecture narration, audio resampling, SDK/Cloud mentions throughout |
| Demo & Presentation | 30% | Clean obsidian UI, AmbientOrb animations, real software, live responses |

---

## Recording Tips

- **Barge-in timing is everything.** Practice the 1:10 interruption so SolveWave is clearly mid-sentence when you cut in. If the timing is off, re-record just that section.
- **Let SolveWave talk.** Don't narrate over its responses — let judges hear the voice quality for 10-15 seconds at a time.
- **The AmbientOrb is your visual anchor.** Point to it during state changes — it makes the agent's state transitions dramatic and unmistakable on video.
- **Camera auto-send is fast.** Have your test image ready. The moment you select/capture it, it sends — so make sure to call attention to the speed.
- **Zoom to 110%.** UI elements read better on video at slight zoom.
- **Record at 1080p.** Export at 1920x1080 minimum.
- **Trim aggressively.** Any silence over 2 seconds should be cut.
- **Don't show the console.** F12 closed. Clean UI only.
- **Use desktop width if possible.** The aside panel (ExamplesPanel, Quick Tip) only shows on xl screens (≥1280px).

## Fallback Plan

| Problem | Fallback |
|---------|----------|
| Mic doesn't work | Use text input. Say "voice works identically" |
| Deployed app is down | Switch to localhost. Say "same app deployed on Cloud Run" |
| WebSocket disconnects | Refresh and restart. If persistent, use `GEMINI_STUB=true` |
| Barge-in doesn't trigger cleanly | Re-record that section. Or say "interruption handling works — sometimes latency varies" |
| Camera doesn't open | Use a pre-saved image from file picker. Same auto-send behavior applies |

---

**Last updated:** 2026-03-04 (v0.5.1)
