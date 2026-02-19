# 告警分级体系

## 分级策略

| 级别 | 名称 | 响应时间 | 通知方式 | 示例 |
|------|------|---------|----------|------|
| P0 | 紧急 | 5分钟 | 电话+短信+邮件 | 服务宕机、数据丢失 |
| P1 | 严重 | 15分钟 | 短信+邮件+Slack | 性能严重下降、磁盘满 |
| P2 | 一般 | 1小时 | 邮件+Slack | 错误率升高、备份失败 |
| P3 | 提示 | 4小时 | 邮件 | 配置变更、版本更新 |

## 告警规则

```yaml
# alertmanager/rules.yml
groups:
  - name: kimiclaw-critical
    rules:
      # P0: 服务宕机
      - alert: ServiceDown
        expr: up{job="kimiclaw"} == 0
        for: 1m
        labels:
          severity: p0
        annotations:
          summary: "Kimiclaw服务宕机"
          description: "服务 {{ $labels.instance }} 已宕机超过1分钟"

      # P0: 数据写入失败
      - alert: WriteFailure
        expr: rate(kimiclaw_events_stored_total{status="error"}[5m]) > 0.1
        for: 2m
        labels:
          severity: p0
        annotations:
          summary: "数据写入大量失败"
          description: "错误率超过10%，可能影响数据完整性"

  - name: kimiclaw-high
    rules:
      # P1: 磁盘即将满
      - alert: DiskFull
        expr: (kimiclaw_disk_usage_bytes / kimiclaw_disk_total_bytes) > 0.85
        for: 5m
        labels:
          severity: p1
        annotations:
          summary: "磁盘使用率超过85%"
          description: "当前使用率: {{ $value | humanizePercentage }}"

      # P1: 响应延迟高
      - alert: HighLatency
        expr: histogram_quantile(0.95, kimiclaw_processing_duration_seconds_bucket) > 1
        for: 5m
        labels:
          severity: p1
        annotations:
          summary: "P95延迟超过1秒"

  - name: kimiclaw-medium
    rules:
      # P2: 错误率升高
      - alert: ErrorRate
        expr: rate(kimiclaw_events_stored_total{status="error"}[5m]) > 0.01
        for: 10m
        labels:
          severity: p2
        annotations:
          summary: "错误率超过1%"

      # P2: 备份失败
      - alert: BackupFailed
        expr: kimiclaw_backup_last_success < (time() - 86400)
        for: 1h
        labels:
          severity: p2
        annotations:
          summary: "24小时内无成功备份"
```

## 告警抑制与聚合

```yaml
# alertmanager/config.yml
global:
  smtp_smarthost: 'smtp.company.com:587'
  smtp_from: 'alert@kimiclaw.com'

route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'
  routes:
    - match:
        severity: p0
      receiver: 'oncall'
      group_wait: 0s
      repeat_interval: 5m
    - match:
        severity: p1
      receiver: 'team'
      repeat_interval: 30m

inhibit_rules:
  # 高优先级告警抑制低优先级
  - source_match:
      severity: p0
    target_match:
      severity: p1
    equal: ['instance']

receivers:
  - name: 'default'
    email_configs:
      - to: 'ops@company.com'

  - name: 'oncall'
    pagerduty_configs:
      - service_key: 'xxx'
    slack_configs:
      - api_url: 'https://hooks.slack.com/xxx'
        channel: '#alerts-p0'

  - name: 'team'
    slack_configs:
      - api_url: 'https://hooks.slack.com/xxx'
        channel: '#alerts'
```

## 告警处理流程

```
告警触发
    │
    ▼
┌─────────────┐
│  告警聚合    │
│  (去重/抑制) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  分级路由    │
│  P0/P1/P2/P3 │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  通知发送    │
│  电话/短信/邮件│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  值班响应    │
│  确认/处理   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  告警关闭    │
│  记录复盘    │
└─────────────┘
```

## 值班轮换

```yaml
# oncall/schedule.yml
team:
  - name: "张三"
    phone: "+86-138-xxxx-xxxx"
    slack: "@zhangsan"
  - name: "李四"
    phone: "+86-139-xxxx-xxxx"
    slack: "@lisi"

schedule:
  type: "weekly"  # weekly/daily
  rotation: 2     # 每2周轮换
  handoff: "周一 09:00"
```