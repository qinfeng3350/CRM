# 宝塔部署检查报告

## ✅ 项目可以部署到宝塔

项目已经完全准备好部署到宝塔面板，所有必要的配置文件和脚本都已就绪。

---

## 📋 域名配置更新

已将所有配置更新为新域名：**`https://crm.yunshangdingchuang.cn`**

### 已更新的文件：

1. **部署脚本**
   - `scripts/deploy-bt-win.ps1` - Windows 宝塔部署脚本
   - 默认域名已更新

2. **部署文档**
   - `DEPLOY_BT_PANEL.md` - 完整部署指南
   - `QUICK_START_BT.md` - 快速部署指南
   - 所有示例域名已更新

3. **配置文件**
   - `nginx.conf.example` - Nginx 配置示例
   - 路径已更新为新域名

4. **数据库更新脚本**
   - `scripts/update-domain.js` - 新增域名更新脚本
   - 用于更新数据库中的钉钉配置

---

## 🚀 宝塔部署步骤

### 1. 环境准备

- ✅ Node.js 18+ 或 20+（通过 PM2 管理器安装）
- ✅ MySQL 5.7+ 或 8.0+
- ✅ Nginx 1.20+
- ✅ PM2 管理器

### 2. 创建网站

在宝塔面板中：
- 网站 → 添加站点
- 域名：`crm.yunshangdingchuang.cn`
- 根目录：`/www/wwwroot/crm.yunshangdingchuang.cn`

### 3. 上传代码

```bash
cd /www/wwwroot/crm.yunshangdingchuang.cn
git clone <你的仓库地址> .
```

### 4. 安装依赖

```bash
# 后端依赖
npm install

# 前端依赖
cd client
npm install
cd ..
```

### 5. 构建前端

```bash
npm run build
```

### 6. 创建数据库

在宝塔面板中：
- 数据库 → 添加数据库
- 数据库名：`crm`（或自定义）
- 用户名：`crm`（或自定义）
- 密码：设置强密码

### 7. 配置环境变量

创建 `.env` 文件：

```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=crm
DB_USER=crm
DB_PASSWORD=你的数据库密码

# JWT 配置
JWT_SECRET=你的JWT密钥_请修改为随机字符串
JWT_EXPIRE=7d

# 域名配置（已更新）
FRONTEND_URL=https://crm.yunshangdingchuang.cn
API_BASE_URL=https://crm.yunshangdingchuang.cn/api
SERVER_URL=https://crm.yunshangdingchuang.cn

# 钉钉配置（可选）
DINGTALK_APP_KEY=你的钉钉AppKey
DINGTALK_APP_SECRET=你的钉钉AppSecret
DINGTALK_AGENT_ID=你的钉钉AgentId
DINGTALK_CORP_ID=你的钉钉CorpId
```

### 8. 启动 PM2 服务

在宝塔面板 PM2 管理器中：
- 添加项目
- 项目路径：`/www/wwwroot/crm.yunshangdingchuang.cn`
- 启动文件：`ecosystem.config.js` 或 `server.js`
- Node版本：选择已安装的版本

### 9. 配置 Nginx 反向代理

在网站设置中：

**反向代理配置**：
- 代理名称：`api`
- 目标URL：`http://127.0.0.1:3000`

**静态文件配置**（在配置文件中）：
```nginx
location / {
    root /www/wwwroot/crm.yunshangdingchuang.cn/client/dist;
    try_files $uri $uri/ /index.html;
    index index.html;
}
```

### 10. 配置 SSL 证书

在网站设置中：
- SSL → Let's Encrypt → 申请证书
- 开启强制 HTTPS

### 11. 更新数据库中的域名配置（如果使用钉钉集成）

运行域名更新脚本：

```bash
node scripts/update-domain.js
```

这将更新数据库中的钉钉配置表，包括：
- `callbackUrl`: `https://crm.yunshangdingchuang.cn/auth/dingtalk/callback`
- `frontendUrl`: `https://crm.yunshangdingchuang.cn`
- `serverUrl`: `https://crm.yunshangdingchuang.cn`

---

## 🔍 部署检查清单

- [ ] 代码已上传到服务器
- [ ] 后端和前端依赖已安装
- [ ] 前端已构建（`client/dist` 目录存在）
- [ ] 数据库已创建并配置
- [ ] `.env` 文件已配置（包含新域名）
- [ ] PM2 服务已启动并运行
- [ ] Nginx 反向代理已配置
- [ ] SSL 证书已配置（HTTPS）
- [ ] 防火墙端口已开放（80, 443）
- [ ] 域名已解析到服务器 IP
- [ ] 数据库域名配置已更新（运行 `update-domain.js`）
- [ ] 可以访问网站首页
- [ ] API 接口可以正常调用

---

## 📝 重要提示

### 域名配置

1. **环境变量**：确保 `.env` 文件中的域名配置正确
2. **数据库配置**：如果使用钉钉集成，运行 `scripts/update-domain.js` 更新数据库配置
3. **钉钉开放平台**：如果使用钉钉集成，需要在钉钉开放平台更新回调地址为：
   ```
   https://crm.yunshangdingchuang.cn/auth/dingtalk/callback
   ```

### 前端 API 配置

前端会自动根据当前访问域名推断 API 地址，无需额外配置。如果访问 `https://crm.yunshangdingchuang.cn`，API 会自动使用 `https://crm.yunshangdingchuang.cn/api`。

### 端口配置

- **后端服务端口**：3000（仅本地访问，通过 Nginx 反向代理）
- **HTTP 端口**：80（Nginx）
- **HTTPS 端口**：443（Nginx）

---

## 🐛 常见问题

### 1. 后端服务无法启动

**检查**：
```bash
pm2 logs crm-backend
```

**可能原因**：
- `.env` 文件配置错误
- 数据库连接失败
- 端口 3000 被占用

### 2. API 请求返回 404

**检查**：
- Nginx 反向代理配置是否正确
- PM2 服务是否运行：`pm2 list`
- Nginx 错误日志：网站 → 设置 → 日志

### 3. 前端页面空白

**检查**：
- 前端是否已构建：`ls client/dist`
- Nginx 配置中的 `root` 路径是否正确
- 浏览器控制台是否有错误

### 4. 数据库连接失败

**检查**：
- 数据库用户名、密码、数据库名是否正确
- MySQL 服务是否运行
- 防火墙是否阻止连接

---

## 📞 技术支持

如遇到问题，请检查：
1. 宝塔面板日志
2. PM2 日志：`pm2 logs crm-backend`
3. Nginx 错误日志
4. 浏览器控制台错误

---

## ✅ 总结

✅ **项目完全支持宝塔部署**
✅ **所有域名配置已更新为新域名**
✅ **部署脚本和文档已就绪**
✅ **数据库更新脚本已创建**

**下一步**：按照上述步骤在宝塔面板中部署项目即可。
