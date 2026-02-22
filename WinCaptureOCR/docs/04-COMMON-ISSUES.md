# 常见问题解决

## 目的
快速定位和解决问题

---

## 编译问题

### 错误：Duplicate 'Compile' items
**原因**：显式包含 .cs 文件与 SDK 自动包含冲突  
**解决**：移除 csproj 中的 `<Compile Include="..." />`

### 警告：CS86xx nullable 警告
**原因**：nullable 类型检查  
**解决**：已在 csproj 中禁用相关警告

---

## 运行问题

### 错误：Tesseract 初始化失败
**症状**：
```
TesseractException: Failed to initialise tesseract engine
```

**原因 1**：缺少 VC++ 运行时（90%）  
**解决**：安装 https://aka.ms/vs/17/release/vc_redist.x64.exe

**原因 2**：语言包缺失（5%）  
**解决**：下载 chi_sim.traineddata 到 tessdata 目录

**原因 3**：语言包版本不匹配（5%）  
**解决**：重新下载语言包

---

### 错误：缺少 DLL
**症状**：
```
DllNotFoundException: leptonica-1.82.0.dll
```

**原因**：VC++ 运行时未安装或架构不匹配  
**解决**：
1. 安装 VC++ 2015-2022 x64
2. 确保 PlatformTarget=x64

---

### 问题：OCR 识别缺字
**原因**：
- 二值化过度
- 页面分割模式不适合

**解决**：v1.6.0 已优化，如需进一步调整：
```csharp
engine.SetVariable("tessedit_pageseg_mode", "1");
engine.SetVariable("textord_min_linesize", "1.0");
```

---

### 问题：程序卡死
**原因**：GetPixel/SetPixel 太慢  
**解决**：v1.6.0 已使用 LockBits 优化

---

### 问题：缩略图不显示
**原因**：
- 缩略图文件被删除
- 权限问题

**解决**：
1. 检查 thumbnails 目录
2. 以管理员身份运行

---

### 问题：日志文件损坏
**原因**：多线程写入冲突  
**解决**：v1.6.0 已添加线程锁

---

## 性能问题

### 问题：CPU 占用高
**原因**：截屏间隔太短  
**解决**：调整间隔为 30 秒或更长

### 问题：内存占用高
**原因**：缩略图过多  
**解决**：自动清理（保留 1000 张）

---

## 添加新问题

按以下格式记录：
```markdown
### 问题标题
**症状**：错误信息或现象

**原因**：原因分析

**解决**：具体步骤
```
