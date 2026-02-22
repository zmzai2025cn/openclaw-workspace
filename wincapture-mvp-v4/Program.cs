using System;
using System.IO;
using System.Windows.Forms;

namespace WinCaptureMVP
{
    /// <summary>
    /// 程序入口
    /// </summary>
    internal static class Program
    {
        private static readonly string LogPath;
        private static System.Threading.Mutex? _instanceMutex; // 保持引用防止GC回收

        static Program()
        {
            // 初始化日志路径
            string logDir;
            try
            {
                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                if (!string.IsNullOrEmpty(localAppData))
                {
                    logDir = Path.Combine(localAppData, "WinCaptureMVP");
                }
                else
                {
                    logDir = AppContext.BaseDirectory;
                }
            }
            catch
            {
                logDir = AppContext.BaseDirectory;
            }
            
            // 确保 logDir 不为空
            if (string.IsNullOrEmpty(logDir))
            {
                logDir = ".";
            }
            
            LogPath = Path.Combine(logDir, "app_log.txt");
        }

        /// <summary>
        /// 写入日志 - 多层备用机制
        /// </summary>
        private static void Log(string message)
        {
            var logEntry = $"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} [{System.Threading.Thread.CurrentThread.ManagedThreadId}] {message}";
            
            // 尝试 1: 主日志路径（如果 LogPath 有效）
            if (!string.IsNullOrEmpty(LogPath))
            {
                try
                {
                    var dir = Path.GetDirectoryName(LogPath);
                    if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    {
                        Directory.CreateDirectory(dir);
                    }
                    File.AppendAllText(LogPath, logEntry + Environment.NewLine);
                    return; // 成功，直接返回
                }
                catch { }
            }
            
            // 尝试 2: 备用路径（程序目录）
            try
            {
                var fallbackPath = Path.Combine(AppContext.BaseDirectory ?? ".", "app_log.txt");
                File.AppendAllText(fallbackPath, logEntry + Environment.NewLine);
                return;
            }
            catch { }
            
            // 尝试 3: 当前工作目录
            try
            {
                File.AppendAllText("app_log.txt", logEntry + Environment.NewLine);
                return;
            }
            catch { }
            
            // 尝试 4: Windows 事件日志（最后手段）
            try
            {
                System.Diagnostics.EventLog.WriteEntry("Application", $"WinCaptureMVP: {logEntry}", System.Diagnostics.EventLogEntryType.Information);
            }
            catch { }
        }

        /// <summary>
        /// 写入错误日志
        /// </summary>
        private static void LogError(string message, Exception? ex = null)
        {
            var sb = new System.Text.StringBuilder();
            sb.AppendLine($"[ERROR] {message}");
            if (ex != null)
            {
                sb.AppendLine($"  Exception: {ex.GetType().Name}");
                sb.AppendLine($"  Message: {ex.Message}");
                sb.AppendLine($"  StackTrace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    sb.AppendLine($"  InnerException: {ex.InnerException.Message}");
                }
            }
            Log(sb.ToString());
        }

