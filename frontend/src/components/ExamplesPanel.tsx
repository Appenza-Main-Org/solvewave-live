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
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-obsidian-900/40 border border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3 text-faheem-emerald mb-3">
          <Icon size={18} className="opacity-80" />
          <span className="text-[10px] font-black uppercase tracking-[0.25em]">
            {mode} Mode
          </span>
        </div>
        <p className="text-[12px] text-obsidian-400 leading-relaxed font-medium">
          {description}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {examples.map((example, i) => (
          <motion.button
            key={example}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, ease: "easeOut" }}
            onClick={() => onExampleClick(example)}
            disabled={disabled}
            className={`
              group flex items-center justify-between px-5 py-4 rounded-xl text-[12px] font-bold text-left
              transition-all duration-300 border
              ${
                disabled
                  ? "bg-obsidian-950/40 border-white/5 text-obsidian-700 cursor-not-allowed"
                  : "bg-obsidian-900/60 border-white/5 text-obsidian-300 hover:bg-obsidian-800 hover:border-white/10 hover:text-white active:scale-[0.98]"
              }
            `}
            type="button"
          >
            <span className="flex-1 pr-4 tracking-tight">{example}</span>
            <ChevronRight size={14} className={`transition-all duration-300 group-hover:translate-x-1 ${disabled ? "opacity-0" : "opacity-20 group-hover:opacity-100 text-faheem-emerald"}`} />
          </motion.button>
        ))}
      </div>

      {disabled && (
        <div className="pt-4 flex items-center justify-center gap-2 opacity-40">
          <div className="w-8 h-[1px] bg-obsidian-700" />
          <span className="text-[9px] text-obsidian-500 font-black uppercase tracking-[0.2em]">
            Start to Unlock
          </span>
          <div className="w-8 h-[1px] bg-obsidian-700" />
        </div>
      )}
    </div>
  );
}
