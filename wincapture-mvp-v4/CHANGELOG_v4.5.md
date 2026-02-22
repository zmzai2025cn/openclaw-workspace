# WinCapture MVP v4.5 代码改动记录

## 改动记录格式

```markdown
### [日期时间] 改动编号
**文件**: `文件路径`
**类型**: [新增/修改/删除]
**改动描述**: 简要说明
**改动原因**: 为什么做这个改动
**改动内容**:
```diff
- 旧代码
+ 新代码
```
**潜在风险**: 可能引入的问题
**回滚方案**: 如何撤销
```

---

## 改动列表

### [2026-02-20 14:30] #001
**文件**: `WinCaptureMVP.csproj`
**类型**: 修改
**改动描述**: 将 SQLite 库从 System.Data.SQLite 改为 Microsoft.Data.Sqlite
**改动原因**: 
- System.Data.SQLite 依赖 native DLL (SQLite.Interop.dll)
- 单文件发布时 native DLL 加载失败，导致 SQLiteConnection 构造函数崩溃
- Microsoft.Data.Sqlite 是纯托管实现，支持单文件发布
**改动内容**:
```diff
- <PackageReference Include="System.Data.SQLite" Version="1.0.118" />
+ <!-- 改用 Microsoft.Data.Sqlite，纯托管，支持单文件发布 -->
+ <PackageReference Include="Microsoft.Data.Sqlite" Version="6.0.25" />
```
**潜在风险**: 
- API 略有不同（命名空间从 System.Data.SQLite 改为 Microsoft.Data.Sqlite）
- 连接字符串格式变化（去掉 Version=3）
**回滚方案**: 恢复 System.Data.SQLite 引用，但需解决单文件发布问题

---

### [2026-02-20 14:30] #002
**文件**: `Storage/WorkLogStorage.cs`
**类型**: 修改
**改动描述**: 适配 Microsoft.Data.Sqlite API
**改动原因**: 配合 #001，使用新的 SQLite 库
**改动内容**:
```diff
- using System.Data.SQLite;
+ using Microsoft.Data.Sqlite;

- private SQLiteConnection? _connection;
+ private SqliteConnection? _connection;

- var connectionString = $"Data Source={_dbPath};Version=3;";
+ var connectionString = $"Data Source={_dbPath}";

- _connection = new SQLiteConnection(connectionString);
+ _connection = new SqliteConnection(connectionString);
```
**潜在风险**: 行为完全一致，风险低
**回滚方案**: 与 #001 一起回滚

---

### [2026-02-20 14:30] #003
**文件**: `Program.cs`
**类型**: 修改
**改动描述**: 修复 Mutex 单实例检查，防止 GC 回收
**改动原因**: 
- 原代码创建 Mutex 后没有保持引用
- GC 可能回收 Mutex，导致单实例检查失效
- 用户可能同时运行多个实例，造成数据冲突
**改动内容**:
```diff
  internal static class Program
  {
      private static readonly string LogPath;
+     private static System.Threading.Mutex? _instanceMutex; // 保持引用防止GC回收
```

```diff
  private static bool IsAlreadyRunning()
  {
-     const string MutexName = "WinCaptureMVP_SingleInstance";
+     const string MutexName = "WinCaptureMVP_SingleInstance_v2";
      try
      {
-         // 尝试打开已存在的互斥体
-         using (var mutex = System.Threading.Mutex.OpenExisting(MutexName))
-         {
-             // 如果成功打开，说明已有实例在运行
-             return true;
-         }
-     }
-     catch (System.Threading.WaitHandleCannotBeOpenedException)
-     {
-         // 互斥体不存在，创建新的
-         try
-         {
-             var mutex = new System.Threading.Mutex(true, MutexName);
-             // 注意：这里不释放互斥体，保持锁定直到程序退出
-             return false;
-         }
-         catch
-         {
-             // 创建失败，假设已有实例
-             return true;
-         }
-     }
-     catch
-     {
-         // 其他错误，假设已有实例
-         return true;
-     }
+         // 尝试创建互斥体
+         _instanceMutex = new System.Threading.Mutex(false, MutexName, out bool createdNew);
+         if (!createdNew)
+         {
+             // 互斥体已存在，说明已有实例在运行
+             _instanceMutex.Dispose();
+             _instanceMutex = null;
+             return true;
+         }
+         // 保持互斥体引用，防止GC回收
+         return false;
+     }
+     catch (Exception ex)
+     {
+         Log($"互斥体检查失败: {ex.Message}");
+         // 出错时保守处理，假设已有实例
+         return true;
      }
  }
```
**潜在风险**: 
- 互斥体名称改为 v2，旧版本和新版本可以同时运行（预期行为）
- 如果程序崩溃，互斥体可能残留，需要重启才能清除
**回滚方案**: 恢复原来的 Mutex 实现

