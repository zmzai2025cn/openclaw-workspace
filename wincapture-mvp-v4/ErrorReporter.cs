using System;
using System.IO;

namespace WinCaptureMVP
{
    /// <summary>
    /// 统一错误上报系统
    /// </summary>
    public static class ErrorReporter
    {
        private static readonly string ErrorLogPath;
        private static readonly object LogLock = new object();

        static ErrorReporter()
        {
            try
            {
                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                if (!string.IsNullOrEmpty(localAppData))
                {
                    var logDir = Path.Combine(localAppData, "WinCaptureMVP");
                    Directory.CreateDirectory(logDir);
                    ErrorLogPath = Path.Combine(logDir, "error.log");
                }
                else
                {
                    ErrorLogPath = Path.Combine(AppContext.BaseDirectory ?? ".", "error.log");
                }
            }
            catch
            {
                ErrorLogPath = "error.log";
            }
        }

        /// <summary>
        /// 上报异常
        /// </summary>
        public static void Report(Exception ex, string context, bool showToUser = false)
        {
            var message = FormatException(ex, context);
            
            // 写入日志
            LogToFile(message);
            
            // 调试输出
            System.Diagnostics.Debug.WriteLine(message);
            
            // 可选：显示给用户
            if (showToUser)
            {
                try
                {
                    System.Windows.Forms.MessageBox.Show(
                        $"[{context}] {ex.Message}",
                        "错误",
                        System.Windows.Forms.MessageBoxButtons.OK,
                        System.Windows.Forms.MessageBoxIcon.Error);
                }
                catch { }
            }
        }

        /// <summary>
        /// 上报错误信息
        /// </summary>
        public static void Report(string context, string message, bool showToUser = false)
        {
            var logEntry = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [{context}] {message}";
            
            LogToFile(logEntry);
            System.Diagnostics.Debug.WriteLine(logEntry);
            
            if (showToUser)
            {
                try
                {
                    System.Windows.Forms.MessageBox.Show(
                        message,
                        context,
                        System.Windows.Forms.MessageBoxButtons.OK,
                        System.Windows.Forms.MessageBoxIcon.Warning);
                }
                catch { }
            }
        }

        /// <summary>
        /// 格式化异常信息
        /// </summary>
        private static string FormatException(Exception ex, string context)
        {
            var sb = new System.Text.StringBuilder();
            sb.AppendLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [{context}]");
            sb.AppendLine($"  Type: {ex.GetType().FullName}");
            sb.AppendLine($"  Message: {ex.Message}");
            sb.AppendLine($"  StackTrace: {ex.StackTrace}");
            
            if (ex.InnerException != null)
            {
                sb.AppendLine($"  InnerException: {ex.InnerException.Message}");
            }
            
            return sb.ToString();
        }

        /// <summary>
        /// 写入日志文件
        /// </summary>
        private static void LogToFile(string message)
        {
            lock (LogLock)
            {
                try
                {
                    File.AppendAllText(ErrorLogPath, message + Environment.NewLine);
                }
                catch
                {
                    // 最后手段：忽略错误
                }
            }
        }

        /// <summary>
        /// 获取错误日志路径
        /// </summary>
        public static string GetLogPath() => ErrorLogPath;
    }
}
