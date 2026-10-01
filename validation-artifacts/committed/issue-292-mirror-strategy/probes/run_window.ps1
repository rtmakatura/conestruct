# run_window.ps1 -- run one #292 measurement window, at most once.
#
# Two triggers run each window (Ryan, 2026-10-01: belt and braces): a Windows
# Task Scheduler task and CC's in-session timer.  Whichever starts first
# claims the window by CREATING its output file exclusively (CreateNew fails
# if the file exists), so the second sees the claim and only records that it
# skipped.  The gate token is read from the main checkout's .env.local into
# this process's environment and never printed.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File run_window.ps1 -Label midday
[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$Label)

$probes = $PSScriptRoot
$outDir = Join-Path $probes "out"
$out = Join-Path $outDir "window-$Label.jsonl"
$err = Join-Path $outDir "window-$Label.stderr"
$python = "C:\Users\rtmak\Documents\traffic-control-tool\.venv\Scripts\python.exe"
$envFile = "C:\Users\rtmak\Documents\traffic-control-tool\conestruct\site\.env.local"

try {
    $claim = [System.IO.File]::Open($out, [System.IO.FileMode]::CreateNew)
    $claim.Close()
} catch {
    $note = Join-Path $outDir "window-$Label.skipped.txt"
    "$(Get-Date -Format o) skipped by $($env:USERNAME) pid $($PID): $out already exists (the other trigger ran this window)" |
        Out-File -Append -Encoding utf8 $note
    exit 0
}

$line = Get-Content $envFile | Where-Object { $_ -like "GATE_BYPASS_TOKEN=*" } | Select-Object -First 1
$env:GATE_BYPASS_TOKEN = ($line -replace "^GATE_BYPASS_TOKEN=", "").Trim().Trim('"')
$env:PYTHONIOENCODING = "utf-8"
Set-Location $probes
& $python measure_window.py $Label 1> $out 2> $err
exit $LASTEXITCODE
