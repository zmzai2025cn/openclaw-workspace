using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace WinCaptureOCR
{
    /// <summary>
    /// OCR 日志管理器 - v1.6.1 修复版
    /// 修复：CSV 解析、路径处理、同步写入
    /// </summary>
    public static class OcrLogManager
    {
        private static readonly List<OcrLogEntry> Entries = new List<OcrLogEntry>();
        private static readonly object Lock = new object();
        private static readonly string LogFilePath;
        
        static OcrLogManager()
        {
            LogFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ocr_history.csv");
            LoadFromFile();
        }
        
        /// <summary>
        /// 添加日志条目 - 修复：同步写入确保数据持久化
        /// </summary>
        public static void AddEntry(string text, double confidence, string thumbnailPath)
        {
            if (string.IsNullOrWhiteSpace(text)) return;
            
            var entry = new OcrLogEntry
            {
                Timestamp = DateTime.Now,
                Text = text.Trim(),
                Confidence = confidence,
                ThumbnailPath = thumbnailPath ?? "", // 确保不为 null
                CharCount = text.Length
            };
            
            lock (Lock)
            {
                Entries.Insert(0, entry);
                
                // 清理旧记录
                if (Entries.Count > 1000)
                {
                    CleanupOldEntries();
                }
                
                // 修复：同步写入，确保立即持久化
                SaveToFileSync(entry);
            }
            
            Log($"Entry added: {entry.Timestamp:HH:mm:ss}, chars={entry.CharCount}, thumb={(string.IsNullOrEmpty(thumbnailPath) ? "none" : "yes")}");
        }
        
        /// <summary>
        /// 清理旧记录和缩略图
        /// </summary>
        private static void CleanupOldEntries()
        {
            for (int i = 1000; i < Entries.Count; i++)
            {
                try
                {
                    var thumbPath = Entries[i].ThumbnailPath;
                    if (!string.IsNullOrEmpty(thumbPath) && File.Exists(thumbPath))
                    {
                        File.Delete(thumbPath);
                        Log($"Deleted old thumbnail: {thumbPath}");
                    }
                }
                catch (Exception ex)
                {
                    Log($"Error deleting old thumbnail: {ex.Message}");
                }
            }
            Entries.RemoveRange(1000, Entries.Count - 1000);
        }
        
        public static List<OcrLogEntry> GetAllEntries()
        {
            lock (Lock)
            {
                return Entries.ToList();
            }
        }
        
        public static void Clear()
        {
            lock (Lock)
            {
                // 删除所有缩略图
                int deletedCount = 0;
                foreach (var entry in Entries)
                {
                    try
                    {
                        if (!string.IsNullOrEmpty(entry.ThumbnailPath) && File.Exists(entry.ThumbnailPath))
                        {
                            File.Delete(entry.ThumbnailPath);
                            deletedCount++;
                        }
                    }
                    catch { }
                }
                
                Entries.Clear();
                Log($"Cleared all entries, deleted {deletedCount} thumbnails");
            }
            
            try 
            { 
                if (File.Exists(LogFilePath))
                {
                    File.Delete(LogFilePath);
                    Log("Deleted history file");
                }
            }
            catch (Exception ex) 
            { 
                Log($"Error deleting history file: {ex.Message}");
            }
        }
        
        public static List<OcrLogEntry> Search(string keyword)
        {
            if (string.IsNullOrWhiteSpace(keyword))
                return GetAllEntries();
            
            lock (Lock)
            {
                return Entries.Where(e => 
                    e.Text.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }
        }
        
        /// <summary>
        /// 同步写入文件 - 修复：确保数据立即持久化
        /// </summary>
        private static void SaveToFileSync(OcrLogEntry entry)
        {
            try
            {
                // 转义文本中的特殊字符
                var escapedText = EscapeCsvField(entry.Text);
                var escapedPath = EscapeCsvField(entry.ThumbnailPath);
                
                var line = $"{entry.Timestamp:yyyy-MM-dd HH:mm:ss},{entry.Confidence:F2},{entry.CharCount},{escapedText},{escapedPath}";
                
                File.AppendAllText(LogFilePath, line + Environment.NewLine);
            }
            catch (Exception ex)
            {
                Log($"Error saving to file: {ex.Message}");
            }
        }
        
        /// <summary>
        /// 转义 CSV 字段 - 处理引号、逗号、换行
        /// </summary>
        private static string EscapeCsvField(string field)
        {
            if (string.IsNullOrEmpty(field))
                return "\"\"";
            
            // 如果包含特殊字符，用引号包裹并转义内部引号
            if (field.Contains('"') || field.Contains(',') || field.Contains('\n') || field.Contains('\r'))
            {
                return "\"" + field.Replace("\"", "\"\"") + "\"";
            }
            
            return field;
        }
        
        /// <summary>
        /// 从文件加载 - 修复：改进 CSV 解析，处理各种边界情况
        /// </summary>
        private static void LoadFromFile()
        {
            try
            {
                if (!File.Exists(LogFilePath))
                {
                    Log("History file not found, starting fresh");
                    return;
                }
                
                var lines = File.ReadAllLines(LogFilePath);
                int successCount = 0;
                int failCount = 0;
                
                foreach (var line in lines)
                {
                    if (string.IsNullOrWhiteSpace(line))
                        continue;
                    
                    try
                    {
                        var parts = ParseCsvLineRobust(line);
                        if (parts.Length >= 4)
                        {
                            var entry = new OcrLogEntry
                            {
                                Timestamp = DateTime.Parse(parts[0]),
                                Confidence = double.Parse(parts[1]),
                                CharCount = int.Parse(parts[2]),
                                Text = parts[3] ?? "",
                                ThumbnailPath = parts.Length > 4 ? (parts[4] ?? "") : ""
                            };
                            Entries.Add(entry);
                            successCount++;
                        }
                        else
                        {
                            failCount++;
                            Log($"Skipped malformed line (only {parts.Length} parts): {line.Substring(0, Math.Min(50, line.Length))}...");
                        }
                    }
                    catch (Exception ex)
                    {
                        failCount++;
                        Log($"Error parsing line: {ex.Message}");
                    }
                }
                
                Log($"Loaded {successCount} entries from file, {failCount} failed");
            }
            catch (Exception ex)
            {
                Log($"Error loading from file: {ex.Message}");
            }
        }
        
        /// <summary>
        /// 健壮的 CSV 行解析 - 修复：正确处理引号、空字段、路径中的逗号
        /// </summary>
        private static string[] ParseCsvLineRobust(string line)
        {
            var result = new List<string>();
            var current = new System.Text.StringBuilder();
            bool inQuotes = false;
            
            for (int i = 0; i < line.Length; i++)
            {
                char c = line[i];
                
                if (c == '"')
                {
                    if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                    {
                        // 转义的引号
                        current.Append('"');
                        i++; // 跳过下一个引号
                    }
                    else
                    {
                        // 切换引号状态
                        inQuotes = !inQuotes;
                    }
                }
                else if (c == ',' && !inQuotes)
                {
                    // 字段分隔符
                    result.Add(current.ToString());
                    current.Clear();
                }
                else
                {
                    current.Append(c);
                }
            }
            
            // 添加最后一个字段
            result.Add(current.ToString());
            
            return result.ToArray();
        }
        
        /// <summary>
        /// 调试日志
        /// </summary>
        private static void Log(string message)
        {
            try
            {
                var logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ocr_manager.log");
                File.AppendAllText(logPath, $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}");
            }
            catch { }
        }
    }
    
    public class OcrLogEntry
    {
        public DateTime Timestamp { get; set; }
        public string Text { get; set; } = "";
        public double Confidence { get; set; }
        public string ThumbnailPath { get; set; } = "";
        public int CharCount { get; set; }
    }
}
