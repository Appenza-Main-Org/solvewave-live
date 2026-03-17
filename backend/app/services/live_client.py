"""
LiveClient — clean wrapper around the Gemini Live API.

Design goals:
- Audio path  : run(receive_audio, send_audio, config)   — Gemini Live API
- Text path   : generate_text_reply(user_text, ...)      — standard text API
- Stub mode (GEMINI_STUB=true) lets the full pipeline be tested locally
  without any API calls or credentials
- google.genai imports are deferred so the module is always importable
- Tool call dispatch is delegated to TutorAgent
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
    ) -> None:
        """
        Open a Gemini Live session and bridge audio bidirectionally until the
        browser disconnects (receive_audio returns None).

        send_control, if provided, is called with a JSON-serialisable dict to
        push control frames (e.g. interruption notifications) to the browser.

        receive_voice_text, if provided, yields text strings captured by the
        browser's Web Speech API. These are injected into the Live session as
        text content, ensuring the student's question reaches Gemini even if
        the audio quality is poor.
        """
        if self._stub:
            await self._run_stub(receive_audio, send_audio, config)
        else:
            await self._run_live(receive_audio, send_audio, config, send_control, receive_voice_text)

    # ── Live mode ──────────────────────────────────────────────────────────────

    async def _run_live(
        self,
        receive_audio,
        send_audio,
        config: SessionConfig,
        send_control=None,
        receive_voice_text=None,
    ) -> None:
        """Real Gemini Live connection. Imports google.genai lazily."""
        from google import genai
        from google.genai import types

        live_config = self._agent.build_live_config()
        client = genai.Client(api_key=settings.gemini_api_key)

        logger.info(
            "Opening Gemini Live session [%s] model=%s",
            config.session_id, settings.gemini_model,
        )

        try:
            async with client.aio.live.connect(
                model=settings.gemini_model,
                config=live_config,
            ) as session:
                logger.info("Gemini Live session opened [%s]", config.session_id)

                upstream_task = asyncio.create_task(
                    self._upstream(session, receive_audio, config)
                )
                downstream_task = asyncio.create_task(
                    self._downstream(session, send_audio, config, send_control)
                )

                # Voice text injector: feeds Web Speech API transcripts into
                # the Live session as text content, ensuring the student's
                # questions reach Gemini even when audio quality is poor.
                text_injector_task = None
                if receive_voice_text:
                    text_injector_task = asyncio.create_task(
                        self._text_injector(session, receive_voice_text, config)
                    )

                # Upstream exits when browser sends None (disconnect or END).
                # Cancel downstream so the async-for loop on session.receive() stops.
                await upstream_task
                downstream_task.cancel()
                if text_injector_task:
                    text_injector_task.cancel()
                try:
                    await downstream_task
                except asyncio.CancelledError:
                    pass
                if text_injector_task:
                    try:
                        await text_injector_task
                    except asyncio.CancelledError:
                        pass

            logger.info("Gemini Live session closed [%s]", config.session_id)
        except Exception as exc:
            logger.error(
                "Gemini Live session FAILED [%s] model=%s: %s",
                config.session_id, settings.gemini_model, exc,
            )
            import traceback
            logger.error("Traceback: %s", traceback.format_exc())

    async def _upstream(self, session, receive_audio, config: SessionConfig) -> None:
        """Forward browser PCM chunks to Gemini."""
        from google.genai import types

        try:
            while True:
                chunk = await receive_audio()
                if chunk is None:
                    logger.info("End-of-stream [%s]", config.session_id)
                    break
                await session.send_realtime_input(
                    audio=types.Blob(
                        data=chunk,
                        mime_type="audio/pcm;rate=16000",
                    )
                )
        except Exception as exc:
            logger.error("Upstream error [%s]: %s", config.session_id, exc)

    async def _text_injector(self, session, receive_voice_text, config: SessionConfig) -> None:
        """
        Drain the voice_text queue and inject each message into the Gemini Live
        session as text content. This runs alongside the audio upstream so that
        Web Speech API transcriptions supplement the raw audio signal.

        Gemini Live session.send_client_content() adds the text as a user turn
        to the conversation, prompting Gemini to respond with audio.
        """
        from google.genai import types

        try:
            while True:
                text = await receive_voice_text()
                if text is None:
                    logger.info("Voice text stream ended [%s]", config.session_id)
                    break
                if not text.strip():
                    continue
                logger.info(
                    "[SolveWave][backend][voice_text] injecting into Live session: %r [%s]",
                    text[:120], config.session_id,
                )
                await session.send_client_content(
                    turns=[
                        types.Content(
                            role="user",
                            parts=[types.Part(text=text)],
                        )
                    ],
                    turn_complete=True,  # Signal user turn is done → Gemini will respond
                )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error(
                "[SolveWave][backend][voice_text] error [%s]: %s",
                config.session_id, exc,
            )

    async def _downstream(self, session, send_audio, config: SessionConfig, send_control=None) -> None:
        """Forward Gemini responses (audio + text + tool calls) to the browser."""
        from google.genai import types

        audio_chunks_sent = 0
        # Separate tracking: part.text is the model's internal thinking/plan,
        # while output_audio_transcription is what was actually spoken aloud.
        # We prefer transcription for the displayed transcript.
        thinking_parts: list[str] = []       # from part.text (internal reasoning)
        transcription_parts: list[str] = []  # from output_audio_transcription (actual speech)

        try:
            async for response in session.receive():
                # ── Interruption / barge-in event ──────────────────────────────
                if (
                    response.server_content
                    and response.server_content.interrupted
                ):
                    logger.info(
                        "[SolveWave][backend][voice] barge-in / interruption [%s]",
                        config.session_id,
                    )
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
                            # Notify frontend that tutor audio is starting
                            if audio_chunks_sent == 0 and send_control:
                                try:
                                    await send_control({"type": "status", "value": "speaking_start"})
                                except Exception:
                                    pass
                            await send_audio(part.inline_data.data)
                            audio_chunks_sent += 1
                        elif part.text:
                            # part.text is the model's internal thinking/plan for
                            # what to say — NOT what's actually spoken. For native
                            # audio models this is often a plan like "I'm going to
                            # explain step by step...". We log it but do NOT send
                            # it as transcript_delta (use transcription instead).
                            t = _clean_thinking_text(part.text)
                            if t:
                                logger.info(
                                    "[SolveWave][backend][voice] part.text (thinking, not displayed): %r [%s]",
                                    t[:120], config.session_id,
                                )
                                thinking_parts.append(t)

                # ── Audio transcription (what the tutor actually said) ────────
                # This is the real spoken content — send it to the transcript.
                # Check multiple attribute names — SDK versions may differ:
                #   - output_transcription (current google-genai SDK)
                #   - output_audio_transcription (older/alternative name)
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
                            break  # Don't double-send

                # Debug: log response structure on first audio response
                if audio_chunks_sent == 1 and response.server_content:
                    _sc = response.server_content
                    _attrs = {a: type(getattr(_sc, a, None)).__name__ for a in dir(_sc) if not a.startswith('_')}
                    logger.info(
                        "[SolveWave][backend][voice] server_content fields: %s [%s]",
                        _attrs, config.session_id,
                    )
                    # Also check response-level attributes
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
                    # Only use transcription (actual speech) for display.
                    # Thinking text is the model's internal plan — NOT what was
                    # spoken aloud. Showing it confuses users ("I'm focusing on
                    # breaking down..."). If transcription isn't available, show
                    # nothing — the audio itself carries the response.
                    display_parts = transcription_parts
                    logger.info(
                        "[SolveWave][backend][voice] turn complete | audio_chunks=%d "
                        "transcription_parts=%d thinking_parts=%d source=%s [%s]",
                        audio_chunks_sent, len(transcription_parts), len(thinking_parts),
                        "transcription" if transcription_parts else "audio_only(no_text)",
                        config.session_id,
                    )
                    # Notify frontend that tutor audio has ended
                    # Always send speaking_end (even if audio_chunks_sent == 0)
                    # so the frontend properly resets mic/discard state after
                    # client-side interrupts where chunks were discarded.
                    if send_control:
                        try:
                            await send_control({"type": "status", "value": "speaking_end"})
                        except Exception:
                            pass
                    # Send the complete transcript as a final message for the
                    # conversation log, and signal streaming is done.
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
                    audio_chunks_sent = 0
                    thinking_parts = []
                    transcription_parts = []

        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.error("Downstream error [%s]: %s", config.session_id, exc)

    # ── Text reply (non-Live, standard generate API) ───────────────────────────

    async def generate_text_reply(
        self,
        user_text: str,
        system_prompt: str,
        history: list[dict],
    ) -> str:
        """
        Generate a single SolveWave text reply using the standard Gemini text API.

        Intentionally separate from the Live audio path so text-only round trips
        don't require opening a full Live session.

        Args:
            user_text:     The student's latest message.
            system_prompt: SolveWave's system prompt (from TutorAgent.system_prompt).
            history:       Prior turns as [{"role": "user"|"model", "text": "..."}].
                           Grows across the session for multi-turn context.

        Returns:
            Gemini's text reply string, or a fallback on error.
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

        # Build conversation contents from accumulated history
        contents = [
            types.Content(
                role=entry["role"],
                parts=[types.Part(text=entry["text"])],
            )
            for entry in history
        ]
        # Append the new user turn
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

        Args:
            image_b64:     Base64-encoded image data (no data-URL prefix).
            mime_type:     MIME type (e.g. "image/png", "image/jpeg").
            caption:       Optional student caption / question about the image.
            system_prompt: SolveWave's system prompt.
            history:       Prior text turns for conversational context.

        Returns:
            Gemini's text reply string, or a fallback on error.
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

        # Build conversation history from prior text turns
        contents = [
            types.Content(
                role=entry["role"],
                parts=[types.Part(text=entry["text"])],
            )
            for entry in history
        ]

        # Decode base64 → raw bytes
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

        # Build the new user turn: image part + text instruction
        user_parts = [
            types.Part(
                inline_data=types.Blob(data=image_bytes, mime_type=mime_type)
            )
        ]
        # Always include a text part so Gemini has clear instruction alongside the image.
        # If the student provided a caption/question, use it; otherwise use a default prompt.
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

        Lets the entire pipeline (WebSocket → queue → client → WebSocket) be
        exercised end-to-end without a real Gemini API key.

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
            # Echo the same number of zero bytes so the browser audio pipeline
            # can be verified without real audio content.
            await send_audio(b"\x00" * len(chunk))
