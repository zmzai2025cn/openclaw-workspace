# Kimiclaw 完整文档索引

## 📚 文档总览

本文档库包含 **23份文档**，覆盖产品全生命周期。

| 类别 | 数量 | 说明 |
|------|------|------|
| 项目文档 | 6 | 概览、交付、测试 |
| 架构设计 | 8 | 系统架构、技术方案 |
| 运维手册 | 4 | 部署、监控、灾备 |
| 用户指南 | 3 | 使用手册、FAQ |
| 开发指南 | 2 | 开发规范、API |

---

## 🚀 快速入口

### 新用户
1. [README.md](../README.md) - 项目概览
2. [QUICKSTART.md](../QUICKSTART.md) - 5分钟快速开始
3. [USER_MANUAL.md](USER_MANUAL.md) - 使用手册

### 开发者
1. [DEVELOPMENT.md](DEVELOPMENT.md) - 开发指南
2. [ARCHITECTURE.md](ARCHITECTURE.md) - 架构设计
3. [API.md](API.md) - API文档

### 运维人员
1. [DEPLOY_GUIDE.md](../DEPLOY_GUIDE.md) - 部署指南
2. [OPERATIONS.md](OPERATIONS.md) - 运维手册
3. [MONITORING.md](operations/MONITORING.md) - 监控大盘

### 架构师
1. [architecture/HA_DESIGN.md](architecture/HA_DESIGN.md) - 高可用设计
2. [architecture/PARTITION_DESIGN.md](architecture/PARTITION_DESIGN.md) - 数据分区
3. [architecture/CONFIG_CENTER.md](architecture/CONFIG_CENTER.md) - 配置中心

---

## 📖 完整文档清单

### 项目文档 (6)
| 文档 | 说明 | 更新日期 |
|------|------|----------|
| [README.md](../README.md) | 项目概览和快速链接 | 2026-02-20 |
| [QUICKSTART.md](../QUICKSTART.md) | 5分钟快速开始指南 | 2026-02-20 |
| [DEPLOY_GUIDE.md](../DEPLOY_GUIDE.md) | 生产部署详细指南 | 2026-02-20 |
| [PACKAGE.md](../PACKAGE.md) | 交付包清单 | 2026-02-20 |
| [FINAL_DELIVERY.md](../FINAL_DELIVERY.md) | 最终交付说明 | 2026-02-20 |
| [FINAL_TEST_REPORT.md](../FINAL_TEST_REPORT.md) | 测试报告 | 2026-02-20 |

### 架构设计 (8)
| 文档 | 说明 | 更新日期 |
|------|------|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 系统架构总览 | 2026-02-20 |
| [architecture/HA_DESIGN.md](architecture/HA_DESIGN.md) | 高可用架构设计 | 2026-02-20 |
| [architecture/PARTITION_DESIGN.md](architecture/PARTITION_DESIGN.md) | 数据分区策略 | 2026-02-20 |
| [architecture/CONFIG_CENTER.md](architecture/CONFIG_CENTER.md) | 配置中心设计 | 2026-02-20 |
| [architecture/AUTO_UPDATE.md](architecture/AUTO_UPDATE.md) | 自动更新机制 | 2026-02-20 |
| [SECURITY.md](SECURITY.md) | 安全白皮书 | 2026-02-20 |
| [CODE_REVIEW.md](CODE_REVIEW.md) | 代码审查报告 | 2026-02-20 |
| [CHANGELOG.md](CHANGELOG.md) | 版本历史 | 2026-02-20 |

### 运维手册 (4)
| 文档 | 说明 | 更新日期 |
|------|------|----------|
| [OPERATIONS.md](OPERATIONS.md) | 运维手册总览 | 2026-02-20 |
| [operations/MONITORING.md](operations/MONITORING.md) | 监控大盘设计 | 2026-02-20 |
| [operations/ALERTING.md](operations/ALERTING.md) | 告警分级体系 | 2026-02-20 |
| [operations/AUTOSCALING.md](operations/AUTOSCALING.md) | 自动扩缩容 | 2026-02-20 |
| [operations/DISASTER_RECOVERY.md](operations/DISASTER_RECOVERY.md) | 灾备与恢复 | 2026-02-20 |

### 用户指南 (3)
| 文档 | 说明 | 更新日期 |
|------|------|----------|
| [USER_MANUAL.md](USER_MANUAL.md) | 用户操作手册 | 2026-02-20 |
| [FAQ.md](FAQ.md) | 常见问题解答 | 2026-02-20 |
| [API.md](API.md) | API接口文档 | 2026-02-20 |

### 开发指南 (2)
| 文档 | 说明 | 更新日期 |
|------|------|----------|
| [DEVELOPMENT.md](DEVELOPMENT.md) | 开发规范指南 | 2026-02-20 |
| [API.md](API.md) | API接口文档 | 2026-02-20 |

---

## 🔗 文档依赖关系

```
README
  ├── QUICKSTART (快速开始)
  ├── DEPLOY_GUIDE (部署)
  │     ├── architecture/HA_DESIGN
  │     ├── architecture/PARTITION_DESIGN
  │     └── operations/DISASTER_RECOVERY
  ├── USER_MANUAL (使用)
  │     └── FAQ
  ├── DEVELOPMENT (开发)
  │     ├── ARCHITECTURE
  │     ├── API
  │     └── CODE_REVIEW
  └── OPERATIONS (运维)
        ├── MONITORING
        ├── ALERTING
        ├── AUTOSCALING
        └── DISASTER_RECOVERY
```

---

## 📊 文档统计

| 指标 | 数值 |
|------|------|
| 总文档数 | 23 |
| 总字数 | ~30,000 |
| 代码示例 | 50+ |
| 架构图 | 10+ |
| 配置模板 | 20+ |

---

## 📝 文档规范

### 文件命名
- 使用大驼峰或kebab-case
- 避免空格和特殊字符
- 英文优先，必要时中文注释

### 更新维护
- 重大变更更新日期
- 版本历史记录在CHANGELOG
- 废弃文档移至archive/

### 审查流程
1. 技术准确性审查
2. 可读性审查
3. 完整性审查
4. 定期更新（季度）

---

## 🆘 获取帮助

- 文档问题：docs@kimiclaw.com
- 技术支持：support@kimiclaw.com
- 贡献文档：提交PR到docs/目录