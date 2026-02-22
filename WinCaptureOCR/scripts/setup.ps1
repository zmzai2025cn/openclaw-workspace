# Setup script for WinCaptureOCR v1.1
param([switch]$SkipVCCheck = $false, [switch]$Debug = $false)

$ErrorActionPreference = "Stop"
$script:LogFile = "setup.log"

function Write-Log($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $msg"
    Write-Host $line
    try { Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue } catch {}
}

function Write-Step($msg) { Write-Log "[STEP] $msg" }
function Write-Ok($msg) { Write-Log "[OK] $msg" }
function Write-Warn($msg) { Write-Log "[WARN] $msg" }
function Write-ErrorLog($msg) { Write-Log "[ERROR] $msg" }

Write-Log "========================================"
Write-Log "WinCaptureOCR v1.1 Setup Started"
Write-Log "PowerShell Version: $($PSVersionTable.PSVersion)"
Write-Log "Current Directory: $(Get-Location)"
Write-Log "Parameters: SkipVCCheck=$SkipVCCheck, Debug=$Debug"

# 1. Check .NET 6.0
Write-Step "Checking .NET 6.0 SDK"
Write-Log "Running: dotnet --version"

try {
    $ver = dotnet --version 2>&1
    Write-Log "dotnet output: $ver"
    
    if ($ver -and $ver.StartsWith("6.0")) {
        Write-Ok ".NET 6.0 SDK installed: $ver"
    } else {
        Write-ErrorLog ".NET version mismatch: $ver"
        Write-Log "Please install .NET 6.0 SDK from https://dotnet.microsoft.com/download/dotnet/6.0"
        exit 1
    }
} catch {
    Write-ErrorLog ".NET SDK not found: $_"
    exit 1
}

# 2. Check VC++ Runtime
if (-not $SkipVCCheck) {
    Write-Step "Checking VC++ 2015-2022 Runtime"
    
    $vcInstalled = $false
    $regPaths = @(
        "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64"
    )
    
    foreach ($path in $regPaths) {
        Write-Log "Checking registry: $path"
        if (Test-Path $path) { 
            $vcInstalled = $true 
            Write-Log "Found: $path"
            break 
        }
    }
    
    if ($vcInstalled) {
        Write-Ok "VC++ Runtime installed"
    } else {
        Write-Warn "VC++ Runtime not found"
        Write-Log "Download: https://aka.ms/vs/17/release/vc_redist.x64.exe"
    }
} else {
    Write-Log "Skipped VC++ check"
}

# 3. Check and copy language pack
Write-Step "Checking language pack"

$tessdataDir = "tessdata"
Write-Log "Tessdata directory: $tessdataDir"

if (-not (Test-Path $tessdataDir)) {
    Write-Log "Creating directory: $tessdataDir"
    New-Item -ItemType Directory -Path $tessdataDir | Out-Null
} else {
    Write-Log "Directory exists"
}

$chiSim = "$tessdataDir\chi_sim.traineddata"
Write-Log "Checking file: $chiSim"

if (Test-Path $chiSim) {
    $size = (Get-Item $chiSim).Length
    Write-Ok "Chinese language pack exists ($size bytes)"
} else {
    Write-Warn "Missing Chinese language pack"
    
    # 尝试从 D:\Jobs 拷贝
    $sourcePath = "D:\Jobs\chi_sim.traineddata"
    Write-Log "Trying to copy from: $sourcePath"
    
    if (Test-Path $sourcePath) {
        try {
            Copy-Item $sourcePath $chiSim -Force
            $size = (Get-Item $chiSim).Length
            Write-Ok "Copied Chinese language pack from D:\Jobs ($size bytes)"
        } catch {
            Write-ErrorLog "Failed to copy: $_"
            Write-Log "Please manually download: https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata"
            exit 1
        }
    } else {
        Write-ErrorLog "Source file not found: $sourcePath"
        Write-Log "Please manually download: https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata"
        exit 1
    }
}

# 4. Build
Write-Step "Building project"
Write-Log "Running: dotnet build -c Release"

$buildOutput = dotnet build -c Release 2>&1
$buildExitCode = $LASTEXITCODE

foreach ($line in $buildOutput) {
    Write-Log "BUILD: $line"
}

if ($buildExitCode -eq 0) {
    Write-Ok "Build successful"
} else {
    Write-ErrorLog "Build failed with exit code: $buildExitCode"
    exit 1
}

# 5. Check output
Write-Step "Checking output"
$exePath = ".\bin\Release\net6.0-windows\WinCaptureOCR.exe"
if (Test-Path $exePath) {
    $exeInfo = Get-Item $exePath
    Write-Ok "Executable found: $($exeInfo.FullName) ($($exeInfo.Length) bytes)"
} else {
    Write-Warn "Executable not found at expected path"
}

Write-Log "========================================"
Write-Ok "Setup completed successfully!"
Write-Log "Run with: dotnet run"
Write-Log "Log file: $LogFile"
