using System;
using System.Collections.Generic;
using System.Drawing;
using System.Threading;
using System.Windows.Forms;

namespace WinCaptureMVP
{
    public sealed class CaptureEngine : IDisposable
    {
        private readonly Config.UserConfig _config;
        private readonly Triggers.WindowSwitchTrigger _windowTrigger;
        private readonly Triggers.IntervalTrigger _intervalTrigger;
        private readonly Storage.WorkLogStorage _storage;
        private volatile bool _isRunning;
        private volatile bool _isPaused;
        private bool _disposed;
        private readonly object _stateLock = new object();
        private readonly object _disposeLock = new object();

        public bool IsRunning => _isRunning;
        public bool IsPaused => _isPaused;

        public CaptureEngine(Config.UserConfig config)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _storage = new Storage.WorkLogStorage(config);
            _windowTrigger = new Triggers.WindowSwitchTrigger(OnWindowSwitch);
            _intervalTrigger = new Triggers.IntervalTrigger(OnIntervalTrigger);
        }

        public void Start()
        {
            lock (_stateLock)
            {
                if (_isRunning) return;
                _isRunning = true;
            }
            _windowTrigger.Start();
            _intervalTrigger.Start();
        }

        public void Stop()
        {
            lock (_stateLock)
            {
                _isRunning = false;
            }
            _windowTrigger.Stop();
            _intervalTrigger.Stop();
        }

        public void Pause()
        {
            _isPaused = true;
            _windowTrigger.Pause();
            _intervalTrigger.Pause();
        }

        public void Resume()
        {
            _isPaused = false;
            _windowTrigger.Resume();
            _intervalTrigger.Resume();
        }

        private void OnWindowSwitch(string appName, string windowTitle)
        {
            if (_isPaused) return;
            RecordActivity(appName, windowTitle, "window_switch");
        }

        private void OnIntervalTrigger()
        {
            if (_isPaused) return;
            var windowInfo = Utils.WindowHelper.GetActiveWindowInfo();
            RecordActivity(windowInfo.AppName, windowInfo.Title, "interval");
        }

        private void RecordActivity(string appName, string windowTitle, string triggerType)
        {
            Bitmap? screenshot = null;
            Bitmap? thumbnail = null;
            
            try
            {
                if (!Sanitizer.AppFilter.IsAllowed(appName, _config.WhiteList))
                {
                    return;
                }

                screenshot = Utils.ScreenCapture.CaptureScreen();
                if (screenshot == null) return;

                string ocrText = string.Empty;
                try
                {
                    ocrText = Utils.OcrEngine.Recognize(screenshot) ?? string.Empty;
                }
                catch (Exception ex)
                {
                    ErrorReporter.Report(ex, "CaptureEngine.OCR");
                }

                thumbnail = Utils.ImageHelper.CreateThumbnail(screenshot, 320, 180);
                if (thumbnail == null) return;

                string thumbnailBase64 = Utils.ImageHelper.ToBase64(thumbnail);
                if (string.IsNullOrEmpty(thumbnailBase64)) return;

                var record = new WorkRecord
                {
                    Timestamp = DateTime.UtcNow,
                    AppName = appName ?? "Unknown",
                    WindowTitle = windowTitle ?? "Unknown",
                    OcrText = ocrText,
                    ThumbnailBase64 = thumbnailBase64,
                    TriggerType = triggerType
                };

                _storage.Save(record);
            }
            catch (Exception ex)
            {
                ErrorReporter.Report(ex, "CaptureEngine.RecordActivity");
            }
            finally
            {
                // 确保资源释放
                thumbnail?.Dispose();
                screenshot?.Dispose();
            }
        }

        public List<WorkRecord> GetTodayRecords()
        {
            if (_disposed || _storage == null) return new List<WorkRecord>();
            var today = DateTime.UtcNow.Date;
            return _storage.GetRecords(today, today.AddDays(1));
        }

        public DailyReport GenerateDailyReport()
        {
            if (_disposed || _storage == null) return new DailyReport { Date = DateTime.UtcNow.Date, Summary = "无数据" };
            return _storage.GenerateDailyReport(DateTime.UtcNow.Date);
        }

        public void Dispose()
        {
            lock (_disposeLock)
            {
                if (_disposed) return;
                _disposed = true;
            }
            
            Stop();
            _storage?.Dispose();
            Utils.OcrEngine.Dispose();
        }
    }
}
