# Build release artifacts locally for GitHub Release upload.
# Run from repo root or connector-dotnet: .\build-release-local.ps1 -Version 1.0.0
# Outputs: connector-dotnet/out/release/ (MSI if WiX present, portable ZIP, SHA256, manifest)
$ErrorActionPreference = "Stop"

param(
  [string]$Version = ""
)

# Repo root: script lives in connector-dotnet, so parent of script dir = repo root
$script:ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:RepoRoot = Split-Path -Parent $script:ScriptDir
$script:ConnectorRoot = $script:ScriptDir
$script:OutPublish = Join-Path $script:ConnectorRoot "out\publish"
$script:OutRelease = Join-Path $script:ConnectorRoot "out\release"
$script:PortableZipName = "AICFO-Connector-Portable-win-x64.zip"
$script:MsiName = "AICFOConnectorSetup.msi"

# Resolve dotnet.exe (same logic as verify-tray.ps1)
function Resolve-DotnetExe {
  $dotnetInPath = Get-Command dotnet -ErrorAction SilentlyContinue
  if ($dotnetInPath) { return $dotnetInPath.Source }
  $whereLine = $null
  try {
    $whereOut = cmd /c "where dotnet 2>nul"
    if ($whereOut) { $whereLine = ($whereOut | Select-Object -First 1).Trim() }
  } catch { }
  if ($whereLine) { return $whereLine }
  if (Test-Path "$env:ProgramFiles\dotnet\dotnet.exe") { return "$env:ProgramFiles\dotnet\dotnet.exe" }
  $pfx86 = [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFilesX86)
  if ($pfx86 -and (Test-Path (Join-Path $pfx86 "dotnet\dotnet.exe"))) { return (Join-Path $pfx86 "dotnet\dotnet.exe") }
  return $null
}

# Try to read version from Directory.Build.props or Tray csproj
function Get-ConnectorVersion {
  $propsPath = Join-Path $script:ConnectorRoot "Directory.Build.props"
  if (Test-Path $propsPath) {
    $xml = [xml](Get-Content $propsPath -Raw)
    $v = $xml.Project.PropertyGroup.Version
    if ($v) { return $v.Trim() }
  }
  $trayCsproj = Join-Path $script:ConnectorRoot "AICFO.Connector.Tray\AICFO.Connector.Tray.csproj"
  if (Test-Path $trayCsproj) {
    $xml = [xml](Get-Content $trayCsproj -Raw)
    $v = $xml.Project.PropertyGroup.Version
    if ($v) { return $v.Trim() }
  }
  return $null
}

# Detect WiX: dotnet tool list -g contains wix, or candle/light in PATH
function Test-WixAvailable {
  try {
    $list = & dotnet tool list -g 2>$null
    if ($list -match 'wix\s') { return $true }
  } catch { }
  if (Get-Command candle -ErrorAction SilentlyContinue) { return $true }
  if (Get-Command light -ErrorAction SilentlyContinue) { return $true }
  return $false
}

# --------
$dotnetExe = Resolve-DotnetExe
if (-not $dotnetExe) {
  Write-Error "dotnet not found. Add .NET SDK to PATH or install from https://dotnet.microsoft.com/download"
  exit 1
}

$resolvedVersion = Get-ConnectorVersion
if (-not $resolvedVersion -and -not $Version) {
  Write-Error "Version not set. Define Version in Directory.Build.props or AICFO.Connector.Tray.csproj, or pass -Version 1.0.0"
  exit 1
}
$version = if ($resolvedVersion) { $resolvedVersion } else { $Version }
Write-Host "Version: $version"
Write-Host "Connector root: $script:ConnectorRoot"
Write-Host "Dotnet: $dotnetExe"

Set-Location $script:ConnectorRoot

# Out dirs
if (-not (Test-Path "out")) { New-Item -ItemType Directory -Path "out" -Force | Out-Null }
if (Test-Path $script:OutPublish) { Remove-Item -Recurse -Force $script:OutPublish }
if (-not (Test-Path $script:OutRelease)) { New-Item -ItemType Directory -Path $script:OutRelease -Force | Out-Null }