        [STAThread]
        private static void Main()
        {
            Log("==============================================");
            Log("应用程序启动");

            // 运行启动自检
            RunStartupCheck();

            // 检查是否已有实例在运行
            if (IsAlreadyRunning())
            {
                Log("检测到已有实例在运行，退出");
                MessageBox.Show("采集端已在运行", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            try
            {
                // 初始化 Windows 窗体应用程序
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Log("UI 框架初始化完成");

                // 加载配置
                Config.UserConfig config;
                try
                {
                    config = Config.UserConfig.Load();
                    Log($"配置加载完成，用户ID: {config.UserId ?? "(未设置)"}");
                }
                catch (Exception ex)
                {
                    Log($"配置加载失败: {ex.Message}，使用默认配置");
                    config = new Config.UserConfig();
                }

                // 首次运行显示配置界面
                if (string.IsNullOrWhiteSpace(config.UserId))
                {
                    Log("首次运行，显示配置界面");
                    using var form = new UI.ConfigForm(config);
                    var result = form.ShowDialog();
                    if (result != DialogResult.OK)
                    {
                        Log("用户取消配置，退出程序");
                        return;
                    }
                    Log("配置完成");
                }

                // 再次检查配置是否有效
                if (string.IsNullOrWhiteSpace(config.UserId))
                {
                    Log("错误: 用户ID仍为空");
                    MessageBox.Show("配置无效，请重新运行程序", "错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                // 创建采集引擎
                CaptureEngine engine;
                try
                {
                    Log("正在创建采集引擎...");
                    engine = new CaptureEngine(config);
                    Log("采集引擎创建成功");
                }
                catch (Exception ex)
                {
                    Log($"创建采集引擎失败: {ex.Message}");
                    Log($"堆栈跟踪: {ex.StackTrace}");
                    MessageBox.Show($"初始化失败: {ex.Message}", "错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                // 创建托盘图标
                UI.TrayIcon tray;
                try
                {
                    Log("正在创建托盘图标...");
                    tray = new UI.TrayIcon(engine);
                    Log("托盘图标创建成功");
                }
                catch (Exception ex)
                {
                    Log($"创建托盘图标失败: {ex.Message}");
                    engine.Dispose();
                    MessageBox.Show($"初始化失败: {ex.Message}", "错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                // 启动引擎
                try
                {
                    Log("正在启动采集引擎...");
                    engine.Start();
                    Log("采集引擎已启动");
                }
                catch (Exception ex)
                {
                    Log($"启动采集引擎失败: {ex.Message}");
                    tray.Dispose();
                    engine.Dispose();
                    MessageBox.Show($"启动失败: {ex.Message}", "错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                // 注册退出事件
                var trayRef = tray;
                var engineRef = engine;
                Application.ApplicationExit += (s, e) =>
                {
                    Log("应用程序正在退出...");
                    try { trayRef?.Dispose(); } catch { }
                    try { engineRef?.Dispose(); } catch { }
                    try { _instanceMutex?.Dispose(); } catch { }
                    Log("资源已清理");
                    Log("==============================================");
                };

                Log("进入主消息循环");
                Application.Run();
            }
            catch (Exception ex)
            {
                var errorMsg = $"程序遇到致命错误: {ex.Message}";
                Log(errorMsg);
                Log($"堆栈跟踪: {ex.StackTrace}");
                
                try
                {
                    MessageBox.Show(errorMsg, "致命错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
                catch { }
            }
        }

        /// <summary>
        /// 运行启动自检并生成报告
        /// </summary>
        private static void RunStartupCheck()
        {
            Log("--- 启动自检开始 ---");
            var report = new System.Text.StringBuilder();
            report.AppendLine("=== WinCapture MVP 启动自检报告 ===");
            report.AppendLine($"时间: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            report.AppendLine($"版本: v5.6");
            report.AppendLine();

            // 1. 检查 .NET 运行时
            report.AppendLine("[1] 运行时环境");
            report.AppendLine($"    .NET 版本: {Environment.Version}");
            report.AppendLine($"    OS 版本: {Environment.OSVersion}");
            report.AppendLine($"    64位系统: {Environment.Is64BitOperatingSystem}");
            report.AppendLine($"    64位进程: {Environment.Is64BitProcess}");
            report.AppendLine($"    工作目录: {Environment.CurrentDirectory}");
            report.AppendLine($"    程序目录: {AppContext.BaseDirectory}");
            Log("运行时环境检查完成");

            // 2. 检查模型文件
            report.AppendLine();
            report.AppendLine("[2] OCR 模型文件");
            var exePath = GetExecutableDirectory();
            var modelPaths = new[]
            {
                Path.Combine(exePath, "paddleocr_models"),
                Path.Combine(AppContext.BaseDirectory ?? ".", "paddleocr_models"),
                Path.Combine(Environment.CurrentDirectory, "paddleocr_models")
            };

            string? foundModelPath = null;
            string? foundVersion = null;
            foreach (var modelPath in modelPaths)
            {
                report.AppendLine($"    检查: {modelPath}");
                if (Directory.Exists(modelPath))
                {
                    // 检查 v3
                    var detV3 = Path.Combine(modelPath, "ch_PP-OCRv3_det_infer");
                    var recV3 = Path.Combine(modelPath, "ch_PP-OCRv3_rec_infer");
                    var keysV3 = Path.Combine(modelPath, "ppocr_keys_v1.txt");
                    if (Directory.Exists(detV3) && Directory.Exists(recV3) && File.Exists(keysV3))
                    {
                        foundModelPath = modelPath;
                        foundVersion = "v3";
                        report.AppendLine($"    结果: 找到 v3 模型");
                        break;
                    }

                    // 检查 v4
                    var detV4 = Path.Combine(modelPath, "ch_PP-OCRv4_det_infer");
                    var recV4 = Path.Combine(modelPath, "ch_PP-OCRv4_rec_infer");
                    var keysV4 = Path.Combine(modelPath, "ppocr_keys.txt");
                    if (Directory.Exists(detV4) && Directory.Exists(recV4) && File.Exists(keysV4))
                    {
                        foundModelPath = modelPath;
                        foundVersion = "v4";
                        report.AppendLine($"    结果: 找到 v4 模型");
                        break;
                    }
                }
            }

            if (foundModelPath == null)
            {
                report.AppendLine("    结果: 未找到有效模型！");
                report.AppendLine("    解决: 运行 download-v3-models.ps1 下载模型");
            }
            else
            {
                report.AppendLine($"    使用模型: {foundVersion}");
                report.AppendLine($"    模型路径: {foundModelPath}");

                // 详细检查模型文件
                var detDir = Path.Combine(foundModelPath, $"ch_PP-OCR{foundVersion}_det_infer");
                var recDir = Path.Combine(foundModelPath, $"ch_PP-OCR{foundVersion}_rec_infer");
                var keysFile = Path.Combine(foundModelPath, foundVersion == "v3" ? "ppocr_keys_v1.txt" : "ppocr_keys.txt");

                report.AppendLine($"    检测模型: {(Directory.Exists(detDir) ? "存在" : "缺失")}");
                report.AppendLine($"    识别模型: {(Directory.Exists(recDir) ? "存在" : "缺失")}");
                report.AppendLine($"    字典文件: {(File.Exists(keysFile) ? "存在" : "缺失")}");

                if (Directory.Exists(detDir))
                {
                    var detModel = Path.Combine(detDir, "inference.pdmodel");
                    var detParams = Path.Combine(detDir, "inference.pdiparams");
                    report.AppendLine($"      inference.pdmodel: {(File.Exists(detModel) ? "存在" : "缺失")}");
                    report.AppendLine($"      inference.pdiparams: {(File.Exists(detParams) ? "存在" : "缺失")}");
                }
                if (Directory.Exists(recDir))
                {
                    var recModel = Path.Combine(recDir, "inference.pdmodel");
                    var recParams = Path.Combine(recDir, "inference.pdiparams");
                    report.AppendLine($"      inference.pdmodel: {(File.Exists(recModel) ? "存在" : "缺失")}");
                    report.AppendLine($"      inference.pdiparams: {(File.Exists(recParams) ? "存在" : "缺失")}");
                }
            }
            Log("模型文件检查完成");

            // 3. 检查 Native DLL
            report.AppendLine();
            report.AppendLine("[3] Native DLL 文件");
            var requiredDlls = new[] { "paddle_inference.dll", "mkldnn.dll", "mklml.dll", "opencv_world470.dll", "PaddleOCR.dll" };
            var dllPath = exePath;
            var allDllsExist = true;
            foreach (var dll in requiredDlls)
            {
                var dllFile = Path.Combine(dllPath, dll);
                var exists = File.Exists(dllFile);
                report.AppendLine($"    {dll}: {(exists ? "存在" : "缺失")}");
                if (!exists) allDllsExist = false;
            }
            if (!allDllsExist)
            {
                report.AppendLine("    警告: 部分 DLL 缺失，OCR 可能无法正常工作");
                report.AppendLine("    解决: 运行 publish.ps1 或手动复制 PaddleOCRSharp DLL");
            }
            Log("Native DLL 检查完成");

            // 4. 检查数据目录
            report.AppendLine();
            report.AppendLine("[4] 数据目录");
            try
            {
                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                if (!string.IsNullOrEmpty(localAppData))
                {
                    var dataDir = Path.Combine(localAppData, "WinCaptureMVP");
                    report.AppendLine($"    主数据目录: {dataDir}");
                    report.AppendLine($"    目录可写: {CanWriteToDirectory(dataDir)}");
                }
                else
                {
                    report.AppendLine("    警告: 无法获取 LocalApplicationData");
                }
            }
            catch (Exception ex)
            {
                report.AppendLine($"    错误: {ex.Message}");
            }
            Log("数据目录检查完成");

            // 5. 总结
            report.AppendLine();
            report.AppendLine("[5] 自检总结");
            if (foundModelPath != null && allDllsExist)
            {
                report.AppendLine("    状态: 通过，可以正常启动");
            }
            else if (foundModelPath != null)
            {
                report.AppendLine("    状态: 警告，模型存在但 DLL 可能缺失");
            }
            else
            {
                report.AppendLine("    状态: 失败，模型文件缺失");
            }
            report.AppendLine("==================================");

            // 写入自检报告
            var reportPath = Path.Combine(exePath, "startup_check_report.txt");
            try
            {
                File.WriteAllText(reportPath, report.ToString());
                Log($"自检报告已保存: {reportPath}");
            }
            catch (Exception ex)
            {
                Log($"保存自检报告失败: {ex.Message}");
            }

            // 同时输出到日志
            Log("自检报告:");
            foreach (var line in report.ToString().Split('\n'))
            {
                Log("  " + line.TrimEnd());
            }
            Log("--- 启动自检结束 ---");
        }

        /// <summary>
        /// 检查目录是否可写
        /// </summary>
        private static bool CanWriteToDirectory(string path)
        {
            try
            {
                if (!Directory.Exists(path))
                {
                    Directory.CreateDirectory(path);
                }
                var testFile = Path.Combine(path, $".write_test_{Guid.NewGuid()}.tmp");
                File.WriteAllText(testFile, "test");
                File.Delete(testFile);
                return true;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// 获取执行文件所在目录
        /// </summary>
        private static string GetExecutableDirectory()
        {
            try
            {
                var mainModule = System.Diagnostics.Process.GetCurrentProcess().MainModule;
                if (mainModule?.FileName != null)
                {
                    var dir = Path.GetDirectoryName(mainModule.FileName);
                    if (!string.IsNullOrEmpty(dir) && Directory.Exists(dir))
                    {
                        return dir;
                    }
                }
            }
            catch { }

            try
            {
                var entryAssembly = System.Reflection.Assembly.GetEntryAssembly();
                if (entryAssembly?.Location != null)
                {
                    var dir = Path.GetDirectoryName(entryAssembly.Location);
                    if (!string.IsNullOrEmpty(dir) && Directory.Exists(dir))
                    {
                        return dir;
                    }
                }
            }
            catch { }

            return AppContext.BaseDirectory ?? ".";
        }

        /// <summary>
        /// 检查是否已有实例在运行
        /// </summary>
        private static bool IsAlreadyRunning()
        {
            const string MutexName = "WinCaptureMVP_SingleInstance_v2";
            try
            {
                // 尝试创建互斥体
                _instanceMutex = new System.Threading.Mutex(false, MutexName, out bool createdNew);
                if (!createdNew)
                {
                    // 互斥体已存在，说明已有实例在运行
                    _instanceMutex.Dispose();
                    _instanceMutex = null;
                    return true;
                }
                // 保持互斥体引用，防止GC回收
                return false;
            }
            catch (Exception ex)
            {
                Log($"互斥体检查失败: {ex.Message}");
                // 出错时保守处理，假设已有实例
                return true;
            }
        }
    }
}
