# 发布 WinCapture MVP 并复制 PaddleOCRSharp native DLLs

param(
    [string]$Configuration = "Release",
    [string]$Runtime = "win-x64"
)

$ErrorActionPreference = "Stop"

Write-Host "开始发布 WinCapture MVP..." -ForegroundColor Green

# 1. 发布项目
Write-Host "1. 发布 .NET 项目..." -ForegroundColor Yellow
dotnet publish -c $Configuration -r $Runtime --self-contained true /p:PublishSingleFile=true
if ($LASTEXITCODE -ne 0) {
    Write-Error "发布失败"
    exit 1
}

$publishDir = "bin\$Configuration\net6.0-windows\$Runtime\publish"

# 2. 检查 PaddleOCRSharp native DLLs
Write-Host "2. 检查 PaddleOCRSharp native DLLs..." -ForegroundColor Yellow

# 查找 NuGet 包路径
$nugetPackages = $env:NUGET_PACKAGES
if (-not $nugetPackages) {
    $nugetPackages = "$env:USERPROFILE\.nuget\packages"
}

$paddleOcrPackageDir = "$nugetPackages\paddleocrsharp\4.1.0"
$nativeDllDir = "$paddleOcrPackageDir\runtimes\win-x64\native"

if (-not (Test-Path $nativeDllDir)) {
    Write-Warning "找不到 PaddleOCRSharp native DLLs: $nativeDllDir"
    Write-Host "尝试查找其他位置..." -ForegroundColor Yellow
    
    # 尝试其他可能的位置
    $possiblePaths = @(
        "$paddleOcrPackageDir\lib\net6.0",
        "$paddleOcrPackageDir\build\x64"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $nativeDllDir = $path
            Write-Host "找到备用路径: $nativeDllDir" -ForegroundColor Green
            break
        }
    }
}

# 3. 复制 native DLLs
if (Test-Path $nativeDllDir) {
    Write-Host "3. 复制 native DLLs 到发布目录..." -ForegroundColor Yellow
    
    $dlls = Get-ChildItem -Path $nativeDllDir -Filter "*.dll" -ErrorAction SilentlyContinue
    
    if ($dlls) {
        foreach ($dll in $dlls) {
            $destPath = Join-Path $publishDir $dll.Name
            Copy-Item -Path $dll.FullName -Destination $destPath -Force
            Write-Host "  复制: $($dll.Name)" -ForegroundColor Gray
        }
        Write-Host "复制完成，共 $($dlls.Count) 个 DLL" -ForegroundColor Green
    } else {
        Write-Warning "在 $nativeDllDir 中找不到 DLL 文件"
    }
} else {
    Write-Warning "找不到 native DLL 目录"
}

# 4. 检查模型文件
Write-Host "4. 检查模型文件..." -ForegroundColor Yellow
$modelDir = "$publishDir\paddleocr_models"
if (-not (Test-Path $modelDir)) {
    Write-Warning "模型文件不存在: $modelDir"
    Write-Host "请手动下载模型文件并解压到 $modelDir" -ForegroundColor Red
} else {
    Write-Host "模型文件已存在" -ForegroundColor Green
}

# 5. 最终检查
Write-Host "5. 发布目录内容..." -ForegroundColor Yellow
Get-ChildItem $publishDir -Filter "*.exe" | Select-Object Name, Length
Get-ChildItem $publishDir -Filter "*.dll" | Select-Object Name, Length | Format-Table -AutoSize

Write-Host "发布完成！输出目录: $publishDir" -ForegroundColor Green
Write-Host ""
Write-Host "运行程序: $publishDir\WinCaptureMVP.exe" -ForegroundColor Cyan
