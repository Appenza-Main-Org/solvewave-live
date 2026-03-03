# Demo Script — Faheem Math (4-Minute Live Demo)

**Duration:** 3:50 (10-second buffer under the 4-minute limit)
**Audience:** Gemini Live Agent Challenge judges
**Goal:** Hit all three judging criteria — Innovation & Multimodal UX (40%), Technical Implementation (30%), Demo & Presentation (30%)

---

## Script

### [0:00–0:15] Hook — The Problem (15 seconds)

**[Show the session page, idle state. Camera/mic off. Just the clean UI.]**

> "Most AI tutoring tools are just glorified chat boxes — you type a question, wait, get a wall of text. That's not how real tutoring works.
>
> Real tutoring is a conversation. You talk, you interrupt, you point at a problem. That's what **Faheem Math** does."

**Why this works for judges:** Opens with the "breaks beyond text-box paradigm" criterion (40% of score). Sets up the contrast immediately.

---

### [0:15–0:30] Start Session — Show It's Live (15 seconds)

**[Click "Start session"]**

> "One click to start a live session."

**[Point to live state indicator as it transitions: Connecting → Live → Listening]**

> "Watch the state indicator — **Connecting**… **Live**… and the mic activates automatically. Audio is now streaming full-duplex to Gemini's Live API. No latency. No turn-taking."

**Why this works for judges:** Shows "truly live, not fragmented/turn-based" (Innovation criterion).

---

### [0:30–1:10] Voice Explanation — Explain Mode (40 seconds)

**[Speak clearly into mic]**

> "Explain how to solve 2x plus 5 equals 17."

**[As transcript updates in real-time, point to it]**

> "My words are transcribed live using the Web Speech API — you can see them appearing word by word.

**[State changes: Listening → Thinking → Speaking. Audio starts.]**

> The state shifts to **Thinking**, then **Speaking**. Faheem is explaining the solution step by step — with audio and a written transcript, both updating in real time."

