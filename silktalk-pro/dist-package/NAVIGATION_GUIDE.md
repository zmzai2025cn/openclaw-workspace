# SilkTalk Pro 导航指南

**版本**: 1.0.0  
**更新日期**: 2026-02-22  
**用途**: 帮助 OpenClaw 快速找到所需信息

---

## 📍 快速导航

按角色/场景选择你的起点：

### 🔧 我是运维人员，我要...

| 任务 | 阅读文档 |
|------|----------|
| 部署 SilkTalk | [scripts/DEPLOYMENT.md](scripts/DEPLOYMENT.md) |
| 排查故障 | [scripts/TROUBLESHOOTING.md](scripts/TROUBLESHOOTING.md) |
| 了解兼容性 | [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) |
| 日常运维 | [docs/OPERATIONS.md](docs/OPERATIONS.md) |
| 快速修复 | [scripts/QUICK_FIX.md](scripts/QUICK_FIX.md) |

### 💻 我是开发人员，我要...

| 任务 | 阅读文档 |
|------|----------|
| 了解架构 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 了解代码规范 | [docs/process/CODING_STANDARDS.md](docs/process/CODING_STANDARDS.md) |
| 修改核心功能 | 查看 [src/core/node.ts](src/core/node.ts) |
| 添加新传输协议 | 查看 [src/network/](src/network/) |
| 了解详细设计 | [docs/design/LLD.md](docs/design/LLD.md) |
| 了解 Git 工作流 | [docs/process/GIT_WORKFLOW.md](docs/process/GIT_WORKFLOW.md) |

### 🧪 我是测试人员，我要...

| 任务 | 阅读文档 |
|------|----------|
| 了解测试策略 | [docs/testing/TEST_PLAN.md](docs/testing/TEST_PLAN.md) |
| 执行测试 | [docs/testing/EXECUTION_MANUAL.md](docs/testing/EXECUTION_MANUAL.md) |
| 查看测试用例 | [docs/testing/TEST_CASES.md](docs/testing/TEST_CASES.md) |
| 双机测试 | [docs/DUAL_MACHINE_TEST.md](docs/DUAL_MACHINE_TEST.md) |

### 👤 我是新用户，我要...

| 任务 | 阅读文档 |
|------|----------|
| 快速开始 | [README.md](README.md) |
| 了解项目 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 双机测试 | [docs/DUAL_MACHINE_TEST.md](docs/DUAL_MACHINE_TEST.md) |
| 脚本概览 | [scripts/README.md](scripts/README.md) |

---

## 📚 文档地图

### 项目概览

| 文档 | 描述 |
|------|------|
| [README.md](README.md) | 项目介绍、快速开始 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系统架构全景图 |

### 架构设计

| 文档 | 描述 |
|------|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系统架构 |
| [docs/design/HLD.md](docs/design/HLD.md) | 概要设计 |
| [docs/design/LLD.md](docs/design/LLD.md) | 详细设计 |
| [docs/design/API.md](docs/design/API.md) | 接口设计 |
| [docs/process/ADR.md](docs/process/ADR.md) | 架构决策记录 |

### 开发规范

| 文档 | 描述 |
|------|------|
| [docs/process/CODING_STANDARDS.md](docs/process/CODING_STANDARDS.md) | 代码规范 |
| [docs/process/CODE_REVIEW.md](docs/process/CODE_REVIEW.md) | 代码审查流程 |
| [docs/process/GIT_WORKFLOW.md](docs/process/GIT_WORKFLOW.md) | Git 工作流 |

### 测试相关

| 文档 | 描述 |
|------|------|
| [docs/testing/TEST_PLAN.md](docs/testing/TEST_PLAN.md) | 测试计划 |
| [docs/testing/TEST_CASES.md](docs/testing/TEST_CASES.md) | 测试用例清单 |
| [docs/testing/EXECUTION_MANUAL.md](docs/testing/EXECUTION_MANUAL.md) | 测试执行手册 |
| [docs/testing/TEST_REPORT_TEMPLATE.md](docs/testing/TEST_REPORT_TEMPLATE.md) | 测试报告模板 |

### 部署运维

| 文档 | 描述 |
|------|------|
| [scripts/README.md](scripts/README.md) | 脚本套件概览 |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | 详细部署指南 |
| [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) | 兼容性矩阵 |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | 故障排查手册 |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | 运维手册 |
| [docs/DUAL_MACHINE_TEST.md](docs/DUAL_MACHINE_TEST.md) | 双机测试指南 |
| [scripts/QUICK_FIX.md](scripts/QUICK_FIX.md) | 快速排查指南 |

### 其他重要文档

| 文档 | 描述 |
|------|------|
| [docs/API.md](docs/API.md) | API 参考文档 |
| [docs/SECURITY.md](docs/SECURITY.md) | 安全指南 |
| [docs/NETWORK.md](docs/NETWORK.md) | 网络配置 |
| [docs/PROTOCOL.md](docs/PROTOCOL.md) | 协议规范 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 版本变更历史 |
| [docs/CMMI5_COMPLIANCE_INDEX.md](docs/CMMI5_COMPLIANCE_INDEX.md) | CMMI 5 合规索引 |

---

## 🗺️ 代码地图

### 目录结构

```
src/
├── index.ts              # 主入口
├── core/                 # 核心模块
├── network/              # 网络模块
├── protocol/             # 协议模块
├── routing/              # 路由模块
├── bridge/               # 桥接模块
└── cli/                  # CLI 模块
```

### 核心模块 (src/core/)

