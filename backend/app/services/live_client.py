"""
LiveClient — clean wrapper around the Gemini Live API.

Design goals:
- Audio path  : run(receive_audio, send_audio, config)   — Gemini Live API
- Text path   : generate_text_reply(user_text, ...)      — standard text API
- Stub mode (GEMINI_STUB=true) lets the full pipeline be tested locally
  without any API calls or credentials
- google.genai imports are deferred so the module is always importable
- Tool call dispatch is delegated to TutorAgent
- Silent reconnect: after barge-in, if Gemini stops producing audio,
  the Live session is automatically closed and reopened (up to 3 times).
"""

import asyncio
import base64
import logging

from app.config import get_settings
from app.models.schemas import SessionConfig

logger = logging.getLogger(__name__)
settings = get_settings()

import re

def _clean_thinking_text(raw: str) -> str:
    """
    Strip Gemini's internal thinking headers from part.text.

    Native audio models often wrap their response in a bold header like:
      **Calculating the Answer**\n\nThe answer is 4.
    We strip the header and return just the useful content.
    """
    text = raw.strip()
    if not text:
        return ""
    # Remove bold markdown headers at the start (e.g. **Thinking About...**)
    text = re.sub(r'^\*\*[^*]+\*\*\s*\n*', '', text).strip()
    # Remove lines that are just headers
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Skip empty lines at the start
        if not cleaned and not stripped:
            continue
        # Skip standalone bold headers
        if re.match(r'^\*\*[^*]+\*\*$', stripped):
            continue
        cleaned.append(line)
    return '\n'.join(cleaned).strip()


