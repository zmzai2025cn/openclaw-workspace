# WinCapture MVP v4 深度隐患检查报告

## 🔴 已修复的严重隐患

### 1. PaddleOCRSharp 命名空间冲突 ✅
**问题**: `using PaddleOCRSharp;` 可能引入与 `System.Drawing.Image` 冲突的 `Image` 类
**修复**: 移除 `using PaddleOCRSharp;`，使用完全限定名 `PaddleOCRSharp.PaddleOCREngine` 等

### 2. 不必要的 using 语句 ✅
**问题**: `System.Linq` 和 `System.Reflection` 不再需要
**修复**: 已移除

### 3. 类型显式声明 ✅
**问题**: `var result` 可能导致类型推断错误
**修复**: 显式声明 `PaddleOCRSharp.OCRResult result`

---

## 🟡 潜在隐患（需要验证）

### 4. 单文件发布路径问题
**位置**: `OcrEngine.cs` 第 26 行
**代码**: `var exePath = AppContext.BaseDirectory;`
**风险**: 单文件发布时 `AppContext.BaseDirectory` 返回的是临时解压目录，不是 exe 所在目录
**建议**: 使用 `Process.GetCurrentProcess().MainModule?.FileName` 获取真实路径

### 5. 数据库连接字符串未加密
**位置**: `WorkLogStorage.cs`
**风险**: 连接字符串明文存储，虽然 SQLite 是本地文件，但符合安全规范
**建议**: 当前可接受，生产环境考虑加密

### 6. 截图和 OCR 在同一线程
**位置**: `CaptureEngine.cs` 第 68-108 行
**风险**: OCR 可能耗时较长，阻塞 UI 线程
**建议**: 当前可接受，如卡顿再改为异步

### 7. 定时器精度问题
**位置**: `IntervalTrigger.cs`
**风险**: `System.Threading.Timer` 在 WinForms 中可能产生重入
**建议**: 当前有 `_isProcessing` 保护，可接受

### 8. 异常吞没
**位置**: `WindowSwitchTrigger.cs` 第 68 行, `WindowHelper.cs` 第 32 行
**代码**: `catch { return "Unknown"; }`
**风险**: 异常信息丢失，调试困难
**建议**: 至少记录到 Console

### 9. 资源未释放风险
**位置**: `TimelineForm.cs` 第 98 行
**代码**: `_previewBox.Image = new Bitmap(img);`
**风险**: 每次选择新记录时，旧图片未释放
**建议**: 添加 `_previewBox.Image?.Dispose();` 在赋值前

### 10. 数据库查询 SQL 注入风险
**位置**: `WorkLogStorage.cs`
**分析**: 使用 `AddWithValue`，当前安全
**风险**: 低风险，但建议使用参数化查询（已在用）

---

## 🟢 建议优化（非必须）

### 11. 缺少 XML 文档注释
所有公共 API 缺少 `/// <summary>` 注释

### 12. 魔法数字
多处硬编码数字：500ms, 30s, 320x180 等

### 13. 线程安全
`_isRunning`, `_isPaused` 在多线程访问，建议加 `volatile`

---

## 编译前检查清单

- [x] 所有 using 语句必要且正确
- [x] 类型名称无冲突
- [x] 方法签名与 DLL 匹配
- [x] 可空类型正确标记
- [ ] 单文件发布路径测试
- [ ] 实际运行测试

---

## 测试步骤

1. **编译测试**
   ```bash
   dotnet restore
   dotnet build
   ```

2. **单文件发布测试**
   ```bash
   dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
   ```

3. **运行测试**
   - 复制到干净机器
   - 下载模型
   - 运行 exe
   - 检查日志输出
