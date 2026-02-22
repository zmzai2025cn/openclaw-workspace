#!/bin/bash
#==============================================================================
# 脚本名称: generate-config.sh
# 功能描述: SilkTalk Pro 配置生成脚本 - 根据环境自动生成配置文件
# 作者: SilkTalk Team
# 版本: 1.0.0
# 日期: 2026-02-22
#==============================================================================
#
# 设计目标:
#   - 智能适配: 根据网络环境自动选择配置
#   - 端口检测: 自动查找可用端口
#   - 安全生成: 自动生成随机密钥
#   - 多环境支持: 生产、开发、Docker 等
#
# 生成配置:
#   ┌─────────────────────┐    ┌─────────────────────┐
#   │ silktalk.config.json│    │       .env          │
#   │    (主配置)         │    │   (环境变量)        │
#   └─────────────────────┘    └─────────────────────┘
#   ┌─────────────────────┐    ┌─────────────────────┐
#   │    nginx.conf       │    │    Dockerfile       │
#   │  (反向代理配置)      │    │   (容器镜像)        │
#   └─────────────────────┘    └─────────────────────┘
#   ┌─────────────────────┐    ┌─────────────────────┐
#   │ docker-compose.yml  │    │ silktalk.config.dev │
#   │   (容器编排)        │    │   (开发配置)        │
#   └─────────────────────┘    └─────────────────────┘
#
# 使用方法:
#   ./generate-config.sh [选项]
#
# 选项:
#   --mode <mode>      配置模式: auto|dev|production (默认: auto)
#   --output <dir>     输出目录 (默认: ./configs)
#   --verbose          详细输出
#
# 返回值:
#   0 - 生成成功
#   1 - 生成失败
#
# 示例:
#   # 生成默认配置
#   ./generate-config.sh
#
#   # 生成开发配置
#   ./generate-config.sh --mode dev
#
#   # 指定输出目录
#   ./generate-config.sh --output /etc/silktalk
#
#==============================================================================

#------------------------------------------------------------------------------
# 严格模式设置
#------------------------------------------------------------------------------
set -euo pipefail

#------------------------------------------------------------------------------
# 全局配置
#------------------------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 命令行参数
MODE="auto"
OUTPUT_DIR="${PROJECT_ROOT}/configs"
VERBOSE=false

#------------------------------------------------------------------------------
# 颜色定义
#------------------------------------------------------------------------------
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

#------------------------------------------------------------------------------
# 日志函数
#------------------------------------------------------------------------------
log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $*"; }

#------------------------------------------------------------------------------
# 参数解析
#------------------------------------------------------------------------------
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mode) MODE="$2"; shift 2 ;;
            --output) OUTPUT_DIR="$2"; shift 2 ;;
            --verbose) VERBOSE=true; shift ;;
            *) shift ;;
        esac
    done
}

#------------------------------------------------------------------------------
# 网络检测
#------------------------------------------------------------------------------

#==============================================================================
# 函数: detect_network_type
# 描述: 检测网络类型（公网/内网/NAT）
# 参数: 无
# 返回值: JSON 格式的网络信息
# 检测方法:
#   1. 获取公网 IP
#   2. 判断是否为内网 IP（10.x/172.16-31.x/192.168.x）
#   3. 推断 NAT 类型
#==============================================================================
detect_network_type() {
    local network_type="local"
    
    #------------------------------------------------------------------------------
    # 检测公网 IP
    #------------------------------------------------------------------------------
    local public_ip
    public_ip=$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || echo "")
    
    if [[ -n "$public_ip" ]]; then
        #------------------------------------------------------------------------------
        # 检查是否为内网 IP
        #------------------------------------------------------------------------------
        # RFC 1918 私有地址范围:
        #   10.0.0.0/8
        #   172.16.0.0/12
        #   192.168.0.0/16
        if [[ "$public_ip" =~ ^10\. ]] || \
           [[ "$public_ip" =~ ^172\.(1[6-9]|2[0-9]|3[01])\. ]] || \
           [[ "$public_ip" =~ ^192\.168\. ]]; then
            network_type="private"
        else
            network_type="public"
        fi
    fi
    
    #------------------------------------------------------------------------------
    # 检测 NAT 类型
    #------------------------------------------------------------------------------
    local nat_type="none"
    if [[ "$network_type" == "private" ]]; then
        nat_type="symmetric"  # 假设为对称 NAT（最常见）
    fi
    
    # 返回 JSON 格式
    echo "{\"type\":\"$network_type\",\"nat\":\"$nat_type\",\"public_ip\":\"$public_ip\"}"
}

