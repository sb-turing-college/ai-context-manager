#Requires -Version 5.1
<#
  Capstone-style stack launcher for AI Context Manager (monorepo):
    1) Backend  (FastAPI / uvicorn via uv) - http://127.0.0.1:8000
    2) Frontend (Vite)                    - http://127.0.0.1:5173

  Each service runs in its own PowerShell window (-NoExit).
  Ports are force-cleared first (stale uvicorn --reload children).

  Usage (from monorepo root - same as Capstone):
    .\scripts\start-all.ps1
    .\scripts\start-all.ps1 -NoBrowser

  Important: do not use `exit` in this script - it would close the
  caller's PowerShell window. Errors use `return` instead.
#>

param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

# When started via shortcut with -NoProfile, still pick up user/machine PATH (uv, npm).
$env:Path = @(
    [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    [System.Environment]::GetEnvironmentVariable("Path", "User")
) -join ";"

$MonorepoRoot = Split-Path -Parent $PSScriptRoot
$BackendDir   = Join-Path $MonorepoRoot "backend"
$FrontendDir  = Join-Path $MonorepoRoot "ui"

$BackendPort  = 8000
$FrontendPort = 5173
$HealthUrl    = "http://127.0.0.1:$BackendPort/api/v1/health"
$FrontendUrl  = "http://127.0.0.1:$FrontendPort"

function Stop-Port {
    param([int]$Port)
    $owners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $owners) {
        Write-Host "  Port $Port occupied by PID $procId -> stopping" -ForegroundColor Yellow
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

function Wait-ForHealth {
    param([string]$Url, [string]$Label, [int]$TimeoutSec = 60)
    Write-Host "  Waiting for $Label ($Url) ..." -NoNewline
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($resp.StatusCode -eq 200) {
                Write-Host " OK" -ForegroundColor Green
                return $true
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    Write-Host " TIMEOUT" -ForegroundColor Red
    return $false
}

function Wait-ForPort {
    param([int]$Port, [string]$Label, [int]$TimeoutSec = 60)
    Write-Host "  Waiting for $Label (port $Port) ..." -NoNewline
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($listening) {
            Write-Host " OK" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Milliseconds 500
    }
    Write-Host " TIMEOUT" -ForegroundColor Red
    return $false
}

function Write-LaunchError {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
}

function Stop-Launch {
    param([string]$Message)
    Write-LaunchError $Message
    # Keep the window readable when the script was started via Explorer / "Run with PowerShell".
    Write-Host ""
    Write-Host "Press Enter to close..."
    try { [void](Read-Host) } catch { Start-Sleep -Seconds 10 }
}

Write-Host "=== AI Context Manager stack launcher ===" -ForegroundColor Cyan

try {
    if (-not (Test-Path $BackendDir)) {
        Stop-Launch "backend/ not found at $BackendDir"
        return
    }
    if (-not (Test-Path $FrontendDir)) {
        Stop-Launch "ui/ not found at $FrontendDir"
        return
    }
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
        Stop-Launch "uv not found. Install: https://docs.astral.sh/uv/ (then reopen the terminal)."
        return
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Stop-Launch "npm not found. Install Node.js."
        return
    }

    if (-not (Test-Path (Join-Path $BackendDir ".env"))) {
        Stop-Launch "backend\.env missing. Copy backend\.env.example, set API keys, then retry."
        return
    }

    Write-Host "`n[1/4] Freeing ports ($BackendPort, $FrontendPort)..." -ForegroundColor Cyan
    Stop-Port -Port $BackendPort
    Stop-Port -Port $FrontendPort
    Start-Sleep -Seconds 2

    Write-Host "`n[2/4] Starting backend on port $BackendPort..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-Command",
        "cd '$BackendDir'; Write-Host 'AI Context Manager backend (:$BackendPort)' -ForegroundColor Green; uv run uvicorn src.main:app --reload --host 127.0.0.1 --port $BackendPort"
    ) -WindowStyle Normal

    Write-Host "`n[3/4] Starting frontend on port $FrontendPort..." -ForegroundColor Cyan
    if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
        Write-Host "  First run: installing frontend deps (npm install)..." -ForegroundColor Yellow
        Push-Location $FrontendDir
        npm install
        Pop-Location
    }
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-Command",
        "cd '$FrontendDir'; Write-Host 'AI Context Manager frontend (:$FrontendPort)' -ForegroundColor Green; npm run dev -- --port $FrontendPort --host 127.0.0.1"
    ) -WindowStyle Normal

    Write-Host "`n[4/4] Waiting for services..." -ForegroundColor Cyan
    $beOk = Wait-ForHealth -Url $HealthUrl -Label "backend"
    $feOk = Wait-ForPort -Port $FrontendPort -Label "frontend"

    if (-not $NoBrowser -and $feOk) {
        Start-Sleep -Seconds 1
        Start-Process $FrontendUrl
    }

    Write-Host "`nDone." -ForegroundColor Cyan
    Write-Host "  Backend:  http://127.0.0.1:$BackendPort/docs" -ForegroundColor Cyan
    Write-Host "  Frontend: $FrontendUrl" -ForegroundColor Cyan
    if (-not $beOk) {
        Write-Host "  WARNING: backend health check timed out - see backend window." -ForegroundColor Yellow
    }
    Write-Host "Close the opened PowerShell windows to stop each service." -ForegroundColor Cyan
}
catch {
    Stop-Launch $_.Exception.Message
    return
}
