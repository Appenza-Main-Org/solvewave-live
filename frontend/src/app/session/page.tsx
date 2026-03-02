"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionSocket, LiveState } from "@/hooks/useSessionSocket";
import { useVoiceTranscription } from "@/hooks/useVoiceTranscription";
import { useSessionTimer } from "@/hooks/useSessionTimer";
import TranscriptPanel from "@/components/TranscriptPanel";
import ModeSelector, { type TutorMode } from "@/components/ModeSelector";
import ExamplesPanel from "@/components/ExamplesPanel";
import HelpPanel from "@/components/HelpPanel";
import { log } from "@/lib/log";

// ── Live state indicator ────────────────────────────────────────────────────
const STATE_CONFIG: Record<LiveState, { dot: string; label: string; pulse: boolean }> = {
  idle:       { dot: "bg-slate-500",   label: "Ready",       pulse: false },
  connecting: { dot: "bg-yellow-400",  label: "Connecting…", pulse: true  },
  connected:  { dot: "bg-emerald-400", label: "Live",        pulse: false },
  thinking:   { dot: "bg-sky-400",     label: "Thinking…",   pulse: true  },
  seeing:     { dot: "bg-violet-400",  label: "Seeing…",     pulse: true  },
  listening:  { dot: "bg-rose-400",    label: "Listening…",  pulse: true  },
  speaking:     { dot: "bg-emerald-500", label: "Speaking…",   pulse: true  },
  interrupted:  { dot: "bg-orange-400", label: "Interrupted",  pulse: false },
  error:        { dot: "bg-red-500",    label: "Error",        pulse: false },
};

const LIVE_STRIP_COPY: Record<LiveState, { title: string; body: string }> = {
  idle: {
    title: "Ready",
    body: "Click Start session in the header, then speak or type a math problem.",
  },
  connecting: {
    title: "Connecting to your tutor…",
    body: "Setting up a live audio channel with Faheem.",
  },
  connected: {
    title: "Live",
    body: "Faheem is ready — speak, type, or snap a math problem.",
  },
  thinking: {
    title: "Thinking through your steps…",
    body: "Faheem is working out the next step in the solution.",
  },
  seeing: {
    title: "Seeing your image…",
    body: "Faheem is reading the problem from your photo.",
  },
  listening: {
    title: "Listening",
    body: "Speak naturally — you can cut in at any time.",
  },
  speaking: {
    title: "Explaining the next step…",
    body: "Listen for the explanation, or interrupt with a follow-up question.",
  },
  interrupted: {
    title: "Interrupted",
    body: "You cut in — Faheem stopped speaking and is listening to your new question.",
  },
  error: {
    title: "Connection issue",
    body: "End the session and start again. If this keeps happening, check your network.",
  },
};

