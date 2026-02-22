using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

namespace WinCaptureMVP.Utils
{
    public static class ImageHelper
    {
        public static Bitmap? CreateThumbnail(Bitmap? source, int maxWidth, int maxHeight)
        {
            if (source == null || source.Width == 0 || source.Height == 0)
                return null;

            Bitmap? thumbnail = null;
            try
            {
                var ratio = Math.Min((double)maxWidth / source.Width, (double)maxHeight / source.Height);
                var newWidth = Math.Max(1, (int)(source.Width * ratio));
                var newHeight = Math.Max(1, (int)(source.Height * ratio));

                thumbnail = new Bitmap(newWidth, newHeight, PixelFormat.Format32bppArgb);
                using (var graphics = Graphics.FromImage(thumbnail))
                {
                    graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    graphics.SmoothingMode = SmoothingMode.HighQuality;
                    graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    graphics.DrawImage(source, 0, 0, newWidth, newHeight);
                }

                var result = thumbnail;
                thumbnail = null; // 转移所有权
                return result;
            }
            catch (Exception ex)
            {
                ErrorReporter.Report(ex, "ImageHelper.CreateThumbnail");
                thumbnail?.Dispose();
                return null;
            }
        }

        public static string ToBase64(Bitmap? bitmap)
        {
            if (bitmap == null) return string.Empty;

            try
            {
                using var ms = new MemoryStream();
                using var encoderParams = new EncoderParameters(1);
                encoderParams.Param[0] = new EncoderParameter(Encoder.Quality, 85L);

                var jpegCodec = GetEncoder(ImageFormat.Jpeg);
                if (jpegCodec != null)
                {
                    bitmap.Save(ms, jpegCodec, encoderParams);
                }
                else
                {
                    bitmap.Save(ms, ImageFormat.Jpeg);
                }

                return Convert.ToBase64String(ms.ToArray());
            }
            catch (Exception ex)
            {
                ErrorReporter.Report(ex, "ImageHelper.ToBase64");
                return string.Empty;
            }
        }

        private static ImageCodecInfo? GetEncoder(ImageFormat format)
        {
            var codecs = ImageCodecInfo.GetImageEncoders();
            foreach (var codec in codecs)
            {
                if (codec.FormatID == format.Guid)
                    return codec;
            }
            return null;
        }
    }
}
