#!/bin/bash

# 宝塔面板快速部署脚本
# 使用方法: bash deploy.sh

echo "=========================================="
echo "🚀 开始部署 CRM 系统到宝塔面板"
echo "=========================================="

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录执行此脚本"
    exit 1
fi

# 1. 安装后端依赖
echo ""
echo "📦 步骤 1/5: 安装后端依赖..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ 后端依赖安装失败"
    exit 1
fi
echo "✅ 后端依赖安装完成"

# 2. 安装前端依赖
echo ""
echo "📦 步骤 2/5: 安装前端依赖..."
cd client
npm install
if [ $? -ne 0 ]; then
    echo "❌ 前端依赖安装失败"
    exit 1
fi
cd ..
echo "✅ 前端依赖安装完成"

# 3. 检查 .env 文件
echo ""
echo "📝 步骤 3/5: 检查环境变量配置..."
if [ ! -f ".env" ]; then
    echo "⚠️  警告: .env 文件不存在"
    echo "📋 正在从 .env.example 创建 .env 文件..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ 已创建 .env 文件，请编辑并填入正确的配置"
        echo "⚠️  重要: 请修改 .env 文件中的数据库配置和域名配置"
    else
        echo "❌ 错误: .env.example 文件不存在"
        exit 1
    fi
else
    echo "✅ .env 文件已存在"
fi

# 4. 构建前端
echo ""
echo "🔨 步骤 4/5: 构建前端项目..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 前端构建失败"
    exit 1
fi
echo "✅ 前端构建完成"

# 5. 检查构建结果
echo ""
echo "🔍 步骤 5/5: 检查构建结果..."
if [ -d "client/dist" ] && [ "$(ls -A client/dist)" ]; then
    echo "✅ 前端构建文件已生成: client/dist"
else
    echo "❌ 错误: 前端构建文件不存在或为空"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ 部署脚本执行完成！"
echo "=========================================="
echo ""
echo "📋 接下来的步骤："
echo "1. 在宝塔面板中创建 MySQL 数据库"
echo "2. 编辑 .env 文件，填入数据库配置和域名"
echo "3. 在 PM2 管理器中添加项目："
echo "   - 项目路径: $(pwd)"
echo "   - 启动文件: server.js"
echo "   - 端口: 3000"
echo "4. 在网站设置中配置 Nginx 反向代理"
echo "5. 配置 SSL 证书（HTTPS）"
echo ""
echo "📖 详细部署说明请查看: DEPLOY_BT_PANEL.md"
echo "=========================================="

