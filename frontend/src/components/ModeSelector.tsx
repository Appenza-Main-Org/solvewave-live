"use client";

export type TutorMode = "explain" | "quiz" | "homework";

const MODES: { id: TutorMode; label: string; helper: string }[] = [
  { id: "explain",  label: "Explain",  helper: "Walk me through it" },
  { id: "quiz",     label: "Quiz",     helper: "Test my knowledge" },
  { id: "homework", label: "Homework", helper: "Solve my sheet" },
];

interface ModeSelectorProps {
  selected: TutorMode;
  onChange: (mode: TutorMode) => void;
}

export default function ModeSelector({ selected, onChange }: ModeSelectorProps) {
  return (
    <div className="inline-flex rounded-xl sm:rounded-2xl bg-slate-900/80 border border-slate-800/70 p-0.5 sm:p-1 gap-0.5 sm:gap-1 shadow-[0_0_0_1px_rgba(15,23,42,0.9)]">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`
            px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-medium transition-all duration-150
            flex flex-col items-center justify-center min-w-[68px] sm:min-w-[92px]
            ${selected === m.id
              ? "bg-emerald-600 text-emerald-50 shadow-sm shadow-emerald-500/40"
              : "text-slate-300/80 hover:text-slate-100 hover:bg-slate-800/80"
            }
          `}
          type="button"
        >
          <span className="text-[11px] sm:text-[12px] font-semibold leading-tight">
            {m.label}
          </span>
          <span
            className={`
              hidden lg:block mt-0.5 text-[10px] leading-tight
              ${selected === m.id ? "text-emerald-50/90" : "text-slate-500"}
            `}
          >
            {m.helper}
          </span>
        </button>
      ))}
    </div>
  );
}
