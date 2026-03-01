from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Required
    gemini_api_key: str

    # Optional with defaults
    gemini_model: str = "gemini-2.5-flash-native-audio-latest"  # Live API (audio)
    gemini_text_model: str = "gemini-2.5-flash"        # standard text API
    gemini_stub: bool = False          # set GEMINI_STUB=true to skip real API calls
    cors_origins: list[str] = ["http://localhost:3000"]
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
