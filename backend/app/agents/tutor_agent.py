"""
TutorAgent — orchestrates the Faheem math tutoring persona.

Responsibilities:
- Loads the system prompt from prompts/system_prompt.md
- Declares Gemini function schemas for all four math tools
- Dispatches tool calls received from Gemini to local tool functions
- Accumulates session events and builds end-of-session recaps

Note: google.genai types are imported lazily (inside build_live_config) so this
module can be imported and tested without a live API connection.
"""

import logging
from pathlib import Path

from app.models.schemas import SessionConfig, SessionRecap
from app.tools import (
    build_session_recap,
    check_answer,
    detect_problem_type,
    generate_next_hint,
)

logger = logging.getLogger(__name__)

_PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "system_prompt.md"

# Maps Gemini function-call names -> local tool run() functions
_TOOL_REGISTRY: dict = {
    "detect_problem_type": detect_problem_type.run,
    "check_answer": check_answer.run,
    "generate_next_hint": generate_next_hint.run,
    "build_session_recap": build_session_recap.run,
}

# JSON-schema declarations sent to Gemini at session start
_TOOL_SCHEMAS: list[dict] = [
    {
        "name": "detect_problem_type",
        "description": (
            "Classify the type of math problem the student is working on. "
            "Returns one of: algebra, geometry, arithmetic, calculus, "
            "statistics, trigonometry, word_problem, or unknown."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "utterance": {
                    "type": "string",
                    "description": "The student's spoken or written math problem.",
                },
                "context": {
                    "type": "string",
                    "description": "Optional surrounding conversation context.",
                },
            },
            "required": ["utterance"],
        },
    },
    {
        "name": "check_answer",
        "description": (
            "Verify whether the student's answer to a math question is "
            "correct, partially correct, or incorrect. Provide a correction "
            "and brief explanation when wrong."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "The math question that was posed.",
                },
                "student_answer": {
                    "type": "string",
                    "description": "The student's answer.",
                },
                "expected_answer": {
                    "type": "string",
                    "description": "The correct answer.",
                },
            },
            "required": ["question", "student_answer", "expected_answer"],
        },
    },
    {
        "name": "generate_next_hint",
        "description": (
            "Generate a progressively more revealing hint for a student stuck "
            "on a math problem. Use hint_level=1 first, escalate to 2 then 3 "
            "only if still stuck."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "problem": {
                    "type": "string",
                    "description": "The math problem the student is stuck on.",
                },
                "hint_level": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 3,
                    "description": "1=subtle strategy hint, 2=partial step, 3=full worked step.",
                },
            },
            "required": ["problem", "hint_level"],
        },
    },
    {
        "name": "build_session_recap",
        "description": (
            "Build a structured end-of-session recap. Call this when the "
            "student says goodbye, finishes, or signals they are done."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "session_id": {"type": "string"},
                "topics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Math topics or problem types covered in the session.",
                },
                "mistakes": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Incorrect student answers recorded during the session.",
                },
                "corrections": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Corrections or correct answers Faheem provided.",
                },
            },
            "required": ["session_id"],
        },
    },
]


class TutorAgent:
    def __init__(self) -> None:
        self._system_prompt: str = _PROMPT_FILE.read_text(encoding="utf-8")
        self._events: list[dict] = []  # accumulated tool call history

    @property
    def system_prompt(self) -> str:
        return self._system_prompt

    # ── Gemini config ──────────────────────────────────────────────────────────

    def build_live_config(self):
        """
        Returns a types.LiveConnectConfig with the system prompt, voice, and
        tool declarations. Called once when opening the Gemini Live session.
        """
        from google.genai import types

        tools = [
            types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(**schema) for schema in _TOOL_SCHEMAS
                ]
            )
        ]

        return types.LiveConnectConfig(
            response_modalities=["AUDIO", "TEXT"],
            system_instruction=types.Content(
                parts=[types.Part(text=self._system_prompt)],
                role="user",
            ),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Charon"
                    )
                )
            ),
            tools=tools,
        )

    # ── Tool dispatch ──────────────────────────────────────────────────────────

    async def dispatch_tool_calls(self, tool_call) -> list[dict]:
        """
        Receive a Gemini tool_call object, run the matching local function,
        record the event, and return results as plain dicts.

        Returns:
            list of {"name": str, "result": dict}
        """
        results = []
        for fn_call in tool_call.function_calls:
            name = fn_call.name
            args = dict(fn_call.args)
            logger.info("[FaheemLive][backend][tool] call: %s(%s)", name, args)

            if name in _TOOL_REGISTRY:
                result = _TOOL_REGISTRY[name](**args)
                logger.info("[FaheemLive][backend][tool] result: %s → %s", name, result)
            else:
                result = {"error": f"Unknown tool: {name}"}
                logger.warning("[FaheemLive][backend][tool] unknown tool: %s", name)

            self._events.append({"tool": name, "args": args, "result": result})
            results.append({"name": name, "result": result})

        return results

    # ── Recap ──────────────────────────────────────────────────────────────────

    def build_recap(self, config: SessionConfig, duration_seconds: float = 0.0) -> SessionRecap:
        """
        Build an end-of-session recap from accumulated tool-call events.
        Called by session_manager after the audio bridge closes.

        Args:
            config: Session configuration
            duration_seconds: Total session duration in seconds
        """
        topics = list(
            {
                t
                for e in self._events
                if e.get("tool") == "build_session_recap"
                for t in e.get("args", {}).get("topics", [])
            }
        )
        mistakes = [
            e["args"].get("student_answer", "")
            for e in self._events
            if e.get("tool") == "check_answer"
            and e.get("result", {}).get("verdict") == "incorrect"
        ]
        corrections = [
            e["result"].get("correction", "")
            for e in self._events
            if e.get("tool") == "check_answer"
            and e.get("result", {}).get("correction")
        ]

        score = max(0.0, round(1.0 - len(mistakes) * 0.1, 2))

        # Format duration as mm:ss for summary
        minutes = int(duration_seconds // 60)
        seconds = int(duration_seconds % 60)
        duration_str = f"{minutes}:{seconds:02d}"

        topics_str = f" Topics: {', '.join(topics)}." if topics else ""
        mistakes_str = f" Mistakes: {len(mistakes)}." if mistakes else ""
        duration_line = f" Duration: {duration_str}."
        summary = f"Math session complete.{topics_str}{mistakes_str}{duration_line}"

        return SessionRecap(
            session_id=config.session_id,
            duration_seconds=duration_seconds,
            topics_covered=[t for t in topics if t],
            mistakes=mistakes,
            corrections=corrections,
            score=min(score, 1.0),
            summary=summary,
        )
