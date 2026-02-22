#!/bin/bash
#==============================================================================
# 脚本名称: deploy-silktalk.sh
# 功能描述: SilkTalk Pro 项目部署脚本 - 自动下载、安装、配置 SilkTalk Pro
# 作者: SilkTalk Team
# 版本: 1.0.0
# 日期: 2026-02-22
#==============================================================================
#
# 设计目标:
#   - 自动获取: 支持 GitHub Releases 和 Git 克隆
#   - 智能回退: 下载失败时自动尝试备用方式
#   - 完整安装: 包含依赖安装、构建、服务配置
#   - 版本管理: 支持指定版本或最新版
#
# 部署流程:
#   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
#   │  下载源码   │    │  安装依赖   │    │  构建项目   │
#   │ (Release/  │ -> │  (npm/yarn/ │ -> │  (npm run   │
#   │   Git)     │    │   pnpm)     │    │   build)    │
#   └─────────────┘    └─────────────┘    └─────────────┘
#                                                |
#                                                v
#   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
#   │  systemd    │    │  启动脚本   │    │  目录结构   │
#   │  服务配置   │ <- │  创建       │ <- │  创建       │
#   └─────────────┘    └─────────────┘    └─────────────┘
#
# 使用方法:
#   ./deploy-silktalk.sh [选项]
#
# 选项:
#   --version <ver>    SilkTalk 版本 (默认: latest)
#   --prefix <path>   安装前缀 (默认: /usr/local)
#   --mirror <source>  镜像源: auto|cn|global (默认: auto)
#   --force            强制重新安装
#   --verbose          详细输出
#
# 返回值:
#   0 - 部署成功
#   1 - 部署失败
#
# 示例:
#   # 部署最新版本
#   ./deploy-silktalk.sh
#
#   # 部署指定版本
#   ./deploy-silktalk.sh --version 1.2.0
#
#   # 强制重新部署
#   ./deploy-silktalk.sh --force
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
SILKTALK_VERSION="latest"
INSTALL_PREFIX="/usr/local"
USE_MIRROR="auto"
FORCE_REINSTALL=false
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
            --version) SILKTALK_VERSION="$2"; shift 2 ;;
            --prefix) INSTALL_PREFIX="$2"; shift 2 ;;
            --mirror) USE_MIRROR="$2"; shift 2 ;;
            --force) FORCE_REINSTALL=true; shift ;;
            --verbose) VERBOSE=true; shift ;;
            *) shift ;;
        esac
    done
}

#------------------------------------------------------------------------------
# 权限获取
#------------------------------------------------------------------------------
get_sudo() {
    if [[ $EUID -eq 0 ]]; then
        echo ""
    elif command -v sudo &> /dev/null; then
        echo "sudo"
    else
        echo ""
    fi
}

#------------------------------------------------------------------------------
# 下载 URL 生成
#------------------------------------------------------------------------------

#==============================================================================
# 函数: get_download_url
# 描述: 生成 SilkTalk Pro 下载 URL
# 参数: 无
# 返回值: 下载 URL
# URL 格式:
#   最新版: https://github.com/silktalk/silktalk-pro/releases/latest/download/silktalk-pro.tar.gz
#   指定版: https://github.com/silktalk/silktalk-pro/releases/download/v{version}/silktalk-pro-{version}.tar.gz
# 国内镜像:
#   使用 ghproxy.com 代理 GitHub 下载
#==============================================================================
get_download_url() {
    local version="$SILKTALK_VERSION"
    
    if [[ "$version" == "latest" ]]; then
        # GitHub 最新发布
        if [[ "$USE_MIRROR" == "cn" ]]; then
            echo "https://ghproxy.com/https://github.com/silktalk/silktalk-pro/releases/latest/download/silktalk-pro.tar.gz"
        else
            echo "https://github.com/silktalk/silktalk-pro/releases/latest/download/silktalk-pro.tar.gz"
        fi
    else
        # 指定版本
        if [[ "$USE_MIRROR" == "cn" ]]; then
            echo "https://ghproxy.com/https://github.com/silktalk/silktalk-pro/releases/download/v${version}/silktalk-pro-${version}.tar.gz"
        else
            echo "https://github.com/silktalk/silktalk-pro/releases/download/v${version}/silktalk-pro-${version}.tar.gz"
        fi
    fi
}