# 1) Publish Tray self-contained to out/publish
Write-Host ""
Write-Host "Publishing Tray (win-x64, self-contained) to $script:OutPublish ..."
& $dotnetExe publish "$script:ConnectorRoot\AICFO.Connector.Tray\AICFO.Connector.Tray.csproj" `
  -c Release `
  -r win-x64 `
  --self-contained true `
  -o $script:OutPublish `
  /p:PublishSingleFile=true `
  /p:IncludeNativeLibrariesForSelfExtract=true `
  /p:PublishTrimmed=false

$trayExe = Join-Path $script:OutPublish "AICFO.Connector.Tray.exe"
if (-not (Test-Path $trayExe)) {
  Write-Error "Publish failed: $trayExe not found"
  exit 1
}
Write-Host "Tray published: $trayExe"

# 2) MSI only if WiX available
$msiPath = Join-Path $script:OutRelease $script:MsiName
$msiBuilt = $false
if (Test-WixAvailable) {
  Write-Host ""
  Write-Host "WiX detected. Building MSI via build.ps1 ..."
  try {
    & "$script:ConnectorRoot\build.ps1" -Configuration Release
    $builtMsi = Join-Path $script:ConnectorRoot "out\$script:MsiName"
    if (Test-Path $builtMsi) {
      Copy-Item -Path $builtMsi -Destination $msiPath -Force
      $msiBuilt = $true
      Write-Host "MSI copied to $msiPath"
    } else {
      Write-Warning "build.ps1 did not produce $builtMsi; skipping MSI."
    }
  } catch {
    Write-Warning "MSI build failed: $_. Skipping MSI; portable ZIP will still be produced."
  }
} else {
  Write-Host ""
  Write-Host "WiX not found (dotnet tool list -g / candle / light). Skipping MSI build. Install WiX v4 to build MSI: dotnet tool install --global wix --version 4.*"
}

# 3) Portable ZIP from out/publish
Write-Host ""
$portableZipPath = Join-Path $script:OutRelease $script:PortableZipName
if (Test-Path $portableZipPath) { Remove-Item $portableZipPath -Force }
Compress-Archive -Path "$script:OutPublish\*" -DestinationPath $portableZipPath -Force
Write-Host "Portable ZIP: $portableZipPath"

# 4) SHA256 for ZIP and MSI (if present)
$artifacts = @()
$zipHash = (Get-FileHash -Path $portableZipPath -Algorithm SHA256).Hash
$zipHashFile = "$portableZipPath.sha256"
"$zipHash  $script:PortableZipName" | Set-Content -Path $zipHashFile -Encoding utf8
$artifacts += @{ type = "portable_zip"; path = $script:PortableZipName; sha256 = $zipHash }

if ($msiBuilt -and (Test-Path $msiPath)) {
  $msiHash = (Get-FileHash -Path $msiPath -Algorithm SHA256).Hash
  $msiHashFile = "$msiPath.sha256"
  "$msiHash  $script:MsiName" | Set-Content -Path $msiHashFile -Encoding utf8
  $artifacts += @{ type = "msi"; path = $script:MsiName; sha256 = $msiHash }
}

# 5) Release manifest
$gitSha = $null
try {
  $gitSha = (git -C $script:RepoRoot rev-parse HEAD 2>$null)
  if ($gitSha) { $gitSha = $gitSha.Trim() }
} catch { }
$builtAt = [DateTime]::UtcNow.ToString("o")
$manifest = @{
  name             = "AICFO Connector"
  version          = $version
  git_sha          = $gitSha
  built_at         = $builtAt
  artifacts        = $artifacts
} | ConvertTo-Json -Depth 5
$manifestPath = Join-Path $script:OutRelease "release-manifest.json"
$manifest | Set-Content -Path $manifestPath -Encoding utf8
Write-Host "Manifest: $manifestPath"

# 6) Upload list
Write-Host ""
Write-Host "========== UPLOAD THESE TO GITHUB RELEASE =========="
Write-Host "Directory: $script:OutRelease"
Write-Host ""
Write-Host $portableZipPath
Write-Host $zipHashFile
if ($msiBuilt -and (Test-Path $msiPath)) {
  Write-Host $msiPath
  Write-Host "$msiPath.sha256"
}
Write-Host $manifestPath
Write-Host "====================================================="
exit 0
