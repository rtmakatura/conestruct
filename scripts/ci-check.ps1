# ci-check.ps1 -- are both CI workflows green on this exact commit?
# (ship-loop ruling R50.)  Read-only: it asks GitHub, changes nothing.
# Usage:
#   .\scripts\ci-check.ps1 -Sha <full sha> [-Ref <branch>] [-WaitMin <minutes>]
#
# Exit 0: the newest run of each workflow on <sha> completed with success.
# Exit 1: a workflow's newest run on <sha> failed (any conclusion but success),
#         is still running, or doesn't exist; or gh couldn't answer.  The last
#         line then reads "CI CHECK FAILED: <what, per workflow>".  The ship
#         runs this before its merge and stops on exit 1.
#
# R58: with -WaitMin, a run that is only still running is waited for (read
# again every -PollSec seconds) for up to that many minutes.  Red, or a
# missing run (R63), still stops on the first read -- nothing waits on those.
#
# Why: from 55c9054 (Frontend tests) and 467ffaf (Python tests), 2026-09-28/29,
# CI was red on every push to main and five ships went out anyway: the ship
# never read it, and local runs on Windows passed.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Sha,
    # Only for the "how to get a run" hint.
    [string]$Ref = "",
    # Test seam: a stand-in for gh (tests/test_ci_check.py).
    [string]$Gh = "",
    # R58: how long a still-running CI is waited for (the ship passes 15).
    # 0 = don't wait (the R50 behaviour).  A double so a test can wait seconds.
    [double]$WaitMin = 0,
    # R58: seconds between reads while waiting.
    [int]$PollSec = 30
)

$ErrorActionPreference = "Continue"

$Workflows = @(
    @{ File = "python-tests.yml"; Name = "Python tests" },
    @{ File = "frontend-tests.yml"; Name = "Frontend tests" }
)
$short = $Sha.Substring(0, [Math]::Min(7, $Sha.Length))

function Stop-Check($what) {
    Write-Host "CI CHECK FAILED: $what" -ForegroundColor Red
    exit 1
}

$cli = if ($Gh -ne "") { $Gh } else { "gh" }
if ($Gh -eq "" -and -not (Get-Command gh -ErrorAction SilentlyContinue)) { Stop-Check "gh is not on PATH, so CI can't be read." }

# One read of both workflows.  Returns @{ Lines; Bad; Running }: the lines to
# print, the red/missing reasons, and the still-running reasons.
function Read-CI {
    $lines = @(); $bad = @(); $running = @(); $all = @()
    foreach ($w in $Workflows) {
        try {
            $out = & $cli run list --workflow $w.File --commit $Sha --limit 20 --json "databaseId,status,conclusion,url,createdAt,event" 2>&1 | ForEach-Object { "$_" }
        } catch {
            Stop-Check "could not run $cli for $($w.Name): $($_.Exception.Message)"
        }
        if ($LASTEXITCODE -ne 0) {
            $out | ForEach-Object { Write-Host "  $_" }
            Stop-Check "gh could not list $($w.Name) runs on $short (output above)."
        }
        try {
            # Windows PowerShell 5.1 hands a JSON array down the pipeline as one
            # object; ForEach-Object unrolls it (and an empty array to nothing).
            $runs = @(($out -join "`n") | ConvertFrom-Json | ForEach-Object { $_ })
        } catch {
            $out | ForEach-Object { Write-Host "  $_" }
            Stop-Check "gh's answer for $($w.Name) was not JSON (above)."
        }
        if ($runs.Count -eq 0) {
            $how = if ($Ref -ne "") { " Push the branch, or run: gh workflow run $($w.File) --ref $Ref" } else { "" }
            $lines += , @("  $($w.Name): no run on $short.$how", "Red")
            $bad += "$($w.Name) has no run on $short"; $all += $bad[-1]
            continue
        }
        # The newest run decides: an older green run doesn't cover a newer red one.
        $run = $runs | Sort-Object { [DateTime]$_.createdAt } -Descending | Select-Object -First 1
        if ($run.status -ne "completed") {
            $lines += , @("  $($w.Name): still running ($($run.status)) $($run.url)", "Red")
            $running += "$($w.Name) is still running on $short"; $all += $running[-1]
        } elseif ($run.conclusion -ne "success") {
            $lines += , @("  $($w.Name): $($run.conclusion) $($run.url)", "Red")
            $bad += "$($w.Name) failed on $short ($($run.conclusion))"; $all += $bad[-1]
        } else {
            $lines += , @("  $($w.Name): success $($run.url)", "Green")
        }
    }
    return @{ Lines = $lines; Bad = $bad; Running = $running; All = $all }
}

function Show($read) {
    foreach ($l in $read.Lines) { Write-Host $l[0] -ForegroundColor $l[1] }
}

Write-Host "Checking CI on $short (R50)..." -ForegroundColor Cyan
$started = Get-Date
$first = $true
while ($true) {
    $read = Read-CI
    $done = $read.Bad.Count -gt 0 -or $read.Running.Count -eq 0
    $elapsedMin = ((Get-Date) - $started).TotalMinutes
    if ($done -or $elapsedMin -ge $WaitMin) {
        Show $read
        break
    }
    # R58: only still-running runs remain and there's time left.  The runs'
    # own lines print once, on the first read; each wait prints one line.
    if ($first) { Show $read }
    $names = ($read.Running | ForEach-Object { ($_ -split ' is still running')[0] }) -join ', '
    Write-Host ("  CI still running on {0} ({1}); waiting, {2:0.0} of {3} min" -f $short, $names, $elapsedMin, $WaitMin) -ForegroundColor Yellow
    $first = $false
    Start-Sleep -Seconds $PollSec
}

# Workflow order, as before R58.
$bad = @($read.All)
if ($read.Running.Count -gt 0 -and $read.Bad.Count -eq 0 -and $WaitMin -gt 0) {
    Stop-Check ("{0} (waited {1} min)" -f ($bad -join "; "), $WaitMin)
}
if ($bad.Count -gt 0) { Stop-Check ($bad -join "; ") }
Write-Host "CI green on ${short}: $(($Workflows | ForEach-Object { $_.Name }) -join ' and ')." -ForegroundColor Green
exit 0