#------------------------------------------------------------------------------
# 源码获取
#------------------------------------------------------------------------------

#==============================================================================
# 函数: clone_from_git
# 描述: 从 Git 仓库克隆源码
# 参数:
#   $1 - 目标目录
# 返回值: 0=成功, 1=失败
# 说明:
#   - 优先使用 Gitee 镜像（国内）
#   - 支持 shallow clone 加速下载
#   - 支持指定分支/标签
#==============================================================================
clone_from_git() {
    local target_dir="$1"
    
    log_info "从 Git 克隆 SilkTalk Pro..."
    
    # 选择 Git URL
    local git_url
    if [[ "$USE_MIRROR" == "cn" ]]; then
        # 尝试 Gitee 镜像
        git_url="https://gitee.com/silktalk/silktalk-pro.git"
    else
        git_url="https://github.com/silktalk/silktalk-pro.git"
    fi
    
    # 克隆指定版本
    if [[ "$SILKTALK_VERSION" == "latest" ]]; then
        # 克隆最新代码（浅克隆，仅下载最新提交）
        git clone --depth 1 "$git_url" "$target_dir"
    else
        # 克隆指定版本
        git clone --branch "v${SILKTALK_VERSION}" --depth 1 "$git_url" "$target_dir" 2>/dev/null || \
            git clone --branch "${SILKTALK_VERSION}" --depth 1 "$git_url" "$target_dir"
    fi
    
    log_success "Git 克隆完成"
}

#==============================================================================
# 函数: download_release
# 描述: 下载预编译的发布包
# 参数:
#   $1 - 目标目录
# 返回值: 0=成功, 1=失败
# 说明:
#   - 优先下载预编译包（更快）
#   - 失败时返回 1，调用方应回退到 Git 克隆
#==============================================================================
download_release() {
    local target_dir="$1"
    
    log_info "下载 SilkTalk Pro 发布包..."
    
    # 获取下载 URL
    local download_url
    download_url=$(get_download_url)
    local temp_file
    temp_file=$(mktemp)
    
    log_info "下载地址: $download_url"
    
    # 下载并解压
    if curl -fsSL --progress-bar "$download_url" -o "$temp_file"; then
        log_info "解压..."
        mkdir -p "$target_dir"
        tar -xzf "$temp_file" -C "$target_dir" --strip-components=1
        rm -f "$temp_file"
        log_success "下载并解压完成"
        return 0
    else
        log_warn "下载失败，尝试 Git 克隆..."
        rm -f "$temp_file"
        return 1
    fi
}

#------------------------------------------------------------------------------
# 项目部署
#------------------------------------------------------------------------------

#==============================================================================
# 函数: deploy_project
# 描述: 部署项目到目标目录
# 参数: 无
# 返回值: 0=成功, 1=失败
# 流程:
#   1. 检查现有安装
#   2. 下载或克隆源码
#   3. 移动到安装目录
#   4. 设置权限
#==============================================================================
deploy_project() {
    local install_dir="${INSTALL_PREFIX}/silktalk-pro"
    local sudo_cmd
    sudo_cmd=$(get_sudo)
    
    log_info "部署目录: $install_dir"
    
    #------------------------------------------------------------------------------
    # 检查是否已存在
    #------------------------------------------------------------------------------
    if [[ -d "$install_dir" ]]; then
        if [[ "$FORCE_REINSTALL" == true ]]; then
            log_warn "移除现有安装..."
            $sudo_cmd rm -rf "$install_dir"
        else
            log_warn "SilkTalk Pro 已存在"
            log_info "使用 --force 强制重新安装"
            return 0
        fi
    fi
    
    #------------------------------------------------------------------------------
    # 创建临时目录
    #------------------------------------------------------------------------------
    local temp_dir
    temp_dir=$(mktemp -d)
    
    #------------------------------------------------------------------------------
    # 尝试下载发布包
    #------------------------------------------------------------------------------
    if ! download_release "$temp_dir"; then
        # 失败则尝试 Git 克隆
        if ! clone_from_git "$temp_dir"; then
            log_error "无法获取 SilkTalk Pro"
            rm -rf "$temp_dir"
            return 1
        fi
    fi
    
    #------------------------------------------------------------------------------
    # 移动到安装目录
    #------------------------------------------------------------------------------
    log_info "安装到 $install_dir..."
    $sudo_cmd mkdir -p "$(dirname "$install_dir")"
    $sudo_cmd mv "$temp_dir" "$install_dir"
    
    #------------------------------------------------------------------------------
    # 设置权限
    #------------------------------------------------------------------------------
    if [[ -n "$sudo_cmd" ]]; then
        $sudo_cmd chown -R root:root "$install_dir"
        $sudo_cmd chmod -R 755 "$install_dir"
    fi
    
    log_success "项目部署完成"
}

