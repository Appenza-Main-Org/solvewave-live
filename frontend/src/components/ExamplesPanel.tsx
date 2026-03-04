"use client";

import { motion } from "framer-motion";
import { Lightbulb, BookOpen, Target, ChevronRight } from "lucide-react";
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

  const Icon = mode === "explain" ? BookOpen : mode === "quiz" ? Target : Lightbulb;

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-emerald-400 mb-2">
          <Icon size={16} />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
            {mode} Focus
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {examples.map((example, i) => (
          <motion.button
            key={example}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onExampleClick(example)}
            disabled={disabled}
            className={`
              group flex items-center justify-between px-4 py-3 rounded-xl text-[11px] font-medium text-left
              transition-all duration-200 border
              ${
                disabled
                  ? "bg-slate-900/40 border-white/5 text-slate-600 cursor-not-allowed opacity-50"
                  : "bg-white/[0.03] border-white/10 text-slate-300 hover:bg-emerald-500 hover:border-emerald-400 hover:text-white active:scale-95"
              }
            `}
            type="button"
          >
            <span className="flex-1 pr-2">{example}</span>
            <ChevronRight size={14} className={`transition-transform group-hover:translate-x-1 ${disabled ? "opacity-0" : "opacity-40 group-hover:opacity-100"}`} />
          </motion.button>
        ))}
      </div>

      {disabled && (
        <p className="text-[10px] text-slate-600 mt-2 italic text-center uppercase tracking-widest font-bold">
          Start session to activate
        </p>
      )}
    </div>
  );
}
