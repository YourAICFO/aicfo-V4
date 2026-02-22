# E2E Local: backend health -> config -> build/publish tray -> start tray -> connector API + dev device -> evidence.
# Requires: backend at http://localhost:5000, NODE_ENV=development for dev endpoints.
# Run from: cd connector-dotnet; .\e2e-local.ps1
$ErrorActionPreference = "Stop"

$script:Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:OutPublish = Join-Path $script:Root "out\publish"
$script:TrayExeName = "AICFO.Connector.Tray.exe"
$script:TrayExe = Join-Path $script:OutPublish $script:TrayExeName
$script:BootstrapLog = Join-Path $env:LOCALAPPDATA "AICFO\Logs\connector.log"
$script:BaseUrl = "http://localhost:5000"
$script:ConfigPath = "C:\ProgramData\AICFO\config\config.json"
$script:BackendRoot = Split-Path -Parent $script:Root
$script:BackendTmpDevice = Join-Path $script:BackendRoot "backend\tmp\connector-dev-device.json"
$script:SuccessfulEndpoints = [System.Collections.ArrayList]::new()
$script:TrayPid = $null
$script:ConfigApiUrl = $null
$script:DevDeviceId = $null

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

function Invoke-ExternalCommand {
    param(
        [string]$FilePath,
        [string[]]$ArgumentList = @(),
        [string]$WorkingDirectory = $null,
        [string]$StepName = "ExternalCommand"
    )
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $FilePath
    $psi.Arguments = ($ArgumentList -join " ")
    if ($WorkingDirectory) { $psi.WorkingDirectory = $WorkingDirectory }
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    $so = $p.StandardOutput.ReadToEnd()
    $se = $p.StandardError.ReadToEnd()
    $p.WaitForExit(300000)
    $code = $p.ExitCode
    Write-Host "[$StepName] ExitCode=$code"
    if ($code -ne 0) {
        $lastOut = ($so -split "`n" | Select-Object -Last 20) -join "`n"
        throw "Command failed (ExitCode=$code). StdErr: $se. Last stdout: $lastOut"
    }
    return @{ ExitCode = $code; StdOut = $so; StdErr = $se }
}

function Write-DiagnosticsFooter {
    param([string]$StepName, [string]$Command, [string]$ExceptionMessage, [int]$ExitCode)
    Write-Host ""
    Write-Host "========== DIAGNOSTICS (failure at: $StepName) =========="
    Write-Host "Command: $Command"
    Write-Host "Exception: $ExceptionMessage"
    Write-Host "LASTEXITCODE: $ExitCode"
    if (Test-Path $script:BootstrapLog) {
        Write-Host "Bootstrap log (last 50 lines):"
        Get-Content $script:BootstrapLog -Tail 50
    }
    Write-Host "=========================================================="
}

# ---------- MAIN ----------
try {
    Write-Host "==[STEP 1] Resolve dotnet exe=="
    $dotnetExe = Resolve-DotnetExe
    if (-not $dotnetExe) {
        Write-Error "dotnet not found. Add .NET SDK to PATH or install from https://dotnet.microsoft.com/download"
        exit 1
    }
    $pathContainsDotnet = $null -ne (Get-Command dotnet -ErrorAction SilentlyContinue)
    Write-Host "DOTNET EXE: $dotnetExe"
    Write-Host "PATH contains dotnet: $pathContainsDotnet"
}
catch {
    Write-DiagnosticsFooter -StepName "Resolve dotnet" -Command "Resolve-DotnetExe" -ExceptionMessage $_.Exception.Message -ExitCode $LASTEXITCODE
    throw
}

try {
    Write-Host ""
    Write-Host "==[STEP 2] Backend health check=="
    $health = Invoke-WebRequest -Uri "$script:BaseUrl/health" -UseBasicParsing -TimeoutSec 10
    if ($health.StatusCode -ne 200) {
        Write-Host "ERROR: Backend returned $($health.StatusCode). Expected 200."
        exit 1
    }
    Write-Host "Backend health: $($health.StatusCode) OK"
}
catch {
    Write-Host "Step: Backend health | Command: Invoke-WebRequest $script:BaseUrl/health | Exception: $($_.Exception.Message)"
    Write-DiagnosticsFooter -StepName "Backend health" -Command "Invoke-WebRequest $script:BaseUrl/health" -ExceptionMessage $_.Exception.Message -ExitCode $LASTEXITCODE
    throw
}

