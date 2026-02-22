# PaddleOCR 模型下载脚本
# 运行: powershell -ExecutionPolicy Bypass -File download-models.ps1

$baseUrl = "https://paddleocr.bj.bcebos.com/PP-OCRv4/chinese"
$modelsDir = "paddleocr_models"

# 创建目录
New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null
Set-Location $modelsDir

Write-Host "下载 PaddleOCR V4 模型..." -ForegroundColor Green

# 下载并解压检测模型
Write-Host "下载检测模型 (ch_PP-OCRv4_det_infer)..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "$baseUrl/ch_PP-OCRv4_det_infer.tar" -OutFile "ch_PP-OCRv4_det_infer.tar"
Write-Host "解压检测模型..." -ForegroundColor Yellow
tar -xf ch_PP-OCRv4_det_infer.tar
Remove-Item ch_PP-OCRv4_det_infer.tar

# 下载并解压识别模型
Write-Host "下载识别模型 (ch_PP-OCRv4_rec_infer)..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "$baseUrl/ch_PP-OCRv4_rec_infer.tar" -OutFile "ch_PP-OCRv4_rec_infer.tar"
Write-Host "解压识别模型..." -ForegroundColor Yellow
tar -xf ch_PP-OCRv4_rec_infer.tar
Remove-Item ch_PP-OCRv4_rec_infer.tar

# 下载并解压分类模型
Write-Host "下载分类模型 (ch_ppocr_mobile_v2.0_cls_infer)..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://paddleocr.bj.bcebos.com/dygraph_v2.0/ch/ch_ppocr_mobile_v2.0_cls_infer.tar" -OutFile "ch_ppocr_mobile_v2.0_cls_infer.tar"
Write-Host "解压分类模型..." -ForegroundColor Yellow
tar -xf ch_ppocr_mobile_v2.0_cls_infer.tar
Remove-Item ch_ppocr_mobile_v2.0_cls_infer.tar

# 下载字典文件
Write-Host "下载字典文件 (ppocr_keys.txt)..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/release/2.9/ppocr/utils/ppocr_keys_v1.txt" -OutFile "ppocr_keys.txt"

Write-Host "`n模型下载完成！" -ForegroundColor Green
Write-Host "模型目录: $(Get-Location)" -ForegroundColor Cyan

# 显示文件列表
Get-ChildItem -Recurse | Select-Object FullName, Length | Format-Table -AutoSize

Set-Location ..
