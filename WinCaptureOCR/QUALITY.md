# WinCaptureOCR 质量管理要求

## 目的
确保代码质量和一致性

## 核心原则

### 1. 问题只解决一次
- 遇到的问题 → 记录到 docs/04-COMMON-ISSUES.md
- 下次遇到 → 直接查文档

### 2. 代码规范
- 所有异常必须捕获
- 资源必须正确释放（using/finally）
- 多线程操作必须加锁
- 添加详细调试日志

### 3. 发布标准
- [ ] 编译 0 错误
- [ ] 编译 0 警告（或已知警告已禁用）
- [ ] 版本号一致（csproj + Program.cs + README）
- [ ] 功能测试通过
- [ ] 文档已更新

### 4. 检查流程
1. 代码审查
2. 编译测试
3. 功能测试
4. 文档同步
5. 最终检查（docs/12-LAST-CHECK.md）

## 依赖管理

### 运行时依赖
| 组件 | 版本 | 必需 |
|------|------|------|
| .NET | 6.0.x | 是 |
| VC++ | 2015-2022 x64 | 是 |
| chi_sim | 5.x | 是 |

### DLL 依赖
```
WinCaptureOCR.exe
├── Tesseract.dll
├── Tesseract.Drawing.dll
└── x64/
    ├── leptonica-1.82.0.dll
    └── tesseract50.dll
```

## 版本号规则
- 主版本.次版本.修订号
- v1.6.0：第1版，第6次功能更新

## 检查清单
- [docs/06-CHECKLIST.md](docs/06-CHECKLIST.md)
- [docs/12-LAST-CHECK.md](docs/12-LAST-CHECK.md)
