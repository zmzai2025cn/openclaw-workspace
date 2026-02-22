# SilkTalk Relay - Railway 部署指南（最新版）

## 部署步骤

### 1. 创建项目
- 点击 "New Project"
- 选择 "Deploy from GitHub repo"
- 或选择 "Deploy from template" → "Node.js"

### 2. 如果没有 GitHub 仓库
**方法 A：使用 Railway CLI**
```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 创建项目
railway init

# 部署
railway up
```

**方法 B：使用 GitHub 新建仓库**
1. 在 GitHub 创建新仓库（如 silktalk-relay）
2. 上传两个文件：
   - package.json
   - relay-server.js
3. 在 Railway 选择该仓库部署

**方法 C：最简单 - 使用模板**
1. 在 Railway 选择 "Deploy from template"
2. 搜索 "Node.js" 或 "Express"
3. 部署后修改代码

### 3. 推荐：使用 Railway CLI（最简单）

在你的电脑上执行：
```bash
# 1. 安装 CLI
npm install -g @railway/cli

# 2. 登录（会打开浏览器授权）
railway login

# 3. 创建目录
mkdir silktalk-relay
cd silktalk-relay

# 4. 创建 package.json
cat > package.json << 'EOF'
{
  "name": "silktalk-relay",
  "version": "1.0.0",
  "main": "relay-server.js",
  "scripts": {
    "start": "node relay-server.js"
  },
  "dependencies": {
    "ws": "^8.14.0"
  }
}
EOF

# 5. 创建 relay-server.js（粘贴简化版代码）

# 6. 初始化项目
railway init

# 7. 部署
railway up
```

### 4. 获取公网地址
部署成功后：
```bash
railway domain
```
会显示类似：`xxxx.up.railway.app`

### 5. 测试
```bash
curl https://xxxx.up.railway.app
# 应该返回：{"status":"running","nodes":0}
```

WebSocket 地址：`wss://xxxx.up.railway.app`

---

## 备选：使用 Render（更简单）

如果 Railway 太复杂，可以用 Render：

1. 访问 https://render.com
2. 用 GitHub 登录
3. 点击 "New Web Service"
4. 选择 "Build and deploy from a Git repository"
5. 创建 GitHub 仓库并上传代码
6. 部署

Render 会自动分配 `.onrender.com` 域名。

---

## 最简单的方案

如果你不想用 CLI，告诉我：

**我可以直接在我的服务器上开中继，给你公网地址。**

这样你什么都不用部署，直接用！

---

你想：
- A. 尝试 Railway CLI
- B. 使用 Render
- C. 直接用我的服务器（最快）
