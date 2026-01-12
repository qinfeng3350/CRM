/**
 * 数据大屏路由
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// 获取所有大屏列表
router.get('/', dashboardController.getAll);

// 获取大屏详情
router.get('/:id', dashboardController.getById);

// 新建大屏
router.post('/', dashboardController.create);

// 更新大屏
router.put('/:id', dashboardController.update);

// 删除大屏
router.delete('/:id', dashboardController.delete);

// 按数据源获取大屏
router.get('/source/:dataSource', dashboardController.getByDataSource);

// 获取可用数据源列表
router.get('/config/dataSources', dashboardController.getDataSources);

// 获取图表类型列表
router.get('/config/chartTypes', dashboardController.getChartTypes);

// 获取大屏统计
router.get('/stats/info', dashboardController.getStats);

module.exports = router;
