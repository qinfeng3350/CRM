# CRM系统 API 接口文档

## 基础信息

- **基础URL**: `http://localhost:3000/api`
- **数据格式**: JSON
- **认证方式**: Bearer Token (JWT)
- **字符编码**: UTF-8

## 认证说明

大部分接口需要在请求头中携带认证令牌：

```
Authorization: Bearer <your_token>
```

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": { ... }
}
```

### 错误响应
```json
{
  "success": false,
  "message": "错误信息"
}
```

## 接口列表

### 1. 认证模块 (`/api/auth`)

#### 1.1 用户注册
- **接口**: `POST /api/auth/register`
- **说明**: 注册新用户
- **请求参数**:
```json
{
  "username": "string (必填, 唯一)",
  "email": "string (必填, 唯一)",
  "password": "string (必填, 最少6位)",
  "name": "string (必填)",
  "role": "string (可选: admin, sales_manager, sales, service, marketing, 默认: sales)",
  "department": "string (可选)"
}
```
- **响应示例**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "zhangsan",
      "email": "zhangsan@example.com",
      "name": "张三",
      "role": "sales"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### 1.2 用户登录
- **接口**: `POST /api/auth/login`
- **说明**: 用户登录获取token
- **请求参数**:
```json
{
  "email": "string (必填)",
  "password": "string (必填)"
}
```
- **响应示例**: 同注册接口

#### 1.3 获取个人信息
- **接口**: `GET /api/auth/profile`
- **说明**: 获取当前登录用户信息
- **认证**: 需要
- **响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "zhangsan",
    "email": "zhangsan@example.com",
    "name": "张三",
    "role": "sales",
    "department": "销售部",
    "phone": "13800138000",
    "status": "active"
  }
}
```

#### 1.4 更新个人信息
- **接口**: `PUT /api/auth/profile`
- **说明**: 更新当前用户信息
- **认证**: 需要
- **请求参数**:
```json
{
  "name": "string (可选)",
  "phone": "string (可选)",
  "department": "string (可选)"
}
```

---

### 2. 客户管理 (`/api/customers`)

#### 2.1 获取客户列表
- **接口**: `GET /api/customers`
- **说明**: 获取客户列表（支持分页和筛选）
- **认证**: 需要
- **查询参数**:
  - `page`: 页码 (默认: 1)
  - `limit`: 每页数量 (默认: 20)
  - `poolType`: 客户池类型 (public/private)
  - `category`: 客户分类 (potential/intention/customer/lost)
  - `search`: 搜索关键词（姓名/公司/电话）
- **响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "李四",
      "company": "ABC公司",
      "phone": "13900139000",
      "email": "lisi@example.com",
      "poolType": "public",
      "category": "potential",
      "ownerId": null,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

#### 2.2 获取公海客户
- **接口**: `GET /api/customers/public`
- **说明**: 获取公海客户列表
- **认证**: 需要

#### 2.3 获取私海客户
- **接口**: `GET /api/customers/private`
- **说明**: 获取当前用户的私海客户
- **认证**: 需要

