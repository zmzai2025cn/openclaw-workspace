# SilkTalk Pro 部署脚本详细指南

**版本**: 1.0.0  
**更新日期**: 2026-02-22  
**适用范围**: 自动化部署脚本套件

---

## 目录

1. [概述](#概述)
2. [系统要求](#系统要求)
3. [部署流程](#部署流程)
4. [详细配置](#详细配置)
5. [高级用法](#高级用法)
6. [集成 CI/CD](#集成-cicd)
7. [故障排查](#故障排查)
8. [性能优化](#性能优化)

---

## 概述

本文档提供 SilkTalk Pro 自动化部署脚本的详细使用指南，涵盖从基础部署到高级配置的所有内容。

### 文档目标

- 提供完整的部署操作指南
- 解释每个配置选项的含义
- 提供故障排查步骤
- 说明 CI/CD 集成方法

---

## 系统要求

### 硬件要求

| 资源 | 最低要求 | 推荐配置 |
|------|----------|----------|
| CPU | 1 核 | 2 核以上 |
| 内存 | 512MB | 2GB |
| 磁盘 | 2GB | 10GB SSD |
| 网络 | 1Mbps | 10Mbps |

### 软件要求

| 软件 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Linux 内核 | 4.0 | 5.0+ |
| Node.js | 18 | 20 |
| npm | 8 | 10 |
| bash | 4.0 | 5.0+ |

### 支持的操作系统

| 操作系统 | 版本 | 支持状态 |
|----------|------|----------|
| Ubuntu | 20.04, 22.04, 24.04 | ✅ 完全支持 |
| Debian | 11, 12 | ✅ 完全支持 |
| CentOS | 7, 8 | ✅ 完全支持 |
| Rocky Linux | 8, 9 | ✅ 完全支持 |
| Alpine | 3.16+ | ✅ 完全支持 |
| Arch | Rolling | ✅ 社区支持 |

---

## 部署流程

### 标准部署流程图

```
开始
  │
  ▼
┌─────────────────┐
│ 1. 环境检测     │ ◄── 生成环境报告
│ check-env.sh    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. 依赖安装     │ ◄── 自动适配包管理器
│ install-deps.sh │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. Node.js 安装 │ ◄── 多版本/多源支持
│ setup-node.sh   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. 项目部署     │ ◄── 下载/解压/构建
│ deploy-silktalk │
│     .sh         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. 配置生成     │ ◄── 智能适配环境
│ generate-config │
│     .sh         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 6. 安装验证     │ ◄── 全面测试
│ verify-install  │
│     .sh         │
└────────┬────────┘
         │
         ▼
      完成
```

### 部署时间估算

| 环境类型 | 预计时间 | 主要耗时环节 |
|----------|----------|--------------|
| 全新环境 | 5-10 分钟 | Node.js 安装、依赖下载 |
| 已安装 Node.js | 2-5 分钟 | 项目下载、依赖安装 |
| 仅更新项目 | 1-2 分钟 | 代码更新、构建 |

---

## 详细配置

### 部署模式详解

#### auto 模式（全自动）

```bash
./scripts/auto-deploy.sh --mode auto
```

**特点**:
- 零交互，适合 CI/CD
- 自动处理所有步骤
- 失败时自动退出

**适用场景**:
- 自动化测试环境
- 批量部署
- 容器镜像构建

#### semi 模式（半自动）

```bash
./scripts/auto-deploy.sh --mode semi
```

**特点**:
- 关键步骤需要确认
- 可审查每个阶段
- 适合生产环境

**确认点**:
1. 是否安装系统依赖？
2. 是否安装/升级 Node.js？
3. 是否部署项目？
4. 是否生成配置？

#### diagnose 模式（诊断）

```bash
./scripts/auto-deploy.sh --mode diagnose
```

**特点**:
- 仅检测环境
- 不执行任何修改
- 生成详细报告

**输出**:
- 环境检测报告
- 兼容性评估
- 部署建议

#### repair 模式（修复）

```bash
./scripts/auto-deploy.sh --mode repair
```

**特点**:
- 诊断并修复问题
- 自动执行修复操作
- 重新验证结果

### 镜像源配置

#### 自动检测

```bash
./scripts/auto-deploy.sh --mirror auto
```

系统自动检测网络环境：
- 中国大陆 → 使用国内镜像
- 其他地区 → 使用官方源

#### 手动指定

```bash
# 中国镜像（阿里云、npm 镜像）
./scripts/auto-deploy.sh --mirror cn

# 全球官方源
./scripts/auto-deploy.sh --mirror global
```

### 安装前缀配置

#### 系统级安装（默认）

```bash
./scripts/auto-deploy.sh --prefix /usr/local
```

**权限要求**: root 或 sudo
**安装位置**:
- 项目: `/usr/local/silktalk-pro`
- 命令: `/usr/local/bin/silktalk`
- 服务: `/etc/systemd/system/silktalk.service`

#### 用户级安装

```bash
./scripts/auto-deploy.sh --prefix ~/.local
```

**权限要求**: 无
**安装位置**:
- 项目: `~/.local/silktalk-pro`
- 命令: `~/.local/bin/silktalk`

---

## 高级用法

### 版本指定

#### 指定 SilkTalk 版本

```bash
# 最新版本
./scripts/auto-deploy.sh --version latest

# 指定版本
./scripts/auto-deploy.sh --version 1.2.0

# 预发布版本
./scripts/auto-deploy.sh --version 1.3.0-beta.1
```

#### 指定 Node.js 版本

```bash
# Node.js 20 (默认)
./scripts/auto-deploy.sh --node 20

# Node.js 18 (LTS)
./scripts/auto-deploy.sh --node 18

# Node.js 22 (最新)
./scripts/auto-deploy.sh --node 22
```

### 强制重新安装

```bash
# 强制重新部署（覆盖现有安装）
./scripts/auto-deploy.sh --force

# 强制重新安装 Node.js
./scripts/setup-node.sh --force
```

### 跳过验证

```bash
# 跳过安装验证（加快部署）
./scripts/auto-deploy.sh --skip-verify

# 注意：生产环境不建议跳过验证
```

### 详细日志

```bash
# 启用详细输出
./scripts/auto-deploy.sh --verbose

# 查看实时日志
tail -f logs/deploy-*.log
```

---

## 集成 CI/CD

### GitHub Actions

```yaml
name: Deploy SilkTalk Pro

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy SilkTalk Pro
        run: |
          ./scripts/auto-deploy.sh \
            --mode auto \
            --version latest \
            --node 20 \
            --verbose
      
      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: deploy-reports
          path: reports/
```

### GitLab CI

```yaml
deploy:
  stage: deploy
  image: ubuntu:22.04
  before_script:
    - apt-get update && apt-get install -y curl git
  script:
    - ./scripts/auto-deploy.sh --mode auto --verbose
  artifacts:
    paths:
      - reports/
```

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Deploy') {
            steps {
                sh './scripts/auto-deploy.sh --mode auto --verbose'
            }
        }
        stage('Archive Reports') {
            steps {
                archiveArtifacts artifacts: 'reports/*.md'
            }
        }
    }
}
```

### Docker 集成

```dockerfile
FROM ubuntu:22.04

COPY . /app
WORKDIR /app

RUN ./scripts/auto-deploy.sh \
    --mode auto \
    --prefix /usr/local \
    --skip-verify

EXPOSE 3000 3001

CMD ["silktalk"]
```

---

## 故障排查

### 日志位置

| 日志类型 | 位置 |
|----------|------|
| 部署日志 | `logs/deploy-YYYYmmdd-HHMMSS.log` |
| 环境报告 | `reports/env-report-*.md` |
| 验证报告 | `reports/verify-report-*.md` |
| 应用日志 | `/usr/local/silktalk-pro/logs/app.log` |

### 常见问题

#### Q1: 权限被拒绝

**症状**:
```
mkdir: cannot create directory '/usr/local/silktalk-pro': Permission denied
```

**解决方案**:
```bash
# 方案 1: 使用 sudo
sudo ./scripts/auto-deploy.sh

# 方案 2: 用户级安装
./scripts/auto-deploy.sh --prefix ~/.local
```

#### Q2: Node.js 下载失败

**症状**:
```
curl: (28) Connection timed out
```

**解决方案**:
```bash
# 使用国内镜像
./scripts/auto-deploy.sh --mirror cn

# 或使用代理
export HTTP_PROXY=http://proxy.example.com:8080
./scripts/auto-deploy.sh
```

#### Q3: 端口被占用

**症状**:
```
Port 3000 is already in use
```

**解决方案**:
```bash
# 查找占用进程
lsof -i:3000

# 终止进程
kill -15 <PID>

# 或修改配置
./scripts/generate-config.sh  # 生成新配置，自动选择可用端口
```

#### Q4: 依赖安装失败

**症状**:
```
npm ERR! code ECONNREFUSED
```

**解决方案**:
```bash
# 清除 npm 缓存
npm cache clean --force

# 使用国内镜像
npm config set registry https://registry.npmmirror.com

# 重新安装
./scripts/deploy-silktalk.sh --force
```

### 诊断流程

```
遇到问题
    │
    ▼
┌─────────────────┐
│ 1. 查看部署日志  │
│ logs/deploy-*.log│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. 运行诊断脚本  │
│ troubleshoot.sh │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. 查看验证报告  │
│ reports/verify-*.md│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. 尝试自动修复  │
│ troubleshoot.sh │
│   --auto-fix    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. 手动修复或    │
│ 寻求支持         │
└─────────────────┘
```

---

## 性能优化

### 部署速度优化

| 优化项 | 方法 | 效果 |
|--------|------|------|
| 缓存 Node.js | 预安装 Node.js | 节省 2-3 分钟 |
| 使用镜像 | `--mirror cn` | 节省 1-2 分钟 |
| 跳过验证 | `--skip-verify` | 节省 30 秒 |
| 并行下载 | 使用 pnpm | 节省 30-50% |

### 资源优化

```bash
# 限制内存使用
export NODE_OPTIONS="--max-old-space-size=1024"

# 限制并发连接
./scripts/auto-deploy.sh --max-connections 10
```

---

## 附录

### A. 完整参数参考

```bash
./scripts/auto-deploy.sh \
  --mode auto \              # 部署模式
  --version latest \         # SilkTalk 版本
  --node 20 \                # Node.js 版本
  --prefix /usr/local \      # 安装前缀
  --mirror auto \            # 镜像源
  --skip-verify \            # 跳过验证
  --force \                  # 强制重装
  --verbose                   # 详细输出
```

### B. 环境变量

| 变量 | 说明 |
|------|------|
| `HTTP_PROXY` | HTTP 代理 |
| `HTTPS_PROXY` | HTTPS 代理 |
| `NO_PROXY` | 代理排除列表 |
| `NODE_OPTIONS` | Node.js 选项 |
| `NPM_CONFIG_REGISTRY` | npm 镜像源 |

### C. 相关文档

- [README.md](README.md) - 脚本概览
- [COMPATIBILITY.md](COMPATIBILITY.md) - 兼容性矩阵
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - 故障排查
- [DUAL_MACHINE_TEST.md](DUAL_MACHINE_TEST.md) - 双机测试

---

**文档版本**: 1.0.0  
**最后更新**: 2026-02-22  
**维护者**: SilkTalk Team
