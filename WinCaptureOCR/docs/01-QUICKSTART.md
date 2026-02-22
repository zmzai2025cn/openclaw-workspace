# 快速开始指南

## 目标
5 分钟内让 WinCapture OCR 运行起来

## 步骤 1：环境准备（2 分钟）

### 检查 .NET 6.0
```powershell
dotnet --version
# 应显示 6.0.x
```

如果没有，下载安装：
https://dotnet.microsoft.com/download/dotnet/6.0

### 检查 VC++ 运行时
通常已安装，如遇到 OCR 初始化错误，下载：
https://aka.ms/vs/17/release/vc_redist.x64.exe

## 步骤 2：下载语言包（1 分钟）

```powershell
# 创建目录
mkdir tessdata

# 下载中文语言包（必须）
Invoke-WebRequest "https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata" -OutFile "tessdata/chi_sim.traineddata"
```

## 步骤 3：编译运行（2 分钟）

```powershell
# 编译
dotnet build -c Release

# 运行
dotnet run
```

程序启动后会自动最小化到系统托盘。

## 步骤 4：使用

1. **查看识别结果**：双击托盘图标
2. **调整设置**：右键托盘图标 → Settings
3. **退出**：右键托盘图标 → Exit

## 一键安装

```powershell
.\scripts\setup.ps1
```

## 常见问题

### "找不到 .NET 6.0"
安装 .NET 6.0 SDK

### "Tesseract 初始化失败"
安装 VC++ 2015-2022 x64 运行时

### "缺少语言包"
下载 chi_sim.traineddata 到 tessdata 目录

## 下一步

- 提高识别率：docs/07-IMPROVE-ACCURACY.md
- 解决问题：docs/04-COMMON-ISSUES.md