#------------------------------------------------------------------------------
# 依赖安装
#------------------------------------------------------------------------------

#==============================================================================
# 函数: install_dependencies
# 描述: 安装项目 Node.js 依赖
# 参数: 无
# 返回值: 0=成功
# 说明:
#   - 自动检测包管理器 (npm/yarn/pnpm)
#   - 优先使用锁定文件对应的包管理器
#   - 配置国内镜像加速
#==============================================================================
install_dependencies() {
    local install_dir="${INSTALL_PREFIX}/silktalk-pro"
    
    log_info "安装项目依赖..."
    
    cd "$install_dir"
    
    #------------------------------------------------------------------------------
    # 检查 package.json
    #------------------------------------------------------------------------------
    if [[ ! -f "package.json" ]]; then
        log_warn "未找到 package.json"
        return 0
    fi
    
    #------------------------------------------------------------------------------
    # 选择包管理器
    #------------------------------------------------------------------------------
    # 优先级: pnpm > yarn > npm
    local pkg_manager="npm"
    if [[ -f "pnpm-lock.yaml" ]] && command -v pnpm &> /dev/null; then
        pkg_manager="pnpm"
    elif [[ -f "yarn.lock" ]] && command -v yarn &> /dev/null; then
        pkg_manager="yarn"
    fi
    
    log_info "使用包管理器: $pkg_manager"
    
    #------------------------------------------------------------------------------
    # 安装依赖
    #------------------------------------------------------------------------------
    case "$pkg_manager" in
        npm)
            # 配置国内镜像
            if [[ "$USE_MIRROR" == "cn" ]]; then
                npm config set registry https://registry.npmmirror.com
            fi
            # 优先使用 npm ci（基于 package-lock.json）
            npm ci --production 2>/dev/null || npm install --production
            ;;
        yarn)
            if [[ "$USE_MIRROR" == "cn" ]]; then
                yarn config set registry https://registry.npmmirror.com
            fi
            yarn install --production
            ;;
        pnpm)
            if [[ "$USE_MIRROR" == "cn" ]]; then
                pnpm config set registry https://registry.npmmirror.com
            fi
            pnpm install --production
            ;;
    esac
    
    log_success "依赖安装完成"
}

#------------------------------------------------------------------------------
# 项目构建
#------------------------------------------------------------------------------

#==============================================================================
# 函数: build_project
# 描述: 构建项目
# 参数: 无
# 返回值: 0=成功
# 说明:
#   - 检查 package.json 中的 build 脚本
#   - 仅在存在 build 脚本时执行
#==============================================================================
build_project() {
    local install_dir="${INSTALL_PREFIX}/silktalk-pro"
    
    log_info "构建项目..."
    
    cd "$install_dir"
    
    #------------------------------------------------------------------------------
    # 检查是否需要构建
    #------------------------------------------------------------------------------
    if [[ ! -f "package.json" ]]; then
        return 0
    fi
    
    #------------------------------------------------------------------------------
    # 检查 build 脚本
    #------------------------------------------------------------------------------
    if grep -q '"build"' package.json; then
        npm run build
        log_success "构建完成"
    else
        log_info "无需构建"
    fi
}

#------------------------------------------------------------------------------
# 启动脚本创建
#------------------------------------------------------------------------------

