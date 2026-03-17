"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

// Energy threshold for barge-in detection while mic is muted during tutor speech.
// Echo from speakers typically has RMS 0.01–0.03; actual speech is 0.04+.
// Lower threshold = easier to interrupt (better UX for competition demo).
const BARGE_IN_RMS_THRESHOLD = 0.10;
// Require sustained loud audio for N consecutive frames to trigger barge-in
// (prevents one-off noise spikes from interrupting)
const BARGE_IN_FRAMES_REQUIRED = 3;

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
  const [speakingStartTime, setSpeakingStartTime] = useState(0);
  const [errorDetail, setErrorDetail]     = useState<string | null>(null);
  const [isInterrupted, setIsInterrupted] = useState(false);
  // Text message that should be spoken aloud (set when voice is active and
  // a text API response arrives — e.g. from voice_text follow-up questions)
  const [pendingSpeak, setPendingSpeak] = useState<string | null>(null);

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

  // Mic mute flag: set true while tutor is speaking to prevent echo loop.
  // While muted, audio is NOT sent to Gemini, but energy is still monitored
  // for barge-in detection (user speaking loudly over the tutor).
  const micMutedRef = useRef(false);
  const micMuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Count consecutive high-energy frames for barge-in detection
  const bargeInFrameCountRef = useRef(0);
  // When true, discard all incoming audio chunks (after interrupt, until backend
  // acknowledges via speaking_end or interrupted status). Without this, the backend
  // keeps sending audio chunks after interrupt which get played on the new AudioContext.
  const discardAudioRef = useRef(false);
  // Set true when speaking_end is received — prevents late WS audio chunks from
  // re-entering speaking state and overriding the mic unmute.
  const speakingEndReceivedRef = useRef(false);
  // Synchronous echo suppression flag — set true when tutor starts speaking,
  // cleared IMMEDIATELY (not via React state) on barge-in/interrupt/speaking_end.
  // This avoids the stale-ref problem where isSpeakingRef in page.tsx doesn't
  // update until React re-renders, causing Web Speech API transcripts to be dropped.
  const echoSuppressRef = useRef(false);

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

  // NOTE: Mic audio is MUTED to Gemini while tutor speaks to prevent echo.
  // Barge-in is preserved via energy-based detection: mic levels are monitored
  // even while muted, and when the user speaks loudly (RMS > threshold for
  // multiple frames), we trigger an interrupt: stop playback, unmute mic,
  // and let Gemini detect the user's speech naturally.

  // ── Transcript helper ──────────────────────────────────────────────────────

  const append = useCallback((entry: TranscriptEntry) => {
    log.transcript(`append role=${entry.role} text="${entry.text.slice(0, 60)}"`);
    setTranscript((prev) => [...prev, entry]);
  }, []);

  // ── Audio playback ─────────────────────────────────────────────────────────

  const scheduleAudioChunk = useCallback((pcmBytes: ArrayBuffer) => {
    // After interrupt, discard remaining audio chunks from the backend
    // until it acknowledges (speaking_end or interrupted status).
    if (discardAudioRef.current) return;

    const ctx = playbackCtxRef.current;
    if (!ctx) return;

    // Ensure playback context is running (Chrome auto-suspend protection)
    if (ctx.state === "suspended") ctx.resume();

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

    // ── Keep isSpeaking=true while audio is scheduled for playback ──
    // This ensures the interrupt button stays enabled the entire time
    // audio is actually playing through speakers.
    if (!usingWebRTCRef.current) {
      // Always set speaking true when we have audio scheduled
      setIsSpeaking(true);

      // Calculate when playback actually ends (from NOW, not from speaking_end)
      const remainingMs = Math.max(0, (nextPlayTimeRef.current - ctx.currentTime) * 1000);
      const delay = remainingMs + 400; // 400ms buffer for audio pipeline

      if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = setTimeout(() => {
        setIsSpeaking(false);
        setSpeakingStartTime(0);
        micMutedRef.current = false;
        bargeInFrameCountRef.current = 0;
        if (usingWebRTCRef.current) {
          webrtcRef.current.setMicEnabled(true);
        }
      }, delay);
    }
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
    if (micMuteTimerRef.current) {
      clearTimeout(micMuteTimerRef.current);
      micMuteTimerRef.current = null;
    }
    micMutedRef.current = false;
    discardAudioRef.current = false;
    speakingEndReceivedRef.current = false;
    echoSuppressRef.current = false;

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
          setSpeakingStartTime(Date.now());
          echoSuppressRef.current = true; // Suppress transcription during tutor speech
          // Reset flags — new speech turn, accept audio
          discardAudioRef.current = false;
          speakingEndReceivedRef.current = false;
          // Mute mic to Gemini to prevent echo (tutor audio → speaker → mic → Gemini)
          micMutedRef.current = true;
          bargeInFrameCountRef.current = 0;
          if (usingWebRTCRef.current) {
            webrtcRef.current.setMicEnabled(false);
          }
          if (speakingTimerRef.current) {
            clearTimeout(speakingTimerRef.current);
            speakingTimerRef.current = null;
          }
          // Create a new streaming tutor entry for the response
          const now = timestamp();
          setTranscript((prev) => [
            ...prev,
            { role: "tutor", text: "", timestamp: now, streaming: true },
          ]);
          return;
        }
        if (msg.type === "status" && msg.value === "speaking_end") {
          // Mark that speaking_end was received — prevents late WS audio
          // chunks from re-entering speaking state
          speakingEndReceivedRef.current = true;
          echoSuppressRef.current = false; // Allow transcription
          // Unmute mic IMMEDIATELY so user can speak right away.
          // Don't wait for the UI timer — mic access is critical.
          micMutedRef.current = false;
          bargeInFrameCountRef.current = 0;
          if (usingWebRTCRef.current) {
            webrtcRef.current.setMicEnabled(true);
          }
          discardAudioRef.current = false; // Accept audio for next turn

          // Calculate how long until all scheduled audio finishes playing.
          // The backend sends speaking_end when the LAST chunk is sent, but
          // the browser has scheduled those chunks for future playback.
          // Wait until playback actually finishes before clearing speaking state,
          // so the interrupt button stays enabled while audio is still audible.
          const playbackCtx = playbackCtxRef.current;
          const remainingMs = playbackCtx
            ? Math.max(0, (nextPlayTimeRef.current - playbackCtx.currentTime) * 1000)
            : 0;
          // Add a small buffer (300ms) to account for audio pipeline latency
          const delay = Math.max(
            usingWebRTCRef.current ? 300 : 600,
            remainingMs + 300
          );
          log.voice(`speaking_end: remaining playback ${remainingMs.toFixed(0)}ms, delay ${delay.toFixed(0)}ms`);

          if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
          speakingTimerRef.current = setTimeout(() => {
            setIsSpeaking(false);
            setSpeakingStartTime(0);
            // Safety: re-ensure mic is unmuted (in case late chunk re-muted)
            micMutedRef.current = false;
            bargeInFrameCountRef.current = 0;
            if (usingWebRTCRef.current) {
              webrtcRef.current.setMicEnabled(true);
            }
            // Mark the last streaming entry as done (safety net —
            // transcript_done should handle this, but finalize if it didn't)
            setTranscript((prev) => {
              const lastIdx = prev.length - 1;
              if (lastIdx >= 0 && prev[lastIdx].streaming) {
                const updated = [...prev];
                updated[lastIdx] = { ...updated[lastIdx], streaming: false };
                return updated;
              }
              return prev;
            });
          }, delay);
          return;
        }

        // ── Streaming transcript from Gemini audio transcription ─────────
        if (msg.type === "transcript_delta" && typeof msg.text === "string") {
          // Append text to the last tutor entry (streaming or recently finalized).
          // The speaking_end timer may finalize the entry before all deltas arrive,
          // so we also append to non-streaming tutor entries to avoid splitting
          // the transcript into multiple bubbles.
          setTranscript((prev) => {
            const lastIdx = prev.length - 1;
            if (lastIdx >= 0 && prev[lastIdx].role === "tutor") {
              const updated = [...prev];
              updated[lastIdx] = {
                ...updated[lastIdx],
                text: updated[lastIdx].text + msg.text,
                streaming: true, // Re-mark as streaming so it keeps accepting deltas
              };
              return updated;
            }
            // If no tutor entry exists at all, create one
            return [
              ...prev,
              { role: "tutor", text: msg.text as string, timestamp: timestamp(), streaming: true },
            ];
          });
          return;
        }

        if (msg.type === "transcript_done" && typeof msg.text === "string") {
          const finalText = (msg.text as string).trim();
          if (!finalText) return;
          // Finalize the streaming entry with the complete text
          setTranscript((prev) => {
            const lastIdx = prev.length - 1;
            // Case 1: streaming entry still active — update it
            if (lastIdx >= 0 && prev[lastIdx].role === "tutor" && prev[lastIdx].streaming) {
              const updated = [...prev];
              updated[lastIdx] = {
                ...updated[lastIdx],
                text: finalText,
                streaming: false,
              };
              return updated;
            }
            // Case 2: streaming entry was already finalized by speaking_end timer —
            // update the last tutor entry in-place instead of duplicating
            if (lastIdx >= 0 && prev[lastIdx].role === "tutor") {
              const updated = [...prev];
              updated[lastIdx] = {
                ...updated[lastIdx],
                text: finalText,
              };
              return updated;
            }
            // Case 3: no tutor entry found — append new (shouldn't normally happen)
            return [
              ...prev,
              { role: "tutor", text: finalText, timestamp: timestamp() },
            ];
          });
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
          // Queue text for browser TTS when voice is active (voice_text fallback)
          setPendingSpeak(msg.text);
        } else if (msg.type === "recap" && msg.data) {
          log.session("Recap received", msg.data);
          setIsThinking(false);
          const data    = msg.data as Record<string, unknown>;
          const summary = typeof data.summary === "string" ? data.summary : "Session complete.";
          append({ role: "tutor", text: `✓ ${summary}`, timestamp: timestamp() });
        } else if (msg.type === "status" && msg.value === "interrupted") {
          log.voice("Barge-in: tutor interrupted by student");
          discardAudioRef.current = false; // Backend acknowledged — accept audio again
          echoSuppressRef.current = false; // Allow transcription
          setIsSpeaking(false);
          setSpeakingStartTime(0);
          if (speakingTimerRef.current) {
            clearTimeout(speakingTimerRef.current);
            speakingTimerRef.current = null;
          }
          // Mark any streaming entry as done (keep text shown so far)
          setTranscript((prev) => {
            const lastIdx = prev.length - 1;
            if (lastIdx >= 0 && prev[lastIdx].streaming) {
              const updated = [...prev];
              if (updated[lastIdx].text.trim()) {
                updated[lastIdx] = { ...updated[lastIdx], streaming: false, text: updated[lastIdx].text.trim() + " ✋" };
              } else {
                // Remove empty streaming entry
                updated.splice(lastIdx, 1);
              }
              return updated;
            }
            return prev;
          });
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

      // ── Echo gate: don't send audio to Gemini while tutor is speaking ──
      // This prevents the tutor's voice (played through speakers) from being
      // picked up by the mic and sent back to Gemini (causing echo loops).
      // BUT we still monitor energy for barge-in detection below.
      if (micMutedRef.current) {
        // Calculate RMS energy to detect if user is actually speaking
        let sumSquares = 0;
        for (let i = 0; i < input.length; i++) {
          sumSquares += input[i] * input[i];
        }
        const rms = Math.sqrt(sumSquares / input.length);

        if (rms > BARGE_IN_RMS_THRESHOLD) {
          bargeInFrameCountRef.current++;
          if (bargeInFrameCountRef.current >= BARGE_IN_FRAMES_REQUIRED) {
            // User is speaking loudly over the tutor → trigger barge-in!
            log.voice(`Barge-in detected! RMS=${rms.toFixed(3)} frames=${bargeInFrameCountRef.current}`);
            discardAudioRef.current = true;
            micMutedRef.current = false;
            bargeInFrameCountRef.current = 0;
            // Stop tutor playback immediately
            _flushPlayback();
            // Clear speaking state immediately so Web Speech API transcription
            // is unblocked. Without this, isSpeakingRef stays true until the
            // backend sends "interrupted" status, blocking all transcription.
            echoSuppressRef.current = false; // Synchronous — unblocks transcription NOW
            setIsSpeaking(false);
            setSpeakingStartTime(0);
            setIsInterrupted(true);
            if (interruptedTimerRef.current) clearTimeout(interruptedTimerRef.current);
            interruptedTimerRef.current = setTimeout(() => setIsInterrupted(false), 900);
            if (speakingTimerRef.current) {
              clearTimeout(speakingTimerRef.current);
              speakingTimerRef.current = null;
            }
            // Safety timeout for discardAudioRef
            setTimeout(() => {
              if (discardAudioRef.current) {
                log.voice("Safety reset: clearing discardAudioRef after auto barge-in");
                discardAudioRef.current = false;
              }
            }, 3000);
            // Fall through to send this frame to Gemini
          } else {
            return; // Wait for more consecutive frames
          }
        } else {
          bargeInFrameCountRef.current = 0; // Reset counter if energy drops
          return; // Skip sending — just echo
        }
      }

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
    log.voice("Mic capture started — PCM chunks streaming over WS (echo-gated)");
  }

  /** Flush all scheduled playback audio (used to stop tutor mid-speech on barge-in). */
  function _flushPlayback() {
    const ctx = playbackCtxRef.current;
    if (ctx) {
      // Close and recreate playback context to kill all scheduled sources
      ctx.close().catch(() => {});
      const newCtx = new AudioContext({ sampleRate: OUT_SAMPLE_RATE });
      playbackCtxRef.current = newCtx;
      nextPlayTimeRef.current = newCtx.currentTime;
      log.voice("Playback flushed (barge-in)");
    }
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

  /** Manually trigger a barge-in (user taps interrupt button). */
  const triggerInterrupt = useCallback(() => {
    log.voice("Manual barge-in triggered by user");
    // Discard remaining audio chunks from the backend
    discardAudioRef.current = true;
    echoSuppressRef.current = false; // Synchronous — unblocks transcription NOW
    // Unmute mic so Gemini hears the user
    micMutedRef.current = false;
    bargeInFrameCountRef.current = 0;
    if (usingWebRTCRef.current) {
      webrtcRef.current.setMicEnabled(true);
    }
    // Stop playback immediately
    _flushPlayback();
    // Clear speaking state on our side (Gemini will send interrupted status)
    setIsSpeaking(false);
    setSpeakingStartTime(0);
    if (speakingTimerRef.current) {
      clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }
    // Mark streaming entry as interrupted
    setTranscript((prev) => {
      const lastIdx = prev.length - 1;
      if (lastIdx >= 0 && prev[lastIdx].streaming) {
        const updated = [...prev];
        if (updated[lastIdx].text.trim()) {
          updated[lastIdx] = { ...updated[lastIdx], streaming: false, text: updated[lastIdx].text.trim() + " ✋" };
        } else {
          updated.splice(lastIdx, 1);
        }
        return updated;
      }
      return prev;
    });
    setIsInterrupted(true);
    if (interruptedTimerRef.current) clearTimeout(interruptedTimerRef.current);
    interruptedTimerRef.current = setTimeout(() => setIsInterrupted(false), 900);

    // Notify backend so it can handle the interruption on the Gemini Live session
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "interrupt" }));
    }

    // Safety timeout: reset discardAudioRef even if backend never acknowledges.
    // Without this, discardAudioRef stays true forever and blocks all future audio.
    setTimeout(() => {
      if (discardAudioRef.current) {
        log.voice("Safety reset: clearing discardAudioRef after interrupt timeout");
        discardAudioRef.current = false;
      }
    }, 3000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking]);

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

  /** Send text into the active Gemini Live session (not the standard text API).
   *  Used when voice is active so the question reaches Gemini via its Live session,
   *  avoiding duplicate responses from the text API while ensuring the message is heard. */
  const sendVoiceText = useCallback(
    (text: string, mode: TutorMode = "explain") => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        log.error("sendVoiceText called but WS not open");
        return;
      }

      log.ws("sendVoiceText (Live session text injection)", { text: text.slice(0, 80), mode });
      ws.send(JSON.stringify({ type: "voice_text", text, mode }));
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
    /** Timestamp (Date.now()) when the tutor started speaking — used for word highlighting */
    speakingStartTime,
    liveState,
    voiceActive,
    errorDetail,
    transcript,
    setTranscript,
    startSession,
    stopSession,
    sendText,
    sendTextQuiet,
    sendVoiceText,
    sendImage,
    sendImageQuiet,
    /** Text message queued for browser TTS (voice_text fallback) */
    pendingSpeak,
    setPendingSpeak,
    startVoice,
    stopVoice,
    /** Manually trigger barge-in (stop tutor + unmute mic) */
    triggerInterrupt,
    /** Whether audio is flowing via WebRTC (vs WebSocket binary fallback) */
    usingWebRTC: webrtc.isRTCConnected,
    /** Synchronous echo suppression ref — true while tutor is speaking, cleared instantly on barge-in */
    echoSuppressRef,
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
