# 大屏系统前端集成指南

## 📋 集成步骤

### 1. 添加路由配置

编辑您的前端路由文件（通常是 `client/src/App.jsx` 或 `client/src/routes/index.js`）：

```jsx
import DashboardManager from '@/pages/Dashboard/DashboardManager';
import DynamicDashboard from '@/pages/Dashboard/DynamicDashboard';

// 在路由数组或 React Router 中添加
<Route path="/admin/dashboards" element={<DashboardManager />} />
<Route path="/dashboard/:id" element={<DynamicDashboard />} />
```

### 2. 更新导航菜单

在您的导航菜单配置中添加：

```javascript
// 例如在 client/src/config/menu.js
{
  key: 'dashboard',
  icon: 'dashboard',
  label: '数据大屏',
  children: [
    {
      key: 'dashboard-manager',
      label: '大屏管理',
      path: '/admin/dashboards'
    },
    {
      key: 'dashboard-view',
      label: '项目大屏',
      path: '/dashboard/1' // 替换为默认大屏 ID
    }
  ]
}
```

### 3. 验证后端路由

确保 `server.js` 中已添加：

```javascript
app.use('/api/dashboards', require('./routes/dashboards'));
```

✅ 已在 `server.js` 第 72 行添加

### 4. 启动服务测试

```bash
npm start
```

启动时应该看到：
```
✅ 数据大屏表初始化成功
```

### 5. 访问大屏管理

```
http://localhost:3000/admin/dashboards
```

---

## 🎨 UI 定制建议

### 自定义样式

如需修改大屏的样式主题，编辑以下文件：

#### DashboardManager.css
```css
/* 修改主题色 */
.dashboard-manager-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* 修改按钮颜色 */
.ant-btn-primary {
  background-color: #1890ff;
}
```

#### DynamicDashboard.css
```css
/* 修改大屏背景 */
.dynamic-dashboard {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* 修改图表样式 */
.chart-item {
  background: white;
  border-radius: 8px;
}
```

### 自定义图表颜色

编辑 `DynamicDashboard.jsx`：

```javascript
// 在 renderChart 函数中修改颜色
const chartOptions = {
  pie: {
    color: ['#667eea', '#764ba2', '#f093fb', '#4facfe'],
    // ...
  }
};
```

---

## 🔗 API 集成验证

### 测试大屏管理 API

```bash
# 获取所有大屏
curl http://localhost:3000/api/dashboards

# 获取数据源列表
curl http://localhost:3000/api/dashboards/config/dataSources

# 获取图表类型列表
curl http://localhost:3000/api/dashboards/config/chartTypes

# 创建大屏
curl -X POST http://localhost:3000/api/dashboards \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试大屏",
    "dataSource": "projects",
    "chartType": "pie,bar",
    "refreshInterval": 10000
  }'
```

### 测试动态大屏显示

访问 `http://localhost:3000/dashboard/1`（假设大屏 ID 为 1）

---

## 🐛 故障排除

### 问题 1: 404 - /api/dashboards not found

**解决方案**:
- 检查 `server.js` 是否已添加路由
- 重启 Node.js 服务器
- 检查路由拼写是否正确

### 问题 2: 大屏不显示数据

**解决方案**:
1. 检查数据源 API 是否运行正常
2. 查看浏览器控制台是否有错误
3. 检查数据源是否返回正确的数据结构

### 问题 3: 大屏页面 404

**解决方案**:
- 检查路由是否正确配置
- 确保 `DynamicDashboard.jsx` 在正确的路径
- 确保路由参数 `id` 正确传递

### 问题 4: 样式加载失败

**解决方案**:
- 检查 CSS 文件路径是否正确
- 确保 CSS 文件存在
- 清除浏览器缓存，刷新页面

---

## 📱 响应式测试

使用浏览器开发者工具测试不同屏幕尺寸：

```
小屏幕 (< 576px)    - 单列布局
平板 (576-992px)    - 2 列布局
桌面 (> 992px)      - 3-4 列布局
```

---

## 🔐 权限配置

如需添加权限控制，编辑 `controllers/dashboardController.js`：

```javascript
// 在创建大屏时检查权限
exports.create = async (req, res) => {
  // 检查用户权限
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      code: 403,
      message: '您没有权限创建大屏'
    });
  }
  
  // 继续创建...
};
```

---

## 💾 环境变量配置

如需在不同环境中使用不同的配置，可在 `.env` 文件中添加：

```env
# 大屏配置
DASHBOARD_REFRESH_INTERVAL=10000
DASHBOARD_MAX_CHARTS=8
DASHBOARD_DATA_SOURCE=projects
```

然后在代码中使用：

```javascript
const refreshInterval = process.env.DASHBOARD_REFRESH_INTERVAL || 10000;
```

---

## 📊 生产部署清单

### 前端部署
- [ ] 路由配置已添加
- [ ] 导航菜单已更新
- [ ] 样式已集成
- [ ] CSS 路径正确
- [ ] 资源已优化
- [ ] 构建成功

### 后端部署
- [ ] API 路由已注册
- [ ] 数据库表已创建
- [ ] 权限检查已配置
- [ ] 错误处理已实现
- [ ] 日志已配置

### 测试验证
- [ ] 创建大屏功能正常
- [ ] 编辑大屏功能正常
- [ ] 删除大屏功能正常
- [ ] 查看大屏显示正常
- [ ] 数据实时更新
- [ ] 响应式设计有效
- [ ] 全屏功能正常
- [ ] 错误处理正确

### 性能检查
- [ ] API 响应时间 < 1s
- [ ] 大屏加载时间 < 2s
- [ ] 图表渲染时间 < 500ms
- [ ] 内存占用合理
- [ ] 支持并发请求

---

## 🚀 性能优化建议

### 1. 图表优化
```javascript
// 使用 canvas 渲染而不是 SVG
opts={{ renderer: 'canvas' }}

// 合理设置图表更新频率
refreshInterval: 10000 // 最小 5 秒
```

### 2. 数据优化
```javascript
// 限制返回的数据量
SELECT * FROM projects LIMIT 100;

// 使用数据缓存
const cache = new Map();
```

### 3. 加载优化
```javascript
// 延迟加载图表
React.lazy(() => import('@/pages/Dashboard/DynamicDashboard'))

// 预加载关键资源
<link rel="prefetch" href="/api/dashboards" />
```

---

## 📚 相关文档

- 📖 [DASHBOARD_CONFIG_GUIDE.md](DASHBOARD_CONFIG_GUIDE.md) - 完整使用指南
- 📖 [DASHBOARD_SYSTEM_SUMMARY.md](DASHBOARD_SYSTEM_SUMMARY.md) - 项目总结
- 📖 [API 文档](DASHBOARD_CONFIG_GUIDE.md#api-端点) - API 接口文档

---

## 💡 下一步

1. **立即**
   - [ ] 集成前端路由
   - [ ] 更新导航菜单
   - [ ] 启动并测试

2. **本周**
   - [ ] 完成功能测试
   - [ ] 修复发现的问题
   - [ ] 优化性能

3. **下周**
   - [ ] 上线生产环境
   - [ ] 收集用户反馈
   - [ ] 持续改进

---

**集成指南更新日期**: 2025-12-29  
**当前版本**: v2.0.0  
**维护者**: MofengCRM Team
