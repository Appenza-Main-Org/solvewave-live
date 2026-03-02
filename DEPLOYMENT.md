# Deployment Guide

This document explains how to deploy Faheem Math to Google Cloud Run.

---

## Prerequisites

1. **Google Cloud Project** with billing enabled
2. **gcloud CLI** installed and configured
3. **Docker** (if testing containers locally — optional)

### Install gcloud CLI

```bash
# macOS (Homebrew)
brew install google-cloud-sdk

# Linux (Debian/Ubuntu)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Windows
# Download installer from https://cloud.google.com/sdk/docs/install
```

### Authenticate & Set Project

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

---

## Quick Deploy (Automated Scripts)

We provide deployment scripts for both Unix and Windows:

### Unix/Linux/macOS

```bash
# Deploy backend + frontend in one command
./scripts/deploy.sh

# Or deploy individually:
./scripts/deploy.sh backend
./scripts/deploy.sh frontend
```

### Windows (PowerShell)

```powershell
# Deploy backend + frontend
.\scripts\deploy.ps1

# Or deploy individually:
.\scripts\deploy.ps1 -Target backend
.\scripts\deploy.ps1 -Target frontend
```

**What the scripts do:**
1. Enable required GCP APIs (Cloud Run, Cloud Build)
2. Deploy backend to Cloud Run (with GEMINI_API_KEY from env or prompt)
3. Deploy frontend to Cloud Run (with NEXT_PUBLIC_WS_URL auto-configured)
4. Output service URLs

---

## Manual Deployment

### 1. Enable Required APIs

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

### 2. Deploy Backend

```bash
cd backend

# Deploy to Cloud Run (Cloud Build will automatically containerize)
gcloud run deploy faheem-math-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=YOUR_GEMINI_API_KEY,CORS_ORIGINS=[\"*\"]"
```

**Environment Variables:**
- `GEMINI_API_KEY` (required) — Get from https://aistudio.google.com/app/apikey
- `CORS_ORIGINS` — JSON array of allowed origins (`["*"]` for open access)
- `GEMINI_MODEL` (optional) — Default: `gemini-2.5-flash-native-audio-latest`
- `GEMINI_TEXT_MODEL` (optional) — Default: `gemini-2.5-flash`
- `GEMINI_STUB` (optional) — Set to `true` for demo mode (no API calls)

**Note the backend URL:** `https://faheem-math-backend-HASH-uc.a.run.app`

### 3. Deploy Frontend

```bash
cd frontend

# Deploy to Cloud Run with backend WebSocket URL
gcloud run deploy faheem-math-frontend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-build-env-vars "NEXT_PUBLIC_WS_URL=wss://faheem-math-backend-HASH-uc.a.run.app/ws/session"
```

Replace `HASH` with your actual backend service hash from step 2.

**Note the frontend URL:** `https://faheem-math-frontend-HASH-uc.a.run.app`

### 4. Verify Deployment

```bash
# Backend health check
curl https://faheem-math-backend-HASH-uc.a.run.app/health

# Expected response:
# {"status":"ok","model":"gemini-2.5-flash-native-audio-latest","stub":false}

# Frontend
open https://faheem-math-frontend-HASH-uc.a.run.app
```

---

## Configuration

### Backend Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes* | — | Gemini API key (*required unless `GEMINI_STUB=true`) |
| `GEMINI_MODEL` | No | `gemini-2.5-flash-native-audio-latest` | Model for voice interactions |
| `GEMINI_TEXT_MODEL` | No | `gemini-2.5-flash` | Model for text/image |
| `GEMINI_STUB` | No | `false` | Set `true` to enable demo mode (no API calls) |
| `CORS_ORIGINS` | No | `["http://localhost:3000"]` | Allowed origins (JSON array) |
| `LOG_LEVEL` | No | `INFO` | Python logging level |

### Frontend Build-time Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_WS_URL` | No | `ws://localhost:8000/ws/session` | Backend WebSocket URL |

**Note:** Frontend env vars must be set at **build time** using `--set-build-env-vars` because Next.js bakes `NEXT_PUBLIC_*` vars into the client bundle.

---

## Updating Deployments

### Update Backend

```bash
# Re-deploy with new code or env vars
gcloud run deploy faheem-math-backend \
  --source backend \
  --region us-central1 \
  --update-env-vars "GEMINI_API_KEY=NEW_KEY"
```

### Update Frontend

```bash
# Re-deploy with new code
gcloud run deploy faheem-math-frontend \
  --source frontend \
  --region us-central1
```

**Important:** If you change the backend URL, you must **redeploy the frontend** with the new `NEXT_PUBLIC_WS_URL` build-time variable.

---

## Rollback

```bash
# List revisions
gcloud run revisions list --service faheem-math-backend --region us-central1

# Rollback to a previous revision
gcloud run services update-traffic faheem-math-backend \
  --region us-central1 \
  --to-revisions REVISION_NAME=100
```

---

## Logs & Monitoring

### View Logs

```bash
# Backend logs (live tail)
gcloud run logs tail faheem-math-backend --region us-central1

# Frontend logs
gcloud run logs tail faheem-math-frontend --region us-central1
```

### View in Cloud Console

- [Cloud Run Services](https://console.cloud.google.com/run)
- [Cloud Build History](https://console.cloud.google.com/cloud-build/builds)
- [Logs Explorer](https://console.cloud.google.com/logs)

---

## Cost Optimization

Cloud Run pricing:
- **First 2 million requests/month:** Free
- **CPU/Memory:** Billed per 100ms of use (scales to zero when idle)
- **Gemini API:** Free tier available (see https://ai.google.dev/pricing)

**Tips:**
- Use `--min-instances 0` (default) to scale to zero when idle
- Use `--max-instances 10` to cap concurrent instances
- Enable `GEMINI_STUB=true` in non-production environments to avoid API costs

---

## Troubleshooting

### "Permission denied" errors

```bash
# Grant necessary IAM roles
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="user:YOUR_EMAIL" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="user:YOUR_EMAIL" \
  --role="roles/cloudbuild.builds.builder"
```

### WebSocket connection fails

- Ensure backend `CORS_ORIGINS` includes the frontend origin
- Verify frontend `NEXT_PUBLIC_WS_URL` uses `wss://` (not `ws://`)
- Check backend logs: `gcloud run logs tail faheem-math-backend`

### Frontend shows "WebSocket error"

- Confirm backend is deployed and accessible: `curl https://YOUR_BACKEND_URL/health`
- Check that `NEXT_PUBLIC_WS_URL` was set at **build time** (redeploy frontend if changed after initial deploy)

---

## Demo Mode Deployment (For Judges)

To deploy a version that works without an API key:

```bash
gcloud run deploy faheem-math-backend \
  --source backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_STUB=true,CORS_ORIGINS=[\"*\"]"
```

This enables judges to test the full UX flow without needing their own Gemini API key.

---

## Current Production Deployment

- **GCP Project:** `faheem-live-competition` (872506223416)
- **Backend:** https://faheem-math-backend-872506223416.us-central1.run.app
- **Frontend:** https://faheem-math-frontend-872506223416.us-central1.run.app
- **Region:** `us-central1`
- **Tag:** v0.2.0

---

**Last updated:** 2026-03-02
