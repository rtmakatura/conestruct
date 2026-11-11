# Sets the local gate token from the worktree site's .env.local (raw, never
# printed) and runs a node script (absolute path) with the rest of the args.
#   powershell -File run.ps1 <script.mjs> <arg> <arg> ...
$raw = (Get-Content "C:\Users\rtmak\Documents\traffic-control-tool\.claude\worktrees\issue-517\conestruct\site\.env.local" | Where-Object { $_ -match '^GATE_BYPASS_TOKEN=' }) -replace '^GATE_BYPASS_TOKEN=',''
$env:GATE_BYPASS_TOKEN = $raw.Trim('"').Trim("'")
$script = $args[0]
$rest = @($args | Select-Object -Skip 1)
node $script @rest
