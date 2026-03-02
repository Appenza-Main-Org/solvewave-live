# Claude Code Implementation Brief — Gemini Live Agent Challenge (Live Agents Track)

## Canonical Requirements Sources (must comply)
- Challenge requirements + what to submit: https://geminiliveagentchallenge.devpost.com/#challenge-requirements :contentReference[oaicite:3]{index=3}
- Official rules (testing access + bonus points): https://geminiliveagentchallenge.devpost.com/rules :contentReference[oaicite:4]{index=4}
- Gemini Live API docs: https://ai.google.dev/gemini-api/docs/live

---

## Track Declaration
This project is a **Live Agents 🗣️** submission:
- Real-time interaction (Audio/Vision)
- Users can talk naturally and **interrupt** the agent (barge-in)
- Mandatory tech: **Gemini Live API OR ADK**, hosted on **Google Cloud** :contentReference[oaicite:5]{index=5}

---

## Non-Negotiable Challenge Requirements Checklist (must be fully satisfied)
### A) What to Build
1) NEW project created during contest period (do not assume prior work; avoid language implying it’s old). :contentReference[oaicite:6]{index=6}  
2) Goes beyond text-in/text-out; includes **multimodal inputs and outputs** (audio + at least one of vision or generated media). :contentReference[oaicite:7]{index=7}  
3) Live Agents category execution:
   - Voice-first, real-time
   - Handles interruptions/barged-in voice naturally (demo and UX must show this) :contentReference[oaicite:8]{index=8}  

### B) All Projects MUST
4) Leverage a **Gemini model**. :contentReference[oaicite:9]{index=9}  
5) Built using **Google GenAI SDK OR ADK**. :contentReference[oaicite:10]{index=10}  
6) Use at least one **Google Cloud service**. :contentReference[oaicite:11]{index=11}  

### C) What to Submit (repo must contain everything needed)
7) Text Description requirements: summary of features, technologies used, any data sources, and findings/learnings. :contentReference[oaicite:12]{index=12}  
   - Must be easy to copy into Devpost (create `SUBMISSION.md` template).
8) Public code repository + **spin-up instructions in README** proving reproducibility. :contentReference[oaicite:13]{index=13}  
9) Proof of Google Cloud deployment:
   - Provide either:
     - (Option 1) a short recording reference for proof, OR
     - (Option 2) a repo code link showing use of GCP services/APIs (e.g., Vertex AI call). :contentReference[oaicite:14]{index=14}  
   - Implement Option 2 in-repo (deterministic) AND add a placeholder path for Option 1.
10) Architecture diagram:
   - Must be easy for judges to find (place under `docs/architecture-diagram.png` and reference it prominently). :contentReference[oaicite:15]{index=15}  
11) Demo video requirement:
   - Under 4 minutes
   - Shows multimodal/agentic features working in real-time (no mockups). :contentReference[oaicite:16]{index=16}  
   - Provide `demo-script.md` (tight 3–4 min flow) + `DEMO_CHECKLIST.md`.

### D) Rules: Testing + Accessibility + Language
12) Testing access must be provided; if private, include login creds; must be free + unrestricted for judges through end of judging. :contentReference[oaicite:17]{index=17}  
   - Implement “Demo Mode” so the app is testable without paid services.
13) Minimum English support for the app and submission materials (provide English UI strings for help/hints). :contentReference[oaicite:18]{index=18}  

---

## Bonus Points (must implement/prepare)
Per official rules, add the following optional contributions for score boost: :contentReference[oaicite:19]{index=19}
1) **Publish build content** (blog/podcast/video) and include language saying it’s for this hackathon + hashtag **#GeminiLiveAgentChallenge** (max +0.6).
   - Create `docs/content/POST_DRAFT.md` (ready-to-publish outline) with required language + hashtag.
2) **Automate cloud deployment** using scripts or IaC; code must be in public repo (max +0.2).
   - Add `infra/` or `scripts/` with one-command deploy for backend to Cloud Run.
   - Add `scripts/deploy.sh` + `scripts/deploy.ps1` or Terraform (keep minimal).
3) **GDG membership bonus**: add a place to include a public GDG profile link (max +0.2).
   - Add field in `SUBMISSION.md`: `GDG_PROFILE_URL=` plus instructions. :contentReference[oaicite:20]{index=20}  

---

## Feature Work (the 4 tasks you must implement)

### (1) Full Challenge Compliance & Submission Readiness (Docs + Small UX)
Deliverables to add/update:
- `README.md` must include:
  - Challenge compliance checklist (mirror the above)
  - “Try it out” (local + deployed)
  - “Testing for judges” (free, no restrictions) + demo creds/demo mode :contentReference[oaicite:21]{index=21}
  - Cloud Run deployment instructions + env vars
  - Links to architecture diagram + proof-of-deploy evidence
