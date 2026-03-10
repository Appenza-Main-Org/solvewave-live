"""
Tool: build_session_recap

Produces a structured end-of-session math recap.
"""


def run(
    session_id: str,
    topics: list[str] | None = None,
    mistakes: list[str] | None = None,
    corrections: list[str] | None = None,
) -> dict:
    """
    Args:
        session_id:  Unique session identifier.
        topics:      Math topics or problem types covered.
        mistakes:    Incorrect student answers recorded.
        corrections: Corrections provided by the tutor.

    Returns:
        dict with keys: session_id, topics_covered, mistakes, corrections,
                        summary, score
    """
    topics = topics or []
    mistakes = mistakes or []
    corrections = corrections or []

    score = max(0.0, round(1.0 - len(mistakes) * 0.1, 2))

    parts = ["Great math session!"]
    if topics:
        parts.append(f"Topics: {', '.join(topics)}.")
    if mistakes:
        parts.append(f"{len(mistakes)} mistake(s) — review the corrections above.")
    else:
        parts.append("No mistakes — well done.")

    return {
        "session_id": session_id,
        "topics_covered": topics,
        "mistakes": mistakes,
        "corrections": corrections,
        "summary": " ".join(parts),
        "score": min(score, 1.0),
    }
