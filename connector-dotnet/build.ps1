param(
  [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$publishRoot = Join-Path $root "publish"
$serviceOut = Join-Path $publishRoot "service"
$trayOut = Join-Path $publishRoot "tray"

Write-Host "Publishing service..."
dotnet publish "$root\AICFO.Connector.Service\AICFO.Connector.Service.csproj" -c $Configuration -r win-x64 --self-contained true -o $serviceOut

Write-Host "Publishing tray..."
dotnet publish "$root\AICFO.Connector.Tray\AICFO.Connector.Tray.csproj" -c $Configuration -r win-x64 --self-contained true -o $trayOut

Write-Host "Building MSI..."
dotnet build "$root\installer\AICFO.Connector.Installer.wixproj" -c $Configuration

Write-Host "Done. MSI expected under installer\\bin\\$Configuration"
