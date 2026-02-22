# Kimi Claw 长期记忆

## 用户档案
- **Name:** 待填写
- **What to call them:** 待填写
- **Pronouns:** 待填写
- **Timezone:** Asia/Shanghai (GMT+8)
- **Notes:** 构建员工数字孪生生产力系统

---

## 活跃项目

### 1. Kimiclaw DB（服务端）
**位置:** `/root/.openclaw/workspace/kimiclaw-db/`
**技术栈:** Node.js + TypeScript + DuckDB
**代码量:** ~3000 行
**状态:** ✅ 完成，待部署

**核心功能:**
- DuckDB 时序数据库 + 批量缓冲
- 飞书消息解析器（9种格式）
- 生产功能：监控、备份、告警、认证
- 部署配置：Docker、K8s、CI/CD
- 迁移工具：一键迁移脚本

**版本:** v1.1.0-production

---

### 2. WinCapture MVP（Windows 客户端）
**位置:** `/root/.openclaw/workspace/wincapture-mvp/`
**技术栈:** C# + .NET 6 + WinForms
**代码量:** ~1100 行
**状态:** ✅ 代码完成，待 Windows 环境构建验证

**核心功能:**
- 3级触发引擎（窗口切换、像素差分、定时兜底）
- 分层脱敏（人脸模糊、AES加密、应用过滤）
- SQLite 本地缓存，弱网支持
- 托盘运行，无界面后台

---

### 3. WinCapture OCR（衍生项目）
**位置:** `/root/.openclaw/workspace/WinCaptureOCR/`
**技术栈:** .NET 6 + Tesseract OCR 5.2.0
**版本:** v1.6.0
**状态:** ✅ 已发布

**核心功能:**
- 每 10 秒自动截屏 OCR
- 缩略图记录（320x180，保留1000张）
- 日志查看器 + 搜索功能
- 系统托盘运行

---

## 项目架构

```
[WinCapture 客户端] --HTTPS--> [Kimiclaw DB 服务端] --> [分析展示]
       Windows采集                    数据存储+飞书解析
```

---

## 关键决策记录

| 日期 | 决策 | 原因 |
|------|------|------|
| 2026-02-19 | 放弃 WiseClaw Core v4.0 | 过度设计，四层认知架构太复杂 |
| 2026-02-19 | 转向 Kimiclaw DB 新项目 | 更聚焦、更实用 |
| 2026-02-19 | 定位从"帮助团队"转为"信息情报中心" | 更清晰的商业价值 |
| 2026-02-19 | 技术选型 C# 原生而非 Electron | 性能最优 |
| 2026-02-19 | 启用消息编号系统（MSG-XXX） | 解决丢包问题 |

---

## 当前阻塞

1. **WinCapture 构建验证** - 需要在 Windows 环境编译测试
2. **接口联调** - 客户端与服务端对接
3. **飞书接入** - 申请机器人权限

---

## 待完成任务

### 立即做
- [ ] 在 Windows 电脑构建 WinCapture
- [ ] 启动 Kimiclaw DB 服务
- [ ] 端到端测试

### 短期做
- [ ] 申请飞书机器人
- [ ] 试点团队接入
- [ ] 收集反馈迭代

---

## 项目统计

| 维度 | 数值 |
|------|------|
| 总代码量 | ~4100 行 |
| 测试覆盖 | 12 个单元测试 |
| 文档 | 23+ 份 |
| 部署配置 | Docker + K8s + CI/CD |

---

## 工作日志索引

- `memory/2026-02-19.md` - Kimiclaw DB + WinCapture MVP 开发完成

---

*最后更新: 2026-02-20*
