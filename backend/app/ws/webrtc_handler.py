"""
WebRTC audio handler using aiortc.

Provides WebRTC-based audio transport as an alternative to raw WebSocket
binary PCM streaming.  Uses RTCPeerConnection for browser <-> backend audio,
with the existing WebSocket serving as the signaling channel.

Audio routing:
  Browser mic -> WebRTC -> aiortc decode (48 kHz) -> resample 16 kHz -> Gemini Live API
  Gemini Live API -> 24 kHz PCM -> resample 48 kHz -> aiortc encode -> WebRTC -> Browser speaker
"""

import asyncio
import fractions
import logging

import numpy as np
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.mediastreams import MediaStreamTrack, MediaStreamError
from av import AudioFrame

from app.config import get_settings

logger = logging.getLogger(__name__)

_LOG = "[SolveWave][webrtc]"

# Audio rate constants
WEBRTC_RATE = 48000       # WebRTC / Opus standard
GEMINI_IN_RATE = 16000    # Gemini Live input
GEMINI_OUT_RATE = 24000   # Gemini Live output
FRAME_SAMPLES = 960       # 20 ms @ 48 kHz


# ── Helpers ──────────────────────────────────────────────────────────────────

def _resample(pcm: np.ndarray, from_rate: int, to_rate: int) -> np.ndarray:
    """Linear-interpolation resampler for int16 PCM."""
    if from_rate == to_rate:
        return pcm
    ratio = from_rate / to_rate
    out_len = int(len(pcm) / ratio)
    if out_len == 0:
        return np.array([], dtype=np.int16)
    indices = np.arange(out_len) * ratio
    idx = np.clip(indices.astype(int), 0, len(pcm) - 2)
    frac = indices - idx
    return ((1 - frac) * pcm[idx] + frac * pcm[idx + 1]).astype(np.int16)


# ── Custom output track (Gemini -> browser) ──────────────────────────────────

class GeminiOutputTrack(MediaStreamTrack):
    """Audio track that streams Gemini's response audio to the browser."""

    kind = "audio"

    def __init__(self) -> None:
        super().__init__()
        self._queue: asyncio.Queue[np.ndarray] = asyncio.Queue(maxsize=500)
        self._pts = 0

    def enqueue_pcm(self, pcm_bytes: bytes) -> None:
        """Buffer Gemini 24 kHz PCM for WebRTC delivery at 48 kHz."""
        pcm_24k = np.frombuffer(pcm_bytes, dtype=np.int16).copy()
        pcm_48k = _resample(pcm_24k, GEMINI_OUT_RATE, WEBRTC_RATE)

        # Split into 20 ms frames
        for i in range(0, len(pcm_48k), FRAME_SAMPLES):
            chunk = pcm_48k[i : i + FRAME_SAMPLES]
            if len(chunk) < FRAME_SAMPLES:
                chunk = np.pad(chunk, (0, FRAME_SAMPLES - len(chunk)))
            try:
                self._queue.put_nowait(chunk)
            except asyncio.QueueFull:
                pass  # drop if buffer overflows (rare)

    async def recv(self) -> AudioFrame:
        """Called by aiortc at ~50 Hz to pull the next audio frame."""
        try:
            pcm = self._queue.get_nowait()
        except asyncio.QueueEmpty:
            pcm = np.zeros(FRAME_SAMPLES, dtype=np.int16)

        frame = AudioFrame(format="s16", layout="mono", samples=FRAME_SAMPLES)
        frame.sample_rate = WEBRTC_RATE
        frame.pts = self._pts
        frame.time_base = fractions.Fraction(1, WEBRTC_RATE)
        frame.planes[0].update(pcm.tobytes())
        self._pts += FRAME_SAMPLES
        return frame


# ── WebRTC handler ───────────────────────────────────────────────────────────

