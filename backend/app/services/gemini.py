import asyncio
import logging
from google import genai
from google.genai import types
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── System prompt ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """
You are SolveWave, a warm and patient math tutor who helps students understand
and solve math problems step by step.

Your behavior:
- Always detect which language the user is speaking.
- If the user speaks English, respond primarily in English but naturally weave in
  Arabic words and phrases, providing pronunciation guidance and translations.
- If the user speaks Arabic, respond primarily in Arabic but naturally weave in
  English equivalents to reinforce vocabulary.
- Keep responses concise and conversational — this is a live voice session.
- Gently correct mistakes without making the user feel bad.
- Celebrate progress and keep energy high and encouraging.
- When introducing a new word, say it clearly, spell it out if helpful, and use it
  in a simple sentence in both languages.

Start by warmly greeting the user and asking what they would like to practice today.
""".strip()

# ── Audio config ───────────────────────────────────────────────────────────────
LIVE_CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    system_instruction=types.Content(
        parts=[types.Part(text=SYSTEM_PROMPT)],
        role="user",
    ),
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Charon")
        )
    ),
)


async def run_gemini_bridge(
    receive_from_browser,   # async callable: returns bytes | None  (None = done)
    send_to_browser,        # async callable: accepts bytes
) -> None:
    """
    Opens a Gemini Live session and bridges audio in both directions.

    - Reads audio bytes from `receive_from_browser` and forwards to Gemini.
    - Reads Gemini audio responses and forwards to `send_to_browser`.

    Both directions run concurrently as asyncio tasks. The bridge exits when
    `receive_from_browser` returns None (browser disconnected).
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    async with client.aio.live.connect(
        model=settings.gemini_model,
        config=LIVE_CONFIG,
    ) as session:
        logger.info("Gemini Live session opened")

        async def upstream():
            """Browser mic audio -> Gemini."""
            try:
                while True:
                    audio_bytes = await receive_from_browser()
                    if audio_bytes is None:
                        logger.info("Browser disconnected, stopping upstream")
                        break
                    await session.send_realtime_input(
                        audio=types.Blob(
                            data=audio_bytes,
                            mime_type="audio/pcm;rate=16000",
                        )
                    )
            except Exception as exc:
                logger.error("Upstream error: %s", exc)

        async def downstream():
            """Gemini audio responses -> browser."""
            try:
                async for response in session.receive():
                    if (
                        response.server_content
                        and response.server_content.model_turn
                    ):
                        for part in response.server_content.model_turn.parts:
                            if part.inline_data and part.inline_data.data:
                                await send_to_browser(part.inline_data.data)
            except Exception as exc:
                logger.error("Downstream error: %s", exc)

        upstream_task = asyncio.create_task(upstream())
        downstream_task = asyncio.create_task(downstream())

        # Wait for upstream to finish (browser disconnect), then cancel downstream
        await upstream_task
        downstream_task.cancel()
        try:
            await downstream_task
        except asyncio.CancelledError:
            pass

    logger.info("Gemini Live session closed")
