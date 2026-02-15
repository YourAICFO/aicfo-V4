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
$harvestServiceWxs = Join-Path $root "installer\Harvest.Service.wxs"
$harvestTrayWxs = Join-Path $root "installer\Harvest.Tray.wxs"

if (Test-Path $serviceOut) { Remove-Item -Recurse -Force $serviceOut }
if (Test-Path $trayOut) { Remove-Item -Recurse -Force $trayOut }
if (Test-Path $harvestServiceWxs) { Remove-Item -Force $harvestServiceWxs }
if (Test-Path $harvestTrayWxs) { Remove-Item -Force $harvestTrayWxs }

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

Write-Host "Checking WiX CLI..."
$wixInstalled = (dotnet tool list -g | Select-String -Pattern "^\s*wix\s+").Length -gt 0
if (-not $wixInstalled) {
  Write-Host "Installing WiX v4 global tool..."
  dotnet tool install --global wix --version 4.*
}
$env:PATH = "$env:PATH;$env:USERPROFILE\.dotnet\tools"
$wixCommand = Get-Command wix -ErrorAction Stop

Write-Host "Harvesting service publish output..."
& $wixCommand.Source harvest dir ".\publish\service" -o ".\installer\Harvest.Service.wxs" -cg ServicePublishFiles -dr SERVICEFOLDER -var var.ServicePublishDir

Write-Host "Harvesting tray publish output..."
& $wixCommand.Source harvest dir ".\publish\tray" -o ".\installer\Harvest.Tray.wxs" -cg TrayPublishFiles -dr TRAYFOLDER -var var.TrayPublishDir

# Service exe is authored explicitly in Package.wxs for ServiceInstall/ServiceControl.
# Remove it from harvested files to avoid duplicate file installation.
if (Test-Path $harvestServiceWxs) {
  [xml]$harvestXml = Get-Content $harvestServiceWxs
  $ns = New-Object System.Xml.XmlNamespaceManager($harvestXml.NameTable)
  $ns.AddNamespace("w", "http://wixtoolset.org/schemas/v4/wxs")
  $fileNodes = $harvestXml.SelectNodes("//w:File[contains(@Source,'AICFO.Connector.Service.exe')]", $ns)
  foreach ($fileNode in $fileNodes) {
    $componentNode = $fileNode.ParentNode
    $componentId = $componentNode.GetAttribute("Id")
    if ($componentId) {
      $componentRefs = $harvestXml.SelectNodes("//w:ComponentRef[@Id='$componentId']", $ns)
      foreach ($componentRef in $componentRefs) {
        $componentRef.ParentNode.RemoveChild($componentRef) | Out-Null
      }
    }
    $componentNode.ParentNode.RemoveChild($componentNode) | Out-Null
  }
  $harvestXml.Save($harvestServiceWxs)
}

Write-Host "Building MSI..."
dotnet build $installerProject -c $Configuration

$msi = Get-ChildItem -Path $installerBin -Recurse -Filter $deterministicMsiName -File | Select-Object -First 1
if (-not $msi) {
  throw "MSI build failed. Expected '$deterministicMsiName' was not found under '$installerBin'."
}

Write-Host "Done. MSI path: $($msi.FullName)"
