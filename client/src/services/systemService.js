import api from '../utils/api';

export const systemService = {
  // 角色管理
  getRoles: () => api.get('/system/roles'),
  createRole: (data) => api.post('/system/roles', data),
  updateRole: (id, data) => api.put(`/system/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/system/roles/${id}`),

  // 用户管理
  getUsers: (page = 1, limit = 20) => api.get('/system/users', { params: { page, limit }, timeout: 30000 }),
  updateUserRole: (id, role) => api.put(`/system/users/${id}/role`, { role }),

  // 系统配置
  getConfig: () => api.get('/system/config'),
  updateConfig: (data) => api.put('/system/config', data),

  // 流转规则
  getTransferRules: () => api.get('/system/transfer-rules'),
  createTransferRule: (data) => api.post('/system/transfer-rules', data),
  updateTransferRule: (id, data) => api.put(`/system/transfer-rules/${id}`, data),
  deleteTransferRule: (id) => api.delete(`/system/transfer-rules/${id}`),
};

