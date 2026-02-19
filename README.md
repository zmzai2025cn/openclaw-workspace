# 员工数字孪生生产力系统

## 产品概述

一套完整的员工生产力采集与分析解决方案，实现工作信息自动沉淀、智能分析、团队协同。

---

## 系统架构

### 整体架构

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

### 高可用架构

- **数据库集群**：主从复制 + 自动故障切换
- **负载均衡**：Nginx/HAProxy分发流量
- **数据分区**：按时间自动分区，冷热分离
- **配置中心**：etcd服务发现，动态配置

详见 [architecture/HA_DESIGN.md](docs/architecture/HA_DESIGN.md)

---

## 核心功能

### 客户端（WinCapture）

| 功能 | 说明 |
|------|------|
| 3级触发引擎 | 窗口切换、像素差分、定时兜底 |
| 分层脱敏 | 人脸模糊、AES加密、应用过滤 |
| 本地缓存 | SQLite队列，弱网支持 |
| 跨平台 | Windows/macOS/Linux |
| 自动更新 | 增量更新，灰度发布 |

### 服务端（Kimiclaw DB）

| 功能 | 说明 |
|------|------|
| 时序存储 | DuckDB高性能存储 |
| 飞书集成 | 9种消息格式解析 |
| 生产级特性 | 监控、备份、告警 |
| 容器化部署 | Docker/K8s支持 |
| 高可用 | 主从复制，自动故障切换 |

---

## 快速开始

见 [QUICKSTART.md](QUICKSTART.md)

---

## 完整文档

### 📖 文档索引

**23份文档**，覆盖产品全生命周期：

| 类别 | 文档 | 说明 |
|------|------|------|
| **快速开始** | [QUICKSTART.md](QUICKSTART.md) | 5分钟快速开始 |
| **部署** | [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) | 生产部署指南 |
| | [architecture/HA_DESIGN.md](docs/architecture/HA_DESIGN.md) | 高可用架构 |
| | [architecture/PARTITION_DESIGN.md](docs/architecture/PARTITION_DESIGN.md) | 数据分区 |
| | [operations/DISASTER_RECOVERY.md](docs/operations/DISASTER_RECOVERY.md) | 灾备恢复 |
| **运维** | [OPERATIONS.md](docs/OPERATIONS.md) | 运维手册 |
| | [operations/MONITORING.md](docs/operations/MONITORING.md) | 监控大盘 |
| | [operations/ALERTING.md](docs/operations/ALERTING.md) | 告警体系 |
| | [operations/AUTOSCALING.md](docs/operations/AUTOSCALING.md) | 自动扩缩容 |
| **开发** | [DEVELOPMENT.md](docs/DEVELOPMENT.md) | 开发指南 |
| | [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架构设计 |
| | [API.md](docs/API.md) | API文档 |
| | [CODE_REVIEW.md](docs/CODE_REVIEW.md) | 代码审查 |
| **用户** | [USER_MANUAL.md](docs/USER_MANUAL.md) | 用户手册 |
| | [FAQ.md](docs/FAQ.md) | 常见问题 |
| **其他** | [SECURITY.md](docs/SECURITY.md) | 安全白皮书 |
| | [CHANGELOG.md](docs/CHANGELOG.md) | 版本历史 |
| | [docs/INDEX.md](docs/INDEX.md) | 文档索引 |

---

## 项目结构

```
workspace/
├── kimiclaw-db/              # 服务端 (3000行)
│   ├── src/                  # 源代码
│   ├── tests/                # 测试文件
│   ├── k8s/                  # K8s配置
│   └── docker-compose.yml
├── wincapture-mvp/           # Windows客户端C#版 (1100行)
├── wincapture-electron/      # 跨平台客户端 (660行)
├── docs/                     # 文档 (23份)
│   ├── architecture/         # 架构设计
│   ├── operations/           # 运维手册
│   └── INDEX.md              # 文档索引
└── README.md                 # 本文件
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