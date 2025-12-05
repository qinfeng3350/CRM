import api from '../utils/api';

export const opportunityService = {
  // 获取商机列表
  getOpportunities: (params) => {
    return api.get('/opportunities', { params });
  },

  // 获取单个商机
  getOpportunity: (id) => {
    return api.get(`/opportunities/${id}`);
  },

  // 创建商机
  createOpportunity: (data) => {
    return api.post('/opportunities', data);
  },

  // 更新商机
  updateOpportunity: (id, data) => {
    return api.put(`/opportunities/${id}`, data);
  },

  // 删除商机
  deleteOpportunity: (id) => {
    return api.delete(`/opportunities/${id}`);
  },

  // 转移商机
  transferOpportunity: (id, data) => {
    return api.post(`/opportunities/${id}/transfer`, data);
  },

  // 更新状态
  updateStatus: (id, status) => {
    return api.post(`/opportunities/${id}/status`, { status });
  },

  // 获取销售漏斗
  getFunnel: () => {
    return api.get('/opportunities/funnel');
  },
};

