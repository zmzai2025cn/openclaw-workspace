#!/usr/bin/env bash
#
# SilkTalk Remote Deploy
# 从本地部署到远程服务器
#

set -e

REMOTE_HOST="${1:-}"
REMOTE_USER="${2:-root}"
REMOTE_DIR="${3:-/opt/silktalk}"
NODE_NAME="${4:-nodeB}"
NODE_PORT="${5:-10002}"
BOOTSTRAP="${6:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[REMOTE]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validate input
if [ -z "$REMOTE_HOST" ]; then
  error "Usage: $0 <remote_host> [remote_user] [remote_dir] [node_name] [port] [bootstrap]"
  error "Example: $0 192.168.1.100 root /opt/silktalk nodeB 10002 /ip4/192.168.1.101/tcp/10001/p2p/Qm..."
  exit 1
fi

echo "========================================"
echo "  SilkTalk Remote Deploy"
echo "========================================"
echo ""
log "Target: $REMOTE_USER@$REMOTE_HOST"
log "Remote Directory: $REMOTE_DIR"
log "Node Name: $NODE_NAME"
log "Port: $NODE_PORT"
log "Bootstrap: ${BOOTSTRAP:-none}"
echo ""

# Step 1: Prepare local package
log "Step 1/4: Preparing deployment package..."
TEMP_DIR=$(mktemp -d)
PACKAGE_NAME="silktalk-deploy-$(date +%Y%m%d-%H%M%S).tar.gz"

cd "$PROJECT_ROOT"
# Exclude node_modules and .git
tar czf "$TEMP_DIR/$PACKAGE_NAME" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='*.log' \
  .

success "Package created: $PACKAGE_NAME ($(du -h "$TEMP_DIR/$PACKAGE_NAME" | cut -f1))"

# Step 2: Upload to remote
log "Step 2/4: Uploading to remote server..."
scp "$TEMP_DIR/$PACKAGE_NAME" "$REMOTE_USER@$REMOTE_HOST:/tmp/"
if [ $? -eq 0 ]; then
  success "Upload complete"
else
  error "Upload failed"
  rm -rf "$TEMP_DIR"
  exit 1
fi

# Step 3: Execute remote installation
log "Step 3/4: Executing remote installation..."

REMOTE_SCRIPT=$(cat << 'EOF'
#!/bin/bash
set -e

PACKAGE="$1"
INSTALL_DIR="$2"
NODE_NAME="$3"
NODE_PORT="$4"
BOOTSTRAP="$5"

echo "[REMOTE] Extracting package..."
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
tar xzf "/tmp/$PACKAGE" -C "$INSTALL_DIR"

echo "[REMOTE] Installing dependencies..."
if [ -f "package.json" ]; then
  npm install --production
fi

echo "[REMOTE] Setting permissions..."
chmod +x scripts/*.sh 2>/dev/null || true

echo "[REMOTE] Checking environment..."
if ! command -v node > /dev/null 2>&1; then
  echo "[REMOTE] Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "[REMOTE] Configuration complete"
echo "[REMOTE] Installation directory: $INSTALL_DIR"
echo "[REMOTE] To start the node, run:"
echo "[REMOTE]   cd $INSTALL_DIR && node src/index.js --name $NODE_NAME --port $NODE_PORT${BOOTSTRAP:+ --bootstrap $BOOTSTRAP}"
EOF
)

# Execute remote script
ssh "$REMOTE_USER@$REMOTE_HOST" "bash -s" << EOF
$REMOTE_SCRIPT
EOF

ssh "$REMOTE_USER@$REMOTE_HOST" "bash -s" << EOF
REMOTE_SCRIPT="$(echo "$REMOTE_SCRIPT")"
bash -c "$REMOTE_SCRIPT" _ "$PACKAGE_NAME" "$REMOTE_DIR" "$NODE_NAME" "$NODE_PORT" "$BOOTSTRAP"
EOF

if [ $? -eq 0 ]; then
  success "Remote installation complete"
else
  error "Remote installation failed"
  rm -rf "$TEMP_DIR"
  exit 1
fi

# Step 4: Start remote node (optional)
log "Step 4/4: Starting remote node..."
echo ""
read -p "Start the remote node now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  log "Starting node on remote server..."
  
  # Use daemon mode for background running
  if [ -n "$BOOTSTRAP" ]; then
    ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && nohup node src/index.js --name $NODE_NAME --port $NODE_PORT --bootstrap '$BOOTSTRAP' --daemon > /tmp/silktalk-$NODE_NAME.log 2>&1 & echo \"Started with PID: \$!\""
  else
    ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_DIR && nohup node src/index.js --name $NODE_NAME --port $NODE_PORT --daemon > /tmp/silktalk-$NODE_NAME.log 2>&1 & echo \"Started with PID: \$!\""
  fi
  
  success "Remote node started in daemon mode"
  log "To check logs: ssh $REMOTE_USER@$REMOTE_HOST 'tail -f /tmp/silktalk-$NODE_NAME.log'"
  log "To stop: ssh $REMOTE_USER@$REMOTE_HOST 'pkill -f silktalk'"
else
  log "To start manually, run:"
  log "  ssh $REMOTE_USER@$REMOTE_HOST"
  log "  cd $REMOTE_DIR"
  if [ -n "$BOOTSTRAP" ]; then
    log "  ./scripts/deploy.sh $NODE_NAME $NODE_PORT \"$BOOTSTRAP\""
  else
    log "  ./scripts/deploy.sh $NODE_NAME $NODE_PORT"
  fi
fi

# Cleanup
rm -rf "$TEMP_DIR"
ssh "$REMOTE_USER@$REMOTE_HOST" "rm -f /tmp/$PACKAGE_NAME" 2>/dev/null || true

echo ""
echo "========================================"
success "Remote deployment complete!"
echo "========================================"
