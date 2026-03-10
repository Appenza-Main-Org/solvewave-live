import { motion } from "framer-motion";

export type TutorMode = "explain" | "quiz" | "homework";

const MODES: { id: TutorMode; label: string; helper: string; icon: string }[] = [
  { id: "explain",  label: "Explain",  helper: "Concepts", icon: "📖" },
  { id: "quiz",     label: "Quiz",     helper: "Practice", icon: "✍️" },
  { id: "homework", label: "Homework", helper: "Solutions", icon: "🏠" },
];

interface ModeSelectorProps {
  selected: TutorMode;
  onChange: (mode: TutorMode) => void;
}

export default function ModeSelector({ selected, onChange }: ModeSelectorProps) {
  return (
    <div className="flex p-1.5 rounded-2xl bg-obsidian-900/50 border border-white/5 backdrop-blur-xl shadow-2xl relative overflow-hidden">
      {MODES.map((m) => {
        const isSelected = selected === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={`
              relative z-10 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-500
              flex flex-col items-center justify-center min-w-[90px] sm:min-w-[110px] gap-1
              ${isSelected ? "text-white" : "text-obsidian-500 hover:text-obsidian-300"}
            `}
            type="button"
          >
            {isSelected && (
              <motion.div
                layoutId="active-mode"
                className="absolute inset-0 bg-sw-emerald shadow-[0_0_20px_rgba(16,185,129,0.3)] rounded-xl"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-20 flex items-center gap-2">
              <span className="text-sm filter saturate-[0.8]">{m.icon}</span>
              <span>{m.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
