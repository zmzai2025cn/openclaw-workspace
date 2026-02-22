using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Tesseract;

namespace WinCaptureOCR
{
    public static class Program
    {
        [STAThread]
        public static void Main()
        {
            try
            {
                Application.ThreadException += (s, e) => 
                {
                    try { File.AppendAllText("error.log", $"[{DateTime.Now}] {e.Exception}\n"); } catch { }
                };
                
                AppDomain.CurrentDomain.UnhandledException += (s, e) =>
                {
                    try { File.AppendAllText("error.log", $"[{DateTime.Now}] Fatal: {e.ExceptionObject}\n"); } catch { }
                };

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new MainForm());
            }
            catch (Exception ex)
            {
                try { File.AppendAllText("error.log", $"[{DateTime.Now}] Main error: {ex}\n"); } catch { }
                MessageBox.Show($"Startup error: {ex.Message}", "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }

    public class MainForm : Form
    {
        private NotifyIcon? notifyIcon;
        private ContextMenuStrip? trayMenu;
        private System.Timers.Timer? captureTimer;
        private TesseractEngine? engine;
        private bool isInitialized = false;
        private bool isCapturing = false;
        private readonly object captureLock = new object();
        
        private Button? btnCapture;
        private TextBox? txtStatus;
        private NumericUpDown? numInterval;
        private CheckBox? chkAutoCapture;

        public MainForm()
        {
            InitializeComponent();
            InitializeTray();
            System.Threading.Tasks.Task.Run(InitializeOcr);
        }

        private void InitializeComponent()
        {
            var bgDark = Color.FromArgb(30, 30, 35);
            var bgMedium = Color.FromArgb(45, 45, 55);
            var accentBlue = Color.FromArgb(100, 150, 255);
            var textPrimary = Color.FromArgb(240, 240, 245);
            
            Text = "WinCapture OCR v1.6";
            Size = new Size(600, 400);
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(500, 350);
            BackColor = bgDark;
            Font = new Font("Segoe UI", 9);
            
            var lblTitle = new Label
            {
                Text = "Settings",
                Location = new Point(25, 20),
                Size = new Size(200, 30),
                Font = new Font("Segoe UI", 16, FontStyle.Bold),
                ForeColor = textPrimary
            };
            
            var panelSettings = new Panel
            {
                Location = new Point(25, 65),
                Size = new Size(530, 120),
                BackColor = bgMedium
            };
            
            chkAutoCapture = new CheckBox
            {
                Text = "Auto capture every",
                Location = new Point(20, 20),
                AutoSize = true,
                Checked = true,
                ForeColor = textPrimary,
                Font = new Font("Segoe UI", 10)
            };
            
            numInterval = new NumericUpDown
            {
                Location = new Point(190, 18),
                Size = new Size(70, 25),
                Minimum = 3,
                Maximum = 300,
                Value = 10,
                BackColor = bgDark,
                ForeColor = textPrimary,
                BorderStyle = BorderStyle.None
            };
            
            var lblSeconds = new Label
            {
                Text = "seconds",
                Location = new Point(270, 20),
                AutoSize = true,
                ForeColor = textPrimary
            };
            
            btnCapture = new Button
            {
                Text = "Capture Now",
                Location = new Point(20, 65),
                Size = new Size(150, 35),
                Enabled = false,
                FlatStyle = FlatStyle.Flat,
                BackColor = accentBlue,
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 10),
                Cursor = Cursors.Hand
            };
            btnCapture.FlatAppearance.BorderSize = 0;
            btnCapture.Click += (s, e) => SafeCapture();
            
            var btnLogs = new Button
            {
                Text = "View History",
                Location = new Point(185, 65),
                Size = new Size(150, 35),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(80, 80, 90),
                ForeColor = textPrimary,
                Font = new Font("Segoe UI", 10),
                Cursor = Cursors.Hand
            };
            btnLogs.FlatAppearance.BorderSize = 0;
            btnLogs.Click += (s, e) => SafeShowLogs();
            
            panelSettings.Controls.Add(chkAutoCapture);
            panelSettings.Controls.Add(numInterval);
            panelSettings.Controls.Add(lblSeconds);
            panelSettings.Controls.Add(btnCapture);
            panelSettings.Controls.Add(btnLogs);
            
            var panelStatus = new Panel
            {
                Location = new Point(25, 200),
                Size = new Size(530, 130),
                BackColor = bgMedium
            };
            
            var lblStatusTitle = new Label
            {
                Text = "Status",
                Location = new Point(15, 10),
                Size = new Size(100, 20),
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                ForeColor = textPrimary
            };
            
            txtStatus = new TextBox
            {
                Location = new Point(15, 35),
                Size = new Size(500, 85),
                Multiline = true,
                ScrollBars = ScrollBars.Vertical,
                Font = new Font("Consolas", 9),
                BackColor = bgDark,
                ForeColor = textPrimary,
                BorderStyle = BorderStyle.None,
                ReadOnly = true,
                Text = "Initializing..."
            };
            
            panelStatus.Controls.Add(lblStatusTitle);
            panelStatus.Controls.Add(txtStatus);
            
            Controls.Add(lblTitle);
            Controls.Add(panelSettings);
            Controls.Add(panelStatus);
            
            WindowState = FormWindowState.Minimized;
            ShowInTaskbar = false;
        }

        private void InitializeTray()
        {
            trayMenu = new ContextMenuStrip();
            trayMenu.Items.Add("View History", null, (s, e) => SafeShowLogs());
            trayMenu.Items.Add("Settings", null, (s, e) => SafeShowSettings());
            trayMenu.Items.Add(new ToolStripSeparator());
            trayMenu.Items.Add("Exit", null, (s, e) => SafeExit());
            
            notifyIcon = new NotifyIcon
            {
                Icon = SystemIcons.Application,
                Text = "WinCapture OCR",
                Visible = true,
                ContextMenuStrip = trayMenu
            };
            
            notifyIcon.DoubleClick += (s, e) => SafeShowLogs();
        }

        private void InitializeOcr()
        {
            try
            {
                var baseDir = AppDomain.CurrentDomain.BaseDirectory;
                var tessdataPath = Path.Combine(baseDir, "tessdata");
                
                if (!Directory.Exists(tessdataPath))
                {
                    SafeUpdateStatus("Error: tessdata directory not found");
                    return;
                }

                var chiSimPath = Path.Combine(tessdataPath, "chi_sim.traineddata");
                if (!File.Exists(chiSimPath))
                {
                    SafeUpdateStatus("Error: Language pack not found");
                    return;
                }

                var engPath = Path.Combine(tessdataPath, "eng.traineddata");
                var lang = File.Exists(engPath) ? "chi_sim+eng" : "chi_sim";

                engine = new TesseractEngine(tessdataPath, lang, EngineMode.Default);
                engine.SetVariable("tessedit_pageseg_mode", "1");
                engine.SetVariable("preserve_interword_spaces", "1");
                engine.SetVariable("textord_min_linesize", "1.0");
                engine.SetVariable("textord_max_noise_size", "20");
                
                isInitialized = true;
                
                SafeUpdateStatus($"Ready! Version: {engine.Version}\nLanguage: {lang}\nAuto-capture enabled");
                SafeEnableButton(true);
                
                StartTimer();
            }
            catch (Exception ex)
            {
                SafeUpdateStatus($"OCR Init Error: {ex.Message}");
            }
        }

        private void StartTimer()
        {
            if (captureTimer != null)
            {
                captureTimer.Stop();
                captureTimer.Dispose();
            }
            
            captureTimer = new System.Timers.Timer((double)numInterval!.Value * 1000);
            captureTimer.Elapsed += (s, e) => SafeCapture();
            captureTimer.AutoReset = true;
            captureTimer.Start();
        }

        private void SafeCapture()
        {
            if (!isInitialized || engine == null) return;
            if (isCapturing) return;
            if (chkAutoCapture != null && !chkAutoCapture.Checked) return;
            
            lock (captureLock)
            {
                if (isCapturing) return;
                isCapturing = true;
            }
            
            try
            {
                DoCapture();
            }
            catch (Exception ex)
            {
                SafeUpdateStatus($"Capture error: {ex.Message}");
            }
            finally
            {
                isCapturing = false;
            }
        }

        private void DoCapture()
        {
            var screen = Screen.PrimaryScreen;
            if (screen == null) return;

            int width = Math.Min(screen.Bounds.Width, 3840);
            int height = Math.Min(screen.Bounds.Height, 2160);

            using var bitmap = new Bitmap(width, height, System.Drawing.Imaging.PixelFormat.Format24bppRgb);
            using (var g = Graphics.FromImage(bitmap))
            {
                g.CopyFromScreen(screen.Bounds.X, screen.Bounds.Y, 0, 0, new Size(width, height));
            }

            // 先进行 OCR，成功后再保存缩略图
            using var processed = ImagePreprocessor.Preprocess(bitmap);
            
            var tempPath = Path.Combine(Path.GetTempPath(), $"ocr_{Guid.NewGuid()}.png");
            string? thumbPath = null;
            
            try
            {
                processed.Save(tempPath, System.Drawing.Imaging.ImageFormat.Png);
                
                using var img = Pix.LoadFromFile(tempPath);
                using var page = engine!.Process(img);
                
                var text = page.GetText()?.Trim();
                var confidence = page.GetMeanConfidence();

                if (!string.IsNullOrWhiteSpace(text) && text.Length > 3)
                {
                    // OCR 成功，现在保存缩略图
                    thumbPath = SaveThumbnail(bitmap);
                    
                    OcrLogManager.AddEntry(text, confidence, thumbPath);
                    
                    var preview = text.Length > 80 ? text.Substring(0, 80) + "..." : text;
                    SafeUpdateStatus($"[{DateTime.Now:HH:mm:ss}] {text.Length} chars ({confidence:P0})\n{preview}");
                    
                    FlashTrayIcon();
                }
            }
            finally
            {
                try { File.Delete(tempPath); } catch { }
            }
        }

        /// <summary>
        /// 保存缩略图 - v1.6.1 修复版
        /// 修复：确保缩略图在 OCR 前保存，添加详细错误处理
        /// </summary>
        private string SaveThumbnail(Bitmap source)
        {
            try
            {
                var thumbsDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "thumbnails");
                
                // 确保目录存在
                if (!Directory.Exists(thumbsDir))
                {
                    Directory.CreateDirectory(thumbsDir);
                    SafeUpdateStatus($"[DEBUG] Created thumbnails directory: {thumbsDir}");
                }
                
                var fileName = $"thumb_{DateTime.Now:yyyyMMdd_HHmmss}_{Guid.NewGuid():N8}.png";
                var path = Path.Combine(thumbsDir, fileName);
                
                // 使用更高质量的设置保存缩略图
                using var thumb = new Bitmap(320, 180);
                using (var g = Graphics.FromImage(thumb))
                {
                    g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.HighQuality;
                    g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
                    g.DrawImage(source, 0, 0, 320, 180);
                }
                
                // 保存为 PNG，确保格式正确
                thumb.Save(path, System.Drawing.Imaging.ImageFormat.Png);
                
                // 验证文件是否真的存在且有内容
                if (File.Exists(path))
                {
                    var fileInfo = new FileInfo(path);
                    if (fileInfo.Length > 0)
                    {
                        SafeUpdateStatus($"[DEBUG] Thumbnail saved: {path} ({fileInfo.Length} bytes)");
                        return path;
                    }
                    else
                    {
                        SafeUpdateStatus($"[DEBUG] ERROR: Thumbnail file is empty");
                        try { File.Delete(path); } catch { }
                        return "";
                    }
                }
                else
                {
                    SafeUpdateStatus($"[DEBUG] ERROR: Thumbnail file not found after save");
                    return "";
                }
            }
            catch (UnauthorizedAccessException ex)
            {
                SafeUpdateStatus($"[DEBUG] SaveThumbnail permission error: {ex.Message}");
                return "";
            }
            catch (IOException ex)
            {
                SafeUpdateStatus($"[DEBUG] SaveThumbnail IO error: {ex.Message}");
                return "";
            }
            catch (Exception ex)
            {
                SafeUpdateStatus($"[DEBUG] SaveThumbnail error: {ex.GetType().Name}: {ex.Message}");
                return "";
            }
        }

        private void FlashTrayIcon()
        {
            if (notifyIcon == null) return;
            
            System.Threading.Tasks.Task.Run(() =>
            {
                try
                {
                    var original = notifyIcon.Icon;
                    notifyIcon.Icon = SystemIcons.Exclamation;
                    System.Threading.Thread.Sleep(200);
                    notifyIcon.Icon = original;
                }
                catch { }
            });
        }

        private void SafeShowLogs()
        {
            try
            {
                var viewer = new LogViewerForm();
                viewer.Show();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error showing logs: {ex.Message}");
            }
        }

        private void SafeShowSettings()
        {
            try
            {
                WindowState = FormWindowState.Normal;
                ShowInTaskbar = true;
                Show();
                Activate();
            }
            catch { }
        }

        private void SafeExit()
        {
            try
            {
                captureTimer?.Stop();
                captureTimer?.Dispose();
                engine?.Dispose();
                notifyIcon?.Dispose();
                Application.Exit();
            }
            catch { }
        }

        private void SafeUpdateStatus(string message)
        {
            if (txtStatus == null) return;
            
            if (InvokeRequired)
            {
                BeginInvoke(() => SafeUpdateStatus(message));
                return;
            }
            
            try
            {
                txtStatus.AppendText(message + "\r\n");
                txtStatus.ScrollToCaret();
            }
            catch { }
        }

        private void SafeEnableButton(bool enabled)
        {
            if (btnCapture == null) return;
            
            if (InvokeRequired)
            {
                BeginInvoke(() => SafeEnableButton(enabled));
                return;
            }
            
            try
            {
                btnCapture.Enabled = enabled;
            }
            catch { }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                WindowState = FormWindowState.Minimized;
                ShowInTaskbar = false;
                Hide();
            }
            else
            {
                SafeExit();
            }
        }
    }
}
