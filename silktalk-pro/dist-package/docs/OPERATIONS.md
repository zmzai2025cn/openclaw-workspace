# 运维手册
## Operations Manual

**文档编号**: STP-OPS-001  
**版本**: 1.0.0  
**日期**: 2026-02-22  
**状态**: 已批准  
**作者**: SilkTalk Pro DevOps 团队  
**审核人**: 待签字  

---

## 1. 引言

### 1.1 目的
本文档提供 SilkTalk Pro 系统的日常运维指南，包括监控、维护、故障处理和升级流程。

### 1.2 范围
涵盖生产环境的运维操作。

### 1.3 参考资料
- STP-DEP-001 部署手册
- STP-OPS-001 运维手册

---

## 2. 日常运维任务

### 2.1 每日检查清单

- [ ] 检查节点状态
- [ ] 检查日志异常
- [ ] 检查资源使用 (CPU/内存/磁盘)
- [ ] 检查连接数
- [ ] 检查网络连通性

### 2.2 每周检查清单

- [ ] 审查日志归档
- [ ] 检查磁盘空间
- [ ] 更新安全补丁
- [ ] 备份数据验证
- [ ] 性能基线对比

### 2.3 每月检查清单

- [ ] 完整系统备份
- [ ] 安全审计
- [ ] 容量规划审查
- [ ] 文档更新
- [ ] 灾难恢复演练

---

## 3. 监控

### 3.1 关键指标

| 指标 | 正常范围 | 警告阈值 | 严重阈值 |
|------|----------|----------|----------|
| CPU 使用率 | < 50% | 70% | 90% |
| 内存使用率 | < 70% | 80% | 95% |
| 磁盘使用率 | < 70% | 80% | 90% |
| 连接数 | < 250 | 280 | 300 |
| 消息延迟 | < 100ms | 500ms | 1000ms |
| 错误率 | < 0.1% | 1% | 5% |

### 3.2 监控命令

```bash
# 检查节点状态
silktalk status

# 查看资源使用
ps aux | grep silktalk
free -h
df -h

# 查看连接数
ss -tuln | grep 4001

# 查看日志
journalctl -u silktalk -f
```

### 3.3 告警配置

```bash
# 创建告警脚本
#!/bin/bash
# /usr/local/bin/silktalk-health-check.sh

STATUS=$(curl -s http://localhost:8080/health | jq -r '.status')
if [ "$STATUS" != "healthy" ]; then
  echo "SilkTalk node unhealthy" | mail -s "SilkTalk Alert" ops@example.com
fi
```

---

## 4. 日志管理

### 4.1 日志位置

| 日志类型 | 位置 | 保留时间 |
|----------|------|----------|
| 应用日志 | /var/log/silktalk/ | 30 天 |
| 系统日志 | journalctl | 7 天 |
| 审计日志 | /var/log/silktalk/audit/ | 90 天 |

### 4.2 日志轮转

```bash
# /etc/logrotate.d/silktalk
/var/log/silktalk/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 silktalk silktalk
    postrotate
        systemctl reload silktalk
    endscript
}
```

### 4.3 日志分析

```bash
# 查找错误
journalctl -u silktalk | grep ERROR

# 统计连接数
journalctl -u silktalk | grep "Peer connected" | wc -l

# 分析消息流量
journalctl -u silktalk | grep "Message received" | awk '{print $1}' | sort | uniq -c
```

---

## 5. 备份和恢复

### 5.1 备份策略

| 数据 | 频率 | 保留 | 存储位置 |
|------|------|------|----------|
| 身份密钥 | 创建时 | 永久 | 安全存储 |
| 配置文件 | 变更时 | 10 份 | 版本控制 |
| DHT 数据 | 每日 | 7 天 | 本地 + 远程 |
| 日志 | 实时 | 30 天 | 集中日志 |

### 5.2 自动备份脚本

