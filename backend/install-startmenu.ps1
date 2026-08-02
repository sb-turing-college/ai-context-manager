# ============================================================================
# AI Context Manager - Start Menu Installer
# Creates a pinnable shortcut in the Windows Start Menu.
# Run once: Right-click -> "Run with PowerShell"
# ============================================================================

$SCRIPT_DIR   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ROOT         = Split-Path -Parent $SCRIPT_DIR
$VBS_PATH     = Join-Path $SCRIPT_DIR "start.vbs"
$APP_NAME     = "AI Context Manager"
$FOLDER_NAME  = "AI Context Manager"

$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$FOLDER_NAME"
$shortcutPath = Join-Path $startMenuDir "$APP_NAME.lnk"

if (-not (Test-Path $startMenuDir)) {
    New-Item -ItemType Directory -Path $startMenuDir | Out-Null
}

$wsh = New-Object -ComObject WScript.Shell
$sc  = $wsh.CreateShortcut($shortcutPath)
$sc.TargetPath       = "C:\Windows\System32\wscript.exe"
$sc.Arguments        = "`"$VBS_PATH`""
$sc.Description      = "Start AI Context Manager (Backend + Frontend)"
$sc.WorkingDirectory = $ROOT
$sc.Save()

Write-Host ""
Write-Host "  [OK] Shortcut installed:" -ForegroundColor Green
Write-Host "       $shortcutPath" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  -> Open Start Menu, search for '$APP_NAME'" -ForegroundColor Cyan
Write-Host "     Right-click -> 'Pin to Start'" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close"
