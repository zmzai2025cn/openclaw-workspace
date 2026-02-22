using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace WinCaptureMVP.Sanitizer
{
    public static class AppFilter
    {
        private static readonly HashSet<string> DefaultWhiteList = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "chrome", "msedge", "firefox", "opera", "brave",
            "code", "devenv", "rider", "vscode",
            "outlook", "foxmail", "thunderbird",
            "wechat", "dingtalk", "feishu", "qq", "teams", "slack", "discord",
            "notepad", "notepad++", "sublime_text", "atom",
            "word", "excel", "powerpoint", "outlook",
            "cmd", "powershell", "wt", "terminal",
            "explorer", "explorer.exe"
        };

        public static bool IsAllowed(string? appName, List<string>? customWhiteList)
        {
            if (string.IsNullOrWhiteSpace(appName))
                return false;

            if (customWhiteList != null && customWhiteList.Contains("*"))
                return true;

            var whiteList = (customWhiteList != null && customWhiteList.Count > 0) 
                ? customWhiteList 
                : DefaultWhiteList.ToList();

            return whiteList.Any(w => 
                !string.IsNullOrWhiteSpace(w) &&
                (appName.Contains(w, StringComparison.OrdinalIgnoreCase) ||
                 appName.Equals(w, StringComparison.OrdinalIgnoreCase)));
        }
    }
}
