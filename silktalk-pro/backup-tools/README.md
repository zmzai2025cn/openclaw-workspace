# SilkTalk Pro 备用工具包

这个目录包含 SilkTalk Pro 项目的备用方案和诊断工具。

## 📁 目录结构

```
backup-tools/
├── network-diagnose.sh      # 网络连通性诊断
├── port-check.sh            # 端口检查工具
├── nat-type.sh              # NAT类型检测
├── simple-test.js           # 原生WebSocket测试
├── tcp-test.js              # 原生TCP连接测试
├── udp-test.js              # UDP打洞测试
├── relay-config.md          # 中继服务器配置
├── monitor.sh               # 连接状态监控
├── latency-test.sh          # 延迟测试工具
├── package-v0.37.json       # libp2p 0.37.x 依赖
├── package-v0.36.json       # libp2p 0.36.x 依赖
├── package-simple.json      # 最小依赖版本
└── download-deps.sh         # 离线依赖下载脚本
```

## 🔧 诊断工具

### 网络诊断
```bash
chmod +x network-diagnose.sh
./network-diagnose.sh
```
功能：
- 基础网络信息
- IP地址和网关
- 互联网连通性测试
- P2P相关端口检查
- 防火墙状态

### 端口检查
```bash
chmod +x port-check.sh
./port-check.sh                    # 扫描默认端口范围
./port-check.sh 8080 8090          # 扫描指定范围
./port-check.sh -l 9001            # 启动监听服务器
./port-check.sh -c 1.2.3.4:4001    # 测试连接
./port-check.sh -L                 # 查看监听端口
```

### NAT类型检测
```bash
chmod +x nat-type.sh
./nat-type.sh
```
功能：
- 获取公网IP
- 测试STUN服务器
- 评估NAT类型
- 提供P2P建议

## 🧪 简化测试脚本

### WebSocket测试
```bash
# 需要: npm install ws

node simple-test.js                # 启动服务器
node simple-test.js client ws://localhost:8080    # 客户端模式
node simple-test.js stress ws://localhost:8080 100 # 压力测试
```

### TCP测试
```bash
node tcp-test.js server 9001       # 启动TCP服务器
node tcp-test.js client localhost 9001  # 连接客户端
node tcp-test.js test localhost 9001    # 简单连接测试
node tcp-test.js scan localhost 1 1000  # 端口扫描
```

### UDP打洞测试
```bash
node udp-test.js stun              # STUN服务器测试
node udp-test.js server 9002       # 启动UDP服务器
node udp-test.js client localhost 9002  # 连接客户端
node udp-test.js punch localhost 9002 target-id  # 打洞测试
```

## 📊 监控工具

### 实时监控
```bash
chmod +x monitor.sh
./monitor.sh                       # 持续监控 (5秒刷新)
./monitor.sh 10                    # 10秒刷新
./monitor.sh -o                    # 单次运行
```

### 延迟测试
```bash
chmod +x latency-test.sh
./latency-test.sh                  # 基础延迟测试
./latency-test.sh -c               # 持续测试
./latency-test.sh -n 10            # 每个目标测试10次
./latency-test.sh -t example.com   # 测试特定主机
./latency-test.sh -p               # 测试P2P服务器
```

## 📦 备选依赖版本

### libp2p 0.37.x (推荐)
```bash
cp package-v0.37.json ../package.json
npm install
```

### libp2p 0.36.x (稳定版)
```bash
cp package-v0.36.json ../package.json
npm install
```

### 最小依赖 (仅WebSocket)
```bash
cp package-simple.json ../package.json
npm install
```

## 🌐 中继服务器配置

查看 `relay-config.md` 获取：
- 公共STUN服务器列表
- 公共TURN服务器
- 自建TURN服务器指南
- libp2p中继配置

## 📥 离线安装

### 下载依赖包
```bash
chmod +x download-deps.sh
./download-deps.sh                 # 下载所有依赖
./download-deps.sh --node-only     # 仅下载Node.js
./download-deps.sh --npm-only      # 仅下载npm包
```

### 离线安装
```bash
# 在目标机器上
tar -xzf silktalk-offline-packages-YYYYMMDD.tar.gz
cd offline-packages
./install-offline.sh
```

## 🚀 快速开始

1. **诊断网络问题**
   ```bash
   ./network-diagnose.sh
   ./nat-type.sh
   ```

2. **测试基础连通性**
   ```bash
   node simple-test.js
   # 浏览器访问 http://localhost:8080
   ```

3. **检查端口**
   ```bash
   ./port-check.sh -L
   ```

4. **监控连接**
   ```bash
   ./monitor.sh
   ```

## 📝 故障排除

### libp2p连接失败
1. 运行 `./network-diagnose.sh` 检查网络
2. 运行 `./nat-type.sh` 检查NAT类型
3. 检查 `relay-config.md` 配置中继服务器

### 端口不通
1. 使用 `./port-check.sh` 检查端口状态
2. 检查防火墙规则
3. 考虑使用TURN中继

### 依赖安装失败
1. 尝试 `package-v0.36.json` 版本
2. 使用 `package-simple.json` 最小依赖
3. 使用 `download-deps.sh` 准备离线包

## 📚 相关文档

- [relay-config.md](relay-config.md) - 中继服务器配置
- [MANIFEST.md](offline-packages/MANIFEST.md) - 离线包清单

## ⚠️ 注意事项

- 所有脚本都需要Node.js 18+ 或 Bash
- 部分脚本需要root权限检查系统信息
- 网络测试需要互联网连接
- 离线包较大 (~500MB)，请确保足够磁盘空间
