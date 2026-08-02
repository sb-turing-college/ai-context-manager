' Launch Capstone-style start-all.ps1 (no .cmd). Keep window open (-NoExit).
Dim fso, scriptDir, rootDir, ps1Path
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)
ps1Path = rootDir & "\scripts\start-all.ps1"

CreateObject("WScript.Shell").Run _
    "powershell.exe -NoExit -ExecutionPolicy Bypass -File """ & ps1Path & """", _
    1, False
