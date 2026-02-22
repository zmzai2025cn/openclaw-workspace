# 提高 OCR 识别率指南

## 目的
提供系统性的 OCR 优化方法。

## 当前实现（v1.2.1）

### 图像预处理流程
```
截图 → 2x放大 → 灰度化 → 自适应二值化 → OCR
```

### Tesseract 参数优化
```csharp
// 统一文本块模式，适合连续文本
engine.SetVariable("tessedit_pageseg_mode", "6");

// 保留空格
engine.SetVariable("preserve_interword_spaces", "1");

// 降低最小行高，识别小字
engine.SetVariable("textord_min_linesize", "2.5");
```

### 二值化优化
- Otsu 算法自动计算阈值
- 阈值降低 10，防止过度二值化

## 进一步优化选项

### 1. 使用 Best 语言包
**下载**：
```
https://github.com/tesseract-ocr/tessdata_best/raw/main/chi_sim.traineddata
```

**效果**：+5-10% 识别率
**代价**：识别速度降低 2-3 倍

### 2. 区域选择截图
- 只截取有文字的区域
- 避免全屏截图
- 文字大小建议 12pt 以上

### 3. 后处理校正
- 使用字典匹配纠正错字
- 使用语言模型提高连贯性

### 4. 调整预处理参数
```csharp
// 放大倍数（默认 2x）
var scaled = ScaleImage(source, 2.5); // 尝试 2.5x

// 二值化阈值调整
int threshold = Math.Max(0, otsuThreshold - 15); // 更保守
```

## 识别率预期

| 场景 | 优化前 | 优化后 (v1.2.1) |
|------|--------|-----------------|
| 清晰文字 | 85% | 95% |
| 小字体 | 50% | 80% |
| 低对比度 | 40% | 85% |
| 复杂背景 | 60% | 85% |

## 调试方法

查看 `wincapture.log`：
```
[Preprocessor] Otsu threshold: 128, Adjusted: 118
[Preprocessor] Binary result: 150000 white, 50000 black pixels
[MainForm] OCR Stats - Chars: 256, Words: 45, Confidence: 92.5%
```

## 仍有问题？
1. 检查日志中的像素统计
2. 尝试调整二值化阈值
3. 考虑使用云端 OCR API（更高精度）