#------------------------------------------------------------------------------
# 端口查找
#------------------------------------------------------------------------------

#==============================================================================
# 函数: find_available_port
# 描述: 查找可用端口
# 参数:
#   $1 - 起始端口 (默认: 3000)
#   $2 - 结束端口 (默认: 9000)
# 返回值: 第一个可用端口号
# 检查方法:
#   使用 netstat 检查端口是否被占用
#==============================================================================
find_available_port() {
    local start_port="${1:-3000}"
    local end_port="${2:-9000}"
    
    # 遍历端口范围
    for port in $(seq "$start_port" "$end_port"); do
        # 检查端口是否被占用
        if ! netstat -tuln 2>/dev/null | grep -q ":${port} "; then
            echo "$port"
            return 0
        fi
    done
    
    # 如果都占用，返回起始端口（让后续报错）
    echo "$start_port"
}

#------------------------------------------------------------------------------
# 配置生成
#------------------------------------------------------------------------------

#==============================================================================
# 函数: generate_main_config
# 描述: 生成主配置文件 silktalk.config.json
# 参数: 无
# 返回值: 0=成功
# 配置内容:
#   - 服务器基本信息
#   - HTTP/WebSocket 配置
#   - WebRTC 配置
#   - 安全配置（自动生成密钥）
#   - 日志配置
#   - 功能开关
#   - 限制配置
#==============================================================================
generate_main_config() {
    local config_file="${OUTPUT_DIR}/silktalk.config.json"
    
    log_info "生成主配置文件..."
    
    #------------------------------------------------------------------------------
    # 检测网络环境
    #------------------------------------------------------------------------------
    local network_info
    network_info=$(detect_network_type)
    local network_type
    network_type=$(echo "$network_info" | grep -o '"type":"[^"]*"' | cut -d'"' -f4)
    
    #------------------------------------------------------------------------------
    # 分配端口
    #------------------------------------------------------------------------------
    local http_port
    http_port=$(find_available_port 3000)
    local websocket_port
    websocket_port=$(find_available_port $((http_port + 1)))
    local rtc_port
    rtc_port=$(find_available_port 3478)
    
    #------------------------------------------------------------------------------
    # 生成随机密钥
    #------------------------------------------------------------------------------
    local jwt_secret
    jwt_secret=$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | head -c 64)
    
    #------------------------------------------------------------------------------
    # 生成 JSON 配置
    #------------------------------------------------------------------------------
    cat > "$config_file" << EOF
{
  "server": {
    "name": "SilkTalk Pro Server",
    "version": "1.0.0",
    "environment": "${MODE}",
    "network": {
      "type": "${network_type}",
      "public_ip": "auto",
      "bind_address": "0.0.0.0"
    }
  },
  "http": {
    "enabled": true,
    "port": ${http_port},
    "host": "0.0.0.0",
    "cors": {
      "enabled": true,
      "origins": ["*"]
    }
  },
  "websocket": {
    "enabled": true,
    "port": ${websocket_port},
    "host": "0.0.0.0",
    "path": "/ws"
  },
  "webrtc": {
    "enabled": true,
    "port": ${rtc_port},
    "stun": {
      "enabled": true,
      "servers": [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302"
      ]
    },
    "turn": {
      "enabled": false,
      "servers": []
    }
  },
  "security": {
    "jwt_secret": "${jwt_secret}",
    "token_expiry": "24h",
    "encryption": {
      "enabled": true,
      "algorithm": "aes-256-gcm"
    }
  },
  "logging": {
    "level": "info",
    "file": "logs/app.log",
    "max_size": "100m",
    "max_files": 10,
    "console": true
  },
  "features": {
    "p2p": true,
    "group_call": true,
    "screen_share": true,
    "file_transfer": true,
    "recording": false
  },
  "limits": {
    "max_connections": 1000,
    "max_room_size": 50,
    "max_file_size": "100mb",
    "rate_limit": {
      "enabled": true,
      "window_ms": 60000,
      "max_requests": 100
    }
  }
}
EOF
    
    log_success "主配置文件生成: $config_file"
}

