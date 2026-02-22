# 发布脚本（简化版，无需管理员权限）
param(
    [string]$OutputDir = ".\publish"
)

$ErrorActionPreference = "Stop"

Write-Host "发布 WinCaptureOCR..." -ForegroundColor Cyan

# 清理
if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}

# 编译
dotnet publish -c Release -r win-x64 --self-contained false -o $OutputDir
if ($LASTEXITCODE -ne 0) {
    Write-Host "编译失败!" -ForegroundColor Red
    exit 1
}

# 复制语言包
$tessdataSource = ".\tessdata"
$tessdataDest = "$OutputDir\tessdata"
if (Test-Path $tessdataSource) {
    Copy-Item -Recurse $tessdataSource $tessdataDest
    Write-Host "语言包已复制" -ForegroundColor Green
} else {
    Write-Host "警告: 未找到语言包" -ForegroundColor Yellow
}

# 创建启动脚本
$startBat = @"
@echo off
echo WinCaptureOCR 启动器
echo ===================

REM 检查语言包
if not exist "tessdata\chi_sim.traineddata" (
    echo [错误] 缺少中文语言包
    echo 请下载: https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata
    pause
    exit 1
)

REM 启动
echo 正在启动...
start WinCaptureOCR.exe
"@

$startBat | Out-File -FilePath "$OutputDir\启动.bat" -Encoding UTF8

Write-Host "发布完成: $OutputDir" -ForegroundColor Green