---

### [2026-02-20 14:30] #004
**文件**: `Utils/OcrEngine.cs`
**类型**: 修改
**改动描述**: 添加 OCR 识别线程锁，确保线程安全
**改动原因**: 
- PaddleOCREngine 可能不是线程安全的
- WindowSwitchTrigger 和 IntervalTrigger 可能同时调用 Recognize
- 多线程竞争可能导致崩溃或数据损坏
**改动内容**:
```diff
  private static readonly object InitLock = new object();
+ private static readonly object RecognizeLock = new object(); // 识别操作锁
  private static bool _isInitialized;
```

```diff
- // 调用 OCR
- var result = _ocrEngine.DetectText(imageBytes);
+ // 调用 OCR（加锁确保线程安全）
+ PaddleOCRSharp.OCRResult? result;
+ lock (RecognizeLock)
+ {
+     result = _ocrEngine.DetectText(imageBytes);
+ }
```
**潜在风险**: 
- 串行化 OCR 调用，可能影响性能（但截图频率低，影响可忽略）
**回滚方案**: 移除 RecognizeLock 和相关 lock 语句

---

### [2026-02-20 14:30] #005
**文件**: `Utils/OcrEngine.cs`
**类型**: 修改
**改动描述**: 添加 PaddleOCRSharp 类型加载检查
**改动原因**: 
- 单文件发布时，PaddleOCRSharp 的 native DLL 可能加载失败
- 提前检查类型是否能加载，避免后续崩溃
**改动内容**:
```diff
  try
  {
+     // 首先检查 PaddleOCRSharp 是否能正常加载
+     try
+     {
+         var testType = typeof(PaddleOCRSharp.PaddleOCREngine);
+         Log($"PaddleOCRSharp 类型加载成功: {testType.Assembly.Location}");
+     }
+     catch (Exception ex)
+     {
+         Log($"错误: 无法加载 PaddleOCRSharp - {ex.Message}");
+         _initFailed = true;
+         return;
+     }
+
      var exePath = GetExecutableDirectory();
```
**潜在风险**: 无，只是增加检查
**回滚方案**: 移除类型加载检查代码块

---

### [2026-02-20 14:30] #006
**文件**: `Utils/OcrEngine.cs`
**类型**: 修改
**改动描述**: 添加 exePath 空值检查
**改动原因**: 
- GetExecutableDirectory() 虽然返回 "." 作为 fallback
- 但添加显式检查更安全，避免 Path.Combine 崩溃
**改动内容**:
```diff
      var exePath = GetExecutableDirectory();
+     
+     // 确保 exePath 不为空
+     if (string.IsNullOrWhiteSpace(exePath))
+     {
+         Log("错误: 无法获取执行目录");
+         _initFailed = true;
+         return;
+     }
+     
      var modelPath = Path.Combine(exePath, "paddleocr_models");
```
**潜在风险**: 无
**回滚方案**: 移除空值检查代码块

---

