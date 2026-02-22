# OCR 验证工具 - 模型准备脚本
# 从 D:\project\ocr 拷贝模型到运行目录

param(
    [string]$SourceDir = "D:\project\ocr",
    [string]$TargetDir = $null
)

# 如果没有指定目标目录，使用默认的运行目录
if ([string]::IsNullOrEmpty($TargetDir)) {
    $TargetDir = Join-Path $PSScriptRoot "bin\Debug\net6.0-windows\win-x64"
}

Write-Host "=== OCR 模型准备脚本 ===" -ForegroundColor Cyan
Write-Host "源目录: $SourceDir"
Write-Host "目标目录: $TargetDir"

# 检查源目录
if (-not (Test-Path $SourceDir)) {
    Write-Host "❌ 源目录不存在: $SourceDir" -ForegroundColor Red
    Write-Host "请确保模型文件在 D:\project\ocr 目录"
    exit 1
}

# 创建目标目录
if (-not (Test-Path $TargetDir)) {
    Write-Host "创建目标目录..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

# 检查模型文件
$ModelDir = Join-Path $SourceDir "paddleocr_models"
if (-not (Test-Path $ModelDir)) {
    Write-Host "❌ 模型目录不存在: $ModelDir" -ForegroundColor Red
    exit 1
}

# 拷贝模型
Write-Host "拷贝模型文件..." -ForegroundColor Green
try {
    $DestModelDir = Join-Path $TargetDir "paddleocr_models"
    if (Test-Path $DestModelDir) {
        Remove-Item $DestModelDir -Recurse -Force
    }
    Copy-Item $ModelDir $DestModelDir -Recurse -Force
    Write-Host "✅ 模型拷贝完成" -ForegroundColor Green
} catch {
    Write-Host "❌ 拷贝失败: $_" -ForegroundColor Red
    exit 1
}

# 检查 Native DLL
Write-Host "检查 Native DLL..." -ForegroundColor Green
$DllSource = "$env:USERPROFILE\.nuget\packages\paddleocrsharp\4.1.0\build\PaddleOCRLib"
if (Test-Path $DllSource) {
    try {
        Copy-Item "$DllSource\*" $TargetDir -Recurse -Force
        Write-Host "✅ Native DLL 拷贝完成" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Native DLL 拷贝失败: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️ 找不到 Native DLL 源目录" -ForegroundColor Yellow
}

Write-Host "`n准备完成，可以运行: dotnet run" -ForegroundColor Green
