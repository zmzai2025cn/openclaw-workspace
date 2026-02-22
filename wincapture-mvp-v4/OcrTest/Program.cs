using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Text;

namespace WinCaptureMVP.OcrTest
{
    /// <summary>
    /// OCR 极简验证工具 - 详细日志版
    /// </summary>
    class Program
    {
        private static string LogPath = "ocr_test.log";
        private static readonly StringBuilder LogBuffer = new StringBuilder();

        static Program()
        {
            // 初始化日志路径
            try
            {
                var logDir = AppContext.BaseDirectory ?? ".";
                if (!Directory.Exists(logDir))
                {
                    logDir = ".";
                }
                LogPath = Path.Combine(logDir, $"ocr_test_{DateTime.Now:yyyyMMdd_HHmmss}.log");
            }
            catch
            {
                // 使用默认路径
                LogPath = "ocr_test.log";
            }
        }

        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                Log("==============================================");
                Log("WinCapture OCR 极简验证工具 - 详细日志版");
                Log($"启动时间: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
                Log($"日志文件: {LogPath}");
                Log("==============================================\n");

                Console.WriteLine("================================");
                Console.WriteLine("WinCapture OCR 极简验证工具");
                Console.WriteLine("================================\n");

                RunTest();
            }
            catch (Exception ex)
            {
                try
                {
                    var errorMsg = $"未捕获的异常: {ex.GetType().Name}: {ex.Message}\n{ex.StackTrace}";
                    Log($"[FATAL] {errorMsg}");
                    Console.WriteLine($"\n❌ 致命错误: {ex.Message}");
                }
                catch
                {
                    // 如果连日志都写不了，直接输出到控制台
                    Console.WriteLine($"\n❌ 致命错误: {ex}");
                }
            }
            finally
            {
                // 确保日志保存
                SaveLog();
                
                Console.WriteLine("\n按任意键退出...");
                try
                {
                    Console.ReadKey();
                }
                catch
                {
                    // 如果无法读取按键，等待2秒后退出
                    System.Threading.Thread.Sleep(2000);
                }
            }
        }

