FROM python:3.12-slim

WORKDIR /app

# System dependencies for aiortc (WebRTC) and PyAV (audio codec)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopus0 libvpx7 libsrtp2-1 \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first (layer-cache friendly)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Cloud Run injects PORT; default to 8080 for local docker run
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
