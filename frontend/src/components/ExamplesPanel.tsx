"use client";

import type { TutorMode } from "./ModeSelector";

interface ExamplesPanelProps {
  mode: TutorMode;
  onExampleClick: (exampleText: string) => void;
  disabled?: boolean;
}

const EXAMPLES: Record<TutorMode, { description: string; examples: string[] }> = {
  explain: {
    description: "Get step-by-step explanations with worked examples.",
    examples: [
      "Explain how to solve: 2x + 5 = 17",
      "Explain: 3/4 + 1/8",
      "Explain slope in y = mx + b",
      "Explain what a derivative means",
      "Explain the Pythagorean theorem",
    ],
  },
  quiz: {
    description: "Test your understanding with targeted questions and feedback.",
    examples: [
      "Quiz me on fractions (easy)",
      "Give me 5 algebra questions",
      "Quiz me on angles",
      "Test me on quadratic equations",
      "Ask me about exponents",
    ],
  },
  homework: {
    description: "Work through actual problem sets with full solution walkthroughs.",
    examples: [
      "Help me solve this step by step",
      "Check my answer and explain mistakes",
      "Explain the solution strategy",
      "Walk through this homework sheet",
      "Summarize what we covered",
    ],
  },
};

export default function ExamplesPanel({
  mode,
  onExampleClick,
  disabled = false,
}: ExamplesPanelProps) {
  const { description, examples } = EXAMPLES[mode];

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800/70 px-4 py-3">
      <div className="mb-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          Try asking in {mode === "explain" ? "Explain" : mode === "quiz" ? "Quiz" : "Homework"} mode
        </span>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {examples.map((example) => (
          <button
            key={example}
            onClick={() => onExampleClick(example)}
            disabled={disabled}
            className={`
              px-2.5 py-1.5 rounded-full text-[11px] leading-tight text-left
              transition-all duration-150
              ${
                disabled
                  ? "bg-slate-800/50 text-slate-600 cursor-not-allowed"
                  : "bg-slate-800/90 text-slate-200 hover:bg-emerald-700/80 hover:text-emerald-50 active:scale-95"
              }
            `}
            type="button"
          >
            {example}
          </button>
        ))}
      </div>

      {disabled && (
        <p className="text-[11px] text-slate-600 mt-2 italic">
          Start a session to try these examples
        </p>
      )}
    </div>
  );
}
