# 5分钟快速开始

## 目标
5分钟内部署完成并开始采集数据。

---

## 第一步：启动服务端（2分钟）

```bash
# 1. 进入服务端目录
cd kimiclaw-db

# 2. 一键启动
docker-compose up -d

# 3. 验证启动
curl http://localhost:3000/health
# 应返回: {"status":"ok"}
```

✅ **服务端已运行**

---

## 第二步：配置客户端（2分钟）

### Windows用户

```bash
# 1. 进入客户端目录
cd wincapture-electron

# 2. 安装依赖（首次）
npm install

# 3. 启动
npm start
```

### 配置界面

首次启动自动弹出配置窗口：

| 字段 | 填写内容 |
|------|----------|
| 服务器地址 | `http://localhost:3000/api/capture/upload` |
| 用户ID | `user_001` |
| API Key | `dev-key-123` |

点击保存，程序最小化到托盘。

✅ **客户端已运行**

---

## 第三步：验证数据采集（1分钟）

```bash
# 查看服务端接收的数据
curl http://localhost:3000/api/query?user_id=user_001

# 应返回采集记录列表
```

或在客户端托盘图标右键 → 状态，查看最近采集。

✅ **数据采集正常**

---

## 常见问题

### Q: 端口被占用？
```bash
# 修改 docker-compose.yml 端口映射
ports:
  - "3001:3000"  # 改为3001
```

### Q: 客户端连不上服务端？
- 检查防火墙
- 确认服务端地址正确
- 查看客户端日志

### Q: 没有采集数据？
- 检查应用白名单
- 确认窗口标题不为空
- 查看托盘状态

---

## 下一步

- 阅读 [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) 生产部署
- 配置飞书机器人集成
- 查看数据分析面板

---

**完成！** 你已拥有完整的员工生产力采集系统。