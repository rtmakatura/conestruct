# vercel-env-check.ps1 -- does Vercel Production have every variable the site
# needs at runtime?  (ship-loop ruling R29.)  Read-only: it lists names, never
# values, and changes nothing.
# Usage:
#   .\scripts\vercel-env-check.ps1                     (the list next to this script)
#   .\scripts\vercel-env-check.ps1 -Required <file>    (another copy of the list)
#
# Exit 0: every "required" name in the list has a Production row.
# Exit 1: the CLI is not logged in, the listing failed or was empty, or a name
#         is missing.  The ship runs this before its merge and stops on exit 1.
#
# Why: on 2026-09-28 CLERK_SECRET_KEY had only a Preview row.  Env changes reach
# only new builds, so production kept working until the next ship, whose build
# answered 500 on every route (rulings.md, R28).
#
# The CLI runs from the main checkout's conestruct\site: the Vercel project
# link (.vercel\repo.json) lives at the main checkout's root, untracked, and
# the ship worktree has none.

[CmdletBinding()]
param(
    [string]$Required = "",
    [string]$SiteDir = "C:\Users\rtmak\Documents\traffic-control-tool\conestruct\site",
    # Test seam: a stand-in for the Vercel CLI (tests/test_vercel_env_check.py).
    [string]$Vercel = ""
)

$ErrorActionPreference = "Continue"

function Stop-Check($msg) {
    Write-Host "PRODUCTION ENV CHECK FAILED: $msg" -ForegroundColor Red
    exit 1
}

# vercel@61.0.0 is chosen, not sourced: the version whose output this parser
# was proven on (r29-redproof.md).  A newer CLI with a changed layout would
# fail this check closed, never open.
function Invoke-Vercel([string[]]$cliArgs) {
    if ($Vercel -ne "") {
        return & $Vercel @cliArgs 2>&1 | ForEach-Object { "$_" }
    }
    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) { Stop-Check "npx is not on PATH, so the Vercel CLI can't run." }
    return & npx --yes vercel@61.0.0 @cliArgs --non-interactive --cwd $SiteDir 2>&1 | ForEach-Object { "$_" }
}

# The list: "required  NAME  cites -- why" lines (scripts/production-env.txt).
# (Defaulted here, not in param(): Windows PowerShell 5.1 leaves $PSScriptRoot
# empty while it binds parameter defaults.)
if ($Required -eq "") { $Required = Join-Path $PSScriptRoot "production-env.txt" }
if (-not (Test-Path $Required)) { Stop-Check "the list $Required does not exist." }
$names = @(Get-Content $Required | ForEach-Object {
    $f = "$_".Trim() -split '\s+'
    if ($f.Count -ge 2 -and $f[0] -eq "required") { $f[1] }
})
if ($names.Count -eq 0) { Stop-Check "the list $Required has no required names." }

# Logged in?  whoami comes first because, logged out, `vercel env ls` does not
# fail: it starts a device login and waits (probed 2026-09-28, r29-redproof.md).
$who = Invoke-Vercel @("whoami")
if ($LASTEXITCODE -ne 0) {
    $who | ForEach-Object { Write-Host "  $_" }
    Stop-Check "the Vercel CLI is not logged in. Run: npx vercel@61.0.0 login"
}

$listing = Invoke-Vercel @("env", "ls", "production")
if ($LASTEXITCODE -ne 0) {
    $listing | ForEach-Object { Write-Host "  $_" }
    Stop-Check "vercel env ls production failed."
}

# A row is "NAME  value  type  environments  created".  Colour codes stripped,
# and a row counts only if its environments column says Production.
$present = @{}
foreach ($line in $listing) {
    $plain = $line -replace '\x1b\[[0-9;]*[A-Za-z]', ''
    $m = [regex]::Match($plain, '^\s*([A-Z][A-Z0-9_]*)\s{2,}.*\bProduction\b')
    if ($m.Success) { $present[$m.Groups[1].Value] = $true }
}
if ($present.Count -eq 0) {
    $listing | ForEach-Object { Write-Host "  $_" }
    Stop-Check "vercel env ls production listed no Production variables."
}

$missing = @($names | Where-Object { -not $present.ContainsKey($_) })
if ($missing.Count -gt 0) {
    Write-Host "MISSING from Production:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  $_" }
    Write-Host "Add each in Vercel -> conestruct -> Settings -> Environment Variables, scoped Production, then redeploy."
    Stop-Check "$($missing.Count) required variable(s) missing: $($missing -join ', ')."
}

Write-Host "Production env: all $($names.Count) required variables present." -ForegroundColor Green
exit 0
