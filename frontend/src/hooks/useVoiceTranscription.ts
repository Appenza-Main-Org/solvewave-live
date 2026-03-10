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
 * - Auto-detects Arabic vs English speech and switches language dynamically
 *
 * Browser support:
 * - Chrome/Edge: full support
 * - Safari: experimental (may require prefix)
 * - Firefox: limited/no support
 */

// ── Language auto-detection ─────────────────────────────────────────────────

const ARABIC_UNICODE_RE = /[\u0600-\u06FF]/;
const TRANSLITERATED_ARABIC_RE =
  /\b(hamsa|khamsa|arba|arbaa|thalatha|talata|etneen|itnen|wahed|wahid|sitta|setta|sabaa|tamanya|tmania|tisaa|ashara|darb|zayed|naqes|naqis|yesawi|yisawi|eshrahli|ishrahli|moaadla|kasr|hel)\b/i;

/**
 * Given a transcript and the current recognition language, return the
 * language we should switch to — or null if no switch is needed.
 */
function detectLangSwitch(text: string, currentLang: string): string | null {
  const hasArabic = ARABIC_UNICODE_RE.test(text);

  // Arabic characters detected while in English mode → switch to Arabic
  if (hasArabic && currentLang === "en-US") return "ar-EG";

  // Known transliterated Arabic math words while in English mode → switch to Arabic
  if (!hasArabic && currentLang === "en-US" && TRANSLITERATED_ARABIC_RE.test(text)) {
    return "ar-EG";
  }

  // In Arabic mode but output is clearly Latin (no Arabic chars) → switch to English
  if (currentLang === "ar-EG" && !hasArabic && /[a-zA-Z]/.test(text)) {
    return "en-US";
  }

  return null;
}

// ── Confidence-based language detection ──────────────────────────────────────

/** Threshold below which we suspect the speech doesn't match the current language */
const LOW_CONFIDENCE_THRESHOLD = 0.45;
/** Number of consecutive low-confidence results before auto-switching */
const LOW_CONFIDENCE_STREAK_TRIGGER = 1;

// ── Hook ────────────────────────────────────────────────────────────────────

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
  const [detectedLang, setDetectedLang] = useState<"en-US" | "ar-EG">("en-US");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const wantRunningRef = useRef(false); // true while user wants transcription active
  const autoLangRef = useRef<string>("en-US"); // internally managed language
  const lowConfidenceStreakRef = useRef(0); // tracks consecutive low-confidence results

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
    recognition.lang = autoLangRef.current; // Auto-managed language
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      log.voice(`Transcription started [lang=${autoLangRef.current}]`);
      setIsRunning(true);
    };

    recognition.onresult = (event: any) => {
      // event.results is a SpeechRecognitionResultList
      // Each result can be interim (partial) or final
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        const confidence = result[0].confidence; // 0–1 (how well speech matches current language)

        if (result.isFinal) {
          log.voice(`Final transcript [conf=${confidence.toFixed(2)}]: "${transcript}"`);

          // ── Confidence-based auto-switch ─────────────────────────────
          // Low confidence means speech likely doesn't match current language.
          // After LOW_CONFIDENCE_STREAK_TRIGGER consecutive low results, switch.
          if (confidence > 0 && confidence < LOW_CONFIDENCE_THRESHOLD) {
            lowConfidenceStreakRef.current++;
            log.voice(`Low confidence streak: ${lowConfidenceStreakRef.current}/${LOW_CONFIDENCE_STREAK_TRIGGER}`);

            if (lowConfidenceStreakRef.current >= LOW_CONFIDENCE_STREAK_TRIGGER) {
              const switchTo = autoLangRef.current === "en-US" ? "ar-EG" : "en-US";
              log.voice(`Auto-switching language (low confidence): ${autoLangRef.current} → ${switchTo}`);
              autoLangRef.current = switchTo;
              setDetectedLang(switchTo as "en-US" | "ar-EG");
              lowConfidenceStreakRef.current = 0;
              // Don't emit this low-confidence transcript — restart with correct language
              if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch {}
              }
              continue; // skip emitting this garbled transcript
            }
          } else {
            // Good confidence — reset streak
            lowConfidenceStreakRef.current = 0;
          }

          onFinalRef.current?.(transcript);

          // ── Unicode-based auto-detect (supplementary) ─────────────────
          const newLang = detectLangSwitch(transcript, autoLangRef.current);
          if (newLang) {
            log.voice(`Language auto-switch (unicode): ${autoLangRef.current} → ${newLang}`);
            autoLangRef.current = newLang;
            setDetectedLang(newLang as "en-US" | "ar-EG");
            if (recognitionRef.current) {
              try { recognitionRef.current.abort(); } catch {}
            }
          }
        } else {
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
      // - "aborted": recognition aborted (we trigger this on lang switch)

      if (event.error === "no-speech" || event.error === "aborted") {
        // Ignore — no-speech is normal silence, aborted is our lang-switch trigger
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
        log.voice(`Auto-restarting transcription [lang=${autoLangRef.current}]`);
        try {
          const newRecognition = new SpeechRecognition();
          newRecognition.continuous = true;
          newRecognition.interimResults = true;
          newRecognition.lang = autoLangRef.current;
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

  // ── Manual language toggle ──────────────────────────────────────────────
  const toggleLanguage = useCallback(() => {
    const newLang = autoLangRef.current === "en-US" ? "ar-EG" : "en-US";
    log.voice(`Manual language toggle: ${autoLangRef.current} → ${newLang}`);
    autoLangRef.current = newLang;
    setDetectedLang(newLang as "en-US" | "ar-EG");

    // Restart recognition with new language if currently running
    if (recognitionRef.current && wantRunningRef.current) {
      try { recognitionRef.current.abort(); } catch {} // onend will auto-restart with new lang
    }
  }, []);

  return {
    isSupported,
    isRunning,
    /** The currently active speech language ("en-US" or "ar-EG") */
    detectedLang,
    /** Manually toggle between English and Arabic */
    toggleLanguage,
    startTranscription,
    stopTranscription,
  };
}
