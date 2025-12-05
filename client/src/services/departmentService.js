import api from '../utils/api';

export const departmentService = {
  getDepartments: (params) => api.get('/departments', { params, timeout: 30000 }),
  getDepartmentTree: () => api.get('/departments/tree'),
  getDepartment: (id) => api.get(`/departments/${id}`),
  createDepartment: (data) => api.post('/departments', data),
  updateDepartment: (id, data) => api.put(`/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/departments/${id}`),
};

