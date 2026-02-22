using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.Data.Sqlite;

namespace WinCaptureMVP.Storage
{
    public sealed class WorkLogStorage : IDisposable
    {
        private readonly string _dbPath;
        private SqliteConnection? _connection;
        private readonly object _dbLock = new object();
        private bool _disposed;

        public WorkLogStorage(Config.UserConfig config)
        {
            if (config == null) throw new ArgumentNullException(nameof(config));
            
            string dataDir = null;
            Exception lastError = null;
            
            // 尝试 1: 配置的数据目录
            try
            {
                dataDir = config.GetSafeDataDirectory();
                if (!string.IsNullOrWhiteSpace(dataDir) && CanWriteToDirectory(dataDir))
                {
                    goto FoundDataDir;
                }
            }
            catch (Exception ex)
            {
                lastError = ex;
                System.Diagnostics.Debug.WriteLine($"WorkLogStorage: GetSafeDataDirectory failed: {ex.Message}");
            }
            
            // 尝试 2: 程序目录
            try
            {
                dataDir = Path.Combine(AppContext.BaseDirectory ?? ".", "WinCaptureMVP_Data");
                if (CanWriteToDirectory(dataDir))
                {
                    goto FoundDataDir;
                }
            }
            catch (Exception ex)
            {
                lastError = ex;
                System.Diagnostics.Debug.WriteLine($"WorkLogStorage: App directory failed: {ex.Message}");
            }
            
            // 尝试 3: 临时目录
            try
            {
                dataDir = Path.Combine(Path.GetTempPath(), "WinCaptureMVP_Data");
                if (CanWriteToDirectory(dataDir))
                {
                    goto FoundDataDir;
                }
            }
            catch (Exception ex)
            {
                lastError = ex;
                System.Diagnostics.Debug.WriteLine($"WorkLogStorage: Temp directory failed: {ex.Message}");
            }
            
            // 都失败了，使用内存数据库
            System.Diagnostics.Debug.WriteLine($"WorkLogStorage: All directory attempts failed, using in-memory database. Last error: {lastError?.Message}");
            _dbPath = ":memory:";
            InitializeDatabase();
            return;
            
        FoundDataDir:
            _dbPath = Path.Combine(dataDir, "worklog.db");
            
            if (string.IsNullOrWhiteSpace(_dbPath))
            {
                _dbPath = ":memory:";
            }
            
            // 初始化数据库，失败时使用内存数据库
            try
            {
                InitializeDatabase();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"WorkLogStorage: Database initialization failed, falling back to in-memory. Error: {ex.Message}");
                _connection?.Dispose();
                _connection = null;
                _dbPath = ":memory:";
                InitializeDatabase();
            }
        }
        
