param(
  [switch]$CheckOnly
)

$root = Split-Path -Parent $PSScriptRoot
$srcDir = Join-Path $root 'src'
$srcBundle = Join-Path $srcDir 'lordfilm.js'
$distBundle = Join-Path $root 'lordfilm.js'

$parts = @(
  'core/utils.js',
  'core/network.js',
  'providers/lordfilm.js',
  'providers/collaps.js',
  'providers/alloha.js',
  'providers/kodik.js',
  'providers/cdnvideohub.js',
  'providers/rezka.js',
  'providers/filmix.js',
  'providers/kinobase.js',
  'core/providers.js',
  'index.js'
)

$resolved = @()
foreach ($part in $parts) {
  $file = Join-Path $srcDir $part
  if (-not (Test-Path $file)) {
    throw "Missing source module: $file"
  }
  $resolved += $file
}

$temp = Join-Path $env:TEMP ('lordfilm-agg-build-' + [Guid]::NewGuid().ToString() + '.js')

try {
  $content = @()
  foreach ($file in $resolved) {
    $content += "// ---- $([IO.Path]::GetFileName($file)) ----"
    $content += (Get-Content -Raw $file)
    $content += ""
  }
  Set-Content -Path $temp -Value ($content -join [Environment]::NewLine) -NoNewline

  if ($CheckOnly) {
    if (-not (Test-Path $srcBundle) -or -not (Test-Path $distBundle)) {
      Write-Error 'Bundle files are missing'
      exit 1
    }

    $tmpHash = (Get-FileHash -Algorithm SHA256 $temp).Hash
    $srcHash = (Get-FileHash -Algorithm SHA256 $srcBundle).Hash
    $distHash = (Get-FileHash -Algorithm SHA256 $distBundle).Hash

    if ($tmpHash -ne $srcHash -or $tmpHash -ne $distHash) {
      Write-Error 'Bundle is out of date. Run scripts/build-plugin.ps1'
      exit 1
    }

    Write-Output 'OK: bundle is up to date'
    exit 0
  }

  Copy-Item -Force $temp $srcBundle
  Copy-Item -Force $temp $distBundle
  Write-Output 'Bundled: src/* -> src/lordfilm.js + lordfilm.js'
}
finally {
  if (Test-Path $temp) { Remove-Item -Force $temp }
}