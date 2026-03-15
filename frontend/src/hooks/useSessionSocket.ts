"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { TranscriptEntry } from "@/components/TranscriptPanel";
import type { TutorMode } from "@/components/ModeSelector";
import { log } from "@/lib/log";
import { useWebRTC } from "./useWebRTC";

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/session";

// Derive the HTTP health URL from the WS URL for cold-start warm-up
const HEALTH_URL = WS_URL.replace(/^ws(s)?:\/\//, "http$1://").replace(/\/ws\/session$/, "/health");

// ── Voice audio constants ─────────────────────────────────────────────────────
const MIC_SAMPLE_RATE  = 16000;  // Gemini input: 16 kHz
const OUT_SAMPLE_RATE  = 24000;  // Gemini output: 24 kHz

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
  const [errorDetail, setErrorDetail]     = useState<string | null>(null);
  const [isInterrupted, setIsInterrupted] = useState(false);

  // WebSocket
  const wsRef = useRef<WebSocket | null>(null);

  // WebRTC audio transport (preferred over WS binary)
  const webrtc = useWebRTC();
  const webrtcRef = useRef(webrtc);
  webrtcRef.current = webrtc;
  // Track whether WebRTC is being used for this session
  const usingWebRTCRef = useRef(false);

  // Voice / audio refs (used only in WS binary fallback mode)
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

    // Ensure playback context is running (Chrome auto-suspend protection)
    if (ctx.state === "suspended") ctx.resume();

    // In WS fallback mode, also use chunk arrival as a speaking signal
    // (speaking_start/speaking_end control frames are the primary mechanism,
    // but this provides a safety net for WS-only mode)
    if (!usingWebRTCRef.current) {
      setIsSpeaking(true);
      if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = setTimeout(() => {
        setIsSpeaking(false);
      }, 600);
    }

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
    // Clean up WS fallback audio resources
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
    setErrorDetail(null);
    log.state("idle → connecting");

    // Fire-and-forget warm-up: hit the HTTP health endpoint to wake Cloud Run
    // before opening the WebSocket. This prevents cold-start timeouts on mobile.
    fetch(HEALTH_URL, { mode: "cors" })
      .then((r) => log.ws(`Warm-up response: ${r.status}`))
      .catch((e) => log.ws(`Warm-up failed: ${e}`));
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
        // Binary frame = PCM audio from Gemini Live (WS fallback only)
        if (typeof event.data !== "string") {
          if (!usingWebRTCRef.current) {
            const size = (event.data as ArrayBuffer).byteLength;
            log.voice(`Audio chunk received from backend: ${size} bytes, playbackCtx=${playbackCtxRef.current?.state}`);
            scheduleAudioChunk(event.data as ArrayBuffer);
          }
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

        // ── WebRTC signaling ────────────────────────────────────────────
        if (msg.type === "rtc_answer" && typeof msg.sdp === "string") {
          log.voice("[WebRTC] Received SDP answer from server");
          webrtcRef.current.handleAnswer(msg.sdp as string);
          return;
        }
        if (msg.type === "rtc_error") {
          log.voice("[WebRTC] Server-side error, falling back to WS audio");
          usingWebRTCRef.current = false;
          return;
        }

        // ── Speaking state (used by both WebRTC and WS modes) ───────────
        if (msg.type === "status" && msg.value === "speaking_start") {
          setIsSpeaking(true);
          if (speakingTimerRef.current) {
            clearTimeout(speakingTimerRef.current);
            speakingTimerRef.current = null;
          }
          return;
        }
        if (msg.type === "status" && msg.value === "speaking_end") {
          // Small delay before clearing speaking state (audio still draining)
          if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
          speakingTimerRef.current = setTimeout(() => {
            setIsSpeaking(false);
          }, usingWebRTCRef.current ? 300 : 600);
          return;
        }

        // ── Session status ──────────────────────────────────────────────
        if (msg.type === "status" && msg.value === "connected") {
          log.session("Connected", { session_id: msg.session_id });
          setStatus("connected");
          log.state("connecting → connected");
          append({
            role: "tutor",
            text: "Hi! I'm your live math tutor — what problem are we solving today?",
            timestamp: timestamp(),
          });

          // Attempt WebRTC upgrade for audio transport
          const iceServers = (msg.ice_servers as RTCIceServer[] | undefined) ?? [];
          webrtcRef.current
            .negotiate(ws, iceServers)
            .then((ok) => {
              usingWebRTCRef.current = ok;
              log.voice(
                ok
                  ? "[WebRTC] Audio transport active"
                  : "[WebRTC] Falling back to WebSocket audio"
              );
            })
            .catch(() => {
              usingWebRTCRef.current = false;
              log.voice("[WebRTC] Negotiation failed — using WS audio");
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
          setErrorDetail(`Server: ${msg.value}`);
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
          // Clean up WebRTC
          if (usingWebRTCRef.current) {
            webrtcRef.current.close();
            usingWebRTCRef.current = false;
          }
          setStatus("idle");
          setIsThinking(false);
          wsRef.current = null;
          log.state("→ idle (ws closed)");
        }
      };

      ws.onerror = () => {
        const detail = `WS error → ${WS_URL} (attempt ${retryCountRef.current + 1}/${MAX_RETRIES + 1})`;
        log.error(detail);
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
          const finalDetail = `Connection failed after ${MAX_RETRIES + 1} attempts.\nURL: ${WS_URL}\nHealth: ${HEALTH_URL}`;
          log.state("→ error (ws error after retries)");
          stopVoiceCleanup();
          setStatus("error");
          setErrorDetail(finalDetail);
          setIsThinking(false);
          retryCountRef.current = 0;
        }
      };
    };

    connectWs();
  }, [append, scheduleAudioChunk, stopVoiceCleanup]);

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const stopSession = useCallback(() => {
    log.session("Stopping session");
    stopVoiceCleanup();

    // Close WebRTC if active
    if (usingWebRTCRef.current) {
      webrtcRef.current.close();
      usingWebRTCRef.current = false;
    }

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

    const inputRate = ctx.sampleRate;
    const ratio     = inputRate / MIC_SAMPLE_RATE;
    log.voice(`Mic: ${inputRate}Hz → ${MIC_SAMPLE_RATE}Hz (ratio ${ratio.toFixed(2)})`);

    processor.onaudioprocess = (event) => {
      if (ws.readyState !== WebSocket.OPEN) return;

      const input = event.inputBuffer.getChannelData(0);

      // Resample from native rate to 16 kHz + convert to Int16 PCM
      const outLen = Math.round(input.length / ratio);
      const int16  = new Int16Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const srcIdx = i * ratio;
        const floor  = Math.floor(srcIdx);
        const frac   = srcIdx - floor;
        const s0     = input[floor] || 0;
        const s1     = input[Math.min(floor + 1, input.length - 1)] || 0;
        const val    = Math.max(-1, Math.min(1, s0 + frac * (s1 - s0)));
        int16[i]     = val * 32767;
      }

      ws.send(int16.buffer);
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

    // ── WebRTC mode: just unmute the track ────────────────────────────────
    if (usingWebRTCRef.current) {
      log.voice("startVoice: enabling WebRTC mic track");
      webrtcRef.current.setMicEnabled(true);
      setVoiceActive(true);
      log.state("connected → listening (WebRTC)");
      return;
    }

    // ── WS fallback mode: capture + resample + stream over WS ─────────────
    if (mediaStreamRef.current) {
      log.voice("startVoice: already capturing — ignoring");
      return;
    }

    log.voice("Requesting mic permission (WS fallback)");
    try {
      const stream         = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
      log.voice("Mic permission granted");

      const captureCtx     = new AudioContext();  // native rate; resampled in capture
      audioCtxRef.current  = captureCtx;

      const playbackCtx       = new AudioContext({ sampleRate: OUT_SAMPLE_RATE });
      playbackCtxRef.current  = playbackCtx;
      nextPlayTimeRef.current = playbackCtx.currentTime;

      // Chrome suspends AudioContext until user gesture — resume explicitly
      if (captureCtx.state === "suspended") await captureCtx.resume();
      if (playbackCtx.state === "suspended") await playbackCtx.resume();
      log.voice(`AudioContext states: capture=${captureCtx.state}, playback=${playbackCtx.state}`);

      startMicCapture(captureCtx, stream, ws);
      setVoiceActive(true);
      log.state("connected → listening (WS fallback)");
    } catch (err) {
      log.error("Mic permission denied or AudioContext failed", err);
    }
  // startMicCapture is a plain function — no dep needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopVoice = useCallback(() => {
    log.voice("stopVoice called by user");

    // WebRTC mode: mute the track (don't tear down)
    if (usingWebRTCRef.current) {
      webrtcRef.current.setMicEnabled(false);
      setVoiceActive(false);
      log.state("listening → connected (WebRTC mic muted)");
      return;
    }

    // WS fallback: full cleanup
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
    errorDetail,
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
    /** Whether audio is flowing via WebRTC (vs WebSocket binary fallback) */
    usingWebRTC: webrtc.isRTCConnected,
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
