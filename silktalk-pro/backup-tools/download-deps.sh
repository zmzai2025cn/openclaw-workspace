#!/bin/bash
# download-deps.sh - 预下载依赖包脚本
# 用于离线环境准备

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${SCRIPT_DIR}/offline-packages"
NODE_VERSION="20.11.0"

echo "========================================"
echo "  SilkTalk Pro 离线依赖包下载工具"
echo "========================================"
echo ""

mkdir -p "$OUTPUT_DIR"

# 下载Node.js二进制
download_node() {
    echo "[1/5] 下载 Node.js ${NODE_VERSION}..."
    
    local platforms=(
        "linux-x64:node-v${NODE_VERSION}-linux-x64.tar.xz"
        "darwin-x64:node-v${NODE_VERSION}-darwin-x64.tar.gz"
        "darwin-arm64:node-v${NODE_VERSION}-darwin-arm64.tar.gz"
        "win-x64:node-v${NODE_VERSION}-win-x64.zip"
    )
    
    for platform in "${platforms[@]}"; do
        IFS=':' read -r arch filename <<< "$platform"
        local url="https://nodejs.org/dist/v${NODE_VERSION}/${filename}"
        local output="${OUTPUT_DIR}/${filename}"
        
        if [ -f "$output" ]; then
            echo "  ✓ ${filename} 已存在"
        else
            echo "  下载 ${filename}..."
            curl -L -o "$output" "$url" 2>/dev/null && echo "  ✓ 下载成功" || echo "  ✗ 下载失败"
        fi
    done
    echo ""
}

# 下载npm包
download_npm_packages() {
    echo "[2/5] 下载 npm 依赖包..."
    
    local temp_dir=$(mktemp -d)
    
    # 创建临时package.json
    cat > "${temp_dir}/package.json" << 'EOF'
{
  "name": "temp",
  "dependencies": {
    "libp2p": "^0.37.0",
    "@chainsafe/libp2p-noise": "^16.0.0",
    "@chainsafe/libp2p-yamux": "^7.0.1",
    "@libp2p/bootstrap": "^11.0.15",
    "@libp2p/circuit-relay-v2": "^3.1.5",
    "@libp2p/dcutr": "^2.0.13",
    "@libp2p/identify": "^3.0.15",
    "@libp2p/kad-dht": "^14.1.3",
    "@libp2p/mdns": "^11.0.0",
    "@libp2p/tcp": "^10.0.15",
    "@libp2p/webrtc": "^5.0.18",
    "@libp2p/websockets": "^9.0.15",
    "@libp2p/webtransport": "^5.0.18",
    "@chainsafe/libp2p-gossipsub": "^14.1.0",
    "multiformats": "^13.1.0",
    "uint8arrays": "^5.0.2",
    "ws": "^8.16.0"
  }
}
EOF
    
    cd "$temp_dir"
    
    # 下载所有依赖
    echo "  正在下载依赖 (这可能需要几分钟)..."
    npm install --silent 2>/dev/null || npm install
    
    # 打包
    echo "  打包依赖..."
    tar -czf "${OUTPUT_DIR}/npm-packages.tar.gz" node_modules package.json
    
    cd "$SCRIPT_DIR"
    rm -rf "$temp_dir"
    
    echo "  ✓ npm-packages.tar.gz 已创建"
    echo ""
}

# 生成安装脚本
generate_install_script() {
    echo "[3/5] 生成离线安装脚本..."
    
    cat > "${OUTPUT_DIR}/install-offline.sh" << 'EOF'
#!/bin/bash
# 离线安装脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================"
echo "  SilkTalk Pro 离线安装"
echo "========================================"
echo ""

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js 未安装，正在安装..."
    
    # 检测平台
    local arch=$(uname -m)
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    
    if [ "$os" = "linux" ] && [ "$arch" = "x86_64" ]; then
        tar -xf "${SCRIPT_DIR}/node-v20.11.0-linux-x64.tar.xz" -C /usr/local --strip-components=1
    elif [ "$os" = "darwin" ]; then
        if [ "$arch" = "arm64" ]; then
            tar -xzf "${SCRIPT_DIR}/node-v20.11.0-darwin-arm64.tar.gz" -C /usr/local --strip-components=1
        else
            tar -xzf "${SCRIPT_DIR}/node-v20.11.0-darwin-x64.tar.gz" -C /usr/local --strip-components=1
        fi
    fi
    
    echo "✓ Node.js 安装完成"
fi

# 解压npm包
echo "解压依赖包..."
if [ -d "node_modules" ]; then
    echo "  备份现有 node_modules..."
    mv node_modules "node_modules.backup.$(date +%s)"
fi
tar -xzf "${SCRIPT_DIR}/npm-packages.tar.gz"

echo ""
echo "========================================"
echo "  安装完成!"
echo "========================================"
echo ""
echo "运行以下命令启动:"
echo "  npm start"
EOF
    
    chmod +x "${OUTPUT_DIR}/install-offline.sh"
    echo "  ✓ install-offline.sh 已创建"
    echo ""
}

