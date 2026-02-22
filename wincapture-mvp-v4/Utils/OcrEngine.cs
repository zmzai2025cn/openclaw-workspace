using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

namespace WinCaptureMVP.Utils
{
    /// <summary>
    /// OCR 引擎 - 基于 PaddleOCRSharp
    /// </summary>
    public static class OcrEngine
    {
        private static readonly object InitLock = new object();
        private static readonly object RecognizeLock = new object(); // 识别操作锁
        private static bool _isInitialized;
        private static bool _initFailed;
        private static string? _initErrorMessage;
        private static PaddleOCRSharp.PaddleOCREngine? _ocrEngine;
        private static readonly string LogPath;

        /// <summary>
        /// OCR 引擎是否可用
        /// </summary>
        public static bool IsAvailable => _isInitialized && !_initFailed && _ocrEngine != null;

        /// <summary>
        /// 获取初始化错误信息
        /// </summary>
        public static string? LastErrorMessage => _initErrorMessage;

        static OcrEngine()
        {
            // 使用更安全的路径获取方式
            string logDir;
            try
            {
                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                if (!string.IsNullOrEmpty(localAppData))
                {
                    logDir = Path.Combine(localAppData, "WinCaptureMVP");
                }
                else
                {
                    logDir = AppContext.BaseDirectory;
                }
            }
            catch
            {
                logDir = AppContext.BaseDirectory;
            }
            
            // 确保 logDir 不为空
            if (string.IsNullOrEmpty(logDir))
            {
                logDir = ".";
            }
            
            LogPath = Path.Combine(logDir, "ocr_log.txt");
            
            // 先记录一条测试日志，确保日志功能正常
            try
            {
                File.AppendAllText(LogPath, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} OCR 日志初始化{Environment.NewLine}");
            }
            catch
            {
                // 如果无法写入，尝试当前目录
                LogPath = "ocr_log.txt";
                try
                {
                    File.AppendAllText(LogPath, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} OCR 日志初始化(备用路径){Environment.NewLine}");
                }
                catch { }
            }
            
            try
            {
                Initialize();
            }
            catch (Exception ex)
            {
                // 只有在 _initErrorMessage 为空时才设置，避免覆盖 Initialize 中的详细错误
                if (string.IsNullOrEmpty(_initErrorMessage))
                {
                    _initErrorMessage = $"静态构造函数异常: {ex.Message}";
                }
                Log($"[FATAL] 初始化失败: {_initErrorMessage}");
                Log($"堆栈: {ex.StackTrace}");
                _initFailed = true;
            }
        }

        private static void Log(string message)
        {
            // 尝试 1: 主日志路径
            if (!string.IsNullOrEmpty(LogPath))
            {
                try
                {
                    var dir = Path.GetDirectoryName(LogPath);
                    if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    {
                        Directory.CreateDirectory(dir);
                    }
                    File.AppendAllText(LogPath, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}{Environment.NewLine}");
                    return;
                }
                catch { }
            }
            
            // 尝试 2: 备用路径
            try
            {
                var fallbackPath = Path.Combine(AppContext.BaseDirectory ?? ".", "ocr_log.txt");
                File.AppendAllText(fallbackPath, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}{Environment.NewLine}");
                return;
            }
            catch { }
            
            // 尝试 3: 当前目录
            try
            {
                File.AppendAllText("ocr_log.txt", $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}{Environment.NewLine}");
                return;
            }
            catch { }
        }

