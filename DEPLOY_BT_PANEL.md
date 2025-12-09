# 宝塔面板部署指南

## 📋 部署前准备

### 1. 服务器要求
- **操作系统**: Linux (CentOS 7+/Ubuntu 18+)
- **内存**: 至少 2GB
- **磁盘**: 至少 10GB 可用空间
- **已安装**: 宝塔面板 7.0+

### 2. 宝塔面板需要安装的软件
- **Nginx** (1.20+)
- **MySQL** (5.7+ 或 8.0+)
- **PM2管理器** (Node.js 版本管理器)
- **Node.js** (通过 PM2 管理器安装，推荐 18.x 或 20.x)

---

## 🚀 部署步骤

### 第一步：在宝塔面板中创建网站

1. **登录宝塔面板** → 点击左侧 **"网站"** → 点击 **"添加站点"**

2. **填写站点信息**：
   - **域名**: 填写你的域名（如：`crm.example.com`）
   - **备注**: CRM系统
   - **根目录**: `/www/wwwroot/crm.example.com`（默认即可）
   - **FTP**: 不创建
   - **数据库**: 不创建（稍后手动创建）
   - **PHP版本**: 纯静态（因为前端是静态文件）

3. 点击 **"提交"** 创建站点

---

### 第二步：上传项目代码

#### 方法一：通过 Git 克隆（推荐）

1. **在宝塔面板中打开终端**（或使用 SSH 工具连接服务器）

2. **进入网站根目录**：
```bash
cd /www/wwwroot/crm.example.com
```

3. **克隆项目**：
```bash
git clone https://github.com/qinfeng3350/CRM.git .
```

4. **如果目录不为空，先清空再克隆**：
```bash
rm -rf * .[^.]*
git clone https://github.com/qinfeng3350/CRM.git .
```

5. **运行快速部署脚本**（可选，自动安装依赖和构建）：
```bash
bash deploy.sh
```

#### 方法二：通过宝塔面板文件管理器上传

1. 在宝塔面板 → **"文件"** → 进入网站目录
2. 上传项目压缩包并解压
3. 在终端中进入项目目录，运行 `bash deploy.sh`

---

### 第三步：安装 Node.js 和依赖

1. **在宝塔面板安装 PM2 管理器**：
   - 点击左侧 **"软件商店"**
   - 搜索 **"PM2管理器"**
   - 点击 **"安装"**

2. **安装 Node.js**：
   - 打开 **PM2管理器**
   - 点击 **"Node版本管理"**
   - 安装 **Node.js 18.x** 或 **20.x**

3. **安装项目依赖**：

在宝塔终端中执行：

```bash
# 进入项目目录
cd /www/wwwroot/crm.example.com

# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```

---

### 第四步：构建前端项目

```bash
# 在项目根目录执行
npm run build
```

构建完成后，前端文件会在 `client/dist` 目录中。

---

### 第五步：创建 MySQL 数据库

1. **在宝塔面板创建数据库**：
   - 点击左侧 **"数据库"** → **"添加数据库"**
   - **数据库名**: `crm`（或自定义）
   - **用户名**: `crm`（或自定义）
   - **密码**: 设置一个强密码（记住这个密码）
   - 点击 **"提交"**

2. **导入数据库结构**（如果有 SQL 文件）：
   - 点击数据库右侧 **"管理"** → 进入 phpMyAdmin
   - 选择创建的数据库
   - 点击 **"导入"** → 选择 SQL 文件 → **"执行"**

3. **或者运行初始化脚本**（如果项目有）：
```bash
cd /www/wwwroot/crm.example.com
node scripts/setup-database.js
```

---

### 第六步：配置环境变量

1. **在项目根目录创建 `.env` 文件**：

在宝塔面板 → **"文件"** → 进入项目目录 → 点击 **"新建文件"** → 文件名：`.env`

2. **编辑 `.env` 文件，填入以下内容**：

