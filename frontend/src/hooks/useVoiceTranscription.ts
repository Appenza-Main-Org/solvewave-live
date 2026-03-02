"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { log } from "@/lib/log";

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

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { onPartial, onFinal, onError } = callbacks || {};

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
      onError?.("Web Speech API is not supported in this browser.");
      return;
    }

    if (recognitionRef.current) {
      log.voice("Transcription already running — ignoring startTranscription");
      return;
    }

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

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // event.results is a SpeechRecognitionResultList
      // Each result can be interim (partial) or final
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();

        if (result.isFinal) {
          log.voice(`Final transcript: "${transcript}"`);
          onFinal?.(transcript);
        } else {
          log.voice(`Partial transcript: "${transcript}"`);
          onPartial?.(transcript);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
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

      onError?.(event.error);

      // If error is fatal, stop
      if (["not-allowed", "service-not-allowed"].includes(event.error)) {
        stopTranscription();
      }
    };

    recognition.onend = () => {
      log.voice("Transcription ended");
      setIsRunning(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, onPartial, onFinal, onError]);

  // ── Stop transcription ───────────────────────────────────────────────────

  const stopTranscription = useCallback(() => {
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
