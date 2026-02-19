# 开发指南

## 环境搭建

### 服务端开发

```bash
# 1. 安装Node.js 18+
nvm install 18
nvm use 18

# 2. 安装依赖
cd kimiclaw-db
npm install

# 3. 启动开发模式
npm run dev
```

### 客户端开发

```bash
# Electron版
cd wincapture-electron
npm install
npm start

# C#版（需Windows）
cd wincapture-mvp
dotnet build
dotnet run
```

---

## 代码规范

### TypeScript

```typescript
// ✅ 使用显式类型
function processCapture(data: CaptureData): Result {
  // ...
}

// ✅ 使用接口定义
interface CaptureData {
  timestamp: string;
  userId: string;
  // ...
}

// ❌ 避免any
function bad(data: any) { }
```

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 类名 | PascalCase | `CaptureEngine` |
| 函数 | camelCase | `processData` |
| 常量 | UPPER_SNAKE | `MAX_RETRY` |
| 文件 | kebab-case | `capture-engine.ts` |

---

## 测试规范

### 单元测试

```typescript
// tests/example.test.ts
describe('CaptureEngine', () => {
  test('should capture on window switch', () => {
    const engine = new CaptureEngine(mockConfig);
    const spy = jest.spyOn(engine, 'capture');
    
    engine.simulateWindowSwitch();
    
    expect(spy).toHaveBeenCalled();
  });
});
```

### 运行测试

```bash
# 全部测试
npm test

# 单个文件
npm test -- capture.test.ts

# 覆盖率
npm run test:coverage
```

---

## Git工作流

```bash
# 1. 创建功能分支
git checkout -b feature/new-trigger

# 2. 提交代码
git add .
git commit -m "feat: add new trigger type"

# 3. 推送分支
git push origin feature/new-trigger

# 4. 创建PR（通过GitHub/GitLab）
```

### 提交规范

| 类型 | 说明 | 示例 |
|------|------|------|
| feat | 新功能 | `feat: add pixel diff trigger` |
| fix | 修复 | `fix: handle null window title` |
| docs | 文档 | `docs: update API reference` |
| test | 测试 | `test: add integration tests` |
| refactor | 重构 | `refactor: simplify capture logic` |

---

## 调试技巧

### 服务端调试

```bash
# 启用调试日志
DEBUG=* npm run dev

# 特定模块
DEBUG=kimiclaw:api npm run dev
```

### 客户端调试

```bash
# Electron开发者工具
npm start -- --dev-tools

# 日志查看
tail -f ~/.wincapture/logs/app.log
```

---

## 性能优化

### 数据库

```sql
-- 添加索引
CREATE INDEX idx_captures_user_time ON captures(user_id, timestamp);

-- 分区表（大数据量）
CREATE TABLE captures_2024_02 PARTITION OF captures
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

### 客户端

- 批量上传减少请求数
- 图片压缩降低带宽
- 本地队列避免阻塞

---

## 发布流程

### 服务端

```bash
# 1. 版本更新
npm version patch  # 1.0.0 -> 1.0.1

# 2. 构建镜像
docker build -t kimiclaw-db:v1.0.1 .

# 3. 推送仓库
docker push kimiclaw-db:v1.0.1

# 4. 部署更新
kubectl set image deployment/kimiclaw-db kimiclaw-db=kimiclaw-db:v1.0.1
```

### 客户端

```bash
# Electron
npm run build
# 输出: dist/WinCapture-1.0.0.exe

# C#
dotnet publish -c Release
# 输出: bin/Release/WinCapture.exe
```

---

## 常见问题

### Q: 热重载不生效？
A: 检查文件监听限制：`ulimit -n 1024`

### Q: 测试随机失败？
A: 检查异步处理，使用 `await` 或 `done()`

### Q: 构建产物过大？
A: 使用 `--self-contained false` 或代码分割