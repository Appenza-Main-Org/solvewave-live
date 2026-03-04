"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { LiveState } from "@/hooks/useSessionSocket";

interface AmbientOrbProps {
  state: LiveState;
}

const STATE_COLORS: Record<LiveState, string> = {
  idle: "#64748b",
  connecting: "#facc15",
  connected: "#10b981",
  thinking: "#38bdf8",
  seeing: "#a78bfa",
  listening: "#fb7185",
  speaking: "#10b981",
  interrupted: "#fb923c",
  error: "#ef4444",
};

export default function AmbientOrb({ state }: AmbientOrbProps) {
  const color = STATE_COLORS[state];

  return (
    <div className="relative flex items-center justify-center w-full h-full min-h-[120px] sm:min-h-[160px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.2, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative"
        >
          {/* Outer glow rings */}
          {(state === "listening" || state === "speaking") && (
            <>
              <motion.div
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 0.1, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-full blur-2xl"
                style={{ backgroundColor: color }}
              />
              <motion.div
                animate={{
                  scale: [1, 2, 1],
                  opacity: [0.2, 0, 0.2],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5,
                }}
                className="absolute inset-0 rounded-full blur-3xl"
                style={{ backgroundColor: color }}
              />
            </>
          )}

          {/* The main orb */}
          <motion.div
            animate={
              state === "thinking"
                ? {
                    rotate: 360,
                    scale: [1, 1.1, 1],
                  }
                : state === "listening"
                ? {
                    scale: [1, 1.15, 1],
                  }
                : state === "speaking"
                ? {
                    scale: [1, 1.1, 1],
                  }
                : {
                    y: [0, -5, 0],
                  }
            }
            transition={
              state === "thinking"
                ? {
                    rotate: { duration: 3, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                  }
                : {
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
            style={{
              backgroundColor: color,
              boxShadow: `0 0 40px ${color}66`,
            }}
            className={`
              w-16 h-16 sm:w-24 sm:h-24 rounded-full
              flex items-center justify-center
              relative z-10
              ${state === "thinking" ? "border-t-4 border-white/40" : ""}
            `}
          >
            {/* Inner highlights */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-black/20 via-transparent to-white/30" />
            <div className="absolute top-2 left-4 w-4 h-4 rounded-full bg-white/20 blur-sm" />

            {/* State icons or symbols could go here */}
            <div className="text-2xl sm:text-3xl filter drop-shadow-md">
              {state === "idle" && "💤"}
              {state === "connecting" && "⏳"}
              {state === "connected" && "✨"}
              {state === "thinking" && "🧠"}
              {state === "seeing" && "📷"}
              {state === "listening" && "👂"}
              {state === "speaking" && "💬"}
              {state === "interrupted" && "✋"}
              {state === "error" && "⚠️"}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
