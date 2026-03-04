"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { TranscriptEntry } from "@/components/TranscriptPanel";
import type { TutorMode } from "@/components/ModeSelector";
import { log } from "@/lib/log";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/session";

// Derive the HTTP health URL from the WS URL for cold-start warm-up
const HEALTH_URL = WS_URL.replace(/^ws(s)?:\/\//, "http$1://").replace(/\/ws\/session$/, "/health");

// ── Voice audio constants ─────────────────────────────────────────────────────
const MIC_SAMPLE_RATE  = 16000;  // Gemini input: 16 kHz
const OUT_SAMPLE_RATE  = 24000;  // Gemini output: 24 kHz
const SAMPLES_PER_CHUNK = Math.floor((MIC_SAMPLE_RATE * 100) / 1000); // 100 ms

export type SessionStatus = "idle" | "connecting" | "connected" | "error";
export type LiveState =
  | "idle"
  | "connecting"
  | "connected"
  | "thinking"
  | "seeing"
  | "listening"
  | "speaking"
  | "interrupted"
  | "error";

function timestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useSessionSocket() {
  const [status, setStatus]             = useState<SessionStatus>("idle");
  const [transcript, setTranscript]     = useState<TranscriptEntry[]>([]);
  const [isThinking, setIsThinking]     = useState(false);
  const [lastSentType, setLastSentType] = useState<"text" | "image">("text");
  const [voiceActive, setVoiceActive]     = useState(false);
  const [isSpeaking, setIsSpeaking]       = useState(false);
  const [isInterrupted, setIsInterrupted] = useState(false);

  // WebSocket
  const wsRef = useRef<WebSocket | null>(null);

  // Voice / audio refs
  const mediaStreamRef   = useRef<MediaStream | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const processorRef     = useRef<ScriptProcessorNode | null>(null);
  const playbackCtxRef   = useRef<AudioContext | null>(null);
  const nextPlayTimeRef  = useRef<number>(0);
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived live state for the UI indicator ────────────────────────────────

  const interruptedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const liveState = useMemo<LiveState>(() => {
    if (status === "error")      return "error";
    if (status === "connecting") return "connecting";
    if (status === "connected") {
      if (isInterrupted) return "interrupted";
      if (isSpeaking)    return "speaking";
      if (voiceActive)   return "listening";
      if (isThinking)    return lastSentType === "image" ? "seeing" : "thinking";
      return "connected";
    }
    return "idle";
  }, [status, isThinking, lastSentType, voiceActive, isSpeaking, isInterrupted]);

  // ── Transcript helper ──────────────────────────────────────────────────────

  const append = useCallback((entry: TranscriptEntry) => {
    log.transcript(`append role=${entry.role} text="${entry.text.slice(0, 60)}"`);
    setTranscript((prev) => [...prev, entry]);
  }, []);

  // ── Audio playback ─────────────────────────────────────────────────────────

  const scheduleAudioChunk = useCallback((pcmBytes: ArrayBuffer) => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return;

    // Mark tutor as speaking; clear the flag ~600ms after the last chunk arrives
    setIsSpeaking(true);
    if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
    speakingTimerRef.current = setTimeout(() => {
      setIsSpeaking(false);
      log.voice("Tutor audio playback ended");
    }, 600);

    const int16   = new Int16Array(pcmBytes);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const buf = ctx.createBuffer(1, float32.length, OUT_SAMPLE_RATE);
    buf.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.connect(ctx.destination);

    const t = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    source.start(t);
    nextPlayTimeRef.current = t + buf.duration;
  }, []);

  // ── Voice cleanup (stable — only uses refs + stable setter) ───────────────

  const stopVoiceCleanup = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    processorRef.current?.disconnect();
    processorRef.current = null;

    audioCtxRef.current?.close();
    audioCtxRef.current = null;

    playbackCtxRef.current?.close();
    playbackCtxRef.current = null;

    if (speakingTimerRef.current) {
      clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }
    if (interruptedTimerRef.current) {
      clearTimeout(interruptedTimerRef.current);
      interruptedTimerRef.current = null;
    }

    setVoiceActive(false);
    setIsSpeaking(false);
    setIsInterrupted(false);
    log.voice("Voice resources released");
  }, []);

  // ── Connect ────────────────────────────────────────────────────────────────

  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  const startSession = useCallback(() => {
    if (wsRef.current) {
      log.session("startSession called but WS already open — ignoring");
      return;
    }

    log.session("Starting session", { url: WS_URL });
    setStatus("connecting");
    log.state("idle → connecting");

    // Fire-and-forget warm-up: hit the HTTP health endpoint to wake Cloud Run
    // before opening the WebSocket. This prevents cold-start timeouts on mobile.
    fetch(HEALTH_URL, { mode: "cors" }).catch(() => {});
    log.ws("Warm-up ping sent to", HEALTH_URL);

    const connectWs = () => {
      const ws = new WebSocket(WS_URL);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        retryCountRef.current = 0;
        log.ws("onopen — waiting for server status frame");
      };

      ws.onmessage = (event) => {
        // Binary frame = PCM audio from Gemini Live
        if (typeof event.data !== "string") {
          scheduleAudioChunk(event.data as ArrayBuffer);
          return;
        }

        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(event.data);
        } catch {
          log.ws("Received non-JSON text — raw tutor message", event.data);
          append({ role: "tutor", text: event.data, timestamp: timestamp() });
          return;
        }

        log.ws(`Received type=${msg.type}`, msg);

        if (msg.type === "status" && msg.value === "connected") {
          log.session("Connected", { session_id: msg.session_id });
          setStatus("connected");
          log.state("connecting → connected");
          append({
            role: "tutor",
            text: "Hi! I'm Faheem, your math tutor — what problem are we solving today?",
            timestamp: timestamp(),
          });
        } else if (msg.type === "message" && typeof msg.text === "string") {
          log.ws("Tutor message received", { text: msg.text.slice(0, 80) });
          setIsThinking(false);
          append({ role: "tutor", text: msg.text, timestamp: timestamp() });
        } else if (msg.type === "recap" && msg.data) {
          log.session("Recap received", msg.data);
          setIsThinking(false);
          const data    = msg.data as Record<string, unknown>;
          const summary = typeof data.summary === "string" ? data.summary : "Session complete.";
          append({ role: "tutor", text: `✓ ${summary}`, timestamp: timestamp() });
        } else if (msg.type === "status" && msg.value === "interrupted") {
          log.voice("Barge-in: tutor interrupted by student");
          setIsSpeaking(false);
          if (speakingTimerRef.current) {
            clearTimeout(speakingTimerRef.current);
            speakingTimerRef.current = null;
          }
          setIsInterrupted(true);
          if (interruptedTimerRef.current) clearTimeout(interruptedTimerRef.current);
          interruptedTimerRef.current = setTimeout(() => setIsInterrupted(false), 900);
        } else if (msg.type === "error" && typeof msg.value === "string") {
          log.error("Server error", msg.value);
          setIsThinking(false);
          setStatus("error");
          log.state("→ error");
          append({ role: "tutor", text: `⚠ ${msg.value}`, timestamp: timestamp() });
        }
      };

      ws.onclose = (event) => {
        log.ws("onclose", { code: event.code, reason: event.reason });
        // Only reset state if this is still the active socket.
        // During retries, onerror nulls wsRef before onclose fires;
        // without this guard the stale onclose would kill the retry.
        if (wsRef.current === ws) {
          stopVoiceCleanup();
          setStatus("idle");
          setIsThinking(false);
          wsRef.current = null;
          log.state("→ idle (ws closed)");
        }
      };

      ws.onerror = (event) => {
        log.error("WebSocket error", event);
        // Null the ref so the subsequent onclose (which always fires after
        // onerror) skips the state reset and doesn't interfere with retry.
        wsRef.current = null;

        // Retry on connection failure (common on mobile / Cloud Run cold starts)
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          const delay = retryCountRef.current * 2000; // 2s, 4s, 6s
          log.ws(`Retrying connection (${retryCountRef.current}/${MAX_RETRIES}) in ${delay}ms`);
          setStatus("connecting"); // keep showing "connecting" during retries
          setTimeout(connectWs, delay);
        } else {
          stopVoiceCleanup();
          setStatus("error");
          setIsThinking(false);
          retryCountRef.current = 0;
          log.state("→ error (ws error after retries)");
        }
      };
    };

    connectWs();
  }, [append, scheduleAudioChunk, stopVoiceCleanup]);

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const stopSession = useCallback(() => {
    log.session("Stopping session");
    stopVoiceCleanup();
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send("END");
      ws.close();
    }
    wsRef.current = null;
    setStatus("idle");
    setIsThinking(false);
    log.state("→ idle (session stopped)");
  }, [stopVoiceCleanup]);

  // ── Voice: mic capture (internal) ─────────────────────────────────────────

  function startMicCapture(ctx: AudioContext, stream: MediaStream, ws: WebSocket) {
    const source    = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    let accumulated: Float32Array[] = [];
    let count = 0;

    processor.onaudioprocess = (event) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const float32 = event.inputBuffer.getChannelData(0);
      accumulated.push(new Float32Array(float32));
      count += float32.length;

      if (count >= SAMPLES_PER_CHUNK) {
        const int16 = new Int16Array(count);
        let offset  = 0;
        for (const chunk of accumulated) {
          for (let i = 0; i < chunk.length; i++) {
            const clamped   = Math.max(-1, Math.min(1, chunk[i]));
            int16[offset++] = clamped * 32767;
          }
        }
        ws.send(int16.buffer);
        accumulated = [];
        count       = 0;
      }
    };

    // Route through a silent gain node — ScriptProcessorNode requires a
    // downstream connection to fire onaudioprocess, but we don't want mic
    // audio playing through the speaker (would cause echo/feedback).
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(ctx.destination);
    log.voice("Mic capture started — PCM chunks streaming over WS");
  }

  // ── Voice: start / stop ────────────────────────────────────────────────────

  const startVoice = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      log.voice("startVoice: WS not open — ignoring");
      return;
    }
    if (mediaStreamRef.current) {
      log.voice("startVoice: already capturing — ignoring");
      return;
    }

    log.voice("Requesting mic permission");
    try {
      const stream         = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      log.voice("Mic permission granted");

      const captureCtx     = new AudioContext({ sampleRate: MIC_SAMPLE_RATE });
      audioCtxRef.current  = captureCtx;

      const playbackCtx       = new AudioContext({ sampleRate: OUT_SAMPLE_RATE });
      playbackCtxRef.current  = playbackCtx;
      nextPlayTimeRef.current = playbackCtx.currentTime;

      startMicCapture(captureCtx, stream, ws);
      setVoiceActive(true);
      log.state("connected → listening");
    } catch (err) {
      log.error("Mic permission denied or AudioContext failed", err);
    }
  // startMicCapture is a plain function — no dep needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopVoice = useCallback(() => {
    log.voice("stopVoice called by user");
    stopVoiceCleanup();
  }, [stopVoiceCleanup]);

  // ── Send text ──────────────────────────────────────────────────────────────

  const sendText = useCallback(
    (text: string, mode: TutorMode = "explain") => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        log.error("sendText called but WS not open");
        return;
      }

      log.ws("sendText", { text: text.slice(0, 80), mode });
      append({ role: "student", text, timestamp: timestamp() });
      setIsThinking(true);
      setLastSentType("text");
      log.state("connected → thinking");

      ws.send(JSON.stringify({ type: "text", text, mode }));
    },
    [append]
  );

  /** Send text to the backend without appending to transcript (used by voice transcription). */
  const sendTextQuiet = useCallback(
    (text: string, mode: TutorMode = "explain") => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        log.error("sendTextQuiet called but WS not open");
        return;
      }

      log.ws("sendTextQuiet (voice)", { text: text.slice(0, 80), mode });
      setIsThinking(true);
      setLastSentType("text");

      ws.send(JSON.stringify({ type: "text", text, mode }));
    },
    []
  );

  // ── Send image ─────────────────────────────────────────────────────────────

  const sendImage = useCallback(
    async (file: File, caption: string, mode: TutorMode = "explain") => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        log.error("sendImage called but WS not open");
        return;
      }

      log.image("Preparing to send image", {
        name: file.name,
        mimeType: file.type,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        caption,
        mode,
      });

      const imageUrl = URL.createObjectURL(file);
      append({
        role: "student",
        text: caption || "📷",
        imageUrl,
        timestamp: timestamp(),
      });
      setIsThinking(true);
      setLastSentType("image");
      log.state("connected → seeing");

      try {
        const base64 = await fileToBase64(file);
        log.image("Base64 conversion succeeded", { b64Length: base64.length });
        ws.send(
          JSON.stringify({
            type: "image",
            mimeType: file.type,
            data: base64,
            caption,
            mode,
          })
        );
        log.image("Image payload sent");
      } catch (err) {
        log.error("fileToBase64 failed", err);
        setIsThinking(false);
      }
    },
    [append]
  );

  /** Send image to backend without appending to transcript (used by voice + image combo). */
  const sendImageQuiet = useCallback(
    async (file: File, caption: string, mode: TutorMode = "explain") => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        log.error("sendImageQuiet called but WS not open");
        return;
      }

      log.image("sendImageQuiet (voice+image)", { caption: caption.slice(0, 80), mode });
      setIsThinking(true);
      setLastSentType("image");

      try {
        const base64 = await fileToBase64(file);
        ws.send(
          JSON.stringify({
            type: "image",
            mimeType: file.type,
            data: base64,
            caption,
            mode,
          })
        );
      } catch (err) {
        log.error("sendImageQuiet fileToBase64 failed", err);
        setIsThinking(false);
      }
    },
    []
  );

  return {
    status,
    isActive: status === "connected",
    isThinking,
    isSpeaking,
    liveState,
    voiceActive,
    transcript,
    setTranscript,
    startSession,
    stopSession,
    sendText,
    sendTextQuiet,
    sendImage,
    sendImageQuiet,
    startVoice,
    stopVoice,
  };
}

// ── Module-level helpers ──────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = (reader.result as string).split(",")[1];
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
