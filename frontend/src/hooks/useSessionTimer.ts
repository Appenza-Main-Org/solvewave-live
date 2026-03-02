"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useSessionTimer — Track session duration (mm:ss format)
 *
 * Starts when isActive becomes true, stops when it becomes false.
 * Returns elapsed time in seconds and formatted string.
 */

export function useSessionTimer(isActive: boolean) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isActive && !startTimeRef.current) {
      // Session started
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);

      // Update every second
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setElapsedSeconds(elapsed);
        }
      }, 1000);
    } else if (!isActive && startTimeRef.current) {
      // Session stopped — freeze the timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Keep elapsedSeconds frozen at the final value
      startTimeRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive]);

  // Format as mm:ss
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const formatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return {
    elapsedSeconds,
    formatted,
  };
}
