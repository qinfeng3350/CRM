import api from '../utils/api';

export const paymentService = {
  // 回款计划
  getPaymentPlans: (params) => api.get('/payments/plans', { params }),
  createPaymentPlan: (data) => api.post('/payments/plans', data),
  updatePaymentPlan: (id, data) => api.put(`/payments/plans/${id}`, data),
  deletePaymentPlan: (id) => api.delete(`/payments/plans/${id}`),

  // 回款记录
  getPayments: (params) => api.get('/payments', { params }),
  createPayment: (data) => api.post('/payments', data),
  updatePayment: (id, data) => api.put(`/payments/${id}`, data),
  deletePayment: (id) => api.delete(`/payments/${id}`),

  // 财务统计
  getFinancialSummary: (params) => api.get('/payments/summary', { params }),
};

