"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { LiveState } from "@/hooks/useSessionSocket";

interface AmbientOrbProps {
  state: LiveState;
}

const STATE_COLORS: Record<LiveState, string> = {
  idle: "#64748B",        // Slate
  connecting: "#FACC15",  // Yellow
  connected: "#10B981",   // Emerald
  thinking: "#38BDF8",    // Sky
  seeing: "#A855F7",      // Purple
  listening: "#F43F5E",   // Rose
  speaking: "#10B981",    // Emerald
  interrupted: "#F97316", // Orange
  error: "#EF4444",       // Red
};

export default function AmbientOrb({ state }: AmbientOrbProps) {
  const color = STATE_COLORS[state];

  return (
    <div className="relative flex items-center justify-center w-full h-full min-h-[80px] sm:min-h-[90px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.1, opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          {/* Behavior-based background effects */}
          <AnimatePresence>
            {state === "listening" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute w-full h-full rounded-full border border-sw-rose/30"
                    animate={{
                      scale: [1, 1.8],
                      opacity: [0.5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.6,
                      ease: "easeOut",
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Intelligent Orb */}
          <motion.div
            animate={
              state === "thinking"
                ? {
                    rotate: 360,
                    scale: [1, 1.05, 1],
                  }
                : state === "speaking"
                ? {
                    scale: [1, 1.08, 1],
                  }
                : state === "listening"
                ? {
                    scale: [1, 1.1, 1],
                  }
                : {
                    y: [0, -8, 0],
                  }
            }
            transition={
              state === "thinking"
                ? {
                    rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                  }
                : {
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
            style={{
              backgroundColor: color,
              boxShadow: `0 0 40px ${color}33, inset 0 0 15px rgba(255,255,255,0.2)`,
            }}
            className={`
              w-16 h-16 sm:w-20 h-20 rounded-full
              flex items-center justify-center
              relative z-10 overflow-hidden
              border border-white/10
            `}
          >
            {/* Intelligent Core Surface */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/30" />
            
            {/* State-specific textures/visuals */}
            {state === "thinking" && (
              <div className="absolute inset-0 opacity-40">
                <div className="w-full h-full animate-spin-slow border-2 border-dashed border-white/30 rounded-full scale-75" />
              </div>
            )}

            {/* State Icon/Symbol */}
            <motion.div 
              key={state}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-3xl sm:text-4xl filter drop-shadow-lg z-20"
            >
              {state === "idle" && "•"}
              {state === "connecting" && "⌛"}
              {state === "connected" && "✨"}
              {state === "thinking" && "🧠"}
              {state === "seeing" && "📷"}
              {state === "listening" && "👂"}
              {state === "speaking" && "💬"}
              {state === "interrupted" && "✋"}
              {state === "error" && "⚠️"}
            </motion.div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
