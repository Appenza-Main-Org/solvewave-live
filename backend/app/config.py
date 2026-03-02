from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    # API key (required unless stub mode is enabled)
    gemini_api_key: str | None = None

    # Optional with defaults
    gemini_model: str = "gemini-2.5-flash-native-audio-latest"  # Live API (audio)
    gemini_text_model: str = "gemini-2.5-flash"        # standard text API
    gemini_stub: bool = False          # set GEMINI_STUB=true to skip real API calls
    cors_origins: list[str] = ["http://localhost:3000"]
    log_level: str = "INFO"

    @field_validator("gemini_api_key")
    @classmethod
    def validate_api_key(cls, v, info):
        """Ensure API key is provided when not in stub mode."""
        if not v and not info.data.get("gemini_stub", False):
            raise ValueError(
                "GEMINI_API_KEY is required when GEMINI_STUB is not true. "
                "Either set GEMINI_API_KEY or set GEMINI_STUB=true for demo mode."
            )
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