class WebRTCHandler:
    """
    Manages a single WebRTC peer connection for bidirectional audio transport.

    Audio from the browser is decoded by aiortc, resampled to 16 kHz, and
    placed into the shared *audio_queue* (same queue used by WebSocket binary
    fallback).  Audio from Gemini is fed into a custom output track that
    resamples to 48 kHz and sends via WebRTC.

    Signaling (SDP offer/answer) flows over the existing WebSocket.
    """

    def __init__(self, audio_queue: asyncio.Queue, on_ice_failed=None) -> None:
        settings = get_settings()

        # Build ICE server list
        ice_servers: list[dict] = []
        if settings.stun_urls:
            ice_servers.append({"urls": settings.stun_urls})
        if settings.turn_url:
            ice_servers.append({
                "urls": [settings.turn_url],
                "username": settings.turn_username or "",
                "credential": settings.turn_credential or "",
            })

        # Create peer connection
        from aiortc import RTCConfiguration, RTCIceServer

        rtc_ice = [
            RTCIceServer(
                urls=s["urls"] if isinstance(s["urls"], list) else [s["urls"]],
                username=s.get("username"),
                credential=s.get("credential"),
            )
            for s in ice_servers
        ]
        config = RTCConfiguration(iceServers=rtc_ice) if rtc_ice else None
        self._pc = RTCPeerConnection(configuration=config)

        self._output_track = GeminiOutputTrack()
        self._audio_queue = audio_queue
        self._connected = asyncio.Event()
        self._consumer_task: asyncio.Task | None = None
        self._on_ice_failed = on_ice_failed

        # Add output track so the browser can receive Gemini audio
        self._pc.addTrack(self._output_track)

        # Event handlers
        @self._pc.on("track")
        def on_track(track: MediaStreamTrack) -> None:
            if track.kind == "audio":
                logger.info("%s Remote audio track received", _LOG)
                self._consumer_task = asyncio.ensure_future(
                    self._consume_audio(track)
                )

        @self._pc.on("connectionstatechange")
        async def on_state_change() -> None:
            state = self._pc.connectionState
            logger.info("%s Connection state: %s", _LOG, state)
            if state == "connected":
                self._connected.set()
            elif state in ("failed", "closed", "disconnected"):
                self._connected.clear()
                if state == "failed" and self._on_ice_failed:
                    logger.info("%s ICE failed — notifying session to fall back to WS", _LOG)
                    self._on_ice_failed()

    # ── Signaling ────────────────────────────────────────────────────────────

    async def handle_offer(self, sdp: str) -> dict:
        """Process browser SDP offer, return answer with gathered ICE candidates."""
        offer = RTCSessionDescription(sdp=sdp, type="offer")
        await self._pc.setRemoteDescription(offer)

        answer = await self._pc.createAnswer()
        await self._pc.setLocalDescription(answer)

        # Wait for ICE gathering to finish so answer contains all candidates
        if self._pc.iceGatheringState != "complete":
            gathering_done = asyncio.Event()

            @self._pc.on("icegatheringstatechange")
            def _on_ice_state() -> None:
                if self._pc.iceGatheringState == "complete":
                    gathering_done.set()

            await asyncio.wait_for(gathering_done.wait(), timeout=10.0)

        logger.info("%s SDP answer ready", _LOG)
        return {
            "sdp": self._pc.localDescription.sdp,
            "type": self._pc.localDescription.type,
        }

    # ── Audio I/O ────────────────────────────────────────────────────────────

    async def _consume_audio(self, track: MediaStreamTrack) -> None:
        """Drain incoming WebRTC audio -> resample to 16 kHz -> shared queue."""
        chunks = 0
        try:
            while True:
                frame: AudioFrame = await track.recv()
                pcm_48k = np.frombuffer(bytes(frame.planes[0]), dtype=np.int16)
                pcm_16k = _resample(pcm_48k, frame.sample_rate, GEMINI_IN_RATE)
                await self._audio_queue.put(pcm_16k.tobytes())
                chunks += 1
                if chunks == 1:
                    logger.info("%s First audio frame consumed", _LOG)
                elif chunks % 250 == 0:
                    logger.debug("%s Audio frames consumed: %d", _LOG, chunks)
        except MediaStreamError:
            logger.info("%s Remote audio track ended", _LOG)
            await self._audio_queue.put(None)
        except Exception as exc:
            logger.error("%s Audio consumer error: %s", _LOG, exc)
            await self._audio_queue.put(None)

    def send_audio(self, pcm_bytes: bytes) -> None:
        """Feed Gemini response audio (24 kHz PCM) into the output track."""
        self._output_track.enqueue_pcm(pcm_bytes)

    # ── State ────────────────────────────────────────────────────────────────

    @property
    def is_connected(self) -> bool:
        return self._pc.connectionState == "connected"

    async def wait_connected(self, timeout: float = 15.0) -> bool:
        """Wait until WebRTC is connected. Returns False on timeout."""
        try:
            await asyncio.wait_for(self._connected.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False

    # ── Cleanup ──────────────────────────────────────────────────────────────

    async def close(self) -> None:
        if self._consumer_task and not self._consumer_task.done():
            self._consumer_task.cancel()
            try:
                await self._consumer_task
            except asyncio.CancelledError:
                pass
        await self._pc.close()
        logger.info("%s Peer connection closed", _LOG)
