# SilkTalk Pro 部署脚本套件文档

**版本**: 1.0.0  
**更新日期**: 2026-02-22  
**作者**: SilkTalk Team

---

## 目录

1. [概述](#概述)
2. [脚本架构](#脚本架构)
3. [使用指南](#使用指南)
4. [脚本详解](#脚本详解)
5. [配置参考](#配置参考)
6. [故障排查](#故障排查)

---

## 概述

SilkTalk Pro 部署脚本套件是一套企业级自动化部署解决方案，旨在实现：

- **零失败部署**: 任何环境都能成功部署
- **零交互部署**: 全自动完成，无需人工干预
- **全诊断能力**: 问题自动识别和修复
- **可验证结果**: 部署结果可自动验证

### 设计目标

| 目标 | 说明 |
|------|------|
| 可靠性 | 99.9% 的部署成功率 |
| 兼容性 | 支持所有主流 Linux 发行版 |
| 可维护性 | 模块化设计，易于扩展 |
| 可观测性 | 完整的日志和报告 |

---

## 脚本架构

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     auto-deploy.sh                          │
│                    (主入口/协调器)                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
    ┌───────────────────┼───────────────────┐
    │                   │                   │
    v                   v                   v
┌─────────┐      ┌─────────┐      ┌─────────────┐
│check-env│      │install- │      │  setup-     │
│  .sh    │      │ deps.sh │      │  node.sh    │
└────┬────┘      └────┬────┘      └──────┬──────┘
     │                │                  │
     └────────────────┼──────────────────┘
                      │
                      v
            ┌─────────────────┐
            │ deploy-silktalk │
            │     .sh         │
            └────────┬────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        v            v            v
   ┌────────┐  ┌──────────┐  ┌──────────┐
   │generate│  │ verify-  │  │troubleshoot│
   │-config │  │ install  │  │   .sh     │
   │ .sh    │  │  .sh     │  │           │
   └────────┘  └──────────┘  └──────────┘
```

### 数据流

```
输入参数 -> 环境检测 -> 依赖安装 -> Node.js安装 -> 项目部署 -> 配置生成 -> 验证测试 -> 报告输出
    │           │           │           │           │           │           │
    v           v           v           v           v           v           v
  命令行     系统信息    包管理器    版本管理    下载解压    配置文件    功能测试    Markdown
  参数解析   资源检测    自动适配    多源支持    自动构建    智能生成    性能测试    报告生成
```

---

## 使用指南

### 快速开始

```bash
# 1. 进入脚本目录
cd scripts/

# 2. 一键部署
./auto-deploy.sh

# 3. 查看帮助
./auto-deploy.sh --help
```

### 命令行参数

#### auto-deploy.sh

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--mode` | `-m` | 部署模式 | `auto` |
| `--version` | `-v` | SilkTalk 版本 | `latest` |
| `--node` | `-n` | Node.js 版本 | `20` |
| `--prefix` | `-p` | 安装前缀 | `/usr/local` |
| `--mirror` | | 镜像源 | `auto` |
| `--skip-verify` | | 跳过验证 | `false` |
| `--force` | | 强制重装 | `false` |
| `--verbose` | | 详细输出 | `false` |
| `--help` | `-h` | 显示帮助 | |

#### 使用示例

```bash
# 全自动部署
./auto-deploy.sh

# 半自动模式（关键步骤确认）
./auto-deploy.sh --mode semi

# 仅诊断环境
./auto-deploy.sh --mode diagnose

# 指定版本部署
./auto-deploy.sh --version 1.2.0 --node 18

# 使用中国镜像
./auto-deploy.sh --mirror cn

# 用户级安装
./auto-deploy.sh --prefix ~/.local

# 详细日志输出
./auto-deploy.sh --verbose
```

---

## 脚本详解

### 1. auto-deploy.sh - 主入口脚本

**功能**: 协调所有子脚本，执行完整部署流程

**流程**:
```
1. 初始化日志系统
2. 解析命令行参数
3. 执行环境检测 (check-env.sh)
4. 安装系统依赖 (install-deps.sh)
5. 安装 Node.js (setup-node.sh)
6. 部署项目 (deploy-silktalk.sh)
7. 生成配置 (generate-config.sh)
8. 验证安装 (verify-install.sh)
9. 生成最终报告
```

**返回值**:
- `0` - 部署成功
- `1` - 部署失败
- `2` - 环境不兼容
- `3` - 依赖安装失败

---

### 2. check-env.sh - 环境检测脚本

**功能**: 全面扫描系统环境，生成兼容性报告

**检测项**:

| 类别 | 检测内容 |
|------|----------|
| 操作系统 | 发行版、版本、内核、架构 |
| 容器环境 | Docker、WSL、LXC 检测 |
| Node.js | 版本、路径、兼容性 |
| 网络 | 连通性、DNS、区域、端口 |
| 资源 | CPU、内存、磁盘 |
| 依赖 | 基础工具、构建工具 |
| 权限 | root、sudo、写入权限 |
| 防火墙 | 状态、类型 |

**输出**:
- 控制台彩色输出
- Markdown 检测报告 (`reports/env-report-*.md`)

---

### 3. install-deps.sh - 依赖安装脚本

**功能**: 自动检测并安装系统依赖

**支持的包管理器**:

| 包管理器 | 发行版 |
|----------|--------|
| `apt` | Ubuntu, Debian |
| `yum` | CentOS 7 |
| `dnf` | CentOS 8+, Fedora |
| `pacman` | Arch Linux |
| `apk` | Alpine Linux |
| `zypper` | openSUSE |

**安装内容**:
- 基础工具: curl, wget, git, tar, unzip
- 构建工具: make, gcc, g++, python3
- Node.js 编译依赖: libssl-dev, zlib-dev 等

---

### 4. setup-node.sh - Node.js 安装脚本

**功能**: 安装和配置 Node.js

**特性**:
- 多版本支持 (16, 18, 20, 22)
- 多源安装 (官方源、国内镜像)
- 自动架构检测 (x64, arm64)
- 用户级安装支持

**安装方法**:

| 方法 | 场景 |
|------|------|
| 二进制安装 | 有 root 权限，推荐 |
| nvm 安装 | 需要版本切换 |
| fnm 安装 | 快速版本切换 |
| 用户级安装 | 无 root 权限 |

---

### 5. deploy-silktalk.sh - 项目部署脚本

**功能**: 下载、安装、配置 SilkTalk Pro

**部署流程**:
```
1. 检查现有安装
2. 下载发布包/Git 克隆
3. 解压到安装目录
4. 安装项目依赖
5. 构建项目
6. 创建启动脚本
7. 创建 systemd 服务
```

**安装位置**:
- 默认: `/usr/local/silktalk-pro`
- 用户级: `~/.local/silktalk-pro`

---

### 6. generate-config.sh - 配置生成脚本

**功能**: 根据环境自动生成配置文件

**生成配置**:

| 配置 | 说明 |
|------|------|
| `silktalk.config.json` | 主配置文件 |
| `.env` | 环境变量配置 |
| `nginx.conf` | Nginx 反向代理配置 |
| `Dockerfile` | Docker 镜像配置 |
| `docker-compose.yml` | Docker Compose 配置 |
| `silktalk.config.dev.json` | 开发环境配置 |

---

### 7. verify-install.sh - 安装验证脚本

**功能**: 全面验证部署结果

**验证项**:

| 类别 | 检查内容 |
|------|----------|
| 文件完整性 | 关键文件和目录 |
| 依赖 | node_modules 和关键包 |
| 配置 | JSON 格式和关键项 |
| 服务 | 启动脚本和 systemd |
| 网络 | 端口占用和防火墙 |
| 功能 | Node.js 运行和语法 |
| 性能 | 内存和磁盘空间 |

**输出**:
- Markdown 验证报告 (`reports/verify-report-*.md`)

---

### 8. troubleshoot.sh - 故障诊断脚本

**功能**: 自动识别问题并提供修复建议

**诊断项**:
- Node.js 状态
- 项目依赖
- 端口占用
- 权限问题
- 网络连接
- 服务状态
- 日志分析

**使用**:
```bash
# 诊断模式
./troubleshoot.sh

# 自动修复模式
./troubleshoot.sh --auto-fix
```

---

## 配置参考

### 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `NODE_ENV` | 运行环境 | `production` |
| `SILKTALK_HTTP_PORT` | HTTP 端口 | `3000` |
| `SILKTALK_WS_PORT` | WebSocket 端口 | `3001` |
| `SILKTALK_JWT_SECRET` | JWT 密钥 | `[随机生成]` |
| `SILKTALK_LOG_LEVEL` | 日志级别 | `info` |

### 配置文件结构

```
configs/
├── silktalk.config.json      # 主配置
├── silktalk.config.dev.json  # 开发配置
├── .env                      # 环境变量
├── nginx.conf                # Nginx 配置
├── Dockerfile                # Docker 配置
└── docker-compose.yml        # Compose 配置
```

---

## 故障排查

### 错误码对照表

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| `E001` | Node.js 未安装 | 运行 `setup-node.sh` |
| `E002` | 端口被占用 | 修改配置或终止占用进程 |
| `E003` | 权限不足 | 使用 sudo 或用户级安装 |
| `E004` | 网络受限 | 使用 `--mirror cn` |
| `E005` | 依赖安装失败 | 检查包管理器配置 |

### 诊断命令

```bash
# 检查 Node.js
node --version
npm --version

# 检查端口
netstat -tuln | grep 3000
lsof -i:3000

# 检查服务
systemctl status silktalk
sudo journalctl -u silktalk -f

# 查看日志
tail -f /usr/local/silktalk-pro/logs/app.log
```

### 常见修复

```bash
# 重新安装依赖
cd /usr/local/silktalk-pro && rm -rf node_modules && npm install

# 修复权限
sudo chown -R $(whoami) /usr/local/silktalk-pro

# 重启服务
sudo systemctl restart silktalk

# 完整重新部署
./scripts/auto-deploy.sh --force
```

---

## 附录

### A. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-02-22 | 初始版本 |

### B. 相关文档

- [DEPLOYMENT.md](DEPLOYMENT.md) - 详细部署指南
- [COMPATIBILITY.md](COMPATIBILITY.md) - 兼容性矩阵
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - 故障排查
- [DUAL_MACHINE_TEST.md](DUAL_MACHINE_TEST.md) - 双机测试

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-22  
**维护者**: SilkTalk Team
