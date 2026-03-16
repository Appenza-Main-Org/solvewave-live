# SolveWave — Architecture (Mermaid) v0.5.1

## System Overview

```mermaid
graph TB
    subgraph Student["Student"]
        MIC["Microphone"]
        SPK["Speaker"]
        KB["Keyboard"]
        CAM["Camera"]
    end

    subgraph Browser["Browser — Next.js 14 + Framer Motion (Cloud Run)"]
        subgraph UI["React Components"]
            LOGO[SolveWaveLogo]
            MS[ModeSelector<br/>Explain / Quiz / Homework]
            ORB[AmbientOrb<br/>Animated SVG state viz]
            TP[TranscriptPanel<br/>F/U avatars]
            EP[ExamplesPanel<br/>Study Curriculum]
            COMP[Floating Composer<br/>Camera · Mic · Text · Send]
            TIMER[Session Timer<br/>mm:ss]
            HELP[HelpPanel<br/>Modal overlay]
        end

        subgraph Hooks["Core Hooks"]
            USS[useSessionSocket<br/>WebSocket + Audio + State]
            UVT[useVoiceTranscription<br/>Web Speech API]
            UST[useSessionTimer]
        end

        subgraph WebAudio["Web Audio API"]
            MCAP[Mic Capture<br/>native rate → 16kHz<br/>linear interpolation]
            PLAY[Audio Playback<br/>24kHz PCM mono]
        end
    end

    subgraph Backend["Backend — FastAPI (Cloud Run)"]
        subgraph API["main.py"]
            HEALTH["GET /health"]
            WSEP["WS /ws/session"]
        end

        subgraph SM["session_manager.py"]
            RL[receive_loop<br/>Browser → Queue]
            AQ[(asyncio.Queue)]
            MR[Mode Router<br/>+ addendum injection]
        end

        subgraph LC["live_client.py — Gemini Bridge"]
            UP[upstream<br/>Queue → Gemini]
            DN[downstream<br/>Gemini → Browser]
            GTR[generate_text_reply<br/>multi-turn chat]
            GIR[generate_image_reply<br/>multimodal vision]
        end

        subgraph Agent["tutor_agent.py"]
            SP[System Prompt<br/>system_prompt.md]
            TD[Tool Dispatcher]
        end

        subgraph Tools["Math Tools"]
            T1[detect_problem_type<br/>keyword classification]
            T2[check_answer<br/>verdict: correct/partial/incorrect]
            T3[generate_next_hint<br/>3 escalation levels]
            T4[build_session_recap<br/>topics · score · summary]
        end
    end

    subgraph Gemini["Gemini API (Google Cloud)"]
        LIVE["gemini-2.5-flash-native-audio<br/>Real-time audio streaming<br/>Full-duplex · Barge-in · Tools<br/>Voice: Charon"]
        TEXT["gemini-2.5-flash<br/>Text + Vision<br/>Multi-turn · Multimodal"]
    end

    %% Student <-> Browser
    MIC -->|audio| MCAP
    PLAY -->|audio| SPK
    KB -->|text| COMP
    CAM -->|"auto-capture"| COMP

    %% UI <-> Hooks
    COMP --> USS
    MS --> USS
    USS --> TP
    USS --> ORB
    UVT -.->|"partial/final transcripts"| TP
    UVT -.->|"final → sendTextQuiet"| USS
    UST --> TIMER

    %% Hooks <-> Web Audio
    USS --> MCAP
    USS --> PLAY

    %% Browser <-> Backend (WebSocket)
    MCAP -->|"binary: PCM 16kHz"| WSEP
    USS -->|"JSON: text/image/END"| WSEP
    WSEP -->|"binary: PCM 24kHz"| PLAY
    WSEP -->|"JSON: message/status/recap"| USS

    %% Backend internal
    WSEP --> RL
    RL -->|binary| AQ
    RL -->|"JSON text"| MR
    MR --> GTR
    MR -->|"JSON image"| GIR
    AQ --> UP

    %% Backend <-> Gemini
    UP -->|"realtime audio stream"| LIVE
    LIVE -->|"audio + tool_calls"| DN
    DN -->|"binary audio"| WSEP
    DN -->|"tool_call"| TD
    TD --> T1 & T2 & T3 & T4
    TD -->|"tool_response"| LIVE

    GTR -->|"text request + history"| TEXT
    TEXT -->|"text reply"| GTR
    GIR -->|"image + caption"| TEXT
    TEXT -->|"vision reply"| GIR

    %% Agent config
    SP -->|system instruction| LIVE
    SP -->|system instruction| TEXT

    %% Styling
    classDef browser fill:#1e293b,stroke:#3b82f6,color:#e2e8f0
    classDef backend fill:#1e293b,stroke:#10b981,color:#e2e8f0
    classDef gemini fill:#1e293b,stroke:#f59e0b,color:#e2e8f0
    classDef student fill:#1e293b,stroke:#8b5cf6,color:#e2e8f0

    class Browser browser
    class Backend backend
    class Gemini gemini
    class Student student
```

