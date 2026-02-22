using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace WinCaptureMVP.Triggers
{
    public sealed class WindowSwitchTrigger : ITrigger, IDisposable
    {
        private readonly Action<string, string> _callback;
        private IntPtr _lastHwnd;
        private Timer? _timer;
        private bool _isPaused;
        private bool _disposed;
        private long _isProcessing; // 防重入标志

        public WindowSwitchTrigger(Action<string, string> callback)
        {
            _callback = callback ?? throw new ArgumentNullException(nameof(callback));
        }

        public void Start()
        {
            if (_disposed) throw new ObjectDisposedException(nameof(WindowSwitchTrigger));
            _timer = new Timer(CheckWindow, null, 0, 500);
        }

        public void Stop()
        {
            _timer?.Dispose();
            _timer = null;
        }

        public void Pause() => _isPaused = true;
        public void Resume() => _isPaused = false;

        private void CheckWindow(object? state)
        {
            if (_isPaused || _disposed) return;
            if (Interlocked.CompareExchange(ref _isProcessing, 1, 0) != 0) return; // 防重入

            try
            {
                var currentHwnd = GetForegroundWindow();
                if (currentHwnd == _lastHwnd) return;
                
                _lastHwnd = currentHwnd;
                var title = GetWindowTitle(currentHwnd);
                var appName = GetAppName(currentHwnd);
                
                try
                {
                    _callback(appName, title);
                }
                catch (Exception ex)
                {
                    ErrorReporter.Report(ex, "WindowSwitchTrigger.Callback");
                }
            }
            catch (Exception ex)
            {
                ErrorReporter.Report(ex, "WindowSwitchTrigger.CheckWindow");
            }
            finally
            {
                Interlocked.Exchange(ref _isProcessing, 0);
            }
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
                ErrorReporter.Report(ex, "WindowSwitchTrigger.GetAppName");
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

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            Stop();
        }

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    }
}
