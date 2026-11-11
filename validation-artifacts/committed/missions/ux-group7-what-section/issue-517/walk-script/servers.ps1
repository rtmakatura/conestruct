param([string]$Action = "start")
# #517 walk: starts the stub backend (:8000) and the worktree's site (:3000)
# as two detached processes, each with Start-Process -WorkingDirectory (no
# `cd`), absolute paths only, logs into the extra folder.  Secrets are read
# raw from the worktree site's .env.local and never printed.  Prints the two
# PIDs.  `-Action stop` kills both process trees by the PIDs saved in pids.txt.
$WT = "C:\Users\rtmak\Documents\traffic-control-tool\.claude\worktrees\issue-517"
$WS = "$WT\validation-artifacts\committed\missions\ux-group7-what-section\issue-517\walk-script"
$EX = "C:\Users\rtmak\Documents\traffic-control-tool\validation-artifacts-extra\ux-group7-what-section\issue-517\walk-run"
$PIDS = "$EX\pids.txt"
if ($Action -eq "stop") {
  foreach ($p in (Get-Content $PIDS)) { & taskkill /PID $p /T /F 2>$null | Out-Null; "stopped tree $p" }
  return
}
$envf = Get-Content "$WT\conestruct\site\.env.local"
function val($k) { (($envf | Where-Object { $_ -match "^$k=" }) -replace "^$k=", '').Trim('"').Trim("'") }
$env:RENDER_API_SECRET = val 'MODAL_RENDER_SECRET'
$env:MAPBOX_TOKEN = val 'NEXT_PUBLIC_MAPBOX_TOKEN'
$env:STUB_RECORD = "0"
$env:PYTHONIOENCODING = "utf-8"
$fix = "$WT\validation-artifacts\committed\ux-group3-where\evidence\overpass-fixture;$WT\validation-artifacts\committed\ux-site-map\evidence\overpass-fixture;$EX\backend-fixture"
$be = Start-Process -FilePath "uv" -ArgumentList @("run", "--extra", "dev", "python", "`"$WS\stub_backend.py`"", "`"$WT`"", "`"$fix`"", "8000") `
  -WorkingDirectory $WT -RedirectStandardOutput "$EX\backend.out.log" -RedirectStandardError "$EX\backend.err.log" -WindowStyle Hidden -PassThru
Remove-Item Env:RENDER_API_SECRET, Env:MAPBOX_TOKEN
$site = Start-Process -FilePath "node" -ArgumentList @("`"$WS\launch-site.cjs`"", "`"$WT\conestruct\site`"", "`"$WT\conestruct\site\.env.local`"", "`"$WS\overpass-preload.cjs`"", "`"$EX\next-fixture`"", "3000", "replay") `
  -WorkingDirectory "$WT\conestruct\site" -RedirectStandardOutput "$EX\site.out.log" -RedirectStandardError "$EX\site.err.log" -WindowStyle Hidden -PassThru
Set-Content -Path $PIDS -Value @($be.Id, $site.Id) -Encoding ascii
"backend pid $($be.Id); site pid $($site.Id)"
