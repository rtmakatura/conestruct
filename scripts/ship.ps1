# ship.ps1 — one-command merge + deploy + verify for Conestruct
# Usage:
#   .\scripts\ship.ps1 -Branch issue-136-single-lane-block   (merge branch, then ship)
#   .\scripts\ship.ps1                                       (ship whatever main already is)
#
# Stops loudly at the first problem. Never force-merges, never skips the health check.
# Blocks only on MODIFIED TRACKED files; untracked local files (specs, notes,
# scratch folders) are listed for awareness but never block a ship.

param(
    [string]$Branch = ""
)

$ErrorActionPreference = "Stop"
$RepoDir   = "C:\Users\rtmak\Documents\traffic-control-tool"
$HealthUrl = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz"

function Fail($msg) {
    Write-Host ""
    Write-Host "SHIP FAILED: $msg" -ForegroundColor Red
    exit 1
}

Set-Location $RepoDir

# --- 1. Sanity checks -------------------------------------------------------
$current = (git rev-parse --abbrev-ref HEAD).Trim()
if ($current -ne "main") {
    git checkout main | Out-Null
}

# Split status into tracked changes (block) vs untracked files (inform only).
$statusLines = git status --porcelain | Where-Object { $_ -ne "" }
$trackedChanges = $statusLines | Where-Object { -not $_.StartsWith("??") }
$untracked      = $statusLines | Where-Object { $_.StartsWith("??") }

if ($untracked) {
    Write-Host "Untracked local files (not blocking, just so you know):" -ForegroundColor DarkGray
    $untracked | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
}

if ($trackedChanges) {
    Write-Host "Modified tracked files:" -ForegroundColor Yellow
    $trackedChanges | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    Fail "Tracked files have uncommitted changes. Commit or discard these first (unexplained edits are how we chase ghosts)."
}

git fetch origin | Out-Null

# --- 2. Merge (only if a branch was given) ----------------------------------
if ($Branch -ne "") {
    Write-Host "Merging $Branch into main (fast-forward only)..." -ForegroundColor Cyan
    git merge --ff-only $Branch
    if ($LASTEXITCODE -ne 0) {
        Fail "Fast-forward merge failed - main and $Branch have diverged. Paste this output into the chat; the usual fix is a cherry-pick, but let's look first."
    }
}

# --- 3. Push ----------------------------------------------------------------
Write-Host "Pushing main..." -ForegroundColor Cyan
git push
if ($LASTEXITCODE -ne 0) { Fail "git push failed. Paste the output into the chat." }

$head = (git rev-parse HEAD).Trim()
$headShort = $head.Substring(0, 7)
Write-Host "main is now $headShort. Frontend: Vercel deploys this automatically (~2 min)." -ForegroundColor Green

# --- 4. Backend deploy ------------------------------------------------------
$modal = Join-Path $RepoDir ".venv\Scripts\modal.exe"
if (-not (Test-Path $modal)) { Fail "Can't find modal at $modal - is the venv set up?" }

Write-Host "Deploying backend to Modal..." -ForegroundColor Cyan
& $modal deploy modal_app.py
if ($LASTEXITCODE -ne 0) { Fail "modal deploy failed. Paste the output into the chat." }

# --- 5. Health check with retry (handles the warm-server echo) --------------
Write-Host "Waiting for the live server to report the new version..." -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes(3)
$liveSha = ""
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 10
    try {
        $resp = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 15
        $liveSha = $resp.sha
    } catch {
        $liveSha = "(healthz unreachable, retrying)"
    }
    if ($liveSha -eq $head) { break }
    Write-Host "  live: $liveSha - not yet $headShort, retrying..."
}

# --- 6. Verdict -------------------------------------------------------------
Write-Host ""
if ($liveSha -eq $head) {
    Write-Host "SHIP VERIFIED" -ForegroundColor Green
    Write-Host "  Backend live at $headShort (healthz sha matches HEAD)."
    Write-Host "  Frontend: give Vercel ~2 minutes if this commit touched site/."
    Write-Host "  Next: run the smoke test, then post the close comment."
} else {
    Write-Host "SHIP NOT VERIFIED" -ForegroundColor Red
    Write-Host "  HEAD is $head"
    Write-Host "  Live is $liveSha"
    Write-Host "  The server did not pick up the new version within 3 minutes."
    Write-Host "  Do NOT close the issue. Paste this output into the chat."
    exit 1
}