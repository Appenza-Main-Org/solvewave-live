You are working on SolveWave, a competition-ready app for the Gemini Live Agent Challenge.

Project context:
- SolveWave is a real-time, voice-first, vision-enabled math tutor
- Stack: Next.js frontend, FastAPI backend, Gemini Live API, Cloud Run
- Current implementation uses a single WebSocket for text + image + voice streaming
- Problem: WebSockets are not stable enough on mobile for the voice path
- Goal: migrate the REAL-TIME AUDIO TRANSPORT from browser WebSocket streaming to WebRTC, while keeping the project aligned with Gemini Live Agent Challenge requirements

Very important constraints:
1. DO NOT remove Gemini Live API from the architecture
2. DO NOT replace the core live agent path with a non-Gemini system
3. Keep the submission compliant with the Live Agents category:
   - must still use Gemini Live API or ADK
   - must still be hosted on Google Cloud
4. Keep the app math-only and demo-ready
5. Keep changes minimal and modular
6. Preserve existing folder structure unless there is a strong reason to change it
7. Prioritize mobile stability, low latency, and a polished demo over abstraction

Architecture target:
- Use WebRTC for browser/mobile real-time audio transport
- Keep FastAPI backend as the control/application backend
- Keep Gemini Live API as the mandatory live intelligence layer
- Text, image upload, transcript, mode switching, and recap can remain on existing app flows unless a small change is clearly beneficial
- If needed, introduce a small signaling flow
- If a media server/framework is needed, prefer the smallest practical option and explain the tradeoff
- If using a third-party framework like LiveKit or Daily would improve mobile reliability, explicitly say so, but keep Gemini Live API in the loop and document that this is only the transport/media layer

What I need from you:
1. First, assess whether this migration is technically worth it for mobile stability
2. Then propose the BEST compliant architecture option for SolveWave
3. Then implement the refactor plan in a minimal, production-sensible way
4. Update the codebase carefully
5. Add or update any needed backend/frontend files
6. Update README / architecture notes to make competition compliance obvious

Please produce your output in this order:

A. Compliance check
- explain clearly why this approach remains aligned with the competition
- explicitly state what must remain true for compliance

B. Recommended architecture
- show old flow vs new flow
- identify which parts stay on WebSocket, which move to WebRTC
- mention signaling, media handling, interruption/barge-in, audio playback, and mobile browser considerations

C. Concrete implementation plan
- list exact files to modify
- explain each change briefly
- keep it practical and minimal

D. Code changes
- implement the changes directly
- prefer working vertical slice over perfect abstraction
- keep comments concise and useful

E. Submission-readiness updates
- update README / docs so judges can understand:
  - Gemini Live API is still used
  - WebRTC is used to improve mobile transport reliability
  - Google Cloud hosting remains in place
  - any third-party transport/media layer is clearly disclosed

Important technical guidance:
- preserve existing Explain / Quiz / Homework modes
- preserve visible live states: Ready / Listening / Seeing / Thinking / Speaking / Interrupted / Error
- preserve image upload flow
- preserve strong transcript experience
- preserve math-specific UX
- optimize for a <4 minute demo
- be honest about what is fully implemented vs scaffolded

Important engineering guidance:
- do not overengineer
- do not rewrite the whole app
- do not introduce unnecessary infrastructure unless it materially improves mobile reliability
- prefer a solution that is realistic to demo and deploy quickly

Before coding, inspect the current project structure and summarize the smallest high-value migration path.