# 生成清单文件
generate_manifest() {
    echo "[4/5] 生成清单文件..."
    
    cat > "${OUTPUT_DIR}/MANIFEST.md" << EOF
# SilkTalk Pro 离线安装包清单

生成时间: $(date '+%Y-%m-%d %H:%M:%S')

## 包含文件

### Node.js 运行时
- node-v${NODE_VERSION}-linux-x64.tar.xz
- node-v${NODE_VERSION}-darwin-x64.tar.gz
- node-v${NODE_VERSION}-darwin-arm64.tar.gz
- node-v${NODE_VERSION}-win-x64.zip

### npm 依赖
- npm-packages.tar.gz (包含所有 node_modules)

### 安装脚本
- install-offline.sh - Linux/macOS 离线安装脚本

## 安装步骤

### Linux/macOS

1. 解压离线包
   \`\`\`bash
   tar -xzf silktalk-offline-packages.tar.gz
   cd offline-packages
   \`\`\`

2. 运行安装脚本
   \`\`\`bash
   ./install-offline.sh
   \`\`\`

3. 启动应用
   \`\`\`bash
   npm start
   \`\`\`

### Windows

1. 解压 node-v${NODE_VERSION}-win-x64.zip 到 C:\\nodejs
2. 解压 npm-packages.tar.gz 到项目目录
3. 添加 C:\\nodejs 到 PATH
4. 运行 \`npm start\`

## 依赖列表

### 核心依赖
- libp2p ^0.37.0
- @chainsafe/libp2p-noise ^16.0.0
- @chainsafe/libp2p-yamux ^7.0.1
- @libp2p/tcp ^10.0.15
- @libp2p/websockets ^9.0.15

### 发现与路由
- @libp2p/bootstrap ^11.0.15
- @libp2p/kad-dht ^14.1.3
- @libp2p/mdns ^11.0.0

### NAT穿透
- @libp2p/circuit-relay-v2 ^3.1.5
- @libp2p/dcutr ^2.0.13

### WebRTC支持
- @libp2p/webrtc ^5.0.18
- @libp2p/webtransport ^5.0.18

### 消息
- @chainsafe/libp2p-gossipsub ^14.1.0

### 工具
- multiformats ^13.1.0
- uint8arrays ^5.0.2
- ws ^8.16.0
EOF
    
    echo "  ✓ MANIFEST.md 已创建"
    echo ""
}

# 打包所有文件
package_all() {
    echo "[5/5] 打包所有文件..."
    
    cd "$OUTPUT_DIR"
    local package_name="silktalk-offline-packages-$(date +%Y%m%d).tar.gz"
    
    tar -czf "${SCRIPT_DIR}/${package_name}" .
    
    echo "  ✓ ${package_name} 已创建"
    echo ""
    echo "========================================"
    echo "  离线包准备完成!"
    echo "========================================"
    echo ""
    echo "输出文件: ${package_name}"
    echo "大小: $(du -h "${SCRIPT_DIR}/${package_name}" | cut -f1)"
    echo ""
    echo "使用方法:"
    echo "  1. 将 ${package_name} 复制到目标机器"
    echo "  2. 解压: tar -xzf ${package_name}"
    echo "  3. 运行: ./install-offline.sh"
    echo ""
}

# 主程序
main() {
    case "${1:-}" in
        --node-only)
            download_node
            ;;
        --npm-only)
            download_npm_packages
            ;;
        --help|-h)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --node-only    仅下载 Node.js"
            echo "  --npm-only     仅下载 npm 包"
            echo "  --help, -h     显示帮助"
            echo ""
            echo "无选项时下载所有内容"
            ;;
        *)
            download_node
            download_npm_packages
            generate_install_script
            generate_manifest
            package_all
            ;;
    esac
}

main "$@"
