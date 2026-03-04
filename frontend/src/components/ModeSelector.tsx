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
    <div className="flex p-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-inner relative overflow-hidden">
      {MODES.map((m) => {
        const isSelected = selected === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={`
              relative z-10 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300
              flex flex-col items-center justify-center min-w-[80px] sm:min-w-[100px] gap-0.5
              ${isSelected ? "text-white scale-105" : "text-slate-500 hover:text-slate-300"}
            `}
            type="button"
          >
            {isSelected && (
              <motion.div
                layoutId="active-mode"
                className="absolute inset-0 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20"
                transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
              />
            )}
            <span className="relative z-20 flex items-center gap-2">
              <span className="text-sm">{m.icon}</span>
              <span className="tracking-tight">{m.label}</span>
            </span>
            <span className={`relative z-20 text-[9px] font-medium opacity-60 uppercase tracking-widest ${isSelected ? "text-emerald-50" : "text-slate-600"}`}>
              {m.helper}
            </span>
          </button>
        );
      })}
    </div>
  );
}
