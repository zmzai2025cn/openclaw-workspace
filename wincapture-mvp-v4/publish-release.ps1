# WinCapture MVP 自动发布脚本
# 一键完成：编译、复制模型、复制DLL、检查、打包

param(
    [string]$Version = "v5.6",
    [switch]$SkipModelDownload = $false,
    [switch]$SkipNativeDll = $false
)

$ErrorActionPreference = "Stop"

function Write-Step($message) {
    Write-Host "`n=== $message ===" -ForegroundColor Cyan
}

function Write-Ok($message) {
    Write-Host "[OK] $message" -ForegroundColor Green
}

function Write-Fail($message) {
    Write-Host "[FAIL] $message" -ForegroundColor Red
    exit 1
}

$ProjectDir = $PSScriptRoot
$PublishDir = Join-Path $ProjectDir "bin\Release\net6.0-windows\win-x64\publish"
$ModelDir = Join-Path $PublishDir "paddleocr_models"

Write-Host "WinCapture MVP 自动发布脚本" -ForegroundColor Yellow
Write-Host "版本: $Version"
Write-Host "项目目录: $ProjectDir"
Write-Host "发布目录: $PublishDir"

# 步骤 1: 编译
Write-Step "步骤 1/6: 编译项目"
try {
    dotnet publish -c Release -r win-x64 --self-contained true | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "编译失败" }
    Write-Ok "编译成功"
} catch {
    Write-Fail "编译失败: $_"
}

# 步骤 2: 检查模型文件
Write-Step "步骤 2/6: 检查模型文件"

# 等待模型下载完成（如果有）
Start-Sleep -Seconds 2

$ModelV3Det = Join-Path $ModelDir "ch_PP-OCRv3_det_infer"
$ModelV3Rec = Join-Path $ModelDir "ch_PP-OCRv3_rec_infer"
$ModelV3Keys = Join-Path $ModelDir "ppocr_keys_v1.txt"

$HasV3 = (Test-Path $ModelV3Det) -and (Test-Path $ModelV3Rec) -and (Test-Path $ModelV3Keys)

if (-not $HasV3) {
    if (-not $SkipModelDownload) {
        Write-Host "模型文件不存在，尝试自动下载..." -ForegroundColor Yellow
        $DownloadScript = Join-Path $ProjectDir "download-v3-models.ps1"
        if (Test-Path $DownloadScript) {
            try {
                & $DownloadScript
                # 重新检查模型
                $HasV3 = (Test-Path $ModelV3Det) -and (Test-Path $ModelV3Rec) -and (Test-Path $ModelV3Keys)
                if ($HasV3) {
                    Write-Ok "模型下载完成"
                } else {
                    Write-Fail "模型下载后仍不完整"
                }
            } catch {
                Write-Fail "模型下载失败: $_"
            }
        } else {
            Write-Fail "模型文件不存在，且找不到 download-v3-models.ps1"
        }
    } else {
        Write-Fail "模型文件不存在 (跳过了下载)"
    }
} else {
    Write-Ok "模型文件已存在"
}

# 步骤 3: 复制 Native DLL
Write-Step "步骤 3/6: 复制 Native DLL"
if (-not $SkipNativeDll) {
    $NuGetPath = "$env:USERPROFILE\.nuget\packages\paddleocrsharp\4.1.0\build\PaddleOCRLib"
    
    if (-not (Test-Path $NuGetPath)) {
        Write-Fail "找不到 PaddleOCRSharp NuGet 包: $NuGetPath"
    }
    
    try {
        Copy-Item "$NuGetPath\*" $PublishDir -Recurse -Force
        Write-Ok "Native DLL 复制完成"
    } catch {
        Write-Fail "复制 Native DLL 失败: $_"
    }
} else {
    Write-Ok "跳过了 Native DLL 复制"
}

# 步骤 4: 运行发布前验证
Write-Step "步骤 4/6: 运行发布前验证"
$VerifyScript = Join-Path $ProjectDir "verify-before-publish.ps1"
if (Test-Path $VerifyScript) {
    try {
        & $VerifyScript -ProjectPath $ProjectDir
        Write-Ok "验证通过"
    } catch {
        Write-Fail "验证失败: $_"
    }
} else {
    Write-Host "警告: 找不到 verify-before-publish.ps1，跳过验证" -ForegroundColor Yellow
}