#### 2.4 获取单个客户
- **接口**: `GET /api/customers/:id`
- **说明**: 获取客户详情
- **认证**: 需要
- **响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "李四",
    "company": "ABC公司",
    "phone": "13900139000",
    "email": "lisi@example.com",
    "address": "北京市朝阳区",
    "poolType": "public",
    "category": "potential",
    "ownerId": null,
    "source": "线上",
    "industry": "IT",
    "scale": "medium",
    "description": "潜在客户",
    "opportunities": []
  }
}
```

#### 2.5 创建客户
- **接口**: `POST /api/customers`
- **说明**: 创建新客户
- **认证**: 需要
- **请求参数**:
```json
{
  "name": "string (必填)",
  "company": "string (可选)",
  "phone": "string (可选)",
  "email": "string (可选)",
  "address": "string (可选)",
  "poolType": "string (可选: public/private, 默认: public)",
  "source": "string (可选)",
  "category": "string (可选: potential/intention/customer/lost, 默认: potential)",
  "industry": "string (可选)",
  "scale": "string (可选: small/medium/large, 默认: small)",
  "description": "string (可选)",
  "ownerId": "number (可选)"
}
```

#### 2.6 更新客户
- **接口**: `PUT /api/customers/:id`
- **说明**: 更新客户信息
- **认证**: 需要

#### 2.7 删除客户
- **接口**: `DELETE /api/customers/:id`
- **说明**: 删除客户
- **认证**: 需要

#### 2.8 认领客户
- **接口**: `POST /api/customers/:id/claim`
- **说明**: 从公海认领客户到私海
- **认证**: 需要

#### 2.9 退回公海
- **接口**: `POST /api/customers/:id/return`
- **说明**: 将客户退回公海
- **认证**: 需要

---

### 3. 商机管理 (`/api/opportunities`)

#### 3.1 获取商机列表
- **接口**: `GET /api/opportunities`
- **说明**: 获取商机列表
- **认证**: 需要
- **查询参数**:
  - `page`: 页码
  - `limit`: 每页数量
  - `status`: 状态筛选 (new/contacted/qualified/proposal/negotiation/won/lost/returned)
  - `customerId`: 客户ID
  - `ownerId`: 负责人ID
- **响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "customerId": 1,
      "name": "项目A",
      "amount": 100000.00,
      "status": "new",
      "ownerId": 1,
      "probability": 30,
      "expectedCloseDate": "2024-12-31T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

#### 3.2 获取单个商机
- **接口**: `GET /api/opportunities/:id`
- **说明**: 获取商机详情
- **认证**: 需要

#### 3.3 创建商机
- **接口**: `POST /api/opportunities`
- **说明**: 创建新商机
- **认证**: 需要
- **请求参数**:
```json
{
  "customerId": "number (必填)",
  "name": "string (必填)",
  "amount": "number (必填)",
  "status": "string (可选, 默认: new)",
  "ownerId": "number (必填)",
  "probability": "number (可选, 0-100, 默认: 0)",
  "expectedCloseDate": "string (可选, ISO日期格式)",
  "description": "string (可选)",
  "source": "string (可选)",
  "products": "array (可选)"
}
```

#### 3.4 更新商机
- **接口**: `PUT /api/opportunities/:id`
- **说明**: 更新商机信息
- **认证**: 需要

#### 3.5 删除商机
- **接口**: `DELETE /api/opportunities/:id`
- **说明**: 删除商机
- **认证**: 需要

#### 3.6 转移商机
- **接口**: `POST /api/opportunities/:id/transfer`
- **说明**: 转移商机给其他销售
- **认证**: 需要
- **请求参数**:
```json
{
  "toOwnerId": "number (必填)",
  "reason": "string (可选)"
}
```

#### 3.7 更新商机状态
- **接口**: `POST /api/opportunities/:id/status`
- **说明**: 更新商机状态
- **认证**: 需要
- **请求参数**:
```json
{
  "status": "string (必填: new/contacted/qualified/proposal/negotiation/won/lost/returned)"
}
```

#### 3.8 获取销售漏斗
- **接口**: `GET /api/opportunities/funnel`
- **说明**: 获取销售漏斗统计数据
- **认证**: 需要

#### 3.9 检查自动转移
- **接口**: `POST /api/opportunities/check-auto-transfer`
- **说明**: 检查并执行自动转移规则
- **认证**: 需要

---

### 4. 合同管理 (`/api/contracts`)

#### 4.1 获取合同列表
- **接口**: `GET /api/contracts`
- **说明**: 获取合同列表
- **认证**: 需要
- **查询参数**:
  - `page`: 页码
  - `limit`: 每页数量
  - `status`: 状态筛选 (draft/pending/approved/signed/executing/completed/terminated)
  - `customerId`: 客户ID

#### 4.2 获取单个合同
- **接口**: `GET /api/contracts/:id`
- **说明**: 获取合同详情
- **认证**: 需要

#### 4.3 创建合同
- **接口**: `POST /api/contracts`
- **说明**: 创建新合同
- **认证**: 需要
- **请求参数**:
```json
{
  "opportunityId": "number (可选)",
  "customerId": "number (必填)",
  "contractNumber": "string (必填, 唯一)",
  "title": "string (必填)",
  "amount": "number (必填)",
  "status": "string (可选, 默认: draft)",
  "ownerId": "number (必填)",
  "signDate": "string (可选, ISO日期格式)",
  "startDate": "string (可选, ISO日期格式)",
  "endDate": "string (可选, ISO日期格式)",
  "content": "string (可选)",
  "paymentPlan": "array (可选)"
}
```

#### 4.4 更新合同
- **接口**: `PUT /api/contracts/:id`
- **说明**: 更新合同信息
- **认证**: 需要

#### 4.5 删除合同
- **接口**: `DELETE /api/contracts/:id`
- **说明**: 删除合同
- **认证**: 需要

#### 4.6 审批合同
- **接口**: `POST /api/contracts/:id/approve`
- **说明**: 审批合同（需要管理员或销售经理权限）
- **认证**: 需要
- **权限**: admin, sales_manager
- **请求参数**:
```json
{
  "action": "string (必填: approve/reject)",
  "comment": "string (可选)"
}
```

#### 4.7 签署合同
- **接口**: `POST /api/contracts/:id/sign`
- **说明**: 标记合同已签署
- **认证**: 需要

#### 4.8 获取合同统计
- **接口**: `GET /api/contracts/stats`
- **说明**: 获取合同统计数据
- **认证**: 需要

---

### 5. 市场管理 (`/api/marketing`)

#### 5.1 获取线索列表
- **接口**: `GET /api/marketing/leads`
- **说明**: 获取线索列表
- **认证**: 需要
- **查询参数**:
  - `page`: 页码
  - `limit`: 每页数量
  - `status`: 状态筛选 (new/contacted/qualified/converted/lost)
  - `source`: 来源筛选

#### 5.2 获取单个线索
- **接口**: `GET /api/marketing/leads/:id`
- **说明**: 获取线索详情
- **认证**: 需要

#### 5.3 创建线索
- **接口**: `POST /api/marketing/leads`
- **说明**: 创建新线索
- **认证**: 需要
- **请求参数**:
```json
{
  "name": "string (必填)",
  "company": "string (可选)",
  "phone": "string (可选)",
  "email": "string (可选)",
  "source": "string (必填)",
  "status": "string (可选, 默认: new)",
  "quality": "number (可选, 0-100, 默认: 50)",
  "description": "string (可选)",
  "ownerId": "number (可选)"
}
```

#### 5.4 更新线索
- **接口**: `PUT /api/marketing/leads/:id`
- **说明**: 更新线索信息
- **认证**: 需要

#### 5.5 删除线索
- **接口**: `DELETE /api/marketing/leads/:id`
- **说明**: 删除线索
- **认证**: 需要

#### 5.6 转化线索
- **接口**: `POST /api/marketing/leads/:id/convert`
- **说明**: 将线索转化为客户或商机
- **认证**: 需要
- **请求参数**:
```json
{
  "convertTo": "string (必填: customer/opportunity)",
  "customerData": "object (可选, 转化为客户时的数据)",
  "opportunityData": "object (可选, 转化为商机时的数据)"
}
```

#### 5.7 获取市场活动列表
- **接口**: `GET /api/marketing/campaigns`
- **说明**: 获取市场活动列表
- **认证**: 需要

#### 5.8 获取单个市场活动
- **接口**: `GET /api/marketing/campaigns/:id`
- **说明**: 获取市场活动详情
- **认证**: 需要

#### 5.9 创建市场活动
- **接口**: `POST /api/marketing/campaigns`
- **说明**: 创建新市场活动
- **认证**: 需要
- **请求参数**:
```json
{
  "name": "string (必填)",
  "type": "string (可选: email/sms/event/online/other, 默认: other)",
  "status": "string (可选: planned/executing/completed/cancelled, 默认: planned)",
  "startDate": "string (必填, ISO日期格式)",
  "endDate": "string (必填, ISO日期格式)",
  "budget": "number (可选, 默认: 0)",
  "targetAudience": "string (可选)",
  "description": "string (可选)"
}
```

#### 5.10 更新市场活动
- **接口**: `PUT /api/marketing/campaigns/:id`
- **说明**: 更新市场活动信息
- **认证**: 需要

#### 5.11 删除市场活动
- **接口**: `DELETE /api/marketing/campaigns/:id`
- **说明**: 删除市场活动
- **认证**: 需要

#### 5.12 获取活动统计
- **接口**: `GET /api/marketing/campaigns/:id/stats`
- **说明**: 获取市场活动统计数据
- **认证**: 需要

---

### 6. 服务管理 (`/api/service`)

#### 6.1 获取工单列表
- **接口**: `GET /api/service`
- **说明**: 获取工单列表
- **认证**: 需要
- **查询参数**:
  - `page`: 页码
  - `limit`: 每页数量
  - `status`: 状态筛选 (new/assigned/in_progress/resolved/closed)
  - `category`: 分类筛选 (consultation/complaint/technical/billing/other)
  - `priority`: 优先级筛选 (low/medium/high/urgent)
  - `customerId`: 客户ID

#### 6.2 获取单个工单
- **接口**: `GET /api/service/:id`
- **说明**: 获取工单详情
- **认证**: 需要

#### 6.3 创建工单
- **接口**: `POST /api/service`
- **说明**: 创建新工单
- **认证**: 需要
- **请求参数**:
```json
{
  "ticketNumber": "string (必填, 唯一)",
  "customerId": "number (必填)",
  "title": "string (必填)",
  "category": "string (可选: consultation/complaint/technical/billing/other, 默认: other)",
  "priority": "string (可选: low/medium/high/urgent, 默认: medium)",
  "status": "string (可选: new/assigned/in_progress/resolved/closed, 默认: new)",
  "description": "string (必填)",
  "ownerId": "number (可选)"
}
```

#### 6.4 更新工单
- **接口**: `PUT /api/service/:id`
- **说明**: 更新工单信息
- **认证**: 需要

#### 6.5 删除工单
- **接口**: `DELETE /api/service/:id`
- **说明**: 删除工单
- **认证**: 需要

#### 6.6 分配工单
- **接口**: `POST /api/service/:id/assign`
- **说明**: 分配工单给服务人员
- **认证**: 需要
- **请求参数**:
```json
{
  "ownerId": "number (必填)"
}
```

#### 6.7 解决工单
- **接口**: `POST /api/service/:id/resolve`
- **说明**: 标记工单已解决
- **认证**: 需要
- **请求参数**:
```json
{
  "solution": "string (必填)"
}
```

#### 6.8 评价工单
- **接口**: `POST /api/service/:id/rate`
- **说明**: 对工单服务进行评价
- **认证**: 需要
- **请求参数**:
```json
{
  "rating": "number (必填, 1-5)",
  "comment": "string (可选)"
}
```

#### 6.9 获取服务统计
- **接口**: `GET /api/service/stats`
- **说明**: 获取服务统计数据
- **认证**: 需要

---

### 7. 销售管理 (`/api/sales`)

#### 7.1 获取销售团队
- **接口**: `GET /api/sales/team`
- **说明**: 获取销售团队列表
- **认证**: 需要

#### 7.2 获取单个销售
- **接口**: `GET /api/sales/:id`
- **说明**: 获取销售人员详情
- **认证**: 需要

#### 7.3 创建销售人员
- **接口**: `POST /api/sales/person`
- **说明**: 创建新销售人员（需要管理员或销售经理权限）
- **认证**: 需要
- **权限**: admin, sales_manager

#### 7.4 更新销售人员
- **接口**: `PUT /api/sales/:id`
- **说明**: 更新销售人员信息（需要管理员或销售经理权限）
- **认证**: 需要
- **权限**: admin, sales_manager

#### 7.5 删除销售人员
- **接口**: `DELETE /api/sales/:id`
- **说明**: 删除销售人员（需要管理员权限）
- **认证**: 需要
- **权限**: admin

#### 7.6 获取销售业绩
- **接口**: `GET /api/sales/performance`
- **说明**: 获取销售业绩统计
- **认证**: 需要
- **查询参数**:
  - `startDate`: 开始日期
  - `endDate`: 结束日期
  - `salesId`: 销售人员ID

#### 7.7 获取销售活动
- **接口**: `GET /api/sales/activities`
- **说明**: 获取销售活动列表
- **认证**: 需要

#### 7.8 创建活动
- **接口**: `POST /api/sales/activities`
- **说明**: 创建销售活动
- **认证**: 需要
- **请求参数**:
```json
{
  "type": "string (必填: call/email/meeting/visit/task/note)",
  "customerId": "number (可选)",
  "opportunityId": "number (可选)",
  "title": "string (必填)",
  "description": "string (可选)",
  "startTime": "string (可选, ISO日期格式)",
  "endTime": "string (可选, ISO日期格式)",
  "location": "string (可选)",
  "status": "string (可选: planned/completed/cancelled, 默认: planned)"
}
```

#### 7.9 更新活动
- **接口**: `PUT /api/sales/activities/:id`
- **说明**: 更新销售活动
- **认证**: 需要

#### 7.10 获取销售任务
- **接口**: `GET /api/sales/tasks`
- **说明**: 获取销售任务列表
- **认证**: 需要

#### 7.11 获取销售排名
- **接口**: `GET /api/sales/ranking`
- **说明**: 获取销售排名
- **认证**: 需要

---

### 8. 数据分析 (`/api/analytics`)

#### 8.1 获取销售分析
- **接口**: `GET /api/analytics/sales`
- **说明**: 获取销售数据分析
- **认证**: 需要
- **查询参数**:
  - `startDate`: 开始日期
  - `endDate`: 结束日期
  - `groupBy`: 分组方式 (day/week/month)

#### 8.2 获取客户分析
- **接口**: `GET /api/analytics/customers`
- **说明**: 获取客户数据分析
- **认证**: 需要

#### 8.3 获取商机分析
- **接口**: `GET /api/analytics/opportunities`
- **说明**: 获取商机数据分析
- **认证**: 需要

#### 8.4 获取合同分析
- **接口**: `GET /api/analytics/contracts`
- **说明**: 获取合同数据分析
- **认证**: 需要

#### 8.5 自定义报表
- **接口**: `POST /api/analytics/custom`
- **说明**: 生成自定义报表
- **认证**: 需要
- **请求参数**:
```json
{
  "type": "string (必填)",
  "filters": "object (可选)",
  "groupBy": "array (可选)",
  "metrics": "array (可选)"
}
```

#### 8.6 导出报表
- **接口**: `POST /api/analytics/export`
- **说明**: 导出报表数据
- **认证**: 需要
- **请求参数**:
```json
{
  "format": "string (必填: excel/csv/pdf)",
  "reportType": "string (必填)",
  "filters": "object (可选)"
}
```

---

### 9. 系统管理 (`/api/system`)

#### 9.1 获取角色列表
- **接口**: `GET /api/system/roles`
- **说明**: 获取角色列表（需要管理员权限）
- **认证**: 需要
- **权限**: admin

#### 9.2 创建角色
- **接口**: `POST /api/system/roles`
- **说明**: 创建新角色（需要管理员权限）
- **认证**: 需要
- **权限**: admin
- **请求参数**:
```json
{
  "name": "string (必填, 唯一)",
  "description": "string (可选)",
  "permissions": "array (可选)",
  "dataScope": "string (可选: all/department/self, 默认: self)"
}
```

#### 9.3 更新角色
- **接口**: `PUT /api/system/roles/:id`
- **说明**: 更新角色信息（需要管理员权限）
- **认证**: 需要
- **权限**: admin

#### 9.4 删除角色
- **接口**: `DELETE /api/system/roles/:id`
- **说明**: 删除角色（需要管理员权限）
- **认证**: 需要
- **权限**: admin

#### 9.5 获取用户列表
- **接口**: `GET /api/system/users`
- **说明**: 获取用户列表（需要管理员或销售经理权限）
- **认证**: 需要
- **权限**: admin, sales_manager

#### 9.6 更新用户角色
- **接口**: `PUT /api/system/users/:id/role`
- **说明**: 更新用户角色（需要管理员权限）
- **认证**: 需要
- **权限**: admin
- **请求参数**:
```json
{
  "role": "string (必填)"
}
```

#### 9.7 获取系统配置
- **接口**: `GET /api/system/config`
- **说明**: 获取系统配置（需要管理员权限）
- **认证**: 需要
- **权限**: admin

#### 9.8 更新系统配置
- **接口**: `PUT /api/system/config`
- **说明**: 更新系统配置（需要管理员权限）
- **认证**: 需要
- **权限**: admin

#### 9.9 获取流转规则列表
- **接口**: `GET /api/system/transfer-rules`
- **说明**: 获取流转规则列表（需要管理员或销售经理权限）
- **认证**: 需要
- **权限**: admin, sales_manager

#### 9.10 创建流转规则
- **接口**: `POST /api/system/transfer-rules`
- **说明**: 创建流转规则（需要管理员或销售经理权限）
- **认证**: 需要
- **权限**: admin, sales_manager
- **请求参数**:
```json
{
  "name": "string (必填)",
  "fromStatus": "string (必填)",
  "toStatus": "string (必填)",
  "conditions": "object (可选)",
  "autoTransfer": "boolean (可选, 默认: false)",
  "returnToPublic": "boolean (可选, 默认: false)",
  "daysThreshold": "number (可选)"
}
```

#### 9.11 更新流转规则
- **接口**: `PUT /api/system/transfer-rules/:id`
- **说明**: 更新流转规则（需要管理员或销售经理权限）
- **认证**: 需要
- **权限**: admin, sales_manager

#### 9.12 删除流转规则
- **接口**: `DELETE /api/system/transfer-rules/:id`
- **说明**: 删除流转规则（需要管理员权限）
- **认证**: 需要
- **权限**: admin

---

## 状态码说明

- `200`: 请求成功
- `201`: 创建成功
- `400`: 请求参数错误
- `401`: 未认证或认证失败
- `403`: 权限不足
- `404`: 资源不存在
- `500`: 服务器内部错误

## 用户角色说明

- **admin**: 管理员，拥有所有权限
- **sales_manager**: 销售经理，可以管理销售团队和数据
- **sales**: 销售人员，只能访问自己的数据
- **service**: 服务人员，处理客户服务工单
- **marketing**: 市场人员，管理线索和市场活动

## 数据权限说明

- **管理员和销售经理**: 可以访问所有数据
- **普通销售**: 只能访问自己负责的数据和公海数据
- **服务人员**: 只能访问分配给自己的工单

## 注意事项

1. 所有日期时间字段使用 ISO 8601 格式 (例如: `2024-01-01T00:00:00.000Z`)
2. 金额字段使用数字类型，单位为元
3. 分页参数 `page` 从 1 开始
4. 删除操作需要谨慎，某些数据可能有关联关系
5. 文件上传接口可能需要使用 `multipart/form-data` 格式

## 健康检查

- **接口**: `GET /health`
- **说明**: 检查服务器运行状态
- **响应示例**:
```json
{
  "status": "ok",
  "message": "CRM系统运行正常"
}
```

---

## 示例代码

### JavaScript (Fetch API)
```javascript
// 登录
const login = async (email, password) => {
  const response = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('token', data.data.token);
  }
  return data;
};

// 获取客户列表
const getCustomers = async (page = 1, limit = 20) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`http://localhost:3000/api/customers?page=${page}&limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return await response.json();
};
```

### cURL
```bash
# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# 获取客户列表
curl -X GET http://localhost:3000/api/customers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**文档版本**: 1.0  
**最后更新**: 2024年

