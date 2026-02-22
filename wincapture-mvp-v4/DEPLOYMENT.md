# WinCapture MVP v5.6 部署指南

## 系统要求

| 项目 | 最低要求 | 推荐 |
|------|----------|------|
| Windows 版本 | Windows 10 (x64) | Windows 11 |
| 系统架构 | 64 位 (x64) | 64 位 (x64) |
| 内存 | 4 GB | 8 GB+ |
| 磁盘空间 | 500 MB | 1 GB+ |
| 权限 | 普通用户 | 普通用户 |

## 依赖项

### 1. Visual C++ Redistributable
**PaddleOCRSharp 需要 VC++ 运行时**

- 大多数 Win10/11 已自带
- 如缺失，下载安装 [VC++ Redist x64](https://aka.ms/vs/17/release/vc_redist.x64.exe)

### 2. OCR 模型文件 (v3)

```
publish/
├── WinCaptureMVP.exe
├── paddleocr_models/
│   ├── ch_PP-OCRv3_det_infer/     # 检测模型
│   │   ├── inference.pdmodel
│   │   └── inference.pdiparams
│   ├── ch_PP-OCRv3_rec_infer/     # 识别模型
│   │   ├── inference.pdmodel
│   │   └── inference.pdiparams
│   └── ppocr_keys_v1.txt          # 字典文件
```

**模型缺失处理**:
- 程序会启动
- OCR 延迟初始化，失败后可重试
- 截图功能正常
- 查看 `startup_check_report.txt` 了解详情

### 3. Native DLL

从 NuGet 包复制到发布目录：
```powershell
$source = "$env:USERPROFILE\.nuget\packages\paddleocrsharp\4.1.0\build\PaddleOCRLib\*"
$dest = ".\bin\Release\net6.0-windows\win-x64\publish\"
Copy-Item $source $dest -Recurse -Force
```

## 部署步骤

### 方式一：全自动部署（推荐）

```powershell
cd wincapture-mvp-v4
.\publish-release.ps1
```

**脚本自动完成：**
1. 编译项目
2. 下载/检查模型文件
3. 复制 Native DLL
4. 运行发布前验证
5. 运行启动自检
6. 打包为 zip

**输出：** `wincapture-mvp-v5.6.zip`

### 方式二：手动部署

如果需要手动控制每个步骤：

```powershell
# 步骤 1: 编译
dotnet publish -c Release -r win-x64 --self-contained true

# 步骤 2: 复制模型文件（如果脚本未自动下载）
.\download-v3-models.ps1

# 步骤 3: 复制 Native DLL
$source = "$env:USERPROFILE\.nuget\packages\paddleocrsharp\4.1.0\build\PaddleOCRLib\*"
$dest = ".\bin\Release\net6.0-windows\win-x64\publish\"
Copy-Item $source $dest -Recurse -Force

# 步骤 4: 运行验证
.\verify-before-publish.ps1

# 步骤 5: 运行测试
.\bin\Release\net6.0-windows\win-x64\publish\WinCaptureMVP.exe

# 步骤 6: 手动打包
Compress-Archive -Path "bin\Release\net6.0-windows\win-x64\publish\*" -DestinationPath "wincapture-mvp-v5.6.zip"
```

## 数据目录

程序按以下优先级选择数据目录：

1. 配置指定的 `DataDirectory`
2. `%LocalAppData%\WinCaptureMVP\`
3. 程序目录 `WinCaptureMVP_Data\`
4. 临时目录
5. 内存数据库（最后手段）

## 日志文件

| 日志 | 位置 | 用途 |
|------|------|------|
| 启动自检 | `startup_check_report.txt` | 环境检查报告 |
| 应用日志 | `app_log.txt` | 运行记录 |
| OCR 日志 | `ocr_log.txt` | 识别过程 |
| 错误日志 | `error.log` | 异常信息 |
| 触发器错误 | `trigger_error.log` | 定时器异常 |

## 故障排除

### 启动失败

**检查清单**:
1. 查看 `startup_check_report.txt`
2. 确认模型文件版本为 v3
3. 确认 Native DLL 存在
4. 检查 VC++ Redist

### OCR 不工作

**排查步骤**:
1. 检查 `ocr_log.txt` 初始化信息
2. 确认 `IsAvailable` 状态
3. 查看 `error.log` 异常
4. 模型路径是否正确

### 数据库错误

**自动回退**:
- 主目录失败 → 程序目录
- 程序目录失败 → 临时目录
- 都失败 → 内存数据库

**内存数据库警告**: 数据不会持久化

## 验证清单

部署后验证:

- [ ] `startup_check_report.txt` 显示"通过"
- [ ] 托盘图标正常显示
- [ ] 配置界面可打开
- [ ] 窗口切换触发截图
- [ ] 数据保存成功
- [ ] 时间线可查看记录
- [ ] 日报可生成

## 回滚方案

如 v5.6 有问题:
1. 保留 `worklog.db` 数据库文件
2. 回退到上一版本
3. 数据库兼容，可直接使用

---

*版本: v5.6*
*更新日期: 2026-02-20*
