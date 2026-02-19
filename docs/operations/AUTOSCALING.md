# 自动扩缩容设计

## 策略

| 指标 | 扩容阈值 | 缩容阈值 | 步长 |
|------|---------|---------|------|
| CPU | > 70% | < 30% | +1/-1 |
| 内存 | > 80% | < 40% | +1/-1 |
| QPS | > 8000 | < 2000 | +2/-1 |
| 连接数 | > 8000 | < 2000 | +1/-1 |

## K8s HPA配置

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: kimiclaw-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: kimiclaw-db
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: kimiclaw_active_connections
        target:
          type: AverageValue
          averageValue: "8000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

## 自定义指标扩缩容

```typescript
// src/scaling/scaler.ts
import { K8sClient } from '@kubernetes/client-node';

export class AutoScaler {
  private k8s: K8sClient;
  private metrics: MetricsClient;

  async evaluate(): Promise<ScalingDecision> {
    const metrics = await this.collectMetrics();
    
    // 预测性扩容：根据趋势提前扩容
    const prediction = this.predictLoad(metrics);
    
    if (prediction.forecast > 0.8) {
      return {
        action: 'scale_up',
        reason: `预测负载将升至 ${(prediction.forecast * 100).toFixed(1)}%`,
        replicas: this.calculateTarget(metrics),
      };
    }

    // 反应式扩容
    if (metrics.cpu > 0.7 || metrics.memory > 0.8) {
      return {
        action: 'scale_up',
        reason: `当前负载 CPU:${(metrics.cpu * 100).toFixed(1)}%`,
        replicas: metrics.currentReplicas + 1,
      };
    }

    // 缩容
    if (metrics.cpu < 0.3 && metrics.memory < 0.4) {
      return {
        action: 'scale_down',
        reason: '负载较低',
        replicas: Math.max(metrics.currentReplicas - 1, 2),
      };
    }

    return { action: 'maintain' };
  }

  // 负载预测（简单线性回归）
  private predictLoad(metrics: MetricsHistory): Prediction {
    const recent = metrics.slice(-10); // 最近10个点
    const trend = this.calculateTrend(recent);
    const forecast = recent[recent.length - 1].cpu + trend * 5; // 预测5分钟后
    
    return { forecast: Math.min(forecast, 1.0) };
  }
}
```

## 数据库垂直扩容

```yaml
# 自动调整DuckDB内存和线程
apiVersion: v1
kind: ConfigMap
metadata:
  name: duckdb-config
data:
  memory_limit: "4GB"
  threads: "4"
---
# 根据节点资源动态调整
apiVersion: autoscaling/v2
kind: VerticalPodAutoscaler
metadata:
  name: kimiclaw-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: kimiclaw-db
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
      - containerName: kimiclaw
        minAllowed:
          memory: 2Gi
          cpu: 500m
        maxAllowed:
          memory: 16Gi
          cpu: 4000m
```

## 冷却与稳定性

```typescript
// 防止震荡
class ScalingCooldown {
  private lastScaleTime: number = 0;
  private scaleCount: number = 0;

  canScale(): boolean {
    const now = Date.now();
    const timeSinceLastScale = now - this.lastScaleTime;
    
    // 扩容后5分钟内不缩容
    if (this.scaleCount > 0 && timeSinceLastScale < 5 * 60 * 1000) {
      return false;
    }
    
    // 缩容后10分钟内不扩容
    if (this.scaleCount < 0 && timeSinceLastScale < 10 * 60 * 1000) {
      return false;
    }
    
    return true;
  }
}
```