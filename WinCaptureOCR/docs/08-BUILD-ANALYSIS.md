# 编译流程分析

## 目的
理解编译全流程，确保可重复构建

## 源文件

```
WinCaptureOCR/
├── WinCaptureOCR.csproj      # 项目配置
├── Program.cs                 # 主程序
├── LogViewerForm.cs           # 日志查看器
├── OcrLogManager.cs           # 日志管理
└── ImagePreprocessor.cs       # 图像预处理
```

## 编译配置

### 关键设置
```xml
<PropertyGroup>
    <TargetFramework>net6.0-windows</TargetFramework>
    <PlatformTarget>x64</PlatformTarget>
    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
    <Nullable>annotations</Nullable>
    <NoWarn>CS8618;CS8600;CS8602;CS8604;CS8622;CS8625;CS8653;CS8714</NoWarn>
</PropertyGroup>
```

### 说明
- **x64**：确保与 native DLL 架构一致
- **AllowUnsafeBlocks**：启用 LockBits 优化
- **Nullable=annotations**：允许 nullable 注解但不禁用检查
- **NoWarn**：禁用已知的 style 警告

## 编译步骤

```bash
# 1. 还原 NuGet 包
dotnet restore

# 2. 编译 Release
dotnet build -c Release

# 3. 输出目录
bin/Release/net6.0-windows/
```

## 输出文件

```
WinCaptureOCR.exe              # 入口程序
WinCaptureOCR.dll              # 主程序
Tesseract.dll                  # OCR 包装器
x64/
├── leptonica-1.82.0.dll       # 图像处理
├── tesseract50.dll            # OCR 引擎
└── ...
tessdata/                      # 语言包（运行时）
thumbnails/                    # 缩略图（运行时创建）
```

## 版本历史

| 版本 | 编译变更 |
|------|----------|
| v1.6.0 | 添加 CS8653;CS8714 到 NoWarn |
| v1.5.0 | 添加 LogViewerForm.cs, OcrLogManager.cs |
| v1.3.0 | 启用 AllowUnsafeBlocks |
| v1.2.0 | 添加 ImagePreprocessor.cs |
| v1.0 | 初始版本 |

## 常见问题

### 类型冲突
`ImageFormat` 歧义 → 使用完整命名空间

### 警告处理
已知警告已添加到 NoWarn

### 编译失败
检查 .NET 6.0 SDK 是否安装
