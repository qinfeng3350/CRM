# 压缩项目脚本（排除不必要文件）
# 使用方法：powershell -File compress-for-upload.ps1
# 需要安装 7-Zip: https://www.7-zip.org/

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectName = Split-Path -Leaf $projectRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName = "${projectName}-source-${timestamp}.zip"
$zipPath = Join-Path (Split-Path -Parent $projectRoot) $zipName

Write-Host "========== 项目压缩脚本 ==========" -ForegroundColor Cyan
Write-Host "项目目录: $projectRoot"
Write-Host "输出文件: $zipPath"
Write-Host ""

# 检查 7-Zip
$sevenZip = "C:\Program Files\7-Zip\7z.exe"
if (-not (Test-Path $sevenZip)) {
    $sevenZip = "C:\Program Files (x86)\7-Zip\7z.exe"
}

if (-not (Test-Path $sevenZip)) {
    Write-Host "❌ 未找到 7-Zip，请先安装: https://www.7-zip.org/" -ForegroundColor Red
    Write-Host ""
    Write-Host "或者手动压缩，请排除以下目录:" -ForegroundColor Yellow
    Write-Host "  - node_modules/" -ForegroundColor Yellow
    Write-Host "  - client/node_modules/" -ForegroundColor Yellow
    Write-Host "  - .git/" -ForegroundColor Yellow
    Write-Host "  - dist/" -ForegroundColor Yellow
    Write-Host "  - build/" -ForegroundColor Yellow
    Write-Host "  - uploads/" -ForegroundColor Yellow
    Write-Host "  - backups/" -ForegroundColor Yellow
    Write-Host "  - logs/" -ForegroundColor Yellow
    Write-Host "  - *.log" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ 找到 7-Zip: $sevenZip" -ForegroundColor Green
Write-Host ""
Write-Host "开始压缩（排除 node_modules, .git, dist, build 等目录）..." -ForegroundColor Cyan

# 排除列表
$excludePatterns = @(
    "node_modules",
    "client\node_modules",
    ".git",
    "dist",
    "build",
    "uploads",
    "backups",
    "logs",
    "*.log"
)

# 构建排除参数
$excludeArgs = @()
foreach ($pattern in $excludePatterns) {
    $excludeArgs += "-xr!$pattern"
}

# 执行压缩
try {
    & $sevenZip a -tzip -mx5 $zipPath "$projectRoot\*" $excludeArgs
    
    if ($LASTEXITCODE -eq 0) {
        $fileSize = (Get-Item $zipPath).Length / 1MB
        Write-Host ""
        Write-Host "✅ 压缩完成！" -ForegroundColor Green
        Write-Host "   文件: $zipPath" -ForegroundColor Green
        Write-Host "   大小: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Green
        Write-Host ""
        Write-Host "📝 提示：" -ForegroundColor Cyan
        Write-Host "   - 此压缩包已排除 node_modules、.git 等目录" -ForegroundColor Yellow
        Write-Host "   - 上传到服务器后，运行 npm install 安装依赖" -ForegroundColor Yellow
        Write-Host "   - 推荐使用 Git 克隆方式部署（更快更安全）" -ForegroundColor Yellow
    } else {
        Write-Host "❌ 压缩失败，错误代码: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ 压缩过程中出错: $_" -ForegroundColor Red
    exit 1
}
