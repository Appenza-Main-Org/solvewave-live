"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { log } from "@/lib/log";

/**
 * useVoiceTranscription — Web Speech API hook (English-only)
 *
 * Provides live speech-to-text captions using the browser's Web Speech API.
 * Always uses en-US — no language detection or switching.
 */

// ── Hook ────────────────────────────────────────────────────────────────────

export interface VoiceTranscriptionCallbacks {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceTranscription(callbacks?: VoiceTranscriptionCallbacks) {
  const [isSupported, setIsSupported] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const recognitionRef = useRef<any>(null);
  const wantRunningRef = useRef(false);

  // Callback refs (always latest)
  const onPartialRef = useRef(callbacks?.onPartial);
  onPartialRef.current = callbacks?.onPartial;
  const onFinalRef = useRef(callbacks?.onFinal);
  onFinalRef.current = callbacks?.onFinal;
  const onErrorRef = useRef(callbacks?.onError);
  onErrorRef.current = callbacks?.onError;

  // ── Browser support check ─────────────────────────────────────────────────

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      setIsSupported(true);
      log.voice("Web Speech API supported — lang: en-US");
    } else {
      setIsSupported(false);
      log.voice("Web Speech API not supported");
    }
  }, []);

  // ── Internal: create and wire a recognition instance ──────────────────────

  const createRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      log.voice("Recognition started [lang=en-US]");
      setIsRunning(true);
    };

    rec.onaudiostart = () => {
      log.voice("Recognition: audio capture started");
    };

    rec.onspeechstart = () => {
      log.voice("Recognition: speech detected");
    };

    rec.onspeechend = () => {
      log.voice("Recognition: speech ended");
    };

    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();

        if (result.isFinal) {
          // Skip empty finals (noise from Web Speech API)
          if (!transcript) continue;
          log.voice(`Final: "${transcript}"`);
          onFinalRef.current?.(transcript);
        } else {
          if (!transcript) continue;
          onPartialRef.current?.(transcript);
        }
      }
    };

    rec.onerror = (event: any) => {
      if (event.error === "no-speech") {
        log.voice("Speech recognition: no-speech detected (will auto-restart)");
        return;
      }
      if (event.error === "aborted") {
        log.voice("Speech recognition: aborted");
        return;
      }
      log.error("Speech recognition error", event.error);
      onErrorRef.current?.(event.error);
      if (["not-allowed", "service-not-allowed"].includes(event.error)) {
        wantRunningRef.current = false;
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      if (wantRunningRef.current) {
        log.voice("Auto-restarting [lang=en-US]");
        try {
          const next = createRecognition();
          if (next) {
            recognitionRef.current = next;
            next.start();
          }
        } catch (err) {
          log.error("Auto-restart failed", err);
          setIsRunning(false);
        }
      } else {
        setIsRunning(false);
      }
    };

    return rec;
  }, []);

  // ── Start ─────────────────────────────────────────────────────────────────

  const startTranscription = useCallback(() => {
    if (!isSupported) {
      onErrorRef.current?.("Web Speech API not supported.");
      return;
    }
    if (recognitionRef.current) return;

    wantRunningRef.current = true;

    const rec = createRecognition();
    if (rec) {
      recognitionRef.current = rec;
      rec.start();
    }
  }, [isSupported, createRecognition]);

  // ── Stop ──────────────────────────────────────────────────────────────────

  const stopTranscription = useCallback(() => {
    wantRunningRef.current = false;
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    recognitionRef.current = null;
    setIsRunning(false);
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      wantRunningRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isRunning,
    /** Always en-US for this English-only app */
    detectedLang: "en-US" as const,
    startTranscription,
    stopTranscription,
  };
}