### [2026-02-20 14:30] #007
**文件**: `Utils/ImageHelper.cs`
**类型**: 修改
**改动描述**: 修复 CreateThumbnail 资源泄漏问题
**改动原因**: 
- 原代码在异常时，已创建的 thumbnail Bitmap 没有被释放
- 可能导致 GDI+ 资源泄漏
**改动内容**:
```diff
  public static Bitmap? CreateThumbnail(Bitmap? source, int maxWidth, int maxHeight)
  {
      if (source == null || source.Width == 0 || source.Height == 0)
          return null;

+     Bitmap? thumbnail = null;
      try
      {
          var ratio = Math.Min((double)maxWidth / source.Width, (double)maxHeight / source.Height);
          var newWidth = Math.Max(1, (int)(source.Width * ratio));
          var newHeight = Math.Max(1, (int)(source.Height * ratio));

-         var thumbnail = new Bitmap(newWidth, newHeight, PixelFormat.Format32bppArgb);
+         thumbnail = new Bitmap(newWidth, newHeight, PixelFormat.Format32bppArgb);
          using (var graphics = Graphics.FromImage(thumbnail))
          {
              graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
              graphics.SmoothingMode = SmoothingMode.HighQuality;
              graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
              graphics.DrawImage(source, 0, 0, newWidth, newHeight);
          }

-         return thumbnail;
+         var result = thumbnail;
+         thumbnail = null; // 转移所有权
+         return result;
      }
      catch (Exception ex)
      {
          System.Diagnostics.Debug.WriteLine($"Thumbnail creation failed: {ex.Message}");
+         thumbnail?.Dispose();
          return null;
      }
  }
```
**潜在风险**: 无，修复了资源泄漏
**回滚方案**: 恢复原来的实现（但不建议）

---

### [2026-02-20 14:30] #008
**文件**: `UI/TimelineForm.cs`
**类型**: 修改
**改动描述**: 添加 Base64 字符串有效性检查
**改动原因**: 
- Convert.FromBase64String 在格式无效时抛出异常
- 虽然被 catch，但提前验证更高效
**改动内容**:
```diff
  private void ShowThumbnail(WorkRecord record)
  {
      _previewBox.Image?.Dispose();
      _previewBox.Image = null;
      
      if (string.IsNullOrEmpty(record.ThumbnailBase64)) return;
+     
+     // 验证 Base64 字符串有效性
+     if (record.ThumbnailBase64.Length % 4 != 0)
+     {
+         System.Diagnostics.Debug.WriteLine("Thumbnail Base64 length invalid");
+         return;
+     }

      try
      {
          var bytes = Convert.FromBase64String(record.ThumbnailBase64);
```
**潜在风险**: 
- 只是长度检查，不验证内容，可能仍有无效 Base64 通过
- 但异常处理仍在，安全
**回滚方案**: 移除长度检查代码

---

### [2026-02-20 14:30] #009
**文件**: `Config/UserConfig.cs`
**类型**: 修改
**改动描述**: 添加 JSON 序列化选项
**改动原因**: 
- 明确指定属性命名策略，避免序列化问题
- 提高代码可读性和可维护性
**改动内容**:
```diff
  var options = new JsonSerializerOptions 
  { 
-     WriteIndented = true
+     WriteIndented = true,
+     PropertyNamingPolicy = JsonNamingPolicy.CamelCase
  };
```
**潜在风险**: 
- 属性名改为 camelCase，与旧版本配置不兼容
- 但旧版本没有正式发布，可接受
**回滚方案**: 移除 PropertyNamingPolicy 设置

---

### [2026-02-20 14:30] #010
**文件**: `Config/UserConfig.cs`
**类型**: 修改（之前已做，现记录）
**改动描述**: 添加 GetSafeDataDirectory() 方法
**改动原因**: 
- Environment.GetFolderPath() 可能返回 null
- 需要多层 fallback 确保永不返回 null
**改动内容**:
```diff
+ /// <summary>
+ /// 获取安全的数据目录（永不返回null）
+ /// </summary>
+ public string GetSafeDataDirectory()
+ {
+     // 优先使用已设置的值
+     if (!string.IsNullOrWhiteSpace(DataDirectory))
+     {
+         return DataDirectory;
+     }
+     
+     // 使用系统默认路径
+     return GetDefaultDataDirectory();
+ }
```
**潜在风险**: 无
**回滚方案**: 移除方法，但会导致 null 引用风险

---

### [2026-02-20 14:32] #011
**文件**: `WinCaptureMVP.csproj`
**类型**: 修改
**改动描述**: 移除 OpenCvSharp4 包引用
**改动原因**: 
- PaddleOCRSharp 4.1.0 内部已包含 OpenCV
- 同时引用可能导致 native DLL 冲突
- 减少依赖，降低单文件发布问题
**改动内容**:
```diff
- <PackageReference Include="OpenCvSharp4" Version="4.9.0.20240103" />
- <PackageReference Include="OpenCvSharp4.runtime.win" Version="4.9.0.20240103" />
```
**潜在风险**: 
- 如果 PaddleOCRSharp 内部 OpenCV 版本不兼容，可能出问题
- 但代码中没有直接使用 OpenCvSharp API，风险低
**回滚方案**: 恢复 OpenCvSharp4 引用

