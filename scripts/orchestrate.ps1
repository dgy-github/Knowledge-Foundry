param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$arguments = @("tsx", "scripts/orchestrator.ts")
if ($DryRun) {
  $arguments += "--dry-run"
}

& npx.cmd @arguments
exit $LASTEXITCODE
