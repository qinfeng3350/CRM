import api from '../utils/api';

export const contractService = {
  // 获取合同列表
  getContracts: (params) => {
    return api.get('/contracts', { params });
  },

  // 获取单个合同
  getContract: (id) => {
    return api.get(`/contracts/${id}`);
  },

  // 创建合同
  createContract: (data) => {
    return api.post('/contracts', data);
  },

  // 更新合同
  updateContract: (id, data) => {
    return api.put(`/contracts/${id}`, data);
  },

  // 删除合同
  deleteContract: (id) => {
    return api.delete(`/contracts/${id}`);
  },

  // 审批合同
  approveContract: (id, data) => {
    return api.post(`/contracts/${id}/approve`, data);
  },

  // 签署合同
  signContract: (id) => {
    return api.post(`/contracts/${id}/sign`);
  },

  // 获取统计
  getStats: () => {
    return api.get('/contracts/stats');
  },

  // 更新状态
  updateStatus: (id, status, reason) => {
    return api.post(`/contracts/${id}/status`, { status, reason });
  },
};

