using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace WinCaptureMVP.Utils
{
    public static class ScreenCapture
    {
        [DllImport("gdi32.dll")]
        private static extern int GetDeviceCaps(IntPtr hdc, int nIndex);

        private const int DesktopHorzRes = 118;
        private const int HorzRes = 8;

        public static Bitmap? CaptureScreen()
        {
            var screen = Screen.PrimaryScreen;
            if (screen == null) return null;

            try
            {
                var scale = GetScreenScale();
                var width = (int)(screen.Bounds.Width * scale);
                var height = (int)(screen.Bounds.Height * scale);

                var bitmap = new Bitmap(width, height, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
                using (var graphics = Graphics.FromImage(bitmap))
                {
                    graphics.CopyFromScreen(0, 0, 0, 0, new Size(width, height), CopyPixelOperation.SourceCopy);
                }

                return bitmap;
            }
            catch (Exception ex)
            {
                ErrorReporter.Report(ex, "ScreenCapture.CaptureScreen");
                return null;
            }
        }

        private static float GetScreenScale()
        {
            try
            {
                using var g = Graphics.FromHwnd(IntPtr.Zero);
                var hdc = g.GetHdc();
                var actualWidth = GetDeviceCaps(hdc, DesktopHorzRes);
                var logicalWidth = GetDeviceCaps(hdc, HorzRes);
                g.ReleaseHdc(hdc);
                return logicalWidth > 0 ? (float)actualWidth / logicalWidth : 1.0f;
            }
            catch
            {
                return 1.0f;
            }
        }
    }
}
