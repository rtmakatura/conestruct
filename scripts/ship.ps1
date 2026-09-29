# ship.ps1 — one-command merge + deploy + verify for Conestruct
# Usage:
#   .\scripts\ship.ps1 -Branch issue-136-single-lane-block   (merge branch, then ship)
#   .\scripts\ship.ps1                                       (ship whatever main already is)
#   .\scripts\ship.ps1 -Branch <name> -DryRun               (steps 1-2 only: print what
#                                                             would ship, push nothing)
#   .\scripts\ship.ps1 -FrontendCheckOnly -SiteUrl <url> -Sha <sha>
#       (step 7 alone, read-only: is <url> serving a frontend current for <sha>?
#        No merge, no push, no deploy.)
#
# Where it works (ship-loop ruling R4, validation-artifacts/committed/ship-loop/):
# a dedicated ship worktree, .claude\worktrees\_ship, detached at origin/main and
# created on first use.  Nobody's checkout is touched.  It merges origin/<branch>
# (so the branch must be pushed) and pushes HEAD:main.  A copy of this script that
# differs from main's hands over to main's copy, so a stale copy never ships.
# CC may run it only after Ryan's "ship <branch>" go; the ship_gate PreToolUse
# hook (scripts/hooks/ship_gate.py) enforces that.
#
# Stops loudly at the first problem. Never force-merges, never skips the health check.
# Blocks only on MODIFIED TRACKED files in the ship worktree.

# CmdletBinding: an unknown parameter is an ERROR.  Without it PowerShell drops
# unknown arguments into $args silently, and a script that ignored -DryRun would
# ship for real.
[CmdletBinding()]
param(
    [string]$Branch = "",
    [switch]$DryRun,
    [switch]$FrontendCheckOnly,
    [string]$SiteUrl = "https://www.conestruct.com",
    [string]$Sha = "",
    [int]$FrontendTimeoutMin = 10,
    [switch]$Handoff
)

$ErrorActionPreference = "Stop"
$RepoDir   = "C:\Users\rtmak\Documents\traffic-control-tool"
$ShipDir   = Join-Path $RepoDir ".claude\worktrees\_ship"
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

# Git reports progress on stderr; in Windows PowerShell 5.1 native stderr under
# "Stop" throws.  From here every git call is checked by its exit code instead.
$ErrorActionPreference = "Continue"

# --- 1. The ship worktree, at origin/main -------------------------------------
git -C $RepoDir fetch origin 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "git fetch origin failed. Paste the output into the chat." }

if (-not (Test-Path (Join-Path $ShipDir ".git"))) {
    Write-Host "Creating the ship worktree at $ShipDir (first use)..." -ForegroundColor Cyan
    git -C $RepoDir worktree add --detach $ShipDir origin/main 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "Could not create the ship worktree at $ShipDir." }
}
Set-Location $ShipDir

# Nothing is ever edited in the ship worktree; a tracked change there is a ghost.
$trackedChanges = git status --porcelain | Where-Object { $_ -ne "" -and -not $_.StartsWith("??") }
if ($trackedChanges) {
    Write-Host "Modified tracked files in the ship worktree:" -ForegroundColor Yellow
    $trackedChanges | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    Fail "The ship worktree has tracked edits. Nothing should edit it; look before discarding."
}
git checkout -q --detach origin/main 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "Could not reset the ship worktree to origin/main." }

# A stale copy of this script hands over to main's copy (same arguments).
$mainCopy = Join-Path $ShipDir "scripts\ship.ps1"
if (-not $Handoff -and ((Get-FileHash $PSCommandPath).Hash -ne (Get-FileHash $mainCopy).Hash)) {
    # Hand over only to a copy that understands -Handoff (and so -DryRun and
    # CmdletBinding).  An older main copy would silently ignore those flags and
    # ship for real: stop instead.
    if (-not (Select-String -Path $mainCopy -Pattern '\[switch\]\$Handoff' -Quiet)) {
        Fail "main's ship.ps1 predates the ship worktree (no -Handoff). Run main's copy directly as before; this copy will not hand over to it."
    }
    Write-Host "This ship.ps1 differs from main's; handing over to $mainCopy" -ForegroundColor DarkGray
    $handArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $mainCopy, "-Handoff",
                  "-SiteUrl", $SiteUrl, "-FrontendTimeoutMin", $FrontendTimeoutMin)
    if ($Branch -ne "") { $handArgs += @("-Branch", $Branch) }
    if ($DryRun) { $handArgs += "-DryRun" }
    & powershell @handArgs
    exit $LASTEXITCODE
}

