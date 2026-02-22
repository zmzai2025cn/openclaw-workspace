using System;
using System.Collections.Generic;

namespace WinCaptureMVP
{
    public sealed class WorkRecord
    {
        public long Id { get; set; }
        public DateTime Timestamp { get; set; }
        public string AppName { get; set; } = string.Empty;
        public string WindowTitle { get; set; } = string.Empty;
        public string OcrText { get; set; } = string.Empty;
        public string ThumbnailBase64 { get; set; } = string.Empty;
        public string TriggerType { get; set; } = string.Empty;
    }

    public sealed class DailyReport
    {
        public DateTime Date { get; set; }
        public int TotalRecords { get; set; }
        public TimeSpan TotalWorkTime { get; set; }
        public List<AppUsage> AppUsages { get; set; } = new List<AppUsage>();
        public string Summary { get; set; } = string.Empty;
    }

    public sealed class AppUsage
    {
        public string AppName { get; set; } = string.Empty;
        public TimeSpan Duration { get; set; }
        public int RecordCount { get; set; }
    }
}
