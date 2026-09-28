# preview-url.ps1 -- the Vercel preview URL for a branch, printed only when the
# preview serves the branch tip.  Read-only: git fetch, gh api GETs, HTTPS GETs.
# Usage:
#   .\scripts\preview-url.ps1 -Branch <name>
#       Prints the report line CC puts directly above result: (ship-loop R20):
#         preview: <url> -- serves <sha> = branch tip (checked in the bundle); frontend-only: yes|no
#       or, when Vercel skipped the build, "preview: none -- ..." (exit 0),
#       or "PREVIEW NOT VERIFIED" (exit 1) on a failed build or after -TimeoutMin.
#   .\scripts\preview-url.ps1 -DecideFromJson <file>
#       The same decision on recorded inputs, one pass, no network (tests/test_preview_url.py).
#   .\scripts\preview-url.ps1 -ParseGhListFromFile <file>
#       How a recorded `gh api` list body parses: its item count and ids (tests).
#
# Why a separate script (validation-artifacts/committed/ship-loop/checkpoint-1.md §5):
# the ship_gate hook refuses any command naming ship.ps1, even its read-only
# -FrontendCheckOnly mode.  And a preview passes on the exact tip only: there is no
# "no frontend change since" clause here, so a preview of an older commit is never shown.
#
# The poll bounds (10 min, 20 s) are chosen, copied from R3, not sourced (R21).

[CmdletBinding()]
param(
    [string]$Branch = "",
    [int]$TimeoutMin = 10,
    [int]$PollSec = 20,
    [string]$DecideFromJson = "",
    [string]$ParseGhListFromFile = ""
)

$ErrorActionPreference = "Stop"
$Repo = "rtmakatura/conestruct"
$Root = Split-Path -Parent $PSScriptRoot
$SkipText = "Canceled by Ignored Build Step"

function Fail($msg) {
    Write-Host "PREVIEW NOT VERIFIED" -ForegroundColor Red
    Write-Host "  $msg"
    exit 1
}

# --- frontend-only (R7, R20) -------------------------------------------------
# "yes" only if every file the branch changes is a site input: the SITE_INPUTS
# list in conestruct/site/vercel-ignore.sh (paths relative to conestruct/site),
# the one list ship.ps1 and the Vercel skip rule also read.  Anything else --
# backend, scripts, docs -- is "no", so the branch keeps today's prod path.
function Get-SiteInputPrefixes($root) {
    $script = Get-Content (Join-Path $root "conestruct\site\vercel-ignore.sh") -Raw
    $m = [regex]::Match($script, 'SITE_INPUTS=\(([\s\S]*?)\)')
    if (-not $m.Success) { Fail "SITE_INPUTS not found in conestruct/site/vercel-ignore.sh" }
    return @([regex]::Matches($m.Groups[1].Value, '"([^"]+)"') | ForEach-Object {
        $p = $_.Groups[1].Value
        if ($p -eq ".") { "conestruct/site" }
        elseif ($p.StartsWith("../../")) { $p.Substring(6).TrimEnd("/") }
        else { "conestruct/site/" + $p.TrimStart("./").TrimEnd("/") }
    })
}

function Get-FrontendOnly($files, $prefixes) {
    if (@($files).Count -eq 0) { return "no" }
    foreach ($f in $files) {
        $hit = $false
        foreach ($p in $prefixes) {
            if ($f -eq $p -or $f.StartsWith("$p/")) { $hit = $true; break }
        }
        if (-not $hit) { return "no" }
    }
    return "yes"
}

# --- the decision -------------------------------------------------------------
# $deployments: the tip's Preview deployments, newest first, each with its
# statuses newest first (GitHub's order).  $commitStatuses: the tip's commit
# statuses, newest first.  $served: the commit shas in the preview's chunks, or
# $null when there was no URL to read.  Returns kind ok | skipped | failed | wait.
function Get-Decision($tip, $deployments, $commitStatuses, $served) {
    $short = $tip.Substring(0, 7)
    # Where-Object drops the $null that @() makes of an empty PowerShell result.
    $deps = @(@($deployments) | Where-Object { $_ })
    if ($deps.Count -gt 0) {
        $st = @(@($deps[0].statuses) | Where-Object { $_ })
        if ($st.Count -gt 0) {
            $s = $st[0]
            if ($s.state -eq "success" -and $s.environment_url) {
                $url = $s.environment_url
                if ($null -eq $served) { return @{ kind = "wait"; url = $url; note = "$url could not be read yet" } }
                if (@($served) -contains $tip) { return @{ kind = "ok"; url = $url } }
                $seen = (@($served) | ForEach-Object { $_.Substring(0, 7) }) -join ", "
                if ($seen -eq "") { $seen = "no commit sha" }
                return @{ kind = "wait"; url = $url; note = "$url serves $seen, not the tip $short" }
            }
            if ($s.state -eq "failure" -or $s.state -eq "error") {
                return @{ kind = "failed"; note = "the Preview deployment of $short ended in '$($s.state)': $($s.description)" }
            }
            return @{ kind = "wait"; note = "the Preview deployment of $short is '$($s.state)'" }
        }
        return @{ kind = "wait"; note = "the Preview deployment of $short has no status yet" }
    }
    # No deployment.  A Vercel skip leaves none, only a commit status reading
    # "Canceled by Ignored Build Step" (measured, change2-redproof.md).
    $vercel = @(@($commitStatuses) | Where-Object { $_ -and $_.context -eq "Vercel" })
    if ($vercel.Count -gt 0 -and $vercel[0].description -eq $SkipText) {
        return @{ kind = "skipped" }
    }
    return @{ kind = "wait"; note = "no Preview deployment of $short yet" }
}

