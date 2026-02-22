using System;
using System.Threading;

namespace WinCaptureMVP.Triggers
{
    public sealed class IntervalTrigger : ITrigger, IDisposable
    {
        private readonly Action _callback;
        private Timer? _timer;
        private bool _isPaused;
        private long _isProcessing;
        private bool _disposed;
        private const int IntervalMs = 30000;

        public IntervalTrigger(Action callback)
        {
            _callback = callback ?? throw new ArgumentNullException(nameof(callback));
        }

        public void Start()
        {
            if (_disposed) throw new ObjectDisposedException(nameof(IntervalTrigger));
            _timer = new Timer(OnInterval, null, IntervalMs, IntervalMs);
        }

        public void Stop()
        {
            _timer?.Dispose();
            _timer = null;
        }

        public void Pause() => _isPaused = true;
        public void Resume() => _isPaused = false;

        private void OnInterval(object? state)
        {
            if (_isPaused || _disposed) return;
            if (Interlocked.CompareExchange(ref _isProcessing, 1, 0) != 0) return;

            try
            {
                _callback();
            }
            catch (Exception ex)
            {
                ErrorReporter.Report(ex, "IntervalTrigger.OnInterval");
            }
            finally
            {
                Interlocked.Exchange(ref _isProcessing, 0);
            }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            Stop();
        }
    }
}
