# 安全规范

## 1. 安全目标

- **数据机密性**: 敏感数据加密存储
- **数据完整性**: 防止未授权修改
- **服务可用性**: 防止拒绝服务攻击
- **合规性**: 满足法规要求

## 2. 数据安全

### 2.1 数据分类

| 级别 | 数据类型 | 处理方式 |
|------|---------|---------|
| 公开 | 群聊名称 | 明文存储 |
| 内部 | 消息内容 | 明文存储，访问控制 |
| 敏感 | 用户ID | 哈希处理 |
| 机密 | 个人身份信息 | 加密存储 |

### 2.2 数据加密

#### 静态加密

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

export function decrypt(encrypted: string, key: Buffer): string {
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':');
  
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

#### 传输加密

- 使用TLS 1.3
- 禁用弱密码套件
- 证书固定（可选）

### 2.3 数据脱敏

```typescript
export function maskSensitiveData(content: string): string {
  // 手机号脱敏
  content = content.replace(/(\d{3})\d{4}(\d{4})/g, '$1****$2');
  
  // 身份证号脱敏
  content = content.replace(/(\d{6})\d{8}(\d{4})/g, '$1********$2');
  
  // 邮箱脱敏
  content = content.replace(/(\w{2})\w+(@\w+)/g, '$1***$2');
  
  return content;
}
```

## 3. 访问控制

### 3.1 身份认证

```typescript
// API密钥认证
const API_KEY = process.env.API_KEY;

function authenticate(req: Request): boolean {
  const key = req.headers['x-api-key'];
  return key === API_KEY;
}
```

### 3.2 权限控制

```typescript
enum Permission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin',
}

function checkPermission(userId: string, permission: Permission): boolean {
  // 查询用户权限
  const userPerms = getUserPermissions(userId);
  return userPerms.includes(permission);
}
```

### 3.3 审计日志

```typescript
interface AuditLog {
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  result: 'success' | 'failure';
  ip?: string;
  userAgent?: string;
}

function logAudit(entry: AuditLog): void {
  logger.info('Audit', entry);
}
```

## 4. 网络安全

### 4.1 防火墙规则

```bash
# 只允许特定IP访问管理端口
iptables -A INPUT -p tcp --dport 8080 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 8080 -j DROP

# 限制连接速率
iptables -A INPUT -p tcp --dport 8080 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT
```

### 4.2 DDoS防护

```typescript
// 速率限制
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每IP最多100请求
  message: 'Too many requests',
});

app.use('/api/', limiter);
```

### 4.3 输入验证

```typescript
import { z } from 'zod';

const MessageSchema = z.object({
  id: z.string().max(64),
  content: z.string().max(10000),
  userId: z.string().max(64),
  // ...
});

function validateMessage(data: unknown) {
  return MessageSchema.parse(data);
}
```

## 5. 应用安全

### 5.1 依赖安全

```bash
# 扫描漏洞
npm audit

# 自动修复
npm audit fix

# 持续监控
npm install -g snyk
snyk test
```

### 5.2 容器安全

```dockerfile
# 使用非root用户
FROM node:20-alpine
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# 只读文件系统
read_only: true

# 资源限制
resources:
  limits:
    cpus: '2'
    memory: 1G
```

### 5.3 密钥管理

```typescript
// 使用环境变量，不硬编码
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// 或使用密钥管理服务
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const secrets = new SecretsManager();
const key = await secrets.getSecretValue({ SecretId: 'db-key' });
```

## 6. 数据保护

### 6.1 备份加密

```bash
#!/bin/bash
# backup-encrypt.sh

BACKUP_FILE=$1
PASSWORD=$2

# 加密备份
gpg --symmetric --cipher-algo AES256 \
    --compress-algo 1 \
    --passphrase "$PASSWORD" \
    --batch --yes \
    -o "${BACKUP_FILE}.gpg" \
    "$BACKUP_FILE"

# 删除明文
rm "$BACKUP_FILE"
```

### 6.2 数据销毁

```typescript
// 安全删除文件
import { unlinkSync, writeFileSync } from 'fs';

export function secureDelete(filePath: string): void {
  // 覆盖3次
  const size = fs.statSync(filePath).size;
  for (let i = 0; i < 3; i++) {
    const randomData = randomBytes(size);
    writeFileSync(filePath, randomData);
  }
  
  // 删除
  unlinkSync(filePath);
}
```

## 7. 合规要求

### 7.1 GDPR合规

- **数据最小化**: 只收集必要数据
- **目的限制**: 数据仅用于归档
- **存储限制**: 自动清理过期数据
- **用户权利**: 支持数据导出和删除

```typescript
// 数据导出
export async function exportUserData(userId: string): Promise<Buffer> {
  const messages = await db.queryByUser(userId);
  return generateExportFile(messages);
}

// 数据删除
export async function deleteUserData(userId: string): Promise<void> {
  await db.deleteByUser(userId);
}
```

### 7.2 等保要求

- 身份鉴别
- 访问控制
- 安全审计
- 数据完整性
- 数据保密性

## 8. 安全事件响应

### 8.1 事件分级

| 级别 | 描述 | 响应时间 |
|------|------|---------|
| P0 | 数据泄露 | 立即 |
| P1 | 服务中断 | 15分钟 |
| P2 | 性能下降 | 1小时 |
| P3 | 一般问题 | 1天 |

### 8.2 响应流程

```
1. 发现 → 立即报告
2. 评估 → 确定影响范围
3. 遏制 → 阻止进一步损害
4. 根除 → 修复漏洞
5. 恢复 → 恢复正常服务
6. 总结 → 事后分析
```

### 8.3 应急联系人

- 安全负责人: security@example.com
- 运维值班: oncall@example.com
- 管理层: management@example.com

## 9. 安全测试

### 9.1 静态分析

```bash
# ESLint安全规则
npm install -D eslint-plugin-security

# 代码扫描
npm install -D semgrep
semgrep --config=auto src/
```

### 9.2 动态测试

```bash
# 依赖漏洞扫描
npm audit

# 容器扫描
docker scan chat-archive:latest
```

### 9.3 渗透测试

- 季度外部渗透测试
- 年度红队演练
- 新功能上线前安全评审

## 10. 安全清单

### 部署前检查

- [ ] 默认密码已修改
- [ ] 不必要端口已关闭
- [ ] TLS证书已配置
- [ ] 防火墙规则已应用
- [ ] 日志已启用
- [ ] 监控已配置
- [ ] 备份已测试
- [ ] 漏洞扫描已通过

### 日常检查

- [ ] 安全补丁已更新
- [ ] 访问日志已审查
- [ ] 异常行为已调查
- [ ] 备份完整性已验证