        /// <summary>
        /// 检查目录是否可写
        /// </summary>
        private static bool CanWriteToDirectory(string path)
        {
            try
            {
                if (!Directory.Exists(path))
                {
                    Directory.CreateDirectory(path);
                }
                var testFile = Path.Combine(path, $".write_test_{Guid.NewGuid()}.tmp");
                File.WriteAllText(testFile, "test");
                File.Delete(testFile);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private void InitializeDatabase()
        {
            if (string.IsNullOrWhiteSpace(_dbPath))
            {
                throw new InvalidOperationException("数据库路径为空，无法初始化数据库");
            }

            var dir = Path.GetDirectoryName(_dbPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            var connectionString = $"Data Source={_dbPath};Pooling=false;";
            
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                throw new InvalidOperationException("数据库连接字符串为空");
            }

            _connection = new SqliteConnection(connectionString);
            _connection.Open();

            using var cmd = _connection.CreateCommand();
            cmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS work_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    app_name TEXT NOT NULL,
                    window_title TEXT NOT NULL,
                    ocr_text TEXT,
                    thumbnail_base64 TEXT,
                    trigger_type TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_timestamp ON work_records(timestamp);
                CREATE INDEX IF NOT EXISTS idx_app ON work_records(app_name);";
            cmd.ExecuteNonQuery();
        }

        public void Save(WorkRecord record)
        {
            if (_disposed) throw new ObjectDisposedException(nameof(WorkLogStorage));
            if (_connection == null) return;
            if (record == null) throw new ArgumentNullException(nameof(record));

            lock (_dbLock)
            {
                using var cmd = _connection.CreateCommand();
                cmd.CommandText = @"
                    INSERT INTO work_records (timestamp, app_name, window_title, ocr_text, thumbnail_base64, trigger_type)
                    VALUES (@ts, @app, @title, @ocr, @thumb, @trigger)";
                cmd.Parameters.AddWithValue("@ts", record.Timestamp.ToString("O"));
                cmd.Parameters.AddWithValue("@app", record.AppName ?? string.Empty);
                cmd.Parameters.AddWithValue("@title", record.WindowTitle ?? string.Empty);
                cmd.Parameters.AddWithValue("@ocr", record.OcrText ?? string.Empty);
                cmd.Parameters.AddWithValue("@thumb", record.ThumbnailBase64 ?? string.Empty);
                cmd.Parameters.AddWithValue("@trigger", record.TriggerType ?? string.Empty);
                cmd.ExecuteNonQuery();
            }
        }

        public List<WorkRecord> GetRecords(DateTime from, DateTime to)
        {
            if (_disposed) throw new ObjectDisposedException(nameof(WorkLogStorage));
            var records = new List<WorkRecord>();
            if (_connection == null) return records;

            lock (_dbLock)
            {
                using var cmd = _connection.CreateCommand();
                cmd.CommandText = @"
                    SELECT id, timestamp, app_name, window_title, ocr_text, thumbnail_base64, trigger_type
                    FROM work_records
                    WHERE timestamp >= @from AND timestamp < @to
                    ORDER BY timestamp";
                cmd.Parameters.AddWithValue("@from", from.ToString("O"));
                cmd.Parameters.AddWithValue("@to", to.ToString("O"));

                using var reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    DateTime timestamp;
                    try
                    {
                        timestamp = DateTime.Parse(reader.GetString(1));
                    }
                    catch
                    {
                        timestamp = DateTime.MinValue;
                    }
                    
                    records.Add(new WorkRecord
                    {
                        Id = reader.GetInt64(0),
                        Timestamp = timestamp,
                        AppName = reader.IsDBNull(2) ? string.Empty : reader.GetString(2),
                        WindowTitle = reader.IsDBNull(3) ? string.Empty : reader.GetString(3),
                        OcrText = reader.IsDBNull(4) ? string.Empty : reader.GetString(4),
                        ThumbnailBase64 = reader.IsDBNull(5) ? string.Empty : reader.GetString(5),
                        TriggerType = reader.IsDBNull(6) ? string.Empty : reader.GetString(6)
                    });
                }
            }
            return records;
        }

        public DailyReport GenerateDailyReport(DateTime date)
        {
            var from = date.Date;
            var to = from.AddDays(1);
            var records = GetRecords(from, to);

            var report = new DailyReport
            {
                Date = date,
                TotalRecords = records.Count
            };

            if (records.Count == 0)
            {
                report.Summary = "今天没有记录到工作活动。";
                return report;
            }

            var appGroups = records
                .GroupBy(r => r.AppName ?? "Unknown")
                .Select(g => new AppUsage
                {
                    AppName = g.Key,
                    RecordCount = g.Count(),
                    Duration = TimeSpan.FromMinutes(g.Count() * 0.5)
                })
                .OrderByDescending(a => a.Duration)
                .ToList();

            report.AppUsages = appGroups;
            report.TotalWorkTime = TimeSpan.FromMinutes(records.Count * 0.5);

            var summary = $"今天共记录 {records.Count} 次活动，estimated 工作时长 {report.TotalWorkTime.TotalHours:F1} 小时。\n\n主要使用应用：\n";
            summary += string.Join("\n", appGroups.Take(5).Select(a => $"- {a.AppName}: {a.Duration.TotalMinutes:F0} 分钟"));

            if (appGroups.Any(a => (a.AppName ?? string.Empty).ToLowerInvariant().Contains("wechat") || 
                                   (a.AppName ?? string.Empty).ToLowerInvariant().Contains("微信")))
            {
                summary += "\n\n💡 建议：微信使用时间较长，可以尝试集中处理消息，减少切换。";
            }

            report.Summary = summary;
            return report;
        }

        public void Dispose()
        {
            if (_disposed) return;
            
            lock (_dbLock)
            {
                if (_disposed) return; // 双重检查
                _disposed = true;
                _connection?.Close();
                _connection?.Dispose();
                _connection = null;
            }
        }
    }
}
