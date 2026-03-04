"use client";

import { useEffect, useRef } from "react";
import katex from "katex";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, User, Sparkles, ImageIcon, CheckCircle2, MoreHorizontal } from "lucide-react";

export interface TranscriptEntry {
  role: "tutor" | "student";
  text: string;
  timestamp: string;
  imageUrl?: string;
  partial?: boolean; // true = still being transcribed (Web Speech API interim result)
}

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  isThinking?: boolean;
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

  // Bold: **text**
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
        <div key={idx} className="flex gap-3 group/step py-1">
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 shrink-0 mt-0.5 group-hover/step:bg-emerald-500 group-hover/step:text-white transition-colors">
            {stepMatch[1]}
          </span>
          <span
            className="flex-1 pt-0.5"
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
        <div key={idx} className="flex gap-3 ml-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/40 mt-2 shrink-0" />
          <span
            className="flex-1"
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
        className="leading-relaxed"
        dangerouslySetInnerHTML={{ __html: processInlineContent(line) }}
      />
    );
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TranscriptPanel({
  entries,
  isThinking = false,
}: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, isThinking]);

  if (entries.length === 0 && !isThinking) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center bg-slate-900/20 backdrop-blur-sm rounded-3xl border border-white/5 m-4">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-4xl mb-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10"
        >
          🎓
        </motion.div>
        <h2 className="text-xl font-bold text-white mb-2">Your Math Tutor is Ready</h2>
        <p className="text-slate-400 max-w-sm mb-8">
          Start a session to solve equations, explain concepts, or check your homework in real-time.
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
    <div className="h-full overflow-y-auto overflow-x-hidden scroll-smooth custom-scrollbar px-4 py-6 space-y-8">
      <AnimatePresence initial={false}>
        {entries.map((e, i) => {
          const isRecap = e.role === "tutor" && e.text.trim().startsWith("✓");
          const isPartial = e.partial === true;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={`flex w-full group ${e.role === "student" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex max-w-[90%] sm:max-w-[80%] gap-3 ${e.role === "student" ? "flex-row-reverse" : "flex-row"}`}>
                
                {/* Avatar Column */}
                <div className="flex-none flex flex-col items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-sm transition-transform group-hover:scale-110 ${
                    e.role === "tutor" 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : "bg-slate-800 border-white/10 text-slate-400"
                  }`}>
                    {e.role === "tutor" ? <Sparkles size={16} /> : <User size={16} />}
                  </div>
                  <div className="w-[2px] flex-1 bg-gradient-to-b from-white/5 to-transparent rounded-full" />
                </div>

                {/* Content Column */}
                <div className={`flex flex-col gap-2 ${e.role === "student" ? "items-end text-right" : "items-start text-left"}`}>
                  
                  {/* Metadata */}
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {e.role === "tutor" ? "Faheem" : "You"}
                    </span>
                    {isRecap && (
                      <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <CheckCircle2 size={10} /> Recap
                      </span>
                    )}
                    <span className="text-[10px] text-slate-600 font-mono">{e.timestamp}</span>
                  </div>

                  {/* Message Bubble/Canvas */}
                  <div className={`
                    relative px-5 py-4 rounded-3xl text-sm leading-relaxed transition-all
                    ${isPartial 
                      ? "bg-emerald-500/5 text-emerald-100/60 italic border border-emerald-500/10 rounded-tr-lg" 
                      : isRecap
                      ? "bg-slate-900 border-2 border-emerald-500/30 text-slate-100 shadow-xl shadow-emerald-500/5"
                      : e.role === "tutor"
                      ? "bg-white/[0.03] border border-white/10 text-slate-100 rounded-tl-lg backdrop-blur-sm"
                      : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/10 rounded-tr-lg"
                    }
                  `}>
                    {e.imageUrl && (
                      <div className="relative mb-4 group/img">
                        <img
                          src={e.imageUrl}
                          alt="Math Problem"
                          className="rounded-2xl max-h-64 w-full object-contain bg-black/40 border border-white/10 shadow-inner"
                        />
                        <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white/80 opacity-0 group-hover/img:opacity-100 transition-opacity">
                          <ImageIcon size={14} />
                        </div>
                      </div>
                    )}
                    
                    <div className={`space-y-2 whitespace-pre-wrap break-words ${e.role === "student" ? "text-white" : "text-slate-100"}`}>
                      {renderTextLines(e.text)}
                    </div>

                    {isPartial && (
                      <motion.div 
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute -bottom-5 right-0 text-[10px] text-emerald-500/60 font-medium"
                      >
                        Processing audio...
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