---

## WebSocket Message Protocol

```mermaid
sequenceDiagram
    participant S as Student
    participant B as Browser
    participant BE as Backend
    participant G as Gemini API

    Note over B,BE: WebSocket: /ws/session

    S->>B: Click "Start Tutoring"
    B->>BE: Open WebSocket
    BE-->>B: {"type":"status","value":"connected","session_id":"uuid"}
    Note over B: Auto-start voice + transcription

    rect rgb(30, 58, 95)
        Note over S,G: Voice Path (Real-time Audio + Dual Response)
        S->>B: Speaks into mic
        B->>B: Web Speech API transcribes locally
        B->>BE: Binary: PCM 16kHz chunks (resampled)
        B->>BE: JSON: sendTextQuiet(transcript, mode)
        BE->>G: Gemini Live stream (audio)
        BE->>G: generate_text_reply(transcript)
        G-->>BE: Audio response PCM 24kHz
        G-->>BE: Text response
        BE-->>B: Binary: PCM 24kHz chunks
        BE-->>B: {"type":"message","role":"tutor","text":"..."}
        B-->>S: Plays audio + shows text
    end

    rect rgb(30, 75, 58)
        Note over S,G: Text Path
        S->>B: Types message + clicks Send
        B->>BE: {"type":"text","text":"...","mode":"explain"}
        BE->>G: generate_text_reply()
        G-->>BE: Text response
        BE-->>B: {"type":"message","role":"tutor","text":"..."}
    end

    rect rgb(75, 58, 30)
        Note over S,G: Camera Path (Auto-Send Vision)
        S->>B: Taps Camera → captures photo
        B->>B: Auto-send (no staging step)
        B->>BE: {"type":"image","mimeType":"...","data":"base64"}
        BE->>G: generate_image_reply()
        G-->>BE: Vision analysis response
        BE-->>B: {"type":"message","role":"tutor","text":"..."}
    end

    rect rgb(75, 30, 58)
        Note over S,G: Barge-in (Interruption)
        S->>B: Speaks while tutor talking
        B->>BE: Binary: mic audio
        BE->>G: Audio stream continues
        G-->>BE: Interruption signal
        BE-->>B: {"type":"status","value":"interrupted"}
    end

    rect rgb(58, 30, 75)
        Note over S,G: Tool Call Flow
        G->>BE: tool_call: check_answer(...)
        BE->>BE: dispatch → local tool
        BE->>G: tool_response: {"verdict":"correct"}
        G-->>BE: Tutor audio/text with tool context
    end

    S->>B: Click "End Session"
    B->>BE: "END"
    BE->>BE: build_session_recap()
    BE-->>B: {"type":"recap","data":{...}}
    BE-->>B: Close WebSocket
```

---

## Deployment Architecture

```mermaid
graph LR
    subgraph GCP["Google Cloud Platform<br/>solvewave-live"]
        subgraph CR1["Cloud Run — us-central1"]
            FE["solvewave-frontend<br/>Node.js 18 (standalone)<br/>Port 8080"]
            BE["solvewave-backend<br/>Python 3.12 + uvicorn<br/>Port 8080"]
        end
    end

    USER["Student Browser"] -->|"HTTPS"| FE
    FE -.->|"Serves Next.js app"| USER
    USER -->|"WSS /ws/session"| BE
    BE -->|"google-genai SDK<br/>GEMINI_API_KEY"| GAPI["Gemini API"]

    subgraph ENV["Environment Variables"]
        E1["GEMINI_API_KEY"]
        E2["GEMINI_MODEL"]
        E3["CORS_ORIGINS"]
        E4[".env.production<br/>NEXT_PUBLIC_WS_URL<br/>(baked at build time)"]
    end

    ENV -.-> BE
    ENV -.-> FE
```

---

## Live State Machine

```mermaid
stateDiagram-v2
    [*] --> idle

    idle --> connecting: startSession()
    connecting --> connected: WS opened
    Note right of connected: Auto-start voice + transcription

    connected --> listening: mic active
    connected --> thinking: text/image sent
    connected --> seeing: image sent

    listening --> thinking: Gemini processing
    thinking --> speaking: audio response
    thinking --> connected: text response

    seeing --> thinking: Gemini analyzing
    seeing --> connected: vision reply

    speaking --> interrupted: barge-in detected
    speaking --> listening: turn complete
    speaking --> connected: turn complete (no mic)

    interrupted --> listening: resume (900ms)

    connected --> idle: stopSession() / "END"
    listening --> idle: stopSession() / "END"
    speaking --> idle: stopSession() / "END"

    idle --> error: WS failure
    connecting --> error: timeout
    error --> idle: retry
```