#==============================================================================
# 函数: create_launcher
# 描述: 创建启动脚本和 systemd 服务
# 参数: 无
# 返回值: 0=成功
# 创建内容:
#   - /usr/local/bin/silktalk: 命令行启动脚本
#   - /etc/systemd/system/silktalk.service: systemd 服务配置
#==============================================================================
create_launcher() {
    local install_dir="${INSTALL_PREFIX}/silktalk-pro"
    local sudo_cmd
    sudo_cmd=$(get_sudo)
    
    log_info "创建启动脚本..."
    
    #------------------------------------------------------------------------------
    # 创建 silktalk 命令
    #------------------------------------------------------------------------------
    local launcher_file="${INSTALL_PREFIX}/bin/silktalk"
    
    $sudo_cmd mkdir -p "${INSTALL_PREFIX}/bin"
    
    # 创建启动脚本（使用 heredoc）
    $sudo_cmd tee "$launcher_file" > /dev/null << 'EOF'
#!/bin/bash
# SilkTalk Pro 启动脚本

INSTALL_DIR="INSTALL_PREFIX/silktalk-pro"
CONFIG_FILE="${INSTALL_DIR}/config/silktalk.config.json"

# 加载环境变量
export NODE_ENV=production

# 进入项目目录
cd "$INSTALL_DIR"

# 启动
exec node dist/index.js "$@"
EOF
    
    # 替换 INSTALL_PREFIX 为实际路径
    $sudo_cmd sed -i "s|INSTALL_PREFIX|${INSTALL_PREFIX}|g" "$launcher_file"
    $sudo_cmd chmod +x "$launcher_file"
    
    #------------------------------------------------------------------------------
    # 创建 systemd 服务
    #------------------------------------------------------------------------------
    if [[ -d "/etc/systemd/system" ]] && [[ -n "$sudo_cmd" ]]; then
        log_info "创建 systemd 服务..."
        
        $sudo_cmd tee "/etc/systemd/system/silktalk.service" > /dev/null << EOF
[Unit]
Description=SilkTalk Pro Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${install_dir}
ExecStart=$(which node) ${install_dir}/dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
        
        # 重新加载 systemd
        $sudo_cmd systemctl daemon-reload 2>/dev/null || true
        log_info "systemd 服务已创建"
        log_info "  启动: sudo systemctl start silktalk"
        log_info "  启用: sudo systemctl enable silktalk"
    fi
    
    log_success "启动脚本创建完成"
}

#------------------------------------------------------------------------------
# 目录结构创建
#------------------------------------------------------------------------------

#==============================================================================
# 函数: create_directories
# 描述: 创建项目所需的目录结构
# 参数: 无
# 返回值: 0=成功
# 创建目录:
#   - logs: 日志文件
#   - config: 配置文件
#   - data: 数据文件
#   - temp: 临时文件
#==============================================================================
create_directories() {
    local install_dir="${INSTALL_PREFIX}/silktalk-pro"
    local sudo_cmd
    sudo_cmd=$(get_sudo)
    
    log_info "创建目录结构..."
    
    $sudo_cmd mkdir -p "${install_dir}/logs"
    $sudo_cmd mkdir -p "${install_dir}/config"
    $sudo_cmd mkdir -p "${install_dir}/data"
    $sudo_cmd mkdir -p "${install_dir}/temp"
    
    log_success "目录结构创建完成"
}

#------------------------------------------------------------------------------
# 主函数
#------------------------------------------------------------------------------

#==============================================================================
# 函数: main
# 描述: 脚本入口函数
# 参数: $@ - 所有命令行参数
# 返回值:
#   0 - 部署成功
#   1 - 部署失败
#==============================================================================
main() {
    # 解析命令行参数
    parse_args "$@"
    
    # 输出开始信息
    log_info "=========================================="
    log_info "SilkTalk Pro 项目部署"
    log_info "=========================================="
    log_info "版本: ${SILKTALK_VERSION}"
    log_info "安装前缀: ${INSTALL_PREFIX}"
    log_info "镜像源: ${USE_MIRROR}"
    
    #------------------------------------------------------------------------------
    # 检查 Node.js
    #------------------------------------------------------------------------------
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装，请先运行 setup-node.sh"
        exit 1
    fi
    
    #------------------------------------------------------------------------------
    # 执行部署步骤
    #------------------------------------------------------------------------------
    deploy_project
    create_directories
    install_dependencies
    build_project
    create_launcher
    
    # 输出完成信息
    log_success "=========================================="
    log_success "SilkTalk Pro 部署完成"
    log_success "=========================================="
    log_info "安装位置: ${INSTALL_PREFIX}/silktalk-pro"
    log_info "启动命令: silktalk"
    log_info "配置文件: ${INSTALL_PREFIX}/silktalk-pro/config/"
}

# 调用主函数
main "$@"
