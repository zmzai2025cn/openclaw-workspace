# 发布前验证脚本
# 检查模型文件、版本匹配、依赖完整性

param(
    [string]$ProjectPath = ".",
    [string]$ModelVersion = "v3"
)

$ErrorActionPreference = "Stop"
$hasError = $false

function Write-Check($message) {
    Write-Host "[CHECK] $message" -ForegroundColor Cyan
}

function Write-Ok($message) {
    Write-Host "[OK] $message" -ForegroundColor Green
}

function Write-Fail($message) {
    Write-Host "[FAIL] $message" -ForegroundColor Red
    $script:hasError = $true
}

Write-Host "=== WinCapture MVP 发布前验证 ===" -ForegroundColor Yellow
Write-Host "项目路径: $ProjectPath"
Write-Host "模型版本: $ModelVersion"
Write-Host ""

# 1. 检查项目文件存在
Write-Check "检查项目文件..."
$csproj = Join-Path $ProjectPath "WinCaptureMVP.csproj"
if (Test-Path $csproj) {
    Write-Ok "WinCaptureMVP.csproj 存在"
} else {
    Write-Fail "WinCaptureMVP.csproj 不存在"
}

# 2. 检查发布目录的模型文件
Write-Check "检查模型文件..."
$publishDir = Join-Path $ProjectPath "bin\Release\net6.0-windows\win-x64\publish"
$modelDir = Join-Path $publishDir "paddleocr_models"

if (Test-Path $modelDir) {
    Write-Ok "paddleocr_models 目录存在"
    
    # 检查具体模型文件
    $detDir = Join-Path $modelDir "ch_PP-OCRv3_det_infer"
    $recDir = Join-Path $modelDir "ch_PP-OCRv3_rec_infer"
    $keysFile = Join-Path $modelDir "ppocr_keys_v1.txt"
    
    if (Test-Path $detDir) {
        $detModel = Join-Path $detDir "inference.pdmodel"
        $detParams = Join-Path $detDir "inference.pdiparams"
        if ((Test-Path $detModel) -and (Test-Path $detParams)) {
            Write-Ok "检测模型文件完整"
        } else {
            Write-Fail "检测模型文件不完整"
        }
    } else {
        Write-Fail "检测模型目录不存在: ch_PP-OCRv3_det_infer"
    }
    
    if (Test-Path $recDir) {
        $recModel = Join-Path $recDir "inference.pdmodel"
        $recParams = Join-Path $recDir "inference.pdiparams"
        if ((Test-Path $recModel) -and (Test-Path $recParams)) {
            Write-Ok "识别模型文件完整"
        } else {
            Write-Fail "识别模型文件不完整"
        }
    } else {
        Write-Fail "识别模型目录不存在: ch_PP-OCRv3_rec_infer"
    }
    
    if (Test-Path $keysFile) {
        $keysSize = (Get-Item $keysFile).Length
        Write-Ok "字典文件存在 ($keysSize bytes)"
    } else {
        Write-Fail "字典文件不存在: ppocr_keys_v1.txt"
    }
} else {
    Write-Fail "paddleocr_models 目录不存在 (在 $publishDir)"
}

# 3. 检查代码中的模型版本
Write-Check "检查代码模型版本..."
$ocrEngine = Join-Path $ProjectPath "Utils\OcrEngine.cs"
if (Test-Path $ocrEngine) {
    $content = Get-Content $ocrEngine -Raw
    if ($content -match "ch_PP-OCRv3_det_infer" -and $content -match "ch_PP-OCRv3_rec_infer") {
        Write-Ok "代码使用 v3 模型"
    } elseif ($content -match "ch_PP-OCRv4_det_infer" -and $content -match "ch_PP-OCRv4_rec_infer") {
        Write-Ok "代码使用 v4 模型"
    } else {
        Write-Fail "代码模型版本不明确"
    }
} else {
    Write-Fail "OcrEngine.cs 不存在"
}

# 4. 检查 NuGet 包
Write-Check "检查 NuGet 包..."
$packages = @("PaddleOCRSharp", "Microsoft.Data.Sqlite")
foreach ($pkg in $packages) {
    $pkgPath = Join-Path $ProjectPath "obj\project.assets.json"
    if (Test-Path $pkgPath) {
        $pkgContent = Get-Content $pkgPath -Raw
        if ($pkgContent -match $pkg) {
            Write-Ok "$pkg 已引用"
        } else {
            Write-Fail "$pkg 未引用"
        }
    } else {
        Write-Fail "project.assets.json 不存在，请先还原包 (dotnet restore)"
    }
}

# 5. 检查发布脚本
Write-Check "检查发布脚本..."
$publishScript = Join-Path $ProjectPath "publish-release.ps1"
if (Test-Path $publishScript) {
    Write-Ok "publish-release.ps1 存在"
} else {
    Write-Warning "publish-release.ps1 不存在（可选）"
}

Write-Host ""
if ($hasError) {
    Write-Host "=== 验证失败，请修复以上问题 ===" -ForegroundColor Red
    exit 1
} else {
    Write-Host "=== 验证通过，可以发布 ===" -ForegroundColor Green
    exit 0
}
