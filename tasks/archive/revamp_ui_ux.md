You are now acting as a senior product engineer + UX engineer for a hackathon submission.

Project: **Faheem Live**
Goal: turn the current MVP into a **competition-ready, polished Live Agent** for the Gemini Live Agent Challenge.

## Current problem

The app technically runs, but the current UI/UX looks weak and the multimodal flow is not reliable.

Observed issues:

* The layout feels like a developer tool, not a polished product
* The left panel is oversized and wastes space
* The transcript looks like a generic chat app
* There is no strong “live” feeling (Listening / Thinking / Speaking / Seeing)
* The tutor response to an uploaded image is incorrect (it says it cannot really see images), so the image understanding path is likely broken or not routed correctly
* The user experience is not strong enough for a competition demo

## Competition alignment

This must be optimized for the Gemini Live Agent Challenge:

* The project should feel **multimodal**, **real-time**, and **live**
* The UX should clearly show that the agent can see / hear / respond naturally
* The architecture should be robust and easy to demonstrate
* The final product should look polished enough for judging and demo recording

## Your mission

Do a focused improvement pass in 3 areas:

1. **Add structured logging and debugging**
2. **Redesign the UI/UX for a premium live tutor experience**
3. **Audit and fix the full text + image + mode flow so it works as expected**

Do this in a practical, minimal, high-impact way.
Do not overengineer.
Do not rewrite the whole app unless necessary.

---

# PART 1 — ADD LOGGING / DEBUGGING

## Frontend logging

Add structured console logging (and a lightweight debug utility if useful) for:

* session start
* session stop
* websocket connect
* websocket disconnect
* websocket error
* websocket message received
* mode changed
* text submitted
* image selected
* image sent
* transcript updated
* backend status/state updates

Requirements:

* Logs should be easy to grep and visually grouped
* Prefix logs clearly, e.g. `[FaheemLive][frontend][ws] ...`
* Do not spam huge payloads unless useful
* For image sends, log:

  * file name
  * mime type
  * size
  * whether base64 conversion succeeded

## Backend logging

Add structured Python logging for:

* session created
* websocket accepted
* websocket closed
* incoming message type
* image payload presence
* mime type
* base64 decode success/failure
* decoded byte length
* route taken (text path vs image path vs audio path)
* Gemini request start
* Gemini request success
* Gemini request fallback
* tool call triggered
* tool result summary
* exception stack traces

Requirements:

* Use the standard `logging` module
* Add module-level loggers
* Use clear prefixes, e.g. `[FaheemLive][backend][image]`
* Preserve readable logs in local dev and Cloud Run logs

## Critical debug goal

Specifically trace why image upload currently results in a generic “I can’t see images” answer.

I want clear logs showing:

* whether the image branch is actually hit
* whether the image bytes are decoded successfully
* whether the Gemini multimodal call is actually invoked
* the exact request path used
* the returned model text
* whether the generic tutor prompt is overpowering the image analysis flow

---

# PART 2 — UI/UX REDESIGN

## Redesign goal

Transform the app from a developer-looking split panel into a **premium live tutor interface** suitable for a hackathon demo.

## UX principles

The product should feel like:

* a real-time tutor
* calm, premium, modern
* clear and focused
* centered around the conversation, not around controls
* visibly multimodal

## Required redesign changes

### 1) Layout

Redesign the session page into a more polished hierarchy:

* Main center area should focus on the tutor interaction
* Transcript should feel like a live tutoring conversation, not generic chat bubbles
* Image area should be secondary and contextual, not dominating the left side
* Controls should be compact and intentional

Preferred structure:

* Top header: brand + mode + live state
* Main content:

  * center: transcript / live interaction
  * side panel or floating card: uploaded image preview + quick actions
* Bottom composer area:

  * answer input
  * send
  * optional mic / image actions

### 2) Live states

Add a strong visible state indicator:

* Connected
* Seeing image
* Thinking
* Speaking
* Error

This should be visually clear and should make the app feel “live”.

### 3) Visual polish

Improve:

* spacing
* typography hierarchy
* alignment
* button consistency
* bubble styling
* card styling
* empty states
* mode pills styling

Make it feel like a modern AI product.
Keep it dark theme if that is easier, but make it elegant and clean.

### 4) Transcript UX

Improve transcript behavior:

* clearer separation between tutor and student
* better timestamps or reduced timestamp noise
* show uploaded image inside the relevant student message in a polished way
* make tutor messages easier to scan
* reduce visual clutter

### 5) Input UX

Improve the bottom interaction area:

* clearer placeholder text
* better send button styling
* cleaner image attach/send flow
* make the primary action obvious

### 6) Error UX

If image analysis fails, show a visible and user-friendly error state instead of a misleading generic tutor response.

---

# PART 3 — FLOW AUDIT AND FIXES

Audit the entire end-to-end flow and fix the minimum necessary issues so the app behaves correctly.

## Core flows to verify and fix

### A) Text flow

* Start session
* Send text
* Receive tutor reply
* Maintain multi-turn context
* Stop session cleanly

### B) Image flow

* Select image
* Preview image
* Send image
* Backend receives image
* Correct image multimodal path is used
* Tutor responds based on image content
* Transcript reflects the image message properly

### C) Mode flow

* Changing mode should visibly update the UI
* The active mode should influence tutor behavior or at least be passed correctly through the system
* If mode is currently only UI-level, implement the minimum plumbing needed to make it real

### D) State flow

* Loading states should be visible
* Errors should be visible
* Session connect/disconnect should be reflected in the interface

## Important fix request

The current image behavior is wrong.
If the image path is broken, fix it.
If the prompt causes the model to ignore the image, fix the prompt or request composition.
If the wrong backend method is being called, correct the routing.
If multiple causes exist, fix the smallest clean set of changes.

---

# IMPLEMENTATION RULES

* Keep changes focused and high-value
* Do not overengineer
* Do not massively restructure unrelated code
* Preserve the existing app where possible
* Optimize for:

  1. reliability
  2. polished demo UX
  3. competition fit

---

# OUTPUT FORMAT

Work in this order:

## Step 1

Briefly explain:

* the likely reason the image flow is failing
* the UX problems with the current screen
* the exact improvement plan

## Step 2

Add logging and debugging first.
Show the diffs.

## Step 3

Redesign the session UI/UX.
Show the diffs.

## Step 4

Audit and fix the text/image/mode flows.
Show the diffs.

## Step 5

Give me a concise manual QA checklist for:

* text flow
* image flow
* mode flow
* error flow

---

# SUCCESS CRITERIA

The result should:

* look significantly better visually
* feel more like a real live tutor
* provide enough logs to diagnose failures quickly
* correctly handle image understanding instead of defaulting to a generic “I can’t see images” answer
* be much closer to a strong Gemini Live Agent Challenge submission
