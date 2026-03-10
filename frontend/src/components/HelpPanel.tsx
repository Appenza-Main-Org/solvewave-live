"use client";

import type { SessionStatus } from "@/hooks/useSessionSocket";

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessionStatus: SessionStatus;
  voiceActive: boolean;
  stubMode?: boolean;
}

export default function HelpPanel({
  isOpen,
  onClose,
  sessionStatus,
  voiceActive,
  stubMode = false,
}: HelpPanelProps) {
  if (!isOpen) return null;

  const wsStatusColor =
    sessionStatus === "connected"
      ? "text-emerald-400"
      : sessionStatus === "connecting"
      ? "text-yellow-400"
      : sessionStatus === "error"
      ? "text-red-400"
      : "text-slate-500";

  const micStatusColor = voiceActive ? "text-emerald-400" : "text-slate-500";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">
            Help & About
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5 space-y-6">
          {/* Session Status */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-3">
              Session Status
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/60">
                <span className="text-sm text-slate-400">WebSocket</span>
                <span className={`text-sm font-medium ${wsStatusColor}`}>
                  {sessionStatus === "idle"
                    ? "Idle"
                    : sessionStatus === "connecting"
                    ? "Connecting…"
                    : sessionStatus === "connected"
                    ? "Connected"
                    : "Error"}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/60">
                <span className="text-sm text-slate-400">Microphone</span>
                <span className={`text-sm font-medium ${micStatusColor}`}>
                  {voiceActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/60">
                <span className="text-sm text-slate-400">Mode</span>
                <span className={`text-sm font-medium ${stubMode ? "text-orange-400" : "text-emerald-400"}`}>
                  {stubMode ? "Demo (Stub)" : "Live (API)"}
                </span>
              </div>
            </div>
          </section>

          {/* How to Use */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-3">
              How to Use SolveWave
            </h3>
            <ol className="space-y-3 text-sm text-slate-300 leading-relaxed">
              <li className="flex gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-emerald-700 text-emerald-100 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Click <strong className="text-slate-100">Start session</strong> in the header to begin
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-emerald-700 text-emerald-100 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Allow microphone access when prompted (voice starts automatically)
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-emerald-700 text-emerald-100 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  <strong className="text-slate-100">Speak</strong> a math problem, <strong className="text-slate-100">type</strong> a question, or <strong className="text-slate-100">upload</strong> a photo (📷 button)
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-emerald-700 text-emerald-100 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                <span>
                  SolveWave responds in real-time with voice + transcript
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-emerald-700 text-emerald-100 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  5
                </span>
                <span>
                  <strong className="text-slate-100">Interrupt</strong> mid-explanation to ask follow-up questions (barge-in)
                </span>
              </li>
            </ol>
          </section>

          {/* Features */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-3">
              Key Features
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span><strong className="text-slate-300">Voice-first:</strong> Real-time audio with full-duplex streaming</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span><strong className="text-slate-300">Barge-in:</strong> Interrupt anytime — tutor stops and listens</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span><strong className="text-slate-300">Vision:</strong> Upload homework photos — instant recognition & solve</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span><strong className="text-slate-300">Three modes:</strong> Explain / Quiz / Homework (switchable mid-session)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span><strong className="text-slate-300">Live transcription:</strong> See your words in real-time (Web Speech API)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400">✓</span>
                <span><strong className="text-slate-300">Session recap:</strong> Summary + duration at the end</span>
              </li>
            </ul>
          </section>

          {/* Tech Stack */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-3">
              Tech Stack
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="px-3 py-2 rounded-lg bg-slate-800/60">
                <p className="text-slate-500">Frontend</p>
                <p className="text-slate-300 font-medium">Next.js 14</p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-slate-800/60">
                <p className="text-slate-500">Backend</p>
                <p className="text-slate-300 font-medium">FastAPI</p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-slate-800/60">
                <p className="text-slate-500">Voice</p>
                <p className="text-slate-300 font-medium">Gemini Live API</p>
              </div>
              <div className="px-3 py-2 rounded-lg bg-slate-800/60">
                <p className="text-slate-500">Deployment</p>
                <p className="text-slate-300 font-medium">Cloud Run</p>
              </div>
            </div>
          </section>

          {/* Demo Mode Notice */}
          {stubMode && (
            <section className="rounded-xl bg-orange-950/30 border border-orange-700/40 px-4 py-3">
              <div className="flex items-start gap-2">
                <span className="text-orange-400 text-lg shrink-0">⚠️</span>
                <div>
                  <h4 className="text-sm font-semibold text-orange-200 mb-1">
                    Demo Mode Active
                  </h4>
                  <p className="text-xs text-orange-300/80 leading-relaxed">
                    You&apos;re running in <strong>stub mode</strong> (canned responses). All features work, but responses are pre-scripted. Set <code className="text-orange-200 bg-orange-950/50 px-1 py-0.5 rounded">GEMINI_API_KEY</code> for live AI responses.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Challenge Info */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-3">
              About This Project
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-3">
              <strong className="text-slate-200">SolveWave</strong> is a live AI math tutor built for the <strong className="text-emerald-400">Google Gemini Live Agent Challenge</strong> (Live Agents track).
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://github.com/[YOUR_REPO]"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-slate-100 transition-colors"
              >
                📦 GitHub
              </a>
              <a
                href="https://geminiliveagentchallenge.devpost.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-slate-100 transition-colors"
              >
                🏆 Challenge
              </a>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
