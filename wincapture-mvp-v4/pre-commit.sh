#!/bin/bash
# Git 预提交钩子 - 代码质量检查
# 安装: 复制到 .git/hooks/pre-commit

set -e

echo "=== WinCapture MVP 预提交检查 ==="

# 检查是否有 dotnet
if ! command -v dotnet &> /dev/null; then
    echo "警告: 未找到 dotnet，跳过编译检查"
    exit 0
fi

# 获取项目目录
PROJECT_DIR=$(git rev-parse --show-toplevel)
cd "$PROJECT_DIR"

# 1. 编译检查
echo "[1/3] 编译检查..."
if ! dotnet build --no-restore -v quiet 2>&1 | grep -q "error"; then
    echo "  编译通过"
else
    echo "  编译失败，请修复错误后再提交"
    dotnet build --no-restore 2>&1 | grep "error"
    exit 1
fi

# 2. 格式检查
echo "[2/3] 格式检查..."
if command -v dotnet-format &> /dev/null; then
    if dotnet-format --check --verbosity quiet; then
        echo "  格式检查通过"
    else
        echo "  格式检查失败，运行 'dotnet-format' 修复"
        exit 1
    fi
else
    echo "  跳过 (未安装 dotnet-format)"
fi

# 3. 敏感信息检查
echo "[3/3] 敏感信息检查..."
if git diff --cached --name-only | xargs grep -l "password\|secret\|key\|token" 2>/dev/null | grep -v ".cs"; then
    echo "  警告: 可能包含敏感信息，请检查"
fi

echo "=== 预提交检查通过 ==="
exit 0