---

## Tool Call Flow

```mermaid
flowchart TD
    GEM[Gemini Live API] -->|tool_call| DISP[TutorAgent.dispatch_tool_calls]

    DISP --> DPT{detect_problem_type}
    DISP --> CA{check_answer}
    DISP --> GNH{generate_next_hint}
    DISP --> BSR{build_session_recap}

    DPT -->|"type: algebra<br/>confidence: 0.85"| RES[Tool Results]
    CA -->|"verdict: correct<br/>or partial<br/>or incorrect"| RES
    GNH -->|"hint_level: 1→2→3<br/>subtle → direct"| RES
    BSR -->|"topics, score,<br/>mistakes, summary"| RES

    RES -->|tool_response| GEM
    GEM -->|"continues with<br/>tool context"| RESP[Audio/Text Response → Student]
```

---

## Frontend Component Tree

```mermaid
graph TD
    ROOT["RootLayout<br/>layout.tsx<br/>Cairo font"] --> SESSION["SessionPage<br/>/session"]

    SESSION --> BG["Background Effects"]
    SESSION --> HEADER["Header Bar"]
    SESSION --> MAIN["Main Content"]
    SESSION --> FOOT["Floating Composer"]
    SESSION --> MODAL["HelpPanel Modal"]

    BG --> GRID[Logic Grid<br/>state-colored dots]
    BG --> GLOW[Background Glow<br/>Framer Motion blur]

    HEADER --> LOGO2[SolveWaveLogo<br/>SVG icon]
    HEADER --> BRAND2[Brand Title<br/>+ Status Dot]
    HEADER --> MS2[ModeSelector<br/>desktop]
    HEADER --> TIM[Timer Display<br/>mm:ss]
    HEADER --> HELPBTN[Help Button]
    HEADER --> BTN[Start/End Button]

    MAIN --> MOBMODE[ModeSelector<br/>mobile only]
    MAIN --> CENTER[Center Section]
    MAIN --> ASIDE["Aside<br/>(xl only)"]

    CENTER --> AMBIENT[Ambient State Viz]
    CENTER --> CANVAS[Transcript Canvas]

    AMBIENT --> ORB2[AmbientOrb<br/>animated SVG]
    AMBIENT --> LABEL[State Label + Desc]

    CANVAS --> TRANS[TranscriptPanel<br/>F/U avatars · scrollable]

    ASIDE --> EXAMPLES[ExamplesPanel<br/>Study Curriculum]
    ASIDE --> TIP[Quick Tip Card]

    FOOT --> CAMBTN[Camera Button<br/>auto-send]
    FOOT --> VOICEBTN[Mic Toggle<br/>voice + transcription]
    FOOT --> TEXTAREA[Text Input]
    FOOT --> SENDBTN[Send Button]

    %% Hooks
    SESSION -.->|uses| H1[useSessionSocket]
    SESSION -.->|uses| H2[useVoiceTranscription]
    SESSION -.->|uses| H3[useSessionTimer]
```

---

## Audio Pipeline (v0.5.0)

```mermaid
flowchart LR
    subgraph Capture["Mic Capture (Browser)"]
        A1["AudioContext<br/>(native rate: 44.1/48kHz)"]
        A2["ScriptProcessorNode<br/>(bufferSize: 4096)"]
        A3["Linear Interpolation<br/>native → 16kHz"]
        A4["Int16Array<br/>PCM 16-bit"]
    end

    subgraph Transport["WebSocket"]
        WS["Binary frames<br/>(ArrayBuffer)"]
    end

    subgraph Backend["Backend"]
        AQ2["asyncio.Queue"]
        UP2["upstream task"]
    end

    subgraph GeminiLive["Gemini Live"]
        GL["Audio processing<br/>+ response"]
    end

    subgraph Playback["Audio Playback (Browser)"]
        P1["Receive PCM 24kHz"]
        P2["AudioContext<br/>(playback rate: 24kHz)"]
        P3["AudioBufferSourceNode"]
    end

    A1 --> A2 --> A3 --> A4 --> WS --> AQ2 --> UP2 --> GL
    GL --> |"PCM 24kHz"| WS
    WS --> P1 --> P2 --> P3
```

---

*Last updated: 2026-03-04 (v0.5.1)*
