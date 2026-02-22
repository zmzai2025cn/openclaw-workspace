#!/bin/bash
#
# SilkTalk Pro Deployment Script
# One-click deployment for P2P communication nodes
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
INSTALL_DIR="${INSTALL_DIR:-/opt/silktalk}"
SERVICE_USER="${SERVICE_USER:-silktalk}"
NODE_PORT="${NODE_PORT:-4001}"
WS_PORT="${WS_PORT:-8080}"
LOG_LEVEL="${LOG_LEVEL:-info}"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18+ required. Found: $(node --version)"
        exit 1
    fi
    
    log_success "Node.js $(node --version) found"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    log_success "npm $(npm --version) found"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$(dirname "$0")/.."
    
    if [ -f "package.json" ]; then
        npm install
        log_success "Dependencies installed"
    else
        log_error "package.json not found"
        exit 1
    fi
}

# Build the project
build_project() {
    log_info "Building project..."
    
    cd "$(dirname "$0")/.."
    
    npm run build
    
    log_success "Build completed"
}

# Create service user
create_service_user() {
    log_info "Creating service user..."
    
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd -r -s /bin/false -d "$INSTALL_DIR" "$SERVICE_USER"
        log_success "Service user $SERVICE_USER created"
    else
        log_warn "Service user $SERVICE_USER already exists"
    fi
}

# Install files
install_files() {
    log_info "Installing files to $INSTALL_DIR..."
    
    # Create directories
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$INSTALL_DIR/logs"
    mkdir -p "/etc/silktalk"
    
    # Copy files
    cp -r dist "$INSTALL_DIR/"
    cp package.json "$INSTALL_DIR/"
    cp -r node_modules "$INSTALL_DIR/"
    
    # Set permissions
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
    
    log_success "Files installed"
}

# Create systemd service
create_systemd_service() {
    log_info "Creating systemd service..."
    
    cat > /etc/systemd/system/silktalk.service << EOF
[Unit]
Description=SilkTalk Pro P2P Node
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/dist/cli/index.js start --port $NODE_PORT --ws-port $WS_PORT --log-level $LOG_LEVEL
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    log_success "Systemd service created"
}

# Create configuration
create_config() {
    log_info "Creating default configuration..."
    
    cat > "/etc/silktalk/config.json" << EOF
{
  "listenAddresses": [
    "/ip4/0.0.0.0/tcp/$NODE_PORT",
    "/ip4/0.0.0.0/tcp/$WS_PORT/ws"
  ],
  "transports": {
    "tcp": true,
    "websocket": true
  },
  "discovery": {
    "mdns": true,
    "dht": true,
    "bootstrap": []
  },
  "nat": {
    "upnp": true,
    "autonat": true,
    "dcutr": true
  },
  "relay": {
    "enabled": true,
    "autoRelay": {
      "enabled": true,
      "maxListeners": 2
    }
  },
  "logging": {
    "level": "$LOG_LEVEL",
    "pretty": false
  }
}
EOF

    log_success "Configuration created"
}

# Start service
start_service() {
    log_info "Starting SilkTalk service..."
    
    systemctl enable silktalk
    systemctl start silktalk
    
    sleep 2
    
    if systemctl is-active --quiet silktalk; then
        log_success "Service started successfully"
    else
        log_error "Failed to start service"
        systemctl status silktalk
        exit 1
    fi
}

# Show status
show_status() {
    log_info "SilkTalk Pro Status:"
    echo ""
    echo "  Service: $(systemctl is-active silktalk)"
    echo "  Install Dir: $INSTALL_DIR"
    echo "  Config: /etc/silktalk/config.json"
    echo "  Logs: $INSTALL_DIR/logs/"
    echo "  Node Port: $NODE_PORT"
    echo "  WebSocket Port: $WS_PORT"
    echo ""
    echo "Useful commands:"
    echo "  systemctl status silktalk  - Check service status"
    echo "  journalctl -u silktalk -f  - View logs"
    echo "  silktalk peers             - List connected peers"
}

# Main deployment function
deploy() {
    log_info "Starting SilkTalk Pro deployment..."
    
    check_prerequisites
    install_dependencies
    build_project
    create_service_user
    install_files
    create_systemd_service
    create_config
    start_service
    
    log_success "Deployment completed!"
    show_status
}

# Test function - run two nodes locally
test_local() {
    log_info "Starting local test with two nodes..."
    
    cd "$(dirname "$0")/.."
    
    # Start node 1 in background
    log_info "Starting Node 1 on port 10001..."
    node dist/cli/index.js start --port 10001 --log-level debug > /tmp/silktalk-node1.log 2>&1 &
    NODE1_PID=$!
    
    sleep 3
    
    # Start node 2 in background
    log_info "Starting Node 2 on port 10002..."
    node dist/cli/index.js start --port 10002 --log-level debug > /tmp/silktalk-node2.log 2>&1 &
    NODE2_PID=$!
    
    sleep 3
    
    log_info "Nodes started. PIDs: Node1=$NODE1_PID, Node2=$NODE2_PID"
    log_info "Logs: /tmp/silktalk-node1.log, /tmp/silktalk-node2.log"
    
    # Get node 2's address
    NODE2_ADDR=$(grep "Listen addresses" /tmp/silktalk-node2.log | head -1 | grep -oE '/ip4/[^ ]+')
    
    if [ -n "$NODE2_ADDR" ]; then
        log_info "Node 2 address: $NODE2_ADDR"
        
        # Test connection
        log_info "Testing connection from Node 1 to Node 2..."
        node dist/cli/index.js connect "$NODE2_ADDR"
        
        log_success "Connection test completed!"
    else
        log_warn "Could not determine Node 2 address"
    fi
    
    echo ""
    echo "Press Enter to stop test nodes..."
    read
    
    kill $NODE1_PID $NODE2_PID 2>/dev/null || true
    log_info "Test nodes stopped"
}

# Usage
usage() {
    echo "SilkTalk Pro Deployment Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  deploy       - Full deployment (default)"
    echo "  test         - Run local test with two nodes"
    echo "  build        - Build only"
    echo "  install      - Install dependencies only"
    echo "  status       - Show service status"
    echo "  help         - Show this help"
    echo ""
    echo "Environment Variables:"
    echo "  INSTALL_DIR  - Installation directory (default: /opt/silktalk)"
    echo "  SERVICE_USER - Service user (default: silktalk)"
    echo "  NODE_PORT    - TCP port (default: 4001)"
    echo "  WS_PORT      - WebSocket port (default: 8080)"
    echo "  LOG_LEVEL    - Log level (default: info)"
}

# Main
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    test)
        test_local
        ;;
    build)
        check_prerequisites
        install_dependencies
        build_project
        ;;
    install)
        check_prerequisites
        install_dependencies
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        log_error "Unknown command: $1"
        usage
        exit 1
        ;;
esac