#==============================================================================
# 函数: generate_env_config
# 描述: 生成环境变量配置文件 .env
# 参数: 无
# 返回值: 0=成功
#==============================================================================
generate_env_config() {
    local env_file="${OUTPUT_DIR}/.env"
    
    log_info "生成环境配置文件..."
    
    # 生成随机密钥
    local jwt_secret
    jwt_secret=$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | head -c 64)
    local enc_key
    enc_key=$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | head -c 64)
    
    cat > "$env_file" << EOF
# SilkTalk Pro 环境配置
NODE_ENV=production

# 服务器配置
SILKTALK_HTTP_PORT=3000
SILKTALK_WS_PORT=3001
SILKTALK_RTC_PORT=3478

# 安全配置
SILKTALK_JWT_SECRET=${jwt_secret}
SILKTALK_ENCRYPTION_KEY=${enc_key}

# 日志配置
SILKTALK_LOG_LEVEL=info
SILKTALK_LOG_FILE=logs/app.log

# 功能开关
SILKTALK_ENABLE_P2P=true
SILKTALK_ENABLE_RECORDING=false
SILKTALK_ENABLE_SCREEN_SHARE=true

# 限制配置
SILKTALK_MAX_CONNECTIONS=1000
SILKTALK_MAX_ROOM_SIZE=50
EOF
    
    log_success "环境配置文件生成: $env_file"
}

