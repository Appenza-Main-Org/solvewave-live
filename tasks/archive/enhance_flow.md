You are now acting as a senior product engineer, UX designer, and hackathon judge-focused implementation lead.

Project: **Faheem Live**
Goal: transform the current MVP into a **competition-winning Live Agents submission** for the **Gemini Live Agent Challenge**.

## Context

The app currently works, but the product experience is still weak and not competitive enough.

### Current issues to fix

1. The mode choices at the top are not clear enough — they should look and behave like **real tabs**, not subtle pills.
2. Remove **all Arabic words** from the UI. The interface must be **100% English** for consistency and demo clarity.
3. The conversation UI still looks weak and “chatbot-like” instead of a premium live tutor experience.
4. The conversation content also feels too generic / awkward. It should feel smarter, more focused, and more like a real tutor.
5. The app needs a real **voice feature** so the user can talk with the tutor naturally.
6. The project must align tightly with the **Gemini Live Agent Challenge** and should be improved to maximize its chances of winning.

## Competition requirements that must be respected

This project is intended for the **Live Agents** category.

That means the final product must clearly support:

* real-time interaction
* natural voice-based interaction
* interruption handling (barge-in)
* multimodal behavior (especially vision + voice)
* use of **Gemini Live API** or **ADK**
* hosting on **Google Cloud**

Also, the overall submission must support:

* public code repo
* clear spin-up instructions
* architecture diagram
* proof of Google Cloud deployment
* demo video under 4 minutes showing real functionality (no mockups)

Do not ignore these requirements in your design or implementation decisions.

---

# MISSION

Do a focused, high-impact upgrade in four areas:

1. **Redesign the UI/UX**
2. **Make the mode choices clear as true tabs**
3. **Add / improve real voice interaction**
4. **Refine the tutor conversation behavior so it feels smart and competition-ready**

Also:

* audit what is still missing to make this a truly strong submission
* implement the highest-value missing parts first

Do not overengineer.
Do not rebuild everything from scratch unless necessary.
Keep changes practical, polished, and demo-focused.

---

# PART 1 — UI / UX REDESIGN

## Goal

The app should feel like a **premium live AI tutor**, not a generic chat screen.

## Design direction

Make the interface:

* modern
* clean
* premium
* dark and elegant
* clearly focused on the live tutoring experience
* suitable for recording in a hackathon demo

## Required UI changes

### A. Top mode controls must become true tabs

Convert the current mode controls into a stronger tab bar.

Requirements:

* Replace the subtle pills with clear **tab-style controls**
* Tabs should be visually obvious and easy to scan
* Suggested tabs:

  * **Explain**
  * **Quiz**
  * **Homework**
* Only one active tab at a time
* Active tab should feel strong and unmistakable
* Use clean spacing, better contrast, and stronger visual selection state

### B. Remove Arabic from the UI

The visible interface should be **English only**.

Requirements:

* Remove all Arabic labels from:

  * buttons
  * tabs
  * headers
  * placeholders
  * status labels
  * helper text
* Keep the product name if needed, but all interface chrome must be English-only

### C. Redesign the layout

Improve the current composition so the screen feels like a product, not a debug page.

Preferred layout:

* Header:

  * product name / logo
  * connection / live status
  * mode tabs
* Main area:

  * transcript / tutor interaction as the primary center focus
* Secondary contextual panel:

  * image preview
  * attachment actions
  * voice controls
* Bottom composer:

  * message input
  * send action
  * attach image
  * mic / voice action

### D. Improve transcript design

The conversation should feel smart, intentional, and easier to read.

Requirements:

* Reduce the “generic chat app” feeling
* Make tutor messages feel like guided tutoring cards / responses
* Make student messages compact and cleaner
* Reduce visual clutter from timestamps
* Improve spacing and alignment
* Keep the transcript feeling premium and live

### E. Improve empty and active states

When nothing is happening, the UI should still feel intentional.

Requirements:

* Better empty-state messaging
* Clear visible session states:

  * Ready
  * Listening
  * Seeing image
  * Thinking
  * Speaking
  * Error

---

# PART 2 — VOICE FEATURE (CRITICAL FOR LIVE AGENTS)

## Goal

Add or improve real voice interaction so the user can speak to the tutor naturally.

This is a critical requirement for the Live Agents category.

## Requirements

Implement the smallest strong voice MVP that still feels real and demo-worthy:

1. User can start a voice session from the browser
2. Browser requests mic permission
3. Audio is captured and sent to the backend
4. Backend uses the **Gemini Live API** path for real-time voice interaction
5. Tutor responds in a live-friendly way
6. User can interrupt while the tutor is responding
7. The UI visibly shows:

   * Listening
   * Processing
   * Speaking
