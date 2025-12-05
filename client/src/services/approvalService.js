import api from '../utils/api';

export const approvalService = {
  // 获取审批流程列表
  getWorkflows: (params) => {
    return api.get('/approvals/workflows', { params });
  },

  // 获取单个审批流程
  getWorkflow: (id) => {
    return api.get(`/approvals/workflows/${id}`);
  },

  // 创建审批流程
  createWorkflow: (data) => {
    return api.post('/approvals/workflows', data);
  },

  // 更新审批流程
  updateWorkflow: (id, data) => {
    return api.put(`/approvals/workflows/${id}`, data);
  },

  // 删除审批流程
  deleteWorkflow: (id) => {
    return api.delete(`/approvals/workflows/${id}`);
  },

  // 启动审批流程
  startApproval: (data) => {
    return api.post('/approvals/start', data);
  },

  // 审批操作
  approve: (moduleType, moduleId, data) => {
    return api.post(`/approvals/${moduleType}/${moduleId}/approve`, data);
  },

  // 获取审批记录
  getApprovalRecords: (moduleType, moduleId) => {
    return api.get(`/approvals/${moduleType}/${moduleId}/records`);
  },

  // 撤回流程
  withdrawApproval: (moduleType, moduleId, data) => {
    return api.post(`/approvals/${moduleType}/${moduleId}/withdraw`, data);
  },
};

