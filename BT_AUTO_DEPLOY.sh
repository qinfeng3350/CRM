#!/bin/bash
# 宝塔面板一键部署脚本
# 使用方法: bash BT_AUTO_DEPLOY.sh

set -e

echo "=========================================="
echo "🚀 墨枫CRM - 宝塔面板一键部署脚本"
echo "=========================================="
echo ""

# 获取当前目录
PROJECT_DIR=$(pwd)
echo "项目目录: $PROJECT_DIR"
echo ""

# 1. 检查基本环境
echo "📋 步骤 1/7: 检查环境..."
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    echo "请在宝塔面板安装 PM2 管理器并安装 Node.js 18+ 或 20+"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到 npm"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✅ Node.js 版本: $NODE_VERSION"
echo "✅ npm 版本: $(npm -v)"
echo ""

# 2. 创建必要的目录
echo "📋 步骤 2/7: 创建必要目录..."
mkdir -p logs
mkdir -p uploads
echo "✅ 目录创建完成"
echo ""

# 3. 安装后端依赖
echo "📋 步骤 3/7: 安装后端依赖..."
npm install --production
if [ $? -ne 0 ]; then
    echo "❌ 后端依赖安装失败"
    exit 1
fi
echo "✅ 后端依赖安装完成"
echo ""

# 4. 安装前端依赖
echo "📋 步骤 4/7: 安装前端依赖..."
cd client
npm install
if [ $? -ne 0 ]; then
    echo "❌ 前端依赖安装失败"
    exit 1
fi
cd ..
echo "✅ 前端依赖安装完成"
echo ""

# 5. 检查并创建 .env 文件
echo "📋 步骤 5/7: 检查环境变量配置..."
if [ ! -f ".env" ]; then
    echo "⚠️  .env 文件不存在，正在创建..."
    cat > .env << 'EOF'
PORT=3000
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_NAME=crm
DB_USER=crm
DB_PASSWORD=
JWT_SECRET=
JWT_EXPIRE=7d
FRONTEND_URL=https://crm.yunshangdingchuang.cn
API_BASE_URL=https://crm.yunshangdingchuang.cn/api
SERVER_URL=https://crm.yunshangdingchuang.cn
EOF
    echo "✅ 已创建 .env 文件"
    echo "⚠️  重要: 请编辑 .env 文件，填入正确的数据库密码和 JWT_SECRET"
else
    echo "✅ .env 文件已存在"
fi
echo ""

# 6. 构建前端
echo "📋 步骤 6/7: 构建前端项目..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 前端构建失败"
    exit 1
fi

if [ ! -d "client/dist" ] || [ -z "$(ls -A client/dist)" ]; then
    echo "❌ 错误: 前端构建文件不存在或为空"
    exit 1
fi
echo "✅ 前端构建完成"
echo ""

# 7. 自动修复 Nginx 配置（如果存在）
echo "📋 步骤 7/8: 自动修复 Nginx 配置..."
NGINX_CONF_LINUX="/www/server/nginx/conf/proxy/mofengcrm/mofengCRM.conf"
NGINX_CONF_WIN="C:/BtSoft/nginx/conf/proxy/mofengcrm/mofengCRM.conf"

if [ -f "$NGINX_CONF_LINUX" ]; then
    echo "发现 Nginx 配置文件，检查并修复端口配置..."
    if grep -q "127.0.0.1:0" "$NGINX_CONF_LINUX"; then
        echo "修复端口配置：0 → 3000"
        sed -i 's/127\.0\.0\.1:0/127.0.0.1:3000/g' "$NGINX_CONF_LINUX"
        sed -i 's/server\s\+127\.0\.0\.1:0;/server 127.0.0.1:3000;/g' "$NGINX_CONF_LINUX"
        echo "✅ Nginx 配置已自动修复"
    else
        echo "✅ Nginx 配置正常"
    fi
fi
echo ""

# 8. 检查 PM2
echo "📋 步骤 8/8: 检查 PM2..."
if command -v pm2 &> /dev/null; then
    echo "✅ PM2 已安装"
    echo ""
    echo "📝 PM2 启动说明:"
    echo "   在宝塔面板 PM2 管理器中添加项目："
    echo "   - 项目路径: $PROJECT_DIR"
    echo "   - 启动文件: ecosystem.config.js"
    echo "   - Node版本: 选择已安装的版本"
else
    echo "⚠️  PM2 未安装，请先在宝塔面板安装 PM2 管理器"
fi
echo ""

echo "=========================================="
echo "✅ 部署脚本执行完成！"
echo "=========================================="
echo ""
echo "📋 接下来的步骤："
echo ""
echo "1. 编辑 .env 文件，填入正确的配置："
echo "   - 数据库密码"
echo "   - JWT_SECRET（随机字符串）"
echo ""
echo "2. 在宝塔面板 PM2 管理器中添加项目："
echo "   - 项目路径: $PROJECT_DIR"
echo "   - 启动文件: ecosystem.config.js"
echo "   - Node版本: 18.x 或 20.x"
echo ""
echo "3. 在网站设置中配置 Nginx 反向代理："
echo "   - 代理名称: api"
echo "   - 目标URL: http://127.0.0.1:3000"
echo "   - 详细配置请查看: nginx.conf.example"
echo ""
echo "4. 配置域名和 SSL 证书"
echo ""
echo "📖 详细部署说明请查看: DEPLOY_BT_PANEL.md"
echo "=========================================="
