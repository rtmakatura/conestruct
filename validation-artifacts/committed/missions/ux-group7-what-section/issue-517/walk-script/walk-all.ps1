# Runs walk517.mjs one size (and flow list) at a time, each to its own log.
#   powershell -File walk-all.ps1 "1440x900:pin,zero" "1198x930:colfax,pin,zero" ...
$WT = "C:\Users\rtmak\Documents\traffic-control-tool\.claude\worktrees\issue-517"
$WS = "$WT\validation-artifacts\committed\missions\ux-group7-what-section\issue-517\walk-script"
$C = "$WT\validation-artifacts\committed\missions\ux-group7-what-section\issue-517\crops"
$EX = "C:\Users\rtmak\Documents\traffic-control-tool\validation-artifacts-extra\ux-group7-what-section\issue-517\walk-run"
foreach ($job in $args) {
  $size, $flows = $job -split ":"
  $env:SIZES = $size; $env:FLOWS = $flows
  $log = "$EX\walk517-$($size)-$($flows -replace ',', '-').log"
  & powershell -NoProfile -File "$WS\run.ps1" "$WS\walk517.mjs" $WT $C "$EX\extra-states" *> $log
  "$job exit $LASTEXITCODE -> $log"
}
