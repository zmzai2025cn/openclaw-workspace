# SilkTalk Relay - Railway 部署指南

## 部署步骤

### 1. 创建项目
- 在 Railway 点击 "New Project"
- 选择 "Empty Project"

### 2. 添加代码
- 点击 "Add Code"
- 选择 "Upload Code"
- 上传以下文件：
  - relay-server.js
  - package.json

### 3. 配置端口
- 点击 "Variables"
- 添加变量：PORT = 8080

### 4. 部署
- 点击 "Deploy"
- 等待部署完成

### 5. 获取公网地址
- 部署完成后，Railway 会分配一个公网域名
- 格式：xxxx.up.railway.app
- WebSocket 地址：wss://xxxx.up.railway.app

## 文件内容

### package.json
```json
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
```

### relay-server.js
（使用之前提供的简化版代码）

## 测试

部署完成后：
1. 访问 https://your-app.up.railway.app
2. 应该看到 JSON 响应：{"status":"running","nodes":0}
3. WebSocket 连接：wss://your-app.up.railway.app

## 双方连接

- 我连接：wss://your-app.up.railway.app
- alibot 连接：wss://your-app.up.railway.app

通过 Railway 中继，双方即可通信！
