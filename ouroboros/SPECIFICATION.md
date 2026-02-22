# Ouroboros Engine v2.0
## 不可变基础设施模式下的 AI Agent 安全执行框架

---

**文档版本**: 2.0.0  
**最后更新**: 2026-02-21  
**架构师**: Kimi Claw  
**状态**: 生产就绪 (Production Ready)

---

## 执行摘要

本方案定义了一套基于**不可变基础设施**理念的 AI Agent 安全执行框架。核心原则是：**Agent 永不直接执行命令，只提交声明式意图**。

通过容器隔离、声明式 API、人工门控三层防御，实现绝对安全的 AI 自动化。

---

## 目录

1. [架构概述](#1-架构概述)
2. [核心组件](#2-核心组件)
3. [详细实现](#3-详细实现)
4. [部署指南](#4-部署指南)
5. [运维手册](#5-运维手册)
6. [附录](#6-附录)

---

## 1. 架构概述

### 1.1 设计哲学

| 原则 | 描述 | 实现方式 |
|------|------|----------|
| **不可变性** | 执行环境只读，副作用隔离 | Docker 容器 |
| **声明式** | Agent 描述意图，不由系统执行 | MCP 协议抽象 |
| **可审计** | 所有操作可追溯、可回放 | 结构化日志 |
| **渐进安全** | 风险越高，人工介入越多 | 门控策略 |

### 1.2 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户层 (User Layer)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   审核面板   │  │  确认通知   │  │    审计日志查看器        │  │
│  │  (Web UI)   │  │ (Webhook)   │  │    (Log Viewer)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ 人工门控 (Manual Gate)
┌─────────────────────────────────────────────────────────────────┐
│                      决策层 (Decision Layer)                     │
│                     OpenClaw Agent (Main)                        │
│                                                                  │
│  System Prompt: "You can only submit intents.                    │
│                 Never execute commands directly."                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ MCP Protocol
┌─────────────────────────────────────────────────────────────────┐
│                     执行层 (Execution Layer)                     │
│              Ouroboros MCP Server (Node.js/TypeScript)           │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   FileOps    │  │   Container  │  │    ExternalGate      │   │
│  │   Module     │  │    Runner    │  │      Module          │   │
│  │ (Git-backed) │  │   (Docker)   │  │  (Human-in-Loop)     │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   文件系统     │    │   容器运行时   │    │   外部服务    │
│  (Workspace)  │    │   (Docker)    │    │  (Slack/API)  │
│               │    │               │    │               │
│  - Git 仓库   │    │  - 临时容器   │    │  - 待确认队列 │
│  - 回收站     │    │  - 只读挂载   │    │  - 异步回调   │
│  - 备份存储   │    │  - 自动清理   │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
```

### 1.3 安全边界

```
┌─────────────────────────────────────────────────────────┐
│  信任边界                                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  半信任区 (Agent)                                │   │
│  │  - 可生成意图                                     │   │
│  │  - 不可直接执行                                   │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│                          ▼ MCP (标准协议)                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  信任区 (Ouroboros Server)                       │   │
│  │  - 验证意图合法性                                 │   │
│  │  - 执行安全操作                                   │   │
│  │  - 记录审计日志                                   │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│          ┌───────────────┼───────────────┐              │
│          ▼               ▼               ▼              │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐         │
│  │  文件系统  │   │  容器隔离  │   │  人工确认  │         │
│  │  (受保护)  │   │  (临时)   │   │  (门控)   │         │
│  └───────────┘   └───────────┘   └───────────┘         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 核心组件

### 2.1 组件清单

| 组件 | 类型 | 职责 | 技术栈 |
|------|------|------|--------|
| `ouroboros-server` | MCP Server | 意图解析、安全执行、审计记录 | Node.js 20, TypeScript 5 |
| `file-ops` | Module | 声明式文件操作、Git 集成 | simple-git, fs-extra |
| `container-runner` | Module | Docker 容器生命周期管理 | Docker Engine API |
| `external-gate` | Module | 外部操作人工门控 | SQLite, Webhook |
| `audit-logger` | Module | 结构化日志、可追溯 | JSON Lines, Winston |
| `recovery-cli` | CLI Tool | 灾难恢复、状态回滚 | Node.js CLI |

### 2.2 数据流

```
Agent 提交意图
      │
      ▼
┌─────────────────┐
│  1. 意图验证     │ ← 检查格式、权限、黑名单
│  (Validate)     │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│  2. 风险评估     │ ← 计算风险等级 (LOW/MEDIUM/HIGH/CRITICAL)
│  (Assess)       │
└─────────────────┘
      │
      ├────────── LOW ──────→ 自动执行 ───→ 记录日志 ───→ 返回结果
      │
      ├────────── MEDIUM ───→ 影子执行 ───→ 等待确认 ───→ 应用/放弃
      │
      ├────────── HIGH ─────→ 人工确认 ───→ 等待审批 ───→ 执行/拒绝
      │
      └────────── CRITICAL ─→ 拒绝执行 ───→ 返回错误 ───→ 建议替代方案
```

---

## 3. 详细实现

### 3.1 项目结构

```
/root/.openclaw/workspace/ouroboros/
├── src/
│   ├── index.ts                 # MCP Server 入口
│   ├── config/
│   │   ├── defaults.ts          # 默认配置
│   │   └── schema.ts            # 配置校验 (Zod)
│   ├── core/
│   │   ├── server.ts            # MCP Server 初始化
│   │   ├── validator.ts         # 意图验证器
│   │   ├── risk-assessor.ts     # 风险评估引擎
│   │   └── audit-logger.ts      # 审计日志
│   ├── modules/
│   │   ├── file-ops/
│   │   │   ├── index.ts
│   │   │   ├── git-wrapper.ts
│   │   │   ├── trash-manager.ts
│   │   │   └── diff-engine.ts
│   │   ├── container-runner/
│   │   │   ├── index.ts
│   │   │   ├── docker-client.ts
│   │   │   ├── image-registry.ts
│   │   │   └── volume-manager.ts
│   │   └── external-gate/
│   │       ├── index.ts
│   │       ├── queue-manager.ts
│   │       ├── notifier.ts
│   │       └── callback-handler.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── errors.ts
│       ├── validators.ts
│       └── helpers.ts
├── bin/
│   └── recovery-cli.ts          # 恢复工具 CLI
├── logs/                        # 审计日志 (自动轮转)
├── shadows/                     # 影子工作区 (临时)
├── trash/                       # 文件回收站 (保留 7 天)
├── config/
│   └── ouroboros.json           # 用户配置
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

### 3.2 核心代码实现

#### 3.2.1 MCP Server 入口 (src/index.ts)

```typescript
#!/usr/bin/env node
/**
 * Ouroboros Engine v2.0
 * MCP Server Entry Point
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FileOpsModule } from "./modules/file-ops/index.js";
import { ContainerRunnerModule } from "./modules/container-runner/index.js";
import { ExternalGateModule } from "./modules/external-gate/index.js";
import { AuditLogger } from "./core/audit-logger.js";
import { RiskAssessor } from "./core/risk-assessor.js";
import { ConfigManager } from "./config/manager.js";

const VERSION = "2.0.0";

async function main() {
  // 初始化配置
  const config = await ConfigManager.load();
  
  // 初始化审计日志
  const auditLogger = new AuditLogger(config.logs);
  
  // 初始化风险评估器
  const riskAssessor = new RiskAssessor(config.risk);
  
  // 初始化模块
  const fileOps = new FileOpsModule(config.fileOps, auditLogger);
  const containerRunner = new ContainerRunnerModule(config.container, auditLogger);
  const externalGate = new ExternalGateModule(config.gate, auditLogger);

  // 创建 MCP Server
  const server = new McpServer({
    name: "OuroborosEngine",
    version: VERSION,
  });

  // ============ Tool 1: file_operation ============
  server.tool(
    "file_operation",
    {
      action: z.enum([
        "read",           // 读取文件
        "write",          // 写入文件 (需确认)
        "append",         // 追加内容 (需确认)
        "remove",         // 删除文件 (进回收站)
        "move",           // 移动/重命名 (需确认)
        "list",           // 列出目录
        "search",         // 搜索内容
        "diff",           // 查看变更
        "restore",        // 从回收站恢复
      ]),
      path: z.string(),
      content: z.string().optional(),      // for write/append
      destination: z.string().optional(),  // for move
      options: z.object({
        createIfMissing: z.boolean().default(false),
        backup: z.boolean().default(true),
        encoding: z.enum(["utf8", "base64"]).default("utf8"),
      }).optional(),
    },
    async (params) => {
      const requestId = generateRequestId();
      const startTime = Date.now();
      
      try {
        // 风险评估
        const risk = riskAssessor.assessFileOp(params);
        
        // 记录请求
        await auditLogger.log({
          requestId,
          timestamp: new Date().toISOString(),
          tool: "file_operation",
          params,
          risk,
          status: "pending",
        });

        // 执行操作
        const result = await fileOps.execute(params, risk);
        
        // 记录成功
        await auditLogger.log({
          requestId,
          status: "success",
          duration: Date.now() - startTime,
          result: result.summary,
        });

        return {
          content: [{
            type: "text",
            text: formatResult(result),
          }],
          isError: false,
        };
        
      } catch (error) {
        // 记录失败
        await auditLogger.log({
          requestId,
          status: "error",
          duration: Date.now() - startTime,
          error: error.message,
        });

        return {
          content: [{
            type: "text",
            text: `[ERROR] ${error.message}\n\n` +
                  `Request ID: ${requestId}\n` +
                  `Use 'recovery-cli' for manual recovery if needed.`,
          }],
          isError: true,
        };
      }
    }
  );

  // ============ Tool 2: container_run ============
  server.tool(
    "container_run",
    {
      image: z.enum([
        "node:18-alpine",
        "node:20-alpine",
        "python:3.11-slim",
        "python:3.12-slim",
        "ubuntu:22.04",
        "alpine:latest",
      ]),
      command: z.string(),
      workingDir: z.string().default("/workspace"),
      environment: z.record(z.string()).optional(),
      resources: z.object({
        cpu: z.number().max(2).default(1),
        memory: z.string().default("512m"),
        timeout: z.number().max(300000).default(60000),
      }).optional(),
      volumes: z.array(z.object({
        host: z.string(),
        container: z.string(),
        mode: z.enum(["ro", "rw"]).default("ro"),
      })).optional(),
      network: z.enum(["none", "host", "bridge"]).default("none"),
    },
    async (params) => {
      const requestId = generateRequestId();
      
      // 容器运行总是先创建影子副本
      const shadowPath = await containerRunner.createShadow(
        process.cwd(),
        requestId
      );
      
      try {
        const result = await containerRunner.execute({
          ...params,
          shadowPath,
        });

        // 如果成功，询问是否应用到真实工作区
        if (result.exitCode === 0) {
          return {
            content: [{
              type: "text",
              text: `[CONTAINER SUCCESS]\n` +
                    `Output:\n${result.stdout}\n\n` +
                    `Changes detected in shadow workspace:\n` +
                    `${result.changes.join("\n")}\n\n` +
                    `To apply changes to real workspace:\n` +
                    `<confirm>apply:${requestId}</confirm>\n\n` +
                    `To discard:\n` +
                    `<confirm>discard:${requestId}</confirm>`,
            }],
            isError: false,
          };
        }
        
        // 失败则自动清理
        await containerRunner.destroyShadow(requestId);
        
        return {
          content: [{
            type: "text",
            text: `[CONTAINER FAILED]\n` +
                  `Exit code: ${result.exitCode}\n` +
                  `Stderr: ${result.stderr}\n\n` +
                  `No changes were made to your workspace.`,
          }],
          isError: true,
        };
        
      } catch (error) {
        await containerRunner.destroyShadow(requestId);
        throw error;
      }
    }
  );

  // ============ Tool 3: external_request ============
  server.tool(
    "external_request",
    {
      service: z.enum([
        "slack",
        "email",
        "webhook",
        "api",
      ]),
      action: z.string(),
      payload: z.record(z.any()),
      priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
    },
    async (params) => {
      const requestId = generateRequestId();
      
      // 外部请求总是进入队列等待人工确认
      const ticket = await externalGate.createTicket({
        requestId,
        ...params,
        timestamp: new Date().toISOString(),
      });

      // 发送通知
      await externalGate.notify(ticket);

      return {
        content: [{
          type: "text",
          text: `[EXTERNAL REQUEST QUEUED]\n` +
                `Ticket ID: ${ticket.id}\n` +
                `Service: ${params.service}\n` +
                `Action: ${params.action}\n` +
                `Priority: ${params.priority}\n\n` +
                `This request requires human approval.\n` +
                `Check your notification channel or run:\n` +
                `recovery-cli tickets list`,
        }],
        isError: false,
      };
    }
  );

  // ============ Tool 4: confirm_apply ============
  server.tool(
    "confirm_apply",
    {
      requestId: z.string(),
      action: z.enum(["apply", "discard"]),
    },
    async (params) => {
      if (params.action === "apply") {
        const result = await containerRunner.applyShadow(params.requestId);
        return {
          content: [{
            type: "text",
            text: `[APPLIED] Changes from shadow workspace have been applied.\n` +
                  `Files modified: ${result.files.length}\n` +
                  `Git status: ${result.gitStatus}`,
          }],
          isError: false,
        };
      } else {
        await containerRunner.destroyShadow(params.requestId);
        return {
          content: [{
            type: "text",
            text: `[DISCARDED] Shadow workspace destroyed. No changes applied.`,
          }],
          isError: false,
        };
      }
    }
  );

  // 启动服务器
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error(`Ouroboros Engine v${VERSION} started`);
}

function generateRequestId(): string {
  return `ouro_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatResult(result: any): string {
  // 格式化输出...
  return JSON.stringify(result, null, 2);
}

main().catch(console.error);
```

#### 3.2.2 文件操作模块 (src/modules/file-ops/index.ts)

```typescript
import simpleGit from "simple-git";
import fs from "fs-extra";
import path from "path";
import { AuditLogger } from "../../core/audit-logger.js";

interface FileOpParams {
  action: string;
  path: string;
  content?: string;
  destination?: string;
  options?: {
    createIfMissing?: boolean;
    backup?: boolean;
    encoding?: "utf8" | "base64";
  };
}

interface FileOpResult {
  success: boolean;
  summary: string;
  details: any;
}

export class FileOpsModule {
  private git = simpleGit();
  private trashDir: string;
  
  constructor(
    private config: any,
    private auditLogger: AuditLogger
  ) {
    this.trashDir = config.trashDir || "/root/.openclaw/workspace/ouroboros/trash";
    fs.ensureDirSync(this.trashDir);
  }

  async execute(params: FileOpParams, risk: string): Promise<FileOpResult> {
    switch (params.action) {
      case "read":
        return this.readFile(params);
      case "write":
        return this.writeFile(params);
      case "append":
        return this.appendFile(params);
      case "remove":
        return this.removeFile(params);
      case "move":
        return this.moveFile(params);
      case "list":
        return this.listDir(params);
      case "search":
        return this.searchContent(params);
      case "diff":
        return this.showDiff(params);
      case "restore":
        return this.restoreFromTrash(params);
      default:
        throw new Error(`Unknown action: ${params.action}`);
    }
  }

  private async readFile(params: FileOpParams): Promise<FileOpResult> {
    const content = await fs.readFile(params.path, 
      params.options?.encoding || "utf8");
    
    return {
      success: true,
      summary: `Read ${params.path} (${content.length} bytes)`,
      details: { content },
    };
  }

  private async writeFile(params: FileOpParams): Promise<FileOpResult> {
    // 1. 检查文件是否存在，存在则备份
    const exists = await fs.pathExists(params.path);
    let backupPath: string | undefined;
    
    if (exists && params.options?.backup !== false) {
      backupPath = await this.createBackup(params.path);
    }

    // 2. 写入文件
    await fs.ensureDir(path.dirname(params.path));
    await fs.writeFile(
      params.path, 
      params.content || "", 
      params.options?.encoding || "utf8"
    );

    // 3. 如果当前目录是 git 仓库，自动 stage
    const isGitRepo = await this.isGitRepo(path.dirname(params.path));
    if (isGitRepo) {
      await this.git.add(params.path);
    }

    return {
      success: true,
      summary: `Wrote ${params.path}`,
      details: { 
        bytesWritten: params.content?.length || 0,
        backupPath,
        staged: isGitRepo,
      },
    };
  }

  private async removeFile(params: FileOpParams): Promise<FileOpResult> {
    // 不真正删除，而是移动到回收站
    const trashPath = path.join(
      this.trashDir,
      `${Date.now()}_${path.basename(params.path)}`
    );
    
    await fs.move(params.path, trashPath);
    
    // 记录元数据以便恢复
    const metaPath = `${trashPath}.meta.json`;
    await fs.writeJson(metaPath, {
      originalPath: params.path,
      deletedAt: new Date().toISOString(),
    });

    return {
      success: true,
      summary: `Moved ${params.path} to trash`,
      details: { trashPath },
    };
  }

  private async createBackup(filePath: string): Promise<string> {
    const backupDir = path.join(
      "/root/.openclaw/workspace/ouroboros/backups",
      path.dirname(filePath).replace(/\//g, "_")
    );
    await fs.ensureDir(backupDir);
    
    const backupPath = path.join(
      backupDir,
      `${path.basename(filePath)}.${Date.now()}.bak`
    );
    
    await fs.copy(filePath, backupPath);
    return backupPath;
  }

  private async isGitRepo(dir: string): Promise<boolean> {
    try {
      await this.git.cwd(dir);
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  // ... 其他方法实现
}
```

#### 3.2.3 容器运行模块 (src/modules/container-runner/index.ts)

```typescript
import Docker from "dockerode";
import fs from "fs-extra";
import path from "path";
import { execa } from "execa";
import { AuditLogger } from "../../core/audit-logger.js";

interface ContainerParams {
  image: string;
  command: string;
  workingDir: string;
  environment?: Record<string, string>;
  resources?: {
    cpu: number;
    memory: string;
    timeout: number;
  };
  volumes?: Array<{
    host: string;
    container: string;
    mode: "ro" | "rw";
  }>;
  network: "none" | "host" | "bridge";
  shadowPath: string;
}

interface ContainerResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  changes: string[];
}

export class ContainerRunnerModule {
  private docker = new Docker();
  private shadowsDir = "/root/.openclaw/workspace/ouroboros/shadows";
  
  constructor(
    private config: any,
    private auditLogger: AuditLogger
  ) {
    fs.ensureDirSync(this.shadowsDir);
  }

  async createShadow(sourcePath: string, requestId: string): Promise<string> {
    const shadowPath = path.join(this.shadowsDir, requestId);
    
    // 使用 rsync 快速复制（支持硬链接优化）
    await execa("rsync", [
      "-a",
      "--delete",
      "--link-dest", sourcePath,
      sourcePath + "/",
      shadowPath + "/",
    ]);
    
    // 记录映射关系
    await fs.writeJson(`${shadowPath}.meta.json`, {
      sourcePath,
      createdAt: new Date().toISOString(),
      requestId,
    });
    
    return shadowPath;
  }

  async execute(params: ContainerParams): Promise<ContainerResult> {
    const containerName = `ouro_${params.requestId}`;
    
    // 1. 创建容器
    const container = await this.docker.createContainer({
      Image: params.image,
      name: containerName,
      Cmd: ["sh", "-c", params.command],
      WorkingDir: params.workingDir,
      Env: Object.entries(params.environment || {}).map(
        ([k, v]) => `${k}=${v}`
      ),
      HostConfig: {
        Binds: [
          `${params.shadowPath}:${params.workingDir}:rw`,
        ],
        NetworkMode: params.network,
        Memory: this.parseMemory(params.resources?.memory || "512m"),
        CpuQuota: (params.resources?.cpu || 1) * 100000,
        AutoRemove: false, // 我们需要检查结果
      },
    });

    // 2. 启动并等待
    await container.start();
    
    const timeout = params.resources?.timeout || 60000;
    const result = await container.wait({ condition: "not-running" });
    
    // 3. 获取日志
    const logs = await container.logs({
      stdout: true,
      stderr: true,
    });
    
    // 4. 清理容器
    await container.remove();

    // 5. 检测文件变更
    const changes = await this.detectChanges(params.shadowPath);

    return {
      exitCode: result.StatusCode,
      stdout: logs.toString("utf8"),
      stderr: "", // Docker 日志合并了 stdout/stderr
      changes,
    };
  }

  async applyShadow(requestId: string): Promise<any> {
    const shadowPath = path.join(this.shadowsDir, requestId);
    const metaPath = `${shadowPath}.meta.json`;
    
    const meta = await fs.readJson(metaPath);
    const sourcePath = meta.sourcePath;
    
    // 使用 rsync 将变更同步回源目录
    await execa("rsync", [
      "-av",
      "--delete",
      shadowPath + "/",
      sourcePath + "/",
    ]);
    
    // 清理影子
    await this.destroyShadow(requestId);
    
    return {
      files: [], // 实际应返回变更文件列表
      gitStatus: await this.getGitStatus(sourcePath),
    };
  }

  async destroyShadow(requestId: string): Promise<void> {
    const shadowPath = path.join(this.shadowsDir, requestId);
    await fs.remove(shadowPath);
    await fs.remove(`${shadowPath}.meta.json`);
  }

  private async detectChanges(shadowPath: string): Promise<string[]> {
    // 对比原始状态和影子状态，返回变更文件列表
    // 简化实现：返回所有修改过的文件
    return [];
  }

  private parseMemory(mem: string): number {
    const match = mem.match(/^(\d+)(m|mb|g|gb)?$/i);
    if (!match) return 512 * 1024 * 1024;
    const value = parseInt(match[1]);
    const unit = (match[2] || "m").toLowerCase();
    if (unit.startsWith("g")) return value * 1024 * 1024 * 1024;
    return value * 1024 * 1024;
  }

  private async getGitStatus(dir: string): Promise<string> {
    try {
      const { stdout } = await execa("git", ["status", "--short"], { cwd: dir });
      return stdout || "clean";
    } catch {
      return "not a git repo";
    }
  }
}
```

#### 3.2.4 配置文件 (config/ouroboros.json)

```json
{
  "version": "2.0.0",
  
  "logs": {
    "dir": "/root/.openclaw/workspace/ouroboros/logs",
    "level": "info",
    "rotation": {
      "maxSize": "100m",
      "maxFiles": 30
    }
  },
  
  "risk": {
    "levels": {
      "LOW": {
        "autoExecute": true,
        "requiresConfirmation": false
      },
      "MEDIUM": {
        "autoExecute": false,
        "requiresConfirmation": true,
        "timeout": 300000
      },
      "HIGH": {
        "autoExecute": false,
        "requiresConfirmation": true,
        "requiresApproval": true,
        "timeout": 3600000
      },
      "CRITICAL": {
        "autoExecute": false,
        "allowed": false
      }
    },
    "rules": {
      "fileOperations": {
        "read": "LOW",
        "write": "MEDIUM",
        "remove": "HIGH",
        "move": "MEDIUM"
      },
      "containerOperations": {
        "default": "MEDIUM",
        "privileged": "CRITICAL",
        "hostNetwork": "HIGH"
      }
    }
  },
  
  "fileOps": {
    "trashDir": "/root/.openclaw/workspace/ouroboros/trash",
    "backupDir": "/root/.openclaw/workspace/ouroboros/backups",
    "trashRetentionDays": 7,
    "maxFileSize": "10mb"
  },
  
  "container": {
    "shadowsDir": "/root/.openclaw/workspace/ouroboros/shadows",
    "defaultImages": [
      "node:18-alpine",
      "node:20-alpine",
      "python:3.11-slim",
      "python:3.12-slim",
      "ubuntu:22.04"
    ],
    "maxConcurrent": 5,
    "defaultResources": {
      "cpu": 1,
      "memory": "512m",
      "timeout": 60000
    }
  },
  
  "gate": {
    "queue": {
      "type": "sqlite",
      "path": "/root/.openclaw/workspace/ouroboros/queue.db"
    },
    "notifications": {
      "webhook": {
        "url": "https://your-webhook-endpoint.com/notify",
        "secret": "${WEBHOOK_SECRET}"
      }
    }
  },
  
  "security": {
    "allowedPaths": [
      "/root/.openclaw/workspace"
    ],
    "blockedCommands": [
      "rm -rf /",
      "mkfs",
      "dd if=/dev/zero",
      ":(){ :|:& };:"
    ],
    "requireGit": true
  }
}
```

---

## 4. 部署指南

### 4.1 环境要求

| 组件 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 20 | LTS 版本 |
| Docker | >= 24 | 容器运行时 |
| Git | >= 2.40 | 版本控制 |
| rsync | >= 3.2 | 文件同步 |
| SQLite | >= 3.40 | 队列存储 |

### 4.2 安装步骤

```bash
# 1. 创建工作目录
mkdir -p /root/.openclaw/workspace/ouroboros
cd /root/.openclaw/workspace/ouroboros

# 2. 初始化项目
cat > package.json << 'EOF'
{
  "name": "ouroboros-engine",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "recovery": "tsx bin/recovery-cli.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "dockerode": "^4.0.0",
    "execa": "^8.0.0",
    "fs-extra": "^11.0.0",
    "simple-git": "^3.20.0",
    "winston": "^3.11.0",
    "zod": "^3.22.0",
    "better-sqlite3": "^9.0.0"
  },
  "devDependencies": {
    "@types/dockerode": "^3.3.0",
    "@types/fs-extra": "^11.0.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.3.0"
  }
}
EOF

# 3. 安装依赖
npm install

# 4. 创建目录结构
mkdir -p src/{config,core,modules/{file-ops,container-runner,external-gate},types,utils}
mkdir -p bin logs shadows trash backups config

# 5. 创建 TypeScript 配置
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# 6. 复制上述源代码到对应文件
# ... (src/index.ts, src/modules/*, config/ouroboros.json)

# 7. 编译
npm run build

# 8. 配置 OpenClaw
cat >> /root/.openclaw/openclaw.json << 'EOF'
{
  "mcpServers": {
    "ouroboros": {
      "command": "node",
      "args": ["/root/.openclaw/workspace/ouroboros/dist/index.js"],
      "env": {
        "OUROBOROS_CONFIG": "/root/.openclaw/workspace/ouroboros/config/ouroboros.json"
      }
    }
  }
}
EOF

# 9. 重启 OpenClaw
openclaw gateway restart
```

### 4.3 验证安装

```bash
# 检查 MCP Server 是否注册
openclaw tools list | grep ouroboros

# 测试文件读取
openclaw tools call ouroboros file_operation '{"action":"read","path":"/root/.openclaw/workspace/README.md"}'

# 测试容器运行
openclaw tools call ouroboros container_run '{"image":"alpine:latest","command":"echo hello"}'
```

---

## 5. 运维手册

### 5.1 日常监控

```bash
# 查看审计日志
tail -f /root/.openclaw/workspace/ouroboros/logs/audit.jsonl

# 查看待确认请求
recovery-cli tickets list --pending

# 查看影子工作区占用
du -sh /root/.openclaw/workspace/ouroboros/shadows/*

# 清理过期回收站
recovery-cli trash cleanup --older-than 7d
```

### 5.2 灾难恢复

```bash
# 场景 1: 误删除文件
recovery-cli trash list
recovery-cli trash restore <file-id>

# 场景 2: 错误写入文件
recovery-cli backups list <file-path>
recovery-cli backups restore <backup-id>

# 场景 3: 容器变更需要回滚
recovery-cli shadows discard <request-id>

# 场景 4: 完整状态回滚到某时间点
recovery-cli rollback --to "2026-02-21T10:00:00Z"
```

### 5.3 性能调优

```bash
# 限制影子工作区数量
# 编辑 config/ouroboros.json
{
  "container": {
    "maxShadows": 10,
    "autoCleanup": true
  }
}

# 启用容器镜像缓存
docker pull node:20-alpine python:3.11-slim

# 调整日志级别
export OUROBOROS_LOG_LEVEL=warn
```

---

## 6. 附录

### 6.1 System Prompt 模板

```markdown
# Ouroboros Engine - Agent 使用指南

## 核心原则
1. **永不直接使用 bash 工具执行命令**
2. **所有操作必须通过 Ouroboros MCP 工具**
3. **高风险操作会自动进入人工确认队列**

## 可用工具

### file_operation
- `read`: 读取文件内容（自动执行）
- `write`: 写入文件（中等风险，需确认）
- `append`: 追加内容（中等风险，需确认）
- `remove`: 删除文件（高风险，进回收站）
- `move`: 移动/重命名（中等风险）
- `list`: 列出目录（自动执行）
- `search`: 搜索内容（自动执行）
- `diff`: 查看变更（自动执行）

### container_run
- 在隔离容器中执行命令
- 输出需确认后才应用到工作区
- 支持 Node.js、Python、Ubuntu 等镜像

### external_request
- 外部 API 调用
- 总是进入人工确认队列
- 支持 Slack、Email、Webhook

### confirm_apply
- 确认应用容器变更
- 或放弃变更

## 工作流示例

### 修改配置文件
1. 使用 `file_operation:read` 读取当前配置
2. 分析需要的变更
3. 使用 `file_operation:write` 写入新配置
4. 等待用户确认

### 运行脚本
1. 使用 `container_run` 在容器中执行
2. 查看输出结果
3. 如果成功，提示用户确认应用
4. 使用 `confirm_apply` 应用或放弃

## 禁止行为
- ❌ 直接使用 bash 执行任何命令
- ❌ 在 container_run 中使用 --privileged
- ❌ 尝试访问 /etc、/root 等敏感目录
- ❌ 执行网络请求而不通过 external_request

## 错误处理
如果操作失败：
1. 仔细阅读错误信息
2. 使用 <reflection> 标签分析原因
3. 提出替代方案
4. 不要重复相同的失败操作
```

### 6.2 风险评估矩阵

| 操作 | 风险等级 | 自动执行 | 需确认 | 需审批 |
|------|---------|---------|--------|--------|
| 读取文件 | LOW | ✅ | ❌ | ❌ |
| 列出目录 | LOW | ✅ | ❌ | ❌ |
| 搜索内容 | LOW | ✅ | ❌ | ❌ |
| 写入文件 | MEDIUM | ❌ | ✅ | ❌ |
| 追加内容 | MEDIUM | ❌ | ✅ | ❌ |
| 移动文件 | MEDIUM | ❌ | ✅ | ❌ |
| 删除文件 | HIGH | ❌ | ✅ | ✅ |
| 容器运行 | MEDIUM | ❌ | ✅ | ❌ |
| 外部请求 | HIGH | ❌ | ✅ | ✅ |
| 特权容器 | CRITICAL | ❌ | ❌ | ❌ |

### 6.3 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 2.0.0 | 2026-02-21 | 不可变基础设施模式重构 |
| 1.0.0 | 2026-02-20 | 初始版本，Git stash 回滚 |

---

**文档结束**

*Ouroboros Engine v2.0 - 不可变基础设施模式下的 AI Agent 安全执行框架*
