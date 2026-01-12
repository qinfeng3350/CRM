# 宝塔服务器文件删除问题解决方案

## 🔍 问题分析

**错误信息**：
```
The process cannot access the file because it is being used by another process.
```

**原因**：这不是代码漏洞，而是文件/目录被正在运行的进程占用。

---

## ✅ 解决方案

### 方法一：停止 PM2 服务后删除（推荐）

1. **在宝塔面板停止 PM2 服务**：
   - 打开 **PM2 管理器**
   - 找到 `crm-backend` 项目
   - 点击 **"停止"** 或 **"删除"**

2. **或者使用命令行停止**：
   ```bash
   pm2 stop crm-backend
   pm2 delete crm-backend
   ```

3. **等待几秒钟让进程完全退出**

4. **然后再删除文件**

---

### 方法二：使用宝塔终端强制停止进程

1. **打开宝塔终端**

2. **查找占用文件的进程**：
   ```bash
   # Windows 系统
   netstat -ano | findstr :3000
   
   # 或查看 Node.js 进程
   tasklist | findstr node
   ```

3. **停止进程**：
   ```bash
   # 停止所有 Node.js 进程（谨慎使用）
   taskkill /F /IM node.exe
   
   # 或停止特定进程（替换 PID 为实际进程ID）
   taskkill /F /PID <进程ID>
   ```

4. **然后再删除文件**

---

### 方法三：重启服务器后删除

如果上述方法都不行：

1. **在宝塔面板重启服务器**
2. **重启后立即删除文件**（在服务自动启动之前）

---

### 方法四：使用宝塔文件管理器

1. **先停止所有相关服务**（PM2、Nginx 等）
2. **等待 10-15 秒**
3. **使用宝塔文件管理器删除**（而不是通过上传覆盖）

---

## 📋 标准操作流程（更新代码）

如果需要更新代码，推荐使用以下流程：

### 1. 停止服务
```bash
pm2 stop crm-backend
```

### 2. 备份（可选）
```bash
# 备份当前代码
cp -r /www/wwwroot/crm.yunshangdingchuang.cn /www/wwwroot/crm_backup_$(date +%Y%m%d)
```

### 3. 更新代码
```bash
cd /www/wwwroot/crm.yunshangdingchuang.cn
git pull origin main
# 或删除旧文件后重新上传
```

### 4. 安装依赖（如果需要）
```bash
npm install
cd client && npm install && cd ..
```

### 5. 重新构建前端（如果需要）
```bash
npm run build
```

### 6. 启动服务
```bash
pm2 restart crm-backend
# 或
pm2 start ecosystem.config.js
```

---

## 🔧 Windows 宝塔特殊处理

如果是 Windows 宝塔面板：

### 1. 使用 PowerShell 停止服务
```powershell
# 查看 PM2 进程
pm2 list

# 停止服务
pm2 stop crm-backend
pm2 delete crm-backend

# 等待进程退出
Start-Sleep -Seconds 5

# 强制终止 Node.js 进程（如果还有）
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

### 2. 使用任务管理器
1. 打开 **任务管理器**（Ctrl + Shift + Esc）
2. 找到 **Node.js** 进程
3. 右键 → **结束任务**
4. 然后再删除文件

---

## ⚠️ 重要提示

### 不要直接删除正在运行的服务

- ❌ **错误做法**：服务运行时直接删除文件
- ✅ **正确做法**：先停止服务 → 等待进程退出 → 再删除文件

### 检查进程是否完全退出

删除前确认：
```bash
# 检查端口是否还在使用
netstat -ano | findstr :3000

# 检查 Node.js 进程
tasklist | findstr node

# 如果没有输出，说明进程已退出，可以安全删除
```

---

## 🐛 常见问题

### Q1: 停止 PM2 后还是删除不了？

**解决方案**：
1. 检查是否还有其他 Node.js 进程：`tasklist | findstr node`
2. 检查 Nginx 是否在使用文件（静态文件服务）
3. 重启服务器后再删除

### Q2: 如何防止这个问题？

**建议**：
1. 使用 Git 管理代码，通过 `git pull` 更新，而不是删除整个目录
2. 更新代码时使用标准流程（先停止服务）
3. 使用版本控制，避免直接覆盖生产环境

### Q3: 代码中是否有阻止删除的代码？

**答案**：没有。代码中：
- ✅ `ecosystem.config.js` 中 `watch: false`（没有文件监听）
- ✅ 没有文件锁机制
- ✅ 没有阻止删除的代码

这是正常的操作系统文件保护机制。

---

## 📝 总结

**问题本质**：文件被进程占用（PM2、Node.js 等）

**解决方法**：停止服务 → 等待进程退出 → 删除文件

**最佳实践**：使用 Git 管理代码，通过 `git pull` 更新代码，而不是删除整个目录。

---

## 🔗 相关文档

- `DEPLOY_BT_PANEL.md` - 完整部署指南
- `QUICK_START_BT.md` - 快速部署指南
