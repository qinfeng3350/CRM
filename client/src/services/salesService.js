import api from '../utils/api';

export const salesService = {
  // 获取销售团队
  getTeam: () => api.get('/sales/team'),
  // 获取单个销售
  getSalesPerson: (id) => api.get(`/sales/${id}`),
  // 获取销售业绩
  getPerformance: (params) => api.get('/sales/performance', { params }),
  // 获取销售活动
  getActivities: (params) => api.get('/sales/activities', { params }),
  // 创建活动
  createActivity: (data) => api.post('/sales/activities', data),
  // 更新活动
  updateActivity: (id, data) => api.put(`/sales/activities/${id}`, data),
  // 获取任务
  getTasks: () => api.get('/sales/tasks'),
  // 获取排名
  getRanking: () => api.get('/sales/ranking'),
};

