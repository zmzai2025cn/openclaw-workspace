using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace WinCaptureOCR
{
    /// <summary>
    /// 现代化深色主题日志查看器 - v1.6.1 修复版
    /// 修复缩略图显示问题
    /// </summary>
    public class LogViewerForm : Form
    {
        private ListView? listView;
        private TextBox? txtSearch;
        private PictureBox? picThumbnail;
        private TextBox? txtDetail;
        private Label? lblStatus;
        private Label? lblThumbStatus; // 新增：缩略图状态标签
        
        // 配色方案 - 深色主题
        private readonly Color bgDark = Color.FromArgb(30, 30, 35);
        private readonly Color bgMedium = Color.FromArgb(45, 45, 55);
        private readonly Color bgLight = Color.FromArgb(60, 60, 75);
        private readonly Color accentBlue = Color.FromArgb(100, 150, 255);
        private readonly Color textPrimary = Color.FromArgb(240, 240, 245);
        private readonly Color textSecondary = Color.FromArgb(180, 180, 190);
        private readonly Color textWarning = Color.FromArgb(255, 200, 100);
        private readonly Color textError = Color.FromArgb(255, 100, 100);
        
        public LogViewerForm()
        {
            Text = "OCR History";
            Size = new Size(1200, 750);
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(900, 600);
            BackColor = bgDark;
            Font = new Font("Segoe UI", 9);
            
            CreateControls();
            LoadData();
        }
        
        private void CreateControls()
        {
            // 标题栏
            var lblTitle = new Label
            {
                Text = "📋 OCR History",
                Location = new Point(20, 15),
                Size = new Size(300, 30),
                Font = new Font("Segoe UI", 14, FontStyle.Bold),
                ForeColor = textPrimary
            };
            
            // 搜索栏
            var panelSearch = new Panel
            {
                Location = new Point(20, 55),
                Size = new Size(1140, 45),
                BackColor = bgMedium,
                BorderStyle = BorderStyle.None
            };
            
            // 搜索图标
            var lblSearchIcon = new Label
            {
                Text = "🔍",
                Location = new Point(12, 10),
                Size = new Size(25, 25),
                Font = new Font("Segoe UI", 12)
            };
            
            txtSearch = new TextBox
            {
                Location = new Point(45, 10),
                Size = new Size(300, 25),
                BorderStyle = BorderStyle.None,
                BackColor = bgLight,
                ForeColor = textPrimary,
                Font = new Font("Segoe UI", 10),
                PlaceholderText = "Search text..."
            };
            
            var btnSearch = CreateModernButton("Search", 360, 8, 80);
            btnSearch.Click += (s, e) => LoadData();
            
            var btnRefresh = CreateModernButton("🔄 Refresh", 450, 8, 100);
            btnRefresh.Click += (s, e) => LoadData();
            
            var btnClear = CreateModernButton("🗑 Clear", 950, 8, 100, Color.FromArgb(255, 100, 100));
            btnClear.Click += OnClear;
            
            lblStatus = new Label
            {
                Location = new Point(1070, 14),
                Size = new Size(60, 20),
                ForeColor = textSecondary,
                TextAlign = ContentAlignment.MiddleRight
            };
            
            panelSearch.Controls.Add(lblSearchIcon);
            panelSearch.Controls.Add(txtSearch);
            panelSearch.Controls.Add(btnSearch);
            panelSearch.Controls.Add(btnRefresh);
            panelSearch.Controls.Add(btnClear);
            panelSearch.Controls.Add(lblStatus);
            
            // 主内容区 - 分割面板
            var splitMain = new SplitContainer
            {
                Location = new Point(20, 110),
                Size = new Size(1140, 580),
                Orientation = Orientation.Horizontal,
                SplitterDistance = 380,
                BackColor = bgMedium,
                Panel1MinSize = 200,
                Panel2MinSize = 150
            };
            
            // 上半部分 - 列表
            listView = new ListView
            {
                Dock = DockStyle.Fill,
                View = View.Details,
                FullRowSelect = true,
                GridLines = false,
                MultiSelect = false,
                BackColor = bgMedium,
                ForeColor = textPrimary,
                Font = new Font("Segoe UI", 9),
                BorderStyle = BorderStyle.None,
                HeaderStyle = ColumnHeaderStyle.Nonclickable
            };
            
            listView.Columns.Add("Time", 120, HorizontalAlignment.Left);
            listView.Columns.Add("Chars", 60, HorizontalAlignment.Center);
            listView.Columns.Add("Confidence", 80, HorizontalAlignment.Center);
            listView.Columns.Add("Preview", 850, HorizontalAlignment.Left);
            
            // 自定义绘制表头
            listView.OwnerDraw = true;
            listView.DrawColumnHeader += (s, e) =>
            {
                e.Graphics.FillRectangle(new SolidBrush(bgLight), e.Bounds);
                e.Graphics.DrawString(e.Header.Text, new Font("Segoe UI", 9, FontStyle.Bold), 
                    new SolidBrush(textPrimary), e.Bounds, new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center });
            };
            listView.DrawItem += (s, e) =>
            {
                e.DrawDefault = true;
            };
            listView.DrawSubItem += (s, e) =>
            {
                e.DrawDefault = true;
            };
            
            listView.SelectedIndexChanged += OnSelectionChanged;
            
            splitMain.Panel1.Controls.Add(listView);
            
            // 下半部分 - 详情
            var panelDetail = new Panel
            {
                Dock = DockStyle.Fill,
                BackColor = bgMedium
            };
            
            // 缩略图卡片
            var panelThumb = new Panel
            {
                Location = new Point(0, 0),
                Size = new Size(360, 190),
                BackColor = bgLight,
                BorderStyle = BorderStyle.None
            };
            
            var lblThumbTitle = new Label
            {
                Text = "🖼 Screenshot",
                Location = new Point(10, 8),
                Size = new Size(200, 20),
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                ForeColor = textPrimary
            };
            
            picThumbnail = new PictureBox
            {
                Location = new Point(10, 35),
                Size = new Size(340, 125), // 高度减少，为状态标签留出空间
                BackColor = bgDark,
                SizeMode = PictureBoxSizeMode.Zoom,
                BorderStyle = BorderStyle.None
            };
            
            // 新增：缩略图状态标签
            lblThumbStatus = new Label
            {
                Location = new Point(10, 163),
                Size = new Size(340, 22),
                Font = new Font("Segoe UI", 8),
                ForeColor = textSecondary,
                TextAlign = ContentAlignment.MiddleCenter,
                Text = "No thumbnail selected"
            };
            
            panelThumb.Controls.Add(lblThumbTitle);
            panelThumb.Controls.Add(picThumbnail);
            panelThumb.Controls.Add(lblThumbStatus);
            
            // 详情文本卡片
            var panelText = new Panel
            {
                Location = new Point(375, 0),
                Size = new Size(760, 190),
                BackColor = bgLight,
                BorderStyle = BorderStyle.None
            };
            
            var lblTextTitle = new Label
            {
                Text = "📝 Recognized Text",
                Location = new Point(10, 8),
                Size = new Size(200, 20),
                Font = new Font("Segoe UI", 10, FontStyle.Bold),
                ForeColor = textPrimary
            };
            
            txtDetail = new TextBox
            {
                Location = new Point(10, 35),
                Size = new Size(740, 145),
                Multiline = true,
                ScrollBars = ScrollBars.Both,
                Font = new Font("Consolas", 9),
                BackColor = bgDark,
                ForeColor = textPrimary,
                BorderStyle = BorderStyle.None,
                ReadOnly = true
            };
            
            panelText.Controls.Add(lblTextTitle);
            panelText.Controls.Add(txtDetail);
            
            panelDetail.Controls.Add(panelThumb);
            panelDetail.Controls.Add(panelText);
            
            splitMain.Panel2.Controls.Add(panelDetail);
            
            // 添加所有控件
            Controls.Add(lblTitle);
            Controls.Add(panelSearch);
            Controls.Add(splitMain);
        }
        
        private Button CreateModernButton(string text, int x, int y, int width, Color? bgColor = null)
        {
            var btn = new Button
            {
                Text = text,
                Location = new Point(x, y),
                Size = new Size(width, 28),
                FlatStyle = FlatStyle.Flat,
                BackColor = bgColor ?? accentBlue,
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9),
                Cursor = Cursors.Hand
            };
            btn.FlatAppearance.BorderSize = 0;
            btn.FlatAppearance.MouseOverBackColor = bgColor != null 
                ? Color.FromArgb(bgColor.Value.R + 20, bgColor.Value.G + 20, bgColor.Value.B + 20)
                : Color.FromArgb(120, 170, 255);
            btn.FlatAppearance.MouseDownBackColor = bgColor != null
                ? Color.FromArgb(bgColor.Value.R - 20, bgColor.Value.G - 20, bgColor.Value.B - 20)
                : Color.FromArgb(80, 130, 230);
            return btn;
        }
        
        private void LoadData()
        {
            if (listView == null) return;
            
            listView.Items.Clear();
            var entries = OcrLogManager.Search(txtSearch?.Text ?? "");
            
            foreach (var entry in entries)
            {
                var preview = entry.Text.Length > 60 
                    ? entry.Text.Substring(0, 60).Replace('\n', ' ') + "..." 
                    : entry.Text.Replace('\n', ' ');
                
                var item = new ListViewItem(entry.Timestamp.ToString("MM-dd HH:mm"));
                item.SubItems.Add(entry.CharCount.ToString());
                item.SubItems.Add($"{entry.Confidence:P0}");
                item.SubItems.Add(preview);
                item.Tag = entry;
                item.BackColor = listView.Items.Count % 2 == 0 ? bgMedium : bgDark;
                item.ForeColor = textPrimary;
                listView.Items.Add(item);
            }
            
            if (lblStatus != null)
                lblStatus.Text = $"{entries.Count} items";
        }
        
        private void OnSelectionChanged(object? sender, EventArgs e)
        {
            if (listView?.SelectedItems.Count == 0)
            {
                ClearThumbnailDisplay();
                if (txtDetail != null) txtDetail.Text = "";
                return;
            }
            
            var entry = listView?.SelectedItems[0].Tag as OcrLogEntry;
            if (entry == null) return;
            
            // Show detail
            if (txtDetail != null)
            {
                txtDetail.Text = $"Time: {entry.Timestamp:yyyy-MM-dd HH:mm:ss}\r\n" +
                                $"Characters: {entry.CharCount}\r\n" +
                                $"Confidence: {entry.Confidence:P}\r\n" +
                                $"Thumbnail: {(string.IsNullOrEmpty(entry.ThumbnailPath) ? "None" : entry.ThumbnailPath)}\r\n" +
                                $"\r\n{entry.Text}";
            }
            
            // Show thumbnail - 修复版
            LoadThumbnail(entry);
        }
        
        /// <summary>
        /// 修复版缩略图加载 - 全面诊断版
        /// </summary>
        private void LoadThumbnail(OcrLogEntry entry)
        {
            if (picThumbnail == null || lblThumbStatus == null) return;
            
            // 1. 清理旧图片
            try
            {
                picThumbnail.Image?.Dispose();
                picThumbnail.Image = null;
            }
            catch (Exception ex)
            {
                Log($"Error disposing old image: {ex.Message}");
            }
            
            picThumbnail.BackColor = bgDark;
            
            // 2. 诊断：显示条目信息
            Log($"=== Thumbnail Load Diagnostic ===");
            Log($"Entry timestamp: {entry.Timestamp}");
            Log($"ThumbnailPath property: '{entry.ThumbnailPath ?? "NULL"}'");
            Log($"Path length: {entry.ThumbnailPath?.Length ?? 0}");
            
            // 3. 检查路径是否为空
            if (string.IsNullOrEmpty(entry.ThumbnailPath))
            {
                lblThumbStatus.Text = "❌ No thumbnail path recorded";
                lblThumbStatus.ForeColor = textError;
                Log("ERROR: ThumbnailPath is null or empty");
                return;
            }
            
            // 4. 诊断：检查工作目录
            var currentDir = AppDomain.CurrentDomain.BaseDirectory;
            Log($"Base directory: {currentDir}");
            
            // 5. 诊断：检查路径是绝对还是相对
            var isAbsolute = Path.IsPathRooted(entry.ThumbnailPath);
            Log($"Path is absolute: {isAbsolute}");
            
            // 6. 检查文件是否存在（多种方式）
            var exists1 = File.Exists(entry.ThumbnailPath);
            var fullPath = Path.GetFullPath(entry.ThumbnailPath);
            var exists2 = File.Exists(fullPath);
            
            Log($"Original path exists: {exists1}");
            Log($"Full path: {fullPath}");
            Log($"Full path exists: {exists2}");
            
            if (!exists1 && !exists2)
            {
                lblThumbStatus.Text = "❌ Thumbnail file not found";
                lblThumbStatus.ForeColor = textError;
                Log("ERROR: File does not exist at any resolved path");
                
                // 诊断：列出 thumbnails 目录内容
                var thumbsDir = Path.Combine(currentDir, "thumbnails");
                Log($"Checking thumbnails directory: {thumbsDir}");
                if (Directory.Exists(thumbsDir))
                {
                    var files = Directory.GetFiles(thumbsDir, "*.png");
                    Log($"Found {files.Length} PNG files in directory");
                    foreach (var f in files.Take(5))
                    {
                        Log($"  - {Path.GetFileName(f)}");
                    }
                }
                else
                {
                    Log("ERROR: thumbnails directory does not exist!");
                }
                return;
            }
            
            // 使用存在的路径
            var pathToLoad = exists1 ? entry.ThumbnailPath : fullPath;
            
            // 7. 诊断：检查文件属性
            try
            {
                var fileInfo = new FileInfo(pathToLoad);
                Log($"File size: {fileInfo.Length} bytes");
                Log($"File created: {fileInfo.CreationTime}");
                Log($"File attributes: {fileInfo.Attributes}");
                
                if (fileInfo.Length == 0)
                {
                    lblThumbStatus.Text = "❌ Thumbnail file is empty";
                    lblThumbStatus.ForeColor = textError;
                    Log("ERROR: File is 0 bytes");
                    return;
                }
            }
            catch (Exception ex)
            {
                Log($"Error getting file info: {ex.Message}");
            }
            
            // 8. 尝试加载图片 - 多种方式
            Exception? lastError = null;
            
            // 方式1: Image.FromFile
            try
            {
                Log("Attempting Image.FromFile...");
                var image = Image.FromFile(pathToLoad);
                
                if (image.Width == 0 || image.Height == 0)
                {
                    image.Dispose();
                    throw new Exception("Invalid image dimensions (0x0)");
                }
                
                picThumbnail.Image = image;
                lblThumbStatus.Text = $"✅ {image.Width}x{image.Height} | {new FileInfo(pathToLoad).Length / 1024}KB";
                lblThumbStatus.ForeColor = Color.FromArgb(100, 255, 100);
                Log($"SUCCESS: Loaded with Image.FromFile, size {image.Width}x{image.Height}");
                return;
            }
            catch (Exception ex)
            {
                lastError = ex;
                Log($"Image.FromFile failed: {ex.GetType().Name}: {ex.Message}");
            }
            
            // 方式2: 使用 FileStream + Image.FromStream
            try
            {
                Log("Attempting Image.FromStream...");
                using var stream = new FileStream(pathToLoad, FileMode.Open, FileAccess.Read, FileShare.Read);
                var image = Image.FromStream(stream, true, true);
                
                // 创建副本以避免 stream 关闭问题
                var clone = new Bitmap(image);
                image.Dispose();
                
                picThumbnail.Image = clone;
                lblThumbStatus.Text = $"✅ {clone.Width}x{clone.Height} (stream)";
                lblThumbStatus.ForeColor = Color.FromArgb(100, 255, 100);
                Log($"SUCCESS: Loaded with Image.FromStream, size {clone.Width}x{clone.Height}");
                return;
            }
            catch (Exception ex)
            {
                lastError = ex;
                Log($"Image.FromStream failed: {ex.GetType().Name}: {ex.Message}");
            }
            
            // 方式3: Bitmap 构造函数
            try
            {
                Log("Attempting new Bitmap(path)...");
                var bitmap = new Bitmap(pathToLoad);
                
                picThumbnail.Image = bitmap;
                lblThumbStatus.Text = $"✅ {bitmap.Width}x{bitmap.Height} (bitmap)";
                lblThumbStatus.ForeColor = Color.FromArgb(100, 255, 100);
                Log($"SUCCESS: Loaded with Bitmap constructor, size {bitmap.Width}x{bitmap.Height}");
                return;
            }
            catch (Exception ex)
            {
                lastError = ex;
                Log($"Bitmap constructor failed: {ex.GetType().Name}: {ex.Message}");
            }
            
            // 全部失败
            lblThumbStatus.Text = $"❌ Load failed: {lastError?.Message ?? "Unknown"}";
            lblThumbStatus.ForeColor = textError;
            Log("=== All loading methods failed ===");
        }
        
        private void ClearThumbnailDisplay()
        {
            if (picThumbnail == null || lblThumbStatus == null) return;
            
            try
            {
                picThumbnail.Image?.Dispose();
                picThumbnail.Image = null;
            }
            catch { }
            
            picThumbnail.BackColor = bgDark;
            lblThumbStatus.Text = "No thumbnail selected";
            lblThumbStatus.ForeColor = textSecondary;
        }
        
        private void OnClear(object? sender, EventArgs e)
        {
            var result = MessageBox.Show(
                "Clear all OCR history and thumbnails?",
                "Confirm",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Warning);
            
            if (result == DialogResult.Yes)
            {
                OcrLogManager.Clear();
                ClearThumbnailDisplay();
                LoadData();
            }
        }
        
        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            ClearThumbnailDisplay();
            base.OnFormClosing(e);
        }
        
        private void Log(string message)
        {
            try
            {
                var logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "viewer.log");
                File.AppendAllText(logPath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}");
            }
            catch { }
        }
    }
}
