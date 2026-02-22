# SilkTalk Pro 双机测试准备清单

## 测试目标

验证 SilkTalk Pro 在真实网络环境下的 P2P 通话、中继转发、多路并发等功能。

## 测试环境要求

### 机器 A (服务器端)

| 项目 | 要求 |
|------|------|
| 操作系统 | Linux (Ubuntu 22.04 推荐) |
| 架构 | x64 或 ARM64 |
| 内存 | >= 2GB |
| 网络 | 公网 IP 或 NAT |
| 端口 | 3000, 3001, 3478 开放 |

### 机器 B (客户端)

| 项目 | 要求 |
|------|------|
| 操作系统 | Linux / macOS / Windows |
| 浏览器 | Chrome 90+ / Firefox 88+ / Safari 14+ |
| 网络 | 与机器 A 不同网络 |
| 摄像头 | 可选 |
| 麦克风 | 可选 |

## 部署前检查

### 机器 A 检查清单

- [ ] 操作系统支持 (运行 `./scripts/check-env.sh`)
- [ ] 防火墙端口开放
- [ ] 公网 IP 或端口映射
- [ ] 域名配置 (可选)
- [ ] SSL 证书 (可选)

### 网络检查

```bash
# 检查公网 IP
curl https://api.ipify.org

# 检查端口开放
nc -zv <服务器IP> 3000
nc -zv <服务器IP> 3001
nc -zvu <服务器IP> 3478
```

## 部署步骤

### 1. 机器 A 部署

```bash
# 下载部署脚本
curl -fsSL https://raw.githubusercontent.com/silktalk/silktalk-pro/main/scripts/auto-deploy.sh -o auto-deploy.sh
chmod +x auto-deploy.sh

# 执行部署
./auto-deploy.sh -m semi

# 或使用详细模式
./auto-deploy.sh --verbose
```

### 2. 配置检查

```bash
# 查看配置
cat /usr/local/silktalk-pro/config/silktalk.config.json

# 验证安装
./scripts/verify-install.sh
```

### 3. 启动服务

```bash
# 使用 systemd
sudo systemctl start silktalk
sudo systemctl enable silktalk

# 或使用 Docker
docker-compose up -d

# 查看状态
sudo systemctl status silktalk
```

### 4. 健康检查

```bash
# HTTP 健康检查
curl http://localhost:3000/health

# 查看日志
tail -f /usr/local/silktalk-pro/logs/app.log
```

## 测试场景

### 场景 1: 基础连接测试

**目的**: 验证基本连接功能

**步骤**:
1. 机器 B 浏览器访问 `http://<机器A_IP>:3000`
2. 检查页面是否正常加载
3. 检查 WebSocket 连接状态

**预期结果**:
- [ ] 页面正常加载
- [ ] WebSocket 连接成功
- [ ] 无 JavaScript 错误

### 场景 2: P2P 通话测试

**目的**: 验证点对点通话

**步骤**:
1. 机器 A 创建房间
2. 机器 B 加入同一房间
3. 双方开启音视频

**预期结果**:
- [ ] 房间创建成功
- [ ] 双方成功加入
- [ ] 音视频流正常传输
- [ ] 延迟 < 200ms

### 场景 3: NAT 穿透测试

**目的**: 验证不同 NAT 类型下的连接

**步骤**:
1. 确认双方在不同 NAT 后
2. 尝试建立 P2P 连接
3. 观察连接类型 (host/srflx/relay)

**预期结果**:
- [ ] 对称 NAT 下使用 TURN 中继
- [ ] 锥形 NAT 下直接 P2P
- [ ] 连接自动降级

### 场景 4: 多路并发测试

**目的**: 验证服务器并发能力

**步骤**:
1. 创建多个房间
2. 每房间加入 4-8 人
3. 持续运行 30 分钟

**预期结果**:
- [ ] CPU 使用率 < 70%
- [ ] 内存使用稳定
- [ ] 无连接断开
- [ ] 音视频质量稳定

### 场景 5: 网络波动测试

**目的**: 验证网络不稳定时的表现

**步骤**:
1. 建立通话连接
2. 模拟网络波动 (tc 命令)
3. 观察恢复情况

```bash
# 模拟网络延迟
sudo tc qdisc add dev eth0 root netem delay 100ms

# 模拟丢包
sudo tc qdisc add dev eth0 root netem loss 5%

# 清除
sudo tc qdisc del dev eth0 root
```

**预期结果**:
- [ ] 自动降级到较低码率
- [ ] 连接不中断
- [ ] 网络恢复后质量提升

### 场景 6: 长时间稳定性测试

**目的**: 验证长期运行稳定性

**步骤**:
1. 建立通话连接
2. 保持连接 24 小时
3. 监控资源使用

**预期结果**:
- [ ] 无内存泄漏
- [ ] CPU 使用率稳定
- [ ] 连接保持

## 测试工具

### 网络测试

```bash
# 带宽测试
iperf3 -c <服务器IP>

# 延迟测试
ping <服务器IP>

# 路由追踪
traceroute <服务器IP>
```

### WebRTC 测试

- WebRTC Internals: `chrome://webrtc-internals/`
- 网络信息: `chrome://net-internals/`

### 性能监控

```bash
# 系统监控
htop
iotop

# Node.js 监控
clinic doctor -- node dist/index.js
clinic bubbleprof -- node dist/index.js
```

## 问题记录模板

| 问题 | 描述 | 复现步骤 | 预期 | 实际 | 优先级 |
|------|------|----------|------|------|--------|
| | | | | | |

## 测试报告模板

```markdown
# SilkTalk Pro 双机测试报告

**测试时间**: YYYY-MM-DD
**测试人员**: 
**机器 A**: (IP, 配置, 网络)
**机器 B**: (IP, 配置, 网络)

## 测试结果摘要

- 通过: X 项
- 失败: X 项
- 跳过: X 项

## 详细结果

### 场景 1: 基础连接测试
- 状态: ✅ 通过 / ❌ 失败
- 备注: 

### 场景 2: P2P 通话测试
- 状态: ✅ 通过 / ❌ 失败
- 延迟: X ms
- 备注:

## 问题列表

1. 

## 建议

1. 
```

## 测试完成检查清单

- [ ] 所有测试场景执行完毕
- [ ] 问题记录完整
- [ ] 测试报告生成
- [ ] 性能数据收集
- [ ] 配置文件备份
- [ ] 日志文件归档
