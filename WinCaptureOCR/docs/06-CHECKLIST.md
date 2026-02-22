# 发布检查清单

## 目的
确保每次发布质量一致。

## 发布前检查

### 代码质量
- [ ] 编译 0 错误
- [ ] 编译 0 警告（或已知警告已记录）
- [ ] 版本号已更新（csproj + Program.cs）
- [ ] 所有异常已捕获
- [ ] 资源释放已确保（using/finally）

### 功能测试
- [ ] 程序可启动
- [ ] OCR 功能正常
- [ ] 错误处理正常（如无语言包）
- [ ] 调试日志正常写入

### 文档更新
- [ ] README.md 版本历史已更新
- [ ] 相关技术文档已更新
- [ ] 新增问题已记录到 04-COMMON-ISSUES.md

### 脚本测试
- [ ] setup.ps1 可正常执行
- [ ] 编译成功
- [ ] 输出文件完整

## 发布流程

```powershell
# 1. 版本号检查
grep -n "Version" WinCaptureOCR.csproj
grep -n "v1\." Program.cs

# 2. 编译测试
.\scripts\setup.ps1

# 3. 功能测试
dotnet run
# 测试 OCR 功能

# 4. 打包
Compress-Archive -Path WinCaptureOCR -DestinationPath WinCaptureOCR-vX.X.X.zip
```

## 发布后
- [ ] 创建 Git Tag
- [ ] 记录发布日期
- [ ] 更新版本历史

## 版本号规则
- 主版本.次版本.修订号
- v1.2.1：第1版，第2次功能更新，第1次修复
