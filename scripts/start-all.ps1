#Requires -Version 5.1
<#
.SYNOPSIS
  Local launcher for AI Context Manager (backend + UI).

.DESCRIPTION
  Default mode: one terminal, multiplexed logs via pinned
  `concurrently` from `scripts/package.json` (keeps the monorepo root clean).

  Lifecycle:
    1. Free known ports at start (stale uvicorn/vite leftovers).
    2. Run `concurrently` in the foreground (colored prefixes).
    3. On Ctrl+C / exit: `finally` runs Stop-ListeningPorts as a
       deterministic safety net. Primary stop is concurrently's own
       `--kill-others` / SIGINT handling; port cleanup catches Windows
       grandchildren from `uvicorn --reload` and Vite that can linger.

  Prefixes: api, ui

.PARAMETER NoBrowser
  Do not auto-open the UI.

.PARAMETER SeparateWindows
  Escape hatch: one PowerShell window per service (legacy debug mode).

.EXAMPLE
  .\scripts\start-all.ps1
  .\scripts\start-all.ps1 -NoBrowser
  .\scripts\start-all.ps1 -SeparateWindows

  Important: do not use `exit` in this script — it would close the
  caller's PowerShell window. Fatal preflight errors use `return`
  after Stop-Launch (Explorer / "Run with PowerShell" friendly).
#>

param(
    [switch]$NoBrowser,
    [switch]$SeparateWindows
)

$ErrorActionPreference = "Stop"

# When started via shortcut with -NoProfile, still pick up user/machine PATH (uv, npm).
$env:Path = @(
    [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    [System.Environment]::GetEnvironmentVariable("Path", "User")
) -join ";"

# Windows consoles often default to cp1252; emoji/log UTF-8 then crash uvicorn startup.
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"

$ScriptsDir   = $PSScriptRoot
$MonorepoRoot = Split-Path -Parent $ScriptsDir
. (Join-Path $ScriptsDir "lib\common.ps1")

$BackendDir  = Join-Path $MonorepoRoot "backend"
$FrontendDir = Join-Path $MonorepoRoot "ui"

$BackendPort  = 8000
$FrontendPort = 5173
$HealthUrl    = "http://127.0.0.1:$BackendPort/api/v1/health"
$FrontendUrl  = "http://127.0.0.1:$FrontendPort"
$portsToManage = @($BackendPort, $FrontendPort)

Write-Host "=== AI Context Manager stack launcher ===" -ForegroundColor Cyan

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

Write-Host "`n[1] Freeing ports ($($portsToManage -join ', '))..." -ForegroundColor Cyan
Stop-ListeningPorts -Ports $portsToManage
Start-Sleep -Seconds 1

Ensure-FrontendNpmDeps -FrontendDir $FrontendDir -Label "ui"

try {
    if ($SeparateWindows) {
        Write-Host "`n[2] SeparateWindows mode (one window per service)..." -ForegroundColor Yellow
        Start-ServiceWindow -Title "api (:$BackendPort)" -WorkingDirectory $BackendDir `
            -Command "uv run uvicorn src.main:app --reload --host 127.0.0.1 --port $BackendPort"
        Start-ServiceWindow -Title "ui (:$FrontendPort)" -WorkingDirectory $FrontendDir `
            -Command "npm run dev -- --port $FrontendPort --host 127.0.0.1"

        Write-Host "`nWaiting for services..." -ForegroundColor Cyan
        Wait-HttpOk -Url $HealthUrl -Label "api" | Out-Null
        Wait-PortListening -Port $FrontendPort -Label "ui" | Out-Null

        if (-not $NoBrowser) {
            Start-Sleep -Seconds 1
            Start-Process $FrontendUrl
        }

        Write-Host "`nSeparateWindows: close each service window to stop that service." -ForegroundColor Cyan
        Write-Host "  Frontend: $FrontendUrl" -ForegroundColor Cyan
        Write-Host "  Backend:  http://127.0.0.1:$BackendPort/docs" -ForegroundColor Cyan
        return
    }

    Ensure-ScriptNpmDeps -ScriptsDir $ScriptsDir

    $probeJob = $null
    if (-not $NoBrowser) {
        $probeJob = Start-Job -ScriptBlock {
            param($Port, $HealthUrl)
            Start-Sleep -Seconds 4
            $deadline = (Get-Date).AddSeconds(55)
            while ((Get-Date) -lt $deadline) {
                try {
                    $r = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
                    if ($r.StatusCode -eq 200) { break }
                } catch { Start-Sleep -Milliseconds 500 }
            }
            Start-Process "http://127.0.0.1:$Port"
        } -ArgumentList $FrontendPort, $HealthUrl
    }

    Write-Host "`n[2] Starting api + ui in this terminal (concurrently)..." -ForegroundColor Cyan
    Write-Host "  Ctrl+C stops both; port cleanup runs in finally." -ForegroundColor DarkGray
    Write-Host "  Frontend: $FrontendUrl" -ForegroundColor Cyan
    Write-Host "  Backend:  http://127.0.0.1:$BackendPort/docs" -ForegroundColor Cyan
    Write-Host ""

    Push-Location $ScriptsDir
    try {
        & npm @(
            "exec", "--", "concurrently",
            "-n", "api,ui",
            "-c", "blue,cyan",
            "--kill-others",
            "cd /d `"$BackendDir`" && uv run uvicorn src.main:app --reload --host 127.0.0.1 --port $BackendPort",
            "cd /d `"$FrontendDir`" && npm run dev -- --port $FrontendPort --host 127.0.0.1"
        )
    } finally {
        Pop-Location
        if ($probeJob) {
            Stop-Job $probeJob -ErrorAction SilentlyContinue
            Remove-Job $probeJob -Force -ErrorAction SilentlyContinue
        }
    }
}
catch {
    Stop-Launch $_.Exception.Message
    return
}
finally {
    if (-not $SeparateWindows) {
        Write-Host "`nSafety-net port cleanup..." -ForegroundColor Cyan
        Start-Sleep -Milliseconds 500
        Stop-ListeningPorts -Ports $portsToManage
        Write-Host "Shutdown complete." -ForegroundColor Cyan
    }
}
