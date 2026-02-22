#!/usr/bin/env bash
#
# SilkTalk Master Control Script
# 主控脚本 - 统一入口
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

show_banner() {
  echo -e "${CYAN}"
  echo "  ____  _ _     _         _   "
  echo " / ___|(_) | __| |___ ___| |_ "
  echo " \\___ \\| | |/ _\` / __/ __| __|"
  echo "  ___) | | | (_| \\__ \\__ \\ |_ "
  echo " |____/|_|_|\\__,_|___/___/\\__|"
  echo "                               "
  echo -e "${NC}"
  echo "  P2P Collaboration for OpenClaw"
  echo "  Version: 0.1.0"
  echo ""
}

show_help() {
  echo "Usage: $0 <command> [options]"
  echo ""
  echo "Commands:"
  echo "  check       Check environment and dependencies"
  echo "  install     Install SilkTalk and dependencies"
  echo "  deploy      Deploy locally or remotely"
  echo "  start       Start a SilkTalk node"
  echo "  test        Run integration tests"
  echo "  status      Check node status"
  echo "  logs        Show node logs"
  echo "  stop        Stop running nodes"
  echo "  clean       Clean up installation"
  echo ""
  echo "Examples:"
  echo "  $0 check                          # Check environment"
  echo "  $0 install                        # Install locally"
  echo "  $0 start nodeA 10001              # Start node A"
  echo "  $0 start nodeB 10002 /ip4/...     # Start with bootstrap"
  echo "  $0 deploy remote 192.168.1.100    # Deploy to remote"
  echo "  $0 test                           # Run tests"
  echo ""
}

cmd_check() {
  echo -e "${BLUE}🔍 Checking environment...${NC}"
  cd "$PROJECT_ROOT"
  node scripts/check-env.js
}

cmd_install() {
  echo -e "${BLUE}🔧 Installing SilkTalk...${NC}"
  cd "$PROJECT_ROOT"
  node scripts/install.js "$@"
}

cmd_deploy() {
  local target="${1:-local}"
  shift || true
  
  if [ "$target" = "remote" ]; then
    echo -e "${BLUE}🚀 Deploying to remote server...${NC}"
    "$SCRIPT_DIR/remote-deploy.sh" "$@"
  else
    echo -e "${BLUE}🚀 Deploying locally...${NC}"
    "$SCRIPT_DIR/deploy.sh" "$@"
  fi
}

cmd_start() {
  local name="${1:-node}"
  local port="${2:-0}"
  local bootstrap="${3:-}"
  
  echo -e "${BLUE}🚀 Starting SilkTalk node: $name${NC}"
  cd "$PROJECT_ROOT"
  
  if [ -n "$bootstrap" ]; then
    exec node src/index.js --name "$name" --port "$port" --bootstrap "$bootstrap"
  else
    exec node src/index.js --name "$name" --port "$port"
  fi
}

cmd_test() {
  echo -e "${BLUE}🧪 Running integration tests...${NC}"
  cd "$PROJECT_ROOT"
  node scripts/test.js
}

cmd_status() {
  echo -e "${BLUE}📊 Checking status...${NC}"
  
  # Check for running nodes
  local pids=$(pgrep -f "silktalk" || true)
  if [ -n "$pids" ]; then
    echo -e "${GREEN}Running SilkTalk processes:${NC}"
    ps -fp $pids
  else
    echo -e "${YELLOW}No SilkTalk processes found${NC}"
  fi
  
  # Check ports
  echo ""
  echo "Listening ports:"
  netstat -tlnp 2>/dev/null | grep -E "(1000[0-9]|node)" || ss -tlnp | grep -E "(1000[0-9]|node)" || echo "  No SilkTalk ports found"
}

cmd_logs() {
  echo -e "${BLUE}📜 Showing logs...${NC}"
  # TODO: Implement log aggregation
  echo "Log aggregation not yet implemented"
  echo "Use: tail -f /path/to/log"
}

cmd_stop() {
  echo -e "${BLUE}🛑 Stopping SilkTalk nodes...${NC}"
  
  local pids=$(pgrep -f "silktalk" || true)
  if [ -n "$pids" ]; then
    echo "Found processes: $pids"
    kill $pids 2>/dev/null || true
    sleep 2
    
    # Force kill if still running
    local remaining=$(pgrep -f "silktalk" || true)
    if [ -n "$remaining" ]; then
      echo "Force killing remaining processes..."
      kill -9 $remaining 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ Nodes stopped${NC}"
  else
    echo -e "${YELLOW}No running nodes found${NC}"
  fi
}

cmd_clean() {
  echo -e "${YELLOW}🧹 Cleaning up...${NC}"
  read -p "Are you sure? This will remove node_modules. (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$PROJECT_ROOT"
    rm -rf node_modules
    rm -f package-lock.json
    echo -e "${GREEN}✅ Cleanup complete${NC}"
  else
    echo "Cancelled"
  fi
}

# Main
show_banner

COMMAND="${1:-}"
shift || true

case "$COMMAND" in
  check)
    cmd_check "$@"
    ;;
  install)
    cmd_install "$@"
    ;;
  deploy)
    cmd_deploy "$@"
    ;;
  start)
    cmd_start "$@"
    ;;
  test)
    cmd_test "$@"
    ;;
  status)
    cmd_status "$@"
    ;;
  logs)
    cmd_logs "$@"
    ;;
  stop)
    cmd_stop "$@"
    ;;
  clean)
    cmd_clean "$@"
    ;;
  help|--help|-h)
    show_help
    ;;
  *)
    if [ -z "$COMMAND" ]; then
      show_help
    else
      echo -e "${RED}Unknown command: $COMMAND${NC}"
      show_help
      exit 1
    fi
    ;;
esac
