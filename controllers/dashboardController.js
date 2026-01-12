/**
 * 数据大屏管理控制器
 */

const Dashboard = require('../models/Dashboard');

// 获取所有大屏列表
exports.getAll = async (req, res) => {
  try {
    const dashboards = await Dashboard.getAll();
    res.json({
      code: 200,
      message: '获取大屏列表成功',
      data: dashboards,
    });
  } catch (error) {
    console.error('获取大屏列表失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '获取大屏列表失败',
    });
  }
};

// 获取大屏详情
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const dashboard = await Dashboard.getById(id);

    if (!dashboard) {
      return res.status(404).json({
        code: 404,
        message: '大屏不存在',
      });
    }

    res.json({
      code: 200,
      message: '获取大屏详情成功',
      data: dashboard,
    });
  } catch (error) {
    console.error('获取大屏详情失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '获取大屏详情失败',
    });
  }
};

// 新建大屏
exports.create = async (req, res) => {
  try {
    const { name, description, icon, config, dataSource, chartType, refreshInterval } = req.body;

    // 验证必填字段
    if (!name) {
      return res.status(400).json({
        code: 400,
        message: '大屏名称不能为空',
      });
    }

    if (!dataSource) {
      return res.status(400).json({
        code: 400,
        message: '数据源不能为空',
      });
    }

    const dashboardData = {
      name,
      description,
      icon,
      config,
      dataSource,
      chartType,
      refreshInterval,
      createdBy: req.user?.id || 0,
    };

    const result = await Dashboard.create(dashboardData);

    res.json({
      code: 200,
      message: '大屏创建成功',
      data: result,
    });
  } catch (error) {
    console.error('创建大屏失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '创建大屏失败',
    });
  }
};

// 更新大屏
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, config, dataSource, chartType, refreshInterval, isActive } = req.body;

    // 验证必填字段
    if (!name) {
      return res.status(400).json({
        code: 400,
        message: '大屏名称不能为空',
      });
    }

    const dashboardData = {
      name,
      description,
      icon,
      config,
      dataSource,
      chartType,
      refreshInterval,
      isActive,
    };

    const result = await Dashboard.update(id, dashboardData);

    if (result) {
      res.json({
        code: 200,
        message: '大屏更新成功',
      });
    } else {
      res.status(404).json({
        code: 404,
        message: '大屏不存在',
      });
    }
  } catch (error) {
    console.error('更新大屏失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '更新大屏失败',
    });
  }
};

// 删除大屏
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Dashboard.delete(id);

    if (result) {
      res.json({
        code: 200,
        message: '大屏删除成功',
      });
    } else {
      res.status(404).json({
        code: 404,
        message: '大屏不存在',
      });
    }
  } catch (error) {
    console.error('删除大屏失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '删除大屏失败',
    });
  }
};

// 按数据源获取大屏
exports.getByDataSource = async (req, res) => {
  try {
    const { dataSource } = req.params;
    const dashboards = await Dashboard.getByDataSource(dataSource);

    res.json({
      code: 200,
      message: '获取数据源大屏成功',
      data: dashboards,
    });
  } catch (error) {
    console.error('获取数据源大屏失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '获取数据源大屏失败',
    });
  }
};

// 获取可用数据源列表
exports.getDataSources = async (req, res) => {
  try {
    // 获取所有可用的数据源
    const dataSources = [
      {
        key: 'projects',
        name: '项目管理',
        description: '项目状态、进度、优先级统计',
        icon: 'project',
        fields: [
          { key: 'totalProjects', label: '项目总数', type: 'number' },
          { key: 'statusStats', label: '项目状态分布', type: 'object' },
          { key: 'progressDistribution', label: '进度分布', type: 'array' },
          { key: 'priorityStats', label: '优先级统计', type: 'object' },
          { key: 'avgProgress', label: '平均进度', type: 'number' },
          { key: 'totalSignedAmount', label: '签约总额', type: 'number' },
        ],
      },
      {
        key: 'sales',
        name: '销售数据',
        description: '销售额、订单、客户统计',
        icon: 'shopping',
        fields: [
          { key: 'totalSales', label: '总销售额', type: 'number' },
          { key: 'orderCount', label: '订单数', type: 'number' },
          { key: 'customerCount', label: '客户数', type: 'number' },
        ],
      },
      {
        key: 'inventory',
        name: '库存管理',
        description: '库存量、进出货统计',
        icon: 'database',
        fields: [
          { key: 'totalQuantity', label: '库存总量', type: 'number' },
          { key: 'categoryStats', label: '分类统计', type: 'object' },
          { key: 'lowStockItems', label: '低库存项目', type: 'array' },
        ],
      },
      {
        key: 'custom',
        name: '自定义数据',
        description: '自定义数据源和字段',
        icon: 'setting',
        fields: [],
      },
    ];

    res.json({
      code: 200,
      message: '获取数据源列表成功',
      data: dataSources,
    });
  } catch (error) {
    console.error('获取数据源失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '获取数据源失败',
    });
  }
};

// 获取图表类型列表
exports.getChartTypes = async (req, res) => {
  try {
    const chartTypes = [
      { key: 'pie', label: '饼图', icon: 'pie-chart' },
      { key: 'bar', label: '柱状图', icon: 'bar-chart' },
      { key: 'line', label: '折线图', icon: 'line-chart' },
      { key: 'radar', label: '雷达图', icon: 'radar-chart' },
      { key: 'scatter', label: '散点图', icon: 'scatter-chart' },
      { key: 'gauge', label: '仪表盘', icon: 'gauge-chart' },
      { key: 'table', label: '数据表格', icon: 'table' },
      { key: 'card', label: '统计卡片', icon: 'card' },
    ];

    res.json({
      code: 200,
      message: '获取图表类型成功',
      data: chartTypes,
    });
  } catch (error) {
    console.error('获取图表类型失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '获取图表类型失败',
    });
  }
};

// 获取大屏统计
exports.getStats = async (req, res) => {
  try {
    const stats = await Dashboard.getStats();

    res.json({
      code: 200,
      message: '获取统计信息成功',
      data: stats,
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({
      code: 500,
      message: error.message || '获取统计信息失败',
    });
  }
};
