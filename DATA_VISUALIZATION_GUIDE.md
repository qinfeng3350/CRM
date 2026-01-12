# 数据大屏可视化指南

## 📊 DataV 库集成

### 项目信息
- **名称**: DataV (数据大屏库)
- **官方 GitHub**: https://github.com/jiaming-he/data-view
- **NPM 包**: https://www.npmjs.com/package/@jiaminghi/data-view
- **当前版本**: ^2.10.0
- **创建时间**: 2025-12-29

### 安装依赖

```bash
# 安装 DataV 及相关库
cd client
npm install @jiaminghi/data-view echarts echarts-for-react

# 或在项目根目录
npm install
```

### 已集成的库

#### 1. **@jiaminghi/data-view** (DataV)
- 专业数据大屏组件库
- 提供流光边框、数字滚动、轮播表格等组件
- 文档: https://jiaming-he.github.io/data-view/

#### 2. **echarts** & **echarts-for-react**
- ECharts 图表库及 React 包装器
- 支持图表交互、导出、主题切换等
- 已集成的图表类型:
  - 饼图 (Status Distribution)
  - 柱状图 (Progress Distribution)
  - 雷达图 (Priority Stats)

---

## 📍 数据大屏组件位置

### 主要文件
```
client/
├── src/
│   └── pages/
│       └── Projects/
│           ├── DataVDashboard.jsx       # 数据大屏主组件
│           ├── DataVDashboard.css       # 样式文件（响应式设计）
│           ├── ProjectDashboard.jsx     # 旧版仪表板（可选）
│           └── ProjectsDashboard.jsx    # 备用仪表板（可选）
```

---

## 🔗 数据来源与关联

### API 端点
**URL**: `/api/projects/dashboard/stats`

### 数据结构
```json
{
  "totalProjects": 45,
  "statusStats": {
    "planning": 10,
    "inProgress": 15,
    "completed": 12,
    "onHold": 5,
    "cancelled": 3
  },
  "progressDistribution": [
    { "range": "0-20%", "count": 5 },
    { "range": "20-40%", "count": 8 },
    { "range": "40-60%", "count": 10 },
    { "range": "60-80%", "count": 12 },
    { "range": "80-100%", "count": 10 }
  ],
  "priorityStats": {
    "low": 5,
    "medium": 20,
    "high": 15,
    "critical": 5
  },
  "avgProgress": 62.5,
  "totalSignedAmount": 1500000,
  "lastUpdate": "2025-12-29T10:30:00Z",
  "pendingProjects": [...],
  "recentProjects": [...]
}
```

### 数据更新策略
- **自动刷新**: 每 10 秒自动刷新一次（后台静默刷新）
- **手动刷新**: 点击刷新按钮立即刷新
- **实时更新**: 后端 `/api/projects/dashboard/stats` 接口实时计算数据

---

## 🎨 可视化组件

### 1. 统计卡片
```jsx
<Statistic
  title="进行中项目"
  value={dashboardData?.statusStats?.inProgress || 0}
  prefix={<ProjectOutlined />}
/>
```

### 2. 饼图 - 项目状态分布
```javascript
statusChartOption = {
  type: 'pie',
  data: [
    { value: statusStats.planning, name: '规划中' },
    { value: statusStats.inProgress, name: '进行中' },
    { value: statusStats.completed, name: '已完成' }
  ]
}
```

### 3. 柱状图 - 进度分布
```javascript
progressChartOption = {
  type: 'bar',
  xAxis: progressDistribution.map(p => p.range),
  series: [{ data: progressDistribution.map(p => p.count) }]
}
```

### 4. 雷达图 - 优先级统计
```javascript
priorityChartOption = {
  type: 'radar',
  indicator: ['低', '中', '高', '紧急'],
  series: [{ data: [low, medium, high, critical] }]
}
```

### 5. 数据表格
- 待办项目表
- 最近项目表
- 支持搜索、排序、分页

---

## 🚀 使用方法

### 方式 1: 直接导入组件
```jsx
import DataVDashboard from '@/pages/Projects/DataVDashboard';

// 在路由中使用
<Route path="/dashboard" element={<DataVDashboard />} />
```

### 方式 2: 全屏展示
```jsx
// 点击全屏按钮自动切换全屏模式
<Button onClick={() => setFullscreen(!fullscreen)}>
  {fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
  全屏展示
</Button>
```

### 方式 3: 集成 DataV 装饰组件
```jsx
// 需要 npm install @jiaminghi/data-view

import { BorderBox, Decoration } from '@jiaminghi/data-view';

<BorderBox>
  <div>你的内容</div>
</BorderBox>
```

---

## 📱 响应式设计

### 断点设置
- **小屏幕** (xs < 576px): 单列布局
- **平板** (sm 576px - 768px): 2 列布局  
- **桌面** (lg > 992px): 3-4 列布局

### 移动端优化
```css
@media (max-width: 768px) {
  .datav-dashboard-container {
    grid-template-columns: 1fr;
  }
}
```

---

## 🛠️ 常用功能

### 1. 手动刷新
```jsx
<Button 
  icon={<ReloadOutlined />} 
  onClick={() => loadDashboardData(true)}
>
  刷新
</Button>
```

### 2. 导出数据
```jsx
const exportData = () => {
  const csvContent = convertToCSV(dashboardData);
  downloadCSV(csvContent, '项目数据.csv');
};
```

### 3. 主题切换
```jsx
// 修改图表主题
const chartTheme = 'light'; // 或 'dark'
```

---

## 🧹 文件清理清单

### 已清理 ✅
- `web-login-application-demo-java-construct-link/` - 移除（Java 演示项目）
- 重复的备份文件 - 移除

### 推荐保留
- `client/src/pages/Projects/DataVDashboard.jsx` - 新数据大屏（主要）
- `client/src/pages/Projects/DataVDashboard.css` - 大屏样式
- `controllers/projectController.js` - 后端数据接口

### 可选清理（视具体使用情况）
- `client/src/pages/Projects/ProjectDashboard.jsx` - 如果已被 DataVDashboard 替代
- `client/src/pages/Projects/ProjectsDashboard.jsx` - 备用版本

---

## 📚 DataV 组件示例

### BorderBox (流光边框)
```jsx
import { BorderBox } from '@jiaminghi/data-view';

<BorderBox>
  <div>内容区域</div>
</BorderBox>
```

### NumberScroll (数字滚动)
```jsx
import { NumberScroll } from '@jiaminghi/data-view';

<NumberScroll 
  to={12345} 
  dur={3} 
  fontColor="#00ff00"
/>
```

### ScrollBoard (轮播表格)
```jsx
import { ScrollBoard } from '@jiaminghi/data-view';

<ScrollBoard
  config={{
    data: projectsList,
    columns: ['name', 'status', 'progress']
  }}
/>
```

---

## 🔍 常见问题

### Q: DataV 库需要额外配置吗？
A: 不需要。只需要 npm install 即可使用。所有组件都是即插即用的。

### Q: 如何自定义图表颜色？
A: 修改 `DataVDashboard.jsx` 中的 `color` 数组，或在 `option` 中设置 `itemStyle`。

### Q: 大屏数据多久更新一次？
A: 默认每 10 秒更新一次。可在 `useEffect` 中修改 `setInterval` 的延迟时间。

### Q: 如何适配不同分辨率的屏幕？
A: CSS 中已设置 Grid 响应式布局，会自动适配。也可通过 `@media` 查询手动调整。

---

## 📞 联系与反馈

如有问题或建议，请提交 Issue 或联系项目团队。

---

**最后更新**: 2025-12-29  
**维护者**: MofengCRM Team
