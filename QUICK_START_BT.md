# 宝塔面板快速部署指南（简化版）

## 🚀 5 分钟快速部署

> Windows 宝塔面板用户可直接在网站目录终端执行：
>
> PowerShell（推荐）：
> ```powershell
> cd C:\wwwroot\mofengCRM
> powershell -File scripts\deploy-bt-win.ps1
> # 如需指定端口：
> powershell -File scripts\deploy-bt-win.ps1 -Port 3000
> ```
>
> 该脚本会：安装依赖 → 构建前端 → 生成 .env（如缺失）→ 使用 PM2 启动 → 健康检查。

### 1. 创建网站
- 宝塔面板 → 网站 → 添加站点
- 域名：`crm.yunshangdingchuang.cn`
- 根目录：`/www/wwwroot/crm.yunshangdingchuang.cn`

### 2. 克隆代码
```bash
cd /www/wwwroot/crm.yunshangdingchuang.cn
git clone https://github.com/qinfeng3350/CRM.git .
bash deploy.sh
```

### 3. 创建数据库
- 宝塔面板 → 数据库 → 添加数据库
- 数据库名：`crm`
- 用户名：`crm`
- 密码：设置强密码（记住）

### 4. 配置环境变量
编辑 `.env` 文件：
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=crm
DB_USER=crm
DB_PASSWORD=你的数据库密码
FRONTEND_URL=https://crm.yunshangdingchuang.cn
API_BASE_URL=https://crm.yunshangdingchuang.cn/api
```

### 5. 启动 PM2
- 宝塔面板 → PM2管理器 → 添加项目
- 项目路径：`/www/wwwroot/crm.example.com`
- 启动文件：`ecosystem.config.js` 或 `server.js`
- Node版本：18.x 或 20.x

### 6. 配置 Nginx
- 网站 → 设置 → 反向代理 → 添加
- 代理名称：`api`
- 目标URL：`http://127.0.0.1:3000`

然后在网站设置 → 配置文件中，将 `location /` 修改为：
```nginx
location / {
    root /www/wwwroot/crm.yunshangdingchuang.cn/client/dist;
    try_files $uri $uri/ /index.html;
}
```

### 7. 配置 SSL
- 网站 → 设置 → SSL → Let's Encrypt → 申请

---

## 📋 关键命令

### 更新代码
```bash
cd /www/wwwroot/crm.yunshangdingchuang.cn
git pull
npm install
cd client && npm install && cd ..
npm run build
pm2 restart crm-backend
```

### 查看日志
```bash
pm2 logs crm-backend
```

### 重启服务
```bash
pm2 restart crm-backend
```

---

## 🔧 域名配置

### 域名解析（在域名服务商处）
- **类型**: A 记录
- **主机记录**: `crm`（或 `@`）
- **记录值**: 服务器 IP 地址

### 宝塔面板绑定
- 网站 → 设置 → 域名管理 → 添加域名

---

## ✅ 检查清单

- [ ] 代码已克隆
- [ ] 依赖已安装（运行了 `deploy.sh`）
- [ ] 数据库已创建
- [ ] `.env` 已配置
- [ ] PM2 服务运行中
- [ ] Nginx 反向代理已配置
- [ ] SSL 证书已配置
- [ ] 域名已解析

---

## 🐛 常见问题

**后端无法启动？**
```bash
pm2 logs crm-backend  # 查看日志
```

**API 404？**
- 检查 Nginx 反向代理配置
- 确认 PM2 服务运行中

**页面空白？**
- 确认运行了 `npm run build`
- 检查 `client/dist` 目录是否存在

---

详细说明请查看：`DEPLOY_BT_PANEL.md`

