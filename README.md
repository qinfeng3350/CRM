# CRM客户关系管理系统

完整的CRM系统，包含11个核心功能模块。

## 功能模块

1. **客户管理模块** - 公海/私海管理、客户信息管理
2. **商机管理模块** - 商机流转、销售漏斗
3. **合同管理模块** - 合同全流程管理
4. **销售管理模块** - 销售团队、业绩、活动管理
5. **营销管理模块** - 线索管理、市场活动
6. **客户服务模块** - 工单管理、服务记录
7. **数据分析模块** - 销售分析、客户分析、报表
8. **系统管理模块** - 权限管理、系统配置
9. **集成扩展模块** - 第三方系统集成
10. **移动端功能** - 移动CRM支持
11. **智能功能** - AI辅助（预留接口）

## 技术栈

- **后端**: Node.js + Express
- **数据库**: MongoDB
- **认证**: JWT
- **ORM**: Mongoose

## 安装步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件（或使用默认配置）：

```env
PORT=3000
NODE_ENV=development

# 数据库配置（使用独立参数，不拼接字符串）
DB_HOST=localhost
DB_PORT=27017
DB_NAME=crm
DB_USER=crm
DB_PASS=crm123

JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d
```

### 3. 启动服务器

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

服务器将在 `http://localhost:3000` 启动

## API接口文档

### 认证接口

- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/profile` - 获取个人信息
- `PUT /api/auth/profile` - 更新个人信息

### 客户管理

- `GET /api/customers` - 获取客户列表
- `GET /api/customers/public` - 获取公海客户
- `GET /api/customers/private` - 获取私海客户
- `GET /api/customers/:id` - 获取单个客户
- `POST /api/customers` - 创建客户
- `PUT /api/customers/:id` - 更新客户
- `DELETE /api/customers/:id` - 删除客户
- `POST /api/customers/:id/claim` - 领取客户（公海→私海）
- `POST /api/customers/:id/return` - 退回公海

### 商机管理

- `GET /api/opportunities` - 获取商机列表
- `GET /api/opportunities/funnel` - 获取销售漏斗
- `GET /api/opportunities/:id` - 获取单个商机
- `POST /api/opportunities` - 创建商机
- `PUT /api/opportunities/:id` - 更新商机
- `DELETE /api/opportunities/:id` - 删除商机
- `POST /api/opportunities/:id/transfer` - 商机流转
- `POST /api/opportunities/:id/status` - 更新商机状态
- `POST /api/opportunities/check-auto-transfer` - 检查自动流转

### 合同管理

- `GET /api/contracts` - 获取合同列表
- `GET /api/contracts/stats` - 获取合同统计
- `GET /api/contracts/:id` - 获取单个合同
- `POST /api/contracts` - 创建合同
- `PUT /api/contracts/:id` - 更新合同
- `DELETE /api/contracts/:id` - 删除合同
- `POST /api/contracts/:id/approve` - 审批合同
- `POST /api/contracts/:id/sign` - 签订合同

### 项目管理

- `GET /api/projects` - 获取项目列表
- `GET /api/projects/:id` - 获取项目详情
- `POST /api/projects` - 创建项目
- `PUT /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目
- `GET /api/projects/:id/phases` - 获取项目阶段
- `GET /api/projects/:id/tasks` - 获取项目任务
- `GET /api/projects/:id/stats` - 获取项目统计
- `GET /api/projects/:id/dashboard` - 获取项目数据大屏
- `GET /api/projects/:id/gantt` - 获取项目甘特图数据

### 销售管理

- `GET /api/sales/team` - 获取销售团队
- `GET /api/sales/performance` - 获取销售业绩
- `GET /api/sales/activities` - 获取销售活动
- `GET /api/sales/tasks` - 获取销售任务
- `GET /api/sales/ranking` - 获取销售排行榜
- `POST /api/sales/activities` - 创建活动
- `PUT /api/sales/activities/:id` - 更新活动

### 营销管理

- `GET /api/marketing/leads` - 获取线索列表
- `POST /api/marketing/leads` - 创建线索
- `POST /api/marketing/leads/:id/convert` - 转化线索
- `GET /api/marketing/campaigns` - 获取市场活动列表
- `POST /api/marketing/campaigns` - 创建市场活动
- `GET /api/marketing/campaigns/:id/stats` - 获取活动统计

### 客户服务

- `GET /api/service` - 获取工单列表
- `GET /api/service/stats` - 获取服务统计
- `POST /api/service` - 创建工单
- `POST /api/service/:id/assign` - 分配工单
- `POST /api/service/:id/resolve` - 解决工单
- `POST /api/service/:id/rate` - 评价工单

### 数据分析

- `GET /api/analytics/sales` - 销售分析
- `GET /api/analytics/customers` - 客户分析
- `GET /api/analytics/opportunities` - 商机分析
- `GET /api/analytics/contracts` - 合同分析
- `POST /api/analytics/custom` - 自定义报表
- `POST /api/analytics/export` - 导出报表

### 系统管理

- `GET /api/system/roles` - 获取角色列表
- `POST /api/system/roles` - 创建角色
- `GET /api/system/users` - 获取用户列表
- `GET /api/system/config` - 获取系统配置
- `PUT /api/system/config` - 更新系统配置
- `GET /api/system/transfer-rules` - 获取流转规则
- `POST /api/system/transfer-rules` - 创建流转规则

## 用户角色

- **admin** - 管理员，拥有所有权限
- **sales_manager** - 销售经理，可查看团队数据
- **sales** - 销售人员，只能查看自己的数据
- **service** - 客服人员
- **marketing** - 营销人员

## 数据库配置

默认数据库配置：
- 主机: `localhost`
- 端口: `27017`
- 数据库名: `crm`
- 用户名: `crm`
- 密码: `crm123`

连接使用独立的配置参数，不拼接字符串

## 使用示例

### 1. 注册用户

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "123456",
    "name": "管理员",
    "role": "admin"
  }'
```

### 2. 登录

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "123456"
  }'
```

### 3. 创建客户

```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "测试客户",
    "company": "测试公司",
    "phone": "13800138000",
    "email": "test@example.com",
    "poolType": "public"
  }'
```

## 项目结构

```
crm-system/
├── config/          # 配置文件
├── controllers/     # 控制器
├── models/          # 数据模型
├── routes/          # 路由
├── middleware/      # 中间件
├── uploads/        # 上传文件目录
├── server.js        # 服务器入口
├── package.json     # 项目配置
└── README.md        # 说明文档
```

## 注意事项

1. 确保MongoDB服务已启动
2. 确保数据库用户有相应权限
3. 生产环境请修改JWT_SECRET
4. 建议使用环境变量管理敏感信息

## 开发计划

- [x] 基础架构搭建
- [x] 数据模型设计
- [x] API接口实现
- [ ] 前端界面开发
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能优化
- [ ] 文档完善

## 许可证

ISC

