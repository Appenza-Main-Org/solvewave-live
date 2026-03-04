# Demo Checklist — Faheem Math Live Demo (v0.5.1)

**Target duration:** Under 4 minutes
**Goal:** Showcase all multimodal features, live agent capabilities, and barge-in handling

---

## Pre-Demo Setup (Do this before recording)

### Environment
- [ ] Browser: Chrome or Edge (best Web Speech API support)
- [ ] Tab: https://faheem-math-frontend-872506223416.us-central1.run.app (or localhost:3000)
- [ ] Microphone: Working and permissions granted
- [ ] Camera: Permissions granted (for image capture)
- [ ] Network: Stable connection
- [ ] Screen recording tool: Ready (QuickTime, OBS, Loom, etc.)

### Test Problem Ready
- [ ] Have 1-2 simple math problems ready to speak (e.g., "Explain how to solve 2x + 5 = 17")
- [ ] Have 1 homework photo ready (saved to device, or use live camera capture)
  - Clear, well-lit, readable handwriting or print
- [ ] Practice the flow once to ensure timing

### Browser State
- [ ] Clear previous transcript (refresh page)
- [ ] Close unnecessary tabs/notifications
- [ ] Window width ≥1280px for full layout (aside panel with ExamplesPanel shows on xl screens)
- [ ] Zoom level: 100% (or 110% for better visibility)
- [ ] Console closed (F12 off) — clean UI only

---

## Demo Script Flow (< 4 minutes)

### 0:00–0:15 — Introduction & Context (15 seconds)
- [ ] Show the session page (idle state — AmbientOrb glows slate)
- [ ] Say: "This is **Faheem Math**, a live AI math tutor built for the Gemini Live Agent Challenge."
- [ ] Say: "It uses Gemini's Live API for real-time voice, vision, and step-by-step math coaching."
- [ ] Say: "Let me show you how it works."

### 0:15–0:30 — Start Session & Live State (15 seconds)
- [ ] Click **"Start Tutoring"** button (green, top-right of header)
- [ ] Wait for AmbientOrb to transition: slate → yellow → emerald
- [ ] **Point out:**
  - [ ] AmbientOrb color shifts in real-time (state visualization)
  - [ ] Status dot + label below orb: "Connecting…" → "Live"
  - [ ] Microphone auto-activates (voice + transcription start automatically)
  - [ ] Background grid and glow change color with state

### 0:30–1:10 — Feature 1: Voice Explanation (Explain Mode) (40 seconds)
- [ ] **Speak clearly:** "Explain how to solve 2x plus 5 equals 17"
- [ ] **Point out:**
  - [ ] Live transcription: your words appear word-by-word in the transcript canvas
  - [ ] AmbientOrb changes: rose (Listening) → sky blue (Thinking) → emerald (Speaking)
  - [ ] Faheem responds with audio + written explanation simultaneously
  - [ ] Transcript shows both student (U) and tutor (F) messages with timestamps
- [ ] **Wait for Faheem to finish explaining** (~15-20 seconds)

### 1:10–1:45 — Feature 2: Barge-in / Interruption (35 seconds)
- [ ] **While Faheem is speaking,** interrupt by speaking: "Wait, can you explain the first step again?"
- [ ] **Point out:**
  - [ ] AmbientOrb flashes **orange** (Interrupted state)
  - [ ] State label shows "Interrupted"
  - [ ] Faheem stops speaking immediately — no lingering audio
  - [ ] Your new question is processed
  - [ ] Faheem responds to the follow-up with context preserved
- [ ] Say: "This barge-in handling makes it feel like a real tutor."

### 1:45–2:10 — Feature 3: Mode Switching (Quiz Mode) (25 seconds)
- [ ] Click the **"Quiz"** tab in the ModeSelector
  - On desktop: segmented control in the header bar
  - On mobile: segmented control at top of main area
- [ ] Say: "Now I'll switch to Quiz mode to test my understanding."
- [ ] **Speak:** "Quiz me on solving simple equations"
- [ ] **Point out:**
  - [ ] Tutor adapts behavior — asks a question instead of explaining
  - [ ] Same persona, different approach
  - [ ] ExamplesPanel updates with quiz-specific suggestions (visible on xl screens)