- Add `SUBMISSION.md` template matching “What to Submit” items :contentReference[oaicite:22]{index=22}
- Add `DEPLOYMENT.md` with Cloud Run steps and automated deploy usage
- Add `DEMO_CHECKLIST.md` + update `demo-script.md` (<4 min live demo flow)
- Add an in-app **Help/About** panel that:
  - shows quick steps for judges to test the core features
  - shows if the app is running in Live vs Demo/Stub mode
  - shows WS status and mic status

### (2) Live transcript from user voice (real-time)
Add real-time captions for what the student says:
- Show partial transcript updates while user speaks
- Finalize into a normal transcript message after each utterance
- Must not interfere with PCM audio streaming and the Live session WS loop
Preferred approach: **Web Speech API** (SpeechRecognition) in the frontend:
- New hook `useVoiceTranscription.ts`:
  - `isSupported`, `isRunning`
  - events: `onPartial(text)` and `onFinal(text)`
- Transcript UI should support a “partial” message row updating in place
Fallback:
- If unsupported, show a small note: “Live captions aren’t supported in this browser.”

Recommended enhancement:
- Toggle “Send voice captions as text to agent”
  - on final transcript, also send JSON text message to backend so Gemini sees it in context.

### (3) Examples per feature/tab (Explain / Quiz / Homework)
Add an `ExamplesPanel` per mode:
- 1–2 line “What this mode does”
- 3–5 example buttons (math-only)
- Clicking inserts into input (preferred; consistent behavior)
Examples:
- Explain: “Explain how to solve: 2x + 5 = 17”, “Explain: 3/4 + 1/8”, “Explain slope in y=mx+b”
- Quiz: “Quiz me on fractions (easy)”, “Give me 5 algebra questions”, “Quiz me on angles”
- Homework: “I’ll upload a photo—help step by step”, “Check my answer and explain mistake”, “Explain the solution strategy”

### (4) Session timer (start/end/elapsed + recap)
Implement timer:
- Start when session starts (WS connected + mic streaming begins)
- Show elapsed `mm:ss` updating every second
- Freeze on stop/end
- Include `duration_seconds` (and optionally `duration_mmss`) in recap payload and show it in recap UI

---

## Demo Mode (required for judge access)
Implement a Demo/Stub mode so judges can test without paid keys:
- Controlled by env var e.g. `DEMO_MODE=true` or `GEMINI_STUB=true`
- In demo mode:
  - App runs end-to-end with a stubbed agent response + transcript UX + examples + timer
  - Clearly labeled in Help/About panel
- Ensure README explains how judges can use it (free + unrestricted). :contentReference[oaicite:23]{index=23}  

---

## Required Cloud Proof-in-Repo (deterministic)
To satisfy “proof of Google Cloud deployment” without relying only on a recording:
- Ensure backend calls an explicit Google Cloud service or API (e.g., Vertex AI / Gemini via Google SDK) and document the code location.
- Add a `PROOF_OF_GCP.md` that points to:
  - Cloud Run service configuration
  - the exact code file/lines where GCP service is used
This aligns with the acceptable proof option in the requirements. :contentReference[oaicite:24]{index=24}  

---

## Minimal File Touches (keep changes tight)
Frontend:
- session hook/store (timer + transcription wiring)
- transcript panel (partial/final voice rows)
- examples panel
- help/about panel
Backend:
- recap builder to include duration
- demo/stub mode switch if needed
Docs/scripts:
- README, SUBMISSION.md, DEPLOYMENT.md, PROOF_OF_GCP.md, DEMO_CHECKLIST.md, demo-script.md
- scripts/ or infra/ for automated deploy (bonus)

---

## Acceptance Criteria (must pass)
1) All “challenge requirements” satisfied and explicitly evidenced in repo (docs + code + demo mode). :contentReference[oaicite:25]{index=25}  
2) Live voice transcript works with partial + final updates.
3) Examples exist per mode with short explanations.
4) Timer works and recap shows duration.
5) Bonus items implemented:
   - deploy automation scripts present
   - content draft file present + hashtag
   - GDG profile URL slot present
6) English support present (UI hints + docs in English). :contentReference[oaicite:26]{index=26}  

---

## Final instruction
Implement everything now with minimal, clean commits (or clearly separated changes), then output:
- What changed + file list
- How to test locally
- How to deploy
- Where the proof-of-GCP is
- A 3–4 minute demo flow checklist