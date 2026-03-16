"""
session_manager — WebSocket session lifecycle for SolveWave.

Responsibilities:
- Accept and authenticate the WebSocket connection
- Create a SessionConfig (with unique session_id)
- Wire the audio queue between the browser receive-loop and LiveClient
- Negotiate WebRTC audio transport (falls back to WebSocket binary if unavailable)
- Send status / recap JSON frames at session open and close
- Clean up on disconnect

WebSocket message protocol:
  Browser → Server:
    binary frame                                                        : raw PCM audio (16 kHz, 16-bit, mono) [fallback only]
    text  "END"                                                         : graceful stop signal
    text  {"type":"text","text":"...","mode":"explain|quiz|homework"}   : student text message
    text  {"type":"image","mimeType":"...","data":"...","caption":"...","mode":"..."} : base64 image
    text  {"type":"rtc_offer","sdp":"..."}                              : WebRTC SDP offer
    text  {"type":"rtc_ice","candidate":{...}}                          : WebRTC ICE candidate (trickle)

  Server → Browser:
    {"type": "status",  "value": "connected", "session_id": "..."}   on open
    {"type": "rtc_answer", "sdp": "...", "type": "answer"}           WebRTC SDP answer
    {"type": "rtc_ice_servers", "servers": [...]}                    ICE server config
    {"type": "message", "role": "tutor",      "text": "..."}         text reply
    binary frame                                                       audio response [fallback only]
    {"type": "recap",   "data": {...}}                                 on close
    {"type": "error",   "value": "..."}                               on failure
"""

import asyncio
import json
import logging
import time
import traceback

from fastapi import WebSocket, WebSocketDisconnect

from app.agents.tutor_agent import TutorAgent
from app.config import get_settings
from app.models.schemas import SessionConfig
from app.services.live_client import LiveClient
from app.ws.webrtc_handler import WebRTCHandler

logger = logging.getLogger(__name__)

_LOG = "[SolveWave][backend]"

# Mode-specific addenda appended to the system prompt per request.
# Keeps the base system_prompt.md clean and allows runtime mode switching.
_MODE_ADDENDUM: dict[str, str] = {
    "explain": (
        "\n\n[Mode: Explain — break down the math concept step by step with a worked example. "
        "Number each step. Keep it concise: one concept at a time, under 5 lines unless a "
        "worked solution requires more. Use plain language for the reasoning.]"
    ),
    "quiz": (
        "\n\n[Mode: Quiz — ask ONE focused math question appropriate to the topic discussed. "
        "Wait for the student's answer before continuing. Give targeted feedback: "
        "confirm correct steps, pinpoint the exact error if wrong. "
        "Use check_answer and generate_next_hint tools. Keep the pace brisk.]"
    ),
    "homework": (
        "\n\n[Mode: Homework — the student needs help solving their actual math problem. "
        "Show all steps clearly with numbered work. Explain the reasoning at each step. "
        "If they give a partial attempt, identify where it diverged. "
        "Use hints to guide, but do not withhold the solution if the student is stuck. "
        "Treat every image as a math problem unless clearly otherwise.]"
    ),
}