### 2:10–2:55 — Feature 4: Vision — Camera Auto-Send (45 seconds)
- [ ] Click the **"Homework"** tab
- [ ] Say: "Finally, Homework mode — I'll snap a photo of a math problem."
- [ ] Tap the **Camera button** (📷) in the floating composer bar
- [ ] **Capture or select** the test homework image
- [ ] **Point out:**
  - [ ] Image is **sent instantly** — no preview, no upload button, no caption step
  - [ ] Brief "📷 Image Sent" feedback toast appears
  - [ ] AmbientOrb turns **violet** (Seeing state)
  - [ ] State label: "Seeing… Reading your image"
- [ ] **Wait for Faheem to read and explain** (~15-20 seconds)
- [ ] **Point out:** "Faheem read the handwritten problem and explained the solution — all through one WebSocket."

### 2:55–3:25 — Feature 5: Architecture & Cloud (30 seconds)
- [ ] Optional: open architecture-diagram.png in new tab for visual reference
- [ ] **Narrate architecture:**
  - [ ] Single WebSocket carries all modalities (binary PCM audio + JSON text/image)
  - [ ] FastAPI backend with asyncio (2 concurrent tasks: upstream + downstream)
  - [ ] Audio resampled from device native rate to 16kHz via linear interpolation
  - [ ] Deployed on Google Cloud Run (backend + frontend)
  - [ ] Built with Google GenAI SDK
  - [ ] Two Gemini models: Live API for voice, standard API for text/vision

### 3:25–3:45 — End Session & Recap (20 seconds)
- [ ] Click **"End Session"** button (red, top-right)
- [ ] **Point out:**
  - [ ] WebSocket closes gracefully
  - [ ] Recap message appears in transcript:
    - [ ] Summary of what was covered
    - [ ] Session duration
    - [ ] Topics and problem types
  - [ ] AmbientOrb returns to slate (idle)
  - [ ] Session timer freezes at final value
- [ ] Say: "The recap summarizes what we worked on and how long the session lasted."

### 3:45–3:50 — Closing (5 seconds)
- [ ] Say: "That's Faheem Math — a live, voice-first AI tutor built with Gemini Live API."
- [ ] Say: "Deployed on Google Cloud Run. Powered by Gemini 2.5 Flash."
- [ ] Say: "Thanks for watching!"

---

## Post-Demo Checklist

- [ ] Trim/edit video to under 4 minutes
- [ ] Verify barge-in moment is clear and dramatic
- [ ] Add captions (optional but helpful for accessibility)
- [ ] Export in 1080p (1920x1080) or 720p minimum
- [ ] Upload to YouTube or Loom (unlisted or public)
- [ ] Copy video URL to [SUBMISSION.md](SUBMISSION.md)
- [ ] Test video playback (ensure audio is clear, orb animations are visible)

---

## Fallback Plan (If Live Demo Fails)

### If microphone doesn't work:
- Use text input instead — type "Explain how to solve 2x + 5 = 17"
- Explain: "For the demo, I'll use text, but voice works identically"

### If deployed app is down:
- Switch to localhost:3000 (have it running as backup)
- Explain: "This is running locally, but it's the same app deployed on Cloud Run"

### If WebSocket fails:
- Restart the session (refresh page)
- If still failing, show the stub mode: `GEMINI_STUB=true`

### If camera doesn't open:
- Select a pre-saved image from file picker (same auto-send behavior)
- Or skip to architecture section and mention vision works

### If barge-in doesn't trigger cleanly:
- Re-record that section
- Or say: "Interruption handling works — sometimes latency varies depending on network"

---

## Key Points to Emphasize

1. **Real-time voice** — No delays, full-duplex audio via Gemini Live API
2. **Barge-in** — Natural interruption handling (Live Agents #1 requirement)
3. **AmbientOrb** — Animated state visualization makes agent state visible (9 distinct states)
4. **Camera auto-send** — Tap, capture, sent. Zero friction for image input
5. **Dual response path** — Voice transcription sent to text API for guaranteed text reply
6. **Mode switching** — Three tutoring modes (Explain, Quiz, Homework) switchable mid-session
7. **Multimodal** — Voice, text, and vision all through a single WebSocket
8. **Audio resampling** — Native rate → 16kHz linear interpolation, works on every device
9. **Google Cloud** — Deployed on Cloud Run, using Google GenAI SDK
10. **Session recap** — Structured summary with duration, topics, and scores

---

**Total time:** ~3:50 (leaves 10-second buffer for 4-minute limit)

**Last updated:** 2026-03-04 (v0.5.1)