8. Voice must integrate cleanly with the existing session flow

## Important

* If a full streaming implementation already exists partially, complete and polish it
* If voice is not yet reliable, build the smallest solid version that demonstrates:

  * mic input
  * live response
  * interruption handling
* Keep text and image flows working

---

# PART 3 — CONVERSATION QUALITY / TUTOR BEHAVIOR

## Problem

The current conversation feels awkward, generic, and sometimes not aligned with what the user actually wants.

Example issue:
If the user asks to solve an expression, the tutor should not feel like a rigid language-only bot unless that is explicitly the selected learning mode.

## Required improvements

Make the tutor feel more intelligent and mode-aware.

### A. Stronger mode behavior

Each tab should meaningfully affect behavior:

* **Explain**

  * explain concepts clearly and directly
* **Quiz**

  * ask short checking questions and guide progressively
* **Homework**

  * help solve or guide through homework in a practical way

If mode is currently only visual, implement the minimum backend plumbing so the selected mode is actually passed and used.

### B. Better response style

Responses should be:

* shorter
* clearer
* more natural
* more tutor-like
* less repetitive
* less defensive
* more aligned with user intent

### C. Reduce stupid / awkward replies

Fix prompting and routing so the tutor:

* does not ignore obvious user intent
* does not over-explain the wrong thing
* does not sound like a generic language practice bot when the user is asking for math help

### D. Make the tutor competition-demo friendly

The tutor should feel like:

* a live assistant
* a capable multimodal guide
* fast and relevant
* suitable for an impressive demo video

---

# PART 4 — LOGGING / RELIABILITY / FLOW AUDIT

Add enough logging to verify and debug the full flow.

## Frontend logs

Add structured logs for:

* session start / stop
* websocket connect / disconnect / error
* tab change
* text send
* image select / send
* voice start / stop
* mic permission result
* backend message received
* state transitions

## Backend logs

Add structured logs for:

* websocket accepted / closed
* incoming message type
* selected mode
* text path vs image path vs voice path
* Gemini request start / success / fallback
* image payload details
* voice session events
* interruption events
* exceptions with stack traces

## Flow audit

Audit and fix the following end-to-end:

### 1. Text flow

* start session
* send text
* get response
* preserve context
* stop session cleanly

### 2. Image flow

* select image
* preview image
* send image
* correct multimodal route used
* response references image meaningfully

### 3. Voice flow

* mic permission
* start speaking
* backend receives voice input
* Gemini Live voice path used
* response returns
* user can interrupt

### 4. Mode flow

* tab changes visibly
* selected mode affects behavior
* mode remains consistent through the session

---

# PART 5 — COMPETITION WINNING GAP CHECK

After making the changes, audit what is still missing for a strong submission.

Specifically check:

* Does the product clearly demonstrate the **Live Agents** category?
* Does it visibly use **Gemini Live API** or ADK in the relevant flow?
* Does it clearly feel multimodal and real-time?
* Is the UX strong enough for the **Best Multimodal Integration & User Experience** subcategory?
* Is the architecture and flow robust enough for **Best Technical Execution & Agent Architecture**?
* Is the idea and execution distinctive enough for **Best Innovation & Thought Leadership**?

If anything important is still missing, identify it clearly and recommend the highest-value next steps.

---

# IMPLEMENTATION RULES

* Keep changes focused and high impact
* Do not overengineer
* Do not massively refactor unrelated code
* Preserve what already works
* Prioritize:

  1. competition fit
  2. UX polish
  3. real voice interaction
  4. reliable flow
  5. demo readiness

---

# OUTPUT FORMAT

Work in this order:

## Step 1

Briefly explain:

* what is wrong with the current UI / UX
* what is wrong with the current conversation behavior
* what is missing for a stronger competition submission
* the exact implementation plan

## Step 2

Implement the UI redesign:

* English-only UI
* real tabs
* improved layout
* improved transcript styling
  Show the diffs.

## Step 3

Implement / improve voice support using the correct Live Agents path.
Show the diffs.

## Step 4

Improve tutor behavior and mode-aware responses.
Show the diffs.

## Step 5

Add / improve logging and audit the full flow.
Show the diffs.

## Step 6

Give me a concise final checklist for:

* local testing
* cloud deployment
* demo recording
* final submission readiness

---

# SUCCESS CRITERIA

The final result should:

* look significantly more polished
* use clear English-only UI labels
* have obvious, strong tab-based mode controls
* feel like a premium live tutor product
* support real voice conversation
* behave more intelligently based on the selected mode
* be much closer to a winning Gemini Live Agent Challenge submission