async def handle_session(websocket: WebSocket) -> None:
    """
    Entry point called by the FastAPI WebSocket route.
    Manages the full lifecycle of one tutoring session.
    """
    await websocket.accept()

    config = SessionConfig()
    session_start_time = time.time()
    logger.info("%s[session] created session_id=%s", _LOG, config.session_id)

    # Build ICE server list for the browser
    settings = get_settings()
    ice_servers: list[dict] = []
    if settings.stun_urls:
        ice_servers.append({"urls": settings.stun_urls})
    if settings.turn_url:
        ice_servers.append({
            "urls": [settings.turn_url],
            "username": settings.turn_username or "",
            "credential": settings.turn_credential or "",
        })

    await websocket.send_json(
        {
            "type": "status",
            "value": "connected",
            "session_id": config.session_id,
            "ice_servers": ice_servers,
        }
    )

    # Audio queue: receive_loop puts chunks here; LiveClient drains it
    audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue()

    # Text queue: voice_text messages are injected into the Gemini Live session
    # (used when Web Speech API captures the student's speech as text)
    voice_text_queue: asyncio.Queue[str | None] = asyncio.Queue()

    agent = TutorAgent()
    client = LiveClient(agent=agent)

    # Conversation history for multi-turn text context
    # Format: [{"role": "user"|"model", "text": "..."}]
    chat_history: list[dict] = []

    # WebRTC state — set when browser sends rtc_offer
    webrtc_handler: WebRTCHandler | None = None
    use_webrtc = False

    # ── Callables passed to LiveClient ─────────────────────────────────────────

    async def receive_audio() -> bytes | None:
        return await audio_queue.get()

    async def send_audio(audio_bytes: bytes) -> None:
        """Route audio to WebRTC track or WebSocket binary depending on mode."""
        try:
            if use_webrtc and webrtc_handler:
                webrtc_handler.send_audio(audio_bytes)
            else:
                await websocket.send_bytes(audio_bytes)
        except Exception as exc:
            logger.warning(
                "%s[audio] send failed session=%s: %s", _LOG, config.session_id, exc
            )

    async def send_control(frame: dict) -> None:
        """Push a JSON control frame (e.g. interruption) to the browser."""
        try:
            await websocket.send_json(frame)
        except Exception as exc:
            logger.warning(
                "%s[control] send failed session=%s: %s", _LOG, config.session_id, exc
            )

    # ── Browser receive loop ────────────────────────────────────────────────────

    async def handle_text_message(raw: str) -> None:
        """Handle a non-END text frame from the browser."""
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("%s[ws] non-JSON text frame ignored", _LOG)
            return

        msg_type = data.get("type")
        mode = str(data.get("mode", "explain"))
        effective_prompt = agent.system_prompt + _MODE_ADDENDUM.get(mode, "")

        # ── Voice text path (inject into Live session) ────────────────────────
        if msg_type == "voice_text":
            student_text = str(data.get("text", ""))
            logger.info(
                "%s[route] voice_text path | session=%s text=%r",
                _LOG, config.session_id, student_text[:120],
            )
            await voice_text_queue.put(student_text)
            return

        # ── Text path ──────────────────────────────────────────────────────────
        if msg_type == "text":
            student_text = str(data.get("text", ""))
            logger.info(
                "%s[route] text path | session=%s mode=%s text=%r",
                _LOG, config.session_id, mode, student_text[:120],
            )

            logger.info("%s[text] calling Gemini text API...", _LOG)
            reply = await client.generate_text_reply(
                user_text=student_text,
                system_prompt=effective_prompt,
                history=chat_history,
            )
            logger.info(
                "%s[text] Gemini replied | reply_len=%d", _LOG, len(reply)
            )

            chat_history.append({"role": "user", "text": student_text})
            chat_history.append({"role": "model", "text": reply})

            await websocket.send_json(
                {"type": "message", "role": "tutor", "text": reply}
            )

        # ── Image path ─────────────────────────────────────────────────────────
        elif msg_type == "image":
            mime = str(data.get("mimeType", "image/*"))
            caption = str(data.get("caption", "")).strip()
            image_b64 = str(data.get("data", ""))

            logger.info(
                "%s[route] image path | session=%s mode=%s mime=%s caption=%r b64_len=%d",
                _LOG, config.session_id, mode, mime, caption, len(image_b64),
            )

            if not image_b64:
                logger.warning("%s[image] empty base64 payload — skipping", _LOG)
                await websocket.send_json(
                    {"type": "message", "role": "tutor",
                     "text": "I didn't receive an image. Please try uploading again."}
                )
                return

            logger.info("%s[image] calling Gemini multimodal API...", _LOG)
            reply = await client.generate_image_reply(
                image_b64=image_b64,
                mime_type=mime,
                caption=caption,
                system_prompt=effective_prompt,
                history=chat_history,
            )
            logger.info(
                "%s[image] Gemini replied | reply_len=%d", _LOG, len(reply)
            )

            history_text = f"[Image sent] {caption}" if caption else "[Image sent]"
            chat_history.append({"role": "user", "text": history_text})
            chat_history.append({"role": "model", "text": reply})

            await websocket.send_json(
                {"type": "message", "role": "tutor", "text": reply}
            )

        else:
            logger.warning(
                "%s[ws] unknown message type=%r — ignored", _LOG, msg_type
            )

    async def handle_rtc_signaling(data: dict) -> None:
        """Process WebRTC signaling messages (offer / ICE candidates)."""
        nonlocal webrtc_handler, use_webrtc

        msg_type = data.get("type")

        if msg_type == "rtc_offer":
            logger.info(
                "%s[rtc] SDP offer received | session=%s", _LOG, config.session_id
            )
            try:
                def _on_ice_failed():
                    nonlocal use_webrtc
                    logger.info(
                        "%s[rtc] ICE failed — falling back to WS audio | session=%s",
                        _LOG, config.session_id,
                    )
                    use_webrtc = False

                def _on_ice_connected():
                    nonlocal use_webrtc
                    logger.info(
                        "%s[rtc] ICE connected — WebRTC audio now active | session=%s",
                        _LOG, config.session_id,
                    )
                    use_webrtc = True

                webrtc_handler = WebRTCHandler(
                    audio_queue=audio_queue,
                    on_ice_failed=_on_ice_failed,
                    on_ice_connected=_on_ice_connected,
                )
                answer = await webrtc_handler.handle_offer(data["sdp"])
                await websocket.send_json({"type": "rtc_answer", **answer})
                # NOTE: use_webrtc stays False until ICE actually connects
                # (on_ice_connected callback). This prevents sending audio to
                # a dead WebRTC track on Cloud Run where ICE always fails.
                logger.info(
                    "%s[rtc] SDP answer sent, waiting for ICE to connect | session=%s",
                    _LOG, config.session_id,
                )
            except Exception as exc:
                logger.error(
                    "%s[rtc] WebRTC negotiation failed: %s | session=%s",
                    _LOG, exc, config.session_id,
                )
                webrtc_handler = None
                use_webrtc = False
                await websocket.send_json({
                    "type": "rtc_error",
                    "value": "WebRTC negotiation failed, using WebSocket audio",
                })

    async def receive_loop() -> None:
        nonlocal use_webrtc
        audio_chunks_received = 0
        try:
            while True:
                message = await websocket.receive()
                if "bytes" in message and message["bytes"]:
                    # Only process WS binary audio when NOT using WebRTC
                    if not use_webrtc:
                        audio_chunks_received += 1
                        if audio_chunks_received == 1:
                            logger.info(
                                "%s[voice] first PCM chunk received (WS fallback) | session=%s",
                                _LOG, config.session_id,
                            )
                        elif audio_chunks_received % 50 == 0:
                            logger.debug(
                                "%s[voice] PCM chunks received so far: %d | session=%s",
                                _LOG, audio_chunks_received, config.session_id,
                            )
                        await audio_queue.put(message["bytes"])
                elif "text" in message:
                    if message["text"] == "END":
                        logger.info(
                            "%s[ws] END received | session=%s total_audio_chunks=%d webrtc=%s",
                            _LOG, config.session_id, audio_chunks_received, use_webrtc,
                        )
                        await audio_queue.put(None)
                        await voice_text_queue.put(None)
                        break
                    else:
                        # Parse JSON to check for signaling vs app messages
                        try:
                            data = json.loads(message["text"])
                            if data.get("type") in ("rtc_offer",):
                                await handle_rtc_signaling(data)
                            else:
                                await handle_text_message(message["text"])
                        except json.JSONDecodeError:
                            await handle_text_message(message["text"])
        except WebSocketDisconnect:
            logger.info(
                "%s[ws] client disconnected | session=%s", _LOG, config.session_id
            )
            await audio_queue.put(None)
            await voice_text_queue.put(None)
        except Exception as exc:
            logger.error(
                "%s[ws] receive loop error | session=%s: %s\n%s",
                _LOG, config.session_id, exc, traceback.format_exc(),
            )
            await audio_queue.put(None)
            await voice_text_queue.put(None)

    # ── Run both tasks concurrently ────────────────────────────────────────────

    receive_task = asyncio.create_task(receive_loop())
    async def receive_voice_text() -> str | None:
        return await voice_text_queue.get()

    bridge_task = asyncio.create_task(
        client.run(
            receive_audio=receive_audio,
            send_audio=send_audio,
            config=config,
            send_control=send_control,
            receive_voice_text=receive_voice_text,
        )
    )

    results = await asyncio.gather(receive_task, bridge_task, return_exceptions=True)
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            task_name = "receive_loop" if i == 0 else "bridge(LiveClient)"
            logger.error(
                "%s[session] %s raised: %s | session=%s",
                _LOG, task_name, result, config.session_id,
            )

    # ── Cleanup WebRTC ─────────────────────────────────────────────────────────

    if webrtc_handler:
        try:
            await webrtc_handler.close()
        except Exception:
            pass

    # ── Session recap ──────────────────────────────────────────────────────────

    session_duration = time.time() - session_start_time
    recap = agent.build_recap(config, duration_seconds=session_duration)
    try:
        await websocket.send_json({"type": "recap", "data": recap.model_dump()})
    except Exception:
        pass

    logger.info(
        "%s[session] ended session_id=%s duration=%.1fs webrtc=%s",
        _LOG, config.session_id, session_duration, use_webrtc,
    )
