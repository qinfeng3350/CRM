import api from '../utils/api';

export const serviceService = {
  // 获取工单列表
  getTickets: (params) => api.get('/service', { params }),
  // 获取单个工单
  getTicket: (id) => api.get(`/service/${id}`),
  // 创建工单
  createTicket: (data) => api.post('/service', data),
  // 更新工单
  updateTicket: (id, data) => api.put(`/service/${id}`, data),
  // 删除工单
  deleteTicket: (id) => api.delete(`/service/${id}`),
  // 分配工单
  assignTicket: (id, ownerId) => api.post(`/service/${id}/assign`, { ownerId }),
  // 解决工单
  resolveTicket: (id, solution) => api.post(`/service/${id}/resolve`, { solution }),
  // 评价工单
  rateTicket: (id, data) => api.post(`/service/${id}/rate`, data),
  // 获取统计
  getStats: () => api.get('/service/stats'),
  // 更新状态
  updateStatus: (id, status, comment) => api.post(`/service/${id}/status`, { status, comment }),
};

