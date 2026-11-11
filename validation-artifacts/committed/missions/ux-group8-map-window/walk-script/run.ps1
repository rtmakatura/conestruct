param([string]$Script, [string[]]$Rest)
# Sets the local gate token from the main checkout's .env.local (raw, never
# printed) and runs a node script with the given args.
$raw = (Get-Content "C:\Users\rtmak\Documents\traffic-control-tool\conestruct\site\.env.local" | Where-Object { $_ -match '^GATE_BYPASS_TOKEN=' }) -replace '^GATE_BYPASS_TOKEN=',''
$env:GATE_BYPASS_TOKEN = $raw.Trim('"').Trim("'")
node $Script @Rest