        static void RunTest()
        {
            // 步骤 1: 环境检查
            LogStep(1, "环境检查");
            try
            {
                Log($"  当前目录: {Environment.CurrentDirectory}");
                Log($"  程序目录: {AppContext.BaseDirectory ?? "(null)"}");
                Log($"  .NET 版本: {Environment.Version}");
                Log($"  OS 版本: {Environment.OSVersion}");
                Log($"  64位系统: {Environment.Is64BitOperatingSystem}");
                Log($"  64位进程: {Environment.Is64BitProcess}");
            }
            catch (Exception ex)
            {
                Log($"[WARN] 环境检查部分失败: {ex.Message}");
            }

            // 步骤 2: 检查 OCR 可用性
            LogStep(2, "检查 OCR 引擎");
            
            // 强制触发 OCR 初始化（通过尝试识别一个空图片）
            Exception? initException = null;
            try
            {
                Log("  尝试触发 OCR 初始化...");
                // 调用一次 Recognize 会触发延迟初始化
                _ = Utils.OcrEngine.Recognize(null);
            }
            catch (Exception ex)
            {
                Log($"  初始化触发异常: {ex.GetType().Name}: {ex.Message}");
                Log($"  堆栈: {ex.StackTrace}");
                initException = ex;
            }
            
            // 等待一小段时间让初始化完成
            System.Threading.Thread.Sleep(500);
            
            Log($"  IsAvailable: {Utils.OcrEngine.IsAvailable}");
            Log($"  LastErrorMessage: {Utils.OcrEngine.LastErrorMessage ?? "(null)"}");
            if (initException != null)
            {
                Log($"  捕获的异常: {initException.GetType().Name}: {initException.Message}");
            }

            Console.WriteLine("[1/4] 检查 OCR 引擎...");
            if (!Utils.OcrEngine.IsAvailable)
            {
                var error = Utils.OcrEngine.LastErrorMessage ?? initException?.Message ?? "未知错误";
                Log($"[ERROR] OCR 不可用: {error}");
                Console.WriteLine($"❌ OCR 不可用: {error}");
                Console.WriteLine("\n可能原因:");
                Console.WriteLine("  - 模型文件不存在");
                Console.WriteLine("  - Native DLL 缺失");
                Console.WriteLine("  - 初始化失败");
                return;
            }
            Log("[OK] OCR 引擎正常");
            Console.WriteLine("✅ OCR 引擎正常\n");

            // 步骤 3: 截图
            LogStep(3, "截取屏幕");
            Console.WriteLine("[2/4] 截取屏幕...");
            
            Bitmap? screenshot = null;
            try
            {
                Log("  调用 ScreenCapture.CaptureScreen()...");
                screenshot = Utils.ScreenCapture.CaptureScreen();
                
                if (screenshot == null)
                {
                    Log("[ERROR] 截图返回 null");
                    Console.WriteLine("❌ 截图失败");
                    return;
                }
                
                Log($"[OK] 截图成功: {screenshot.Width}x{screenshot.Height}, PixelFormat: {screenshot.PixelFormat}");
                Console.WriteLine($"✅ 截图成功: {screenshot.Width}x{screenshot.Height}\n");
            }
            catch (Exception ex)
            {
                Log($"[ERROR] 截图异常: {ex.GetType().Name}: {ex.Message}");
                Log($"  StackTrace: {ex.StackTrace}");
                Console.WriteLine($"❌ 截图异常: {ex.Message}");
                return;
            }

            // 步骤 4: OCR 识别
            LogStep(4, "OCR 识别");
            Console.WriteLine("[3/4] OCR 识别中...");
            
            string result = string.Empty;
            var startTime = DateTime.Now;
            try
            {
                Log("  调用 OcrEngine.Recognize()...");
                Log($"  图片尺寸: {screenshot.Width}x{screenshot.Height}");
                
                result = Utils.OcrEngine.Recognize(screenshot) ?? string.Empty;
                
                var elapsed = DateTime.Now - startTime;
                Log($"[OK] 识别完成");
                Log($"  耗时: {elapsed.TotalMilliseconds:F0}ms ({elapsed.TotalSeconds:F2}s)");
                Log($"  结果长度: {result.Length} 字符");
                
                var preview = result.Length > 100 ? result.Substring(0, 100) + "..." : result;
                Log($"  结果前100字符: {preview}");
                
                Console.WriteLine($"✅ 识别完成 (耗时: {elapsed.TotalSeconds:F2}s)\n");
            }
            catch (Exception ex)
            {
                Log($"[ERROR] 识别异常: {ex.GetType().Name}: {ex.Message}");
                Log($"  StackTrace: {ex.StackTrace}");
                Console.WriteLine($"❌ 识别异常: {ex.Message}");
            }
            finally
            {
                // 确保资源释放
                if (screenshot != null)
                {
                    try
                    {
                        Log("  释放 screenshot...");
                        screenshot.Dispose();
                        Log("  screenshot 已释放");
                    }
                    catch (Exception ex)
                    {
                        Log($"[WARN] 释放 screenshot 时异常: {ex.Message}");
                    }
                }
            }

            // 步骤 5: 输出结果
            LogStep(5, "输出结果");
            Console.WriteLine("[4/4] 识别结果:");
            Console.WriteLine("--------------------------------");
            
            if (string.IsNullOrWhiteSpace(result))
            {
                Log("[WARN] 识别结果为空");
                Console.WriteLine("(无文字识别结果)");
            }
            else
            {
                Log($"[INFO] 识别结果:\n{result}");
                Console.WriteLine(result);
            }
            
            Console.WriteLine("--------------------------------");
            Console.WriteLine($"\n文字长度: {result.Length} 字符");

            // 步骤 6: 保存调试图片
            LogStep(6, "保存调试图片");
            try
            {
                var baseDir = AppContext.BaseDirectory ?? ".";
                if (!Directory.Exists(baseDir))
                {
                    baseDir = ".";
                }
                var debugPath = Path.Combine(baseDir, $"ocr_test_{DateTime.Now:yyyyMMdd_HHmmss}.png");
                Log($"  保存路径: {debugPath}");
                
                using var newScreenshot = Utils.ScreenCapture.CaptureScreen();
                if (newScreenshot != null)
                {
                    newScreenshot.Save(debugPath, ImageFormat.Png);
                    Log("[OK] 调试图片已保存");
                    Console.WriteLine($"调试图片已保存: {debugPath}");
                }
                else
                {
                    Log("[WARN] 第二次截图返回 null，未保存图片");
                }
            }
            catch (Exception ex)
            {
                Log($"[WARN] 保存调试图片失败: {ex.Message}");
            }

            Log("\n==============================================");
            Log("验证完成");
            Log("==============================================");
        }

        static void LogStep(int step, string message)
        {
            try
            {
                var logMsg = $"\n[步骤 {step}] {message}";
                Log(logMsg);
            }
            catch
            {
                // 忽略日志写入错误
            }
        }

        static void Log(string message)
        {
            try
            {
                var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
                var logLine = $"[{timestamp}] {message}";
                LogBuffer.AppendLine(logLine);
            }
            catch
            {
                // 忽略日志写入错误
            }
        }

        static void SaveLog()
        {
            try
            {
                if (LogBuffer.Length > 0)
                {
                    // 使用 UTF-8 编码，避免乱码
                    File.WriteAllText(LogPath, LogBuffer.ToString(), Encoding.UTF8);
                    Console.WriteLine($"\n详细日志已保存: {LogPath}");
                }
            }
            catch (Exception ex)
            {
                try
                {
                    Console.WriteLine($"\n保存日志失败: {ex.Message}");
                    Console.WriteLine("=== 日志内容 ===");
                    Console.WriteLine(LogBuffer.ToString());
                }
                catch
                {
                    // 最后手段：忽略
                }
            }
        }
    }
}
