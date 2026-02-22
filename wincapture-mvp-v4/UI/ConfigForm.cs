using System;
using System.Windows.Forms;

namespace WinCaptureMVP.UI
{
    public sealed class ConfigForm : Form
    {
        private readonly Config.UserConfig _config;
        private TextBox? _userIdTextBox;
        private TextBox? _whiteListTextBox;

        public ConfigForm(Config.UserConfig config)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            Text = "首次配置";
            Size = new System.Drawing.Size(450, 320);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;

            var y = 20;

            var userIdLabel = new Label 
            { 
                Text = "用户ID:", 
                Location = new System.Drawing.Point(20, y), 
                Width = 100 
            };
            _userIdTextBox = new TextBox 
            { 
                Text = _config.UserId, 
                Location = new System.Drawing.Point(130, y), 
                Width = 250 
            };
            Controls.Add(userIdLabel);
            Controls.Add(_userIdTextBox);

            y += 50;

            var whiteListLabel = new Label 
            { 
                Text = "应用白名单（逗号分隔，*表示所有）:", 
                Location = new System.Drawing.Point(20, y), 
                Width = 350 
            };
            y += 30;
            
            _whiteListTextBox = new TextBox 
            { 
                Text = string.Join(",", _config.WhiteList),
                Location = new System.Drawing.Point(20, y), 
                Width = 360,
                Height = 80,
                Multiline = true,
                ScrollBars = ScrollBars.Vertical
            };
            Controls.Add(whiteListLabel);
            Controls.Add(_whiteListTextBox);

            y += 100;

            var infoLabel = new Label 
            { 
                Text = "默认采集: chrome, edge, code, outlook, wechat, dingtalk, word, excel\n调试用: 填写 * 采集所有应用",
                Location = new System.Drawing.Point(20, y), 
                Width = 400,
                Height = 40
            };
            Controls.Add(infoLabel);

            y += 50;

            var saveButton = new Button 
            { 
                Text = "保存并开始", 
                Location = new System.Drawing.Point(130, y), 
                Width = 100,
                DialogResult = DialogResult.OK
            };
            saveButton.Click += OnSave;
            Controls.Add(saveButton);

            AcceptButton = saveButton;
        }

        private void OnSave(object? sender, EventArgs e)
        {
            var userId = _userIdTextBox?.Text?.Trim() ?? string.Empty;
            
            if (string.IsNullOrEmpty(userId))
            {
                MessageBox.Show("请输入用户ID", "验证失败", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                DialogResult = DialogResult.None;
                return;
            }
            
            _config.UserId = userId;
            
            // 确保 DataDirectory 有值
            if (string.IsNullOrWhiteSpace(_config.DataDirectory))
            {
                try
                {
                    _config.DataDirectory = _config.GetSafeDataDirectory();
                }
                catch
                {
                    _config.DataDirectory = @"C:\WinCaptureMVP_Data";
                }
            }
            
            // 确保 DeviceId 有值
            if (string.IsNullOrWhiteSpace(_config.DeviceId))
            {
                _config.DeviceId = Guid.NewGuid().ToString("N");
            }
            
            // 确保 WhiteList 不为 null
            if (_config.WhiteList == null)
            {
                _config.WhiteList = new System.Collections.Generic.List<string>();
            }
            
            var whiteListText = _whiteListTextBox?.Text?.Trim() ?? string.Empty;
            if (!string.IsNullOrEmpty(whiteListText))
            {
                _config.WhiteList = new System.Collections.Generic.List<string>(
                    whiteListText.Split(',', System.StringSplitOptions.RemoveEmptyEntries | System.StringSplitOptions.TrimEntries)
                );
            }
            
            _config.Save();
        }
    }
}
