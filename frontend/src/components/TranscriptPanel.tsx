"use client";

import { useEffect, useRef } from "react";
import katex from "katex";

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
        <p key={idx} className="flex gap-2">
          <span className="text-xs font-semibold text-emerald-300 mt-[1px] shrink-0">
            {stepMatch[1]}.
          </span>
          <span
            className="flex-1"
            dangerouslySetInnerHTML={{
              __html: processInlineContent(stepMatch[2]),
            }}
          />
        </p>
      );
    }

    // Bullet list: "* ..." or "- ..."
    const bulletMatch = trimmed.match(/^[\*\-]\s+(.*)$/);
    if (bulletMatch) {
      return (
        <p key={idx} className="flex gap-2 ml-1">
          <span className="text-emerald-400 mt-[1px] shrink-0">·</span>
          <span
            className="flex-1"
            dangerouslySetInnerHTML={{
              __html: processInlineContent(bulletMatch[1]),
            }}
          />
        </p>
      );
    }

    // Regular line
    return (
      <p
        key={idx}
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

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (entries.length === 0 && !isThinking) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 sm:gap-4 text-center px-4 sm:px-6">
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-600 flex items-center justify-center text-2xl sm:text-3xl shadow-lg">
          🎓
        </div>
        <div>
          <p className="text-sm sm:text-base font-semibold text-slate-300">
            Your math tutor is ready
          </p>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tap <span className="text-emerald-400 font-semibold">Start</span> then speak or type a problem
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mt-1 sm:mt-2 text-[11px] sm:text-xs text-slate-600 max-w-xl">
          <span className="px-2 sm:px-2.5 py-1 rounded-full bg-slate-800/80">
            Solve 3x + 5 = 14
          </span>
          <span className="px-2 sm:px-2.5 py-1 rounded-full bg-slate-800/80">
            Explain derivatives
          </span>
          <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-slate-800/80">
            Check my fraction steps
          </span>
          <span className="px-2 sm:px-2.5 py-1 rounded-full bg-slate-800/80">
            📷 Snap homework
          </span>
        </div>
      </div>
    );
  }

  // ── Conversation ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-3 space-y-3 sm:space-y-4">

      {entries.map((e, i) => {
        const isRecap =
          e.role === "tutor" && e.text.trim().startsWith("✓");
        const isPartial = e.partial === true;

        return (
          <div
            key={i}
            className={`flex gap-2 sm:gap-3 ${e.role === "student" ? "flex-row-reverse" : "flex-row"}`}
          >
            {/* Avatar */}
            <div
              className={`
                flex-none w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center
                text-[10px] sm:text-xs font-bold shrink-0 mt-0.5
                ${e.role === "tutor"
                  ? "bg-emerald-700 text-emerald-100"
                  : "bg-slate-600 text-slate-200"
                }
              `}
            >
              {e.role === "tutor" ? "F" : "U"}
            </div>

            {/* Label + bubble + timestamp */}
            <div
              className={`flex flex-col gap-0.5 sm:gap-1 max-w-[85%] sm:max-w-[76%] ${
                e.role === "student" ? "items-end" : "items-start"
              }`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[10px] sm:text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                  {e.role === "tutor" ? "Faheem" : "You"}
                </span>
                {isRecap && (
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.14em] text-emerald-300 bg-emerald-900/40 border border-emerald-500/40 rounded-full px-1.5 sm:px-2 py-0.5">
                    Recap
                  </span>
                )}
                {isPartial && (
                  <span className="text-[10px] text-slate-500 italic">
                    listening…
                  </span>
                )}
              </div>
              <div
                className={`
                  px-3 sm:px-4 py-2 sm:py-3 rounded-2xl text-[13px] sm:text-sm leading-relaxed shadow-sm
                  ${
                    isPartial
                      ? "bg-emerald-700/10 text-emerald-100/70 italic rounded-tr-lg border border-emerald-700/30"
                      : isRecap
                      ? "bg-slate-900 text-slate-100 border border-emerald-600/70"
                      : e.role === "tutor"
                      ? "bg-slate-800/95 text-slate-100 rounded-tl-lg border border-slate-700/60"
                      : "bg-emerald-700/15 text-emerald-50 rounded-tr-lg border border-emerald-700/40"
                  }
                `}
              >
                {e.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.imageUrl}
                    alt="Shared image"
                    className="rounded-xl max-h-36 sm:max-h-48 mb-2 sm:mb-2.5 w-full object-contain bg-slate-900"
                  />
                )}
                <div className="space-y-1 sm:space-y-1.5 whitespace-pre-wrap break-words">
                  {renderTextLines(e.text)}
                </div>
              </div>
              <span className="text-[10px] sm:text-xs text-slate-600 px-1">{e.timestamp}</span>
            </div>
          </div>
        );
      })}

      {/* ── Thinking indicator ─────────────────────────────────────────────── */}
      {isThinking && (
        <div className="flex gap-2 sm:gap-3">
          <div className="flex-none w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-700 text-emerald-100 flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0 mt-0.5">
            F
          </div>
          <div className="px-3 sm:px-4 py-2 sm:py-3 rounded-2xl rounded-tl-sm bg-slate-800/90 border border-slate-700/40">
            <div className="flex gap-1.5 items-center h-4">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 160}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