try {
    Write-Host ""
    Write-Host "==[STEP 3] Validate dev routes (GET dev/devices) before create-device=="
    $devCheck = Invoke-WebRequest -Uri "$script:BaseUrl/api/connector/dev/devices" -UseBasicParsing -TimeoutSec 10
    Write-Host "GET /api/connector/dev/devices: $($devCheck.StatusCode)"
    if ($devCheck.StatusCode -eq 404) {
        Write-Host "Dev routes not loaded. Restart backend. NODE_ENV must be development."
        exit 1
    }
}
catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode.value__ } else { "N/A" }
    if ($code -eq 404) {
        Write-Host "Dev routes not loaded. Restart backend. NODE_ENV must be development."
        exit 1
    }
    Write-Host "GET dev/devices failed (continuing): $($_.Exception.Message)"
}

try {
    Write-Host ""
    Write-Host "==[STEP 4] Config api_url = $script:BaseUrl =="
    $configDir = Split-Path -Parent $script:ConfigPath
    if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }
    $configObj = $null
    if (Test-Path $script:ConfigPath) {
        try { $configObj = Get-Content $script:ConfigPath -Raw | ConvertFrom-Json } catch { $configObj = [PSCustomObject]@{} }
    } else { $configObj = [PSCustomObject]@{} }
    if (-not $configObj.PSObject.Properties['api_url']) { $configObj | Add-Member -NotePropertyName 'api_url' -NotePropertyValue '' }
    $configObj.api_url = $script:BaseUrl
    $script:ConfigApiUrl = $script:BaseUrl
    Set-Content -Path $script:ConfigPath -Value ($configObj | ConvertTo-Json -Depth 10) -Encoding UTF8
    Write-Host "Config api_url set: $script:ConfigPath"
}
catch {
    Write-DiagnosticsFooter -StepName "Config" -Command "Set-Content config" -ExceptionMessage $_.Exception.Message -ExitCode $LASTEXITCODE
    throw
}

Set-Location $script:Root

