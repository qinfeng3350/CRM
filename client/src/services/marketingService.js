import api from '../utils/api';

export const marketingService = {
  // 线索相关
  getLeads: (params) => api.get('/marketing/leads', { params }),
  getLead: (id) => api.get(`/marketing/leads/${id}`),
  createLead: (data) => api.post('/marketing/leads', data),
  updateLead: (id, data) => api.put(`/marketing/leads/${id}`, data),
  deleteLead: (id) => api.delete(`/marketing/leads/${id}`),
  convertLead: (id, data) => api.post(`/marketing/leads/${id}/convert`, data),
  updateLeadStatus: (id, status, reason) => api.post(`/marketing/leads/${id}/status`, { status, reason }),

  // 市场活动相关
  getCampaigns: (params) => api.get('/marketing/campaigns', { params }),
  getCampaign: (id) => api.get(`/marketing/campaigns/${id}`),
  createCampaign: (data) => api.post('/marketing/campaigns', data),
  updateCampaign: (id, data) => api.put(`/marketing/campaigns/${id}`, data),
  deleteCampaign: (id) => api.delete(`/marketing/campaigns/${id}`),
  getCampaignStats: (id) => api.get(`/marketing/campaigns/${id}/stats`),
};