# --- 1b. gh login (R27) ------------------------------------------------------
# The push goes through gh only (step 3), so a bad gh login stops the ship here,
# before anything moves.  Get-Command first: a missing gh would leave
# $LASTEXITCODE at the last git call's 0 and the check would pass silently.
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Fail "gh is not on PATH. The push goes through gh (R27); install gh, run gh auth login, then ship again. Nothing was merged or pushed." }
$ghLogin = gh auth status --hostname github.com 2>&1 | ForEach-Object { "$_" }
if ($LASTEXITCODE -ne 0) { $ghLogin | ForEach-Object { Write-Host "  $_" }; Fail "gh is not logged in to github.com. Run gh auth login, then ship again. Nothing was merged or pushed." }

# --- 1c. Vercel Production env (R29) -----------------------------------------
# Every variable the site needs at runtime must have a Production row before
# anything moves.  On 2026-09-28 a Preview-only CLERK_SECRET_KEY sent every
# route to 500 on the first production build after that change (rulings.md, R28).
# The list comes from the commit being shipped, so a branch that adds a
# variable is checked against its own list.
$listRef = if ($Branch -ne "") { "origin/$Branch" } else { "HEAD" }
$envList = Join-Path $env:TEMP "conestruct-production-env.txt"
git show ($listRef + ":scripts/production-env.txt") | Set-Content -Encoding utf8 $envList
if ($LASTEXITCODE -ne 0) { Fail "Could not read scripts/production-env.txt at $listRef. Push the branch, rebased on main, then ship again. Nothing was merged or pushed." }
Write-Host "Checking Vercel Production has every variable the site needs (R29)..." -ForegroundColor Cyan
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ShipDir "scripts\vercel-env-check.ps1") -Required $envList
if ($LASTEXITCODE -ne 0) { Fail "Vercel Production is missing a variable the site needs, or the Vercel CLI is not logged in (the check's output is above). Fix it, then ship again. Nothing was merged or pushed." }

# --- 2. Merge the pushed branch (fast-forward only) ---------------------------
if ($Branch -ne "") {
    git rev-parse --verify -q "origin/$Branch" | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "origin/$Branch does not exist. Push the branch first; a ship merges what was pushed." }
    Write-Host "Merging origin/$Branch into main (fast-forward only)..." -ForegroundColor Cyan
    git merge -q --ff-only "origin/$Branch"
    if ($LASTEXITCODE -ne 0) {
        git checkout -q --detach origin/main 2>&1 | Out-Null
        Fail "Fast-forward merge failed - main and $Branch have diverged. Rebase the branch onto main and push it, then ship again."
    }
}
$head = (git rev-parse HEAD).Trim()
$headShort = $head.Substring(0, 7)

if ($DryRun) {
    Write-Host ""
    Write-Host "DRY RUN: would push $headShort to main and deploy it. The commits:" -ForegroundColor Cyan
    git log --oneline origin/main..HEAD | ForEach-Object { Write-Host "  $_" }
    git checkout -q --detach origin/main 2>&1 | Out-Null
    Write-Host "DRY RUN: nothing pushed, nothing deployed; the ship worktree is back at origin/main." -ForegroundColor Cyan
    exit 0
}

# --- 3. Push ----------------------------------------------------------------
Write-Host "Pushing $headShort to main..." -ForegroundColor Cyan
# gh only (R27): the empty helper first clears the Git Credential Manager, which
# otherwise runs first, finds two github.com accounts and fails trying to ask
# which (r26-r27-redproof.md).  -c appends, so the clear is load-bearing.
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin HEAD:main
if ($LASTEXITCODE -ne 0) { Fail "git push failed. Paste the output into the chat." }
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
$frontend = Test-Frontend $SiteUrl $head $ShipDir $FrontendTimeoutMin

Write-Host ""
Write-Host "SHIP VERIFIED" -ForegroundColor Green
Write-Host "  Backend live at $headShort (healthz sha matches HEAD)."
Write-Host "  $frontend"
Write-Host "  Next: Ryan's browser check, then the close comment."