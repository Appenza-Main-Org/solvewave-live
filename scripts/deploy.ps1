<#
.SYNOPSIS
    Automated deployment to Google Cloud Run (PowerShell)

.DESCRIPTION
    Deploys SolveWave backend and frontend to Google Cloud Run.

.PARAMETER Target
    Deployment target: "backend", "frontend", or "all" (default)

.EXAMPLE
    .\scripts\deploy.ps1
    # Deploys both backend and frontend

.EXAMPLE
    .\scripts\deploy.ps1 -Target backend
    # Deploys backend only

.EXAMPLE
    .\scripts\deploy.ps1 -Target frontend
    # Deploys frontend only

.NOTES
    Prerequisites:
    - gcloud CLI installed and authenticated
    - GCP project configured (gcloud config set project PROJECT_ID)
    - Billing enabled on GCP project

    Environment variables:
    - GEMINI_API_KEY: Required for backend (unless deploying in stub mode)
    - GCP_PROJECT: GCP project ID (defaults to current gcloud config)
    - GCP_REGION: Deployment region (defaults to us-central1)
#>

param(
    [Parameter(Position=0)]
    [ValidateSet("backend", "frontend", "all")]
    [string]$Target = "all"
)

# ── Configuration ─────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

$ProjectId = if ($env:GCP_PROJECT) { $env:GCP_PROJECT } else {
    (gcloud config get-value project 2>$null)
}
$Region = if ($env:GCP_REGION) { $env:GCP_REGION } else { "us-central1" }
$BackendService = "solvewave-backend"
$FrontendService = "solvewave-frontend"

# ── Helper Functions ──────────────────────────────────────────────────────────

function Write-Log {
    param([string]$Message)
    Write-Host "[deploy] " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[warn] " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
}

function Write-Error {
    param([string]$Message)
    Write-Host "[error] " -ForegroundColor Red -NoNewline
    Write-Host $Message
    exit 1
}

function Write-Info {
    param([string]$Message)
    Write-Host "[info] " -ForegroundColor Cyan -NoNewline
    Write-Host $Message
}

function Check-Prerequisites {
    Write-Log "Checking prerequisites..."

    # Check gcloud
    try {
        $null = Get-Command gcloud -ErrorAction Stop
    } catch {
        Write-Error "gcloud CLI not found. Install from https://cloud.google.com/sdk/docs/install"
    }

    # Check project ID
    if (-not $ProjectId) {
        Write-Error "GCP project not set. Run: gcloud config set project YOUR_PROJECT_ID"
    }

    Write-Log "✓ gcloud CLI installed"
    Write-Log "✓ GCP project: $ProjectId"
    Write-Log "✓ Region: $Region"
}

function Enable-Apis {
    Write-Log "Enabling required GCP APIs..."

    try {
        gcloud services enable `
            run.googleapis.com `
            cloudbuild.googleapis.com `
            --project="$ProjectId" `
            --quiet 2>$null
    } catch {
        Write-Warning "APIs may already be enabled"
    }

    Write-Log "✓ APIs enabled"
}

