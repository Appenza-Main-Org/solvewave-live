"use client";

/**
 * useWebRTC — manages a WebRTC peer connection for audio transport.
 *
 * Negotiates with the backend via the existing WebSocket (signaling channel).
 * Captures browser audio with echo cancellation / noise suppression / AGC
 * and streams it via WebRTC to the backend, which bridges it to Gemini Live.
 *
 * Gemini's response audio is received as a remote WebRTC audio track and
 * played automatically through the browser's audio output.
 *
 * Falls back gracefully: if WebRTC negotiation fails, the caller can
 * continue using WebSocket binary audio instead.
 */

import { useCallback, useRef, useState } from "react";
import { log } from "@/lib/log";

export type WebRTCState = "idle" | "negotiating" | "connected" | "failed";

interface UseWebRTCReturn {
  /** Current WebRTC connection state */
  rtcState: WebRTCState;
  /** True when WebRTC audio transport is active */
  isRTCConnected: boolean;
  /** Initiate WebRTC negotiation over the given WebSocket */
  negotiate: (ws: WebSocket, iceServers?: RTCIceServer[]) => Promise<boolean>;
  /** Handle an SDP answer from the server */
  handleAnswer: (sdp: string) => void;
  /** Enable or disable the local microphone track */
  setMicEnabled: (enabled: boolean) => void;
  /** Tear down the peer connection and release media */
  close: () => void;
}

// Default STUN servers (overridden by server-sent ice_servers)
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function useWebRTC(): UseWebRTCReturn {
  const [rtcState, setRtcState] = useState<WebRTCState>("idle");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // ── Negotiate ────────────────────────────────────────────────────────────

  const negotiate = useCallback(
    async (ws: WebSocket, iceServers?: RTCIceServer[]): Promise<boolean> => {
      if (pcRef.current) {
        log.voice("[WebRTC] Already negotiated — skipping");
        return rtcState === "connected";
      }

      try {
        setRtcState("negotiating");
        log.voice("[WebRTC] Starting negotiation");

        // 1. Get mic with WebRTC-grade audio processing
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;
        log.voice("[WebRTC] Mic permission granted (AEC/NS/AGC enabled)");

        // 2. Create peer connection
        const servers = iceServers?.length ? iceServers : DEFAULT_ICE_SERVERS;
        const pc = new RTCPeerConnection({ iceServers: servers });
        pcRef.current = pc;

        // 3. Add local audio track (starts muted — caller enables via setMicEnabled)
        stream.getAudioTracks().forEach((track) => {
          track.enabled = false; // muted until voice is activated
          pc.addTrack(track, stream);
        });

        // 4. Handle remote audio track (Gemini response)
        pc.ontrack = (event) => {
          log.voice("[WebRTC] Remote audio track received");
          const audio = document.createElement("audio");
          audio.srcObject = event.streams[0];
          audio.autoplay = true;
          audioElRef.current = audio;
        };

        // 5. Connection state monitoring
        const connected = new Promise<boolean>((resolve) => {
          pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            log.voice(`[WebRTC] Connection state: ${state}`);
            if (state === "connected") {
              setRtcState("connected");
              resolve(true);
            } else if (state === "failed") {
              setRtcState("failed");
              resolve(false);
            }
          };
        });

        // 6. Create SDP offer and wait for ICE gathering
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          } else {
            const handler = () => {
              if (pc.iceGatheringState === "complete") {
                pc.removeEventListener("icegatheringstatechange", handler);
                resolve();
              }
            };
            pc.addEventListener("icegatheringstatechange", handler);
          }
        });

        // 7. Send offer via WebSocket
        ws.send(
          JSON.stringify({
            type: "rtc_offer",
            sdp: pc.localDescription!.sdp,
          })
        );
        log.voice("[WebRTC] SDP offer sent, waiting for answer + connection");

        // 8. Wait for connection (answer is applied via handleAnswer)
        const timeout = new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), 15_000)
        );
        const result = await Promise.race([connected, timeout]);

        if (!result) {
          log.voice("[WebRTC] Connection timed out or failed — falling back to WS");
          setRtcState("failed");
          return false;
        }

        log.voice("[WebRTC] Audio transport active");
        return true;
      } catch (err) {
        log.error("[WebRTC] Negotiation error", err);
        setRtcState("failed");
        return false;
      }
    },
    [rtcState]
  );

  // ── Handle SDP answer from server ─────────────────────────────────────────

  const handleAnswer = useCallback((sdp: string) => {
    const pc = pcRef.current;
    if (!pc) {
      log.voice("[WebRTC] handleAnswer: no peer connection");
      return;
    }
    const answer = new RTCSessionDescription({ type: "answer", sdp });
    pc.setRemoteDescription(answer)
      .then(() => log.voice("[WebRTC] SDP answer applied"))
      .catch((err: unknown) => log.error("[WebRTC] Failed to apply answer", err));
  }, []);

  // ── Mic mute/unmute ───────────────────────────────────────────────────────

  const setMicEnabled = useCallback((enabled: boolean) => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    log.voice(`[WebRTC] Mic ${enabled ? "enabled" : "muted"}`);
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  const close = useCallback(() => {
    // Stop local media tracks
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    // Stop remote audio
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    setRtcState("idle");
    log.voice("[WebRTC] Cleaned up");
  }, []);

  return {
    rtcState,
    isRTCConnected: rtcState === "connected",
    negotiate,
    handleAnswer,
    setMicEnabled,
    close,
  };
}