---

### [2026-02-20 14:32] #012
**文件**: `Utils/OcrEngine.cs`
**类型**: 修改
**改动描述**: 添加多路径模型搜索
**改动原因**: 
- 单文件发布时，模型文件可能在不同位置
- 尝试多个可能的路径，提高兼容性
**改动内容**:
```diff
- var modelPath = Path.Combine(exePath, "paddleocr_models");
+ string[] possibleModelPaths = new[]
+ {
+     Path.Combine(exePath, "paddleocr_models"),
+     Path.Combine(AppContext.BaseDirectory, "paddleocr_models"),
+     Path.Combine(Environment.CurrentDirectory, "paddleocr_models"),
+     @".\paddleocr_models"
+ };
```
**潜在风险**: 无
**回滚方案**: 恢复单路径搜索

---

### [2026-02-20 14:32] #013
**文件**: `Storage/WorkLogStorage.cs`
**类型**: 修改
**改动描述**: 禁用 SQLite 连接池
**改动原因**: 
- 单文件发布时，连接池可能有问题
- 禁用连接池，每次新建连接，更稳定
**改动内容**:
```diff
- var connectionString = $"Data Source={_dbPath}";
+ var connectionString = $"Data Source={_dbPath};Pooling=false;";
```
**潜在风险**: 
- 性能略有下降，但截图频率低，影响可忽略
**回滚方案**: 移除 Pooling=false

---

### [2026-02-20 14:32] #014
**文件**: `CaptureEngine.cs`
**类型**: 修改
**改动描述**: 添加 Dispose 保护和重复调用检查
**改动原因**: 
- Dispose 可能被多次调用
- 需要防止重复释放资源
**改动内容**:
```diff
+ private bool _disposed;
+ private readonly object _disposeLock = new object();

  public void Dispose()
  {
+     lock (_disposeLock)
+     {
+         if (_disposed) return;
+         _disposed = true;
+     }
      Stop();
      _storage?.Dispose();
      Utils.OcrEngine.Dispose();
  }
```
**潜在风险**: 无
**回滚方案**: 移除 Dispose 保护

---

### [2026-02-20 14:32] #015
**文件**: `Program.cs`
**类型**: 修改
**改动描述**: 修复 ApplicationExit 事件闭包捕获问题
**改动原因**: 
- 闭包中直接引用 tray 和 engine，可能在某些情况下出问题
- 提前捕获引用，确保正确
**改动内容**:
```diff
+ var trayRef = tray;
+ var engineRef = engine;
  Application.ApplicationExit += (s, e) =>
  {
-     try { tray.Dispose(); } catch { }
-     try { engine.Dispose(); } catch { }
+     try { trayRef?.Dispose(); } catch { }
+     try { engineRef?.Dispose(); } catch { }
+     try { _instanceMutex?.Dispose(); } catch { }
  };
```
**潜在风险**: 无
**回滚方案**: 恢复直接引用

---

### [2026-02-20 14:32] #016
**文件**: `UI/TrayIcon.cs`
**类型**: 修改
**改动描述**: 修复 NotifyIcon 残留问题
**改动原因**: 
- Dispose 前必须先隐藏 NotifyIcon
- 否则可能在系统托盘残留
**改动内容**:
```diff
  public void Dispose()
  {
      if (_disposed) return;
      _disposed = true;
      
+     if (_notifyIcon != null)
+     {
+         _notifyIcon.Visible = false;
+         _notifyIcon.Dispose();
+     }
-     _notifyIcon?.Dispose();
      _contextMenu?.Dispose();
  }
```
**潜在风险**: 无
**回滚方案**: 恢复原来的 Dispose 实现

---

