# Demo Checklist — Faheem Math Live Demo

**Target duration:** Under 4 minutes
**Goal:** Showcase all multimodal features, live agent capabilities, and barge-in handling

---

## Pre-Demo Setup (Do this before recording)

### Environment
- [ ] Browser: Chrome or Edge (best Web Speech API support)
- [ ] Tab: https://faheem-math-frontend-872506223416.us-central1.run.app (or localhost:3000)
- [ ] Microphone: Working and permissions granted
- [ ] Network: Stable connection
- [ ] Screen recording tool: Ready (QuickTime, OBS, Loom, etc.)

### Test Problem Ready
- [ ] Have 1-2 simple math problems ready to speak (e.g., "Explain how to solve 2x + 5 = 17")
- [ ] Have 1 homework photo ready to upload (clear, well-lit, readable handwriting or print)
- [ ] Practice the flow once to ensure timing

### Browser State
- [ ] Clear previous transcript (refresh page)
- [ ] Close unnecessary tabs/notifications
- [ ] Zoom level: 100% (or 110% for better visibility)
- [ ] Console closed (F12 off) — clean UI only

---

## Demo Script Flow (< 4 minutes)

### 0:00–0:20 — Introduction & Context (20 seconds)
- [ ] Show the landing page
- [ ] Say: "This is **Faheem Math**, a live AI math tutor built for the Gemini Live Agent Challenge."
- [ ] Say: "It uses Gemini's Live API for real-time voice, vision, and step-by-step math coaching."
- [ ] Say: "Let me show you how it works."

### 0:20–0:35 — Start Session & Voice Interaction (15 seconds)
- [ ] Click "Start session" in the header
- [ ] Wait for "Live" indicator (green dot)
- [ ] **Point out:** "Notice the live state indicator — it shows Connecting → Live → Listening"
- [ ] Microphone icon should auto-activate (voice starts automatically)

### 0:35–1:15 — Feature 1: Voice Explanation (Explain Mode) (40 seconds)
- [ ] **Speak clearly:** "Explain how to solve 2x plus 5 equals 17"
- [ ] **Point out:**
  - [ ] Live state changes: Listening → Thinking → Speaking
  - [ ] Your spoken words appear in real-time as transcript (Web Speech API)
  - [ ] Faheem responds with audio + written explanation
  - [ ] Transcript shows both student (U) and tutor (F) messages with timestamps
- [ ] **Wait for Faheem to finish explaining** (~20-30 seconds)

### 1:15–1:45 — Feature 2: Barge-in / Interruption (30 seconds)
- [ ] **While Faheem is speaking,** interrupt by speaking: "Wait, can you explain the first step again?"
- [ ] **Point out:**
  - [ ] Live state briefly shows "Interrupted" (orange pulse)
  - [ ] Faheem stops speaking immediately
  - [ ] Your new question is processed
  - [ ] Faheem responds to the follow-up
- [ ] Say: "This barge-in handling makes it feel like a real tutor."

### 1:45–2:10 — Feature 3: Mode Switching (Quiz Mode) (25 seconds)
- [ ] Click the **"Quiz"** tab in the mode selector
- [ ] Say: "Now I'll switch to Quiz mode to test my understanding."
- [ ] **Speak:** "Quiz me on solving simple equations"
- [ ] **Point out:**
  - [ ] Mode selector (segmented tabs: Explain / Quiz / Homework)
  - [ ] Tutor adapts behavior — asks a question instead of explaining
  - [ ] "Try asking in Quiz mode" suggestions update

### 2:10–2:50 — Feature 4: Vision (Image Upload, Homework Mode) (40 seconds)
- [ ] Click the **"Homework"** tab
- [ ] Say: "Finally, Homework mode — I'll upload a photo of a math problem."
- [ ] Click the camera icon (📷) in the composer bar
- [ ] Upload your test homework image
- [ ] **Point out:**
  - [ ] Image preview appears in the side panel
  - [ ] Live state changes to "Seeing…" (violet pulse)
- [ ] Type (or speak): "Help me solve this step by step"
- [ ] Click send (↑ button)
- [ ] **Wait for Faheem to read and explain** (~20 seconds)
- [ ] **Point out:** "Faheem read the handwritten problem and explained the solution."

### 2:50–3:15 — Feature 5: Session Timer & Examples (25 seconds)
- [ ] **Point out:**
  - [ ] Session timer in the UI (if visible) — shows elapsed time
  - [ ] Examples panel on the right (mode-specific suggestions)
  - [ ] Help/About panel (if time allows) — shows WS status, stub mode indicator
- [ ] Say: "The timer tracks session duration, and at the end, you get a recap."

### 3:15–3:50 — End Session & Recap (35 seconds)
- [ ] Click "End session" button
- [ ] **Point out:**
  - [ ] WebSocket closes gracefully
  - [ ] Recap message appears in transcript:
    - [ ] Summary of what was covered
    - [ ] Session duration
    - [ ] Problem count (if applicable)
  - [ ] Live state returns to "Ready" (gray dot)
- [ ] Say: "The recap summarizes what we worked on and how long the session lasted."

### 3:50–4:00 — Closing & Call to Action (10 seconds)
- [ ] Say: "That's Faheem Math — a live, multimodal AI tutor built with Gemini Live API."
- [ ] Say: "It's deployed on Google Cloud Run and uses Gemini 2.5 Flash for voice, text, and vision."
- [ ] Say: "Thanks for watching!"
- [ ] **Show URL briefly:** (if appropriate) GitHub repo or live app URL

---

## Post-Demo Checklist

- [ ] Trim/edit video to under 4 minutes
- [ ] Add captions (optional but helpful for accessibility)
- [ ] Export in 1080p (1920x1080) or 720p minimum
- [ ] Upload to YouTube or Loom (unlisted or public)
- [ ] Copy video URL to [SUBMISSION.md](SUBMISSION.md)
- [ ] Test video playback (ensure audio is clear)

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

---

## Key Points to Emphasize

1. **Real-time voice** — No delays, full-duplex audio
2. **Barge-in** — Natural interruption handling (Live Agents requirement)
3. **Multimodal** — Voice, text, and vision (photos) all working together
4. **Live states** — UI clearly shows what the agent is doing (Listening, Thinking, Speaking, Interrupted)
5. **Mode switching** — Three tutoring modes (Explain, Quiz, Homework) switchable mid-session
6. **Gemini Live API** — Powered by `gemini-2.5-flash-native-audio-latest`
7. **Google Cloud** — Deployed on Cloud Run, using Google GenAI SDK

---

**Total time:** ~3:50 (leaves 10-second buffer for 4-minute limit)

**Last updated:** 2026-03-02
