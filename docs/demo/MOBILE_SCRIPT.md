# SolveWave Demo - Mobile Teleprompter

## SETUP
- Chrome open to the live app
- Loom/QuickTime recording ready
- Make sure Mac speakers are ON
- Use headphones to avoid echo

---

## 1. INTRO (20s)
"This is SolveWave - a live AI math tutor for the Gemini Live Agent Challenge. Students speak, type, or snap a math problem and get instant voice explanations they can interrupt mid-sentence."

> ACTION: Show the landing page

---

## 2. TEXT MODE (40s)
"Let me start a session and type a question."

> ACTION: Click START SESSION
> ACTION: Type "How do I solve 2x + 5 = 17?"
> ACTION: Click send, wait for text response

"The tutor responds with a clear step-by-step text explanation with formatted math."

---

## 3. VOICE MODE (50s)
"Now the real magic - voice mode. When I use the mic, SolveWave responds with VOICE through the Gemini Live API."

> ACTION: Click the MIC button (it turns red)
> SAY clearly: "Explain what a derivative is"
> WAIT for voice reply (you'll hear it through speakers)
> While tutor is speaking, INTERRUPT: "Wait, give me a simpler example"

"I just interrupted mid-sentence and SolveWave stopped immediately. That's barge-in - Gemini's native interruption detection. No button needed."

NOTE: Voice replies ONLY work via the mic button. Typing uses the text API.

---

## 4. QUIZ MODE (30s)
"Let me switch to Quiz mode."

> ACTION: Click QUIZ tab
> ACTION: Type "Quiz me on fractions"
> ACTION: Wait for response, then answer

"Now it's asking ME questions. Same AI, different behavior - just a mode switch."

---

## 5. CAMERA (30s)
"Students can also photograph homework."

> ACTION: Click camera icon
> ACTION: Hold up paper with a math problem

"SolveWave reads the handwriting using Gemini's vision and walks through the solution."

---

## 6. CLOSE (15s)
"Under the hood: WebRTC audio, FastAPI backend, deployed on Cloud Run, all powered by Gemini 2.5 Flash."

> ACTION: Click END SESSION

"SolveWave. See it. Say it. Solve it."

> STOP RECORDING
