# 监控大盘设计

## 架构

```
┌─────────────────────────────────────────┐
│              数据采集层                  │
│  Metrics (Prometheus)                   │
│  Logs (Loki)                            │
│  Traces (Jaeger)                        │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│              存储层                      │
│  Prometheus TSDB (指标)                  │
│  Loki (日志)                             │
│  Grafana (可视化)                        │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│              展示层                      │
│  Grafana Dashboard                       │
│  - 系统概览                               │
│  - 业务指标                               │
│  - 告警列表                               │
└─────────────────────────────────────────┘
```

## 指标定义

```typescript
// src/metrics/definitions.ts
import { Counter, Histogram, Gauge } from 'prom-client';

// 业务指标
export const eventsReceived = new Counter({
  name: 'kimiclaw_events_received_total',
  help: 'Total events received',
  labelNames: ['source', 'type'],
});

export const eventsStored = new Counter({
  name: 'kimiclaw_events_stored_total',
  help: 'Total events stored',
  labelNames: ['status'],
});

export const processingDuration = new Histogram({
  name: 'kimiclaw_processing_duration_seconds',
  help: 'Event processing duration',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const activeConnections = new Gauge({
  name: 'kimiclaw_active_connections',
  help: 'Number of active client connections',
});

export const bufferSize = new Gauge({
  name: 'kimiclaw_buffer_size',
  help: 'Current buffer size',
});

export const diskUsage = new Gauge({
  name: 'kimiclaw_disk_usage_bytes',
  help: 'Disk usage in bytes',
  labelNames: ['type'],
});
```

## Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Kimiclaw Overview",
    "panels": [
      {
        "title": "Events Rate",
        "type": "graph",
        "targets": [{
          "expr": "rate(kimiclaw_events_received_total[5m])"
        }]
      },
      {
        "title": "Processing Latency",
        "type": "heatmap",
        "targets": [{
          "expr": "kimiclaw_processing_duration_seconds_bucket"
        }]
      },
      {
        "title": "Active Connections",
        "type": "stat",
        "targets": [{
          "expr": "kimiclaw_active_connections"
        }]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [{
          "expr": "rate(kimiclaw_events_stored_total{status='error'}[5m])"
        }]
      },
      {
        "title": "Disk Usage",
        "type": "gauge",
        "targets": [{
          "expr": "kimiclaw_disk_usage_bytes / kimiclaw_disk_total_bytes"
        }],
        "fieldConfig": {
          "thresholds": {
            "steps": [
              {"value": 0, "color": "green"},
              {"value": 0.7, "color": "yellow"},
              {"value": 0.85, "color": "red"}
            ]
          }
        }
      }
    ]
  }
}
```

## 部署

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    volumes:
      - grafana-data:/var/lib/grafana
      - ./dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3001:3000"

  loki:
    image: grafana/loki
    volumes:
      - ./loki-config.yml:/etc/loki/local-config.yaml
    ports:
      - "3100:3100"

volumes:
  prometheus-data:
  grafana-data:
```