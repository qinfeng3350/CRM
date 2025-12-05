import api from '../utils/api';

export const quotationService = {
  getQuotations: (params) => api.get('/quotations', { params }),
  getQuotation: (id) => api.get(`/quotations/${id}`),
  createQuotation: (data) => api.post('/quotations', data),
  updateQuotation: (id, data) => api.put(`/quotations/${id}`, data),
  deleteQuotation: (id) => api.delete(`/quotations/${id}`),
  sendQuotation: (id) => api.post(`/quotations/${id}/send`),
  updateStatus: (id, status, reason) => api.post(`/quotations/${id}/status`, { status, reason }),
};

