param([string]$Record = "0")
# Starts stub_backend.py with RENDER_API_SECRET = the site's MODAL_RENDER_SECRET
# and MAPBOX_TOKEN = NEXT_PUBLIC_MAPBOX_TOKEN, read raw from the main
# checkout's .env.local (never printed).
$S = "C:\Users\rtmak\AppData\Local\Temp\claude\556f937a78fa2516\92521d19-45de-4e19-973b-9d9aa353cccc\scratchpad\issue-507\walk"
$envf = Get-Content "C:\Users\rtmak\Documents\traffic-control-tool\conestruct\site\.env.local"
function val($k) { (($envf | Where-Object { $_ -match "^$k=" }) -replace "^$k=", '').Trim('"').Trim("'") }
$env:RENDER_API_SECRET = val 'MODAL_RENDER_SECRET'
$env:MAPBOX_TOKEN = val 'NEXT_PUBLIC_MAPBOX_TOKEN'
$env:STUB_RECORD = $Record
$env:PYTHONIOENCODING = "utf-8"
Set-Location "C:\Users\rtmak\Documents\traffic-control-tool\.claude\worktrees\issue-507"
uv run --extra dev python "$S\stub_backend.py" . "validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture;validation-artifacts/committed/ux-site-map/evidence/overpass-fixture;$S\backend-fixture" 8000 *> "$S\backend.log"
