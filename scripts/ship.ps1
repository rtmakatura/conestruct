# ship.ps1 — one-command merge + deploy + verify for Conestruct
# Usage:
#   .\scripts\ship.ps1 -Branch issue-136-single-lane-block   (merge branch, then ship)
#   .\scripts\ship.ps1                                       (ship whatever main already is)
#   .\scripts\ship.ps1 -FrontendCheckOnly -SiteUrl <url> -Sha <sha>
#       (step 7 alone, read-only: is <url> serving a frontend current for <sha>?
#        No merge, no push, no deploy.)
#
# Stops loudly at the first problem. Never force-merges, never skips the health check.
# Blocks only on MODIFIED TRACKED files; untracked local files (specs, notes,
# scratch folders) are listed for awareness but never block a ship.

param(
    [string]$Branch = "",
    [switch]$FrontendCheckOnly,
    [string]$SiteUrl = "https://www.conestruct.com",
    [string]$Sha = "",
    [int]$FrontendTimeoutMin = 10
)

$ErrorActionPreference = "Stop"
$RepoDir   = "C:\Users\rtmak\Documents\traffic-control-tool"
$HealthUrl = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz"

function Fail($msg) {
    Write-Host ""
    Write-Host "SHIP FAILED: $msg" -ForegroundColor Red
    exit 1
}

# --- 7 (defined here, run after the backend verdict) -----------------------
# The served-frontend check (ship-loop ruling R3).  The public / page is
# outside the coming-soon gate, and its chunks carry the build's commit sha
# (NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA).  "Current" only if the served sha is
# HEAD, or git proves no change to the site or its inputs between the served
# sha and HEAD (a Vercel skip, conestruct/site/vercel-ignore.sh --
# the same list, read from that file).  Otherwise it polls, and after
# $FrontendTimeoutMin minutes it FAILS.  It never prints "current" on a timeout.
function Get-SiteInputs($root) {
    $script = Get-Content (Join-Path $root "conestruct\site\vercel-ignore.sh") -Raw
    $m = [regex]::Match($script, 'SITE_INPUTS=\(([\s\S]*?)\)')
    if (-not $m.Success) { Fail "SITE_INPUTS not found in conestruct/site/vercel-ignore.sh" }
    return @([regex]::Matches($m.Groups[1].Value, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
}

function Get-ServedShas($url, $root) {
    $html = (Invoke-WebRequest -Uri "$url/" -UseBasicParsing -TimeoutSec 30).Content
    $chunks = @([regex]::Matches($html, '/_next/static/chunks/[^"]+\.js') | ForEach-Object { $_.Value } | Sort-Object -Unique)
    $hex = @{}
    foreach ($c in $chunks) {
        $js = (Invoke-WebRequest -Uri "$url$c" -UseBasicParsing -TimeoutSec 30).Content
        foreach ($m in [regex]::Matches($js, '"([0-9a-f]{40})"')) { $hex[$m.Groups[1].Value] = $true }
    }
    # Other 40-hex strings live in the chunks too; the build sha is the one
    # that is a commit in this repo.  (Continue: in Windows PowerShell 5.1 a
    # native command's stderr under "Stop" throws, and cat-file -e on a
    # non-commit writes to stderr.)
    $ErrorActionPreference = "Continue"
    $shas = @()
    foreach ($h in $hex.Keys) {
        git -C $root cat-file -e "$h^{commit}" 2>$null
        if ($LASTEXITCODE -eq 0) { $shas += $h }
    }
    return $shas
}

function Test-Frontend($url, $head, $root, $timeoutMin) {
    $inputs = Get-SiteInputs $root
    $site = Join-Path $root "conestruct\site"
    $headShort = $head.Substring(0, 7)
    $ErrorActionPreference = "Continue"
    Write-Host "Checking the served frontend at $url (up to $timeoutMin min)..." -ForegroundColor Cyan
    $deadline = (Get-Date).AddMinutes($timeoutMin)
    while ($true) {
        $served = @()
        $note = ""
        try { $served = @(Get-ServedShas $url $root) } catch { $note = "(site unreachable: $($_.Exception.Message))" }
        if ($served -contains $head) {
            return "FRONTEND CURRENT: built at $headShort (the served sha is HEAD)."
        }
        if ($served.Count -eq 1) {
            $s = $served[0]
            git -C $site diff --quiet $s $head -- @inputs
            if ($LASTEXITCODE -eq 0) {
                return "FRONTEND CURRENT: served $($s.Substring(0, 7)); no change to the site or its inputs in $($s.Substring(0, 7))..$headShort (build skipped)."
            }
            $note = "served $($s.Substring(0, 7)); the site or its inputs changed since, waiting for the build of $headShort"
        } elseif ($served.Count -gt 1) {
            $note = "served chunks carry $($served.Count) commit shas ($(($served | ForEach-Object { $_.Substring(0, 7) }) -join ', ')), none of them HEAD"
        } elseif ($note -eq "") {
            $note = "no commit sha found in the served chunks"
        }
        if ((Get-Date) -ge $deadline) {
            Write-Host ""
            Write-Host "FRONTEND NOT VERIFIED" -ForegroundColor Red
            Write-Host "  HEAD is $head"
            Write-Host "  Last seen: $note"
            Write-Host "  The frontend was not current within $timeoutMin minutes. Do NOT close the issue. Paste this output into the chat."
            exit 1
        }
        Write-Host "  $note - retrying in 20 s..."
        Start-Sleep -Seconds 20
    }
}

if ($FrontendCheckOnly) {
    # Read-only: the repo this script lives in, no checkout, no merge.
    $root = Split-Path -Parent $PSScriptRoot
    if ($Sha -eq "") { Fail "-FrontendCheckOnly needs -Sha" }
    $full = (git -C $root rev-parse $Sha).Trim()
    Write-Host (Test-Frontend $SiteUrl $full $root $FrontendTimeoutMin) -ForegroundColor Green
    exit 0
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
Write-Host "main is now $headShort. Frontend: Vercel builds it, or skips it when nothing in the site changed (step 7 checks which)." -ForegroundColor Green

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

# --- 6. Backend verdict -----------------------------------------------------
Write-Host ""
if ($liveSha -ne $head) {
    Write-Host "SHIP NOT VERIFIED" -ForegroundColor Red
    Write-Host "  HEAD is $head"
    Write-Host "  Live is $liveSha"
    Write-Host "  The server did not pick up the new version within 3 minutes."
    Write-Host "  Do NOT close the issue. Paste this output into the chat."
    exit 1
}
Write-Host "  Backend live at $headShort (healthz sha matches HEAD)." -ForegroundColor Green

# --- 7. Frontend verdict (exits 1 on a timeout) -------------------------------
$frontend = Test-Frontend $SiteUrl $head $RepoDir $FrontendTimeoutMin

Write-Host ""
Write-Host "SHIP VERIFIED" -ForegroundColor Green
Write-Host "  Backend live at $headShort (healthz sha matches HEAD)."
Write-Host "  $frontend"
Write-Host "  Next: Ryan's browser check, then the close comment."