        private static void Initialize()
        {
            lock (InitLock)
            {
                if (_isInitialized || _initFailed) return;

                try
                {
                    // 首先检查 PaddleOCRSharp 是否能正常加载
                    try
                    {
                        Log("检查 PaddleOCRSharp 类型...");
                        var testType = typeof(PaddleOCRSharp.PaddleOCREngine);
                        Log($"PaddleOCRSharp 类型加载成功: {testType.Assembly.Location}");
                        
                        // 尝试创建实例前的额外检查
                        Log("检查 PaddleOCRSharp 依赖项...");
                        var assembly = testType.Assembly;
                        foreach (var refAssembly in assembly.GetReferencedAssemblies())
                        {
                            try
                            {
                                System.Reflection.Assembly.Load(refAssembly);
                                Log($"  依赖项加载成功: {refAssembly.Name}");
                            }
                            catch (Exception refEx)
                            {
                                Log($"  依赖项加载失败: {refAssembly.Name} - {refEx.Message}");
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _initErrorMessage = $"无法加载 PaddleOCRSharp: {ex.GetType().Name}: {ex.Message}";
                        Log($"[FATAL] {_initErrorMessage}");
                        Log($"[FATAL] 堆栈: {ex.StackTrace}");
                        if (ex.InnerException != null)
                        {
                            Log($"[FATAL] 内部异常: {ex.InnerException.GetType().Name}: {ex.InnerException.Message}");
                        }
                        _initFailed = true;
                        return;
                    }

                    var exePath = GetExecutableDirectory();
                    
                    // 确保 exePath 不为空
                    if (string.IsNullOrWhiteSpace(exePath))
                    {
                        _initErrorMessage = "无法获取执行目录";
                        Log($"错误: {_initErrorMessage}");
                        _initFailed = true;
                        return;
                    }
                    
                    // 单文件发布时，尝试多个可能的模型路径
                    string[] possibleModelPaths = new[]
                    {
                        Path.Combine(exePath, "paddleocr_models"),
                        Path.Combine(AppContext.BaseDirectory, "paddleocr_models"),
                        Path.Combine(Environment.CurrentDirectory, "paddleocr_models"),
                        @".\paddleocr_models"
                    };
                    
                    string? modelPath = null;
                    foreach (var path in possibleModelPaths)
                    {
                        Log($"尝试模型路径: {path}");
                        if (Directory.Exists(path))
                        {
                            // 尝试 v3 模型
                            var detTest = Path.Combine(path, "ch_PP-OCRv3_det_infer");
                            var recTest = Path.Combine(path, "ch_PP-OCRv3_rec_infer");
                            var keysTest = Path.Combine(path, "ppocr_keys_v1.txt");
                            
                            if (Directory.Exists(detTest) && Directory.Exists(recTest) && File.Exists(keysTest))
                            {
                                modelPath = path;
                                Log($"找到有效模型路径(v3): {path}");
                                break;
                            }
                            
                            // 备选：尝试 v4 模型
                            detTest = Path.Combine(path, "ch_PP-OCRv4_det_infer");
                            recTest = Path.Combine(path, "ch_PP-OCRv4_rec_infer");
                            keysTest = Path.Combine(path, "ppocr_keys.txt");
                            
                            if (Directory.Exists(detTest) && Directory.Exists(recTest) && File.Exists(keysTest))
                            {
                                modelPath = path;
                                Log($"找到有效模型路径(v4): {path}");
                                break;
                            }
                        }
                    }
                    
                    if (modelPath == null)
                    {
                        _initErrorMessage = "无法找到有效的模型路径，请确认 paddleocr_models 目录存在";
                        Log($"错误: {_initErrorMessage}");
                        _initFailed = true;
                        return;
                    }

                    Log($"初始化开始...");
                    Log($"执行目录: {exePath}");
                    Log($"模型目录: {modelPath}");

                    // 检查模型文件 - 使用 PP-OCRv3 模型
                    var detPath = Path.Combine(modelPath, "ch_PP-OCRv3_det_infer");
                    var recPath = Path.Combine(modelPath, "ch_PP-OCRv3_rec_infer");
                    var clsPath = Path.Combine(modelPath, "ch_ppocr_mobile_v2.0_cls_infer");
                    var keysPath = Path.Combine(modelPath, "ppocr_keys_v1.txt");

                    var detExists = Directory.Exists(detPath);
                    var recExists = Directory.Exists(recPath);
                    var clsExists = Directory.Exists(clsPath);
                    var keysExists = File.Exists(keysPath);

                    Log($"检测模型: det={detExists}, rec={recExists}, cls={clsExists}, keys={keysExists}");

                    if (!detExists || !recExists || !keysExists)
                    {
                        _initErrorMessage = "模型文件不完整，OCR 功能不可用";
                        Log($"错误: {_initErrorMessage}");
                        _initFailed = true;
                        return;
                    }

                    // 创建配置
                    var config = new PaddleOCRSharp.OCRModelConfig
                    {
                        det_infer = detPath,
                        rec_infer = recPath,
                        cls_infer = clsExists ? clsPath : string.Empty,
                        keys = keysPath
                    };

                    Log($"OCR 配置:");
                    Log($"  det_infer: {config.det_infer}");
                    Log($"  rec_infer: {config.rec_infer}");
                    Log($"  cls_infer: {config.cls_infer}");
                    Log($"  keys: {config.keys}");

                    // 验证识别模型文件
                    var recModelFile = Path.Combine(config.rec_infer, "inference.pdmodel");
                    var recParamsFile = Path.Combine(config.rec_infer, "inference.pdiparams");
                    Log($"  识别模型文件存在: {File.Exists(recModelFile)}");
                    Log($"  识别参数文件存在: {File.Exists(recParamsFile)}");
                    Log($"  字典文件存在: {File.Exists(config.keys)}");

                    // 创建参数 - 使用更宽松的设置以提高识别率
                    var parameter = new PaddleOCRSharp.OCRParameter
                    {
                        cpu_math_library_num_threads = 2,
                        enable_mkldnn = false,
                        cls = clsExists,
                        use_angle_cls = false,
                        det_db_thresh = 0.1f,              // 降低阈值，提高检测率
                        det_db_box_thresh = 0.3f,          // 降低阈值
                        det_db_unclip_ratio = 2.0f,        // 增加扩展比例
                        max_side_len = 1024                // 增加最大边长
                    };

                    Log("正在创建 OCR 引擎...");
                    try
                    {
                        _ocrEngine = new PaddleOCRSharp.PaddleOCREngine(config, parameter);
                        _isInitialized = true;
                        Log("OCR 引擎初始化成功");
                    }
                    catch (Exception engineEx)
                    {
                        _initErrorMessage = $"创建 PaddleOCREngine 失败: {engineEx.GetType().Name}: {engineEx.Message}";
                        Log($"[FATAL] {_initErrorMessage}");
                        Log($"[FATAL] 堆栈: {engineEx.StackTrace}");
                        if (engineEx.InnerException != null)
                        {
                            Log($"[FATAL] 内部异常: {engineEx.InnerException.GetType().Name}: {engineEx.InnerException.Message}");
                            Log($"[FATAL] 内部异常堆栈: {engineEx.InnerException.StackTrace}");
                        }
                        _initFailed = true;
                        return;
                    }
                }
                catch (DllNotFoundException ex)
                {
                    _initErrorMessage = $"缺少 DLL: {ex.Message}";
                    Log($"错误: {_initErrorMessage}");
                    _initFailed = true;
                }
                catch (BadImageFormatException ex)
                {
                    _initErrorMessage = $"DLL 架构不匹配: {ex.Message}";
                    Log($"错误: {_initErrorMessage}");
                    _initFailed = true;
                }
                catch (Exception ex)
                {
                    _initErrorMessage = $"OCR 初始化失败: {ex.GetType().Name}: {ex.Message}";
                    Log($"[ERROR] {_initErrorMessage}");
                    Log($"[ERROR] 堆栈: {ex.StackTrace}");
                    _initFailed = true;
                }
            }
        }

        /// <summary>
        /// 获取执行文件所在目录（支持单文件发布）
        /// </summary>
        private static string GetExecutableDirectory()
        {
            try
            {
                // 方法1: 使用进程主模块
                var mainModule = System.Diagnostics.Process.GetCurrentProcess().MainModule;
                if (mainModule?.FileName != null)
                {
                    var dir = Path.GetDirectoryName(mainModule.FileName);
                    if (!string.IsNullOrEmpty(dir) && Directory.Exists(dir))
                    {
                        return dir;
                    }
                }
            }
            catch (Exception ex)
            {
                Log($"获取执行目录(方法1)失败: {ex.Message}");
            }

            try
            {
                // 方法2: 使用 AppContext
                var baseDir = AppContext.BaseDirectory;
                if (!string.IsNullOrEmpty(baseDir) && Directory.Exists(baseDir))
                {
                    return baseDir;
                }
            }
            catch (Exception ex)
            {
                Log($"获取执行目录(方法2)失败: {ex.Message}");
            }

            try
            {
                // 方法3: 使用当前目录
                var currentDir = Environment.CurrentDirectory;
                if (!string.IsNullOrEmpty(currentDir) && Directory.Exists(currentDir))
                {
                    return currentDir;
                }
            }
            catch (Exception ex)
            {
                Log($"获取执行目录(方法3)失败: {ex.Message}");
            }

            // 最终 fallback
            return ".";
        }

        /// <summary>
        /// 识别图片中的文字 - 延迟初始化，支持重试
        /// </summary>        
        public static string? Recognize(Bitmap? image)
        {
            // 延迟初始化：如果未初始化且未失败，尝试初始化
            if (!_isInitialized && !_initFailed)
            {
                lock (InitLock)
                {
                    if (!_isInitialized && !_initFailed)
                    {
                        try
                        {
                            Log("延迟初始化 OCR 引擎...");
                            Initialize();
                        }
                        catch (Exception ex)
                        {
                            _initErrorMessage = $"延迟初始化失败: {ex.Message}";
                            Log(_initErrorMessage);
                            _initFailed = true;
                        }
                    }
                }
            }

            // 前置检查
            if (_initFailed)
            {
                Log($"识别跳过: OCR 初始化失败 ({_initErrorMessage})");
                return null;
            }

            if (!_isInitialized)
            {
                Log("识别跳过: OCR 未初始化");
                return null;
            }

            if (_ocrEngine == null)
            {
                Log("识别跳过: OCR 引擎为空");
                return null;
            }

            if (image == null)
            {
                Log("识别跳过: 图片为空");
                return null;
            }

            if (image.Width == 0 || image.Height == 0)
            {
                Log("识别跳过: 图片尺寸为0");
                return null;
            }

            try
            {
                // 转换为字节数组
                byte[] imageBytes;
                using (var ms = new MemoryStream())
                {
                    // 使用 PNG 格式，无损压缩
                    image.Save(ms, ImageFormat.Png);
                    imageBytes = ms.ToArray();
                }

                if (imageBytes.Length == 0)
                {
                    Log("识别跳过: 图片字节为空");
                    return null;
                }

                Log($"开始识别，图片大小: {imageBytes.Length} bytes");

                // 调试用：保存图片到文件
                try
                {
                    var debugImagePath = Path.Combine(AppContext.BaseDirectory ?? ".", $"debug_ocr_{DateTime.Now:yyyyMMdd_HHmmss}.png");
                    File.WriteAllBytes(debugImagePath, imageBytes);
                    Log($"调试图片已保存: {debugImagePath}");
                }
                catch (Exception ex)
                {
                    Log($"保存调试图片失败: {ex.Message}");
                }

                // 调用 OCR（加锁确保线程安全）
                PaddleOCRSharp.OCRResult? result;
                lock (RecognizeLock)
                {
                    Log("调用 _ocrEngine.DetectText...");
                    result = _ocrEngine.DetectText(imageBytes);
                    Log($"DetectText 返回: {result != null}");
                }
                
                if (result == null)
                {
                    Log("识别结果为空 (result == null)");
                    return null;
                }

                // 详细调试信息
                Log($"识别结果类型: {result.GetType().FullName}");
                Log($"result.Text: '{result.Text ?? "(null)"}'");
                Log($"result.TextBlocks: {result.TextBlocks?.Count ?? 0} 个");
                
                // 完全从 TextBlocks 读取，忽略 result.Text
                string? text = null;
                if (result.TextBlocks != null && result.TextBlocks.Count > 0)
                {
                    var sb = new System.Text.StringBuilder();
                    for (int i = 0; i < result.TextBlocks.Count; i++)
                    {
                        var block = result.TextBlocks[i];
                        Log($"  TextBlock[{i}]: Text='{block.Text ?? "(null)"}', Score={block.Score}");
                        if (!string.IsNullOrEmpty(block.Text))
                        {
                            sb.AppendLine(block.Text);
                        }
                    }
                    text = sb.ToString().Trim();
                    Log($"从 TextBlocks 拼接完成，长度: {text.Length}");
                }
                else
                {
                    Log("TextBlocks 为空或 null");
                    // 备选：尝试 result.Text
                    text = result.Text?.Trim();
                }
                
                Log($"识别完成，最终文字长度: {text?.Length ?? 0}");
                
                return text;
            }
            catch (Exception ex)
            {
                Log($"识别异常: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 获取 OCR 初始化状态
        /// </summary>
        public static bool IsInitialized => _isInitialized;

        /// <summary>
        /// 释放 OCR 资源
        /// </summary>
        public static void Dispose()
        {
            lock (InitLock)
            {
                try
                {
                    _ocrEngine?.Dispose();
                }
                catch (Exception ex)
                {
                    Log($"释放资源异常: {ex.Message}");
                }
                finally
                {
                    _ocrEngine = null;
                    _isInitialized = false;
                    Log("OCR 资源已释放");
                }
            }
        }
    }
}
