# branch-cleanup.ps1 -- after a verified ship, delete every branch already in
# the new main (ship-loop rulings R31, R32, R44, R46, R47).  ship.ps1 runs it after
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
#     in -redproof, or has -redproof- in it -- unless a committed red-proof doc
#     records its last sha, in which case it goes (R47).
# Any other unmerged branch is never touched.  On origin it is not listed; a
# local-only one is real work and is listed once per ship (R47).
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

# R47: a throwaway red-proof branch whose last sha a committed red-proof doc
# records: a file under validation-artifacts/committed/ with "redproof" in its
# name that, in the new main, names the branch and at least the first seven
# characters of its tip.  The doc is where its restore sha lives.
function Test-Recorded($name, $sha) {
    $files = @(git -C $RepoDir grep -l -F -e $sha.Substring(0, 7) $Main -- ":(glob)validation-artifacts/committed/**/*redproof*" 2>$null)
    foreach ($f in $files) {
        $path = $f.Substring($Main.Length + 1)
        $text = (git -C $RepoDir show "${Main}:$path" 2>$null) -join "`n"
        if ($text.Contains($name)) { return $true }
    }
    return $false
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
Write-Host "Branch cleanup (R31, R44, R46, R47): branches already in main $($Main.Substring(0, 7)), by ancestry, by patch or by superseded.txt; local-only and recorded throwaways too" -ForegroundColor Cyan

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

# Delete one branch whose work main carries: origin first, through the
# gh-only push (R27) with a lease on $sha, then the local branch of the same
# name and its worktree under R31's rules.  $localOk says whether the local
# tip may go too.  Everything it would not remove goes to "Left for Ryan".
function Remove-Branch($name, $sha, $localOk) {
    if ($sha) {
        git -C $RepoDir -c credential.helper= -c "credential.helper=!gh auth git-credential" push $Remote "--force-with-lease=refs/heads/${name}:$sha" ":refs/heads/$name" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { Write-Host "  FAILED to delete $Remote/$name at $sha" -ForegroundColor Red; $script:failed++; return }
        Write-Host "  deleted $Remote/$name at $sha   (restore: git push $Remote ${sha}:refs/heads/$name)"
        $script:removed++
    }

    # The local branch of the same name.
    $localSha = (git -C $RepoDir rev-parse -q --verify "refs/heads/$name" 2>$null)
    if (-not $localSha) { return }
    $localSha = $localSha.Trim()
    if (-not (& $localOk $localSha)) { $script:left += "$name -- local branch at $localSha has commits main lacks; kept"; return }

    $wt = $worktrees.Values | Where-Object { $_.branch -eq $name } | Select-Object -First 1
    if ($wt) {
        $p = $wt.path
        $inRoot = $p.StartsWith($WorktreeRoot + "\", [System.StringComparison]::OrdinalIgnoreCase)
        if (-not $inRoot -or $p -ieq $ShipPath) { $script:left += "$name -- checked out at $p, outside .claude\worktrees; local branch kept at $localSha"; return }
        if ($wt.locked) { $script:left += "$name -- worktree $p is locked (a live session?); worktree and local branch kept at $localSha"; return }
        $dirty = git -C $p status --porcelain 2>$null
        if ($dirty) { $script:left += "$name -- worktree $p has uncommitted changes; worktree and local branch kept at $localSha"; return }
        Remove-Links $p
        git -C $RepoDir worktree remove $p 2>&1 | ForEach-Object { Write-Host "    $_" }
        if ($LASTEXITCODE -ne 0) { Write-Host "  FAILED to remove worktree $p" -ForegroundColor Red; $script:failed++; $script:left += "$name -- worktree $p could not be removed; local branch kept at $localSha"; return }
        Write-Host "  removed worktree $p"
    }
    git -C $RepoDir branch -D $name 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host "  FAILED to delete local $name" -ForegroundColor Red; $script:failed++; return }
    Write-Host "  deleted local $name at $localSha   (restore: git branch $name $localSha)"
}

$refs = git -C $RepoDir for-each-ref "--format=%(refname:strip=3) %(objectname)" "refs/remotes/$Remote"
$origin = @{}
foreach ($r in $refs) { $n, $h = $r -split ' ', 2; if ($n) { $origin[$n] = $h } }
$removed = 0
$handled = @{}  # names the origin loops already judged, local side included
foreach ($name in @($origin.Keys | Sort-Object)) {
    $sha = $origin[$name]
    if ($name -eq "HEAD" -or $name -eq "main" -or $name -eq "") { continue }
    if (-not (Test-Shipped $sha)) {
        if ($name -match $Throwaway) {
            if (Test-Recorded $name $sha) {
                Remove-Branch $name $sha ([scriptblock]::Create("param(`$s) `$s -eq '$sha'"))
                $handled[$name] = $true
                $origin.Remove($name)
            } else {
                $left += "$name at $sha -- unmerged throwaway red-proof branch (R32); its sha is in no committed redproof doc, so kept"
            }
        }
        continue
    }
    Remove-Branch $name $sha { param($s) Test-Shipped $s }
    $handled[$name] = $true
    $origin.Remove($name)
}

# R46: branches a restacked or rebuilt branch says it carries, listed in
# scripts/superseded.txt on the new main as `<branch> <sha> -- why`.  A
# conflict resolution changes a commit's patch, so neither ancestry nor
# `git cherry` can see such a branch as shipped; the list, now in main, is
# the record.  A listed branch goes only while it still sits at the listed
# sha: one that moved since carries work the list never saw, and is kept
# and listed.  main is never deleted, whatever the list says.
$listed = @(git -C $RepoDir show "${Main}:scripts/superseded.txt" 2>$null)
foreach ($ln in $listed) {
    $t = $ln.Trim()
    if (-not $t -or $t.StartsWith("#")) { continue }
    $f = $t -split '\s+'
    if ($f.Count -lt 2) { continue }
    $name, $want = $f[0], $f[1]
    if ($name -eq "HEAD" -or $name -eq "main") { continue }
    $sha = $origin[$name]
    $localSha = (git -C $RepoDir rev-parse -q --verify "refs/heads/$name" 2>$null)
    if (-not $sha -and -not $localSha) { continue }  # already gone
    if ($sha -and $sha -ne $want) { $left += "$name at $sha -- listed in superseded.txt at $want, but it moved since it was listed; kept"; continue }
    Remove-Branch $name $sha ([scriptblock]::Create("param(`$s) `$s -eq '$want'"))
    $handled[$name] = $true
    $origin.Remove($name)
}

# R47: local branches with no origin twin, which the loops above never see.
# In main (by ancestry or patch): they go, under the same worktree rules.  A
# throwaway red-proof branch goes when a committed red-proof doc records its
# last sha; otherwise it stays and is listed.  Anything else is real work: it
# is never touched, and is listed once, below.  A name the origin loops
# already judged (its local side kept or deleted there) is not judged again.
$unmerged = @()
foreach ($ln in @(git -C $RepoDir for-each-ref "--format=%(refname:short) %(objectname)" refs/heads)) {
    $name, $sha = $ln -split ' ', 2
    if (-not $name -or $name -eq "main" -or $name -eq "HEAD") { continue }
    if ($origin.ContainsKey($name) -or $handled.ContainsKey($name)) { continue }
    if (Test-Shipped $sha) { Remove-Branch $name $null { param($s) Test-Shipped $s }; continue }
    if ($name -match $Throwaway) {
        if (Test-Recorded $name $sha) { Remove-Branch $name $null ([scriptblock]::Create("param(`$s) `$s -eq '$sha'")) }
        else { $left += "$name at $sha -- throwaway red-proof branch, local only; its sha is in no committed redproof doc, so kept" }
        continue
    }
    $unmerged += "$name at $sha"
}

if ($removed -eq 0) { Write-Host "  no merged or superseded branches on $Remote." }
if ($left.Count -gt 0) {
    Write-Host "Left for Ryan:" -ForegroundColor Yellow
    $left | ForEach-Object { Write-Host "  $_" }
}
if ($unmerged.Count -gt 0) {
    Write-Host "Unmerged work, kept (R47):" -ForegroundColor Yellow
    $unmerged | ForEach-Object { Write-Host "  $_ -- local only, not in main; never touched" }
}
if ($failed -gt 0) { exit 1 }
exit 0
