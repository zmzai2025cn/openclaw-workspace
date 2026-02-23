#!/bin/bash
# deploy.sh - 发布脚本

set -e

VERSION=${1:-latest}
IMAGE_PREFIX=${DOCKER_REGISTRY:-"localhost:5000/clawchat"}

echo "=== Deploying ClawChat v${VERSION} ==="

# 1. 构建镜像
echo "[1/5] Building images..."
docker build -t ${IMAGE_PREFIX}/server:${VERSION} ./server
docker build -t ${IMAGE_PREFIX}/client:${VERSION} ./client

# 2. 测试镜像
echo "[2/5] Testing images..."
docker run --rm ${IMAGE_PREFIX}/server:${VERSION} node --version
docker run --rm ${IMAGE_PREFIX}/client:${VERSION} node --version

# 3. 推送镜像 (如果有registry)
if [ -n "$DOCKER_REGISTRY" ]; then
  echo "[3/5] Pushing images..."
  docker push ${IMAGE_PREFIX}/server:${VERSION}
  docker push ${IMAGE_PREFIX}/client:${VERSION}
else
  echo "[3/5] Skipping push (no DOCKER_REGISTRY set)"
fi

# 4. 备份当前版本 (如果有kubectl)
if command -v kubectl &> /dev/null; then
  echo "[4/5] Creating backup..."
  kubectl get deployment clawchat-server -o yaml > backup-$(date +%Y%m%d-%H%M%S).yaml 2>/dev/null || echo "No existing deployment to backup"
  
  # 5. 滚动更新
  echo "[5/5] Rolling update..."
  kubectl set image deployment/clawchat-server server=${IMAGE_PREFIX}/server:${VERSION}
  kubectl rollout status deployment/clawchat-server --timeout=300s
else
  echo "[4/5] Skipping backup (kubectl not found)"
  echo "[5/5] Deploying with docker-compose..."
  VERSION=${VERSION} docker-compose up -d clawchat-server
fi

echo "✓ Deployment complete"