# 开发指南

## 1. 开发环境搭建

### 1.1 系统要求

- Node.js 18+
- npm 9+
- Git
- Docker（可选）

### 1.2 克隆代码

```bash
git clone <repo-url>
cd chat-archive
```

### 1.3 安装依赖

```bash
npm install
```

### 1.4 构建

```bash
npm run build
```

### 1.5 运行测试

```bash
npm test
```

## 2. 项目结构

```
chat-archive/
├── src/                    # 源代码
│   ├── index.ts           # 入口
│   ├── archive.ts         # 主类
│   ├── db.ts              # 数据库操作
│   ├── buffer.ts          # 缓冲写入
│   ├── wal.ts             # WAL
│   ├── backup.ts          # 备份
│   ├── cleanup.ts         # 清理
│   ├── health.ts          # 健康检查
│   ├── logger.ts          # 日志
│   ├── system.ts          # 系统监控
│   ├── config.ts          # 配置
│   ├── openclaw.ts        # OpenClaw集成
│   └── types.ts           # 类型定义
├── tests/                 # 测试
├── docs/                  # 文档
├── data/                  # 数据目录
├── backups/               # 备份目录
├── logs/                  # 日志目录
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## 3. 开发规范

### 3.1 代码风格

- 使用 TypeScript
- 2空格缩进
- 单引号
- 分号必须
- 最大行宽100

### 3.2 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 类 | PascalCase | `ChatArchive` |
| 接口 | PascalCase | `ArchiveConfig` |
| 函数 | camelCase | `archiveMessage` |
| 变量 | camelCase | `bufferSize` |
| 常量 | UPPER_SNAKE | `DEFAULT_BUFFER_SIZE` |
| 文件 | kebab-case | `archive-manager.ts` |

### 3.3 注释规范

```typescript
/**
 * 归档单条消息
 * @param message - 消息对象
 * @returns Promise<void>
 * @throws DatabaseError 数据库写入失败
 */
async archive(message: ChatMessage): Promise<void> {
  // 实现...
}
```

## 4. 测试

### 4.1 单元测试

```typescript
// tests/archive.test.ts
import { ChatArchive } from '../src/archive';

describe('ChatArchive', () => {
  let archive: ChatArchive;
  
  beforeEach(async () => {
    archive = new ChatArchive({
      archive: { dbPath: ':memory:' },
    });
    await archive.init();
  });
  
  afterEach(async () => {
    await archive.close();
  });
  
  test('should archive message', async () => {
    await archive.archive({
      id: 'test_001',
      timestamp: new Date(),
      channel: 'test',
      chatId: 'chat_001',
      userId: 'user_001',
      userName: 'Test',
      content: 'Hello',
      isMentioned: false,
    });
    
    const stats = await archive.getStats();
    expect(stats.totalMessages).toBe(1);
  });
});
```

### 4.2 集成测试

```typescript
// tests/integration.test.ts
describe('Integration', () => {
  test('should recover from WAL', async () => {
    // 模拟崩溃恢复...
  });
  
  test('should handle concurrent writes', async () => {
    // 并发写入测试...
  });
});
```

### 4.3 性能测试

```typescript
// tests/performance.test.ts
describe('Performance', () => {
  test('should handle 1000 writes/sec', async () => {
    const start = Date.now();
    
    for (let i = 0; i < 1000; i++) {
      await archive.archive({...});
    }
    
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000);
  });
});
```

## 5. 调试

### 5.1 本地调试

```bash
# 使用 ts-node
npm run dev

# 或调试模式
node --inspect-brk -r ts-node/register src/index.ts
```

### 5.2 日志级别

```bash
# 开发时开启DEBUG
LOG_LEVEL=debug npm run dev

# 生产使用INFO
LOG_LEVEL=info npm start
```

### 5.3 DuckDB调试

```bash
# 直接查询数据库
duckdb data/chat.db "SELECT * FROM messages LIMIT 10;"

# 查看表结构
duckdb data/chat.db ".schema messages"

# 查看索引
duckdb data/chat.db "SELECT * FROM duckdb_indexes();"
```

## 6. 提交规范

### 6.1 Commit Message

```
<type>(<scope>): <subject>

<body>

<footer>
```

类型：
- feat: 新功能
- fix: 修复
- docs: 文档
- style: 格式
- refactor: 重构
- test: 测试
- chore: 构建/工具

示例：
```
feat(backup): add automatic backup scheduling

- Daily full backup at 2 AM
- Retain last 7 backups
- Auto cleanup old backups

Closes #123
```

### 6.2 分支管理

```bash
# 功能分支
git checkout -b feat/backup-scheduling

# 修复分支
git checkout -b fix/wal-recovery

# 文档分支
git checkout -b docs/api-examples
```

## 7. 发布流程

### 7.1 版本号规范

语义化版本：MAJOR.MINOR.PATCH

- MAJOR: 不兼容的API更改
- MINOR: 向后兼容的功能添加
- PATCH: 向后兼容的问题修复

### 7.2 发布步骤

```bash
# 1. 更新版本
npm version patch  # 或 minor/major

# 2. 更新CHANGELOG
vim CHANGELOG.md

# 3. 构建
npm run build

# 4. 测试
npm test

# 5. 提交
git add .
git commit -m "chore(release): v1.0.1"
git push

# 6. 打标签
git tag v1.0.1
git push origin v1.0.1

# 7. 发布到npm
npm publish
```

### 7.3 Docker发布

```bash
# 构建镜像
docker build -t chat-archive:v1.0.1 .

# 标记
docker tag chat-archive:v1.0.1 chat-archive:latest

# 推送
docker push chat-archive:v1.0.1
docker push chat-archive:latest
```

## 8. 贡献指南

### 8.1 提交PR

1. Fork仓库
2. 创建功能分支
3. 提交代码
4. 确保测试通过
5. 更新文档
6. 提交PR

### 8.2 Code Review

- 至少1个Review通过
- CI检查通过
- 无冲突

### 8.3 文档更新

- 代码变更需同步更新文档
- 新增功能需添加示例
- API变更需更新API文档

## 9. 常见问题

### Q: 如何添加新字段？

```typescript
// 1. 更新类型
interface ChatMessage {
  // ...原有字段
  newField?: string;  // 新增
}

// 2. 更新数据库表结构
// 在 db.ts init() 中添加迁移逻辑

// 3. 更新文档
```

### Q: 如何支持新数据库？

```typescript
// 实现 DatabaseAdapter 接口
interface DatabaseAdapter {
  init(): Promise<void>;
  insert(messages: ChatMessage[]): Promise<void>;
  query(...): Promise<ChatMessage[]>;
  // ...
}
```

### Q: 如何调试性能问题？

```bash
# 启用性能日志
LOG_LEVEL=debug node --prof src/index.ts

# 分析火焰图
node --prof-process isolate-*.log > profile.txt
```

## 10. 参考资源

- [DuckDB文档](https://duckdb.org/docs/)
- [Node.js最佳实践](https://nodejs.org/en/docs/)
- [TypeScript手册](https://www.typescriptlang.org/docs/)
