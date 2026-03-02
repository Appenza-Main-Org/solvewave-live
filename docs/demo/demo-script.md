# Demo Script — Faheem Math (4-Minute Live Demo)

**Duration:** Under 4 minutes
**Audience:** Gemini Live Agent Challenge judges
**Goal:** Demonstrate all multimodal features, live agent capabilities, and challenge requirements

---

## Script

### [0:00–0:20] Introduction

**[Show landing page / session page before starting]**

> "Hi! This is **Faheem Math**, a live AI math tutor I built for the Gemini Live Agent Challenge.
>
> It's a real-time, voice-first tutor that uses Gemini's Live API to provide instant, step-by-step math explanations.
>
> Students can speak a problem, upload a photo of homework, or type a question — and Faheem responds immediately.
>
> Let me show you how it works."

---

### [0:20–0:35] Start Session & Voice Activation

**[Click "Start session" button]**

> "I'll click **Start session** to begin a live tutoring session.
>
> **[Point to live state indicator]** Notice the live state indicator here — it shows **Connecting**, then **Live**, and the microphone starts automatically.
>
> The app is now streaming audio to Gemini in real time."

**[Wait for green "Live" indicator + mic activation]**

---

### [0:35–1:15] Feature 1: Voice Explanation (Explain Mode)

**[Speak clearly into microphone]**

> "Explain how to solve 2x plus 5 equals 17."

**[Point to UI as events happen]**

> "**[As you speak]** You'll see my words transcribed in real time using the Web Speech API.
>
> **[State changes to Thinking]** The live state changes to **Thinking** while Gemini processes the problem.
>
> **[State changes to Speaking]** Now it's **Speaking** — Faheem is explaining the solution out loud.
>
> **[Audio plays + transcript updates]** And here's the written explanation in the transcript — each message is timestamped."

**[Let Faheem finish speaking, ~20-30 seconds]**

---

### [1:15–1:45] Feature 2: Barge-in / Interruption

**[While Faheem is speaking, interrupt by speaking]**

> "Wait, can you explain the first step again?"

**[Point to UI]**

> "**[State briefly shows Interrupted — orange]** Notice the live state changed to **Interrupted** — Faheem stopped speaking immediately.
>
> This is the **barge-in** feature — you can cut in at any time, just like with a real tutor.
>
> **[Faheem responds to follow-up]** And now Faheem is answering my follow-up question."

**[Let Faheem respond briefly, ~10-15 seconds]**

---

### [1:45–2:10] Feature 3: Mode Switching (Quiz Mode)

**[Click "Quiz" tab in mode selector]**

> "Now I'll switch to **Quiz mode** to test my understanding.
>
> **[Mode tab highlights]** The app has three modes: **Explain**, **Quiz**, and **Homework** — you can switch mid-session.
>
> **[Speak]** Quiz me on solving simple equations."

**[Point to UI]**

> "**[Tutor asks a question instead of explaining]** See how Faheem adapted? Instead of explaining, he's asking me a question to quiz my understanding.
>
> **[Point to examples panel]** The examples panel also updated with Quiz-mode suggestions."

**[Let Faheem ask 1 question briefly, ~10 seconds]**

---

### [2:10–2:50] Feature 4: Vision (Image Upload, Homework Mode)

**[Click "Homework" tab]**

> "Finally, **Homework mode** — this is for helping with actual problem sets.
>
> **[Click camera icon 📷]** I'll upload a photo of a handwritten math problem."

**[Select and upload test image]**

> "**[Image preview appears]** Here's the preview — Faheem can read handwritten or printed math.
>
> **[Type or say]** Help me solve this step by step.
>
> **[Click send ↑]**"

**[Point to UI]**

> "**[State changes to Seeing — violet]** The live state is now **Seeing…** — Gemini is processing the image.
>
> **[Faheem responds with solution]** And here's the step-by-step solution — Faheem read the problem from the photo and explained how to solve it."

**[Let Faheem explain briefly, ~20 seconds]**

---

### [2:50–3:15] Feature 5: Session Timer, Examples, & Help Panel

**[Pan across UI or highlight specific elements]**

> "A few more features to point out:
>
> **[Point to timer if visible]** The session timer tracks how long you've been working.
>
> **[Point to examples panel]** Each mode has example prompts to help students get started.
>
> **[Point to Help/About panel if visible]** And there's a Help panel that shows WebSocket status, microphone status, and whether the app is in live or demo mode."

---

### [3:15–3:50] End Session & Recap

**[Click "End session" button]**

> "Now I'll end the session.
>
> **[Recap message appears in transcript]** Faheem sends a recap — it summarizes what we worked on, how long the session lasted, and how many problems we covered.
>
> **[Live state returns to Ready — gray dot]** The live state returns to **Ready**, and all resources are cleaned up."

**[Pause briefly to show recap message clearly]**

---

### [3:50–4:00] Closing & Tech Stack

> "So that's **Faheem Math** — a live, multimodal AI tutor built for the Gemini Live Agent Challenge.
>
> It's powered by **Gemini 2.5 Flash** — the native audio model for voice, and the standard model for text and vision.
>
> The whole stack runs on **Google Cloud Run**, using the **Google GenAI SDK**.
>
> Thanks for watching!"

**[Optional: Show URL briefly — GitHub repo or live app link]**

---

## Key Features Demonstrated

- [x] **Real-time voice** (Gemini Live API)
- [x] **Barge-in / interruption** (Live Agents requirement)
- [x] **Multimodal** (voice + text + vision)
- [x] **Live state indicators** (Connecting, Live, Listening, Thinking, Speaking, Seeing, Interrupted)
- [x] **Mode switching** (Explain, Quiz, Homework)
- [x] **Live transcription** (Web Speech API)
- [x] **Session timer & recap**
- [x] **Image upload** (vision-enabled homework help)

---

## Notes

- **Timing:** Practice to stay under 4 minutes (aim for 3:50 to leave buffer)
- **Clarity:** Speak clearly and point to UI elements as they update
- **Pacing:** Let Faheem respond briefly (10-30 seconds per interaction) — don't rush, but don't let any single response drag
- **Fallback:** If mic doesn't work, use text input and explain "voice works the same way"
- **Editing:** Trim any long pauses or dead air in post-production

---

**Last updated:** 2026-03-02
