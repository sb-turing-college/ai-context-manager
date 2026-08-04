# Shared helpers for AI Context Manager start scripts (Windows PowerShell 5.1+).
# Dot-source from start-*.ps1 — do not run directly.
#
# Process lifecycle:
#   1) Prefer orderly shutdown of the process tree we started (concurrently / child shells).
#   2) Always run Stop-ListeningPorts in `finally` as a deterministic safety net.
#      uvicorn --reload and Vite spawn grandchildren; on Windows those can survive
#      Ctrl+C. Port-based cleanup is the last resort, not the only stop strategy.

Set-StrictMode -Version Latest

function Stop-ListeningPorts {
    param([Parameter(Mandatory = $true)][int[]]$Ports)
    foreach ($port in $Ports) {
        $owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($procId in $owners) {
            Write-Host "  Port $port still held by PID $procId -> stopping" -ForegroundColor Yellow
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
}

function Ensure-ScriptNpmDeps {
    param([Parameter(Mandatory = $true)][string]$ScriptsDir)
    $nodeModules = Join-Path $ScriptsDir "node_modules\concurrently"
    if (Test-Path $nodeModules) { return }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm not found in PATH (required for scripts/ concurrently orchestration)."
    }
    Write-Host "  First run: npm install in scripts/ (pinned concurrently)..." -ForegroundColor Yellow
    Push-Location $ScriptsDir
    try {
        npm install --no-fund --no-audit
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed in scripts/ (exit $LASTEXITCODE)."
        }
    } finally {
        Pop-Location
    }
}

function Ensure-FrontendNpmDeps {
    param([Parameter(Mandatory = $true)][string]$FrontendDir, [string]$Label)
    if (Test-Path (Join-Path $FrontendDir "node_modules")) { return }
    Write-Host "  First run: npm install ($Label)..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    try {
        npm install --no-fund --no-audit
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed in $FrontendDir (exit $LASTEXITCODE)."
        }
    } finally {
        Pop-Location
    }
}

function Wait-HttpOk {
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

function Wait-PortListening {
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

function Start-ServiceWindow {
    param([string]$Title, [string]$WorkingDirectory, [string]$Command)
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-Command",
        "Set-Location '$WorkingDirectory'; Write-Host '$Title' -ForegroundColor Green; $Command"
    ) -WindowStyle Normal | Out-Null
    Write-Host "  Started window: $Title" -ForegroundColor Green
}

function Stop-Launch {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
    # Keep the window readable when started via Explorer / "Run with PowerShell".
    Write-Host ""
    Write-Host "Press Enter to close..."
    try { [void](Read-Host) } catch { Start-Sleep -Seconds 10 }
}
