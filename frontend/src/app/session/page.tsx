"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionSocket, LiveState } from "@/hooks/useSessionSocket";
import { useVoiceTranscription } from "@/hooks/useVoiceTranscription";
import { useSessionTimer } from "@/hooks/useSessionTimer";
import TranscriptPanel from "@/components/TranscriptPanel";
import ModeSelector, { type TutorMode } from "@/components/ModeSelector";
import ExamplesPanel from "@/components/ExamplesPanel";
import HelpPanel from "@/components/HelpPanel";
import FaheemLogo from "@/components/FaheemLogo";
import { log } from "@/lib/log";

// ── Live state indicator ────────────────────────────────────────────────────
const STATE_CONFIG: Record<LiveState, { dot: string; label: string; pulse: boolean }> = {
  idle:         { dot: "bg-slate-500",   label: "Ready",       pulse: false },
  connecting:   { dot: "bg-yellow-400",  label: "Connecting…", pulse: true  },
  connected:    { dot: "bg-emerald-400", label: "Live",        pulse: false },
  thinking:     { dot: "bg-sky-400",     label: "Thinking…",   pulse: true  },
  seeing:       { dot: "bg-violet-400",  label: "Seeing…",     pulse: true  },
  listening:    { dot: "bg-rose-400",    label: "Listening…",  pulse: true  },
  speaking:     { dot: "bg-emerald-500", label: "Speaking…",   pulse: true  },
  interrupted:  { dot: "bg-orange-400",  label: "Interrupted", pulse: false },
  error:        { dot: "bg-red-500",     label: "Error",       pulse: false },
};

const LIVE_STRIP_COPY: Record<LiveState, { title: string; body: string }> = {
  idle:        { title: "Ready",        body: "Start a session to begin" },
  connecting:  { title: "Connecting…",  body: "Setting up live audio" },
  connected:   { title: "Live",         body: "Speak, type, or snap a problem" },
  thinking:    { title: "Thinking…",    body: "Working out the next step" },
  seeing:      { title: "Seeing…",      body: "Reading your image" },
  listening:   { title: "Listening",    body: "Speak naturally — interrupt anytime" },
  speaking:    { title: "Speaking…",    body: "Listen, or interrupt with a question" },
  interrupted: { title: "Interrupted",  body: "Listening to your follow-up" },
  error:       { title: "Error",        body: "End and restart the session" },
};

