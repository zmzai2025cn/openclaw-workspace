# SilkTalk Relay - 详细使用说明

## 概述

SilkTalk Relay 是带中继功能的 P2P 节点，解决内网无法直接连接的问题。

## 核心功能

- **Circuit Relay v2**: 通过中继节点连接内网节点
- **AutoNAT**: 自动检测网络类型（公网/内网/NAT）
- **DHT**: 分布式节点发现
- **多传输**: TCP + WebSocket

## 快速开始（3分钟）

### 1. 解压并运行
```bash
tar xzvf silktalk-relay-alibot.tar.gz
cd silktalk-relay
./deploy-relay.sh
```

### 2. 记录节点信息
启动后会显示：
```
✅ Node started with relay support!
PeerId: 12D3KooWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Listen addresses:
  /ip4/192.168.1.100/tcp/10001/p2p/12D3KooW...
  /ip4/127.0.0.1/tcp/10002/ws/p2p/12D3KooW...
```

**请返回**：
- PeerId
- 监听地址列表

### 3. 等待连接
节点会自动：
- 监听本地端口
- 通过 DHT 发现其他节点
- 通过中继连接内网节点

## 中继工作原理

```
[你的节点] ←──内网──→ [中继节点] ←──内网──→ [对方节点]
              无法直连              无法直连
                      ↑
                 通过中继连通
```

## 配置说明

### 公共中继节点（可选）
如需使用公共中继，编辑 `relay-node.js`：
```javascript
const PUBLIC_RELAYS = [
  '/dns4/relay1.example.com/tcp/443/wss/p2p/12D3KooW...',
  '/dns4/relay2.example.com/tcp/443/wss/p2p/12D3KooW...'
];
```

### 端口配置
默认端口：
- TCP: 10001
- WebSocket: 10002

如需修改，编辑 `relay-node.js` 中的 `listen` 地址。

## 故障排查

### 启动失败
```bash
# 检查 Node.js 版本
node --version  # 需要 16+

# 检查端口占用
netstat -tlnp | grep 10001
```

### 无法连接
- 确认防火墙允许 10001/10002 端口
- 检查网络是否允许 P2P 连接
- 查看日志获取详细信息

### 依赖安装失败
```bash
# 使用淘宝镜像
npm install --registry=https://registry.npmmirror.com
```

## 测试验证

### 单机测试
```bash
# 启动节点
node relay-node.js

# 检查是否监听
netstat -tlnp | grep node
```

### 双机测试
1. 双方启动节点
2. 交换 PeerId
3. 尝试连接
4. 验证消息传输

## 与 Layer 1 的区别

| 特性 | Layer 1 (Mini) | Layer 3 (Relay) |
|------|---------------|-----------------|
| 传输 | WebSocket | TCP + WebSocket |
| 内网穿透 | ❌ 不支持 | ✅ 中继支持 |
| 节点发现 | 手动 | DHT 自动 |
| 适用场景 | 同网络测试 | 跨网络生产 |

## 下一步

1. 启动节点并返回 PeerId
2. 等待对方节点信息
3. 进行双机连接测试
4. 验证消息传输

## 支持

如有问题，请提供：
- 启动日志
- Node.js 版本
- 网络环境（云服务器/本地/容器）
