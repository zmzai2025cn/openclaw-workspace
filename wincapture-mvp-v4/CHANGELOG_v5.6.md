# WinCapture MVP v5.6 改动记录

## 版本信息

- **版本**: v5.6
- **发布日期**: 2026-02-20
- **状态**: 已发布

---

## 核心改进

### 1. 架构稳定性

#### 延迟初始化 (OcrEngine)
**问题**: 静态构造函数初始化失败无法恢复
**解决**: 首次调用时初始化，支持重试
```csharp
public static string Recognize(Bitmap image)
{
    if (!_isInitialized && !_initFailed)
    {
        lock (InitLock) { Initialize(); }
    }
}
```

#### 统一错误上报 (ErrorReporter)
**新增**: 全局错误处理系统
- 统一写入 `error.log`
- 可选用户弹窗
- 自动包含上下文信息

#### 数据库多路径回退
**改进**: 5级回退机制
1. 配置目录
2. LocalAppData
3. 程序目录
4. 临时目录
5. 内存数据库

### 2. 资源管理

#### 内存泄漏防护
**修复**: 所有 Bitmap 使用 try-finally
- `CaptureEngine.RecordActivity()`
- `ImageHelper.CreateThumbnail()`

#### 进程句柄保护
**修复**: `WindowHelper.GetAppName()`
- 显式处理 ArgumentException
- 显式处理 InvalidOperationException
- finally 中显式 Dispose

### 3. 异常处理统一

| 文件 | 原处理 | 新处理 |
|------|--------|--------|
| Utils/WindowHelper.cs | Debug.WriteLine | ErrorReporter |
| Utils/ScreenCapture.cs | Debug.WriteLine | ErrorReporter |
| Utils/ImageHelper.cs | Debug.WriteLine | ErrorReporter |
| Config/UserConfig.cs | Debug.WriteLine | ErrorReporter |
| UI/TrayIcon.cs | Debug.WriteLine | ErrorReporter |
| Triggers/*.cs | 自定义 LogToFile | ErrorReporter |
| CaptureEngine.cs | Debug.WriteLine | ErrorReporter |

### 4. 质量保障

#### 新增文件
| 文件 | 用途 |
|------|------|
| `ErrorReporter.cs` | 统一错误上报 |
| `verify-before-publish.ps1` | 发布前验证 |
| `pre-commit.sh` | Git 预提交检查 |
| `.editorconfig` | 代码风格规范 |
| `CODE_REVIEW_CHECKLIST.md` | 人工审查清单 |
| `CODE_QUALITY_AUDIT.md` | 质量审计报告 |
| `CODE_REVIEW_v5.6.md` | 代码审查报告 |

#### 启动自检
**新增**: `Program.RunStartupCheck()`
- 运行时环境检查
- 模型文件检测 (v3/v4)
- Native DLL 完整性
- 数据目录可写性
- 生成 `startup_check_report.txt`

---

## OCR 模型变更

### v4 → v3

| 模型 | 原版本 | 新版本 |
|------|--------|--------|
| 检测模型 | ch_PP-OCRv4_det_infer | ch_PP-OCRv3_det_infer |
| 识别模型 | ch_PP-OCRv4_rec_infer | ch_PP-OCRv3_rec_infer |
| 字典文件 | ppocr_keys.txt | ppocr_keys_v1.txt |

**原因**: PaddleOCRSharp 4.1.0 与 v4 模型不兼容

---

## 文档更新

| 文档 | 更新内容 |
|------|----------|
| README.md | 完全重写，v5.6 版本 |
| DEPLOYMENT.md | 更新部署步骤和故障排除 |
| CHANGELOG_v5.6.md | 本文件 |

---

## 测试建议

### 必测场景

1. **首次启动**（无配置、无模型）
2. **模型路径错误**（验证延迟初始化）
3. **数据库目录无权限**（验证回退机制）
4. **暂停/恢复功能**
5. **长时间运行**（1小时以上）

### 验证点

- [ ] startup_check_report.txt 生成正确
- [ ] error.log 记录异常
- [ ] ocr_log.txt 显示延迟初始化
- [ ] 内存占用稳定

---

## 已知限制

1. **静态类 OcrEngine**: 难以单元测试（v6.0 改进）
2. **Timer 精度**: 500ms 轮询可能不够及时
3. **P/Invoke**: 部分 Win32 API 未检查返回值

---

## 版本历史

- v5.6 (2026-02-20): 架构稳定性改进
- v5.5 (2026-02-20): 模型路径检测修复
- v5.4 (2026-02-20): 初始 v5 版本
- v4.5 (2026-02-20): 最后一个 v4 版本

---

记录时间: 2026-02-20 18:00