// ── Page ────────────────────────────────────────────────────────────────────
export default function SessionPage() {
  const [mode, setMode]               = useState<TutorMode>("explain");
  const [text, setText]               = useState("");
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const fileInputRef      = useRef<HTMLInputElement>(null);
  const autoVoiceRef      = useRef(false);   // set true when Start auto-triggers voice
  const partialTranscriptIndexRef = useRef<number | null>(null);

  const {
    status,
    isActive,
    isThinking,
    isSpeaking,
    liveState,
    voiceActive,
    errorDetail,
    transcript,
    setTranscript,
    startSession,
    stopSession,
    sendText,
    sendTextQuiet,
    sendImage,
    startVoice,
    stopVoice,
  } = useSessionSocket();

  const { formatted: timerDisplay } = useSessionTimer(isActive);

  const state   = STATE_CONFIG[liveState];
  const canSend = isActive && text.trim().length > 0;

  // Refs to avoid stale closures in voice transcription callbacks
  const sendTextQuietRef = useRef(sendTextQuiet);
  sendTextQuietRef.current = sendTextQuiet;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const voiceActiveRef = useRef(voiceActive);
  voiceActiveRef.current = voiceActive;
  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  // ── Voice transcription callbacks ─────────────────────────────────────────

  const onPartialTranscript = useCallback((text: string) => {
    if (!text.trim()) return;

    // Ignore echo: Web Speech API picks up Faheem's speaker output
    if (isSpeakingRef.current) return;

    setTranscript((prev) => {
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      // If we already have a partial transcript, update it in place
      if (partialTranscriptIndexRef.current !== null) {
        const updated = [...prev];
        updated[partialTranscriptIndexRef.current] = {
          role: "student",
          text,
          timestamp: now,
          partial: true,
        };
        return updated;
      }

      // Otherwise, add a new partial transcript row
      const newEntry = {
        role: "student" as const,
        text,
        timestamp: now,
        partial: true,
      };
      partialTranscriptIndexRef.current = prev.length;
      return [...prev, newEntry];
    });
  }, [setTranscript]);

  const onFinalTranscript = useCallback((text: string) => {
    if (!text.trim()) return;

    // Ignore echo: Web Speech API picks up Faheem's speaker output
    if (isSpeakingRef.current) return;

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setTranscript((prev) => {
      const entry = {
        role: "student" as const,
        text,
        timestamp: now,
        partial: false,
      };

      // If we have a tracked partial transcript index, finalize it
      if (partialTranscriptIndexRef.current !== null) {
        const updated = [...prev];
        updated[partialTranscriptIndexRef.current] = entry;
        partialTranscriptIndexRef.current = null;
        return updated;
      }

      // Fallback: scan backward for the last partial student entry and replace it
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === "student" && prev[i].partial) {
          const updated = [...prev];
          updated[i] = entry;
          partialTranscriptIndexRef.current = null;
          return updated;
        }
      }

      return [...prev, entry];
    });

    // Always send transcribed text to the backend text API.
    // Gemini Live also receives audio directly, so the user may get
    // both a voice reply (from Live) and a text reply (from text API).
    if (isActiveRef.current) {
      sendTextQuietRef.current(text, modeRef.current);
    }
  }, [setTranscript]);

  const { isSupported: transcriptionSupported, isRunning: transcriptionRunning, startTranscription, stopTranscription } =
    useVoiceTranscription({
      onPartial: onPartialTranscript,
      onFinal: onFinalTranscript,
    });

  // ── Auto-start voice + transcription once session is live ─────────────────
  useEffect(() => {
    if (liveState === "connected" && autoVoiceRef.current) {
      autoVoiceRef.current = false;
      startVoice();
      if (transcriptionSupported) {
        startTranscription();
      }
    }
  }, [liveState, startVoice, transcriptionSupported, startTranscription]);

  // ── Stop transcription when voice stops ───────────────────────────────────
  useEffect(() => {
    if (!voiceActive && transcriptionRunning) {
      stopTranscription();
      partialTranscriptIndexRef.current = null;
    }
  }, [voiceActive, transcriptionRunning, stopTranscription]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    log.image("Image captured — auto-sending", {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024).toFixed(1)} KB`,
    });

    // Auto-send immediately — no staging/upload step
    if (isActive) {
      sendImage(file, "", mode);
    }
    e.target.value = "";
  }

  function handleSend() {
    if (!canSend) return;
    sendText(text.trim(), mode);
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleModeChange(m: TutorMode) {
    setMode(m);
    log.mode(`Tab → ${m}`);
  }

  function handleVoiceToggle() {
    if (voiceActive) {
      log.voice("User stopped voice");
      stopVoice();
      if (transcriptionRunning) {
        stopTranscription();
      }
    } else {
      log.voice("User started voice");
      startVoice();
      if (transcriptionSupported) {
        startTranscription();
      }
    }
  }

  function handleExampleClick(exampleText: string) {
    setText(exampleText);
    // Focus the textarea (if it exists)
    const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
    textarea?.focus();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-dvh bg-slate-950 overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex-none border-b border-slate-800/60 bg-slate-950/95 backdrop-blur z-10">
        {/* Row 1: Brand + controls */}
        <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 h-12 sm:h-16">

          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <FaheemLogo size={28} />
            <span className="hidden sm:inline font-semibold text-sm tracking-tight text-slate-200">
              Faheem <span className="text-emerald-400">Math</span>
            </span>
          </div>

          {/* Mode Tab Bar — centered (desktop only) */}
          <div className="hidden md:flex flex-1 justify-center">
            <ModeSelector selected={mode} onChange={handleModeChange} />
          </div>

          {/* Spacer on mobile/tablet */}
          <div className="flex-1 md:hidden" />

          {/* Session timer + Live state + session controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {isActive && (
              <div className="hidden sm:block px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 font-mono">
                {timerDisplay}
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-900/90 border border-slate-800">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${state.dot} ${state.pulse ? "animate-pulse" : ""}`}
              />
              <span className="text-[10px] sm:text-xs text-slate-300 font-medium">{state.label}</span>
            </div>
            <button
              onClick={() => setHelpPanelOpen(true)}
              className="hidden lg:flex flex-none w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 items-center justify-center text-slate-400 hover:text-slate-200 transition-colors text-sm"
              title="Help & About"
              type="button"
            >
              ?
            </button>
            <button
              onClick={() => {
                if (isActive) {
                  stopSession();
                } else {
                  autoVoiceRef.current = true; // auto-start voice once connected
                  startSession();
                }
              }}
              disabled={status === "connecting"}
              className={`
                flex-none px-3 sm:px-3.5 h-8 sm:h-9 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap
                transition-all duration-150 active:scale-95 border border-transparent
                ${isActive
                  ? "bg-red-600/90 hover:bg-red-500 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {/* Short labels on mobile/tablet, full on desktop */}
              <span className="lg:hidden">
                {status === "connecting" ? "…" : isActive ? "End" : "Start"}
              </span>
              <span className="hidden lg:inline">
                {status === "connecting" ? "Connecting…" : isActive ? "End session" : "Start session"}
              </span>
            </button>
          </div>
        </div>

        {/* Row 2: Mode selector (mobile/tablet only) */}
        <div className="md:hidden flex justify-center px-3 pb-2">
          <ModeSelector selected={mode} onChange={handleModeChange} />
        </div>
      </header>

      {/* ── Main layout: transcript + side panel ───────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-hidden px-2 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
        <div className="h-full flex flex-col lg:flex-row gap-3 lg:gap-5">

          {/* Primary: transcript / live tutoring surface */}
          <section className="flex-1 min-h-0 min-w-0">
            <div className="h-full rounded-xl sm:rounded-2xl bg-slate-900/70 border border-slate-800/70 shadow-[0_0_0_1px_rgba(15,23,42,0.9)] overflow-hidden">
              <TranscriptPanel
                entries={transcript}
                isThinking={isThinking && isActive}
              />
            </div>
          </section>

          {/* Secondary: contextual side panel (hidden on mobile) */}
          <aside className="hidden lg:flex w-80 flex-none flex-col gap-4">
            {/* Examples panel */}
            <ExamplesPanel
              mode={mode}
              onExampleClick={handleExampleClick}
              disabled={!isActive}
            />

            {/* Camera tip */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800/70 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Camera
              </span>
              <p className="mt-1 text-xs text-slate-500">
                Tap 📷 below to snap a math problem — it sends automatically.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* ── Live voice / state strip (pinned above composer) ──────────────── */}
      <div
        className={`
          flex-none flex flex-col gap-1 mx-2 sm:mx-4 mb-1 px-3 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs
          border bg-slate-950/80
          ${
            liveState === "error"
              ? "border-red-500/60 text-red-100 bg-red-950/40"
              : liveState === "interrupted"
              ? "border-orange-500/60 text-orange-50 bg-slate-950/80"
              : "border-slate-800 text-slate-300"
          }
        `}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`
                w-2 h-2 rounded-full ${state.dot}
                ${state.pulse ? "animate-pulse" : ""}
              `}
            />
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.12em] sm:tracking-[0.16em]">
              {LIVE_STRIP_COPY[liveState].title}
            </span>
          </div>
          <div className="hidden sm:block flex-1 min-w-0">
            <p className="text-[11px] text-slate-400 truncate">
              {LIVE_STRIP_COPY[liveState].body}
            </p>
          </div>
          {voiceActive && liveState !== "error" && (
            <div className="flex items-end gap-[3px] h-5 sm:h-6 ml-auto">
              {[1, 2, 3, 4].map((b) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={b}
                  className="w-1 rounded-full bg-emerald-400/80 animate-[bounce_1.1s_ease-in-out_infinite]"
                  style={{
                    height: `${4 + b * 3}px`,
                    animationDelay: `${b * 90}ms`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
        {/* Error detail — tappable to copy */}
        {liveState === "error" && errorDetail && (
          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(errorDetail);
                alert("Error copied to clipboard:\n\n" + errorDetail);
              } else {
                alert(errorDetail);
              }
            }}
            className="text-left text-[10px] text-red-300/80 bg-red-950/50 rounded-lg px-2 py-1.5 font-mono whitespace-pre-wrap break-all leading-relaxed"
          >
            {errorDetail}
            <span className="block mt-1 text-red-400/60 text-[9px] uppercase tracking-wider">Tap to copy</span>
          </button>
        )}
      </div>

      {/* ── Composer bar (pinned to bottom) ────────────────────────────────── */}
      <div className="flex-none flex items-end gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 border-t border-slate-800/60 bg-slate-950">

        {/* Camera — auto-sends on capture */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!isActive}
          title="Snap a math problem"
          className="
            flex-none w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center
            text-sm sm:text-base transition-all duration-150
            bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200
            disabled:opacity-30 disabled:cursor-not-allowed
          "
          type="button"
        >
          📷
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleImagePick}
        />

        {/* Voice toggle */}
        <button
          onClick={handleVoiceToggle}
          disabled={!isActive}
          title={voiceActive ? "Stop voice" : "Speak your math problem"}
          className={`
            flex-none w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center
            text-sm sm:text-base transition-all duration-150
            ${voiceActive
              ? "bg-rose-600 text-white ring-2 ring-rose-500/40 animate-pulse"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }
            disabled:opacity-30 disabled:cursor-not-allowed
          `}
          type="button"
        >
          {voiceActive ? "⏹" : "🎙"}
        </button>

        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isActive}
          rows={1}
          placeholder={
            voiceActive
              ? "Listening… speak or type"
              : isActive
              ? "Type a math problem…"
              : "Tap Start to begin"
          }
          dir="auto"
          className="
            flex-1 resize-none rounded-xl bg-slate-800 border border-slate-700
            px-3 sm:px-4 py-2 sm:py-2.5 text-[13px] sm:text-sm text-slate-100 placeholder-slate-500
            focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600
            disabled:opacity-40 transition-colors leading-relaxed max-h-28 overflow-y-auto
          "
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          title="Send"
          className="
            flex-none w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500
            text-white flex items-center justify-center font-bold text-sm sm:text-base
            transition-all duration-150
            disabled:opacity-30 disabled:cursor-not-allowed active:scale-95
          "
          type="button"
        >
          ↑
        </button>
      </div>

      {/* ── Help Panel (modal) ──────────────────────────────────────────────── */}
      <HelpPanel
        isOpen={helpPanelOpen}
        onClose={() => setHelpPanelOpen(false)}
        sessionStatus={status}
        voiceActive={voiceActive}
        stubMode={false}
      />

    </div>
  );
}
