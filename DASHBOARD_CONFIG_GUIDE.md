# 数据大屏配置系统 - 完整指南

## 📋 概述

新的**数据大屏配置系统**允许用户通过可视化界面创建、编辑和管理自定义数据大屏。用户可以：

- ✅ 新建数据大屏
- ✅ 选择数据源（项目、销售、库存等）
- ✅ 选择图表类型（饼图、柱图、折线图等）
- ✅ 配置刷新频率
- ✅ 实时预览和编辑
- ✅ 复制和删除大屏

---

## 🚀 快速开始

### 1. 访问大屏管理界面

```
http://localhost:3000/admin/dashboards
```

或点击导航菜单中的 "数据大屏"

### 2. 新建大屏

点击 **"新建大屏"** 按钮，填写以下信息：

#### 基本信息
- **大屏名称**: e.g. "项目管理大屏"
- **描述**: 大屏的功能说明
- **图标**: 可选，用于导航显示

#### 数据配置
- **数据源**: 选择数据来源
  - 📊 项目管理
  - 📈 销售数据
  - 📦 库存管理
  - ⚙️ 自定义数据

#### 图表配置
- **图表类型**: 选择要展示的图表（支持多选）
  - 📊 饼图 (Pie) - 用于展示分布比例
  - 📈 柱状图 (Bar) - 用于对比数值
  - 📉 折线图 (Line) - 用于展示趋势
  - 🎯 雷达图 (Radar) - 用于多维度分析
  - 📌 散点图 (Scatter) - 用于相关性分析
  - 🎚️ 仪表盘 (Gauge) - 用于进度显示
  - 📋 数据表格 (Table) - 用于详细数据
  - 📇 统计卡片 (Card) - 用于关键指标

#### 刷新设置
- **刷新频率**: 输入秒数（1-300 秒）
  - 推荐值：10 秒（平衡实时性和性能）

### 3. 查看和编辑大屏

在大屏列表中：
- 👁️ **查看**: 点击眼睛图标预览大屏
- ✏️ **编辑**: 点击编辑图标修改配置
- 📋 **复制**: 点击复制图标基于现有大屏创建新版本
- 🗑️ **删除**: 点击删除图标（确认后删除）

---

## 📊 数据源详解

### 项目管理 (projects)

**数据字段:**
```javascript
{
  totalProjects: 45,              // 项目总数
  statusStats: {                  // 项目状态分布
    planning: 10,
    inProgress: 15,
    completed: 12,
    onHold: 5,
    cancelled: 3
  },
  progressDistribution: [         // 进度分布
    { range: "0-20%", count: 5 },
    // ...
  ],
  priorityStats: {                // 优先级统计
    low: 5,
    medium: 20,
    high: 15,
    critical: 5
  },
  avgProgress: 62.5,              // 平均进度
  totalSignedAmount: 1500000      // 签约总额
}
```

**推荐图表:**
- 饼图：显示项目状态分布
- 柱图：显示进度分布
- 雷达图：多维度优先级分析

### 销售数据 (sales)

**数据字段:**
```javascript
{
  totalSales: 5000000,            // 总销售额
  orderCount: 150,                // 订单数
  customerCount: 89,              // 客户数
  // 更多字段...
}
```

**推荐图表:**
- 统计卡片：显示关键指标
- 折线图：销售趋势分析
- 柱图：销售对比

### 库存管理 (inventory)

**数据字段:**
```javascript
{
  totalQuantity: 50000,           // 库存总量
  categoryStats: {},              // 分类统计
  lowStockItems: []               // 低库存项目
}
```

**推荐图表:**
- 柱图：库存分类统计
- 仪表盘：库存使用率
- 数据表格：低库存预警

---

## 🎨 图表类型详解

### 1. 饼图 (Pie)
- **用途**: 展示部分与整体的比例关系
- **适用场景**: 项目状态分布、优先级分布
- **数据格式**: 对象 `{key: value}`

### 2. 柱状图 (Bar)
- **用途**: 对比不同分类的数值大小
- **适用场景**: 进度分布、销售对比
- **数据格式**: 数组 `[value1, value2, ...]`

### 3. 折线图 (Line)
- **用途**: 展示数据变化趋势
- **适用场景**: 销售趋势、增长曲线
- **数据格式**: 数组 `[value1, value2, ...]`

### 4. 雷达图 (Radar)
- **用途**: 多维度对比分析
- **适用场景**: 优先级统计、性能评估
- **数据格式**: 对象 `{dimension: value}`

### 5. 散点图 (Scatter)
- **用途**: 显示两个变量的相关性
- **适用场景**: 客户分析、产品分析
- **数据格式**: 二维数组 `[[x1, y1], [x2, y2], ...]`

### 6. 仪表盘 (Gauge)
- **用途**: 显示进度和百分比
- **适用场景**: 进度展示、完成率
- **数据格式**: 单个数值 `0-100`

### 7. 数据表格 (Table)
- **用途**: 展示详细的结构化数据
- **适用场景**: 项目列表、订单详情
- **数据格式**: 对象数组 `[{col1: val1, ...}, ...]`

### 8. 统计卡片 (Card)
- **用途**: 突出显示关键指标
- **适用场景**: 汇总数据、KPI 展示
- **数据格式**: 单个数值或对象

---

## ⚙️ API 接口

### 大屏管理 API

#### 获取所有大屏
```http
GET /api/dashboards
```

**响应:**
```json
{
  "code": 200,
  "message": "获取大屏列表成功",
  "data": [
    {
      "id": 1,
      "name": "项目管理大屏",
      "description": "...",
      "dataSource": "projects",
      "chartType": "pie,bar,radar",
      "refreshInterval": 10000,
      "isActive": 1,
      "createdAt": "2025-12-29 10:00:00"
    }
  ]
}
```

