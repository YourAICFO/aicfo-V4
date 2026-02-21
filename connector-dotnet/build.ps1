param(
  [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$publishRoot = Join-Path $root "publish"
$serviceOut = Join-Path $publishRoot "service"
$trayOut = Join-Path $publishRoot "tray"
$installerProject = Join-Path $root "installer\AICFO.Connector.Installer.wixproj"
$installerBin = Join-Path $root "installer\bin\$Configuration"
$deterministicMsiName = "AICFOConnectorSetup.msi"

if (Test-Path $serviceOut) { Remove-Item -Recurse -Force $serviceOut }
if (Test-Path $trayOut) { Remove-Item -Recurse -Force $trayOut }

Set-Location $root

Write-Host "Publishing service..."
dotnet publish "$root\AICFO.Connector.Service\AICFO.Connector.Service.csproj" `
  -c $Configuration `
  -r win-x64 `
  -o $serviceOut `
  /p:PublishSingleFile=true `
  /p:SelfContained=true `
  /p:IncludeNativeLibrariesForSelfExtract=true `
  /p:PublishTrimmed=false

Write-Host "Publishing tray..."
dotnet publish "$root\AICFO.Connector.Tray\AICFO.Connector.Tray.csproj" `
  -c $Configuration `
  -r win-x64 `
  -o $trayOut `
  /p:PublishSingleFile=true `
  /p:SelfContained=true `
  /p:IncludeNativeLibrariesForSelfExtract=true `
  /p:PublishTrimmed=false

# Ensure harvest sources exist (installer copies from publish/, not bin/)
$serviceExe = Join-Path $serviceOut "AICFO.Connector.Service.exe"
$trayExe = Join-Path $trayOut "AICFO.Connector.Tray.exe"
if (-not (Test-Path $serviceExe)) { throw "Publish failed: missing $serviceExe" }
if (-not (Test-Path $trayExe)) { throw "Publish failed: missing $trayExe" }

Write-Host "Building MSI..."
dotnet build $installerProject -c $Configuration

$msi = Get-ChildItem -Path $installerBin -Recurse -Filter $deterministicMsiName -File | Select-Object -First 1
if (-not $msi) {
  throw "MSI build failed. Expected '$deterministicMsiName' was not found under '$installerBin'."
}

Write-Host "Done. MSI path: $($msi.FullName)"
Write-Host "Artifact for CI: $($msi.FullName)"