```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 数据库配置（使用宝塔创建的数据库信息）
DB_HOST=localhost
DB_PORT=3306
DB_NAME=crm
DB_USER=crm
DB_PASSWORD=你的数据库密码

# JWT 配置
JWT_SECRET=你的JWT密钥_请修改为随机字符串
JWT_EXPIRE=7d

# 钉钉配置（可选）
DINGTALK_APP_KEY=你的钉钉AppKey
DINGTALK_APP_SECRET=你的钉钉AppSecret
DINGTALK_AGENT_ID=你的钉钉AgentId
DINGTALK_CORP_ID=你的钉钉CorpId

# 前端 URL（用于钉钉回调）
FRONTEND_URL=https://crm.example.com
API_BASE_URL=https://crm.example.com/api
```

**重要提示**：
- 将 `crm.example.com` 替换为你的实际域名
- 将数据库密码替换为实际密码
- `JWT_SECRET` 请修改为随机字符串（可以使用在线工具生成）

---

### 第七步：使用 PM2 启动后端服务

#### 方法一：使用 PM2 配置文件（推荐）

1. **在宝塔面板打开 PM2 管理器**

2. **使用配置文件启动**：
   - 点击 **"添加项目"**
   - **项目名称**: `crm-backend`
   - **项目路径**: `/www/wwwroot/crm.example.com`
   - **启动文件**: `ecosystem.config.js`（选择配置文件）
   - **Node版本**: 选择已安装的 Node.js 版本（如 18.x）
   - 点击 **"提交"** 启动项目

#### 方法二：手动配置

1. **在宝塔面板打开 PM2 管理器**

2. **添加项目**：
   - 点击 **"添加项目"**
   - **项目名称**: `crm-backend`
   - **项目路径**: `/www/wwwroot/crm.example.com`
   - **启动文件**: `server.js`
   - **Node版本**: 选择已安装的 Node.js 版本（如 18.x）
   - **运行模式**: `fork`
   - **项目端口**: `3000`

3. **点击 "提交"** 启动项目

4. **验证服务是否运行**：
   - 在 PM2 管理器中查看项目状态，应该显示 **"运行中"**
   - 点击 **"日志"** 查看是否有错误

---

### 第八步：配置 Nginx 反向代理

1. **在宝塔面板配置网站**：
   - 点击 **"网站"** → 找到你的网站 → 点击 **"设置"**

2. **配置反向代理**：
   - 点击 **"反向代理"** 标签
   - 点击 **"添加反向代理"**
   - **代理名称**: `api`
   - **目标URL**: `http://127.0.0.1:3000`
   - **发送域名**: `$host`
   - 点击 **"提交"**

3. **修改代理配置**（点击代理名称右侧的 **"配置"**）：

将配置修改为（或直接复制 `nginx.conf.example` 文件中的配置）：

```nginx
location /api {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # 超时设置
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
    
    # 支持大文件上传
    client_max_body_size 50m;
}
```

4. **配置前端静态文件**：

在 **"网站设置"** → **"配置文件"** 中，找到 `location /` 部分，修改为（或参考 `nginx.conf.example` 文件）：

```nginx
location / {
    root /www/wwwroot/crm.example.com/client/dist;
    try_files $uri $uri/ /index.html;
    index index.html;
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # HTML 文件不缓存
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
    }
}
```

**提示**: 完整的 Nginx 配置示例请查看项目根目录的 `nginx.conf.example` 文件。

5. **保存配置并重载 Nginx**：
   - 点击 **"保存"**
   - 点击 **"重载配置"**

---

### 第九步：配置 SSL 证书（HTTPS）

1. **在宝塔面板申请 SSL 证书**：
   - 点击网站 **"设置"** → **"SSL"** 标签
   - 选择 **"Let's Encrypt"** → 勾选域名 → 点击 **"申请"**
   - 申请成功后，开启 **"强制HTTPS"**

