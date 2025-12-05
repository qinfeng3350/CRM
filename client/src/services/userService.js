import api from '../utils/api';

export const userService = {
  getUsers: (params) => api.get('/system/users', { params }),
  getUser: (id) => api.get(`/system/users/${id}`),
  createUser: (data) => api.post('/system/users', data),
  updateUser: (id, data) => api.put(`/system/users/${id}`, data),
  deleteUser: (id) => api.delete(`/system/users/${id}`),
  updateUserRole: (id, role) => api.put(`/system/users/${id}/role`, { role }),
};