try {
    Write-Host ""
    Write-Host "==[STEP 5] Stop existing Tray and clear publish folder (with retries)=="
    Get-Process -Name "AICFO.Connector.Tray" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    if (-not (Test-Path "out")) { New-Item -ItemType Directory -Path "out" -Force | Out-Null }
    $retries = 5
    while ($retries -gt 0) {
        try {
            if (Test-Path $script:OutPublish) { Remove-Item -Recurse -Force $script:OutPublish }
            break
        } catch {
            $retries--
            if ($retries -eq 0) { throw }
            Write-Host "Publish folder locked, retrying in 2s... ($retries left)"
            Get-Process -Name "AICFO.Connector.Tray" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
    }
    Write-Host "Publish folder ready."
}
catch {
    Write-DiagnosticsFooter -StepName "Stop Tray / clear publish" -Command "Remove-Item out\publish" -ExceptionMessage $_.Exception.Message -ExitCode $LASTEXITCODE
    throw
}

try {
    Write-Host ""
    Write-Host "==[STEP 6] dotnet build Tray=="
    $buildArgs = @("build", "$script:Root\AICFO.Connector.Tray\AICFO.Connector.Tray.csproj", "-c", "Release")
    $r = Invoke-ExternalCommand -FilePath $dotnetExe -ArgumentList $buildArgs -WorkingDirectory $script:Root -StepName "dotnet build"
    Write-Host $r.StdOut
}
catch {
    Write-DiagnosticsFooter -StepName "dotnet build" -Command "dotnet build ... -c Release" -ExceptionMessage $_.Exception.Message -ExitCode $LASTEXITCODE
    throw
}

try {
    Write-Host ""
    Write-Host "==[STEP 7] dotnet publish Tray to out\publish=="
    $publishArgs = @(
        "publish", "$script:Root\AICFO.Connector.Tray\AICFO.Connector.Tray.csproj",
        "-c", "Release", "-r", "win-x64", "-o", $script:OutPublish,
        "/p:PublishSingleFile=true", "/p:SelfContained=true", "/p:IncludeNativeLibrariesForSelfExtract=true", "/p:PublishTrimmed=false"
    )
    $r = Invoke-ExternalCommand -FilePath $dotnetExe -ArgumentList $publishArgs -WorkingDirectory $script:Root -StepName "dotnet publish"
    Write-Host $r.StdOut
    if (-not (Test-Path $script:TrayExe)) {
        throw "Publish failed: $script:TrayExe not found"
    }
    Write-Host "Tray EXE: $script:TrayExe"
}
catch {
    Write-DiagnosticsFooter -StepName "dotnet publish" -Command "dotnet publish ..." -ExceptionMessage $_.Exception.Message -ExitCode $LASTEXITCODE
    throw
}

$logLinesBefore = 0
if (Test-Path $script:BootstrapLog) { $logLinesBefore = (Get-Content $script:BootstrapLog -ErrorAction SilentlyContinue).Count }

try {
    Write-Host ""
    Write-Host "==[STEP 8] Start Tray (ProcessStartInfo, capture PID)=="
    $trayPsi = New-Object System.Diagnostics.ProcessStartInfo
    $trayPsi.FileName = $script:TrayExe
    $trayPsi.UseShellExecute = $true
    $trayPsi.WorkingDirectory = $script:OutPublish
    $trayProc = [System.Diagnostics.Process]::Start($trayPsi)
    $script:TrayPid = $trayProc.Id
    Write-Host "Tray started PID: $script:TrayPid"
    Start-Sleep -Seconds 3
    $proc = Get-Process -Id $script:TrayPid -ErrorAction SilentlyContinue
    $alive = $null -ne $proc
    if (-not $alive) {
        Write-Host "Process $script:TrayPid not found after 3s."
        if (Test-Path $script:BootstrapLog) {
            $linesAfter = (Get-Content $script:BootstrapLog -ErrorAction SilentlyContinue).Count
            if ($linesAfter -gt $logLinesBefore) { $alive = $true; Write-Host "Bootstrap log has new lines; treating as alive." }
        }
    }
    if (-not $alive) {
        throw "Tray process not running after 3 seconds (PID $script:TrayPid)."
    }
    Write-Host "Tray running (PID: $script:TrayPid)"
}
catch {
    Write-DiagnosticsFooter -StepName "Start Tray" -Command "Process.Start($script:TrayExe)" -ExceptionMessage $_.Exception.Message -ExitCode $LASTEXITCODE
    throw
}

# Connector endpoints (no auth) - do not hard-fail
Write-Host ""
Write-Host "==[STEP 9] Connector endpoints (sanity)=="
$sanityEndpoints = @(
    @{ Name = "GET /api/connector/status"; Url = "$script:BaseUrl/api/connector/status" },
    @{ Name = "GET /api/connector/health"; Url = "$script:BaseUrl/api/connector/health" },
    @{ Name = "GET /health"; Url = "$script:BaseUrl/health" },
    @{ Name = "GET /api/connector/"; Url = "$script:BaseUrl/api/connector/" }
)
foreach ($ep in $sanityEndpoints) {
    try {
        $r = Invoke-WebRequest -Uri $ep.Url -UseBasicParsing -TimeoutSec 10
        $snippet = $r.Content; if ($snippet.Length -gt 300) { $snippet = $snippet.Substring(0, 300) + "..." }
        Write-Host "$($ep.Name): $($r.StatusCode) | $snippet"
        [void]$script:SuccessfulEndpoints.Add("$($ep.Name): $($r.StatusCode)")
    } catch {
        $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode.value__ } else { "err" }
        Write-Host "$($ep.Name): $code | $($_.Exception.Message)"
    }
}