// ── Page ────────────────────────────────────────────────────────────────────
export default function SessionPage() {
  const [mode, setMode]               = useState<TutorMode>("explain");
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [text, setText]               = useState("");
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const fileInputRef      = useRef<HTMLInputElement>(null);
  const autoVoiceRef      = useRef(false);   // set true when Start auto-triggers voice
  const partialTranscriptIndexRef = useRef<number | null>(null);

  const {
    status,
    isActive,
    isThinking,
    liveState,
    voiceActive,
    transcript,
    setTranscript,
    startSession,
    stopSession,
    sendText,
    sendTextQuiet,
    sendImage,
    sendImageQuiet,
    startVoice,
    stopVoice,
  } = useSessionSocket();

  const { formatted: timerDisplay } = useSessionTimer(isActive);

  const state   = STATE_CONFIG[liveState];
  const canSend = isActive && (imageFile !== null || text.trim().length > 0);

  // Refs to avoid stale closures in voice transcription callbacks
  const sendTextQuietRef = useRef(sendTextQuiet);
  sendTextQuietRef.current = sendTextQuiet;
  const sendImageQuietRef = useRef(sendImageQuiet);
  sendImageQuietRef.current = sendImageQuiet;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;
  const imageFileRef = useRef(imageFile);
  imageFileRef.current = imageFile;
  const imagePreviewRef = useRef(imagePreview);
  imagePreviewRef.current = imagePreview;

  // ── Voice transcription callbacks ─────────────────────────────────────────

  const onPartialTranscript = useCallback((text: string) => {
    if (!text.trim()) return;

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

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const attachedImage = imageFileRef.current;
    const attachedPreview = imagePreviewRef.current;

    setTranscript((prev) => {
      const entry = {
        role: "student" as const,
        text,
        timestamp: now,
        partial: false,
        ...(attachedImage && attachedPreview ? { imageUrl: attachedPreview } : {}),
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

    // Send final transcript to backend so Gemini responds to it
    if (isActiveRef.current) {
      if (attachedImage) {
        // Send image with voice text as caption
        sendImageQuietRef.current(attachedImage, text, modeRef.current);
        // Clear attached image (don't revoke — it's now in transcript)
        setImageFile(null);
        setImagePreview(null);
      } else {
        sendTextQuietRef.current(text, modeRef.current);
      }
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
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    log.image("Image selected", {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024).toFixed(1)} KB`,
    });
    e.target.value = "";
  }

  function handleImageClear() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  }

  function handleSend() {
    if (!canSend) return;
    if (imageFile) {
      sendImage(imageFile, text.trim(), mode);
      handleImageClear();
      setText("");
    } else {
      sendText(text.trim(), mode);
      setText("");
    }
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
      <header className="flex-none flex items-center gap-4 px-5 h-16 border-b border-slate-800/60 bg-slate-950/95 backdrop-blur z-10">

        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-sm font-bold text-white shadow-sm">
            F
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight text-slate-200">
              Faheem <span className="text-emerald-400">Math</span> <span className="text-slate-400 font-normal">AI Tutor</span>
            </span>
            <span className="text-[11px] text-slate-500 leading-tight">
              Live math tutor
            </span>
          </div>
        </div>

        {/* Mode Tab Bar — centered */}
        <div className="flex-1 flex justify-center">
          <ModeSelector selected={mode} onChange={handleModeChange} />
        </div>

        {/* Session timer + Live state + session controls */}
        <div className="flex items-center gap-3 shrink-0">
          {isActive && (
            <div className="px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 font-mono">
              {timerDisplay}
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${state.dot} ${state.pulse ? "animate-pulse" : ""}`}
            />
            <span className="text-xs text-slate-300 font-medium">{state.label}</span>
          </div>
          <button
            onClick={() => setHelpPanelOpen(true)}
            className="flex-none w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors text-sm"
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
              flex-none px-3.5 h-9 rounded-full text-xs font-semibold whitespace-nowrap
              transition-all duration-150 active:scale-95 border border-transparent
              ${isActive
                ? "bg-red-600/90 hover:bg-red-500 text-white"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {status === "connecting" ? "Connecting…" : isActive ? "End session" : "Start session"}
          </button>
        </div>
      </header>

      {/* ── Main layout: transcript + side panel ───────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-hidden px-4 py-3 lg:px-6 lg:py-4">
        <div className="h-full flex flex-col lg:flex-row gap-4 lg:gap-5">

          {/* Primary: transcript / live tutoring surface */}
          <section className="flex-1 min-h-0 min-w-0">
            <div className="h-full rounded-2xl bg-slate-900/70 border border-slate-800/70 shadow-[0_0_0_1px_rgba(15,23,42,0.9)] overflow-hidden">
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

            {/* Image / attachment card */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800/70 px-4 py-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Problem image
                  </span>
                  <p className="text-xs text-slate-500">
                    {imageFile ? "Attached — sent with your next message" : "Optional — snap or upload homework"}
                  </p>
                </div>
              </div>

              {imagePreview && imageFile ? (
                <div className="mt-2 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Math problem preview"
                    className="h-14 w-14 rounded-lg object-cover border border-slate-700 shrink-0 bg-slate-950"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">
                      {imageFile.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {(imageFile.size / 1024).toFixed(1)} KB · {imageFile.type}
                    </p>
                    <button
                      onClick={handleImageClear}
                      className="mt-1.5 text-[11px] text-slate-400 hover:text-slate-100 underline-offset-2 hover:underline"
                      type="button"
                    >
                      Remove image
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-dashed border-slate-700/80 bg-slate-950/40 px-3 py-2.5 text-xs text-slate-500">
                  <p className="mb-1.5">
                    Snap a photo of your worksheet or upload a screenshot. Use the{" "}
                    <span className="text-slate-200 font-medium">camera button</span> below to attach it.
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Ideal for handwritten algebra, geometry diagrams, or word problems.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* ── Live voice / state strip (pinned above composer) ──────────────── */}
      <div
        className={`
          flex-none flex items-center gap-3 mx-4 mb-1 px-3.5 py-2 rounded-2xl text-xs
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
        <div className="flex items-center gap-1.5">
          <span
            className={`
              w-2 h-2 rounded-full ${state.dot}
              ${state.pulse ? "animate-pulse" : ""}
            `}
          />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
            {LIVE_STRIP_COPY[liveState].title}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-slate-400 truncate">
            {LIVE_STRIP_COPY[liveState].body}
          </p>
        </div>
        {voiceActive && liveState !== "error" && (
          <div className="flex items-end gap-[3px] h-6">
            {[1, 2, 3, 4].map((b) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={b}
                className="w-1 rounded-full bg-emerald-400/80 animate-[bounce_1.1s_ease-in-out_infinite]"
                style={{
                  height: `${6 + b * 4}px`,
                  animationDelay: `${b * 90}ms`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Composer bar (pinned to bottom) ────────────────────────────────── */}
      <div className="flex-none flex items-end gap-2 px-4 py-3 border-t border-slate-800/60 bg-slate-950">

        {/* Attach image */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!isActive}
          title="Snap or upload a math problem"
          className={`
            flex-none w-10 h-10 rounded-xl flex items-center justify-center
            text-base transition-all duration-150
            ${imageFile
              ? "bg-emerald-700 text-white ring-1 ring-emerald-500"
              : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }
            disabled:opacity-30 disabled:cursor-not-allowed
          `}
          type="button"
        >
          📷
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImagePick}
        />

        {/* Voice toggle */}
        <button
          onClick={handleVoiceToggle}
          disabled={!isActive}
          title={voiceActive ? "Stop voice" : "Speak your math problem"}
          className={`
            flex-none w-10 h-10 rounded-xl flex items-center justify-center
            text-base transition-all duration-150
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
              ? "Listening… speak or type your math problem"
              : imageFile
              ? "Ask about the problem in the image… (optional)"
              : isActive
              ? "Type a math problem… (Enter to send)"
              : "Click Start session above, then speak or type a problem"
          }
          dir="auto"
          className="
            flex-1 resize-none rounded-xl bg-slate-800 border border-slate-700
            px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500
            focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600
            disabled:opacity-40 transition-colors leading-relaxed max-h-28 overflow-y-auto
          "
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          title={imageFile ? "Send math problem image" : "Send"}
          className="
            flex-none w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500
            text-white flex items-center justify-center font-bold text-base
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
