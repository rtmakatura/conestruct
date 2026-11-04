# #438 walk launcher: the replay backend and `next dev` on this worktree.
#   powershell -File launch.ps1 <site_port> <backend_port>
# Loads the main checkout's conestruct/site/.env.local into this process's
# environment (nothing is copied into the worktree), points MODAL_RENDER_URL
# at the local backend, and gives the backend the same secret as
# RENDER_API_SECRET.  Prints both PIDs; stop each with `taskkill /T /F /PID`.
param([int]$SitePort = 3438, [int]$BackPort = 8438)
$ErrorActionPreference = 'Stop'
$main = 'C:\Users\rtmak\Documents\traffic-control-tool'
$wt = Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')
foreach ($line in Get-Content "$main\conestruct\site\.env.local") {
  if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') {
    $v = $Matches[2].Trim().Trim('"')
    Set-Item -Path "Env:$($Matches[1])" -Value $v
  }
}
$env:MODAL_RENDER_URL = "http://127.0.0.1:$BackPort"
$env:RENDER_API_SECRET = $env:MODAL_RENDER_SECRET
$env:PYTHONIOENCODING = 'utf-8'
$logs = Join-Path $env:TEMP 'issue438-walk'
New-Item -ItemType Directory -Force $logs | Out-Null
$fix = Join-Path $PSScriptRoot '..\overpass-fixture'
$be = Start-Process -FilePath 'uv' -ArgumentList @('run', '--extra', 'dev', 'python', (Join-Path $PSScriptRoot 'serve_replay.py'), $fix, "$BackPort") `
  -WorkingDirectory $wt -PassThru -WindowStyle Hidden -RedirectStandardOutput "$logs\backend.out" -RedirectStandardError "$logs\backend.err"
$fe = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', 'npx', 'next', 'dev', '-p', "$SitePort") `
  -WorkingDirectory (Join-Path $wt 'conestruct\site') -PassThru -WindowStyle Hidden -RedirectStandardOutput "$logs\next.out" -RedirectStandardError "$logs\next.err"
"backend_pid=$($be.Id) next_pid=$($fe.Id) logs=$logs"
