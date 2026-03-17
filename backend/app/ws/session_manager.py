"""
session_manager — WebSocket session lifecycle for SolveWave.

Responsibilities:
- Accept and authenticate the WebSocket connection
- Create a SessionConfig (with unique session_id)
- Wire the audio queue between the browser receive-loop and LiveClient
- Send status / recap JSON frames at session open and close
- Clean up on disconnect

WebSocket message protocol:
  Browser → Server:
    binary frame                                                        : raw PCM audio (16 kHz, 16-bit, mono)
    text  "END"                                                         : graceful stop signal
    text  {"type":"text","text":"...","mode":"explain|quiz|homework"}   : student text message
    text  {"type":"image","mimeType":"...","data":"...","caption":"...","mode":"..."} : base64 image

  Server → Browser:
    {"type": "status",  "value": "connected", "session_id": "..."}   on open
    {"type": "message", "role": "tutor",      "text": "..."}         text reply
    binary frame                                                       audio response
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

logger = logging.getLogger(__name__)

_LOG = "[SolveWave][backend]"

# Mode-specific addenda appended to the system prompt per request.
# Keeps the base system_prompt.md clean and allows runtime mode switching.
_MODE_ADDENDUM: dict[str, str] = {
    "explain": (
        "\n\n[Mode: Explain — explain ONE step at a time using numbered steps and LaTeX math. "
        "Show the math with $...$ notation. Say 2-3 sentences max, then pause "
        "and ask 'Does that make sense?' or 'Ready for the next step?'. "
        "Do NOT give all steps at once. Use **Step 1:**, **Step 2:** format. "
        "Never narrate your thinking — jump straight into the math.]"
    ),
    "quiz": (
        "\n\n[Mode: Quiz — ask ONE short math question using LaTeX notation ($...$). "
        "Wait for the answer. Give brief feedback (1-2 sentences). "
        "Keep the pace brisk. Use check_answer and generate_next_hint tools.]"
    ),
    "homework": (
        "\n\n[Mode: Homework — guide the student through ONE step at a time. "
        "Use numbered **Step N:** format with LaTeX math ($...$). "
        "Show the actual math work, not just words. "
        "Do NOT dump the full solution — walk through it step by step. "
        "Never narrate your thinking — jump straight into the math.]"
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

    await websocket.send_json(
        {
            "type": "status",
            "value": "connected",
            "session_id": config.session_id,
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

    # ── Callables passed to LiveClient ─────────────────────────────────────────

    async def receive_audio() -> bytes | None:
        return await audio_queue.get()

    async def send_audio(audio_bytes: bytes) -> None:
        """Send audio bytes to the browser via WebSocket binary."""
        try:
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

        # ── Voice text path ────────────────────────────────────────────────────
        # When voice is active, Web Speech API captures the student's speech as
        # text. We inject it into the Gemini Live session (so it can respond
        # with audio) AND call the text API for a guaranteed text reply.
        #
        # CRITICAL: The text API call must NOT block the receive_loop, because
        # blocking it prevents binary audio frames from being queued, which
        # starves the Gemini Live session and kills the audio connection.
        if msg_type == "voice_text":
            student_text = str(data.get("text", ""))
            if not student_text.strip():
                return
            logger.info(
                "%s[route] voice_text → Live inject + text API (background) | session=%s text=%r",
                _LOG, config.session_id, student_text[:120],
            )

            # Inject into the Gemini Live session so it can respond with audio
            await voice_text_queue.put(student_text)

            # Run text API call in background so receive_loop isn't blocked
            # (blocking would stall the audio_queue and kill the Live session)
            async def _bg_voice_text_reply(text: str, prompt: str) -> None:
                try:
                    reply = await client.generate_text_reply(
                        user_text=text,
                        system_prompt=prompt,
                        history=chat_history,
                    )
                    logger.info(
                        "%s[voice_text] Gemini replied | reply_len=%d", _LOG, len(reply)
                    )
                    chat_history.append({"role": "user", "text": text})
                    chat_history.append({"role": "model", "text": reply})
                    await websocket.send_json(
                        {"type": "message", "role": "tutor", "text": reply}
                    )
                except Exception as exc:
                    logger.error(
                        "%s[voice_text] background reply failed: %s", _LOG, exc
                    )

            asyncio.create_task(_bg_voice_text_reply(student_text, effective_prompt))
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

    async def receive_loop() -> None:
        audio_chunks_received = 0
        try:
            while True:
                message = await websocket.receive()
                if "bytes" in message and message["bytes"]:
                    audio_chunks_received += 1
                    if audio_chunks_received == 1:
                        logger.info(
                            "%s[voice] first PCM chunk received | session=%s",
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
                            "%s[ws] END received | session=%s total_audio_chunks=%d",
                            _LOG, config.session_id, audio_chunks_received,
                        )
                        await audio_queue.put(None)
                        await voice_text_queue.put(None)
                        break
                    else:
                        # Parse JSON to check for app messages
                        try:
                            data = json.loads(message["text"])
                            if data.get("type") == "interrupt":
                                logger.info(
                                    "%s[ws] interrupt received (frontend-only, Gemini handles natively) | session=%s",
                                    _LOG, config.session_id,
                                )
                                # NOTE: We do NOT send interrupted/speaking_end here.
                                # Gemini Live detects barge-in natively via the audio
                                # stream and sends its own interruption event, which
                                # live_client._downstream forwards to the frontend.
                                # Sending status frames here would clear discardAudioRef
                                # too early, allowing remaining Gemini audio through.
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

    # ── Session recap ──────────────────────────────────────────────────────────

    session_duration = time.time() - session_start_time
    recap = agent.build_recap(config, duration_seconds=session_duration)
    try:
        await websocket.send_json({"type": "recap", "data": recap.model_dump()})
    except Exception:
        pass

    logger.info(
        "%s[session] ended session_id=%s duration=%.1fs",
        _LOG, config.session_id, session_duration,
    )
