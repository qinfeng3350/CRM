Param(
    [string]$ProjectRoot = (Split-Path -Parent $MyInvocation.MyCommand.Path),
    [string]$PM2AppName = "crm-backend",
    [int]$Port = 0
)

Write-Host "========== 墨枫CRM | Windows宝塔一键部署 ==========" -ForegroundColor Cyan
Write-Host "项目路径: $ProjectRoot"

# 1) 基本检查
function Check-Cmd($cmd){
    $exists = Get-Command $cmd -ErrorAction SilentlyContinue
    return [bool]$exists
}

if(-not (Check-Cmd node)){
    Write-Host "未检测到 Node.js，请在宝塔面板的 PM2/Node 版本管理中安装 Node 18+/20+" -ForegroundColor Red
    exit 1
}
if(-not (Check-Cmd npm)){
    Write-Host "未检测到 npm，请确认 Node 安装完整" -ForegroundColor Red
    exit 1
}

$pm2Exists = Check-Cmd pm2
if(-not $pm2Exists){
    Write-Host "未检测到 pm2，尝试全局安装..." -ForegroundColor Yellow
    npm install -g pm2 2>$null | Out-Null
    $pm2Exists = Check-Cmd pm2
    if(-not $pm2Exists){
        Write-Host "pm2 安装失败，请在宝塔面板安装 PM2 管理器后重试" -ForegroundColor Red
        exit 1
    }
}

# 2) 进入项目根目录
Set-Location $ProjectRoot

# 3) 生成或更新 .env（若不存在）
$envPath = Join-Path $ProjectRoot ".env"
if(-not (Test-Path $envPath)){
    Write-Host "未发现 .env，创建默认配置..." -ForegroundColor Yellow
    @"
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
"@ | Set-Content -Path $envPath -Encoding UTF8
}

if($Port -gt 0){
    Write-Host "设置端口为 $Port" -ForegroundColor Green
    (Get-Content $envPath) -replace "^PORT=\d+","PORT=$Port" | Set-Content $envPath -Encoding UTF8
}

# 4) 安装依赖
Write-Host "安装后端依赖..." -ForegroundColor Cyan
npm install
if($LASTEXITCODE -ne 0){ Write-Host "后端依赖安装失败" -ForegroundColor Red; exit 1 }

Write-Host "安装前端依赖..." -ForegroundColor Cyan
Push-Location (Join-Path $ProjectRoot "client")
npm install
if($LASTEXITCODE -ne 0){ Write-Host "前端依赖安装失败" -ForegroundColor Red; Pop-Location; exit 1 }

Write-Host "构建前端..." -ForegroundColor Cyan
npm run build
if($LASTEXITCODE -ne 0){ Write-Host "前端构建失败" -ForegroundColor Red; Pop-Location; exit 1 }
Pop-Location

# 5) 日志目录
$logsDir = Join-Path $ProjectRoot "logs"
if(-not (Test-Path $logsDir)){ New-Item -ItemType Directory -Path $logsDir | Out-Null }

# 6) 启动 PM2
$ecos = Join-Path $ProjectRoot "ecosystem.config.js"
if(Test-Path $ecos){
    Write-Host "使用 PM2 配置文件启动: $ecos" -ForegroundColor Green
    pm2 start $ecos
} else {
    Write-Host "未找到 ecosystem.config.js，使用 server.js 启动" -ForegroundColor Yellow
    pm2 start (Join-Path $ProjectRoot "server.js") --name $PM2AppName --time
}

pm2 save | Out-Null

# 7) 健康检查
$portValue = 3000
try{
    $content = Get-Content $envPath
    foreach($line in $content){
        if($line -match '^PORT=(\d+)'){ $portValue = [int]$Matches[1]; break }
    }
} catch {}

Start-Sleep -Seconds 3
Write-Host "检查健康接口: http://127.0.0.1:$portValue/health" -ForegroundColor Cyan
try{
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$portValue/health" -UseBasicParsing -TimeoutSec 10
    if($resp.StatusCode -eq 200){
        Write-Host "✅ 服务运行正常" -ForegroundColor Green
    } else {
        Write-Host "⚠️ 健康检查返回状态: $($resp.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ 健康检查失败，请查看 pm2 日志: pm2 logs $PM2AppName" -ForegroundColor Yellow
}

Write-Host "========== 完成 ==========" -ForegroundColor Cyan
Write-Host "下一步：在网站的 Nginx 反向代理到 127.0.0.1:$portValue，或直接用默认网站访问。"
Write-Host "常用命令：pm2 list | pm2 logs $PM2AppName | pm2 restart $PM2AppName"
