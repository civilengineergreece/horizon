$ErrorActionPreference = "Stop"
$exe = Join-Path $PSScriptRoot "dist\KinoMonitor.exe"
if (-not (Test-Path $exe)) {
    throw "Δεν βρέθηκε το dist\KinoMonitor.exe. Τρέξε πρώτα build.bat."
}
$startup = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startup "KINO Monitor.lnk"
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($shortcutPath)
$sc.TargetPath = $exe
$sc.WorkingDirectory = Split-Path $exe
$sc.Description = "KINO Monitor - αυτόματη παρακολούθηση αποτελεσμάτων"
$sc.Save()
Write-Host "OK: προστέθηκε στην Εκκίνηση των Windows: $shortcutPath"