# 步骤 5: 运行启动自检
Write-Step "步骤 5/6: 运行启动自检"
$SelfCheckPassed = $false
try {
    $ExePath = Join-Path $PublishDir "WinCaptureMVP.exe"
    if (-not (Test-Path $ExePath)) {
        Write-Host "警告: 找不到可执行文件: $ExePath" -ForegroundColor Yellow
    } else {
        # 启动程序，等待几秒后检查报告
        $process = Start-Process -FilePath $ExePath -WorkingDirectory $PublishDir -PassThru -WindowStyle Hidden
        Start-Sleep -Seconds 3
        
        # 检查自检报告
        $ReportPath = Join-Path $PublishDir "startup_check_report.txt"
        if (Test-Path $ReportPath) {
            $report = Get-Content $ReportPath -Raw
            if ($report -match "状态: 通过") {
                Write-Ok "启动自检通过"
                $SelfCheckPassed = $true
            } elseif ($report -match "状态: 警告") {
                Write-Host "启动自检警告 (非致命):" -ForegroundColor Yellow
            } else {
                Write-Host "启动自检发现问题:" -ForegroundColor Yellow
            }
        } else {
            Write-Host "警告: 未找到启动自检报告" -ForegroundColor Yellow
        }
        
        # 停止程序
        if ($process -and -not $process.HasExited) {
            try { $process.Kill() } catch {}
        }
    }
} catch {
    Write-Host "启动自检失败: $_" -ForegroundColor Yellow
}

# 即使自检失败也继续打包，但给出警告
if (-not $SelfCheckPassed) {
    Write-Host "`n注意: 启动自检未完全通过，但继续打包。建议检查问题。" -ForegroundColor Yellow
}

# 步骤 6: 打包
Write-Step "步骤 6/6: 打包发布"
$ZipName = "wincapture-mvp-$Version.zip"
$ZipPath = Join-Path $ProjectDir $ZipName

try {
    if (Test-Path $ZipPath) {
        Remove-Item $ZipPath -Force
    }
    
    # 确保发布目录存在
    if (-not (Test-Path $PublishDir)) {
        Write-Fail "发布目录不存在: $PublishDir"
    }
    
    # 检查发布目录是否有内容
    $publishItems = Get-ChildItem $PublishDir
    if ($publishItems.Count -eq 0) {
        Write-Fail "发布目录为空"
    }
    
    Compress-Archive -Path "$PublishDir\*" -DestinationPath $ZipPath
    
    if (-not (Test-Path $ZipPath)) {
        Write-Fail "打包失败: 未生成 zip 文件"
    }
    
    Write-Ok "打包完成: $ZipName"
} catch {
    Write-Fail "打包失败: $_"
}

# 完成
Write-Host "`n==================================" -ForegroundColor Green
Write-Host "发布完成!" -ForegroundColor Green
Write-Host "输出文件: $ZipPath" -ForegroundColor Green

# 检查文件是否存在并显示大小
if (Test-Path $ZipPath) {
    $fileSize = (Get-Item $ZipPath).Length
    $sizeMB = [math]::Round($fileSize / 1MB, 2)
    Write-Host "文件大小: $sizeMB MB" -ForegroundColor Green
} else {
    Write-Host "文件大小: 未知 (文件未生成)" -ForegroundColor Red
}

Write-Host "==================================" -ForegroundColor Green

# 显示文件列表
Write-Host "`n发布包内容 (前10项):" -ForegroundColor Cyan
try {
    Get-ChildItem $PublishDir | Select-Object -First 10 | ForEach-Object {
        $size = if ($_.Length -gt 1MB) { "{0:N2} MB" -f ($_.Length / 1MB) } else { "{0:N2} KB" -f ($_.Length / 1KB) }
        Write-Host "  $($_.Name) ($size)"
    }
    $totalItems = (Get-ChildItem $PublishDir).Count
    if ($totalItems -gt 10) {
        Write-Host "  ... 还有 $($totalItems - 10) 项 ..."
    }
} catch {
    Write-Host "  无法读取目录内容" -ForegroundColor Yellow
}
