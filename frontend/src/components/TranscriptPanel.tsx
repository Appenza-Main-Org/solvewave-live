"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import katex from "katex";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, User, Sparkles, ImageIcon, CheckCircle2, MoreHorizontal, Volume2 } from "lucide-react";

// ── RTL detection ─────────────────────────────────────────────────────────────
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
/** Returns true if text is primarily Arabic (> 30% Arabic chars among letters) */
function isArabicText(text: string): boolean {
  if (!ARABIC_RE.test(text)) return false;
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (letters.length === 0) return false;
  const arabicCount = (letters.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  return arabicCount / letters.length > 0.3;
}

export interface TranscriptEntry {
  role: "tutor" | "student";
  text: string;
  timestamp: string;
  imageUrl?: string;
  partial?: boolean; // true = still being transcribed (Web Speech API interim result)
  streaming?: boolean; // true = tutor response still streaming from Gemini Live
}

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  isThinking?: boolean;
  isSpeaking?: boolean;
  speakingStartTime?: number; // Date.now() when speaking started
  onSpeak?: (text: string) => void;
  onInterrupt?: () => void; // Called when user taps on speaking message to interrupt
}

// ── Inline content processor (math + bold) ───────────────────────────────────

function processInlineContent(text: string): string {
  // Escape HTML first (we use dangerouslySetInnerHTML)
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Display math: $$...$$
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return `$$${math}$$`;
    }
  });

  // Inline math: $...$
  html = html.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `$${math}$`;
    }
  });

  // Backtick math: `...` — render as inline KaTeX if it looks like math,
  // otherwise render as code. Gemini often uses backticks for equations.
  html = html.replace(/`([^`]+?)`/g, (_, content: string) => {
    const trimmed = content.trim();
    // Heuristic: treat as math if it contains math-like characters
    const looksLikeMath = /[=+\-*/^√∫∑πΔ≤≥≠×÷]/.test(trimmed) ||
      /\d+\s*[a-zA-Z]/.test(trimmed) ||   // e.g. "2x", "3n"
      /[a-zA-Z]\s*[=<>]/.test(trimmed) ||  // e.g. "x = 5"
      /\\(?:frac|sqrt|sum|int|lim)/.test(trimmed); // LaTeX commands
    if (looksLikeMath) {
      try {
        return katex.renderToString(trimmed, {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return `<code class="px-2 py-0.5 rounded bg-white/10 text-sw-emerald font-mono text-[0.9em]">${content}</code>`;
      }
    }
    return `<code class="px-2 py-0.5 rounded bg-white/10 text-sw-emerald font-mono text-[0.9em]">${content}</code>`;
  });

  // Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-white">$1</strong>');
  html = html.replace(
    /\*\*(.+?)\*\*/g,
    '<strong class="font-semibold text-slate-50">$1</strong>'
  );

  return html;
}

// ── Line renderer ────────────────────────────────────────────────────────────

function renderTextLines(text: string) {
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    const trimmed = line.trimStart();

    // Numbered list: "1. ..." or "1) ..."
    const stepMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)$/);
    if (stepMatch) {
      return (
        <div key={idx} className="flex gap-4 group/step py-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-sw-emerald/20 text-sw-emerald text-[12px] font-black border border-sw-emerald/30 shrink-0 mt-0.5 group-hover/step:bg-sw-emerald group-hover/step:text-white transition-all duration-300 shadow-lg shadow-sw-emerald/10">
            {stepMatch[1]}
          </span>
          <span
            className="flex-1 pt-1 text-[14px] sm:text-[15px] lg:text-[16px] font-semibold tracking-tight leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: processInlineContent(stepMatch[2]),
            }}
          />
        </div>
      );
    }

    // Bullet list: "* ..." or "- ..."
    const bulletMatch = trimmed.match(/^[\*\-]\s+(.*)$/);
    if (bulletMatch) {
      return (
        <div key={idx} className="flex gap-4 ml-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-sw-emerald/60 mt-3 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          <span
            className="flex-1 text-[14px] sm:text-[15px] lg:text-[16px] font-medium tracking-tight leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: processInlineContent(bulletMatch[1]),
            }}
          />
        </div>
      );
    }

    // Regular line
    return (
      <p
        key={idx}
        className="leading-[1.8] text-[14px] sm:text-[15px] lg:text-[16px] font-medium tracking-tight"
        dangerouslySetInnerHTML={{ __html: processInlineContent(line) }}
      />
    );
  });
}

// ── Word-level highlighted renderer (for streaming/speaking entries) ──────────

const WORDS_PER_SECOND = 2.8; // average speaking rate

function StreamingTextRenderer({
  text,
  speakingStartTime,
  isActive,
}: {
  text: string;
  speakingStartTime: number;
  isActive: boolean;
}) {
  const [tick, setTick] = useState(0);

  // Update every 200ms for smooth word-by-word progression
  useEffect(() => {
    if (!isActive || !speakingStartTime) return;
    const interval = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(interval);
  }, [isActive, speakingStartTime]);

  // Split text into words for highlighting
  const words = useMemo(() => text.split(/(\s+)/), [text]);

  // Calculate which word index should be highlighted based on elapsed time
  const elapsedSec = isActive && speakingStartTime > 0
    ? (Date.now() - speakingStartTime) / 1000
    : -1;
  // Count only actual words (not whitespace) for the word index
  const wordOnlyIndices: number[] = [];
  words.forEach((w, i) => {
    if (w.trim()) wordOnlyIndices.push(i);
  });
  const currentWordPosition = elapsedSec >= 0
    ? Math.floor(elapsedSec * WORDS_PER_SECOND)
    : -1;

  // Map word position to the index in the split array
  const highlightIdx = currentWordPosition >= 0 && currentWordPosition < wordOnlyIndices.length
    ? wordOnlyIndices[currentWordPosition]
    : -1;

  // Highlight window: current word ± 1 for a smooth "phrase" highlight
  const highlightStart = highlightIdx >= 0 ? Math.max(0, wordOnlyIndices.indexOf(highlightIdx) - 1) : -1;
  const highlightEnd = highlightIdx >= 0 ? Math.min(wordOnlyIndices.length - 1, wordOnlyIndices.indexOf(highlightIdx) + 1) : -1;

  const highlightStartIdx = highlightStart >= 0 ? wordOnlyIndices[highlightStart] : -1;
  const highlightEndIdx = highlightEnd >= 0 ? wordOnlyIndices[highlightEnd] : -1;

  return (
    <div className="space-y-4">
      <p className="leading-[1.8] text-[14px] sm:text-[15px] lg:text-[16px] font-medium tracking-tight">
        {words.map((word, i) => {
          if (!word) return null;
          const isWhitespace = !word.trim();
          if (isWhitespace) return <span key={i}>{word}</span>;

          const isHighlighted = isActive && i >= highlightStartIdx && i <= highlightEndIdx;
          // Words before the current position are fully visible (already spoken)
          const isSpoken = isActive && currentWordPosition >= 0 && wordOnlyIndices.indexOf(i) < currentWordPosition;
          // Words after the current position are slightly dimmed (not yet spoken)
          const isUpcoming = isActive && currentWordPosition >= 0 && wordOnlyIndices.indexOf(i) > currentWordPosition + 1;

          return (
            <span
              key={i}
              className={`transition-all duration-200 ${
                isHighlighted
                  ? "text-white bg-sw-emerald/20 rounded px-0.5 py-0.5 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  : isSpoken || !isActive
                  ? "text-obsidian-100"
                  : isUpcoming
                  ? "text-obsidian-400"
                  : "text-obsidian-200"
              }`}
            >
              {word}
            </span>
          );
        })}
        {/* Streaming cursor */}
        {isActive && (
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="inline-block w-0.5 h-4 bg-sw-emerald ml-1 align-middle rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"
          />
        )}
      </p>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TranscriptPanel({
  entries,
  isThinking = false,
  isSpeaking = false,
  speakingStartTime = 0,
  onSpeak,
  onInterrupt,
}: TranscriptPanelProps) {
  // Find the index of the last streaming/speaking tutor message
  const lastTutorIdx = isSpeaking
    ? entries.reduce((acc, e, i) => (e.role === "tutor" ? i : acc), -1)
    : -1;
  const bottomRef = useRef<HTMLDivElement>(null);
  const speakingRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, isThinking]);

  // Auto-scroll to the currently speaking message during speech
  useEffect(() => {
    if (isSpeaking && speakingRef.current) {
      speakingRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isSpeaking, entries]);

  if (entries.length === 0 && !isThinking) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 text-center bg-slate-900/20 backdrop-blur-sm rounded-2xl border border-white/5 m-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-4xl mb-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10"
        >
          🎓
        </motion.div>
        <h2 className="text-xl font-bold text-white mb-2">Your Live Math Tutor is Ready</h2>
        <p className="text-slate-400 max-w-sm mb-8">
          Speak, type, or snap a problem — get step-by-step solutions in real-time.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
          {[
            "Solve 3x + 5 = 14",
            "Explain derivatives",
            "Check my fraction steps",
            "Snap a problem 📷"
          ].map((text, i) => (
            <div key={i} className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-medium text-slate-300">
              {text}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden scroll-smooth custom-scrollbar px-4 sm:px-6 lg:px-10 pt-10 pb-6 space-y-10">
      <AnimatePresence initial={false}>
        {entries.map((e, i) => {
          const isRecap = e.role === "tutor" && e.text.trim().startsWith("✓");
          const isPartial = e.partial === true;
          const isStreaming = e.streaming === true;
          const isRtl = isArabicText(e.text);
          const isCurrentlySpeaking = i === lastTutorIdx;
          const isActiveStreaming = isCurrentlySpeaking && (isStreaming || isSpeaking);

          return (
            <motion.div
              key={i}
              ref={isCurrentlySpeaking ? speakingRef : undefined}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={`flex w-full group/entry ${e.role === "student" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex gap-8 w-full ${e.role === "student" ? "max-w-[85%] flex-row-reverse" : "max-w-full flex-row"}`}>

                {/* Avatar / Side Indicator */}
                <div className="flex-none flex flex-col items-center">
                  <div className={`w-1 h-full rounded-full transition-colors duration-500 ${
                    isActiveStreaming
                      ? "bg-sw-emerald shadow-[0_0_20px_rgba(16,185,129,0.6)]"
                      : isCurrentlySpeaking
                      ? "bg-sw-emerald shadow-[0_0_20px_rgba(16,185,129,0.6)]"
                      : e.role === "tutor" ? "bg-sw-emerald/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-obsidian-700"
                  }`} />
                </div>

                {/* Content Area */}
                <div className={`flex flex-col gap-4 flex-1 ${e.role === "student" ? "items-end" : "items-start"}`}>

                  {/* Role Label */}
                  <div className="flex items-center gap-4 px-1">
                    <span className={`text-[10px] font-black uppercase tracking-[0.25em] transition-colors duration-300 ${
                      isActiveStreaming || isCurrentlySpeaking ? "text-sw-emerald" : "text-obsidian-500"
                    }`}>
                      {e.role === "tutor" ? "SolveWave" : "Student"}
                    </span>
                    {isActiveStreaming && (
                      <motion.button
                        animate={{ opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        onClick={(ev) => { ev.stopPropagation(); onInterrupt?.(); }}
                        className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-sw-emerald bg-sw-emerald/10 px-3 py-1 rounded-lg border border-sw-emerald/20 shadow-[0_0_10px_rgba(16,185,129,0.15)] hover:bg-orange-500/20 hover:text-orange-400 hover:border-orange-400/30 transition-colors cursor-pointer"
                        title="Tap to interrupt"
                      >
                        <Volume2 size={11} />
                        Speaking — tap to interrupt
                      </motion.button>
                    )}
                    {isRecap && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-sw-emerald bg-sw-emerald/10 px-3 py-1 rounded border border-sw-emerald/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                        Deep Dive Recap
                      </span>
                    )}
                    <span className="text-[10px] text-obsidian-600 font-mono opacity-50 tracking-tighter">{e.timestamp}</span>
                    {e.role === "tutor" && onSpeak && !isPartial && !isStreaming && (
                      <button
                        onClick={() => onSpeak(e.text)}
                        className="p-1 rounded-lg hover:bg-white/10 text-obsidian-600 hover:text-sw-emerald transition-all opacity-0 group-hover/entry:opacity-100"
                        title="Read aloud"
                      >
                        <Volume2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Message Surface */}
                  <div
                    dir={isRtl ? "rtl" : undefined}
                    className={`
                    relative text-obsidian-50 leading-[1.8] w-full transition-all duration-500
                    ${isRtl ? "text-right" : ""}
                    ${e.role === "tutor"
                      ? `text-[14px] sm:text-[15px] lg:text-[16px] font-medium tracking-tight ${
                          isActiveStreaming
                            ? "pl-4 border-l-2 border-sw-emerald/40 bg-sw-emerald/[0.03] rounded-lg py-3"
                            : ""
                        }`
                      : "text-[14px] px-6 py-4 rounded-3xl bg-obsidian-900/80 border border-obsidian-800 shadow-xl"
                    }
                  `}>
                    {e.imageUrl && (
                      <div className="mb-6 rounded-2xl overflow-hidden border border-obsidian-800 shadow-2xl">
                        <img
                          src={e.imageUrl}
                          alt="Input"
                          className="max-h-72 w-full object-contain bg-obsidian-950"
                        />
                      </div>
                    )}

                    {/* Use word-level highlighting for actively streaming tutor messages */}
                    {isActiveStreaming && e.text ? (
                      <StreamingTextRenderer
                        text={e.text}
                        speakingStartTime={speakingStartTime}
                        isActive={true}
                      />
                    ) : (
                      <div className="space-y-4">
                        {e.text ? renderTextLines(e.text) : (
                          isStreaming && (
                            <div className="flex items-center gap-2">
                              <motion.span
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="text-obsidian-400 text-sm"
                              >
                                Preparing response…
                              </motion.span>
                            </div>
                          )
                        )}
                      </div>
                    )}

                    {isPartial && (
                      <motion.div
                        animate={{ opacity: [0.4, 0.8, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="mt-4 text-[11px] text-sw-sky font-medium uppercase tracking-widest"
                      >
                        AI Processing...
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Thinking State */}
        {isThinking && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Sparkles size={16} className="animate-spin-slow" />
            </div>
            <div className="px-5 py-4 rounded-3xl rounded-tl-sm bg-white/[0.03] border border-white/10 flex gap-1.5 items-center">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  className="w-1.5 h-1.5 bg-emerald-400 rounded-full"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