function Format-Line($decision, $tip, $frontendOnly) {
    $short = $tip.Substring(0, 7)
    switch ($decision.kind) {
        "ok" { return "preview: $($decision.url) -- serves $short = branch tip (checked in the bundle); frontend-only: $frontendOnly" }
        "skipped" { return "preview: none -- Vercel skipped the build of $short (${SkipText}: no site change since the branch's last build), so no preview serves the tip; frontend-only: $frontendOnly" }
    }
    return $null
}

# The build sha in a deployment's public / page.  The same method as ship.ps1's
# Get-ServedShas (its step 7), copied because the hook forbids calling ship.ps1:
# the 40-hex strings in the chunks that are commits in this repo.
function Get-ServedShas($url, $root) {
    $html = (Invoke-WebRequest -Uri "$url/" -UseBasicParsing -TimeoutSec 30).Content
    $chunks = @([regex]::Matches($html, '/_next/static/chunks/[^"]+\.js') | ForEach-Object { $_.Value } | Sort-Object -Unique)
    $hex = @{}
    foreach ($c in $chunks) {
        $js = (Invoke-WebRequest -Uri "$url$c" -UseBasicParsing -TimeoutSec 30).Content
        foreach ($m in [regex]::Matches($js, '"([0-9a-f]{40})"')) { $hex[$m.Groups[1].Value] = $true }
    }
    $ErrorActionPreference = "Continue"
    $shas = @()
    foreach ($h in $hex.Keys) {
        git -C $root cat-file -e "$h^{commit}" 2>$null
        if ($LASTEXITCODE -eq 0) { $shas += $h }
    }
    return $shas
}

# A GitHub JSON list as its items.  Windows PowerShell 5.1's ConvertFrom-Json
# writes an array to the pipeline as ONE object, so @($raw | ConvertFrom-Json)
# of "[]" is a one-item list holding an empty list (measured: it asked GitHub
# for deployments//statuses).  Assigning first and then enumerating unrolls it.
function ConvertFrom-GhList($raw) {
    $parsed = ConvertFrom-Json $raw
    return @($parsed | ForEach-Object { $_ } | Where-Object { $null -ne $_ })
}

function Get-Json($path) {
    $ErrorActionPreference = "Continue"
    $raw = gh api $path 2>$null | Out-String
    if ($LASTEXITCODE -ne 0) { throw "gh api $path failed" }
    return ConvertFrom-GhList $raw
}

# --- test mode: how a recorded gh api list body parses ------------------------
if ($ParseGhListFromFile -ne "") {
    $items = @(ConvertFrom-GhList (Get-Content $ParseGhListFromFile -Raw))
    Write-Output "items: $($items.Count)"
    foreach ($i in $items) { Write-Output "id: $($i.id)" }
    exit 0
}

# --- test mode: one decision on recorded inputs -------------------------------
if ($DecideFromJson -ne "") {
    $in = Get-Content $DecideFromJson -Raw | ConvertFrom-Json
    $fo = Get-FrontendOnly @($in.files) (Get-SiteInputPrefixes $Root)
    $served = $null
    if ($in.PSObject.Properties.Name -contains "served" -and $null -ne $in.served) { $served = @($in.served) }
    $d = Get-Decision $in.tip @($in.deployments) @($in.commitStatuses) $served
    $line = Format-Line $d $in.tip $fo
    if ($line) { Write-Output $line; exit 0 }
    if ($d.kind -eq "failed") { Fail $d.note }
    Write-Output "WAIT: $($d.note); frontend-only: $fo"
    exit 3
}

# --- live mode ----------------------------------------------------------------
if ($Branch -eq "") { Fail "give -Branch <name>" }
$ErrorActionPreference = "Continue"
git -C $Root fetch --quiet origin main $Branch 2>$null
if ($LASTEXITCODE -ne 0) { Fail "git fetch origin main $Branch failed: is the branch pushed?" }
$tip = (git -C $Root rev-parse "origin/$Branch").Trim()
$base = (git -C $Root merge-base origin/main $tip).Trim()
$files = @(git -C $Root diff --name-only $base $tip)
$ErrorActionPreference = "Stop"
$fo = Get-FrontendOnly $files (Get-SiteInputPrefixes $Root)

Write-Host "Looking for the Preview of $Branch at $($tip.Substring(0, 7)) (up to $TimeoutMin min)..." -ForegroundColor Cyan
$deadline = (Get-Date).AddMinutes($TimeoutMin)
while ($true) {
    $note = ""
    try {
        $deployments = @(Get-Json "repos/$Repo/deployments?sha=$tip&environment=Preview" | ForEach-Object {
            @{ statuses = @(Get-Json "repos/$Repo/deployments/$($_.id)/statuses") }
        })
        $commitStatuses = Get-Json "repos/$Repo/commits/$tip/statuses"
        $d = Get-Decision $tip $deployments $commitStatuses $null
        if ($d.kind -eq "wait" -and $d.url) {
            $served = $null
            try { $served = @(Get-ServedShas $d.url $Root) } catch { }
            $d = Get-Decision $tip $deployments $commitStatuses $served
        }
        $line = Format-Line $d $tip $fo
        if ($line) { Write-Output $line; exit 0 }
        if ($d.kind -eq "failed") { Fail $d.note }
        $note = $d.note
    } catch {
        $note = "GitHub unreachable: $($_.Exception.Message)"
    }
    if ((Get-Date) -ge $deadline) {
        Fail "no preview serving $tip within $TimeoutMin minutes. Last seen: $note"
    }
    Write-Host "  $note - retrying in $PollSec s..."
    Start-Sleep -Seconds $PollSec
}
