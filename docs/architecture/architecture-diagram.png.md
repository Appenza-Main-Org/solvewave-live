# Architecture Diagram Placeholder

**Action Required:** Create a visual architecture diagram at `docs/architecture-diagram.png`

## Instructions

1. Use the detailed description in [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md) as your reference
2. Create a visual diagram using one of these tools:
   - **Excalidraw** (https://excalidraw.com) — Hand-drawn style, PNG export
   - **Draw.io / diagrams.net** — Professional flowcharts, SVG/PNG export
   - **Figma** — Design-focused, shareable links
   - **Mermaid** (in Markdown) — Code-based diagrams

3. Export as PNG and save to: `docs/architecture-diagram.png`

4. Delete this placeholder file once the image is created

## Quick Reference (for diagram creation)

Show these 3 layers:
```
┌─────────────────────────┐
│  Browser (Next.js)      │
│  - UI Components        │
│  - WebSocket client     │
│  - Web Audio/Speech API │
└───────┬─────────────────┘
        │ WebSocket /ws/session
        │ (Binary + JSON frames)
        ▼
┌─────────────────────────┐
│  Backend (FastAPI)      │
│  - session_manager.py   │
│  - live_client.py       │
│  - TutorAgent           │
└───────┬─────────────────┘
        │ google-genai SDK
        ▼
┌─────────────────────────┐
│  Gemini Live API        │
│  - Audio model (voice)  │
│  - Standard model (text)│
└─────────────────────────┘
```

Key elements to include:
- Single WebSocket connection
- Binary frames (audio PCM 16kHz → 24kHz)
- JSON frames (text, image, control)
- asyncio.Queue (decouples receive/send)
- Two concurrent tasks (upstream/downstream)
- Mode routing (explain/quiz/homework)
- Live state flow
- Session timer
- Google Cloud Run deployment indicator

---

**Temporary workaround:** Until the visual diagram is created, judges can refer to [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md) for a detailed textual description with ASCII diagrams.
