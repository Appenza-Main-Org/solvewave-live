import logging

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.ws.session_manager import handle_session

settings = get_settings()

logging.basicConfig(level=settings.log_level.upper())

app = FastAPI(
    title="SolveWave API",
    description="Real-time math tutoring backend powered by Gemini Live",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"service": "SolveWave API", "status": "running", "version": "0.1.0"}


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "model": settings.gemini_model,
        "stub": settings.gemini_stub,
    }


@app.websocket("/ws/session")
async def session_endpoint(websocket: WebSocket):
    await handle_session(websocket)
