using System;
using System.Runtime.InteropServices;
using System.Text;

namespace WinCaptureMVP.Utils
{
    public static class WindowHelper
    {
        public static (string AppName, string Title) GetActiveWindowInfo()
        {
            var hwnd = GetForegroundWindow();
            var title = GetWindowTitle(hwnd);
            var appName = GetAppName(hwnd);
            return (appName, title);
        }

        private static string GetWindowTitle(IntPtr hwnd)
        {
            var sb = new StringBuilder(256);
            var length = GetWindowText(hwnd, sb, sb.Capacity);
            return length > 0 ? sb.ToString() : "Unknown";
        }

        private static string GetAppName(IntPtr hwnd)
        {
            System.Diagnostics.Process? process = null;
            try
            {
                GetWindowThreadProcessId(hwnd, out var pid);
                process = System.Diagnostics.Process.GetProcessById((int)pid);
                return process.ProcessName ?? "Unknown";
            }
            catch (ArgumentException)
            {
                // 进程已退出
                return "Unknown";
            }
            catch (InvalidOperationException)
            {
                // 无法访问进程
                return "Unknown";
            }
            catch (Exception ex)
            {
                ErrorReporter.Report(ex, "WindowHelper.GetAppName");
                return "Unknown";
            }
            finally
            {
                try
                {
                    process?.Dispose();
                }
                catch { }
            }
        }

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    }
}