| 文件 | 功能 | 关键类/接口 |
|------|------|-------------|
| [node.ts](src/core/node.ts) | 主节点实现，P2P网络入口 | `SilkNode` |
| [config.ts](src/core/config.ts) | 配置管理 | `ConfigManager`, `SilkNodeConfig` |
| [identity.ts](src/core/identity.ts) | 身份管理 | `IdentityManager` |
| [logger.ts](src/core/logger.ts) | 日志系统 | `Logger` |
| [types.ts](src/core/types.ts) | 类型定义 | 核心类型定义 |

### 网络模块 (src/network/)

| 文件 | 功能 | 关键类/接口 |
|------|------|-------------|
| [connection-manager.ts](src/network/connection-manager.ts) | 连接管理 | `ConnectionManager` |
| [nat-traversal.ts](src/network/nat-traversal.ts) | NAT穿透 | `NatTraversal` |
| [transport-manager.ts](src/network/transport-manager.ts) | 传输管理 | `TransportManager` |

### 协议模块 (src/protocol/)

| 文件 | 功能 | 关键类/接口 |
|------|------|-------------|
| [handler.ts](src/protocol/handler.ts) | 消息协议处理 | `MessageHandler`, `SilkMessage` |

### 路由模块 (src/routing/)

| 文件 | 功能 | 关键类/接口 |
|------|------|-------------|
| [dht.ts](src/routing/dht.ts) | DHT路由 | `DHTRouting` |
| [discovery.ts](src/routing/discovery.ts) | 节点发现 | `PeerDiscovery` |

### 桥接模块 (src/bridge/)

| 文件 | 功能 | 关键类/接口 |
|------|------|-------------|
| [openclaw.ts](src/bridge/openclaw.ts) | OpenClaw桥接 | `OpenClawBridge` |

### CLI (src/cli/)

| 文件 | 功能 | 关键类/接口 |
|------|------|-------------|
| [index.ts](src/cli/index.ts) | 命令行接口 | CLI 命令定义 |

---

## ❓ 常见问题速查 (FAQ)

### 部署相关

**Q: 如何部署 SilkTalk Pro?**  
A: 阅读 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) 或运行 `./scripts/auto-deploy.sh`

**Q: 部署失败怎么办?**  
A: 阅读 [scripts/TROUBLESHOOTING.md](scripts/TROUBLESHOOTING.md) 或运行 `./scripts/troubleshoot.sh --auto-fix`

**Q: 如何双机测试?**  
A: 阅读 [docs/DUAL_MACHINE_TEST.md](docs/DUAL_MACHINE_TEST.md)

### 配置相关

**Q: 如何修改配置?**  
A: 查看 [docs/design/LLD.md](docs/design/LLD.md) 配置部分，或运行 `./scripts/generate-config.sh`

**Q: 配置文件在哪里?**  
A: 默认位置 `/usr/local/silktalk-pro/config/silktalk.config.json`

### 开发相关

**Q: 如何添加新功能?**  
A: 阅读 [docs/design/LLD.md](docs/design/LLD.md) 扩展指南和 [docs/process/CODING_STANDARDS.md](docs/process/CODING_STANDARDS.md)

**Q: 如何排查连接问题?**  
A: 阅读 [scripts/QUICK_FIX.md](scripts/QUICK_FIX.md)

### 测试相关

**Q: 如何运行测试?**  
A: 阅读 [docs/testing/EXECUTION_MANUAL.md](docs/testing/EXECUTION_MANUAL.md)

**Q: 测试覆盖率要求是什么?**  
A: 查看 [docs/testing/TEST_PLAN.md](docs/testing/TEST_PLAN.md) 覆盖率要求部分

---

## 🎓 学习路径

### 新手路径 (30分钟)

1. **[README.md](README.md)** (5分钟)
   - 了解项目是什么
   - 快速开始指南

2. **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** (10分钟)
   - 了解部署流程
   - 熟悉脚本使用

3. **执行部署测试** (15分钟)
   - 运行 `./scripts/auto-deploy.sh`
   - 验证安装结果

### 开发路径 (2小时)

1. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** (20分钟)
   - 理解系统架构
   - 了解分层设计

2. **[docs/design/HLD.md](docs/design/HLD.md)** (30分钟)
   - 了解组件设计
   - 理解数据流

3. **[docs/process/CODING_STANDARDS.md](docs/process/CODING_STANDARDS.md)** (15分钟)
   - 了解代码规范
   - 命名约定

4. **阅读核心代码** (55分钟)
   - [src/core/node.ts](src/core/node.ts) - 主节点
   - [src/network/connection-manager.ts](src/network/connection-manager.ts) - 连接管理
   - [src/protocol/handler.ts](src/protocol/handler.ts) - 消息处理

### 运维路径 (1小时)

1. **[scripts/README.md](scripts/README.md)** (10分钟)
   - 脚本套件概览
   - 架构理解

2. **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** (15分钟)
   - 详细部署指南
   - 高级选项

3. **[docs/COMPATIBILITY.md](docs/COMPATIBILITY.md)** (10分钟)
   - 兼容性矩阵
   - 环境要求

4. **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** (15分钟)
   - 故障排查方法
   - 常见问题

5. **[docs/OPERATIONS.md](docs/OPERATIONS.md)** (10分钟)
   - 日常运维任务
   - 监控和日志

---

## 🔗 相关资源

- **项目主页**: 参见 README.md
- **问题反馈**: 使用 troubleshoot.sh 收集诊断信息
- **文档更新**: 本文档随项目迭代更新

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-22  
**维护者**: SilkTalk Team