2. **或者上传已有证书**：
   - 如果有自己的 SSL 证书，可以上传证书和私钥

---

### 第十步：配置防火墙

1. **在宝塔面板开放端口**：
   - 点击左侧 **"安全"**
   - 确保以下端口已开放：
     - **80** (HTTP)
     - **443** (HTTPS)
     - **3000** (后端服务，仅本地访问，不需要对外开放)

---

## 🔧 常用命令

### PM2 管理命令

在宝塔终端中执行：

```bash
# 查看所有进程
pm2 list

# 查看日志
pm2 logs crm-backend

# 重启服务
pm2 restart crm-backend

# 停止服务
pm2 stop crm-backend

# 删除服务
pm2 delete crm-backend
```

### 更新代码

```bash
# 进入项目目录
cd /www/wwwroot/crm.example.com

# 拉取最新代码
git pull origin main

# 重新安装依赖（如果有新依赖）
npm install
cd client && npm install && cd ..

# 重新构建前端
npm run build

# 重启 PM2 服务
pm2 restart crm-backend
```

---

## 🐛 常见问题排查

### 1. 后端服务无法启动

**检查步骤**：
- 查看 PM2 日志：`pm2 logs crm-backend`
- 检查 `.env` 文件配置是否正确
- 检查数据库连接是否正常
- 检查端口 3000 是否被占用：`netstat -tlnp | grep 3000`

### 2. API 请求返回 404

**检查步骤**：
- 确认 Nginx 反向代理配置正确
- 确认后端服务正在运行：`pm2 list`
- 检查 Nginx 错误日志：宝塔面板 → 网站 → 设置 → 日志

### 3. 前端页面空白

**检查步骤**：
- 确认前端已构建：检查 `client/dist` 目录是否存在
- 检查 Nginx 配置中的 `root` 路径是否正确
- 查看浏览器控制台是否有错误

### 4. 数据库连接失败

**检查步骤**：
- 确认数据库用户名、密码、数据库名正确
- 确认数据库已创建
- 检查 MySQL 服务是否运行：宝塔面板 → 数据库 → 查看状态
- 检查防火墙是否阻止了数据库连接

---

## 📝 域名配置说明

### 域名解析

1. **在域名服务商处添加 A 记录**：
   - **主机记录**: `@` 或 `crm`（根据你的需求）
   - **记录类型**: `A`
   - **记录值**: 你的服务器 IP 地址
   - **TTL**: 600（默认）

2. **如果使用子域名**（如 `crm.example.com`）：
   - **主机记录**: `crm`
   - **记录类型**: `A`
   - **记录值**: 你的服务器 IP 地址

### 宝塔面板域名绑定

1. 在创建网站时已填写域名
2. 如果需要添加多个域名：
   - 网站 → 设置 → 域名管理 → 添加域名

---

## ✅ 部署完成检查清单

- [ ] 代码已上传到服务器
- [ ] 后端和前端依赖已安装
- [ ] 前端已构建（`client/dist` 目录存在）
- [ ] 数据库已创建并配置
- [ ] `.env` 文件已配置
- [ ] PM2 服务已启动并运行
- [ ] Nginx 反向代理已配置
- [ ] SSL 证书已配置（HTTPS）
- [ ] 防火墙端口已开放
- [ ] 域名已解析到服务器 IP
- [ ] 可以访问网站首页
- [ ] API 接口可以正常调用

---

## 🎉 部署完成

部署完成后，访问你的域名（如：`https://crm.example.com`）即可使用系统。

**默认管理员账号**（如果已初始化）：
- 用户名：根据初始化脚本设置
- 密码：根据初始化脚本设置

如果还没有初始化管理员，请运行：
```bash
node scripts/init-admin.js
```

---

## 📞 技术支持

如遇到问题，请检查：
1. 宝塔面板日志
2. PM2 日志
3. Nginx 错误日志
4. 浏览器控制台错误

