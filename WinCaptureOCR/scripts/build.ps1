# 编译脚本
param(
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

Write-Host "编译 WinCaptureOCR..." -ForegroundColor Cyan
dotnet build -c $Configuration -warnaserror

if ($LASTEXITCODE -eq 0) {
    Write-Host "编译成功!" -ForegroundColor Green
} else {
    Write-Host "编译失败!" -ForegroundColor Red
    exit 1
}