### [2026-02-20 14:32] #017
**文件**: `Triggers/WindowSwitchTrigger.cs`
**类型**: 修改
**改动描述**: 添加防重入保护
**改动原因**: 
- Timer 回调可能在处理完成前再次触发
- 需要防止重入导致的数据竞争
**改动内容**:
```diff
+ private long _isProcessing; // 防重入标志

  private void CheckWindow(object? state)
  {
      if (_isPaused || _disposed) return;
+     if (Interlocked.CompareExchange(ref _isProcessing, 1, 0) != 0) return;
+     try { ... }
+     finally { Interlocked.Exchange(ref _isProcessing, 0); }
  }
```
**潜在风险**: 
- 可能跳过某些窗口切换事件，但可接受
**回滚方案**: 移除防重入保护

---

## 改动统计

| 类别 | 数量 |
|------|------|
| NuGet 包调整 | 2 |
| API 适配 | 1 |
| 线程安全 | 2 |
| 资源管理 | 3 |
| 空值检查 | 3 |
| 输入验证 | 1 |
| 配置改进 | 2 |
| 单文件发布兼容 | 3 |
| **总计** | **17** |

## 待验证项

- [ ] Microsoft.Data.Sqlite 在 .NET 6 下编译通过
- [ ] 单文件发布成功
- [ ] 程序启动正常
- [ ] 数据库创建成功
- [ ] OCR 初始化成功
- [ ] 截图保存正常
- [ ] 多实例检查有效
- [ ] 线程安全无崩溃

---

## 验证记录

### [2026-02-20 14:40] 编译运行成功 ✅
**状态**: v4.6 编译通过，程序正常运行
**验证项**:
- [x] 编译通过
- [x] 程序启动正常
- [x] 配置界面显示正常
- [x] 托盘图标正常
- [x] 数据库创建成功
- [ ] OCR 功能待验证（需要模型文件）
- [x] 截图功能正常 ✅ **14:46 验证通过**
- [ ] 数据记录待验证

### [2026-02-20 14:46] 截图功能验证成功 ✅
**状态**: TimelineForm 可以正常显示截图
**验证项**:
- [x] 截图捕获正常
- [x] 缩略图生成正常
- [x] Base64 编码/解码正常
- [x] 数据库保存正常
- [x] TimelineForm 显示正常

**待验证**:
- [ ] OCR 文字识别（需要模型文件）

**关键修复总结**:
1. `System.Data.SQLite` → `Microsoft.Data.Sqlite`（解决 native DLL 加载失败）
2. 移除 `OpenCvSharp4`（避免与 PaddleOCRSharp 冲突）
3. 添加全面的 null 检查和异常处理
4. 修复 Mutex、Dispose、线程安全等问题

**下一步**:
- 准备模型文件，测试 OCR 功能
- 验证截图和数据存储

---

### [2026-02-20 15:18] #020
**文件**: `Program.cs`
**类型**: 修改
**改动描述**: 日志系统 4 层备用机制
**改动原因**: 
- 日志文件可能因多种原因无法写入（权限、路径、磁盘等）
- 需要确保日志一定能记录 somewhere
**改动内容**:
```diff
- 单层 try-catch 备用
+ 4 层备用：主路径 → 程序目录 → 当前目录 → Windows 事件日志
```
**潜在风险**: Windows 事件日志需要管理员权限（首次）
**回滚方案**: 恢复单层备用

---

### [2026-02-20 15:18] #021
**文件**: `Utils/OcrEngine.cs`
**类型**: 修改
**改动描述**: OCR 日志系统 3 层备用机制
**改动原因**: 同 #020，确保 OCR 日志能记录
**改动内容**:
```diff
- 单层 try-catch
+ 3 层备用：主路径 → 程序目录 → 当前目录
```
**潜在风险**: 无
**回滚方案**: 恢复单层备用

---

## 改动统计

| 类别 | 数量 |
|------|------|
| NuGet 包调整 | 2 |
| API 适配 | 1 |
| 线程安全 | 2 |
| 资源管理 | 3 |
| 空值检查 | 5 |
| 输入验证 | 1 |
| 配置改进 | 2 |
| 单文件发布兼容 | 3 |
| 日志系统 | 4 |
| **总计** | **23** |

## 验证记录

