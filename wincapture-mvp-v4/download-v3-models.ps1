# 下载 PP-OCRv3 模型脚本
# 适用于 PaddleOCRSharp 4.1.0

$modelDir = "D:\project\wincapture-mvp-v5.6\wincapture-mvp-v4\bin\Release\net6.0-windows\win-x64\publish\paddleocr_models"

# 创建目录
New-Item -ItemType Directory -Force -Path $modelDir

# 下载检测模型
Write-Host "下载检测模型..." -ForegroundColor Green
Invoke-WebRequest -Uri "https://paddleocr.bj.bcebos.com/PP-OCRv3/chinese/ch_PP-OCRv3_det_infer.tar" -OutFile "$modelDir\ch_PP-OCRv3_det_infer.tar"

# 下载识别模型
Write-Host "下载识别模型..." -ForegroundColor Green
Invoke-WebRequest -Uri "https://paddleocr.bj.bcebos.com/PP-OCRv3/chinese/ch_PP-OCRv3_rec_infer.tar" -OutFile "$modelDir\ch_PP-OCRv3_rec_infer.tar"

# 下载字典文件
Write-Host "下载字典文件..." -ForegroundColor Green
Invoke-WebRequest -Uri "https://paddleocr.bj.bcebos.com/PP-OCRv3/chinese/ppocr_keys_v1.txt" -OutFile "$modelDir\ppocr_keys_v1.txt"

# 解压模型
Write-Host "解压模型..." -ForegroundColor Green
tar -xf "$modelDir\ch_PP-OCRv3_det_infer.tar" -C $modelDir
tar -xf "$modelDir\ch_PP-OCRv3_rec_infer.tar" -C $modelDir

Write-Host "PP-OCRv3 模型下载完成！" -ForegroundColor Green
Write-Host "请修改代码中的模型路径从 v4 改为 v3" -ForegroundColor Yellow
