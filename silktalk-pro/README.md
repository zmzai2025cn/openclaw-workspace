# SilkTalk Pro 跨环境自动化部署系统

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/silktalk/silktalk-pro)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

构建最高标准的自动化系统，确保 SilkTalk Pro 可以在任何 OpenClaw 环境（各种服务商、一键部署）下高度自动化完成检查、部署、安装、调试。

## 📋 目录

- [快速开始](#-快速开始)
- [系统特性](#-系统特性)
- [系统要求](#-系统要求)
- [部署模式](#-部署模式)
- [脚本套件](#-脚本套件)
- [文档索引](#-文档索引)
- [架构概览](#-架构概览)
- [故障排查](#-故障排查)
- [贡献指南](#-贡献指南)
- [许可证](#-许可证)

## 🚀 快速开始

### 一键部署

```bash
# 克隆仓库
git clone https://github.com/silktalk/silktalk-pro.git
cd silktalk-pro

# 一键部署（全自动模式）
./scripts/auto-deploy.sh

# 或带参数部署
./scripts/auto-deploy.sh -v latest -n 20 --mirror auto
```

### 分步部署

```bash
# 1. 环境检测
./scripts/check-env.sh

# 2. 安装系统依赖
./scripts/install-deps.sh

# 3. 安装 Node.js
./scripts/setup-node.sh --version 20

# 4. 部署项目
./scripts/deploy-silktalk.sh --version latest

# 5. 生成配置
./scripts/generate-config.sh

# 6. 验证安装
./scripts/verify-install.sh
```

## ✨ 系统特性

| 特性 | 描述 |
|------|------|
| **零失败** | 任何环境都能成功部署，自动适配各种限制 |
| **零交互** | 全自动完成，无需人工干预（可选） |
| **全诊断** | 问题自动识别和修复，内置故障诊断 |
| **可验证** | 部署结果可自动验证，生成详细报告 |
| **多平台** | 支持 Linux x64/arm64, Docker, WSL, 受限环境 |
| **多版本** | 支持 Node.js 多版本管理，自动选择最优版本 |
| **智能镜像** | 自动检测网络环境，选择最优镜像源 |
| **完整日志** | 全程记录日志，便于审计和故障排查 |

## 💻 系统要求

### 最低要求

- **操作系统**: Linux (内核 >= 4.0)
- **架构**: x64 或 arm64
- **内存**: 512MB RAM
- **磁盘**: 2GB 可用空间
- **网络**: 可访问互联网

### 推荐配置

- **操作系统**: Ubuntu 22.04 LTS / Debian 12 / CentOS 8
- **架构**: x64
- **内存**: 2GB RAM
- **磁盘**: 10GB 可用空间
- **网络**: 公网 IP 或内网穿透

### 支持环境

| 环境 | 支持状态 | 备注 |
|------|----------|------|
| Ubuntu 20.04+ | ✅ 完全支持 | 推荐 |
| Debian 11+ | ✅ 完全支持 | 推荐 |
| CentOS 7/8 | ✅ 完全支持 | 需 EPEL |
| Alpine Linux | ✅ 完全支持 | 容器环境 |
| Arch Linux | ✅ 完全支持 | 社区支持 |
| Docker | ✅ 完全支持 | 官方镜像 |
| WSL2 | ✅ 完全支持 | Windows 开发 |
| Kubernetes | ✅ 完全支持 | Helm Chart |
| 受限容器 | ✅ 适配支持 | 用户级安装 |

## 🔧 部署模式

| 模式 | 说明 | 使用场景 |
|------|------|----------|
| `auto` | 全自动，零交互 | CI/CD、批量部署 |
| `semi` | 半自动，关键确认 | 首次部署、生产环境 |
| `diagnose` | 仅检测，不部署 | 环境评估 |
| `repair` | 修复模式 | 问题修复 |

### 模式选择示例

```bash
# 全自动部署（推荐用于 CI/CD）
./scripts/auto-deploy.sh --mode auto

# 半自动部署（推荐用于生产环境）
./scripts/auto-deploy.sh --mode semi

# 仅诊断环境
./scripts/auto-deploy.sh --mode diagnose

# 修复模式
./scripts/auto-deploy.sh --mode repair
```

## 📦 脚本套件

```
scripts/
├── auto-deploy.sh          # 主入口 - 一键部署
├── check-env.sh            # 环境检测 - 全面扫描
├── install-deps.sh         # 依赖安装 - 自动适配
├── setup-node.sh           # Node.js 安装 - 多版本支持
├── deploy-silktalk.sh      # 项目部署 - 自动下载
├── generate-config.sh      # 配置生成 - 智能适配
├── verify-install.sh       # 安装验证 - 全面测试
├── troubleshoot.sh         # 故障诊断 - 自动修复
└── README.md               # 脚本文档
```

### 脚本详细说明

| 脚本 | 功能 | 返回值 |
|------|------|--------|
| `auto-deploy.sh` | 主入口，协调所有脚本 | 0=成功, 1=失败 |
| `check-env.sh` | 检测系统环境，生成报告 | 0=通过, 1=有问题 |
| `install-deps.sh` | 安装系统依赖 | 0=成功, 1=失败 |
| `setup-node.sh` | 安装/配置 Node.js | 0=成功, 1=失败 |
| `deploy-silktalk.sh` | 下载并部署项目 | 0=成功, 1=失败 |
| `generate-config.sh` | 生成配置文件 | 0=成功, 1=失败 |
| `verify-install.sh` | 验证部署结果 | 0=通过, 1=失败 |
| `troubleshoot.sh` | 诊断和修复问题 | 0=正常, >0=问题数 |

## 📚 文档索引

### 核心文档

| 文档 | 描述 |
|------|------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 系统架构设计 |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | 详细部署指南 |
| [TESTING.md](docs/TESTING.md) | 测试策略和用例 |
| [API.md](docs/API.md) | API 参考文档 |

### 运维文档

| 文档 | 描述 |
|------|------|
| [OPERATIONS.md](docs/OPERATIONS.md) | 运维手册 |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | 故障排查指南 |
| [SECURITY.md](docs/SECURITY.md) | 安全指南 |
| [NETWORK.md](docs/NETWORK.md) | 网络配置 |

### 开发文档

| 文档 | 描述 |
|------|------|
| [CMMI5_COMPLIANCE_INDEX.md](docs/CMMI5_COMPLIANCE_INDEX.md) | CMMI 5 合规索引 |
| [CHANGELOG.md](docs/CHANGELOG.md) | 版本变更历史 |
| [COMPATIBILITY.md](docs/COMPATIBILITY.md) | 兼容性矩阵 |

### 脚本文档

| 文档 | 描述 |
|------|------|
| [scripts/README.md](scripts/README.md) | 脚本概览 |
| [scripts/DEPLOYMENT.md](scripts/DEPLOYMENT.md) | 部署脚本指南 |
| [scripts/COMPATIBILITY.md](scripts/COMPATIBILITY.md) | 环境兼容性 |
| [scripts/TROUBLESHOOTING.md](scripts/TROUBLESHOOTING.md) | 脚本故障排查 |
| [scripts/DUAL_MACHINE_TEST.md](scripts/DUAL_MACHINE_TEST.md) | 双机测试指南 |

## 🏗️ 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│              (CLI, Bridge, User Applications)                │
├─────────────────────────────────────────────────────────────┤
│                    Protocol Layer                            │
│         (Message Protocol, Serialization, Encryption)        │
├─────────────────────────────────────────────────────────────┤
│                     Routing Layer                            │
│           (DHT, Peer Discovery, Content Routing)             │
├─────────────────────────────────────────────────────────────┤
│                     Network Layer                            │
│    (Transport Manager, Connection Manager, NAT Traversal)    │
├─────────────────────────────────────────────────────────────┤
│                      Core Layer                              │
│         (Node Lifecycle, Identity, Configuration)            │
└─────────────────────────────────────────────────────────────┘
```

### 部署架构

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  环境检测   │ -> │  依赖安装   │ -> │  项目部署   │
└─────────────┘    └─────────────┘    └─────────────┘
       |                   |                   |
       v                   v                   v
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  配置生成   │ -> │  服务启动   │ -> │  验证测试   │
└─────────────┘    └─────────────┘    └─────────────┘
```

## 🔍 故障排查

### 快速诊断

```bash
# 运行诊断脚本
./scripts/troubleshoot.sh

# 自动修复
./scripts/troubleshoot.sh --auto-fix
```

### 常见问题

| 问题 | 解决方案 |
|------|----------|
| 权限不足 | 使用 `sudo` 或选择用户级安装 |
| 端口占用 | 修改配置文件中的端口设置 |
| 网络受限 | 使用 `--mirror cn` 指定国内镜像 |
| 依赖缺失 | 运行 `./scripts/install-deps.sh` |

### 查看日志

```bash
# 部署日志
tail -f logs/deploy-*.log

# 应用日志
tail -f /usr/local/silktalk-pro/logs/app.log

# 系统日志
sudo journalctl -u silktalk -f
```

## 🤝 贡献指南

我们欢迎社区贡献！请查看以下文档：

- [CODING_STANDARDS.md](docs/process/CODING_STANDARDS.md) - 代码规范
- [CODE_REVIEW.md](docs/process/CODE_REVIEW.md) - 代码审查流程
- [GIT_WORKFLOW.md](docs/process/GIT_WORKFLOW.md) - Git 工作流

## 📄 许可证

[MIT](LICENSE) © SilkTalk Team

---

<p align="center">
  <strong>SilkTalk Pro</strong> - 企业级实时通信解决方案
</p>
