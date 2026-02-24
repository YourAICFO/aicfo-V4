# Copy connector MSI from connector-dotnet build output into backend/downloads/ for local dev.
# Run from repo root: .\backend\build-and-place-connector.ps1
# Or from backend: .\build-and-place-connector.ps1

$ErrorActionPreference = "Stop"
$repoRoot = if ($PSScriptRoot -match '\\backend$') { Split-Path -Parent $PSScriptRoot } else { $PSScriptRoot }
$connectorRoot = Join-Path $repoRoot "connector-dotnet"
$destDir = Join-Path $repoRoot "backend" "downloads"
$destFile = Join-Path $destDir "AICFOConnectorSetup.msi"

$sources = @(
    (Join-Path $connectorRoot "out\release\AICFOConnectorSetup.msi"),
    (Join-Path $connectorRoot "out\AICFOConnectorSetup.msi"),
    (Join-Path $connectorRoot "installer\bin\Release\AICFOConnectorSetup.msi")
)

$found = $null
foreach ($src in $sources) {
    if (Test-Path -LiteralPath $src -PathType Leaf) {
        $found = $src
        break
    }
}

if (-not $found) {
    Write-Host "No MSI found. Build the connector first, e.g.:" -ForegroundColor Yellow
    Write-Host "  cd connector-dotnet; .\build-release-local.ps1" -ForegroundColor Yellow
    Write-Host "  or: .\build.ps1" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path -LiteralPath $destDir -PathType Container)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}
Copy-Item -LiteralPath $found -Destination $destFile -Force
Write-Host "Copied: $found -> $destFile" -ForegroundColor Green
