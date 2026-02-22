# WinCapture MVP v5.7

## 更新内容

- 新增 OCR 极简验证工具（OcrTest）
- 删除多余的 standalone 文件，避免编译冲突
- 优化发布流程

## 目录结构

```
wincapture-mvp-v4/
├── OcrTest/              ← OCR 验证工具
│   ├── Program.cs
│   └── OcrTest.csproj
├── Utils/                ← 工具类（OcrTest 依赖）
├── ...                   ← 其他主程序文件
└── publish-release.ps1   ← 一键发布脚本
```

## 快速开始

### 1. OCR 验证（推荐先运行）

```powershell
cd wincapture-mvp-v4\OcrTest
dotnet run
```

### 2. 一键发布主程序

```powershell
cd wincapture-mvp-v4
.\publish-release.ps1
```

## 注意事项

- OcrTest 依赖父目录的 Utils/ 文件，必须在 wincapture-mvp-v4\OcrTest 目录运行
- 模型文件需要单独下载（脚本会自动处理）
