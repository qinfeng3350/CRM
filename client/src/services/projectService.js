import api from '../utils/api';

export const projectService = {
  getProjects: (params) => api.get('/projects', { params }),
  getProject: (id) => api.get(`/projects/${id}`),
  createProject: (data) => api.post('/projects', data),
  updateProject: (id, data) => api.put(`/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/projects/${id}`),
  updateProgress: (id, progress) => api.post(`/projects/${id}/progress`, { progress }),
  addLog: (id, data) => api.post(`/projects/${id}/logs`, data),
  getLogs: (id, params) => api.get(`/projects/${id}/logs`, { params }),
  
  // 项目阶段（板块）管理
  getPhases: (id) => api.get(`/projects/${id}/phases`),
  createPhase: (id, data) => api.post(`/projects/${id}/phases`, data),
  updatePhase: (id, phaseId, data) => api.put(`/projects/${id}/phases/${phaseId}`, data),
  deletePhase: (id, phaseId) => api.delete(`/projects/${id}/phases/${phaseId}`),
  
  // 项目任务管理
  getTasks: (id, params) => api.get(`/projects/${id}/tasks`, { params }),
  createTask: (id, data) => api.post(`/projects/${id}/tasks`, data),
  updateTask: (id, taskId, data) => api.put(`/projects/${id}/tasks/${taskId}`, data),
  deleteTask: (id, taskId) => api.delete(`/projects/${id}/tasks/${taskId}`),
  
  // 项目统计数据
  getProjectStats: (id) => api.get(`/projects/${id}/stats`),
  // 获取所有项目统计数据（用于数据大屏）
  getAllProjectsDashboard: () => api.get('/projects/dashboard/stats'),
  // 项目甘特图
  getProjectGantt: (id) => api.get(`/projects/${id}/gantt`),
};