class LiveClient:
    """
    Bridges a browser WebSocket audio stream with the Gemini Live API.

    Usage:
        client = LiveClient(agent=tutor_agent)
        await client.run(receive_audio=..., send_audio=..., config=session_config)
    """

    def __init__(self, agent) -> None:
        self._agent = agent
        self._stub = settings.gemini_stub

    # ── Public interface ───────────────────────────────────────────────────────

    async def run(
        self,
        receive_audio,   # async () -> bytes | None   (None signals end-of-stream)
        send_audio,      # async (bytes) -> None
        config: SessionConfig,
        send_control=None,  # async (dict) -> None  (optional JSON control frames)
        receive_voice_text=None,  # async () -> str | None  (text from Web Speech API)
        conv_history=None,  # list[dict] — shared conversation history for reconnect replay
    ) -> None:
        """
        Open a Gemini Live session and bridge audio bidirectionally until the
        browser disconnects (receive_audio returns None).

        send_control, if provided, is called with a JSON-serialisable dict to
        push control frames (e.g. interruption notifications) to the browser.

        conv_history, if provided, is a mutable list of {role, text} dicts
        maintained by the session manager. On reconnect, recent history is
        replayed via send_client_content for conversational context.
        """
        if self._stub:
            await self._run_stub(receive_audio, send_audio, config)
        else:
            await self._run_live(
                receive_audio, send_audio, config,
                send_control, receive_voice_text,
                conv_history if conv_history is not None else [],
            )

    # ── Live mode (with automatic reconnect) ──────────────────────────────────

    _MAX_RECONNECTS = 3
    _WATCHDOG_TIMEOUT = 5.0  # seconds after interrupt before declaring stuck

    async def _run_live(
        self,
        receive_audio,
        send_audio,
        config: SessionConfig,
        send_control=None,
        receive_voice_text=None,
        conv_history: list | None = None,
    ) -> None:
        """Gemini Live connection with silent reconnect on post-interrupt stall."""
        from google import genai

        live_config = self._agent.build_live_config()
        api_client = genai.Client(api_key=settings.gemini_api_key)
        if conv_history is None:
            conv_history = []

        reconnect_count = 0

        while True:
            # ── Open one Gemini Live session ────────────────────────────────
            reconnect_event = asyncio.Event()

            logger.info(
                "Opening Gemini Live session [%s] model=%s reconnect=%d",
                config.session_id, settings.gemini_model, reconnect_count,
            )

            try:
                async with api_client.aio.live.connect(
                    model=settings.gemini_model,
                    config=live_config,
                ) as session:
                    logger.info(
                        "Gemini Live session opened [%s] reconnect=%d",
                        config.session_id, reconnect_count,
                    )

                    # Replay conversation history on reconnect so Gemini has context.
                    # Done BEFORE starting upstream (send_realtime_input) to avoid
                    # the send_client_content ↔ send_realtime_input conflict.
                    if reconnect_count > 0 and conv_history:
                        await self._replay_history(session, conv_history, config)

                    upstream_task = asyncio.create_task(
                        self._upstream(session, receive_audio, config)
                    )
                    downstream_task = asyncio.create_task(
                        self._downstream(
                            session, send_audio, config, send_control,
                            conv_history, reconnect_event,
                        )
                    )

                    # Wait for EITHER:
                    #  - upstream ends (browser disconnect / END signal)
                    #  - reconnect_event fires (watchdog detected stall)
                    reconnect_waiter = asyncio.create_task(reconnect_event.wait())

                    done, _pending = await asyncio.wait(
                        [upstream_task, reconnect_waiter],
                        return_when=asyncio.FIRST_COMPLETED,
                    )

                    needs_reconnect = reconnect_event.is_set()

                    # Clean up all tasks
                    for task in [upstream_task, downstream_task, reconnect_waiter]:
                        if not task.done():
                            task.cancel()
                            try:
                                await task
                            except (asyncio.CancelledError, Exception):
                                pass

                # ── Post-session decision ───────────────────────────────────
                if needs_reconnect:
                    reconnect_count += 1
                    if reconnect_count > self._MAX_RECONNECTS:
                        logger.warning(
                            "[SolveWave][backend] Max reconnects (%d) exceeded — "
                            "sending fallback_tts [%s]",
                            self._MAX_RECONNECTS, config.session_id,
                        )
                        if send_control:
                            try:
                                await send_control({"type": "fallback_tts"})
                            except Exception:
                                pass
                        return

                    logger.info(
                        "[SolveWave][backend] Reconnecting (%d/%d) [%s]",
                        reconnect_count, self._MAX_RECONNECTS, config.session_id,
                    )
                    # Reset frontend speaking state so it doesn't stay stuck
                    if send_control:
                        try:
                            await send_control({"type": "status", "value": "speaking_end"})
                        except Exception:
                            pass
                    continue  # loop → open new session

                # Normal exit
                logger.info("Gemini Live session closed [%s]", config.session_id)
                return

            except Exception as exc:
                logger.error(
                    "Gemini Live session FAILED [%s] model=%s: %s",
                    config.session_id, settings.gemini_model, exc,
                )
                import traceback as tb
                logger.error("Traceback: %s", tb.format_exc())
                return

    # ── History replay (used on reconnect) ────────────────────────────────────

    async def _replay_history(self, session, conv_history, config):
        """Replay recent conversation into a fresh session via send_client_content.

        Called BEFORE any send_realtime_input so the two modes don't conflict.
        Uses turn_complete=False to set context without triggering a response.
        """
        from google.genai import types

        recent = conv_history[-10:]  # last 10 turns max
        if not recent:
            return

        turns = [
            types.Content(
                role=entry["role"],
                parts=[types.Part(text=entry["text"])],
            )
            for entry in recent
        ]

        try:
            await session.send_client_content(turns=turns, turn_complete=False)
            logger.info(
                "[SolveWave][backend] Replayed %d history turns [%s]",
                len(recent), config.session_id,
            )
        except Exception as exc:
            logger.warning(
                "[SolveWave][backend] History replay failed (continuing): %s [%s]",
                exc, config.session_id,
            )

    # ── Post-interrupt watchdog ───────────────────────────────────────────────

    async def _post_interrupt_watchdog(self, reconnect_event, config):
        """Sleep for WATCHDOG_TIMEOUT, then signal reconnect if not cancelled."""
        try:
            await asyncio.sleep(self._WATCHDOG_TIMEOUT)
            logger.warning(
                "[SolveWave][backend] Watchdog: no audio %.0fs after interrupt "
                "— triggering reconnect [%s]",
                self._WATCHDOG_TIMEOUT, config.session_id,
            )
            reconnect_event.set()
        except asyncio.CancelledError:
            # Watchdog was cancelled because Gemini produced audio — all good
            pass

    # ── Upstream (browser → Gemini) ───────────────────────────────────────────

    async def _upstream(self, session, receive_audio, config: SessionConfig) -> None:
        """Forward ALL browser PCM chunks to Gemini continuously.

        Gemini's automatic VAD needs a continuous audio stream — including
        silence — to detect start-of-speech and end-of-speech transitions.
        We forward every chunk as-is (AEC-processed by the browser).
        """
        from google.genai import types

        chunks_forwarded = 0
        try:
            while True:
                chunk = await receive_audio()
                if chunk is None:
                    logger.info(
                        "End-of-stream [%s] total_chunks_forwarded=%d",
                        config.session_id, chunks_forwarded,
                    )
                    break
                await session.send_realtime_input(
                    audio=types.Blob(
                        data=chunk,
                        mime_type="audio/pcm;rate=16000",
                    )
                )
                chunks_forwarded += 1
                if chunks_forwarded == 1:
                    logger.info(
                        "[SolveWave][backend][upstream] first audio chunk forwarded [%s]",
                        config.session_id,
                    )
                elif chunks_forwarded % 100 == 0:
                    logger.info(
                        "[SolveWave][backend][upstream] audio chunks forwarded: %d [%s]",
                        chunks_forwarded, config.session_id,
                    )
        except Exception as exc:
            logger.error(
                "Upstream error [%s] after %d chunks: %s",
                config.session_id, chunks_forwarded, exc,
            )
            import traceback as tb
            logger.error("Upstream traceback: %s", tb.format_exc())

    # ── Downstream (Gemini → browser) ─────────────────────────────────────────

    async def _downstream(
        self, session, send_audio, config: SessionConfig,
        send_control=None, conv_history=None, reconnect_event=None,
    ) -> None:
        """Forward Gemini responses (audio + text + tool calls) to the browser.

        Includes a post-interrupt watchdog: if Gemini produces no audio within
        WATCHDOG_TIMEOUT seconds after an interrupted turn completes, the
        reconnect_event is set so _run_live can open a fresh session.
        """
        from google.genai import types
        import time

        audio_chunks_sent = 0
        total_responses_received = 0
        last_heartbeat = time.time()
        thinking_parts: list[str] = []
        transcription_parts: list[str] = []

        # Post-interrupt watchdog state
        _post_interrupt = False
        _watchdog_task: asyncio.Task | None = None

        try:
            async for response in session.receive():
                total_responses_received += 1
                now = time.time()
                if now - last_heartbeat >= 10:
                    logger.info(
                        "[SolveWave][backend][downstream] heartbeat: alive, total_responses=%d, "
                        "audio_chunks_sent=%d [%s]",
                        total_responses_received, audio_chunks_sent, config.session_id,
                    )
                    last_heartbeat = now

                # ── Input audio transcription (what Gemini heard from user) ────
                _INPUT_TRANSCRIPTION_ATTRS = [
                    "input_transcription",
                    "input_audio_transcription",
                ]
                for _attr in _INPUT_TRANSCRIPTION_ATTRS:
                    _input_t = getattr(response.server_content, _attr, None) if response.server_content else None
                    if _input_t is None:
                        _input_t = getattr(response, _attr, None)
                    if _input_t:
                        _it_text = _input_t if isinstance(_input_t, str) else getattr(_input_t, "text", str(_input_t))
                        if _it_text and _it_text.strip():
                            logger.info(
                                "[SolveWave][backend][downstream] Gemini heard user say: %r [%s]",
                                _it_text[:200], config.session_id,
                            )
                            break

                # ── Interruption / barge-in event ──────────────────────────────
                if (
                    response.server_content
                    and response.server_content.interrupted
                ):
                    logger.info(
                        "[SolveWave][backend][voice] barge-in / interruption [%s]",
                        config.session_id,
                    )
                    _post_interrupt = True  # arm the watchdog for the next turn_complete
                    audio_chunks_sent = 0
                    thinking_parts = []
                    transcription_parts = []
                    if send_control:
                        try:
                            await send_control({"type": "status", "value": "interrupted"})
                        except Exception as exc:
                            logger.warning(
                                "[SolveWave][backend][voice] send_control failed: %s", exc
                            )
                    continue

                # ── Tool call ──────────────────────────────────────────────────
                if response.tool_call:
                    logger.info(
                        "[SolveWave][backend][voice] tool call [%s]", config.session_id
                    )
                    results = await self._agent.dispatch_tool_calls(
                        response.tool_call
                    )
                    await session.send_tool_response(
                        function_responses=[
                            types.FunctionResponse(
                                name=r["name"], response=r["result"]
                            )
                            for r in results
                        ]
                    )
                    continue

                # ── Audio + text output ────────────────────────────────────────
                if (
                    response.server_content
                    and response.server_content.model_turn
                ):
                    for part in response.server_content.model_turn.parts:
                        if part.inline_data and part.inline_data.data:
                            # ★ Cancel watchdog — Gemini IS producing audio
                            if _watchdog_task and not _watchdog_task.done():
                                _watchdog_task.cancel()
                                _watchdog_task = None
                                logger.info(
                                    "[SolveWave][backend][voice] watchdog cancelled "
                                    "— audio received after reconnect [%s]",
                                    config.session_id,
                                )

                            # Notify frontend that tutor audio is starting
                            if audio_chunks_sent == 0 and send_control:
                                try:
                                    await send_control({"type": "status", "value": "speaking_start"})
                                except Exception:
                                    pass
                            await send_audio(part.inline_data.data)
                            audio_chunks_sent += 1
                        elif part.text:
                            t = _clean_thinking_text(part.text)
                            if t:
                                logger.info(
                                    "[SolveWave][backend][voice] part.text (thinking, not displayed): %r [%s]",
                                    t[:120], config.session_id,
                                )
                                thinking_parts.append(t)

                # ── Audio transcription (what the tutor actually said) ────────
                _TRANSCRIPTION_ATTRS = [
                    "output_transcription",
                    "output_audio_transcription",
                ]
                for _src_obj, _src_name in [
                    (getattr(response, "server_content", None), "server_content"),
                    (response, "response"),
                ]:
                    if _src_obj is None:
                        continue
                    transcription = None
                    for _attr in _TRANSCRIPTION_ATTRS:
                        transcription = getattr(_src_obj, _attr, None)
                        if transcription:
                            break
                    if transcription:
                        t_text = transcription if isinstance(transcription, str) else getattr(transcription, "text", str(transcription))
                        if t_text and t_text.strip():
                            transcription_parts.append(t_text)
                            logger.info(
                                "[SolveWave][backend][voice] transcription(%s): %r [%s]",
                                _src_name, t_text[:120], config.session_id,
                            )
                            if send_control:
                                try:
                                    await send_control({
                                        "type": "transcript_delta",
                                        "text": t_text,
                                    })
                                except Exception:
                                    pass
                            break

                # Debug: log response structure on first audio response
                if audio_chunks_sent == 1 and response.server_content:
                    _sc = response.server_content
                    _attrs = {a: type(getattr(_sc, a, None)).__name__ for a in dir(_sc) if not a.startswith('_')}
                    logger.info(
                        "[SolveWave][backend][voice] server_content fields: %s [%s]",
                        _attrs, config.session_id,
                    )
                    _resp_attrs = {a: type(getattr(response, a, None)).__name__ for a in dir(response) if not a.startswith('_')}
                    logger.info(
                        "[SolveWave][backend][voice] response fields: %s [%s]",
                        _resp_attrs, config.session_id,
                    )

                # ── Turn complete ──────────────────────────────────────────────
                if (
                    response.server_content
                    and response.server_content.turn_complete
                ):
                    display_parts = transcription_parts
                    logger.info(
                        "[SolveWave][backend][voice] turn complete | audio_chunks=%d "
                        "transcription_parts=%d thinking_parts=%d source=%s "
                        "post_interrupt=%s [%s]",
                        audio_chunks_sent, len(transcription_parts), len(thinking_parts),
                        "transcription" if transcription_parts else "audio_only(no_text)",
                        _post_interrupt, config.session_id,
                    )

                    # Send speaking_end
                    if send_control:
                        try:
                            await send_control({"type": "status", "value": "speaking_end"})
                        except Exception:
                            pass

                    # Send transcript
                    if display_parts and send_control:
                        full_text = "".join(display_parts).strip()
                        if full_text:
                            try:
                                await send_control({
                                    "type": "transcript_done",
                                    "text": full_text,
                                })
                                logger.info(
                                    "[SolveWave][backend][voice] sent voice transcript | len=%d [%s]",
                                    len(full_text), config.session_id,
                                )
                            except Exception as exc:
                                logger.warning(
                                    "[SolveWave][backend][voice] transcript send failed: %s", exc
                                )
                            # Append model turn to conversation history
                            if conv_history is not None:
                                conv_history.append({"role": "model", "text": full_text})
                                # Rolling window: keep last 10 turns
                                while len(conv_history) > 10:
                                    conv_history.pop(0)

                    # ★ Start watchdog if this turn_complete follows an interrupt
                    if _post_interrupt and reconnect_event is not None:
                        _post_interrupt = False
                        if _watchdog_task and not _watchdog_task.done():
                            _watchdog_task.cancel()
                        _watchdog_task = asyncio.create_task(
                            self._post_interrupt_watchdog(reconnect_event, config)
                        )
                        logger.info(
                            "[SolveWave][backend][voice] watchdog started (%.0fs) [%s]",
                            self._WATCHDOG_TIMEOUT, config.session_id,
                        )

                    audio_chunks_sent = 0
                    thinking_parts = []
                    transcription_parts = []

        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("Downstream error [%s]: %s", config.session_id, exc)
        finally:
            # Cancel watchdog on exit
            if _watchdog_task and not _watchdog_task.done():
                _watchdog_task.cancel()

    # ── Text reply (non-Live, standard generate API) ───────────────────────────

    async def generate_text_reply(
        self,
        user_text: str,
        system_prompt: str,
        history: list[dict],
    ) -> str:
        """
        Generate a single SolveWave text reply using the standard Gemini text API.
        """
        if self._stub:
            return f"[Stub] You said: {user_text}"
        return await self._call_text_api(user_text, system_prompt, history)

    async def _call_text_api(
        self,
        user_text: str,
        system_prompt: str,
        history: list[dict],
    ) -> str:
        """Non-streaming Gemini text generation. Imports google.genai lazily."""
        from google import genai
        from google.genai import types

        gai_client = genai.Client(api_key=settings.gemini_api_key)

        contents = [
            types.Content(
                role=entry["role"],
                parts=[types.Part(text=entry["text"])],
            )
            for entry in history
        ]
        contents.append(
            types.Content(role="user", parts=[types.Part(text=user_text)])
        )

        logger.info(
            "[SolveWave][backend][text] Gemini request | model=%s history_turns=%d",
            settings.gemini_text_model, len(history),
        )
        try:
            response = await gai_client.aio.models.generate_content(
                model=settings.gemini_text_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                ),
            )
            text = response.text or ""
            logger.info(
                "[SolveWave][backend][text] Gemini OK | reply_len=%d", len(text)
            )
            return text
        except Exception as exc:
            logger.error("[SolveWave][backend][text] Gemini FAILED | %s", exc)
            return "Sorry, I ran into a problem. Please try again."

    # ── Image reply (multimodal, standard generate API) ───────────────────────

    async def generate_image_reply(
        self,
        image_b64: str,
        mime_type: str,
        caption: str,
        system_prompt: str,
        history: list[dict],
    ) -> str:
        """
        Generate a SolveWave reply for an uploaded image using the Gemini multimodal API.
        """
        if self._stub:
            return (
                f"[Stub] I can see your math problem! "
                f"{'Caption: ' + caption + '. ' if caption else ''}"
                "Let me work through it step by step."
            )
        return await self._call_image_api(image_b64, mime_type, caption, system_prompt, history)

    async def _call_image_api(
        self,
        image_b64: str,
        mime_type: str,
        caption: str,
        system_prompt: str,
        history: list[dict],
    ) -> str:
        """Non-streaming Gemini multimodal generation. Imports google.genai lazily."""
        from google import genai
        from google.genai import types

        gai_client = genai.Client(api_key=settings.gemini_api_key)

        contents = [
            types.Content(
                role=entry["role"],
                parts=[types.Part(text=entry["text"])],
            )
            for entry in history
        ]

        logger.info(
            "[SolveWave][backend][image] decoding base64 | b64_len=%d mime=%s",
            len(image_b64), mime_type,
        )
        try:
            image_bytes = base64.b64decode(image_b64)
            logger.info(
                "[SolveWave][backend][image] decode OK | bytes=%d", len(image_bytes)
            )
        except Exception as exc:
            logger.error(
                "[SolveWave][backend][image] base64 decode FAILED | %s", exc
            )
            return "Sorry, I couldn't read that image. Please try again."

        user_parts = [
            types.Part(
                inline_data=types.Blob(data=image_bytes, mime_type=mime_type)
            )
        ]
        user_parts.append(
            types.Part(text=caption if caption else
                       "This is a math problem. Please identify it and solve it step by step.")
        )

        contents.append(types.Content(role="user", parts=user_parts))

        logger.info(
            "[SolveWave][backend][image] calling Gemini multimodal API | model=%s history_turns=%d",
            settings.gemini_text_model, len(history),
        )
        try:
            response = await gai_client.aio.models.generate_content(
                model=settings.gemini_text_model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                ),
            )
            text = response.text or ""
            logger.info(
                "[SolveWave][backend][image] Gemini OK | reply_len=%d reply_preview=%r",
                len(text), text[:80],
            )
            return text
        except Exception as exc:
            logger.error(
                "[SolveWave][backend][image] Gemini FAILED | %s\n%s",
                exc, __import__("traceback").format_exc(),
            )
            return "Sorry, I had trouble analysing that image. Please try again."

    # ── Stub mode ──────────────────────────────────────────────────────────────

    async def _run_stub(
        self,
        receive_audio,
        send_audio,
        config: SessionConfig,
    ) -> None:
        """
        Stub mode: drains incoming audio and echoes silence back.
        Set GEMINI_STUB=true in backend/.env to enable.
        """
        logger.warning(
            "LiveClient running in STUB mode — no Gemini API calls [%s]",
            config.session_id,
        )
        while True:
            chunk = await receive_audio()
            if chunk is None:
                break
            await send_audio(b"\x00" * len(chunk))