```bash
#!/bin/bash
# /usr/local/bin/silktalk-backup.sh

BACKUP_DIR="/backup/silktalk/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# 备份配置
cp ~/.silktalk/config.json "$BACKUP_DIR/"

# 备份身份密钥
cp ~/.silktalk/identity.key "$BACKUP_DIR/"
chmod 600 "$BACKUP_DIR/identity.key"

# 备份 DHT 数据
tar czf "$BACKUP_DIR/dht-data.tar.gz" ~/.silktalk/data/

# 上传到远程存储
rsync -avz "$BACKUP_DIR/" backup-server:/backups/silktalk/

# 清理旧备份
find /backup/silktalk -type d -mtime +7 -exec rm -rf {} \;
```

### 5.3 恢复流程

```bash
# 1. 停止服务
sudo systemctl stop silktalk

# 2. 恢复配置
cp /backup/silktalk/20240101/config.json ~/.silktalk/

# 3. 恢复身份密钥
cp /backup/silktalk/20240101/identity.key ~/.silktalk/
chmod 600 ~/.silktalk/identity.key

# 4. 恢复数据
tar xzf /backup/silktalk/20240101/dht-data.tar.gz -C /

# 5. 启动服务
sudo systemctl start silktalk

# 6. 验证
silktalk status
```

---

## 6. 故障处理

### 6.1 故障分级

| 级别 | 定义 | 响应时间 | 解决时间 |
|------|------|----------|----------|
| P0 | 服务完全不可用 | 15 分钟 | 2 小时 |
| P1 | 核心功能受损 | 30 分钟 | 4 小时 |
| P2 | 非核心功能问题 | 2 小时 | 1 天 |
| P3 | 轻微问题 | 1 天 | 1 周 |

### 6.2 常见故障处理

#### 节点无法启动
```bash
# 症状: 服务启动失败

# 1. 检查日志
journalctl -u silktalk -n 100

# 2. 检查配置
silktalk config list

# 3. 检查权限
ls -la ~/.silktalk/

# 4. 检查端口
sudo lsof -i :4001

# 5. 修复步骤
sudo systemctl stop silktalk
sudo rm -f ~/.silktalk/*.lock
sudo systemctl start silktalk
```

#### 连接数过高
```bash
# 症状: 连接数接近上限

# 1. 查看当前连接
silktalk peers

# 2. 调整连接限制
silktalk config set connection.maxConnections 400
sudo systemctl restart silktalk

# 3. 检查是否有异常连接
journalctl -u silktalk | grep "Peer connected" | tail -20
```

#### 内存泄漏
```bash
# 症状: 内存持续增长

# 1. 监控内存使用
watch -n 5 'ps aux | grep silktalk'

# 2. 生成堆转储
# 需要启用 --inspect 标志

# 3. 临时缓解
sudo systemctl restart silktalk

# 4. 长期修复
# 联系开发团队分析堆转储
```

#### 网络分区
```bash
# 症状: 无法发现或连接到对等点

# 1. 检查网络连通性
ping 8.8.8.8

# 2. 检查端口开放
nc -zv localhost 4001

# 3. 检查 NAT 类型
# 查看日志中的 NAT 检测结果

# 4. 检查引导节点
silktalk config get discovery.bootstrap

# 5. 修复步骤
# 添加新的引导节点
silktalk config set discovery.bootstrap '["/dns4/new-bootstrap.example.com/tcp/4001/p2p/..."]'
sudo systemctl restart silktalk
```

### 6.3 紧急恢复流程

```bash
# 1. 通知相关人员
# 2. 收集诊断信息
sudo systemctl status silktalk > /tmp/silktalk-status.txt
journalctl -u silktalk -n 1000 > /tmp/silktalk-logs.txt

# 3. 尝试重启
sudo systemctl restart silktalk

# 4. 如果重启失败，回滚到上一个版本
# 5. 如果仍失败，启用备用节点
```

---

## 7. 升级管理

### 7.1 升级前检查