function Deploy-Backend {
    Write-Log "Deploying backend service: $BackendService"

    # Prompt for API key if not set
    $ApiKey = $env:GEMINI_API_KEY
    if (-not $ApiKey) {
        Write-Warning "GEMINI_API_KEY not set in environment"
        $ApiKey = Read-Host "Enter your Gemini API key (or press Enter to deploy in stub mode)"

        if (-not $ApiKey) {
            Write-Warning "No API key provided — deploying in stub mode (GEMINI_STUB=true)"
            $StubMode = $true
        } else {
            $StubMode = $false
        }
    } else {
        $StubMode = $false
    }

    # Build env vars
    if ($StubMode) {
        $EnvVars = 'GEMINI_STUB=true,CORS_ORIGINS=["*"]'
    } else {
        $EnvVars = "GEMINI_API_KEY=$ApiKey,CORS_ORIGINS=[`"*`"]"
    }

    # Deploy
    gcloud run deploy $BackendService `
        --source backend `
        --platform managed `
        --region $Region `
        --allow-unauthenticated `
        --set-env-vars $EnvVars `
        --project="$ProjectId" `
        --quiet

    # Get backend URL
    $script:BackendUrl = gcloud run services describe $BackendService `
        --region="$Region" `
        --project="$ProjectId" `
        --format="value(status.url)" 2>$null

    if (-not $script:BackendUrl) {
        Write-Error "Failed to get backend URL"
    }

    Write-Log "✓ Backend deployed: $script:BackendUrl"

    # Verify health check
    Write-Info "Verifying backend health..."
    Start-Sleep -Seconds 3

    try {
        $response = Invoke-WebRequest -Uri "$script:BackendUrl/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Log "✓ Backend health check passed"
        }
    } catch {
        Write-Warning "Backend health check failed — check logs: gcloud run logs tail $BackendService --region=$Region"
    }
}

function Deploy-Frontend {
    Write-Log "Deploying frontend service: $FrontendService"

    # Get backend URL if not already set
    if (-not $script:BackendUrl) {
        $script:BackendUrl = gcloud run services describe $BackendService `
            --region="$Region" `
            --project="$ProjectId" `
            --format="value(status.url)" 2>$null

        if (-not $script:BackendUrl) {
            Write-Error "Backend URL not found. Deploy backend first: .\scripts\deploy.ps1 -Target backend"
        }
    }

    # Convert https:// to wss:// (Cloud Run always serves HTTPS)
    $WsUrl = $script:BackendUrl -replace "^https://", "wss://"
    $WsUrl = "$WsUrl/ws/session"

    Write-Log "Using WebSocket URL: $WsUrl"

    # Deploy with build-time env var
    gcloud run deploy $FrontendService `
        --source frontend `
        --platform managed `
        --region $Region `
        --allow-unauthenticated `
        --set-build-env-vars "NEXT_PUBLIC_WS_URL=$WsUrl" `
        --project="$ProjectId" `
        --quiet

    # Get frontend URL
    $script:FrontendUrl = gcloud run services describe $FrontendService `
        --region="$Region" `
        --project="$ProjectId" `
        --format="value(status.url)" 2>$null

    if (-not $script:FrontendUrl) {
        Write-Error "Failed to get frontend URL"
    }

    Write-Log "✓ Frontend deployed: $script:FrontendUrl"
}

function Show-Summary {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║" -ForegroundColor Green -NoNewline
    Write-Host "  Deployment Complete!                                       " -ForegroundColor Cyan -NoNewline
    Write-Host "║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""

    if ($script:BackendUrl) {
        Write-Host "  Backend:  " -ForegroundColor Cyan -NoNewline
        Write-Host $script:BackendUrl
        Write-Host "  Health:   " -ForegroundColor Cyan -NoNewline
        Write-Host "$script:BackendUrl/health"
    }

    if ($script:FrontendUrl) {
        Write-Host "  Frontend: " -ForegroundColor Cyan -NoNewline
        Write-Host $script:FrontendUrl
    }

    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Open the frontend URL in your browser"
    Write-Host "  2. Click 'Start session' and allow microphone access"
    Write-Host "  3. Speak or type a math problem"
    Write-Host ""
    Write-Host "Logs:" -ForegroundColor Yellow
    if ($script:BackendUrl) {
        Write-Host "  gcloud run logs tail $BackendService --region=$Region"
    }
    if ($script:FrontendUrl) {
        Write-Host "  gcloud run logs tail $FrontendService --region=$Region"
    }
    Write-Host ""
}

# ── Main ──────────────────────────────────────────────────────────────────────

Write-Log "Starting deployment to Google Cloud Run..."
Write-Log "Project: $ProjectId | Region: $Region"
Write-Host ""

Check-Prerequisites
Enable-Apis

switch ($Target) {
    "backend" {
        Deploy-Backend
    }
    "frontend" {
        Deploy-Frontend
    }
    "all" {
        Deploy-Backend
        Deploy-Frontend
    }
}

Show-Summary
