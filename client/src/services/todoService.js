import api from '../utils/api';

export const todoService = {
  // 获取我的待办列表
  getMyTodos: (params) => {
    return api.get('/todos', { params });
  },

  // 获取单个待办详情
  getTodo: (id) => {
    return api.get(`/todos/${id}`);
  },

  // 获取待办统计
  getTodoStats: () => {
    return api.get('/todos/stats');
  },

  // 完成待办
  completeTodo: (id, data) => {
    return api.post(`/todos/${id}/complete`, data);
  },

  // 更新待办状态
  updateTodoStatus: (id, data) => {
    return api.put(`/todos/${id}/status`, data);
  },
};

