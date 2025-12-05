import api from '../utils/api';

export const analyticsService = {
  // 销售分析
  getSalesAnalytics: (params) => api.get('/analytics/sales', { params }),
  // 客户分析
  getCustomerAnalytics: (params) => api.get('/analytics/customers', { params }),
  // 商机分析
  getOpportunityAnalytics: (params) => api.get('/analytics/opportunities', { params }),
  // 合同分析
  getContractAnalytics: (params) => api.get('/analytics/contracts', { params }),
  // 自定义报表
  getCustomReport: (data) => api.post('/analytics/custom', data),
  // 导出报表
  exportReport: (data) => api.post('/analytics/export', data),
};

