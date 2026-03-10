"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { log } from "@/lib/log";

/**
 * useVoiceTranscription — Web Speech API hook with automatic language detection
 *
 * Detects whether the user speaks Arabic or English:
 * 1. Browser locale check → if device is Arabic, default to Arabic
 * 2. Language probe at start → tries both languages, picks the one that
 *    produces native-script output (Arabic Unicode for AR, Latin for EN)
 * 3. Ongoing monitoring → switches when output script changes
 */

// ── Language helpers ──────────────────────────────────────────────────────────

const ARABIC_UNICODE_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Check if browser locale prefers Arabic */
function browserPrefersArabic(): boolean {
  if (typeof navigator === "undefined") return false;
  const langs = navigator.languages ?? [navigator.language];
  return langs.some((l) => l.startsWith("ar"));
}

/** Detect initial language from browser locale */
function getDefaultLang(): "en-US" | "ar-EG" {
  return browserPrefersArabic() ? "ar-EG" : "en-US";
}

// ── Hook ────────────────────────────────────────────────────────────────────

export interface VoiceTranscriptionCallbacks {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceTranscription(callbacks?: VoiceTranscriptionCallbacks) {
  const [isSupported, setIsSupported] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [detectedLang, setDetectedLang] = useState<"en-US" | "ar-EG">("en-US");

  const recognitionRef = useRef<any>(null);
  const wantRunningRef = useRef(false);
  const langRef = useRef<string>("en-US");
  const probePhaseRef = useRef<"none" | "probing-alt" | "done">("none");
  const probeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // Set default from browser locale
      const defaultLang = getDefaultLang();
      langRef.current = defaultLang;
      setDetectedLang(defaultLang);
      log.voice(`Web Speech API supported — default lang: ${defaultLang}`);
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
    rec.lang = langRef.current;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      log.voice(`Recognition started [lang=${langRef.current}, probe=${probePhaseRef.current}]`);
      setIsRunning(true);
    };

    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();

        if (result.isFinal) {
          const hasArabic = ARABIC_UNICODE_RE.test(transcript);
          log.voice(`Final [${langRef.current}]: "${transcript}" (arabic=${hasArabic})`);

          // ── During language probe ────────────────────────────────────
          if (probePhaseRef.current === "probing-alt") {
            // We're in the alternate-language probe
            if (hasArabic && langRef.current === "ar-EG") {
              // Arabic probe got Arabic output → Arabic is correct! Keep it.
              log.voice("Probe confirmed: Arabic detected");
              probePhaseRef.current = "done";
              if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
              onFinalRef.current?.(transcript);
            } else if (!hasArabic && langRef.current === "en-US") {
              // English probe got English output → English is correct! Keep it.
              log.voice("Probe confirmed: English detected");
              probePhaseRef.current = "done";
              if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
              onFinalRef.current?.(transcript);
            } else {
              // Probe didn't match either — keep going, probe timer will handle fallback
              onFinalRef.current?.(transcript);
            }
            continue;
          }

          // ── Normal operation (probe done or none) ────────────────────
          // If in Arabic mode and got Arabic output → correct, emit
          // If in English mode and got Latin output → correct, emit
          // If output script doesn't match mode → switch
          if (langRef.current === "en-US" && hasArabic) {
            // Rare: en-US somehow produced Arabic chars → switch to Arabic
            log.voice(`Script mismatch: switching en-US → ar-EG`);
            langRef.current = "ar-EG";
            setDetectedLang("ar-EG");
            onFinalRef.current?.(transcript);
            if (recognitionRef.current) {
              try { recognitionRef.current.abort(); } catch {}
            }
            continue;
          }

          if (langRef.current === "ar-EG" && !hasArabic && /[a-zA-Z]{2,}/.test(transcript)) {
            // Arabic mode but output is clearly English → switch to English
            log.voice(`Script mismatch: switching ar-EG → en-US`);
            langRef.current = "en-US";
            setDetectedLang("en-US");
            onFinalRef.current?.(transcript);
            if (recognitionRef.current) {
              try { recognitionRef.current.abort(); } catch {}
            }
            continue;
          }

          // ── First result: trigger language probe if not done ─────────
          if (probePhaseRef.current === "none") {
            onFinalRef.current?.(transcript);
            // Start probing: try the OTHER language to see if it works better
            const altLang = langRef.current === "en-US" ? "ar-EG" : "en-US";
            log.voice(`Starting language probe: trying ${altLang}`);
            probePhaseRef.current = "probing-alt";
            langRef.current = altLang;
            setDetectedLang(altLang as "en-US" | "ar-EG");

            // Set a timeout: if probe doesn't produce a result in 3s, revert
            probeTimerRef.current = setTimeout(() => {
              if (probePhaseRef.current === "probing-alt") {
                // Probe didn't get a result — revert to original language
                const revertTo = altLang === "ar-EG" ? "en-US" : "ar-EG";
                log.voice(`Probe timeout — reverting to ${revertTo}`);
                probePhaseRef.current = "done";
                langRef.current = revertTo;
                setDetectedLang(revertTo as "en-US" | "ar-EG");
                if (recognitionRef.current) {
                  try { recognitionRef.current.abort(); } catch {}
                }
              }
            }, 3000);

            // Abort to restart with the alt language
            if (recognitionRef.current) {
              try { recognitionRef.current.abort(); } catch {}
            }
            continue;
          }

          // Normal emit
          onFinalRef.current?.(transcript);
        } else {
          // Partial results — always emit
          onPartialRef.current?.(transcript);
        }
      }
    };

    rec.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      log.error("Speech recognition error", event.error);
      onErrorRef.current?.(event.error);
      if (["not-allowed", "service-not-allowed"].includes(event.error)) {
        wantRunningRef.current = false;
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      if (wantRunningRef.current) {
        log.voice(`Auto-restarting [lang=${langRef.current}]`);
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
    probePhaseRef.current = "none"; // reset probe for each session

    const rec = createRecognition();
    if (rec) {
      recognitionRef.current = rec;
      rec.start();
    }
  }, [isSupported, createRecognition]);

  // ── Stop ──────────────────────────────────────────────────────────────────

  const stopTranscription = useCallback(() => {
    wantRunningRef.current = false;
    if (probeTimerRef.current) {
      clearTimeout(probeTimerRef.current);
      probeTimerRef.current = null;
    }
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    recognitionRef.current = null;
    setIsRunning(false);
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      wantRunningRef.current = false;
      if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isSupported,
    isRunning,
    /** The currently detected speech language */
    detectedLang,
    startTranscription,
    stopTranscription,
  };
}
