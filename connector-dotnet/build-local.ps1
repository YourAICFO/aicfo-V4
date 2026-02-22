# Local build script (no MSI). Produces runnable EXE in .\out\publish\
# Prereqs: .NET SDK 8.0+ in PATH (or install from https://dotnet.microsoft.com/download)
param(
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$outPublish = Join-Path $root "out\publish"

Set-Location $root

Write-Host "dotnet --info"
dotnet --info

Write-Host "Cleaning..."
dotnet clean -c $Configuration

Write-Host "Restoring..."
dotnet restore

Write-Host "Building $Configuration..."
dotnet build -c $Configuration

if (-not (Test-Path "out")) { New-Item -ItemType Directory -Path "out" -Force | Out-Null }
if (Test-Path $outPublish) { Remove-Item -Recurse -Force $outPublish }

Write-Host "Publishing Tray (win-x64, self-contained) to $outPublish..."
dotnet publish "$root\AICFO.Connector.Tray\AICFO.Connector.Tray.csproj" `
  -c $Configuration `
  -r win-x64 `
  -o $outPublish `
  /p:PublishSingleFile=true `
  /p:SelfContained=true `
  /p:IncludeNativeLibrariesForSelfExtract=true `
  /p:PublishTrimmed=false

$trayExe = Join-Path $outPublish "AICFO.Connector.Tray.exe"
if (-not (Test-Path $trayExe)) {
    Write-Error "Publish failed: $trayExe not found"
    exit 1
}

# Ensure publish\service and publish\tray exist so any later WiX/heat step does not fail with HEAT5052
$publishService = Join-Path $root "publish\service"
$publishTray = Join-Path $root "publish\tray"
foreach ($dir in $publishService, $publishTray) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Created placeholder: $dir"
    }
}

Write-Host ""
Write-Host "Installer build skipped in local script."
Write-Host "Done. Tray EXE: $trayExe"
Write-Host "Run from PowerShell: & '$trayExe'"
Write-Host "Bootstrap log (if app fails to open): $env:LOCALAPPDATA\AICFO\Logs\connector.log"
