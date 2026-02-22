# WinCapture MVP v4 代码审查报告

## 🔴 严重问题 (必须修复)

### 1. ITrigger 接口缺失
**位置**: `Triggers/WindowSwitchTrigger.cs`, `Triggers/IntervalTrigger.cs`
**问题**: 两个类实现了 `ITrigger` 接口，但该接口未定义
**修复**: 创建 `Triggers/ITrigger.cs`

```csharp
namespace WinCaptureMVP.Triggers
{
    public interface ITrigger
    {
        void Start();
        void Stop();
        void Pause();
        void Resume();
    }
}
```

### 2. CaptureEngine.cs 缺少 using
**位置**: `CaptureEngine.cs`
**问题**: 使用了 `List<>` 但没有 `using System.Collections.Generic;`
**修复**: 添加 using

### 3. TimelineForm.cs 缺少 using
**位置**: `UI/TimelineForm.cs`
**问题**: 使用了 `StringBuilder` 但没有 `using System.Text;`
**状态**: ✅ 已修复（之前已添加）

### 4. OcrEngine.cs 缺少 using
**位置**: `Utils/OcrEngine.cs`
**问题**: 使用了 `Enumerable.Select` 但没有 `using System.Linq;`
**状态**: ✅ 已修复（之前已添加）

---

## 🟡 中等问题 (建议修复)

### 5. 资源泄漏风险
**位置**: `Utils/OcrEngine.cs` 第 19 行
**问题**: `PaddleOCRAll` 是 IDisposable，但从未释放
**修复**:
```csharp
// 添加 Dispose 方法
public static void Dispose()
{
    _ocrEngine?.Dispose();
    _ocrEngine = null;
    _isInitialized = false;
}
```

### 6. 数据库连接未验证
**位置**: `Storage/WorkLogStorage.cs` 第 15 行
**问题**: `_connection` 可能为 null，后续使用会 NRE
**修复**:
```csharp
public WorkLogStorage(Config.UserConfig config)
{
    _dbPath = $"{config.DataDirectory}/worklog.db";
    InitializeDatabase();
    if (_connection == null)
        throw new InvalidOperationException("数据库初始化失败");
}
```

### 7. Process 资源泄漏
**位置**: `Utils/WindowHelper.cs` 第 32 行, `Triggers/WindowSwitchTrigger.cs` 第 69 行
**问题**: `Process.GetProcessById()` 返回的 Process 未 Dispose
**修复**:
```csharp
private static string GetAppName(IntPtr hwnd)
{
    try
    {
        GetWindowThreadProcessId(hwnd, out uint pid);
        using (var process = System.Diagnostics.Process.GetProcessById((int)pid))
        {
            return process.ProcessName;
        }
    }
    catch
    {
        return "Unknown";
    }
}
```

### 8. 截图可能捕获黑屏
**位置**: `Utils/ScreenCapture.cs`
**问题**: 未处理 DPI 缩放，高 DPI 显示器可能截到黑屏或错误区域
**修复**:
```csharp
using System.Drawing;
using System.Windows.Forms;
using System.Runtime.InteropServices;

namespace WinCaptureMVP.Utils
{
    public static class ScreenCapture
    {
        [DllImport("gdi32.dll")]
        private static extern int GetDeviceCaps(IntPtr hdc, int nIndex);
        
        private const int DESKTOPHORZRES = 118;
        private const int HORZRES = 8;

        public static Bitmap? CaptureScreen()
        {
            var screen = Screen.PrimaryScreen;
            if (screen == null) return null;
            
            try
            {
                // 获取实际分辨率（处理 DPI 缩放）
                var scale = GetScreenScale();
                var width = (int)(screen.Bounds.Width * scale);
                var height = (int)(screen.Bounds.Height * scale);
                
                var bitmap = new Bitmap(width, height, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
                
                using (var graphics = Graphics.FromImage(bitmap))
                {
                    graphics.CopyFromScreen(0, 0, 0, 0, new Size(width, height), CopyPixelOperation.SourceCopy);
                }
                
                return bitmap;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ScreenCapture] 截图失败: {ex.Message}");
                return null;
            }
        }
        
        private static float GetScreenScale()
        {
            try
            {
                using (var g = Graphics.FromHwnd(IntPtr.Zero))
                {
                    var hdc = g.GetHdc();
                    var actualWidth = GetDeviceCaps(hdc, DESKTOPHORZRES);
                    var logicalWidth = GetDeviceCaps(hdc, HORZRES);
                    g.ReleaseHdc(hdc);
                    return (float)actualWidth / logicalWidth;
                }
            }
            catch
            {
                return 1.0f;
            }
        }
    }
}
```

