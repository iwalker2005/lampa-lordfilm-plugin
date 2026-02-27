param(
  [switch]$CheckOnly
)

$root = Split-Path -Parent $PSScriptRoot
$builder = Join-Path $PSScriptRoot 'build-plugin.ps1'

if (-not (Test-Path $builder)) {
  throw "Build script not found: $builder"
}

if ($CheckOnly) {
  powershell -ExecutionPolicy Bypass -File $builder -CheckOnly
  exit $LASTEXITCODE
}

powershell -ExecutionPolicy Bypass -File $builder
exit $LASTEXITCODE