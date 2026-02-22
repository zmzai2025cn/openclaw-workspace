# 依赖分析

## 目的
明确项目依赖，便于故障排查

## 必需依赖

| 依赖 | 版本 | 检查方法 | 下载地址 |
|------|------|----------|----------|
| .NET SDK | 6.0.x | `dotnet --version` | https://dotnet.microsoft.com/download/dotnet/6.0 |
| VC++ Runtime | 2015-2022 x64 | 注册表检查 | https://aka.ms/vs/17/release/vc_redist.x64.exe |
| chi_sim | 5.x | 文件存在性 | https://github.com/tesseract-ocr/tessdata |

## DLL 依赖链

### 托管 DLL
- WinCaptureOCR.dll
- Tesseract.dll
- Tesseract.Drawing.dll

### Native DLL（自动复制）
- x64/leptonica-1.82.0.dll
- x64/tesseract50.dll
- x64/libtiff.dll
- x64/libpng.dll
- x64/libjpeg.dll

## 运行时文件

```
工作目录/
├── WinCaptureOCR.exe
├── tessdata/
│   └── chi_sim.traineddata    # 语言包
├── thumbnails/                 # 缩略图（自动创建）
├── ocr_history.csv            # 日志（自动创建）
└── wincapture.log             # 调试日志（自动创建）
```

## 常见问题

### leptonica 加载失败
**症状**：Failed to initialise tesseract engine  
**原因**：VC++ 运行时缺失  
**解决**：安装 VC++ 2015-2022 x64

### DLL 未找到
**症状**：DllNotFoundException  
**原因**：x86/x64 不匹配  
**解决**：确保 PlatformTarget=x64
