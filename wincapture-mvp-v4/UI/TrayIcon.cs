using System;
using System.Drawing;
using System.Windows.Forms;

namespace WinCaptureMVP.UI
{
    public sealed class TrayIcon : IDisposable
    {
        private readonly CaptureEngine _engine;
        private NotifyIcon? _notifyIcon;
        private ContextMenuStrip? _contextMenu;
        private ToolStripMenuItem? _statusItem;
        private ToolStripMenuItem? _pauseItem;
        private bool _disposed;

        public TrayIcon(CaptureEngine engine)
        {
            _engine = engine ?? throw new ArgumentNullException(nameof(engine));
            Initialize();
        }

        private void Initialize()
        {
            _notifyIcon = new NotifyIcon
            {
                Icon = SystemIcons.Application,
                Text = "WinCapture MVP",
                Visible = true
            };

            _contextMenu = new ContextMenuStrip();
            
            _statusItem = new ToolStripMenuItem("状态: 运行中") { Enabled = false };
            _contextMenu.Items.Add(_statusItem);
            _contextMenu.Items.Add(new ToolStripSeparator());
            
            _pauseItem = new ToolStripMenuItem("暂停采集", null, OnPauseClick);
            _contextMenu.Items.Add(_pauseItem);
            _contextMenu.Items.Add(new ToolStripMenuItem("查看今日记录", null, OnViewClick));
            _contextMenu.Items.Add(new ToolStripMenuItem("生成日报", null, OnReportClick));
            _contextMenu.Items.Add(new ToolStripSeparator());
            _contextMenu.Items.Add(new ToolStripMenuItem("退出", null, OnExitClick));

            _notifyIcon.ContextMenuStrip = _contextMenu;
            _notifyIcon.DoubleClick += OnViewClick;
            _contextMenu.Opening += (s, e) => UpdateStatus();
        }

        private void UpdateStatus()
        {
            if (_statusItem == null || _pauseItem == null || _notifyIcon == null || _engine == null)
                return;

            // ContextMenuStrip.Opening 事件在 UI 线程触发，不需要 Invoke
            try
            {
                if (_engine.IsPaused)
                {
                    _statusItem.Text = "状态: 已暂停";
                    _pauseItem.Text = "恢复采集";
                    _notifyIcon.Text = "WinCapture MVP (已暂停)";
                }
                else
                {
                    _statusItem.Text = "状态: 运行中";
                    _pauseItem.Text = "暂停采集";
                    _notifyIcon.Text = "WinCapture MVP";
                }
            }
            catch (Exception ex)
            {
                ErrorReporter.Report(ex, "TrayIcon.UpdateStatus");
            }
        }

        private void OnPauseClick(object? sender, EventArgs e)
        {
            try
            {
                if (_engine == null) return;
                
                if (_engine.IsPaused)
                    _engine.Resume();
                else
                    _engine.Pause();
                UpdateStatus();
            }
            catch (Exception ex)
            {
                ErrorReporter.Report(ex, "TrayIcon.OnPauseClick");
            }
        }

        private void OnViewClick(object? sender, EventArgs e)
        {
            try
            {
                System.Diagnostics.Debug.WriteLine("OnViewClick: 开始获取记录");
                var records = _engine.GetTodayRecords();
                System.Diagnostics.Debug.WriteLine($"OnViewClick: 获取到 {records?.Count ?? 0} 条记录");
                
                if (records == null || records.Count == 0)
                {
                    MessageBox.Show("今日暂无记录", "提示", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                
                System.Diagnostics.Debug.WriteLine("OnViewClick: 创建 TimelineForm");
                using var form = new TimelineForm(records);
                System.Diagnostics.Debug.WriteLine("OnViewClick: 显示对话框");
                form.ShowDialog();
                System.Diagnostics.Debug.WriteLine("OnViewClick: 对话框关闭");
            }
            catch (Exception ex)
            {
                ErrorReporter.Report(ex, "TrayIcon.OnViewClick", true);
            }
        }

        private void OnReportClick(object? sender, EventArgs e)
        {
            try
            {
                var report = _engine.GenerateDailyReport();
                MessageBox.Show(report.Summary, "今日工作日报", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                ErrorReporter.Report(ex, "TrayIcon.OnReportClick", true);
            }
        }

        private void OnExitClick(object? sender, EventArgs e)
        {
            try
            {
                if (_notifyIcon != null)
                    _notifyIcon.Visible = false;
                Application.Exit();
            }
            catch (Exception ex)
            {
                ErrorReporter.Report(ex, "TrayIcon.OnExitClick");
                // 强制退出
                Environment.Exit(0);
            }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            
            if (_notifyIcon != null)
            {
                _notifyIcon.Visible = false;
                _notifyIcon.Dispose();
            }
            _contextMenu?.Dispose();
        }
    }
}
