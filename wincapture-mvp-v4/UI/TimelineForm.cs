using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace WinCaptureMVP.UI
{
    public sealed class TimelineForm : Form
    {
        private readonly List<WorkRecord> _records;
        private ListView _listView = null!;
        private Label _statsLabel = null!;
        private PictureBox _previewBox = null!;
        private SplitContainer _splitContainer = null!;
        private Label _detailLabel = null!;

        public TimelineForm(List<WorkRecord> records)
        {
            _records = records ?? throw new ArgumentNullException(nameof(records));
            InitializeComponent();
            LoadData();
        }

        private void InitializeComponent()
        {
            Text = "今日工作记录";
            Size = new Size(1400, 800);
            StartPosition = FormStartPosition.CenterScreen;

            _splitContainer = new SplitContainer
            {
                Dock = DockStyle.Fill,
                Orientation = Orientation.Vertical,
                SplitterDistance = 800
            };

            _statsLabel = new Label
            {
                Dock = DockStyle.Top,
                Height = 30,
                TextAlign = ContentAlignment.MiddleLeft,
                Padding = new Padding(10, 0, 0, 0),
                Font = new Font("Microsoft YaHei", 9F)
            };
            Controls.Add(_statsLabel);

            _listView = new ListView
            {
                Dock = DockStyle.Fill,
                View = View.Details,
                FullRowSelect = true,
                GridLines = true,
                MultiSelect = false
            };
            
            _listView.Columns.Add("时间", 80);
            _listView.Columns.Add("应用", 120);
            _listView.Columns.Add("窗口标题", 300);
            _listView.Columns.Add("OCR文字预览", 280);
            _listView.SelectedIndexChanged += OnSelectionChanged;

            _splitContainer.Panel1.Controls.Add(_listView);

            var rightPanel = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(10),
                BackColor = Color.FromArgb(240, 240, 240)
            };

            var previewTitle = new Label
            {
                Text = "截图预览",
                Dock = DockStyle.Top,
                Height = 30,
                Font = new Font("Microsoft YaHei", 11, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleCenter
            };
            rightPanel.Controls.Add(previewTitle);

            _previewBox = new PictureBox
            {
                Dock = DockStyle.Top,
                Height = 250,
                SizeMode = PictureBoxSizeMode.Zoom,
                BackColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle
            };
            rightPanel.Controls.Add(_previewBox);

            // 详细信息面板
            var detailPanel = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(5)
            };

            var detailTitle = new Label
            {
                Text = "详细信息",
                Dock = DockStyle.Top,
                Height = 25,
                Font = new Font("Microsoft YaHei", 10, FontStyle.Bold),
                TextAlign = ContentAlignment.MiddleLeft
            };
            detailPanel.Controls.Add(detailTitle);

            _detailLabel = new Label
            {
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.TopLeft,
                Font = new Font("Consolas", 9F),
                BackColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Padding = new Padding(8),
                AutoSize = false
            };
            detailPanel.Controls.Add(_detailLabel);

            rightPanel.Controls.Add(detailPanel);
            _splitContainer.Panel2.Controls.Add(rightPanel);

            Controls.Add(_splitContainer);
            
            FormClosing += (s, e) => 
            {
                _previewBox.Image?.Dispose();
            };
        }

        private void OnSelectionChanged(object? sender, EventArgs e)
        {
            System.Diagnostics.Debug.WriteLine($"OnSelectionChanged: SelectedItems.Count={_listView.SelectedItems.Count}");
            
            if (_listView.SelectedItems.Count == 0)
            {
                _previewBox.Image?.Dispose();
                _previewBox.Image = null;
                _detailLabel.Text = string.Empty;
                return;
            }

            var index = _listView.SelectedItems[0].Index;
            System.Diagnostics.Debug.WriteLine($"OnSelectionChanged: index={index}, _records.Count={_records.Count}");
            
            if (index < 0 || index >= _records.Count) return;

            var record = _records[_records.Count - 1 - index];
            System.Diagnostics.Debug.WriteLine($"OnSelectionChanged: record.Id={record.Id}, OcrTextLength={record.OcrText?.Length ?? 0}");
            
            ShowThumbnail(record);
            ShowDetails(record);
        }

        private void ShowThumbnail(WorkRecord record)
        {
            _previewBox.Image?.Dispose();
            _previewBox.Image = null;
            
            if (string.IsNullOrEmpty(record.ThumbnailBase64)) return;
            
            // 验证 Base64 字符串有效性
            if (record.ThumbnailBase64.Length % 4 != 0)
            {
                System.Diagnostics.Debug.WriteLine("Thumbnail Base64 length invalid");
                return;
            }

            try
            {
                var bytes = Convert.FromBase64String(record.ThumbnailBase64);
                using var ms = new MemoryStream(bytes);
                using var img = Image.FromStream(ms);
                _previewBox.Image = new Bitmap(img);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Thumbnail load failed: {ex.Message}");
            }
        }

        private void ShowDetails(WorkRecord record)
        {
            // 调试信息直接显示在文本中
            var debugInfo = $"[调试] OcrText长度: {record.OcrText?.Length ?? 0}, 是否为空: {string.IsNullOrEmpty(record.OcrText)}\r\n\r\n";
            
            var sb = new System.Text.StringBuilder();
            sb.Append(debugInfo);
            sb.AppendLine($"ID: {record.Id}");
            sb.AppendLine($"时间: {record.Timestamp:yyyy-MM-dd HH:mm:ss}");
            sb.AppendLine($"应用: {record.AppName ?? "(无)"}");
            sb.AppendLine($"窗口: {record.WindowTitle ?? "(无)"}");
            sb.AppendLine($"触发类型: {record.TriggerType ?? "(无)"}");
            sb.AppendLine($"缩略图大小: {(string.IsNullOrEmpty(record.ThumbnailBase64) ? "无" : $"{record.ThumbnailBase64.Length} chars")}");
            sb.AppendLine();
            sb.AppendLine("OCR 识别结果:");
            sb.AppendLine(string.IsNullOrEmpty(record.OcrText) ? "(无)" : record.OcrText);
            
            _detailLabel.Text = sb.ToString();
        }

        private void LoadData()
        {
            _listView.Items.Clear();
            
            var sortedRecords = _records.OrderByDescending(r => r.Timestamp).ToList();
            
            foreach (var record in sortedRecords)
            {
                var item = new ListViewItem(record.Timestamp.ToString("HH:mm:ss"));
                item.SubItems.Add(record.AppName ?? "(无)");
                item.SubItems.Add(record.WindowTitle ?? "(无)");
                
                var ocrPreview = !string.IsNullOrEmpty(record.OcrText) && record.OcrText.Length > 50 
                    ? record.OcrText.Substring(0, 50) + "..." 
                    : record.OcrText ?? "(无)";
                item.SubItems.Add(ocrPreview);
                
                if (!string.IsNullOrEmpty(record.ThumbnailBase64))
                {
                    item.SubItems[0].Text = "📷 " + item.SubItems[0].Text;
                }
                
                _listView.Items.Add(item);
            }

            var appCount = _records.Select(r => r.AppName ?? "Unknown").Distinct().Count();
            var recordsWithThumbnail = _records.Count(r => !string.IsNullOrEmpty(r.ThumbnailBase64));
            _statsLabel.Text = $"共 {_records.Count} 条记录 | {appCount} 个应用 | {recordsWithThumbnail} 条有截图";
        }
    }
}