### [2026-02-20 14:40] 编译运行成功 ✅
**状态**: v4.6 编译通过，程序正常运行
**验证项**:
- [x] 编译通过
- [x] 程序启动正常
- [x] 配置界面显示正常
- [x] 托盘图标正常
- [x] 数据库创建成功
- [ ] OCR 功能待验证（需要模型文件）
- [x] 截图功能正常 ✅ **14:46 验证通过**
- [ ] 数据记录待验证

### [2026-02-20 14:46] 截图功能验证成功 ✅
**状态**: TimelineForm 可以正常显示截图
**验证项**:
- [x] 截图捕获正常
- [x] 缩略图生成正常
- [x] Base64 编码/解码正常
- [x] 数据库保存正常
- [x] TimelineForm 显示正常

**待验证**:
- [ ] OCR 文字识别（需要模型文件）

### [2026-02-20 15:18] v5.2 发布
**状态**: 日志系统 4 层备用机制完成
**改进**:
- 日志路径 null 检查
- 多层备用路径
- Windows 事件日志最后手段

---

### [2026-02-20 16:06] #022
**文件**: `UI/TrayIcon.cs`
**类型**: 修改
**改动描述**: 全面修复托盘图标右键崩溃问题
**改动原因**: 
- 右键托盘图标时程序崩溃
- 多个事件处理函数缺乏异常保护
- `_engine` 可能为 null
**改动内容**:
```diff
- UpdateStatus: 添加 _engine null 检查和 try-catch
- OnPauseClick: 添加 try-catch
- OnViewClick: 添加详细调试日志
- OnReportClick: 完善异常处理
- OnExitClick: 添加 try-catch，强制退出备用
```
**潜在风险**: 无
**回滚方案**: 恢复原来的实现

---

### [2026-02-20 16:06] #023
**文件**: `CaptureEngine.cs`
**类型**: 修改
**改动描述**: 添加 `_storage` null 检查
**改动原因**: 
- `GetTodayRecords` 和 `GenerateDailyReport` 可能在 `_storage` 为 null 时调用
- 导致托盘菜单崩溃
**改动内容**:
```diff
- GetTodayRecords: 添加 _disposed 和 _storage null 检查
- GenerateDailyReport: 添加 _disposed 和 _storage null 检查
```
**潜在风险**: 无
**回滚方案**: 恢复原来的实现

---

## 改动统计

| 类别 | 数量 |
|------|------|
| NuGet 包调整 | 2 |
| API 适配 | 1 |
| 线程安全 | 2 |
| 资源管理 | 3 |
| 空值检查 | 7 |
| 输入验证 | 1 |
| 配置改进 | 2 |
| 单文件发布兼容 | 3 |
| 日志系统 | 4 |
| 异常处理 | 5 |
| **总计** | **30** |

## 验证记录

### [2026-02-20 14:40] 编译运行成功 ✅
**状态**: v4.6 编译通过，程序正常运行
**验证项**:
- [x] 编译通过
- [x] 程序启动正常
- [x] 配置界面显示正常
- [x] 托盘图标正常
- [x] 数据库创建成功
- [ ] OCR 功能待验证（需要模型文件）
- [x] 截图功能正常 ✅ **14:46 验证通过**
- [ ] 数据记录待验证

### [2026-02-20 14:46] 截图功能验证成功 ✅
**状态**: TimelineForm 可以正常显示截图
**验证项**:
- [x] 截图捕获正常
- [x] 缩略图生成正常
- [x] Base64 编码/解码正常
- [x] 数据库保存正常
- [x] TimelineForm 显示正常

### [2026-02-20 15:55] OCR 初始化成功 ✅
**状态**: OCR 引擎正常初始化并开始识别
**验证项**:
- [x] PaddleOCRSharp 类型加载成功
- [x] 模型文件检测通过
- [x] OCR 引擎创建成功
- [x] 开始识别截图

**待修复**:
- [ ] 托盘图标右键崩溃

### [2026-02-20 16:06] v5.3 发布
**状态**: 托盘图标崩溃问题全面修复
**改进**:
- 所有托盘菜单事件添加异常保护
- `_engine` 和 `_storage` null 检查
- 详细的调试日志

---

*版本: v5.3*
*最后更新: 2026-02-20 16:06*
*最后更新: 2026-02-20 15:18*
