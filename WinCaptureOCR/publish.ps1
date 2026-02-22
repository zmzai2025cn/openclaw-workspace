# WinCaptureOCR 一键发布工具
# 无需管理员权限

param(
    [string]$SourceDir = ".",
    [string]$OutputDir = ".\publish",
    [switch]$SkipDependencyCheck = $false
)

$ErrorActionPreference = "Stop"

# 颜色输出
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Error($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

Write-Info "WinCaptureOCR 一键发布工具"
Write-Info "=========================="

# 步骤 1: 环境检查
Write-Info "步骤 1/5: 环境检查"

# 检查 .NET
Write-Info "  检查 .NET 6.0..."
try {
    $dotnetVersion = dotnet --version 2>$null
    if ($dotnetVersion -and $dotnetVersion.StartsWith("6.0")) {
        Write-Ok ".NET 6.0 已安装: $dotnetVersion"
    } else {
        Write-Error ".NET 6.0 未安装或版本不匹配"
        Write-Info "请从 https://dotnet.microsoft.com/download/dotnet/6.0 下载安装"
        exit 1
    }
} catch {
    Write-Error ".NET SDK 未安装"
    exit 1
}

# 检查 VC++ 运行时（仅警告，不阻止）
if (-not $SkipDependencyCheck) {
    Write-Info "  检查 VC++ 运行时..."
    $vcKeys = @(
        "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64"
    )
    $vcInstalled = $false
    foreach ($key in $vcKeys) {
        if (Test-Path $key) { $vcInstalled = $true; break }
    }
    if ($vcInstalled) {
        Write-Ok "VC++ 运行时已安装"
    } else {
        Write-Warn "VC++ 运行时可能未安装"
        Write-Warn "如果运行失败，请安装: https://aka.ms/vs/17/release/vc_redist.x64.exe"
    }
}

# 步骤 2: 清理和编译
Write-Info "步骤 2/5: 编译项目"

# 清理
if (Test-Path $OutputDir) {
    Write-Info "  清理旧发布..."
    Remove-Item -Recurse -Force $OutputDir
}

# 编译
Write-Info "  编译 Release..."
$buildOutput = dotnet publish -c Release -r win-x64 --self-contained false -o $OutputDir 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "编译失败"
    Write-Error $buildOutput
    exit 1
}
Write-Ok "编译成功"

# 步骤 3: 检查输出
Write-Info "步骤 3/5: 检查输出文件"

$exePath = Join-Path $OutputDir "WinCaptureOCR.exe"
if (-not (Test-Path $exePath)) {
    Write-Error "未找到 WinCaptureOCR.exe"
    exit 1
}
Write-Ok "主程序存在"

# 检查 DLL
$dllPath = Join-Path $OutputDir "x64"
if (Test-Path $dllPath) {
    $leptonica = Join-Path $dllPath "leptonica-1.82.0.dll"
    $tesseract = Join-Path $dllPath "tesseract50.dll"
    if ((Test-Path $leptonica) -and (Test-Path $tesseract)) {
        Write-Ok "Native DLL 存在"
    } else {
        Write-Warn "部分 Native DLL 可能缺失"
    }
} else {
    Write-Warn "x64 目录不存在，Native DLL 可能未正确复制"
}

# 步骤 4: 准备语言包
Write-Info "步骤 4/5: 准备语言包"

$tessdataDir = Join-Path $OutputDir "tessdata"
if (-not (Test-Path $tessdataDir)) {
    New-Item -ItemType Directory -Path $tessdataDir | Out-Null
    Write-Info "  创建 tessdata 目录"
}

# 检查语言包
$chiSim = Join-Path $tessdataDir "chi_sim.traineddata"
$eng = Join-Path $tessdataDir "eng.traineddata"

if (-not (Test-Path $chiSim)) {
    Write-Warn "缺少中文语言包 chi_sim.traineddata"
    Write-Info "  请手动下载: https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata"
    Write-Info "  并放到: $tessdataDir"
}

if (-not (Test-Path $eng)) {
    Write-Warn "缺少英文语言包 eng.traineddata (可选)"
}

if ((Test-Path $chiSim) -and (Test-Path $eng)) {
    Write-Ok "语言包已准备"
} elseif (Test-Path $chiSim) {
    Write-Ok "中文语言包已准备 (无英文)"
}

# 步骤 5: 创建启动脚本
Write-Info "步骤 5/5: 创建启动脚本"

$startScript = @"
@echo off
echo WinCaptureOCR 启动器
echo ===================
echo.

REM 检查 VC++ 运行时
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" >nul 2>nul
if errorlevel 1 (
    reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" >nul 2>nul
    if errorlevel 1 (
        echo [警告] VC++ 运行时可能未安装
        echo 如果程序无法启动，请安装:
        echo https://aka.ms/vs/17/release/vc_redist.x64.exe
        echo.
        pause
    )
)

REM 检查语言包
if not exist "tessdata\chi_sim.traineddata" (
    echo [错误] 缺少中文语言包
    echo 请下载: https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata
    echo 并放到 tessdata 目录
    pause
    exit 1
)

REM 启动程序
echo 正在启动 WinCaptureOCR...
start WinCaptureOCR.exe
"@

$startScript | Out-File -FilePath (Join-Path $OutputDir "启动.bat") -Encoding UTF8
Write-Ok "启动脚本已创建"

# 完成
Write-Info "=========================="
Write-Ok "发布完成!"
Write-Info "输出目录: $(Resolve-Path $OutputDir)"
Write-Info ""
Write-Info "使用方法:"
Write-Info "  1. 确保已安装 VC++ 2015-2022 x64"
Write-Info "  2. 下载语言包放到 tessdata 目录"
Write-Info "  3. 运行 启动.bat 或 WinCaptureOCR.exe"
Write-Info ""
Write-Info "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
