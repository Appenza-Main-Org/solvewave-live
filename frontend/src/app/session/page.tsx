"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Camera,
  Send,
  ChevronRight,
  HelpCircle,
  Timer,
  Zap,
  LayoutDashboard,
} from "lucide-react";
import { useSessionSocket, LiveState } from "@/hooks/useSessionSocket";
import { useVoiceTranscription } from "@/hooks/useVoiceTranscription";
import { useSessionTimer } from "@/hooks/useSessionTimer";
import TranscriptPanel from "@/components/TranscriptPanel";
import ModeSelector, { type TutorMode } from "@/components/ModeSelector";
import ExamplesPanel from "@/components/ExamplesPanel";
import HelpPanel from "@/components/HelpPanel";
import SolveWaveLogo from "@/components/SolveWaveLogo";
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

  // ── TTS: Read tutor messages aloud ──────────────────────────────────────────
  const ttsSpeakingRef = useRef(false);  // tracks browser TTS state for echo suppression
  const speakText = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const clean = text
      .replace(/\$\$[\s\S]+?\$\$/g, " math expression ")
      .replace(/\$[^\$\n]+?\$/g, " math expression ")
      .replace(/`[^`]+?`/g, " math expression ")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/[✓⚠📷🎓]/g, "")
      .replace(/\n/g, ". ")
      .trim();
    if (!clean) return;
    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate = 1.05;
    utt.lang = "en-US";
    utt.onstart = () => { ttsSpeakingRef.current = true; };
    utt.onend = () => { ttsSpeakingRef.current = false; };
    utt.onerror = () => { ttsSpeakingRef.current = false; };
    speechSynthesis.speak(utt);
  }, []);

  const {
    status,
    isActive,
    isThinking,
    isSpeaking,
    speakingStartTime,
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

  // ── Echo suppression: cooldown after tutor finishes speaking ────────────
  // Web Speech API picks up tutor audio from the speaker. The isSpeaking flag
  // flips false when Gemini sends "speaking_end", but audio buffers are still
  // draining for 1-3 seconds. This cooldown prevents the echo loop.
  const speakingCooldownRef = useRef(false);
  useEffect(() => {
    if (isSpeaking) {
      speakingCooldownRef.current = true;
    } else {
      // Keep cooldown active for 3s after speaking ends (audio drain time)
      const timer = setTimeout(() => {
        speakingCooldownRef.current = false;
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSpeaking]);

  // Track whether transcription was active before we paused it for echo suppression
  const wasTranscribingRef = useRef(false);

  // ── Voice transcription callbacks ─────────────────────────────────────────

  const onPartialTranscript = useCallback((text: string) => {
    if (!text.trim()) return;

    // Ignore echo: Web Speech API picks up tutor speaker output (Live audio or TTS)
    if (isSpeakingRef.current || speakingCooldownRef.current || ttsSpeakingRef.current) return;

    setTranscript((prev) => {
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      // Find the last entry — if it's a partial student entry, update in-place
      // This is more robust than tracking by index (which goes stale when tutor
      // messages are appended between partials).
      const lastIdx = prev.length - 1;
      if (lastIdx >= 0 && prev[lastIdx].role === "student" && prev[lastIdx].partial) {
        const updated = [...prev];
        updated[lastIdx] = { role: "student", text, timestamp: now, partial: true };
        return updated;
      }

      // Otherwise, add a new partial transcript row
      return [...prev, { role: "student" as const, text, timestamp: now, partial: true }];
    });
  }, [setTranscript]);

  const onFinalTranscript = useCallback((text: string) => {
    if (!text.trim()) return;

    // Ignore echo: Web Speech API picks up tutor speaker output (Live audio or TTS)
    if (isSpeakingRef.current || speakingCooldownRef.current || ttsSpeakingRef.current) return;

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setTranscript((prev) => {
      const entry = { role: "student" as const, text, timestamp: now, partial: false };

      // Find and replace the last partial student entry (if any)
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === "student" && prev[i].partial) {
          const updated = [...prev];
          updated[i] = entry;
          return updated;
        }
        // Don't scan past tutor messages — if we hit one, just append
        if (prev[i].role === "tutor") break;
      }

      return [...prev, entry];
    });

    // Only send to text API when voice is NOT active.
    // When voice IS active, Gemini Live API already handles the response via
    // audio. Sending to text API too creates duplicate responses and echo loops
    // (the text API response appears in transcript, which can trigger further
    // voice interactions). The Live API's audio-only response is sufficient.
    if (isActiveRef.current && !voiceActiveRef.current) {
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
    }
  }, [voiceActive, transcriptionRunning, stopTranscription]);

  // ── Pause transcription while tutor is speaking (anti-echo) ────────────
  // Completely stop Web Speech API during tutor speech to prevent it from
  // picking up the tutor's voice and creating an infinite echo loop.
  // Restart after the cooldown ends (3s after speaking stops).
  useEffect(() => {
    if (isSpeaking && transcriptionRunning) {
      wasTranscribingRef.current = true;
      stopTranscription();
    }
  }, [isSpeaking, transcriptionRunning, stopTranscription]);

  // Restart transcription after speaking + cooldown ends
  useEffect(() => {
    if (!isSpeaking && wasTranscribingRef.current && voiceActive) {
      const timer = setTimeout(() => {
        if (wasTranscribingRef.current && voiceActive) {
          wasTranscribingRef.current = false;
          if (transcriptionSupported) {
            startTranscription();
          }
        }
      }, 3200); // slightly longer than 3s cooldown to ensure clean restart
      return () => clearTimeout(timer);
    }
  }, [isSpeaking, voiceActive, transcriptionSupported, startTranscription]);

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
      // Cancel any pending TTS and stop voice
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      ttsSpeakingRef.current = false;
      stopVoice();
      if (transcriptionRunning) {
        stopTranscription();
      }
    } else {
      log.voice("User started voice");
      // Cancel any playing TTS before starting mic (prevents echo)
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      ttsSpeakingRef.current = false;
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
      case "idle": return "#64748B";
      case "connecting": return "#FACC15";
      case "thinking": return "#38BDF8";
      case "seeing": return "#A855F7";
      case "listening": return "#F43F5E";
      case "speaking": return "#10B981";
      case "interrupted": return "#F97316";
      case "error": return "#EF4444";
      default: return "#10B981";
    }
  }, [liveState]);

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground overflow-hidden font-sans relative">
      {/* ── Background Logic Grid ── */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]" 
           style={{ backgroundImage: `radial-gradient(${liveStateColor} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />

      {/* ── Background Glow ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div 
          animate={{
            backgroundColor: liveStateColor,
            opacity: [0.03, 0.06, 0.03],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full blur-[160px]" 
        />
      </div>

      {/* ── Modern Header ────────────────────────────────────────────────────────── */}
      <header className="flex-none h-16 border-b border-white/5 bg-obsidian-950/40 backdrop-blur-2xl z-20 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-2xl bg-sw-emerald/10 border border-sw-emerald/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-transform hover:scale-105">
            <SolveWaveLogo size={28} />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold tracking-[0.1em] uppercase text-obsidian-100">
              Solve<span className="text-sw-emerald">Wave</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full" 
                style={{ backgroundColor: liveStateColor }}
              />
              <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-obsidian-500">{state.label}</span>
            </div>
          </div>
        </div>

        <div className="hidden md:block">
          <ModeSelector selected={mode} onChange={handleModeChange} />
        </div>

        <div className="flex items-center gap-3">
          {isActive && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-obsidian-900 border border-obsidian-800">
              <Timer size={14} className="text-sw-emerald" />
              <span className="text-xs font-mono font-bold text-obsidian-200">{timerDisplay}</span>
            </div>
          )}
          
          <button
            onClick={() => setHelpPanelOpen(true)}
            className="p-2.5 rounded-xl hover:bg-white/5 text-obsidian-400 transition-all hover:text-white"
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
              px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95
              ${isActive 
                ? "bg-sw-rose/10 text-sw-rose border border-sw-rose/20 hover:bg-sw-rose/20" 
                : "bg-sw-emerald text-white shadow-2xl shadow-sw-emerald/20 hover:brightness-110"}
              disabled:opacity-50
            `}
          >
            {status === "connecting" ? "..." : isActive ? "End Session" : "Start Session"}
          </button>
        </div>
      </header>

      {/* ── Main Layout ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 relative flex flex-col lg:flex-row overflow-hidden z-10">
        
        {/* Left: Mode Selector (Mobile Only) */}
        <div className="md:hidden flex-none p-4 border-b border-white/5 bg-obsidian-950/20">
          <div className="flex justify-center">
            <ModeSelector selected={mode} onChange={handleModeChange} />
          </div>
        </div>

        {/* Center: Interaction Space */}
        <section className="flex-1 flex flex-col min-w-0 min-h-0 relative">
          
          {/* Ambient State Visualization - Minimal strip to maximize transcript space */}
          <div className="flex-none h-12 flex items-center justify-center gap-3 relative z-20 px-4">
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-sw-emerald/5 to-transparent opacity-20" />
            <div className="w-8 h-8 overflow-hidden rounded-full flex items-center justify-center shrink-0"
                 style={{ backgroundColor: liveStateColor, boxShadow: `0 0 20px ${liveStateColor}33` }}>
              <span className="text-sm filter drop-shadow-lg">
                {liveState === "idle" && "•"}
                {liveState === "connecting" && "⌛"}
                {liveState === "connected" && "✨"}
                {liveState === "thinking" && "🧠"}
                {liveState === "seeing" && "📷"}
                {liveState === "listening" && "👂"}
                {liveState === "speaking" && "💬"}
                {liveState === "interrupted" && "✋"}
                {liveState === "error" && "⚠️"}
              </span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={liveState}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 5 }}
                className="flex items-center gap-2 relative z-10"
              >
                <span className="text-[9px] uppercase tracking-[0.3em] font-black text-sw-emerald/60">
                  {LIVE_STRIP_COPY[liveState].title}
                </span>
                <span className="text-[9px] text-obsidian-600">—</span>
                <p className="text-xs text-obsidian-400 font-medium leading-tight">
                  {LIVE_STRIP_COPY[liveState].body}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Transcript Canvas - Full-width maximized area */}
          <div className="flex-1 min-h-0 px-2 sm:px-3 lg:px-4 pb-2 relative z-10">
            <div className="h-full rounded-3xl bg-obsidian-900/60 border border-white/[0.05] backdrop-blur-md overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.5)] relative group/canvas">
               <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
               <TranscriptPanel
                entries={transcript}
                isThinking={isThinking && isActive}
                isSpeaking={isSpeaking}
                speakingStartTime={speakingStartTime}
                onSpeak={speakText}
              />
            </div>
          </div>
        </section>

        {/* Right: Tools & Context (Desktop Only) - Narrow to maximize transcript */}
        <aside className="hidden xl:flex w-[280px] flex-none flex-col gap-6 p-6 border-l border-white/5 bg-obsidian-950/40 backdrop-blur-md">
          <div className="space-y-10">
            <section>
              <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-obsidian-500 mb-6 flex items-center gap-3">
                <LayoutDashboard size={12} className="text-sw-emerald" />
                Study Curriculum
              </h3>
              <ExamplesPanel
                mode={mode}
                onExampleClick={handleExampleClick}
                disabled={!isActive}
              />
            </section>
            
            <section className="p-6 rounded-[2rem] bg-sw-emerald/5 border border-sw-emerald/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap size={40} className="text-sw-emerald" />
              </div>
              <div className="flex items-center gap-3 text-sw-emerald mb-3">
                <Zap size={16} fill="currentColor" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Quick Tip</span>
              </div>
              <p className="text-[12px] text-obsidian-400 leading-relaxed font-medium">
                SolveWave is naturally interruptible. Just start speaking whenever you have a question or need clarification on a step.
              </p>
            </section>
          </div>
        </aside>
      </main>

      {/* ── Floating Composer — docked to bottom ───────────────────────────────── */}
      <footer className="flex-none z-20 pb-[env(safe-area-inset-bottom,0px)] bg-background/80 backdrop-blur-xl border-t border-white/[0.03]">
        <div className="max-w-4xl mx-auto relative px-3 sm:px-4 py-2 sm:py-3">
          <div className="relative flex items-end gap-3 p-3 rounded-[2.5rem] bg-obsidian-900/60 border border-white/5 backdrop-blur-3xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] focus-within:border-sw-emerald/30 transition-all duration-500">
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 pb-1 px-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!isActive}
                className="p-3 rounded-2xl bg-white/5 text-obsidian-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-20 shadow-sm"
              >
                <Camera size={20} />
              </button>

              {/* Language indicator */}
              {voiceActive && (
                <span
                  title="English"
                  className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider min-w-[28px] text-center select-none bg-white/5 text-obsidian-500 border border-white/5"
                >
                  EN
                </span>
              )}

              <button
                onClick={handleVoiceToggle}
                disabled={!isActive}
                className={`
                  p-3 rounded-2xl transition-all duration-500 disabled:opacity-20 shadow-lg
                  ${voiceActive
                    ? "bg-sw-rose text-white shadow-sw-rose/20 ring-4 ring-sw-rose/20"
                    : "bg-white/5 text-obsidian-400 hover:text-white hover:bg-white/10"}
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
                voiceActive ? "Listening..." : isActive ? "Ask anything about math..." : "Start a session to begin"
              }
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-4 px-2 resize-none max-h-40 text-obsidian-50 placeholder-obsidian-600 font-medium leading-relaxed"
            />

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="p-3.5 rounded-2xl bg-sw-emerald text-white shadow-xl shadow-sw-emerald/20 hover:brightness-110 transition-all disabled:opacity-10 disabled:grayscale active:scale-90 mb-1"
            >
              <Send size={20} strokeWidth={2.5} />
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