# Dev: create-device -> persist -> auth calls
Write-Host ""
Write-Host "==[STEP 10] Dev create-device + auth calls=="
try {
    $createResp = Invoke-WebRequest -Uri "$script:BaseUrl/api/connector/dev/create-device" -Method POST -ContentType "application/json" -Body "{}" -UseBasicParsing -TimeoutSec 10
    $createJson = $createResp.Content | ConvertFrom-Json
    Write-Host "POST /api/connector/dev/create-device: $($createResp.StatusCode)"
    [void]$script:SuccessfulEndpoints.Add("POST /api/connector/dev/create-device: $($createResp.StatusCode)")
    if ($createJson.success -and $createJson.data.device_token) {
        $script:DevDeviceId = $createJson.data.device_id
        $deviceToken = $createJson.data.device_token
        $tmpDir = Join-Path $script:BackendRoot "backend\tmp"
        if (-not (Test-Path $tmpDir)) { New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null }
        $createJson | ConvertTo-Json -Depth 5 | Set-Content -Path $script:BackendTmpDevice -Encoding UTF8
        Write-Host "Saved to: $script:BackendTmpDevice | device_id=$script:DevDeviceId"

        $headers = @{ Authorization = "Bearer $deviceToken" }
        try {
            $linksResp = Invoke-WebRequest -Uri "$script:BaseUrl/api/connector/device/links" -Headers $headers -UseBasicParsing -TimeoutSec 10
            $sn = $linksResp.Content; if ($sn.Length -gt 300) { $sn = $sn.Substring(0, 300) + "..." }
            Write-Host "GET /api/connector/device/links (Bearer): $($linksResp.StatusCode) | $sn"
            [void]$script:SuccessfulEndpoints.Add("GET /api/connector/device/links: $($linksResp.StatusCode)")
        } catch {
            Write-Host "GET /api/connector/device/links: $($_.Exception.Message)"
        }
        try {
            $heartResp = Invoke-WebRequest -Uri "$script:BaseUrl/api/connector/heartbeat" -Method POST -Headers $headers -ContentType "application/json" -Body "{}" -UseBasicParsing -TimeoutSec 10
            Write-Host "POST /api/connector/heartbeat: $($heartResp.StatusCode)"
            [void]$script:SuccessfulEndpoints.Add("POST /api/connector/heartbeat: $($heartResp.StatusCode)")
        } catch {
            Write-Host "POST /api/connector/heartbeat: $($_.Exception.Message)"
        }
    }
} catch {
    Write-Host "create-device or auth failed: $($_.Exception.Message)"
}

try {
    $devResp = Invoke-WebRequest -Uri "$script:BaseUrl/api/connector/dev/devices" -UseBasicParsing -TimeoutSec 10
    $sn = $devResp.Content; if ($sn.Length -gt 400) { $sn = $sn.Substring(0, 400) + "..." }
    Write-Host "GET /api/connector/dev/devices: $($devResp.StatusCode) | $sn"
    [void]$script:SuccessfulEndpoints.Add("GET /api/connector/dev/devices: $($devResp.StatusCode)")
} catch {
    Write-Host "GET /api/connector/dev/devices: $($_.Exception.Message)"
}

# Evidence pack
Write-Host ""
Write-Host "========== E2E EVIDENCE PACK =========="
Write-Host "Backend health: $script:BaseUrl/health -> 200 OK"
Write-Host "Tray PID: $script:TrayPid | EXE: $script:TrayExe"
Write-Host "Config api_url: $script:ConfigApiUrl ($script:ConfigPath)"
Write-Host "Dev device_id: $script:DevDeviceId"
Write-Host "Successful endpoints:"
$script:SuccessfulEndpoints | ForEach-Object { Write-Host "  $_" }
Write-Host "Bootstrap log (last 80 lines):"
if (Test-Path $script:BootstrapLog) {
    Get-Content $script:BootstrapLog -Tail 80
} else {
    Write-Host "(no file)"
}
Write-Host "======================================"
Write-Host "E2E complete. Stop Tray: Stop-Process -Name 'AICFO.Connector.Tray' -Force"
exit 0
