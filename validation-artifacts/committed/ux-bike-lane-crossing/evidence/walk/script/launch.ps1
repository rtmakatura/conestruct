# #449 walk launcher (after #438's launch.ps1): replay backend + next dev on the issue-449 worktree.
param([int]$SitePort = 3449, [int]$BackPort = 8449)
$ErrorActionPreference = 'Stop'
$main = 'C:\Users\rtmak\Documents\traffic-control-tool'
$wt = 'C:\Users\rtmak\Documents\traffic-control-tool\.claude\worktrees\issue-449'
$sp = 'C:\Users\rtmak\AppData\Local\Temp\claude\556f937a78fa2516\e737671f-a27b-49f6-9e2c-f7a22e43845a\scratchpad\issue-449'
foreach ($line in Get-Content "$main\conestruct\site\.env.local") {
  if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') {
    Set-Item -Path "Env:$($Matches[1])" -Value ($Matches[2].Trim().Trim('"'))
  }
}
$env:MODAL_RENDER_URL = "http://127.0.0.1:$BackPort"
$env:RENDER_API_SECRET = $env:MODAL_RENDER_SECRET
$env:GATE_BYPASS_TOKEN = 'walk-449-local'
$env:PYTHONIOENCODING = 'utf-8'
$be = Start-Process -FilePath 'uv' -ArgumentList @('run', '--extra', 'dev', 'python', "$wt\validation-artifacts\committed\ux-group3-where\evidence\script\serve_replay.py", "$sp\fixture", "$BackPort") `
  -WorkingDirectory $wt -PassThru -WindowStyle Hidden -RedirectStandardOutput "$sp\logs\backend.out" -RedirectStandardError "$sp\logs\backend.err"
$fe = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', 'npx', 'next', 'dev', '-p', "$SitePort") `
  -WorkingDirectory "$wt\conestruct\site" -PassThru -WindowStyle Hidden -RedirectStandardOutput "$sp\logs\next.out" -RedirectStandardError "$sp\logs\next.err"
"backend_pid=$($be.Id) next_pid=$($fe.Id)"
