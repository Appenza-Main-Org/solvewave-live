#!/usr/bin/env bash
#
# deploy.sh — Automated deployment to Google Cloud Run
#
# Usage:
#   ./scripts/deploy.sh              # Deploy both backend and frontend
#   ./scripts/deploy.sh backend      # Deploy backend only
#   ./scripts/deploy.sh frontend     # Deploy frontend only
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - GCP project configured (gcloud config set project PROJECT_ID)
#   - Billing enabled on GCP project
#
# Environment variables:
#   GEMINI_API_KEY  — Required for backend (unless deploying in stub mode)
#   GCP_PROJECT     — GCP project ID (defaults to current gcloud config)
#   GCP_REGION      — Deployment region (defaults to us-central1)
#

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

PROJECT_ID="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null || echo "")}"
REGION="${GCP_REGION:-us-central1}"
BACKEND_SERVICE="solvewave-backend"
FRONTEND_SERVICE="solvewave-frontend"

# ── Colors for output ─────────────────────────────────────────────────────────

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Helper functions ──────────────────────────────────────────────────────────

log() { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*"; exit 1; }
info() { echo -e "${BLUE}[info]${NC} $*"; }

check_prerequisites() {
  log "Checking prerequisites..."

  # Check gcloud
  if ! command -v gcloud &> /dev/null; then
    error "gcloud CLI not found. Install from https://cloud.google.com/sdk/docs/install"
  fi

  # Check project ID
  if [ -z "$PROJECT_ID" ]; then
    error "GCP project not set. Run: gcloud config set project YOUR_PROJECT_ID"
  fi

  log "✓ gcloud CLI installed"
  log "✓ GCP project: $PROJECT_ID"
  log "✓ Region: $REGION"
}

enable_apis() {
  log "Enabling required GCP APIs..."
  gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    --project="$PROJECT_ID" \
    --quiet 2>/dev/null || warn "APIs may already be enabled"
  log "✓ APIs enabled"
}

deploy_backend() {
  log "Deploying backend service: $BACKEND_SERVICE"

  # Prompt for API key if not set
  if [ -z "${GEMINI_API_KEY:-}" ]; then
    warn "GEMINI_API_KEY not set in environment"
    read -rp "Enter your Gemini API key (or press Enter to deploy in stub mode): " GEMINI_API_KEY
    if [ -z "$GEMINI_API_KEY" ]; then
      warn "No API key provided — deploying in stub mode (GEMINI_STUB=true)"
      STUB_MODE="true"
    else
      STUB_MODE="false"
    fi
  else
    STUB_MODE="false"
  fi

  # Build env vars
  if [ "$STUB_MODE" = "true" ]; then
    ENV_VARS="GEMINI_STUB=true,CORS_ORIGINS=[\"*\"]"
  else
    ENV_VARS="GEMINI_API_KEY=$GEMINI_API_KEY,CORS_ORIGINS=[\"*\"]"
  fi

  # Deploy
  gcloud run deploy "$BACKEND_SERVICE" \
    --source backend \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --set-env-vars "$ENV_VARS" \
    --project="$PROJECT_ID" \
    --quiet

  # Get backend URL
  BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format="value(status.url)" 2>/dev/null || echo "")

  if [ -z "$BACKEND_URL" ]; then
    error "Failed to get backend URL"
  fi

  log "✓ Backend deployed: $BACKEND_URL"

  # Verify health check
  info "Verifying backend health..."
  sleep 3
  if curl -sf "${BACKEND_URL}/health" > /dev/null; then
    log "✓ Backend health check passed"
  else
    warn "Backend health check failed — check logs: gcloud run logs tail $BACKEND_SERVICE --region=$REGION"
  fi

  # Export for frontend
  export BACKEND_URL
}

deploy_frontend() {
  log "Deploying frontend service: $FRONTEND_SERVICE"

  # Get backend URL if not already set
  if [ -z "${BACKEND_URL:-}" ]; then
    BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --format="value(status.url)" 2>/dev/null || echo "")

    if [ -z "$BACKEND_URL" ]; then
      error "Backend URL not found. Deploy backend first: ./scripts/deploy.sh backend"
    fi
  fi

  # Convert http:// to wss:// (Cloud Run always serves HTTPS)
  WS_URL="${BACKEND_URL/https:/wss:}/ws/session"

  log "Using WebSocket URL: $WS_URL"

  # Deploy with build-time env var
  gcloud run deploy "$FRONTEND_SERVICE" \
    --source frontend \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --set-build-env-vars "NEXT_PUBLIC_WS_URL=$WS_URL" \
    --project="$PROJECT_ID" \
    --quiet

  # Get frontend URL
  FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format="value(status.url)" 2>/dev/null || echo "")

  if [ -z "$FRONTEND_URL" ]; then
    error "Failed to get frontend URL"
  fi

  log "✓ Frontend deployed: $FRONTEND_URL"
}

show_summary() {
  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║${NC}  ${BLUE}Deployment Complete!${NC}                                       ${GREEN}║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  if [ -n "${BACKEND_URL:-}" ]; then
    echo -e "  ${BLUE}Backend:${NC}  $BACKEND_URL"
    echo -e "  ${BLUE}Health:${NC}   ${BACKEND_URL}/health"
  fi

  if [ -n "${FRONTEND_URL:-}" ]; then
    echo -e "  ${BLUE}Frontend:${NC} $FRONTEND_URL"
  fi

  echo ""
  echo -e "${YELLOW}Next steps:${NC}"
  echo -e "  1. Open the frontend URL in your browser"
  echo -e "  2. Click 'Start session' and allow microphone access"
  echo -e "  3. Speak or type a math problem"
  echo ""
  echo -e "${YELLOW}Logs:${NC}"
  if [ -n "${BACKEND_URL:-}" ]; then
    echo -e "  gcloud run logs tail $BACKEND_SERVICE --region=$REGION"
  fi
  if [ -n "${FRONTEND_URL:-}" ]; then
    echo -e "  gcloud run logs tail $FRONTEND_SERVICE --region=$REGION"
  fi
  echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────

main() {
  log "Starting deployment to Google Cloud Run..."
  log "Project: $PROJECT_ID | Region: $REGION"
  echo ""

  check_prerequisites
  enable_apis

  TARGET="${1:-all}"

  case "$TARGET" in
    backend)
      deploy_backend
      ;;
    frontend)
      deploy_frontend
      ;;
    all|"")
      deploy_backend
      deploy_frontend
      ;;
    *)
      error "Invalid target: $TARGET. Use: backend, frontend, or all"
      ;;
  esac

  show_summary
}

main "$@"
