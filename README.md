# 员工数字孪生生产力系统

## 产品概述

一套完整的员工生产力采集与分析解决方案，实现工作信息自动沉淀、智能分析、团队协同。

---

## 系统架构

```
┌─────────────────┐     HTTPS      ┌─────────────────┐     ┌─────────────────┐
│  WinCapture     │ ──────────────> │  Kimiclaw DB    │ ───> │  分析展示面板   │
│  (客户端)        │                │  (服务端)        │     │  (Web界面)      │
└─────────────────┘                └─────────────────┘     └─────────────────┘
        │                                   │
        │ 3级触发                            │ 飞书Webhook
        │ (窗口/像素/定时)                   │
        ▼                                   ▼
┌─────────────────┐                ┌─────────────────┐
│  屏幕采集        │                │  飞书消息解析    │
│  分层脱敏        │                │  9种格式支持     │
│  本地缓存        │                │  时序存储        │
└─────────────────┘                └─────────────────┘
```

---

## 核心功能

### 客户端（WinCapture）

| 功能 | 说明 |
|------|------|
| 3级触发引擎 | 窗口切换、像素差分、定时兜底 |
| 分层脱敏 | 人脸模糊、AES加密、应用过滤 |
| 本地缓存 | SQLite队列，弱网支持 |
| 跨平台 | Windows/macOS/Linux |

### 服务端（Kimiclaw DB）

| 功能 | 说明 |
|------|------|
| 时序存储 | DuckDB高性能存储 |
| 飞书集成 | 9种消息格式解析 |
| 生产级特性 | 监控、备份、告警 |
| 容器化部署 | Docker/K8s支持 |

---

## 快速开始

见 [QUICKSTART.md](QUICKSTART.md)

---

## 详细文档

| 文档 | 内容 |
|------|------|
| [QUICKSTART.md](QUICKSTART.md) | 5分钟快速开始 |
| [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) | 生产部署指南 |
| [FINAL_TEST_REPORT.md](FINAL_TEST_REPORT.md) | 测试报告 |
| [FINAL_DELIVERY.md](FINAL_DELIVERY.md) | 交付清单 |

---

## 项目结构

```
workspace/
├── kimiclaw-db/          # 服务端
│   ├── src/              # 源代码
│   ├── tests/            # 测试文件
│   ├── k8s/              # K8s配置
│   └── docker-compose.yml
├── wincapture-mvp/       # Windows原生客户端(C#)
├── wincapture-electron/  # 跨平台客户端(Node.js)
└── docs/                 # 文档
```

---

## 技术栈

| 组件 | 技术 |
|------|------|
| 服务端 | Node.js + TypeScript + DuckDB |
| 客户端(C#) | .NET 6 + WinForms |
| 客户端(Electron) | Node.js + Electron |
| 部署 | Docker + Kubernetes |

---

## 性能指标

| 指标 | 数值 |
|------|------|
| 服务端吞吐量 | 10,000条/秒 |
| 客户端CPU占用 | < 5% |
| 客户端内存占用 | < 200MB |
| 端到端延迟 | < 1秒 |

---

## 安全特性

- ✅ HTTPS传输加密
- ✅ AES数据加密
- ✅ API Key认证
- ✅ 应用白名单过滤
- ✅ 人脸自动模糊

---

## 许可证

MIT License

---

## 支持

遇到问题请参考 [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) 故障排查章节。