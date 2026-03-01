We are in the final high-value pass before submission.

Current remaining gaps:

* No Cloud Run deployment yet
* No transcript text shown while Gemini speaks during voice mode
* Interruption/barge-in should be more visible in the UI
* Optional improvements: one-click voice start, smarter recap, Firestore persistence

Prioritize only the highest-value changes for the Gemini Live Agent Challenge.
Do not overengineer.
Do not add low-value complexity before the critical items are done.

## Priority order (must follow)

1. Prepare the app for **Google Cloud Run deployment**
2. Make **Gemini voice responses also appear as tutor transcript entries**
3. Make **interruption/barge-in visibly reflected in the UI state**
4. Then optionally:

   * one-click voice start
   * smarter recap
   * Firestore persistence (only if time remains)

---

# STEP 1 — Cloud Run deployment readiness

Audit and finalize everything needed for deployment.

Requirements:

* Verify backend Dockerfile is correct for Cloud Run
* Verify uvicorn binds to `0.0.0.0`
* Verify port uses `PORT` env var with a default of `8080`
* Ensure env vars are clearly documented
* Ensure no secrets are committed
* Update README with exact deploy steps using:

  * `gcloud run deploy --source`
* Keep this concise and accurate

Important:

* Do not claim deployment is already done
* Prepare the repo so deployment can be done immediately

Show diffs, then continue automatically.

---

# STEP 2 — Voice transcript visibility

Improve the voice experience for demo clarity.

Problem:
When Gemini speaks via voice, the transcript can appear silent or incomplete, which weakens the live tutor experience.

Requirements:

* Whenever Gemini produces a voice response, also append a corresponding tutor text entry to the transcript
* Reuse any available text output from the Gemini response if available
* If the API returns both audio and text, preserve the text cleanly
* If text is not directly available, use the best minimal fallback path
* Keep the transcript concise and readable
* Do not break current audio playback

Goal:
The demo should clearly show what the tutor is saying even during voice mode.

Show diffs, then continue automatically.

---

# STEP 3 — Visible interruption state

Improve barge-in visibility.

Requirements:

* When the user interrupts while Gemini is responding, reflect it clearly in UI state
* Add or improve a visible state such as:

  * Interrupted
  * Re-listening
  * Thinking
* Keep the transition visually obvious and demo-friendly
* Preserve existing functionality
* Do not overcomplicate the state model

Goal:
Interruption should be obvious to the viewer in the demo video.

Show diffs, then continue automatically.

---

# STEP 4 — Optional polish (only if safe and fast)

If the above three are complete and stable, then do the following in this order:

1. One-click voice start

   * When the user clicks Start, optionally request mic permission immediately and begin voice mode if appropriate
2. Smarter recap

   * Improve recap quality using existing context
3. Firestore persistence

   * Add only lightweight session persistence if it can be done cleanly and quickly
   * Do not let this delay the critical items

If any optional step risks breaking stability, skip it and say why.

Show diffs, then continue automatically.

---

# FINAL OUTPUT

At the end, provide:

1. Exact local verification steps
2. Exact Cloud Run deployment steps
3. Exact submission-readiness checklist
4. A short note on what was intentionally left out because it was lower priority

Do not stop for approval.
Execute the full plan in priority order.
