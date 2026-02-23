#!/bin/bash
# rollback.sh - 回滚脚本

set -e

echo "=== Rolling Back ClawChat ==="

if command -v kubectl &> /dev/null; then
  # 1. 查看历史版本
  echo "[1/3] Checking rollout history..."
  kubectl rollout history deployment/clawchat-server

  # 2. 执行回滚
  echo "[2/3] Rolling back..."
  kubectl rollout undo deployment/clawchat-server

  # 3. 验证回滚
  echo "[3/3] Verifying rollback..."
  kubectl rollout status deployment/clawchat-server --timeout=300s
  kubectl get pods -l app=clawchat-server
else
  echo "[1/2] Stopping current containers..."
  docker-compose down
  
  echo "[2/2] Starting previous version..."
  docker-compose up -d clawchat-server
  
  echo "Current containers:"
  docker-compose ps
fi

echo "✓ Rollback complete"