#### 新建大屏
```http
POST /api/dashboards
Content-Type: application/json

{
  "name": "新大屏名称",
  "description": "描述",
  "dataSource": "projects",
  "chartType": "pie,bar,radar",
  "refreshInterval": 10000,
  "icon": "project"
}
```

#### 更新大屏
```http
PUT /api/dashboards/{id}
Content-Type: application/json

{
  "name": "更新后的名称",
  ...其他字段
}
```

#### 删除大屏
```http
DELETE /api/dashboards/{id}
```

#### 获取数据源列表
```http
GET /api/dashboards/config/dataSources
```

#### 获取图表类型列表
```http
GET /api/dashboards/config/chartTypes
```

---

## 📱 前端路由

### 大屏管理页面
```
/admin/dashboards
```
- 查看和管理所有大屏
- 新建/编辑/删除大屏

### 大屏显示页面
```
/dashboard/{id}
```
- 显示指定 ID 的大屏
- 实时数据更新
- 全屏展示模式

### 项目大屏 (默认)
```
/projects/dashboard
```
- 快速访问项目管理大屏

---

## 🔧 高级配置

### 自定义数据源

如果需要添加新的数据源：

1. **后端**: 在 `dashboardController.js` 的 `getDataSources()` 中添加新数据源

```javascript
{
  key: 'custom',
  name: '自定义数据',
  description: '描述',
  icon: 'setting',
  fields: [
    { key: 'field1', label: '字段1', type: 'number' },
    // ...
  ]
}
```

2. **API**: 在 `DynamicDashboard.jsx` 中添加对应的 API 端点处理

```javascript
case 'custom':
  dataUrl = '/api/custom/stats';
  break;
```

### 自定义图表样式

编辑 `DynamicDashboard.jsx` 中的 `chartOptions` 对象，修改 ECharts 配置：

```javascript
const chartOptions = {
  pie: {
    title: { text: '自定义标题' },
    // 修改其他配置...
  }
};
```

---

## 💡 最佳实践

### 1. 命名规范
- 大屏名称简洁明了，便于识别
- 使用有意义的描述说明用途

### 2. 数据源选择
- 匹配业务需求
- 选择合适的刷新频率

### 3. 图表选择
- 根据数据特性选择合适的图表
- 不要过多（建议 3-5 个）
- 避免在一个大屏中混合过多数据源

### 4. 性能优化
- 刷新频率不要过快（最小 5 秒）
- 图表数量不要过多（推荐 ≤ 8 个）
- 使用生产优化的 ECharts 配置

### 5. 用户体验
- 提供全屏展示选项
- 显示最后更新时间
- 添加刷新按钮
- 提供错误处理和提示

---

## 🐛 常见问题

### Q: 大屏不显示数据？
A: 
1. 检查数据源是否有效
2. 检查后端 API 是否正常工作
3. 查看浏览器控制台是否有错误

### Q: 如何改变图表显示时间？
A: 在大屏编辑页面修改"刷新频率"字段

### Q: 能否自定义数据源？
A: 可以，需要：
1. 在后端添加新的数据源定义
2. 实现对应的 API 接口
3. 在前端添加图表处理逻辑

### Q: 大屏可以跨越多个数据源吗？
A: 当前不支持，但可以通过自定义大屏配置实现

---

## 📈 示例大屏配置

### 示例 1: 项目管理大屏
```json
{
  "name": "项目管理大屏",
  "description": "展示所有项目的状态、进度、优先级",
  "dataSource": "projects",
  "chartType": "pie,bar,radar,table",
  "refreshInterval": 10000
}
```

### 示例 2: 销售数据大屏
```json
{
  "name": "销售数据大屏",
  "description": "实时销售额、订单、客户统计",
  "dataSource": "sales",
  "chartType": "card,line,bar",
  "refreshInterval": 30000
}
```

### 示例 3: 库存警示大屏
```json
{
  "name": "库存警示大屏",
  "description": "库存分布和低库存预警",
  "dataSource": "inventory",
  "chartType": "gauge,table",
  "refreshInterval": 60000
}
```

---

## 🔐 权限控制

目前大屏系统支持：
- 所有登录用户可以查看大屏
- 管理员可以创建/编辑/删除大屏
- 支持按创建人筛选（可在将来实现）

---

## 📊 数据库结构

### dashboards 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| name | VARCHAR(255) | 大屏名称 |
| description | TEXT | 大屏描述 |
| icon | VARCHAR(100) | 图标 |
| config | LONGTEXT | 配置 (JSON) |
| dataSource | VARCHAR(100) | 数据源 |
| chartType | VARCHAR(255) | 图表类型 |
| refreshInterval | INT | 刷新间隔 (ms) |
| isActive | TINYINT | 是否启用 |
| createdBy | INT | 创建人 ID |
| createdAt | TIMESTAMP | 创建时间 |
| updatedAt | TIMESTAMP | 更新时间 |

---

## 🚀 后续功能规划

- [ ] 大屏分享功能
- [ ] 权限细粒度控制
- [ ] 大屏模板库
- [ ] 数据导出功能
- [ ] 大屏统计分析
- [ ] WebSocket 实时数据推送
- [ ] 移动端适配
- [ ] AI 自动配置建议

---

## 📞 技术支持

如有问题，请：
1. 查看浏览器控制台错误
2. 检查后端日志
3. 联系开发团队

---

**更新日期**: 2025-12-29  
**版本**: v2.0.0  
**状态**: ✅ 正式版本
