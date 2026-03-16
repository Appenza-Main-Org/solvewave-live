You are now acting as the lead engineer and product finisher for this hackathon project.

Project: **SolveWave**

Goal:
Complete this app as a polished, impressive, competition-ready submission for the **Gemini Live Agent Challenge** in the **Live Agents** category.

Use the existing codebase as the foundation and finish it as a strong vertical slice.

## Product definition (source of truth)

This app is a **real-time, voice-first, vision-enabled math homework tutor**.

The final app should support this exact flow:

1. Student starts a session
2. Student speaks a math problem
3. Student uploads/shows a math problem image
4. Tutor identifies the problem type
5. Tutor gives step-by-step guidance
6. Student interrupts naturally
7. Tutor adapts
8. Student switches between Explain / Quiz / Homework
9. Student submits an answer
10. Tutor checks the answer and gives a concise recap

Do not broaden the product.
Do not add other subjects.
Do not make it a generic chatbot.

---

# MISSION

Complete the app in a way that is:

* reliable
* polished
* architecturally clean
* visually impressive
* aligned with the Gemini Live Agent Challenge
* suitable for a <4 minute demo video

---

# PART 1 — ARCHITECTURE COMPLETION

Audit and strengthen the architecture so it looks like a serious product.

## Requirements

Ensure the app has a clean separation of responsibilities:

### Frontend

* UI components
* session page
* socket/audio hooks
* visible live states

### Backend

* main app entry
* websocket session manager
* agent orchestration
* model access layer
* tool layer
* structured logging

### Tools

Make these tools real and clearly useful:

* detect_problem_type
* check_answer
* generate_next_hint
* build_session_recap

### Model layer

Keep a clean distinction between:

* Gemini Live path for voice/live interaction
* Gemini text/multimodal path for text + image

### Reliability

* remove dead code
* reduce duplicate logic
* make fallback behavior explicit
* improve error handling

If anything is messy, refactor the smallest clean amount needed.

---

# PART 2 — COMPLETE THE LIVE AGENT EXPERIENCE

The app must clearly feel like a Live Agent.

## Requirements

Make sure the app visibly supports:

* Ready
* Listening
* Seeing
* Thinking
* Speaking
* Interrupted
* Error

Voice interaction must be treated as a first-class experience:

* mic capture starts cleanly
* Gemini Live path is used
* tutor replies in a short, live-friendly way
* interruption / barge-in is supported as reliably as possible
* text and image still work correctly

If interruption is only partially implemented, improve it enough to make it reliable and visible in the demo.

---

# PART 3 — MAKE THE APP FEEL IMPRESSIVE

Upgrade the UX so it feels polished and premium.

## Requirements

* clear tab-based modes (Explain / Quiz / Homework)
* stronger hierarchy and spacing
* premium transcript styling
* math-specific empty states and guidance
* cleaner composer and attachment flow
* visible and trustworthy status indicators
* reduce generic “chat app” feel

The app should look good on camera during a demo.

---

# PART 4 — COMPLETE THE MATH TUTOR LOGIC

Make the math tutor behavior feel focused and impressive.

## Requirements

* Explain: break down concepts clearly with numbered steps
* Quiz: ask one focused question at a time
* Homework: help solve step by step without dumping the answer too early
* Image uploads should be treated as math problems by default unless clearly not math
* Tutor replies should be concise, practical, and aligned with user intent
* Non-math questions should be redirected briefly back to math

Improve prompt composition, routing, and mode handling as needed.

---

# PART 5 — COMPLETE OBSERVABILITY

Add strong logging so the whole system can be debugged and shown confidently.

## Frontend logs

Log:

* session lifecycle
* websocket lifecycle
* tab changes
* text/image/voice actions
* state transitions
* errors

## Backend logs

Log:

* websocket accept/close
* route taken (text/image/audio/control)
* mode
* Gemini request start/success/fallback
* image payload handling
* voice events
* interruption events
* tool calls
* tool results
* exceptions with stack traces

Logs should be clean and readable for both local testing and cloud logs.

---

# PART 6 — FINAL COMPLETION CHECK

After implementing changes, perform a final completion pass:

1. Remove inaccurate claims about any feature that is not fully working
2. Remove dead code and stale files where safe
3. Tighten weak UI copy
4. Ensure the app is coherent as a math-only live tutor
5. Keep all working flows stable

Then provide:

* a concise local QA checklist
* a concise cloud deployment QA checklist
* the remaining gaps versus a top-tier competition-winning submission
* the next highest-value improvements, if any

---

# IMPLEMENTATION RULES

* Do not overengineer
* Do not massively rewrite everything
* Preserve what already works
* Prefer a strong, stable vertical slice
* Prioritize:

  1. competition fit
  2. live interaction quality
  3. visual polish
  4. architectural clarity
  5. demo readiness

---

# OUTPUT FORMAT

Work in this order:

## Step 1

Briefly summarize:

* what is still incomplete
* what architecture weaknesses remain
* what experience issues remain
* the exact implementation plan

## Step 2

Complete the architecture and reliability pass.
Show diffs.

## Step 3

Complete the live interaction and interruption pass.
Show diffs.

## Step 4

Complete the UX polish and math behavior pass.
Show diffs.

## Step 5

Complete the logging and cleanup pass.
Show diffs.

## Step 6

Provide the final QA checklists and the remaining competition gaps.

Do not stop for approval.
Execute the full plan end-to-end.