#==============================================================================
# 函数: generate_nginx_config
# 描述: 生成 Nginx 反向代理配置
# 参数: 无
# 返回值: 0=成功
# 配置内容:
#   - HTTP 反向代理
#   - WebSocket 支持
#   - 健康检查端点
#   - HTTPS 配置模板
#==============================================================================
generate_nginx_config() {
    local nginx_file="${OUTPUT_DIR}/nginx.conf"
    
    log_info "生成 Nginx 配置..."
    
    cat > "$nginx_file" << 'EOF'
# SilkTalk Pro Nginx 配置

upstream silktalk_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

upstream silktalk_websocket {
    server 127.0.0.1:3001;
    keepalive 32;
}

server {
    listen 80;
    server_name _;
    
    # 日志
    access_log /var/log/nginx/silktalk-access.log;
    error_log /var/log/nginx/silktalk-error.log;
    
    # 静态文件
    location / {
        proxy_pass http://silktalk_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket
    location /ws {
        proxy_pass http://silktalk_websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
    
    # 健康检查
    location /health {
        access_log off;
        proxy_pass http://silktalk_backend/health;
    }
}

# HTTPS 配置 (需要 SSL 证书)
# server {
#     listen 443 ssl http2;
#     server_name your-domain.com;
#     
#     ssl_certificate /path/to/cert.pem;
#     ssl_certificate_key /path/to/key.pem;
#     
#     # ... 其他配置同上
# }
EOF
    
    log_success "Nginx 配置生成: $nginx_file"
}

#==============================================================================
# 函数: generate_docker_config
# 描述: 生成 Docker 相关配置
# 参数: 无
# 返回值: 0=成功
# 生成内容:
#   - Dockerfile: 容器镜像构建配置
#   - docker-compose.yml: 容器编排配置
#==============================================================================
generate_docker_config() {
    local dockerfile="${OUTPUT_DIR}/Dockerfile"
    local compose_file="${OUTPUT_DIR}/docker-compose.yml"
    
    log_info "生成 Docker 配置..."
    
    #------------------------------------------------------------------------------
    # 生成 Dockerfile
    #------------------------------------------------------------------------------
    cat > "$dockerfile" << 'EOF'
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制代码
COPY . .

# 创建目录
RUN mkdir -p logs config data

# 暴露端口
EXPOSE 3000 3001 3478

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# 启动
CMD ["node", "dist/index.js"]
EOF
    
    #------------------------------------------------------------------------------
    # 生成 docker-compose.yml
    #------------------------------------------------------------------------------
    cat > "$compose_file" << 'EOF'
version: '3.8'

services:
  silktalk:
    build: .
    container_name: silktalk-pro
    restart: unless-stopped
    
    ports:
      - "3000:3000"
      - "3001:3001"
      - "3478:3478/udp"
    
    volumes:
      - ./config:/app/config
      - ./logs:/app/logs
      - ./data:/app/data
    
    environment:
      - NODE_ENV=production
      - SILKTALK_CONFIG=/app/config/silktalk.config.json
    
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    
    networks:
      - silktalk-network

networks:
  silktalk-network:
    driver: bridge
EOF
    
    log_success "Docker 配置生成: $dockerfile, $compose_file"
}

#==============================================================================
# 函数: generate_dev_config
# 描述: 生成开发环境配置
# 参数: 无
# 返回值: 0=成功
# 特点:
#   - 调试日志级别
#   - 启用所有功能（包括实验性功能）
#   - 宽松的 CORS 设置
#==============================================================================
generate_dev_config() {
    local dev_config="${OUTPUT_DIR}/silktalk.config.dev.json"
    
    log_info "生成开发环境配置..."
    
    cat > "$dev_config" << 'EOF'
{
  "server": {
    "name": "SilkTalk Pro (Dev)",
    "environment": "development"
  },
  "http": {
    "enabled": true,
    "port": 3000,
    "cors": {
      "enabled": true,
      "origins": ["*"]
    }
  },
  "websocket": {
    "enabled": true,
    "port": 3001
  },
  "webrtc": {
    "enabled": true,
    "port": 3478
  },
  "logging": {
    "level": "debug",
    "console": true
  },
  "features": {
    "p2p": true,
    "group_call": true,
    "screen_share": true,
    "file_transfer": true,
    "recording": true
  }
}
EOF
    
    log_success "开发配置生成: $dev_config"
}

#------------------------------------------------------------------------------
# 主函数
#------------------------------------------------------------------------------

#==============================================================================
# 函数: main
# 描述: 脚本入口函数
# 参数: $@ - 所有命令行参数
# 返回值:
#   0 - 生成成功
#   1 - 生成失败
#==============================================================================
main() {
    # 解析命令行参数
    parse_args "$@"
    
    # 输出开始信息
    log_info "=========================================="
    log_info "SilkTalk Pro 配置生成"
    log_info "=========================================="
    log_info "输出目录: $OUTPUT_DIR"
    log_info "模式: $MODE"
    
    #------------------------------------------------------------------------------
    # 创建输出目录
    #------------------------------------------------------------------------------
    mkdir -p "$OUTPUT_DIR"
    
    #------------------------------------------------------------------------------
    # 生成所有配置
    #------------------------------------------------------------------------------
    generate_main_config
    generate_env_config
    generate_nginx_config
    generate_docker_config
    generate_dev_config
    
    # 输出完成信息
    log_success "=========================================="
    log_success "配置生成完成"
    log_success "=========================================="
    log_info "配置文件位置: $OUTPUT_DIR"
    log_info ""
    log_info "请将配置文件复制到安装目录:"
    log_info "  cp ${OUTPUT_DIR}/*.json \${INSTALL_PREFIX:-/usr/local}/silktalk-pro/config/"
}

# 调用主函数
main "$@"
