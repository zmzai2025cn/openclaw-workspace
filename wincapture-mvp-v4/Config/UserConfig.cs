using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace WinCaptureMVP.Config
{
    /// <summary>
    /// 用户配置
    /// </summary>
    public sealed class UserConfig
    {
        /// <summary>用户ID</summary>
        public string UserId { get; set; } = string.Empty;
        
        /// <summary>设备ID</summary>
        public string DeviceId { get; set; } = string.Empty;
        
        /// <summary>数据目录</summary>
        public string DataDirectory { get; set; } = string.Empty;
        
        /// <summary>应用白名单</summary>
        public List<string> WhiteList { get; set; } = new List<string>();

        /// <summary>
        /// 获取安全的数据目录（永不返回null）
        /// </summary>
        public string GetSafeDataDirectory()
        {
            // 优先使用已设置的值
            if (!string.IsNullOrWhiteSpace(DataDirectory))
            {
                return DataDirectory;
            }
            
            // 使用系统默认路径
            return GetDefaultDataDirectory();
        }

        /// <summary>
        /// 获取默认数据目录
        /// </summary>
        private static string GetDefaultDataDirectory()
        {
            try
            {
                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                if (!string.IsNullOrWhiteSpace(localAppData))
                {
                    return Path.Combine(localAppData, "WinCaptureMVP");
                }
            }
            catch
            {
                // 忽略异常，使用备选方案
            }
            
            try
            {
                // 备选：使用用户目录
                var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                if (!string.IsNullOrWhiteSpace(userProfile))
                {
                    return Path.Combine(userProfile, "WinCaptureMVP");
                }
            }
            catch
            {
                // 忽略异常
            }
            
            try
            {
                // 最终备选：使用当前目录
                var currentDir = Environment.CurrentDirectory;
                if (!string.IsNullOrWhiteSpace(currentDir))
                {
                    return Path.Combine(currentDir, "WinCaptureMVP_Data");
                }
            }
            catch
            {
                // 忽略异常
            }
            
            // 绝对最后的备选
            return @"C:\WinCaptureMVP_Data";
        }

        /// <summary>
        /// 获取配置文件路径
        /// </summary>
        private static string GetConfigPath()
        {
            var dataDir = GetDefaultDataDirectory();
            return Path.Combine(dataDir, "config.json");
        }

        /// <summary>
        /// 加载配置
        /// </summary>
        public static UserConfig Load()
        {
            string configPath;
            try
            {
                configPath = GetConfigPath();
            }
            catch
            {
                // 如果连路径都获取失败，返回默认配置
                return CreateDefaultConfig();
            }
            
            try
            {
                if (File.Exists(configPath))
                {
                    var json = File.ReadAllText(configPath);
                    var config = JsonSerializer.Deserialize<UserConfig>(json);
                    
                    if (config != null)
                    {
                        // 修复可能为null的字段
                        if (config.UserId == null) config.UserId = string.Empty;
                        if (config.DeviceId == null) config.DeviceId = Guid.NewGuid().ToString("N");
                        if (config.DataDirectory == null) config.DataDirectory = string.Empty;
                        if (config.WhiteList == null) config.WhiteList = new List<string>();
                        
                        return config;
                    }
                }
            }
            catch (Exception ex)
            {
                ErrorReporter.Report(ex, "UserConfig.Load");
            }
            
            // 返回默认配置
            return CreateDefaultConfig();
        }

        /// <summary>
        /// 创建默认配置
        /// </summary>
        private static UserConfig CreateDefaultConfig()
        {
            return new UserConfig
            {
                UserId = string.Empty,
                DeviceId = Guid.NewGuid().ToString("N"),
                DataDirectory = GetDefaultDataDirectory(),
                WhiteList = new List<string>()
            };
        }

        /// <summary>
        /// 保存配置
        /// </summary>
        public void Save()
        {
            // 确保所有字段有效
            if (UserId == null) UserId = string.Empty;
            if (DeviceId == null) DeviceId = Guid.NewGuid().ToString("N");
            if (DataDirectory == null) DataDirectory = GetDefaultDataDirectory();
            if (WhiteList == null) WhiteList = new List<string>();

            string configPath;
            try
            {
                configPath = GetConfigPath();
            }
            catch
            {
                return; // 无法获取路径，放弃保存
            }
            
            try
            {
                // 确保目录存在
                var dir = Path.GetDirectoryName(configPath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }
                
                // 序列化并保存
                var options = new JsonSerializerOptions 
                { 
                    WriteIndented = true,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                };
                var json = JsonSerializer.Serialize(this, options);
                File.WriteAllText(configPath, json);
            }
            catch (Exception ex)
            {
                ErrorReporter.Report(ex, "UserConfig.Save");
            }
        }
    }
}
