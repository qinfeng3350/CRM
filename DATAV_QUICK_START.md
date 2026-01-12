# DataV 数据大屏快速启动指南

## 🚀 1. 安装依赖

```bash
# 方法 1: 使用管理工具（推荐）
node scripts/manage-datav.js install

# 方法 2: 手动安装
cd client
npm install @jiaminghi/data-view echarts echarts-for-react
```

## 📊 2. 启动服务

```bash
# 启动后端 API 服务
npm start

# 或在另一个终端启动前端开发服务
cd client
npm run dev
```

## 🔗 3. 访问数据大屏

### 本地访问
```
http://localhost:3000/projects/dashboard
```

### 生产环境
```
https://crm.yunshangdingchuang.cn/projects/dashboard
```

## 📋 4. 主要功能

### 实时数据更新
- ✅ 自动每 10 秒刷新一次
- ✅ 手动刷新按钮
- ✅ 后台静默刷新（无 loading 提示）

### 可视化图表
- 📊 **项目状态分布** (饼图) - 规划中、进行中、已完成等
- 📈 **进度分布** (柱状图) - 0-20%、20-40% 等范围分布
- 🎯 **优先级统计** (雷达图) - 低、中、高、紧急优先级

### 数据卡片
- 项目总数
- 进行中项目数
- 已完成项目数
- 平均进度
- 签约总额
- 最后更新时间

### 数据表格
- **待办项目** - 显示未完成的项目
- **最近项目** - 显示最近更新的项目

## 🎨 5. 全屏展示

```
1. 点击右上角 [全屏] 按钮
2. 按 ESC 键退出全屏
3. 或刷新页面返回
```

## 📲 6. 响应式支持

数据大屏自动适配所有设备：
- 📱 手机 (< 576px)
- 📱 平板 (576px - 992px)
- 💻 桌面 (> 992px)

## 🔧 7. 自定义配置

### 修改刷新频率

编辑 `client/src/pages/Projects/DataVDashboard.jsx`:

```jsx
// 第 43 行左右
setInterval(() => {
  loadDashboardData(false);
}, 10000);  // 修改这里，单位毫秒
```

### 修改图表颜色

编辑 `DataVDashboard.jsx` 中的 `color` 数组：

```jsx
const color = ['#667eea', '#764ba2', '#f093fb', '#4facfe'];
```

### 修改样式主题

编辑 `DataVDashboard.css` 中的渐变色和阴影。

## 📚 8. DataV 高级功能

如需使用 DataV 特殊组件（流光边框、数字滚动等）：

```jsx
import { BorderBox, NumberScroll } from '@jiaminghi/data-view';

// 流光边框
<BorderBox><div>内容</div></BorderBox>

// 数字滚动
<NumberScroll to={12345} dur={3} />
```

详见 `DATA_VISUALIZATION_GUIDE.md`。

## ✅ 9. 验证安装

```bash
# 检查 DataV 集成状态
node scripts/manage-datav.js verify

# 查看详细信息
node scripts/manage-datav.js status
```

## 🐛 10. 故障排除

### Q: 数据不显示？
A: 检查后端服务是否运行 (`npm start`)

### Q: 图表显示错误？
A: 清除浏览器缓存，重新刷新页面

### Q: 页面加载很慢？
A: 检查网络连接，减少刷新频率

### Q: 能否在手机上查看？
A: 可以，响应式设计支持所有设备

## 📞 11. 联系支持

如有问题，请查看：
- `DATA_VISUALIZATION_GUIDE.md` - 完整指南
- `CLEANUP_REPORT.md` - 项目清理报告
- API 文档: `/api/projects/dashboard/stats`

---

## 🎯 下一步

- [ ] 安装依赖: `node scripts/manage-datav.js install`
- [ ] 验证集成: `node scripts/manage-datav.js verify`
- [ ] 启动服务: `npm start` 
- [ ] 访问大屏: `http://localhost:3000/projects/dashboard`
- [ ] 测试全屏: 点击全屏按钮

---

**更新日期**: 2025-12-29  
**支持版本**: Node.js 14.0+  
**浏览器支持**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