- [ ] 阅读版本发布说明
- [ ] 在测试环境验证
- [ ] 备份当前配置和数据
- [ ] 通知用户维护窗口
- [ ] 准备回滚方案

### 7.2 升级流程

```bash
# 1. 停止服务
sudo systemctl stop silktalk

# 2. 备份
cp -r ~/.silktalk ~/.silktalk.backup.$(date +%Y%m%d)

# 3. 升级
npm update -g silktalk-pro

# 4. 验证版本
silktalk --version

# 5. 启动服务
sudo systemctl start silktalk

# 6. 验证状态
silktalk status

# 7. 监控日志
journalctl -u silktalk -f
```

### 7.3 回滚流程

```bash
# 1. 停止服务
sudo systemctl stop silktalk

# 2. 恢复备份
rm -rf ~/.silktalk
cp -r ~/.silktalk.backup.20240101 ~/.silktalk

# 3. 降级 (如果需要)
npm install -g silktalk-pro@1.0.0

# 4. 启动服务
sudo systemctl start silktalk
```

---

## 8. 安全管理

### 8.1 访问控制

```bash
# 配置防火墙
sudo ufw default deny incoming
sudo ufw allow from 10.0.0.0/8 to any port 4001
sudo ufw allow from 192.168.0.0/16 to any port 4001
sudo ufw enable
```

### 8.2 密钥管理

```bash
# 定期轮换密钥 (可选)
# 1. 生成新密钥
silktalk config init --force

# 2. 通知对等点新身份
# 3. 更新授权列表
```

### 8.3 安全审计

```bash
# 查看登录尝试
journalctl | grep "Failed"

# 查看异常连接
journalctl -u silktalk | grep -i "error\|warn"

# 生成审计报告
#!/bin/bash
# /usr/local/bin/silktalk-audit.sh

echo "=== SilkTalk Security Audit ==="
echo "Date: $(date)"
echo ""
echo "=== Node Status ==="
silktalk status

echo ""
echo "=== Recent Connections ==="
journalctl -u silktalk --since "24 hours ago" | grep "Peer connected" | wc -l

echo ""
echo "=== Errors in Last 24h ==="
journalctl -u silktalk --since "24 hours ago" | grep ERROR | wc -l

echo ""
echo "=== File Permissions ==="
ls -la ~/.silktalk/
```

---

## 9. 性能优化

### 9.1 性能调优参数

```json
{
  "connection": {
    "maxConnections": 500,
    "minConnections": 20,
    "maxConnectionsPerPeer": 10
  },
  "logging": {
    "level": "warn"
  }
}
```

### 9.2 系统调优

```bash
# 增加文件描述符限制
# /etc/security/limits.conf
silktalk soft nofile 65536
silktalk hard nofile 65536

# 优化网络参数
# /etc/sysctl.conf
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
```

---

## 10. 附录

### 10.1 常用命令速查

```bash
# 启动/停止/重启
sudo systemctl start silktalk
sudo systemctl stop silktalk
sudo systemctl restart silktalk

# 查看状态
sudo systemctl status silktalk
silktalk status

# 查看日志
journalctl -u silktalk -f
journalctl -u silktalk -n 100

# 配置管理
silktalk config list
silktalk config get <key>
silktalk config set <key> <value>

# 对等点管理
silktalk peers
silktalk connect <multiaddr>
```

### 10.2 联系信息

| 角色 | 联系方式 | 职责 |
|------|----------|------|
| 运维团队 | ops@example.com | 日常运维 |
| 开发团队 | dev@example.com | 技术支持 |
| 安全团队 | security@example.com | 安全事件 |

### 10.3 变更历史

| 版本 | 日期 | 作者 | 变更描述 |
|------|------|------|----------|
| 1.0.0 | 2026-02-22 | SilkTalk DevOps | 初始版本 |

### 10.4 批准签字

**运维负责人**: _________________ 日期: _______

**安全负责人**: _________________ 日期: _______

**项目经理**: _________________ 日期: _______

---

**文档结束**
