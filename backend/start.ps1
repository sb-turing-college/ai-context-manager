# ============================================================================
# Compatibility wrapper (legacy path). Prefer Capstone-style from monorepo root:
#   .\scripts\start-all.ps1
#   .\scripts\start-all.cmd   (Explorer / Start Menu — keeps console open)
# ============================================================================

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$ROOT       = Split-Path -Parent $SCRIPT_DIR
$StartAll   = Join-Path $ROOT "scripts\start-all.ps1"

if (-not (Test-Path $StartAll)) {
    Write-Host "[ERROR] Missing $StartAll" -ForegroundColor Red
    exit 1
}

& $StartAll @args
$code = $LASTEXITCODE
if ($code -ne 0) { exit $code }
