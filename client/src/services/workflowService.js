import api from '../utils/api';

export const workflowService = {
  // 获取流程定义列表
  getWorkflowDefinitions: (params) => api.get('/workflows/definitions', { params }),
  
  // 获取单个流程定义
  getWorkflowDefinition: (id) => api.get(`/workflows/definitions/${id}`),
  
  // 创建流程定义
  createWorkflowDefinition: (data) => api.post('/workflows/definitions', data),
  
  // 更新流程定义
  updateWorkflowDefinition: (id, data) => api.put(`/workflows/definitions/${id}`, data),
  
  // 删除流程定义
  deleteWorkflowDefinition: (id) => api.delete(`/workflows/definitions/${id}`),
  
  // 启动流程
  startWorkflow: (data) => api.post('/workflows/start', data),
  
  // 处理审批任务
  handleTask: (taskId, data) => api.post(`/workflows/tasks/${taskId}/handle`, data),
  
  // 获取流程实例列表
  getWorkflowInstances: (params) => api.get('/workflows/instances', { params }),
  
  // 获取流程实例详情
  getWorkflowInstance: (id) => api.get(`/workflows/instances/${id}`),
  
  // 获取我的待办任务
  getMyTasks: (params) => api.get('/workflows/tasks/my', { params }),
  
  // 获取任务详情（包含字段权限过滤的数据）
  getTaskDetail: (taskId) => api.get(`/workflows/tasks/${taskId}/detail`),
};

