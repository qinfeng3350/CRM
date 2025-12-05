import api from '../utils/api';

export const customerService = {
  // 获取客户列表
  getCustomers: (params) => {
    return api.get('/customers', { params });
  },

  // 获取公海客户
  getPublicCustomers: (params) => {
    return api.get('/customers/public', { params });
  },

  // 获取私海客户
  getPrivateCustomers: (params) => {
    return api.get('/customers/private', { params });
  },

  // 获取单个客户
  getCustomer: (id) => {
    return api.get(`/customers/${id}`);
  },

  // 创建客户
  createCustomer: (data) => {
    return api.post('/customers', data);
  },

  // 更新客户
  updateCustomer: (id, data) => {
    return api.put(`/customers/${id}`, data);
  },

  // 删除客户
  deleteCustomer: (id) => {
    return api.delete(`/customers/${id}`);
  },

  // 认领客户
  claimCustomer: (id) => {
    return api.post(`/customers/${id}/claim`);
  },

  // 退回公海
  returnToPublic: (id) => {
    return api.post(`/customers/${id}/return`);
  },

  // 更新状态
  updateStatus: (id, status, reason) => {
    return api.post(`/customers/${id}/status`, { status, reason });
  },

  // 搜索企业名称（调用外部API，增加超时时间）
  searchCompanies: (keyword) => {
    return api.get('/customers/search/companies', { 
      params: { keyword },
      timeout: 15000 // 增加到15秒，因为后端会立即返回本地结果
    });
  },

  // 导出客户
  exportCustomers: (params) => {
    return api.get('/customers/export', { 
      params,
      responseType: 'blob',
    });
  },

  // 导入客户
  importCustomers: (formData) => {
    return api.post('/customers/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