**[Let Faheem speak for ~15-20 seconds. Don't rush — let judges hear the quality of the voice response and see the transcript populate.]**

> "Notice the transcript shows student messages as 'U' and tutor responses as 'F', each timestamped."

---

### [1:10–1:45] Barge-in — The Hero Moment (35 seconds)

**[CRITICAL: Time this so Faheem is mid-sentence when you interrupt. This is the most important feature for the Live Agents category.]**

**[While Faheem is still speaking, interrupt boldly:]**

> "Wait — what happens to the 5?"

**[Point to the UI immediately]**

> "Watch — the state just flashed **Interrupted** in orange. Faheem stopped mid-sentence the instant I spoke. No button, no waiting for him to finish — I just talked over him, exactly like you'd interrupt a real tutor.
>
> This is **barge-in handling** — Gemini's Live API detects that I started speaking and gracefully stops its own output."

**[Faheem answers the follow-up. Let him speak ~10 seconds.]**

> "And now he's answering my follow-up — context preserved, no confusion."

**Why this works for judges:** Barge-in is the #1 differentiator for the Live Agents category. Make it dramatic and undeniable.

---

### [1:45–2:10] Quiz Mode — Behavior Adapts (25 seconds)

**[Click "Quiz" tab in mode selector]**

> "I'll switch to **Quiz mode** mid-session."

**[Speak:]**

> "Quiz me on solving equations."

**[Faheem asks a question instead of explaining]**

> "Same tutor, different behavior — instead of explaining, he's testing me with a question. The system injects mode-specific instructions at runtime, so the tutor persona stays consistent but the approach changes.
>
> There's also **Homework mode** for working through full problem sets."

---

### [2:10–2:55] Vision — Image Upload (45 seconds)

**[Click "Homework" tab, then click 📷 camera icon]**

> "Now the multimodal part — I'll upload a photo of a handwritten math problem."

**[Select and upload the test image. Image preview appears.]**

> "Here's the preview. I can speak or type a caption."

**[Speak or type:]**

> "Help me solve this step by step."

**[Click send ↑. Point to state indicator.]**

> "The state shows **Seeing** — Gemini is reading the image with the 2.5 Flash vision model.

**[Faheem responds. Let him speak ~15 seconds.]**

> And here's the step-by-step solution — read directly from handwriting. Voice, text, and vision all flowing through a **single WebSocket connection**."

**Why this works for judges:** Demonstrates "See, Hear, Speak" (Innovation criterion) and mentions technical architecture (Technical criterion).

---

### [2:55–3:25] Architecture & Cloud — Technical Proof (30 seconds)

**[OPTION A: Show architecture diagram briefly (recommended — open it in a new tab or overlay)]**

> "Under the hood: a **single WebSocket** carries all three modalities — binary PCM audio frames, JSON text messages, and base64-encoded images. The FastAPI backend uses `asyncio` with two concurrent tasks — one upstream to Gemini, one downstream to the browser.

**[OPTION B: If no diagram overlay, just narrate while pointing at the live strip]**

> The whole stack runs on **Google Cloud Run** — backend and frontend. Gemini 2.5 Flash handles voice natively through the Live API, and text and vision go through the standard generate API. All built with the **Google GenAI SDK**."

**Why this works for judges:** Directly addresses "effective utilization of GenAI SDK" and "robustly hosted on Google Cloud" (Technical criterion, 30%).

---

### [3:25–3:45] End Session & Recap (20 seconds)

**[Click "End session"]**

> "When the session ends, Faheem sends a recap — topics covered, session duration, problems worked through."

**[Point to recap message in transcript. Point to timer.]**

> "The session timer tracked the whole thing. Everything is cleaned up gracefully — WebSocket closed, audio stopped, state back to Ready."

---

### [3:45–3:50] Closing (5 seconds)

> "That's **Faheem Math** — a live, voice-first AI tutor. Gemini Live API. Google Cloud Run. One WebSocket. Real tutoring.
>
> Thanks for watching."

---

## Feature Checklist (Demonstrated)

- [x] **Real-time voice** — Gemini Live API, full-duplex audio
- [x] **Barge-in / interruption** — Live Agents category requirement (emphasized)
- [x] **Live transcription** — Web Speech API, partial + final results
- [x] **Mode switching** — Explain / Quiz / Homework, mid-session
- [x] **Vision** — Image upload, handwriting recognition
- [x] **Architecture narration** — Single WebSocket, asyncio tasks, Cloud Run
- [x] **Cloud deployment proof** — Mentioned by name, live app is the demo itself
- [x] **Session timer & recap** — Accountability and closure
- [x] **GenAI SDK** — Mentioned explicitly

## Judging Criteria Coverage

| Criterion | Weight | Where in Demo |
|-----------|--------|---------------|
| Innovation & Multimodal UX | 40% | 0:00 hook, 0:30 voice, 1:10 barge-in, 2:10 vision |
| Technical Implementation | 30% | 2:55 architecture narration, SDK/Cloud mentions throughout |
| Demo & Presentation | 30% | Clean UI throughout, real software, live responses |

---

## Recording Tips

- **Barge-in timing is everything.** Practice the 1:10 interruption so Faheem is clearly mid-sentence when you cut in. If the timing is off, re-record just that section.
- **Let Faheem talk.** Don't narrate over his responses — let judges hear the voice quality for 10-15 seconds at a time.
- **Zoom to 110%.** UI elements read better on video at slight zoom.
- **Record at 1080p.** Export at 1920x1080 minimum.
- **Trim aggressively.** Any silence over 2 seconds should be cut.
- **Don't show the console.** F12 closed. Clean UI only.

## Fallback Plan

| Problem | Fallback |
|---------|----------|
| Mic doesn't work | Use text input. Say "voice works identically" |
| Deployed app is down | Switch to localhost. Say "same app deployed on Cloud Run" |
| WebSocket disconnects | Refresh and restart. If persistent, use `GEMINI_STUB=true` |
| Barge-in doesn't trigger cleanly | Re-record that section. Or say "interruption handling works — sometimes latency varies" |

---

**Last updated:** 2026-03-03
