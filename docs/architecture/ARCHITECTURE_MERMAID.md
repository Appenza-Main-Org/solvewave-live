# Faheem Live — Architecture (Mermaid)

## System Overview

```mermaid
graph TB
    subgraph Student["👤 Student"]
        MIC[🎙 Microphone]
        SPK[🔊 Speaker]
        KB[⌨️ Keyboard]
        CAM[📷 Camera/Upload]
    end

    subgraph Browser["Browser — Next.js 14 (Cloud Run)"]
        subgraph UI["React Components"]
            TP[TranscriptPanel]
            MS[ModeSelector<br/>explain / quiz / homework]
            EP[ExamplesPanel]
            IC[ImageUpload]
            COMP[Composer<br/>voice · text · image]
            LSI[Live State Indicator<br/>9 states]
            TIMER[Session Timer]
        end

        subgraph Hooks["Core Hooks"]
            USS[useSessionSocket<br/>WebSocket + Audio mgmt]
            UVT[useVoiceTranscription<br/>Web Speech API]
            UST[useSessionTimer]
        end

        subgraph WebAudio["Web Audio API"]
            MCAP[Mic Capture<br/>16kHz PCM mono]
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
        LIVE["gemini-2.5-flash-native-audio<br/>Real-time audio streaming<br/>Full-duplex · Barge-in · Tools"]
        TEXT["gemini-2.5-flash<br/>Text + Vision<br/>Multi-turn · Multimodal"]
    end

    %% Student ↔ Browser
    MIC -->|audio| MCAP
    PLAY -->|audio| SPK
    KB -->|text| COMP
    CAM -->|image| IC

    %% UI ↔ Hooks
    COMP --> USS
    IC --> USS
    MS --> USS
    USS --> TP
    USS --> LSI
    UVT -.->|partial/final transcripts| TP
    UST --> TIMER

    %% Hooks ↔ Web Audio
    USS --> MCAP
    USS --> PLAY

    %% Browser ↔ Backend (WebSocket)
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

    %% Backend ↔ Gemini
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

    S->>B: Click "Start Session"
    B->>BE: Open WebSocket
    BE-->>B: {"type":"status","value":"connected","session_id":"uuid"}

    rect rgb(30, 58, 95)
        Note over S,G: Voice Path (Real-time Audio)
        S->>B: Speaks into mic
        B->>BE: Binary: PCM 16kHz chunks (100ms)
        BE->>G: Gemini Live stream
        G-->>BE: Audio response PCM 24kHz
        BE-->>B: Binary: PCM 24kHz chunks
        B-->>S: Plays audio
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
        Note over S,G: Image Path (Vision)
        S->>B: Uploads math problem photo
        B->>BE: {"type":"image","mimeType":"...","data":"base64","caption":"..."}
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
    subgraph GCP["Google Cloud Platform<br/>faheem-live-competition"]
        subgraph CR1["Cloud Run — us-central1"]
            FE["faheem-math-frontend<br/>Node.js 18 (standalone)<br/>Port 8080"]
            BE["faheem-math-backend<br/>Python 3.12 + uvicorn<br/>Port 8080"]
        end
    end

    USER["👤 Student Browser"] -->|"HTTPS"| FE
    FE -.->|"Serves Next.js app"| USER
    USER -->|"WSS /ws/session"| BE
    BE -->|"google-genai SDK<br/>GEMINI_API_KEY"| GAPI["Gemini API"]

    subgraph ENV["Environment Variables"]
        E1["GEMINI_API_KEY"]
        E2["GEMINI_MODEL"]
        E3["CORS_ORIGINS"]
        E4["NEXT_PUBLIC_WS_URL"]
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

    connected --> listening: mic active
    connected --> thinking: text/image sent

    listening --> thinking: Gemini processing
    thinking --> speaking: audio response
    thinking --> connected: text response

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
    CA -->|"verdict: correct ✅<br/>or partial ⚠️<br/>or incorrect ❌"| RES
    GNH -->|"hint_level: 1→2→3<br/>subtle → direct"| RES
    BSR -->|"topics, score,<br/>mistakes, summary"| RES

    RES -->|tool_response| GEM
    GEM -->|"continues with<br/>tool context"| RESP[Audio/Text Response → Student]
```

---

## Frontend Component Tree

```mermaid
graph TD
    ROOT["RootLayout<br/>layout.tsx"] --> SESSION["SessionPage<br/>/session"]

    SESSION --> HEADER["Header Row"]
    SESSION --> MAIN["Main Content"]
    SESSION --> COMPOSER["Composer Bar"]

    HEADER --> BRAND[Brand Logo]
    HEADER --> MS2[ModeSelector]
    HEADER --> TIM[Timer Display]
    HEADER --> STATUS[Status Badge]
    HEADER --> HELP[HelpPanel Toggle]
    HEADER --> BTN[Start/Stop Button]

    MAIN --> LEFT["Left Panel"]
    MAIN --> RIGHT["Right Panel"]

    LEFT --> TRANS[TranscriptPanel]
    LEFT --> LIVE[Live State Strip<br/>+ Waveform]

    RIGHT --> EXAMPLES[ExamplesPanel]
    RIGHT --> IMGUP[ImageUpload]

    COMPOSER --> CAMBTN[Camera Button]
    COMPOSER --> VOICEBTN[Voice Toggle]
    COMPOSER --> TEXTAREA[Text Input]
    COMPOSER --> SENDBTN[Send Button]

    %% Hooks
    SESSION -.->|uses| H1[useSessionSocket]
    SESSION -.->|uses| H2[useVoiceTranscription]
    SESSION -.->|uses| H3[useSessionTimer]
```

---

*Last updated: 2026-03-02*
