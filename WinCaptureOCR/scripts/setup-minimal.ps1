# Setup script for WinCaptureOCR
param([switch]$SkipVCCheck = $false)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[STEP] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

Write-Step "WinCaptureOCR Setup"

# Check .NET 6.0
Write-Step "Checking .NET 6.0 SDK"
try {
    $ver = dotnet --version
    if ($ver.StartsWith("6.0")) {
        Write-Ok ".NET 6.0 SDK installed: $ver"
    } else {
        Write-Warn ".NET version mismatch: $ver"
        Write-Host "Please install .NET 6.0 SDK" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host ".NET SDK not found" -ForegroundColor Red
    exit 1
}

# Check VC++ Runtime
if (-not $SkipVCCheck) {
    Write-Step "Checking VC++ 2015-2022 Runtime"
    $vcInstalled = $false
    $regPaths = @(
        "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64"
    )
    foreach ($path in $regPaths) {
        if (Test-Path $path) { $vcInstalled = $true; break }
    }
    
    if ($vcInstalled) {
        Write-Ok "VC++ Runtime installed"
    } else {
        Write-Warn "VC++ Runtime not installed"
        Write-Host "Download: https://aka.ms/vs/17/release/vc_redist.x64.exe" -ForegroundColor Yellow
    }
}

# Check language pack
Write-Step "Checking language pack"
$tessdataDir = "tessdata"
if (-not (Test-Path $tessdataDir)) {
    New-Item -ItemType Directory -Path $tessdataDir | Out-Null
}

$chiSim = "$tessdataDir\chi_sim.traineddata"
if (Test-Path $chiSim) {
    Write-Ok "Chinese language pack exists"
} else {
    Write-Warn "Missing Chinese language pack"
    Write-Host "Download: https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata" -ForegroundColor Yellow
}

# Build test
Write-Step "Building project"
dotnet build -c Release
if ($LASTEXITCODE -eq 0) {
    Write-Ok "Build successful"
} else {
    Write-Host "Build failed" -ForegroundColor Red
    exit 1
}

Write-Step "Setup complete!"
Write-Host "Run: dotnet run" -ForegroundColor Green
