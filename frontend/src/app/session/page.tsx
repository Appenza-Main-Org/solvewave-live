"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AmbientOrb from "@/components/AmbientOrb";
import { 
  Mic, 
  MicOff, 
  Camera, 
  Send, 
  ChevronRight, 
  HelpCircle, 
  Timer,
  Zap
} from "lucide-react";
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
      // Feedback animation for upload
      const feedback = document.createElement('div');
      feedback.className = 'fixed inset-0 pointer-events-none z-[100] bg-emerald-500/10 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-500';
      feedback.innerHTML = '<div class="p-6 rounded-3xl bg-slate-900 border border-emerald-500/30 shadow-2xl scale-in-center animate-out fade-out fill-mode-forwards delay-700">📷 Image Sent</div>';
      document.body.appendChild(feedback);
      setTimeout(() => feedback.remove(), 1200);
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

  const liveStateColor = useMemo(() => {
    switch (liveState) {
      case "idle": return "#64748b";
      case "connecting": return "#facc15";
      case "thinking": return "#38bdf8";
      case "seeing": return "#a78bfa";
      case "listening": return "#fb7185";
      case "speaking": return "#10b981";
      case "interrupted": return "#fb923c";
      case "error": return "#ef4444";
      default: return "#10b981";
    }
  }, [liveState]);

  return (
    <div className="flex flex-col h-dvh bg-slate-950 text-slate-100 overflow-hidden font-sans relative">
      {/* ── Background Glow ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div 
          animate={{
            backgroundColor: liveStateColor,
            opacity: [0.05, 0.08, 0.05],
          }}
          transition={{ duration: 1, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[120px]" 
        />
      </div>

      {/* ── Modern Header ────────────────────────────────────────────────────────── */}
      <header className="flex-none h-16 border-b border-white/5 bg-slate-950/50 backdrop-blur-xl z-20 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <FaheemLogo size={24} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">
              Faheem <span className="text-emerald-400">Math</span>
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${state.dot} ${state.pulse ? "animate-pulse" : ""}`} />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{state.label}</span>
            </div>
          </div>
        </div>

        <div className="hidden md:block">
          <ModeSelector selected={mode} onChange={handleModeChange} />
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {isActive && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Timer size={14} className="text-slate-400" />
              <span className="text-xs font-mono text-slate-300">{timerDisplay}</span>
            </div>
          )}
          
          <button
            onClick={() => setHelpPanelOpen(true)}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 transition-colors"
          >
            <HelpCircle size={20} />
          </button>

          <button
            onClick={() => {
              if (isActive) {
                stopSession();
              } else {
                autoVoiceRef.current = true;
                startSession();
              }
            }}
            disabled={status === "connecting"}
            className={`
              px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95
              ${isActive 
                ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20" 
                : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400"}
              disabled:opacity-50
            `}
          >
            {status === "connecting" ? "Connecting..." : isActive ? "End Session" : "Start Session"}
          </button>
        </div>
      </header>

      {/* ── Main Layout ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 relative flex flex-col lg:flex-row overflow-hidden z-10">
        
        {/* Left: Mode Selector (Mobile Only) */}
        <div className="md:hidden flex-none p-3 border-b border-white/5">
          <ModeSelector selected={mode} onChange={handleModeChange} />
        </div>

        {/* Center: Interaction Space */}
        <section className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-transparent to-slate-900/20">
          
          {/* Ambient State Visualization */}
          <div className="flex-none pt-4 pb-2">
            <AmbientOrb state={liveState} />
            <div className="text-center mt-2 px-6">
              <motion.p 
                key={liveState}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-slate-400 font-medium"
              >
                {LIVE_STRIP_COPY[liveState].body}
              </motion.p>
            </div>
          </div>

          {/* Transcript Canvas */}
          <div className="flex-1 min-h-0 px-4 sm:px-6 pb-4">
            <div className="h-full rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-sm overflow-hidden shadow-2xl relative">
               <TranscriptPanel
                entries={transcript}
                isThinking={isThinking && isActive}
              />
            </div>
          </div>
        </section>

        {/* Right: Tools & Context (Desktop Only) */}
        <aside className="hidden xl:flex w-80 flex-none flex-col gap-4 p-6 border-l border-white/5 bg-slate-950/30">
          <div className="space-y-6">
            <section>
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500 mb-4">Study Tools</h3>
              <ExamplesPanel
                mode={mode}
                onExampleClick={handleExampleClick}
                disabled={!isActive}
              />
            </section>
            
            <section className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <Zap size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">Quick Tip</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                You can interrupt Faheem at any time just by speaking. He'll stop and listen to your follow-up immediately.
              </p>
            </section>
          </div>
        </aside>
      </main>

      {/* ── Floating Composer ────────────────────────────────────────────────────── */}
      <footer className="flex-none p-4 sm:p-6 z-20">
        <div className="max-w-4xl mx-auto relative">
          <div className="absolute inset-0 bg-emerald-500/5 blur-3xl rounded-full opacity-50 pointer-events-none" />
          
          <div className="relative flex items-end gap-2 p-2 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-2xl shadow-2xl focus-within:border-emerald-500/50 transition-all">
            
            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 pb-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!isActive}
                className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20"
              >
                <Camera size={20} />
              </button>
              
              <button
                onClick={handleVoiceToggle}
                disabled={!isActive}
                className={`
                  p-2.5 rounded-xl transition-all disabled:opacity-20
                  ${voiceActive 
                    ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" 
                    : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"}
                `}
              >
                {voiceActive ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImagePick}
            />

            {/* Input Field */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isActive}
              rows={1}
              placeholder={
                voiceActive ? "Listening..." : isActive ? "Ask a math question..." : "Start session to chat"
              }
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 px-2 resize-none max-h-32 text-slate-100 placeholder-slate-500"
            />

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all disabled:opacity-20 disabled:grayscale active:scale-95 mb-0.5"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </footer>

      {/* ── Modals ────────────────────────────────────────────────────────────────── */}
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
