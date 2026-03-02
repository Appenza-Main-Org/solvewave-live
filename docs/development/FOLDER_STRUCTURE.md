# Folder Structure — Faheem Math

```
faheem-live-gemini/
├── 📄 README.md                    # Main project documentation (submission-ready)
├── 📄 SUBMISSION.md                # Devpost submission template
├── 📄 DEPLOYMENT.md                # Cloud Run deployment guide
├── 📄 PROOF_OF_GCP.md              # Evidence of Google Cloud usage
├── 📄 DEMO_CHECKLIST.md            # 4-minute demo preparation checklist
├── 📄 demo-script.md               # Narrated demo script
├── 📄 IMPLEMENTATION_SUMMARY.md    # Summary of all changes for submission
├── 📄 CLAUDE.md                    # Project instructions (dev reference)
│
├── 📁 docs/                        # Documentation & diagrams
│   ├── ARCHITECTURE_DIAGRAM.md     # Detailed architecture description
│   ├── architecture-diagram.png.md # Placeholder for visual diagram
│   └── content/
│       └── POST_DRAFT.md           # Blog post with #GeminiLiveAgentChallenge
│
├── 📁 scripts/                     # Deployment automation
│   ├── deploy.sh                   # Unix/macOS deployment script
│   └── deploy.ps1                  # Windows PowerShell deployment script
│
├── 📁 backend/                     # FastAPI backend
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py                 # FastAPI app entry point
│       ├── config.py               # Settings
│       ├── agents/                 # TutorAgent (updated with duration)
│       ├── models/                 # Pydantic schemas
│       ├── prompts/                # System prompt
│       ├── services/               # LiveClient (Gemini bridge)
│       ├── tools/                  # Math tools
│       └── ws/                     # WebSocket session manager (updated)
│
└── 📁 frontend/                    # Next.js frontend
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── globals.css
        │   ├── page.tsx
        │   └── session/
        │       └── page.tsx        # Main session UI (updated)
        ├── components/
        │   ├── TranscriptPanel.tsx # Updated with partial transcripts
        │   ├── ModeSelector.tsx
        │   ├── ExamplesPanel.tsx   # NEW: Mode-specific examples
        │   └── HelpPanel.tsx       # NEW: Help/About panel
        ├── hooks/
        │   ├── useSessionSocket.ts # Updated: exposed setTranscript
        │   ├── useVoiceTranscription.ts # NEW: Web Speech API
        │   └── useSessionTimer.ts  # NEW: Session timer
        └── lib/
            └── log.ts
```

## Key Files by Purpose

### 📋 Submission Documents
- `README.md` — Main entry point (challenge compliance, testing access)
- `SUBMISSION.md` — Copy-paste ready for Devpost
- `PROOF_OF_GCP.md` — Evidence of Google Cloud deployment
- `DEPLOYMENT.md` — Step-by-step deployment guide

### 🎬 Demo Resources
- `demo-script.md` — Narrated 4-minute demo flow
- `DEMO_CHECKLIST.md` — Pre-recording checklist
- `docs/ARCHITECTURE_DIAGRAM.md` — Technical architecture description

### 🚀 Deployment
- `scripts/deploy.sh` — One-command deploy (Unix/macOS)
- `scripts/deploy.ps1` — One-command deploy (Windows)

### 💻 Code (New Features)
- `frontend/src/hooks/useVoiceTranscription.ts` — Live captions
- `frontend/src/hooks/useSessionTimer.ts` — Session timer
- `frontend/src/components/ExamplesPanel.tsx` — Example prompts
- `frontend/src/components/HelpPanel.tsx` — Help/About modal

### 📊 Development Reference
- `IMPLEMENTATION_SUMMARY.md` — Full change log
- `CLAUDE.md` — Project instructions
- `FOLDER_STRUCTURE.md` — This file
