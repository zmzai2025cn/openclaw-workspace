using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

namespace WinCaptureOCR
{
    public static class ImagePreprocessor
    {
        /// <summary>
        /// 预处理图像以提高 OCR 识别率
        /// </summary>
        public static Bitmap Preprocess(Bitmap source)
        {
            Log("Preprocess started");
            
            // 1. 放大 2 倍（提高分辨率）
            var scaled = ScaleImage(source, 2.0);
            Log($"Scaled to {scaled.Width}x{scaled.Height}");
            
            // 2. 转换为灰度图
            var gray = ConvertToGrayscale(scaled);
            Log("Converted to grayscale");
            scaled.Dispose();
            
            // 3. 二值化（自适应阈值）
            var binary = AdaptiveThreshold(gray);
            Log("Applied adaptive threshold");
            gray.Dispose();
            
            Log("Preprocess completed");
            return binary;
        }
        
        /// <summary>
        /// 放大图像
        /// </summary>
        private static Bitmap ScaleImage(Bitmap source, double scale)
        {
            int newWidth = (int)(source.Width * scale);
            int newHeight = (int)(source.Height * scale);
            
            var result = new Bitmap(newWidth, newHeight);
            using (var g = Graphics.FromImage(result))
            {
                g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                g.DrawImage(source, 0, 0, newWidth, newHeight);
            }
            return result;
        }
        
        /// <summary>
        /// 转换为灰度图（使用 LockBits 优化性能）
        /// </summary>
        private static Bitmap ConvertToGrayscale(Bitmap source)
        {
            var result = new Bitmap(source.Width, source.Height, PixelFormat.Format24bppRgb);
            
            BitmapData srcData = source.LockBits(
                new Rectangle(0, 0, source.Width, source.Height),
                ImageLockMode.ReadOnly, source.PixelFormat);
            BitmapData dstData = result.LockBits(
                new Rectangle(0, 0, result.Width, result.Height),
                ImageLockMode.WriteOnly, result.PixelFormat);
            
            try
            {
                int bytesPerPixel = Image.GetPixelFormatSize(source.PixelFormat) / 8;
                int srcStride = srcData.Stride;
                int dstStride = dstData.Stride;
                
                unsafe
                {
                    byte* srcPtr = (byte*)srcData.Scan0;
                    byte* dstPtr = (byte*)dstData.Scan0;
                    
                    for (int y = 0; y < source.Height; y++)
                    {
                        for (int x = 0; x < source.Width; x++)
                        {
                            byte* srcPixel = srcPtr + (y * srcStride) + (x * bytesPerPixel);
                            byte* dstPixel = dstPtr + (y * dstStride) + (x * 3);
                            
                            // 计算灰度值
                            byte gray = (byte)(0.299 * srcPixel[2] + 0.587 * srcPixel[1] + 0.114 * srcPixel[0]);
                            
                            dstPixel[0] = gray; // B
                            dstPixel[1] = gray; // G
                            dstPixel[2] = gray; // R
                        }
                    }
                }
            }
            finally
            {
                source.UnlockBits(srcData);
                result.UnlockBits(dstData);
            }
            
            return result;
        }
        
        /// <summary>
        /// 自适应阈值二值化（使用 LockBits 优化）
        /// </summary>
        private static Bitmap AdaptiveThreshold(Bitmap source)
        {
            var result = new Bitmap(source.Width, source.Height, PixelFormat.Format24bppRgb);
            
            // 使用 Otsu 算法计算阈值
            int otsuThreshold = CalculateOtsuThreshold(source);
            int threshold = Math.Max(0, otsuThreshold - 10);
            
            Log($"Otsu threshold: {otsuThreshold}, Adjusted: {threshold}");
            
            BitmapData srcData = source.LockBits(
                new Rectangle(0, 0, source.Width, source.Height),
                ImageLockMode.ReadOnly, source.PixelFormat);
            BitmapData dstData = result.LockBits(
                new Rectangle(0, 0, result.Width, result.Height),
                ImageLockMode.WriteOnly, result.PixelFormat);
            
            int whitePixels = 0;
            int blackPixels = 0;
            
            try
            {
                int srcStride = srcData.Stride;
                int dstStride = dstData.Stride;
                
                unsafe
                {
                    byte* srcPtr = (byte*)srcData.Scan0;
                    byte* dstPtr = (byte*)dstData.Scan0;
                    
                    for (int y = 0; y < source.Height; y++)
                    {
                        for (int x = 0; x < source.Width; x++)
                        {
                            byte* srcPixel = srcPtr + (y * srcStride) + (x * 3);
                            byte* dstPixel = dstPtr + (y * dstStride) + (x * 3);
                            
                            byte gray = srcPixel[0]; // R=G=B in grayscale
                            byte value = gray > threshold ? (byte)255 : (byte)0;
                            
                            dstPixel[0] = value; // B
                            dstPixel[1] = value; // G
                            dstPixel[2] = value; // R
                            
                            if (value == 255) whitePixels++;
                            else blackPixels++;
                        }
                    }
                }
            }
            finally
            {
                source.UnlockBits(srcData);
                result.UnlockBits(dstData);
            }
            
            Log($"Binary result: {whitePixels} white, {blackPixels} black pixels");
            return result;
        }
        
        /// <summary>
        /// Otsu 算法计算最佳阈值（使用 LockBits 优化）
        /// </summary>
        private static int CalculateOtsuThreshold(Bitmap source)
        {
            int[] histogram = new int[256];
            int totalPixels = source.Width * source.Height;
            
            BitmapData data = source.LockBits(
                new Rectangle(0, 0, source.Width, source.Height),
                ImageLockMode.ReadOnly, source.PixelFormat);
            
            try
            {
                int stride = data.Stride;
                unsafe
                {
                    byte* ptr = (byte*)data.Scan0;
                    for (int y = 0; y < source.Height; y++)
                    {
                        for (int x = 0; x < source.Width; x++)
                        {
                            byte* pixel = ptr + (y * stride) + (x * 3);
                            histogram[pixel[0]]++;
                        }
                    }
                }
            }
            finally
            {
                source.UnlockBits(data);
            }
            
            // Otsu 算法
            float sum = 0;
            for (int i = 0; i < 256; i++) sum += i * histogram[i];
            
            float sumB = 0;
            int wB = 0;
            float maxVariance = 0;
            int threshold = 0;
            
            for (int i = 0; i < 256; i++)
            {
                wB += histogram[i];
                if (wB == 0) continue;
                
                int wF = totalPixels - wB;
                if (wF == 0) break;
                
                sumB += i * histogram[i];
                float mB = sumB / wB;
                float mF = (sum - sumB) / wF;
                float variance = (float)wB * wF * (mB - mF) * (mB - mF);
                
                if (variance > maxVariance)
                {
                    maxVariance = variance;
                    threshold = i;
                }
            }
            
            return threshold;
        }
        
        private static void Log(string msg)
        {
            var logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wincapture.log");
            var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [Preprocessor] {msg}";
            try { File.AppendAllText(logPath, line + Environment.NewLine); } catch { }
        }
    }
}