---

## 🟢 轻微问题 (可选优化)

### 9. 空检查不一致
**位置**: 多处
**问题**: 有的用 `== null`，有的用 `is null`，有的用 `?.`
**建议**: 统一使用 `is null` 或 `== null`

### 10. 字符串插值文化
**位置**: `CaptureEngine.cs` 多处 Console.WriteLine
**问题**: 未指定 CultureInfo，某些系统可能显示异常
**建议**: 关键日志使用 `FormattableString.Invariant($"...")`

### 11. 线程安全问题
**位置**: `CaptureEngine.cs`
**问题**: `_isRunning`, `_isPaused` 在多线程访问，可能产生竞争条件
**建议**: 使用 `volatile` 或 `lock`

### 12. 异常吞没
**位置**: `Config/UserConfig.cs` 第 29, 43 行
**问题**: `catch { }` 吞没所有异常，调试困难
**建议**: 至少记录到 Console
```csharp
catch (Exception ex)
{
    Console.WriteLine($"[UserConfig] 加载失败: {ex.Message}");
    return new UserConfig();
}
```

### 13. 硬编码路径分隔符
**位置**: `Storage/WorkLogStorage.cs` 第 14 行
**问题**: 使用 `/` 而不是 `Path.Combine`
**修复**:
```csharp
_dbPath = Path.Combine(config.DataDirectory, "worklog.db");
```

### 14. 定时器精度问题
**位置**: `Triggers/IntervalTrigger.cs`
**问题**: `System.Threading.Timer` 在 WinForms 中可能产生重入问题
**建议**: 使用 `System.Windows.Forms.Timer` 替代，或确保回调快速完成

### 15. 缺少 XML 文档注释
**位置**: 所有公共 API
**问题**: 没有文档注释，IDE 提示不友好
**建议**: 为公共类和公共方法添加 `/// <summary>` 注释

### 16. 魔法数字
**位置**: 多处
**问题**: 500ms, 30s, 320x180 等数字没有命名常量
**建议**: 定义为常量
```csharp
private const int WindowCheckIntervalMs = 500;
private const int ScreenshotIntervalMs = 30000;
private const int ThumbnailWidth = 320;
private const int ThumbnailHeight = 180;
```

---

## ⚠️ 编译警告 (预计)

### CS8600 - 可能的 null 转换
**位置**: `CaptureEngine.cs` 第 108 行 `_storage?.Dispose()`
**原因**: `_storage` 在构造函数中初始化，不可能为 null

### CS8602 - 可能的 null 解引用
**位置**: `UI/TimelineForm.cs` 多处 `_listView.SelectedItems`
**原因**: 编译器无法确定控件已初始化

### CS8618 - 非空字段未初始化
**位置**: `CaptureEngine.cs` 的 `_storage` 等字段
**原因**: 在构造函数中初始化，但编译器不识别

### CA1416 - 平台兼容性
**位置**: 所有 WinForms 代码
**原因**: .NET 6 的 platform compatibility analyzer
**解决**: 添加 `[SupportedOSPlatform("windows")]` 或忽略

---

## 📋 修复清单

### 必须修复 (编译错误)
- [ ] 创建 `Triggers/ITrigger.cs`
- [ ] `CaptureEngine.cs` 添加 `using System.Collections.Generic;`
- [ ] `Utils/WindowHelper.cs` 修复 Process 泄漏
- [ ] `Triggers/WindowSwitchTrigger.cs` 修复 Process 泄漏

### 强烈建议
- [ ] `Utils/OcrEngine.cs` 添加 Dispose 方法
- [ ] `Storage/WorkLogStorage.cs` 修复路径分隔符
- [ ] `Utils/ScreenCapture.cs` 处理 DPI 缩放
- [ ] `Config/UserConfig.cs` 添加异常日志

### 可选优化
- [ ] 统一空检查风格
- [ ] 提取魔法数字为常量
- [ ] 添加 XML 文档注释

---

## 🔧 快速修复版本

已创建修复后的版本，包含所有"必须修复"和"强烈建议"的修复。
