# Local Tray verification: build, publish, run, confirm process stays alive, show bootstrap log.
# No admin required. Run from: cd connector-dotnet; .\verify-tray.ps1
# Resilient to dotnet not being in PATH.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$outPublish = Join-Path $root "out\publish"
$trayExeName = "AICFO.Connector.Tray.exe"
$trayExe = Join-Path $outPublish $trayExeName
$bootstrapLog = Join-Path $env:LOCALAPPDATA "AICFO\Logs\connector.log"

# Resolve dotnet.exe (do not assume PATH)
$dotnetInPath = Get-Command dotnet -ErrorAction SilentlyContinue
$pathContainsDotnet = $null -ne $dotnetInPath
if ($dotnetInPath) {
    $dotnetExe = $dotnetInPath.Source
} else {
    $whereLine = $null
    try {
        $whereOut = cmd /c "where dotnet 2>nul"
        if ($whereOut) { $whereLine = ($whereOut | Select-Object -First 1).Trim() }
    } catch { }
    if ($whereLine) {
        $dotnetExe = $whereLine.Trim()
    } elseif (Test-Path "$env:ProgramFiles\dotnet\dotnet.exe") {
        $dotnetExe = "$env:ProgramFiles\dotnet\dotnet.exe"
    } else {
        $pfx86 = [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFilesX86)
        if ($pfx86 -and (Test-Path (Join-Path $pfx86 "dotnet\dotnet.exe"))) {
            $dotnetExe = Join-Path $pfx86 "dotnet\dotnet.exe"
        }
    }
    if (-not $dotnetExe) {
        Write-Error "dotnet not found. Add .NET SDK to PATH, or install from https://dotnet.microsoft.com/download"
        exit 1
    }
}

Write-Host "DOTNET EXE: $dotnetExe"
Write-Host "PATH contains dotnet: $pathContainsDotnet"
Write-Host "dotnet --version"
$dotnetVersion = & $dotnetExe --version
Write-Host $dotnetVersion

Set-Location $root

# Stop any existing Tray so we can overwrite out\publish and verify this launch
$existing = Get-Process -Name "AICFO.Connector.Tray" -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Stopping existing Tray process(es)..."
    $existing | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Build Tray project only (avoids installer/WiX and HEAT5052/HEAT5053)
Write-Host "Building Tray project (Release)..."
& $dotnetExe build "$root\AICFO.Connector.Tray\AICFO.Connector.Tray.csproj" -c Release

if (-not (Test-Path "out")) { New-Item -ItemType Directory -Path "out" -Force | Out-Null }
if (Test-Path $outPublish) { Remove-Item -Recurse -Force $outPublish }

Write-Host "Publishing Tray (win-x64, self-contained) to $outPublish..."
& $dotnetExe publish "$root\AICFO.Connector.Tray\AICFO.Connector.Tray.csproj" `
  -c Release `
  -r win-x64 `
  -o $outPublish `
  /p:PublishSingleFile=true `
  /p:SelfContained=true `
  /p:IncludeNativeLibrariesForSelfExtract=true `
  /p:PublishTrimmed=false

if (-not (Test-Path $trayExe)) {
    Write-Host "ERROR: Publish failed - $trayExe not found"
    exit 1
}

# Capture bootstrap log size/lines before start (for fallback detection)
$logExistedBefore = Test-Path $bootstrapLog
$logLinesBefore = if ($logExistedBefore) { (Get-Content $bootstrapLog -ErrorAction SilentlyContinue).Count } else { 0 }

Write-Host "Starting Tray in background..."
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $trayExe
$psi.UseShellExecute = $true
$psi.WorkingDirectory = $outPublish
$proc = [System.Diagnostics.Process]::Start($psi)

Write-Host "Waiting 3 seconds..."
Start-Sleep -Seconds 3

$byName = @(Get-Process -Name "AICFO.Connector.Tray" -ErrorAction SilentlyContinue)
# Path can be null in some environments; normalize $trayExe for comparison (e.g. different casing)
$trayExeNorm = (Resolve-Path -LiteralPath $trayExe -ErrorAction SilentlyContinue).Path
if (-not $trayExeNorm) { $trayExeNorm = $trayExe }
$matching = $byName | Where-Object {
    if ($null -eq $_.Path) { $false }
    else {
        $p = $_.Path
        try { $pNorm = (Resolve-Path -LiteralPath $p -ErrorAction SilentlyContinue).Path } catch { $pNorm = $p }
        $pNorm -eq $trayExeNorm -or $p -eq $trayExe
    }
}
$alive = $matching.Count -ge 1

# Fallback: process by name exists and bootstrap log has new content after start
if (-not $alive -and $byName.Count -ge 1 -and (Test-Path $bootstrapLog)) {
    $logLinesAfter = (Get-Content $bootstrapLog -ErrorAction SilentlyContinue).Count
    if ($logLinesAfter -gt $logLinesBefore) {
        $alive = $true
        $matching = $byName
        Write-Host "(Process detected by name + new log lines; Path was null or mismatch)"
    }
}

if ($alive) {
    $pidList = ($matching | ForEach-Object { $_.Id }) -join ", "
    Write-Host "SUCCESS: Tray process is running (PID(s): $pidList)"
} else {
    Write-Host "FAIL: Tray process is not running after 3 seconds."
    Write-Host "Diagnostics:"
    Write-Host "  EXE: $trayExe"
    Write-Host "  Get-Process by name: $(if ($byName) { $byName | Format-Table Id, ProcessName, Path -AutoSize | Out-String } else { 'none' })"
    if (Test-Path $bootstrapLog) {
        Write-Host "Bootstrap log (last 200 lines):"
        Get-Content $bootstrapLog -Tail 200
    }
    Write-Host ""
    Write-Host "Windows Application event log (last 10 min, .NET Runtime / Application Error):"
    try {
        Get-WinEvent -FilterHashtable @{ LogName = 'Application'; StartTime = (Get-Date).AddMinutes(-10) } -MaxEvents 500 -ErrorAction SilentlyContinue |
            Where-Object { $_.ProviderName -match '\.NET Runtime|Application Error' } |
            Select-Object TimeCreated, ProviderName, Id, Message |
            Format-List
    } catch {
        Write-Host "Get-WinEvent failed: $_"
    }
    exit 1
}

Write-Host "Bootstrap log location: $bootstrapLog"
if (Test-Path $bootstrapLog) {
    Write-Host "Bootstrap log (last 50 lines):"
    Get-Content $bootstrapLog -Tail 50
} else {
    Write-Host "(Bootstrap log file not yet created)"
}

Write-Host ""
Write-Host "Verification passed. To stop the Tray process: Stop-Process -Name 'AICFO.Connector.Tray' -Force"
exit 0
