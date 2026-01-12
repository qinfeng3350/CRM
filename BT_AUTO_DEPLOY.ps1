# 宝塔面板一键部署脚本（Windows）
# 使用方法: powershell -File BT_AUTO_DEPLOY.ps1

param(
    [string]$ProjectRoot = (Split-Path -Parent $MyInvocation.MyCommand.Path),
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🚀 墨枫CRM - 宝塔面板一键部署脚本" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "项目目录: $ProjectRoot" -ForegroundColor Green
Write-Host ""

# 1. 检查基本环境
Write-Host "📋 步骤 1/7: 检查环境..." -ForegroundColor Cyan
function Check-Cmd($cmd) {
    $exists = Get-Command $cmd -ErrorAction SilentlyContinue
    return [bool]$exists
}

if (-not (Check-Cmd node)) {
    Write-Host "❌ 错误: 未找到 Node.js" -ForegroundColor Red
    Write-Host "请在宝塔面板安装 PM2 管理器并安装 Node.js 18+ 或 20+" -ForegroundColor Yellow
    exit 1
}

if (-not (Check-Cmd npm)) {
    Write-Host "❌ 错误: 未找到 npm" -ForegroundColor Red
    exit 1
}

$nodeVersion = node -v
$npmVersion = npm -v
Write-Host "✅ Node.js 版本: $nodeVersion" -ForegroundColor Green
Write-Host "✅ npm 版本: $npmVersion" -ForegroundColor Green
Write-Host ""

# 2. 创建必要的目录
Write-Host "📋 步骤 2/7: 创建必要目录..." -ForegroundColor Cyan
$dirs = @("logs", "uploads")
foreach ($dir in $dirs) {
    $dirPath = Join-Path $ProjectRoot $dir
    if (-not (Test-Path $dirPath)) {
        New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
    }
}
Write-Host "✅ 目录创建完成" -ForegroundColor Green
Write-Host ""

# 3. 进入项目目录
Set-Location $ProjectRoot

# 4. 安装后端依赖
Write-Host "📋 步骤 3/7: 安装后端依赖..." -ForegroundColor Cyan
npm install --production
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 后端依赖安装失败" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 后端依赖安装完成" -ForegroundColor Green
Write-Host ""

# 5. 安装前端依赖
Write-Host "📋 步骤 4/7: 安装前端依赖..." -ForegroundColor Cyan
Push-Location (Join-Path $ProjectRoot "client")
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 前端依赖安装失败" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "✅ 前端依赖安装完成" -ForegroundColor Green
Write-Host ""

# 6. 检查并创建 .env 文件
Write-Host "📋 步骤 5/7: 检查环境变量配置..." -ForegroundColor Cyan
$envPath = Join-Path $ProjectRoot ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "⚠️  .env 文件不存在，正在创建..." -ForegroundColor Yellow
    @"
PORT=$Port
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
"@ | Set-Content -Path $envPath -Encoding UTF8
    Write-Host "✅ 已创建 .env 文件" -ForegroundColor Green
    Write-Host "⚠️  重要: 请编辑 .env 文件，填入正确的数据库密码和 JWT_SECRET" -ForegroundColor Yellow
} else {
    Write-Host "✅ .env 文件已存在" -ForegroundColor Green
}
Write-Host ""

# 7. 构建前端
Write-Host "📋 步骤 6/7: 构建前端项目..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 前端构建失败" -ForegroundColor Red
    exit 1
}

$distPath = Join-Path $ProjectRoot "client\dist"
if (-not (Test-Path $distPath) -or (Get-ChildItem $distPath -ErrorAction SilentlyContinue).Count -eq 0) {
    Write-Host "❌ 错误: 前端构建文件不存在或为空" -ForegroundColor Red
    exit 1
}
Write-Host "✅ 前端构建完成" -ForegroundColor Green
Write-Host ""

# 7. 自动修复 Nginx 配置（如果存在）
Write-Host "📋 步骤 7/8: 自动修复 Nginx 配置..." -ForegroundColor Cyan
$nginxConfWin = "C:\BtSoft\nginx\conf\proxy\mofengcrm\mofengCRM.conf"

if (Test-Path $nginxConfWin) {
    Write-Host "发现 Nginx 配置文件，检查并修复端口配置..." -ForegroundColor Yellow
    $content = Get-Content $nginxConfWin -Raw
    if ($content -match '127\.0\.0\.1:0') {
        Write-Host "修复端口配置：0 → 3000" -ForegroundColor Yellow
        $content = $content -replace '127\.0\.0\.1:0', '127.0.0.1:3000'
        $content = $content -replace 'server\s+127\.0\.0\.1:0;', 'server 127.0.0.1:3000;'
        Set-Content -Path $nginxConfWin -Value $content -NoNewline
        Write-Host "✅ Nginx 配置已自动修复" -ForegroundColor Green
    } else {
        Write-Host "✅ Nginx 配置正常" -ForegroundColor Green
    }
} else {
    Write-Host "未找到 Nginx 配置文件，跳过修复" -ForegroundColor Yellow
}
Write-Host ""

# 8. 检查 PM2
Write-Host "📋 步骤 8/8: 检查 PM2..." -ForegroundColor Cyan
if (Check-Cmd pm2) {
    Write-Host "✅ PM2 已安装" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 PM2 启动说明:" -ForegroundColor Cyan
    Write-Host "   在宝塔面板 PM2 管理器中添加项目：" -ForegroundColor Yellow
    Write-Host "   - 项目路径: $ProjectRoot" -ForegroundColor Yellow
    Write-Host "   - 启动文件: ecosystem.config.js" -ForegroundColor Yellow
    Write-Host "   - Node版本: 选择已安装的版本" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  PM2 未安装，请先在宝塔面板安装 PM2 管理器" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ 部署脚本执行完成！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 接下来的步骤：" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. 编辑 .env 文件，填入正确的配置：" -ForegroundColor Yellow
Write-Host "   - 数据库密码" -ForegroundColor Yellow
Write-Host "   - JWT_SECRET（随机字符串）" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. 在宝塔面板 PM2 管理器中添加项目：" -ForegroundColor Yellow
Write-Host "   - 项目路径: $ProjectRoot" -ForegroundColor Yellow
Write-Host "   - 启动文件: ecosystem.config.js" -ForegroundColor Yellow
Write-Host "   - Node版本: 18.x 或 20.x" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. 在网站设置中配置 Nginx 反向代理：" -ForegroundColor Yellow
Write-Host "   - 代理名称: api" -ForegroundColor Yellow
Write-Host "   - 目标URL: http://127.0.0.1:$Port" -ForegroundColor Yellow
Write-Host "   - 详细配置请查看: BT_NGINX_CONFIG.conf" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. 配置域名和 SSL 证书" -ForegroundColor Yellow
Write-Host ""
Write-Host "📖 详细部署说明请查看: BT_DEPLOY_STEPS.md" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
