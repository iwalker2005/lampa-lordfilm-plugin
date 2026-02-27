param(
  [switch]$CheckOnly
)

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'src\lordfilm.js'
$dist = Join-Path $root 'lordfilm.js'

if (-not (Test-Path $src)) {
  throw "Source file not found: $src"
}

if ($CheckOnly) {
  $srcHash = (Get-FileHash -Algorithm SHA256 $src).Hash
  $distHash = if (Test-Path $dist) { (Get-FileHash -Algorithm SHA256 $dist).Hash } else { '' }
  if ($srcHash -ne $distHash) {
    Write-Error "lordfilm.js is out of sync with src/lordfilm.js"
    exit 1
  }
  Write-Output "OK: lordfilm.js is in sync"
  exit 0
}

Copy-Item -Force $src $dist
Write-Output "Synced: src/lordfilm.js -> lordfilm.js"
