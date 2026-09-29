# branch-cleanup.ps1 -- after a verified ship, delete every branch already in
# the new main (ship-loop rulings R31, R32, R44).  ship.ps1 runs it after
# "SHIP VERIFIED" and never after a NOT VERIFIED verdict.
# Usage:
#   .\scripts\branch-cleanup.ps1 -Main <sha of the new main>
#
# What goes:
#   - every origin branch whose tip is an ancestor of -Main (stacked branches
#     too), except main; and (R44) every origin branch whose work reached main
#     by another route: `git cherry <main> <branch>` prints only "-" lines,
#     each commit patch-equivalent to one in main.  One "+" keeps it.  Each
#     is printed with its sha, so any branch can be restored:
#     git push origin <sha>:refs/heads/<name>
#   - the local branch of the same name, only if ITS tip is also in main (by
#     ancestry or by patch), and
#     its worktree, only if that worktree is under .claude\worktrees, is not
#     _ship, is clean and is not locked.
# What stays, listed under "Left for Ryan":
#   - a matching local branch or worktree it would not remove (dirty, locked,
#     outside .claude\worktrees, or local commits main lacks);
#   - an unmerged throwaway red-proof branch (R32): by convention its name ends
#     in -redproof, or has -redproof- in it.
# Any other unmerged branch is never touched and not listed.
#
# A worktree is removed only after every junction/symlink inside it is
# unlinked: the worktrees hold node_modules junctions into the main checkout,
# and deleting the worktree must not follow them (handoff.md, standing
# cautions).  Never `worktree remove --force`.
# Exit 0 when every removal it attempted succeeded; exit 1 if one failed.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Main,
    [string]$RepoDir = "C:\Users\rtmak\Documents\traffic-control-tool",
    [string]$Remote = "origin"
)

$ErrorActionPreference = "Continue"
$WorktreeRoot = [System.IO.Path]::GetFullPath((Join-Path $RepoDir ".claude\worktrees"))
$ShipPath = Join-Path $WorktreeRoot "_ship"
$Throwaway = '(^|-)redproof(-|$)'
$left = @()
$failed = 0

function Norm($p) { return [System.IO.Path]::GetFullPath(($p -replace '/', '\')).TrimEnd('\') }

function Test-InMain($sha) {
    git -C $RepoDir merge-base --is-ancestor $sha $Main 2>$null
    return ($LASTEXITCODE -eq 0)
}

# R44: the branch's work reached main by another route (cherry-picked,
# rebased): `git cherry` lists every commit main lacks by ancestry, and each
# one is patch-equivalent to a commit in main ("-").  One "+" keeps it.
function Test-Superseded($sha) {
    $lines = @(git -C $RepoDir cherry $Main $sha 2>$null)
    if ($LASTEXITCODE -ne 0 -or $lines.Count -eq 0) { return $false }
    foreach ($ln in $lines) { if (-not $ln.StartsWith("- ")) { return $false } }
    return $true
}

# In main by ancestry (R31) or by patch (R44).
function Test-Shipped($sha) { return ((Test-InMain $sha) -or (Test-Superseded $sha)) }

# Unlink (never follow) every junction or directory symlink under $dir.
function Remove-Links($dir) {
    foreach ($d in [System.IO.Directory]::GetDirectories($dir)) {
        $attr = [System.IO.File]::GetAttributes($d)
        if ($attr -band [System.IO.FileAttributes]::ReparsePoint) {
            [System.IO.Directory]::Delete($d, $false)
            Write-Host "  unlinked $d (a link; its target is untouched)"
        } elseif ((Split-Path $d -Leaf) -ne ".git") {
            Remove-Links $d
        }
    }
}

$Main = (git -C $RepoDir rev-parse $Main).Trim()
Write-Host ""
Write-Host "Branch cleanup (R31, R44): branches already in main $($Main.Substring(0, 7)), by ancestry or by patch" -ForegroundColor Cyan

git -C $RepoDir fetch --prune $Remote 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "  git fetch $Remote failed; cleanup skipped." -ForegroundColor Yellow; exit 1 }

# Worktrees: path -> @{ branch; locked }
$worktrees = @{}
$cur = $null
foreach ($ln in (git -C $RepoDir worktree list --porcelain)) {
    if ($ln -like "worktree *") { $cur = @{ path = (Norm $ln.Substring(9)); branch = ""; locked = $false }; $worktrees[$cur.path] = $cur }
    elseif ($ln -like "branch refs/heads/*") { $cur.branch = $ln.Substring(18) }
    elseif ($ln -like "locked*") { $cur.locked = $true }
}

$refs = git -C $RepoDir for-each-ref "--format=%(refname:strip=3) %(objectname)" "refs/remotes/$Remote"
$removed = 0
foreach ($r in $refs) {
    $name, $sha = $r -split ' ', 2
    if ($name -eq "HEAD" -or $name -eq "main" -or $name -eq "") { continue }
    if (-not (Test-Shipped $sha)) {
        if ($name -match $Throwaway) { $left += "$name at $sha -- unmerged throwaway red-proof branch (R32); delete it on origin when done" }
        continue
    }

    # origin: gh-only push (R27), with a lease on the sha just checked.
    git -C $RepoDir -c credential.helper= -c "credential.helper=!gh auth git-credential" push $Remote "--force-with-lease=refs/heads/${name}:$sha" ":refs/heads/$name" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host "  FAILED to delete $Remote/$name at $sha" -ForegroundColor Red; $failed++; continue }
    Write-Host "  deleted $Remote/$name at $sha   (restore: git push $Remote ${sha}:refs/heads/$name)"
    $removed++

    # The local branch of the same name.
    $localSha = (git -C $RepoDir rev-parse -q --verify "refs/heads/$name" 2>$null)
    if (-not $localSha) { continue }
    $localSha = $localSha.Trim()
    if (-not (Test-Shipped $localSha)) { $left += "$name -- local branch at $localSha has commits main lacks; kept"; continue }

    $wt = $worktrees.Values | Where-Object { $_.branch -eq $name } | Select-Object -First 1
    if ($wt) {
        $p = $wt.path
        $inRoot = $p.StartsWith($WorktreeRoot + "\", [System.StringComparison]::OrdinalIgnoreCase)
        if (-not $inRoot -or $p -ieq $ShipPath) { $left += "$name -- checked out at $p, outside .claude\worktrees; local branch kept at $localSha"; continue }
        if ($wt.locked) { $left += "$name -- worktree $p is locked (a live session?); worktree and local branch kept at $localSha"; continue }
        $dirty = git -C $p status --porcelain 2>$null
        if ($dirty) { $left += "$name -- worktree $p has uncommitted changes; worktree and local branch kept at $localSha"; continue }
        Remove-Links $p
        git -C $RepoDir worktree remove $p 2>&1 | ForEach-Object { Write-Host "    $_" }
        if ($LASTEXITCODE -ne 0) { Write-Host "  FAILED to remove worktree $p" -ForegroundColor Red; $failed++; $left += "$name -- worktree $p could not be removed; local branch kept at $localSha"; continue }
        Write-Host "  removed worktree $p"
    }
    git -C $RepoDir branch -D $name 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host "  FAILED to delete local $name" -ForegroundColor Red; $failed++; continue }
    Write-Host "  deleted local $name at $localSha"
}

if ($removed -eq 0) { Write-Host "  no merged branches on $Remote." }
if ($left.Count -gt 0) {
    Write-Host "Left for Ryan:" -ForegroundColor Yellow
    $left | ForEach-Object { Write-Host "  $_" }
}
if ($failed -gt 0) { exit 1 }
exit 0
