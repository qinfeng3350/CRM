import api from '../utils/api';

export const moduleService = {
  // 获取所有可用模块
  getModules: () => api.get('/modules'),
  
  // 获取指定模块的字段列表
  getModuleFields: (moduleCode) => api.get(`/modules/${moduleCode}/fields`),
};

