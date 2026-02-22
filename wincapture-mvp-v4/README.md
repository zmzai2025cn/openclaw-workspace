# WinCapture MVP v5.6

员工生产力追踪工具 - 本地截图 + OCR + 报告生成

## 版本信息

- **版本**: v5.6
- **发布日期**: 2026-02-20
- **.NET 版本**: .NET 6.0
- **架构**: x64

## 核心功能

- 📸 自动截图（窗口切换 + 定时）
- 🔤 OCR 文字识别（PaddleOCRSharp 4.1.0）
- 💾 本地 SQLite 存储
- 📊 日报生成
- 🖼️ 缩略图预览

## 系统要求

- Windows 10/11 (64位)
- .NET 6.0 Runtime (或自包含版本)
- 8GB+ 内存
- 500MB+ 磁盘空间

## 快速开始

### 1. 下载并解压

```powershell
# 解压到任意目录，例如：
D:\project\wincapture-mvp-v5.6\
```

### 2. 下载 OCR 模型

```powershell
cd wincapture-mvp-v4
.\download-v3-models.ps1
```

或手动下载到 `paddleocr_models/` 目录：
- ch_PP-OCRv3_det_infer/
- ch_PP-OCRv3_rec_infer/
- ppocr_keys_v1.txt

### 3. 发布并运行

```powershell
dotnet publish -c Release -r win-x64 --self-contained true

# 复制 Native DLL
$source = "$env:USERPROFILE\.nuget\packages\paddleocrsharp\4.1.0\build\PaddleOCRLib\*"
$dest = ".\bin\Release\net6.0-windows\win-x64\publish\"
Copy-Item $source $dest -Recurse -Force

# 运行
cd bin\Release\net6.0-windows\win-x64\publish
.\WinCaptureMVP.exe
```

## 项目结构

```
wincapture-mvp-v4/
├── Program.cs              # 程序入口 + 启动自检
├── CaptureEngine.cs        # 采集引擎
├── ErrorReporter.cs        # 统一错误上报 (新增)
├── Models.cs               # 数据模型
├── Utils/
│   ├── OcrEngine.cs        # OCR 引擎 (延迟初始化)
│   ├── ScreenCapture.cs    # 截图
│   ├── ImageHelper.cs      # 图像处理
│   └── WindowHelper.cs     # 窗口操作
├── UI/
│   ├── TrayIcon.cs         # 托盘图标
│   ├── TimelineForm.cs     # 时间线查看
│   └── ConfigForm.cs       # 配置界面
├── Storage/
│   └── WorkLogStorage.cs   # 数据存储 (多路径回退)
├── Config/
│   └── UserConfig.cs       # 配置管理
├── Triggers/
│   ├── WindowSwitchTrigger.cs
│   └── IntervalTrigger.cs
└── Sanitizer/
    └── AppFilter.cs        # 应用过滤
```

## 架构改进 (v5.6)

### 1. 延迟初始化
```csharp
// OCR 引擎首次调用时才初始化
// 失败后可重试，无需重启程序
```

### 2. 统一错误上报
```csharp
// 所有异常统一记录到 error.log
ErrorReporter.Report(ex, "Context");
```

### 3. 多路径回退
```csharp
// 数据库目录：配置 → 程序目录 → 临时目录 → 内存
// 确保始终可用
```

### 4. 资源释放保护
```csharp
// 所有 Bitmap 使用 try-finally 释放
// 防止内存泄漏
```

## 配置文件

位置: `%LOCALAPPDATA%\WinCaptureMVP\config.json`

```json
{
  "userId": "your-name",
  "deviceId": "auto-generated-uuid",
  "dataDirectory": "",
  "whiteList": []
}
```

## 日志文件

| 日志 | 位置 | 说明 |
|------|------|------|
| 应用日志 | `app_log.txt` | 启动、运行记录 |
| OCR 日志 | `ocr_log.txt` | 识别过程 |
| 错误日志 | `error.log` | 异常信息 |
| 启动自检 | `startup_check_report.txt` | 环境检查 |

## 故障排除

### 启动失败

1. 检查 `startup_check_report.txt`
2. 确认模型文件存在
3. 确认 Native DLL 已复制

### OCR 识别失败

1. 检查 `ocr_log.txt` 错误信息
2. 确认模型版本为 v3
3. 检查 `error.log` 异常

### 数据库错误

1. 检查磁盘空间
2. 检查目录权限
3. 查看是否回退到内存数据库

## 开发文档

- [CHANGELOG_v5.6.md](CHANGELOG_v5.6.md) - 版本历史
- [CODE_REVIEW_v5.6.md](CODE_REVIEW_v5.6.md) - 代码审查报告
- [CODE_QUALITY_AUDIT.md](CODE_QUALITY_AUDIT.md) - 质量审计
- [DEPLOYMENT.md](DEPLOYMENT.md) - 部署指南

## 许可证

MIT License

## 致谢

- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) - OCR 引擎
- [PaddleOCRSharp](https://github.com/raoyutian/PaddleOCRSharp) - .NET 封装
