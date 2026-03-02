"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { log } from "@/lib/log";

// Web Speech API types (not included in default TS lib)
type SpeechRecognitionType = typeof window extends { SpeechRecognition: infer T }
  ? T
  : any;

/**
 * useVoiceTranscription — Web Speech API hook for live voice transcription
 *
 * Provides real-time captions of what the student says:
 * - Partial transcripts update while speaking
 * - Final transcripts lock in after each utterance
 * - Optional: auto-send final transcripts to backend
 *
 * Browser support:
 * - Chrome/Edge: full support
 * - Safari: experimental (may require prefix)
 * - Firefox: limited/no support
 */

export interface VoiceTranscriptionCallbacks {
  /** Fired continuously while user is speaking (partial transcripts) */
  onPartial?: (text: string) => void;
  /** Fired when an utterance is complete (final transcript) */
  onFinal?: (text: string) => void;
  /** Fired on errors (e.g., no speech detected, network error) */
  onError?: (error: string) => void;
}

export function useVoiceTranscription(callbacks?: VoiceTranscriptionCallbacks) {
  const [isSupported, setIsSupported] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const wantRunningRef = useRef(false); // true while user wants transcription active

  // Use refs for callbacks so the recognition instance always calls the latest version
  const onPartialRef = useRef(callbacks?.onPartial);
  onPartialRef.current = callbacks?.onPartial;
  const onFinalRef = useRef(callbacks?.onFinal);
  onFinalRef.current = callbacks?.onFinal;
  const onErrorRef = useRef(callbacks?.onError);
  onErrorRef.current = callbacks?.onError;

  // ── Check browser support on mount ───────────────────────────────────────

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
      log.voice("Web Speech API supported");
    } else {
      setIsSupported(false);
      log.voice("Web Speech API not supported in this browser");
    }
  }, []);

  // ── Start transcription ──────────────────────────────────────────────────

  const startTranscription = useCallback(() => {
    if (!isSupported) {
      log.voice("Cannot start transcription: Web Speech API not supported");
      onErrorRef.current?.("Web Speech API is not supported in this browser.");
      return;
    }

    if (recognitionRef.current) {
      log.voice("Transcription already running — ignoring startTranscription");
      return;
    }

    wantRunningRef.current = true;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;         // Keep listening until stopped
    recognition.interimResults = true;     // Send partial results while speaking
    recognition.lang = "en-US";            // Default to English (can be customized)
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      log.voice("Transcription started");
      setIsRunning(true);
    };

    recognition.onresult = (event: any) => {
      // event.results is a SpeechRecognitionResultList
      // Each result can be interim (partial) or final
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();

        if (result.isFinal) {
          log.voice(`Final transcript: "${transcript}"`);
          onFinalRef.current?.(transcript);
        } else {
          log.voice(`Partial transcript: "${transcript}"`);
          onPartialRef.current?.(transcript);
        }
      }
    };

    recognition.onerror = (event: any) => {
      log.error("Speech recognition error", event.error);

      // Common errors:
      // - "no-speech": user didn't speak (can be ignored)
      // - "network": network error
      // - "not-allowed": microphone permission denied
      // - "aborted": recognition aborted

      if (event.error === "no-speech") {
        // Ignore no-speech errors (normal if user is silent)
        return;
      }

      onErrorRef.current?.(event.error);

      // If error is fatal, stop wanting to run
      if (["not-allowed", "service-not-allowed"].includes(event.error)) {
        wantRunningRef.current = false;
      }
    };

    recognition.onend = () => {
      log.voice("Transcription ended");
      recognitionRef.current = null;

      // Chrome often stops recognition after a final result even with continuous=true.
      // Auto-restart if user still wants transcription running.
      if (wantRunningRef.current) {
        log.voice("Auto-restarting transcription (user still wants it running)");
        try {
          const newRecognition = new SpeechRecognition();
          newRecognition.continuous = true;
          newRecognition.interimResults = true;
          newRecognition.lang = "en-US";
          newRecognition.maxAlternatives = 1;
          newRecognition.onstart = recognition.onstart;
          newRecognition.onresult = recognition.onresult;
          newRecognition.onerror = recognition.onerror;
          newRecognition.onend = recognition.onend;
          recognitionRef.current = newRecognition;
          newRecognition.start();
        } catch (err) {
          log.error("Auto-restart failed", err);
          setIsRunning(false);
        }
      } else {
        setIsRunning(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported]);

  // ── Stop transcription ───────────────────────────────────────────────────

  const stopTranscription = useCallback(() => {
    wantRunningRef.current = false; // prevent auto-restart in onend

    if (!recognitionRef.current) {
      log.voice("No active transcription to stop");
      return;
    }

    log.voice("Stopping transcription");
    recognitionRef.current.stop();
    recognitionRef.current = null;
    setIsRunning(false);
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────

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
    startTranscription,
    stopTranscription,
  };
}
