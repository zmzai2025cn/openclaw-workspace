using System;

namespace OcrMinimalTest
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("=== OCR 最小化测试 ===");
            Console.WriteLine($"时间: {DateTime.Now}");
            Console.WriteLine($"OS: {Environment.OSVersion}");
            Console.WriteLine($"64位: {Environment.Is64BitProcess}");
            Console.WriteLine($"内存: {GC.GetTotalMemory(false) / 1024 / 1024}MB");
            Console.WriteLine();

            // 测试 1: 加载类型
            Console.WriteLine("[测试 1] 加载 PaddleOCRSharp 类型...");
            try
            {
                var type = typeof(PaddleOCRSharp.PaddleOCREngine);
                Console.WriteLine($"✅ 类型加载成功: {type.Assembly.Location}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ 类型加载失败: {ex.GetType().Name}: {ex.Message}");
                return;
            }

            // 测试 2: 创建空配置
            Console.WriteLine("[测试 2] 创建 OCRModelConfig...");
            try
            {
                var config = new PaddleOCRSharp.OCRModelConfig();
                Console.WriteLine($"✅ 配置创建成功");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ 配置创建失败: {ex.GetType().Name}: {ex.Message}");
                return;
            }

            // 测试 3: 创建参数
            Console.WriteLine("[测试 3] 创建 OCRParameter...");
            try
            {
                var param = new PaddleOCRSharp.OCRParameter();
                Console.WriteLine($"✅ 参数创建成功");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ 参数创建失败: {ex.GetType().Name}: {ex.Message}");
                return;
            }

            // 测试 4: 创建引擎（会失败，因为没有模型）
            Console.WriteLine("[测试 4] 创建 PaddleOCREngine（预期失败）...");
            try
            {
                var config = new PaddleOCRSharp.OCRModelConfig();
                var param = new PaddleOCRSharp.OCRParameter();
                var engine = new PaddleOCRSharp.PaddleOCREngine(config, param);
                Console.WriteLine($"⚠️ 引擎创建成功（意外）");
            }
            catch (DllNotFoundException ex)
            {
                Console.WriteLine($"❌ DLL 未找到: {ex.Message}");
            }
            catch (BadImageFormatException ex)
            {
                Console.WriteLine($"❌ DLL 格式错误: {ex.Message}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ 引擎创建失败: {ex.GetType().Name}: {ex.Message}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"   内部异常: {ex.InnerException.GetType().Name}: {ex.InnerException.Message}");
                }
            }

            Console.WriteLine();
            Console.WriteLine("=== 测试完成 ===");
            Console.WriteLine("按任意键退出...");
            Console.ReadKey();
        }
    }
}
