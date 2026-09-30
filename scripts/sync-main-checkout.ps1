# sync-main-checkout.ps1 -- after SHIP VERIFIED, bring the main checkout's
# local main up to origin/main (ship-loop ruling R59: "I never run git by hand").
# Usage (the ship calls it from Complete-Ship, after the branch cleanup):
#   .\scripts\sync-main-checkout.ps1 -RepoDir <the main checkout>
#
# Fast-forward only, and only when that checkout is on main and clean: no
# modified tracked files (untracked and ignored files -- handoff.md, the
# prompt files -- don't count; the same rule the ship applies to its own
# worktree).  Anything else prints ONE line and skips:
#   main checkout not fast-forwarded: <why>
# It always exits 0: a skip or a failure here never un-verifies the ship.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$RepoDir
)

$ErrorActionPreference = "Continue"

function Skip($why) {
    Write-Host "main checkout not fast-forwarded: $why" -ForegroundColor Yellow
    exit 0
}

git -C $RepoDir fetch -q origin 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Skip "git fetch origin failed" }

$branch = "$(git -C $RepoDir branch --show-current 2>$null)".Trim()
if ($branch -eq "") { Skip "detached HEAD" }
if ($branch -ne "main") { Skip "on branch $branch" }

$modified = @(git -C $RepoDir status --porcelain --untracked-files=no 2>$null | Where-Object { "$_" -ne "" })
if ($modified.Count -gt 0) {
    $files = ($modified | ForEach-Object { "$_".Substring(3) }) -join ", "
    Skip "modified tracked files: $files"
}

$old = "$(git -C $RepoDir rev-parse main 2>$null)".Trim()
$new = "$(git -C $RepoDir rev-parse origin/main 2>$null)".Trim()
if ($old -eq "" -or $new -eq "") { Skip "could not read main or origin/main" }
if ($old -eq $new) {
    Write-Host "main checkout: already at $($new.Substring(0, 7))" -ForegroundColor Green
    exit 0
}
git -C $RepoDir merge-base --is-ancestor $old $new 2>$null
if ($LASTEXITCODE -ne 0) { Skip "not a fast-forward (main $($old.Substring(0, 7)), origin/main $($new.Substring(0, 7)))" }

$out = git -C $RepoDir merge -q --ff-only origin/main 2>&1 | ForEach-Object { "$_" }
if ($LASTEXITCODE -ne 0) { Skip "git refused the fast-forward: $(($out | Where-Object { $_ -ne '' }) -join ' ')" }
Write-Host "main checkout: $($old.Substring(0, 7)) -> $($new.Substring(0, 7)) (fast-forwarded)" -ForegroundColor Green
exit 0
