# SolveWave Demo Video - Teleprompter Script

**Total Duration:** ~3:30-4:00 minutes
**Recording Tool:** Loom / QuickTime / OBS
**Setup:** Have the live app open at https://solvewave-frontend-872506223416.us-central1.run.app

---

## BEFORE YOU HIT RECORD

- Close all other tabs/notifications
- Use Chrome (Web Speech API needs it)
- Allow microphone + camera permissions when prompted
- Resize browser to ~1280x800 (clean look)
- Make sure you're on Explain mode (default)

---

## SCENE 1: INTRO (0:00 - 0:20)

**[Show the landing page / session page]**

> "This is SolveWave - a live AI math tutor built for the Google Gemini Live Agent Challenge."

> "It lets students speak, type, or photograph a math problem - and get instant voice explanations they can interrupt mid-sentence, just like with a real tutor."

> "Let me show you how it works."

---

## SCENE 2: VOICE - Ask a Math Problem (0:20 - 1:10)

**[Click the green Start Session button]**
**[Wait for "Connected" state]**
**[Click the microphone button to start voice]**

> "I'll start by asking a question out loud."

**[Speak clearly into the mic:]**
"How do I solve two x plus five equals seventeen?"

**[Let SolveWave respond - wait for the full audio explanation]**
**[Point out: the transcript appearing, the "Speaking" state indicator, the emerald orb animation]**

> "Notice how the tutor responds with voice AND text simultaneously. The transcript updates in real-time with LaTeX-rendered math."

---

## SCENE 3: BARGE-IN / INTERRUPT (1:10 - 1:45)

**[While SolveWave is still speaking, interrupt it by saying:]**
"Wait, why did you subtract five from both sides?"

**[Point out the orange "Interrupted" flash in the status bar]**

> "That's the key feature - barge-in. I interrupted mid-sentence, and SolveWave stopped immediately, listened to my follow-up, and pivoted. No button press needed. This is powered by Gemini Live API's native interruption detection."

---

## SCENE 4: MODE SWITCH - Quiz Mode (1:45 - 2:20)

**[Click on "Quiz" in the mode selector tabs]**

> "SolveWave has three tutoring modes. Let me switch to Quiz mode."

**[Type or speak:]**
"Quiz me on solving linear equations"

**[Let SolveWave ask you a question]**
**[Answer it (correctly or incorrectly - both work)]**

> "In Quiz mode, the tutor flips the script - it asks ME questions and checks my answers. Same AI, different behavior, just by switching a tab."

---

## SCENE 5: CAMERA - Homework Photo (2:20 - 2:55)

**[Switch back to Explain mode]**
**[Click the camera button]**
**[Hold up a piece of paper with a handwritten math problem to the webcam]**

> "Students can also photograph handwritten homework. I'll hold up this problem..."

**[Let SolveWave read and explain the problem from the image]**

> "SolveWave uses Gemini's multimodal vision to read the handwriting and walks through the solution step by step."

---

## SCENE 6: UI TOUR (2:55 - 3:20)

**[Hover over the UI elements as you mention them]**

> "Quick tour of the interface:"
> "The status strip shows the current state - idle, listening, thinking, speaking."
> "The Study Curriculum panel suggests example problems."
> "The session timer tracks how long you've been tutoring."
> "And the floating composer lets you switch between voice, camera, and text input."

---

## SCENE 7: ARCHITECTURE MENTION + CLOSE (3:20 - 3:50)

> "Under the hood, SolveWave uses WebRTC for low-latency audio transport with a WebSocket fallback. The backend runs on FastAPI with asyncio, deployed on Google Cloud Run."

> "It's built entirely on Gemini 2.5 Flash - native audio for voice, standard API for text and vision - with four structured tools for problem detection, answer checking, hints, and session recaps."

> "SolveWave. See it. Say it. Solve it."

**[End session - show the recap if time allows]**

---

## AFTER RECORDING

1. Upload to YouTube (unlisted is fine) or use Loom link
2. Add to SUBMISSION.md: `Demo Video: <URL>`
3. Update README.md with the video link
