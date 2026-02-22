#!/bin/bash
#
# SilkTalk One-Click Deploy Script
# 一键部署脚本 - 检查、安装、启动
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="silktalk-verify"
INSTALL_DIR="${1:-$HOME/$PROJECT_NAME}"
NODE_NAME="${2:-node}"
NODE_PORT="${3:-10001}"
BOOTSTRAP="${4:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Header
echo "========================================"
echo "  SilkTalk One-Click Deploy"
echo "========================================"
echo ""

# Step 1: Check Node.js
log "Step 1/5: Checking Node.js..."
if command -v node > /dev/null 2>&1; then
  NODE_VERSION=$(node --version | sed 's/v//')
  success "Node.js found: $NODE_VERSION"
else
  warn "Node.js not found, will attempt to install"
fi

# Step 2: Run environment check
log "Step 2/5: Running environment check..."
cd "$SCRIPT_DIR/.."
if [ -f "scripts/check-env.js" ]; then
  node scripts/check-env.js
  CHECK_RESULT=$?
  if [ $CHECK_RESULT -ne 0 ]; then
    warn "Environment check found issues"
    read -p "Continue with installation? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
else
  warn "check-env.js not found, skipping detailed check"
fi

# Step 3: Install dependencies
log "Step 3/5: Installing dependencies..."
if [ -f "package.json" ]; then
  if [ -d "node_modules" ]; then
    log "node_modules exists, checking for updates..."
  else
    log "Installing npm packages..."
    npm install
  fi
  success "Dependencies ready"
else
  error "package.json not found. Are you in the right directory?"
  exit 1
fi

# Step 4: Configure environment
log "Step 4/5: Configuring environment..."

# Create .env file if not exists
if [ ! -f ".env" ]; then
  cat > .env << EOF
# SilkTalk Configuration
SILKTALK_NODE_NAME=$NODE_NAME
SILKTALK_NODE_PORT=$NODE_PORT
SILKTALK_LOG_LEVEL=info
EOF
  success "Created .env configuration"
fi

# Check firewall
if command -v ufw > /dev/null 2>&1; then
  UFW_STATUS=$(sudo ufw status | grep -i "status:" | awk '{print $2}')
  if [ "$UFW_STATUS" = "active" ]; then
    warn "UFW is active, opening port $NODE_PORT..."
    sudo ufw allow ${NODE_PORT}/tcp && success "Port $NODE_PORT opened"
  fi
fi

# Step 5: Start node
log "Step 5/5: Starting SilkTalk node..."
echo ""
echo "----------------------------------------"
echo "  Node Name: $NODE_NAME"
echo "  Port: $NODE_PORT"
echo "  Bootstrap: ${BOOTSTRAP:-none}"
echo "  Mode: daemon (background)"
echo "----------------------------------------"
echo ""

# Kill existing nodes on the same port
EXISTING_PID=$(lsof -ti:$NODE_PORT 2>/dev/null || netstat -tlnp 2>/dev/null | grep ":$NODE_PORT " | awk '{print $7}' | cut -d'/' -f1)
if [ -n "$EXISTING_PID" ]; then
  warn "Port $NODE_PORT is in use, killing existing process..."
  kill $EXISTING_PID 2>/dev/null || true
  sleep 2
fi

# Start node in daemon mode
LOG_FILE="/tmp/silktalk-${NODE_NAME}.log"
PID_FILE="/tmp/silktalk-${NODE_NAME}.pid"

if [ -n "$BOOTSTRAP" ]; then
  nohup node src/index.js --name "$NODE_NAME" --port "$NODE_PORT" --bootstrap "$BOOTSTRAP" --daemon > "$LOG_FILE" 2>&1 &
else
  nohup node src/index.js --name "$NODE_NAME" --port "$NODE_PORT" --daemon > "$LOG_FILE" 2>&1 &
fi

NODE_PID=$!
echo $NODE_PID > "$PID_FILE"

sleep 3

# Check if process is running
if ps -p $NODE_PID > /dev/null 2>&1; then
  success "Node started successfully (PID: $NODE_PID)"
  log "Log file: $LOG_FILE"
  log "PID file: $PID_FILE"
  
  # Show PeerId if available
  if [ -f "$LOG_FILE" ]; then
    PEER_ID=$(grep "PeerId:" "$LOG_FILE" | tail -1 | awk '{print $2}')
    if [ -n "$PEER_ID" ]; then
      success "PeerId: $PEER_ID"
    fi
  fi
  
  echo ""
  echo "To check status: tail -f $LOG_FILE"
  echo "To stop node: kill $(cat $PID_FILE)"
else
  error "Node failed to start. Check log: $LOG_FILE"
  exit 1
fi
