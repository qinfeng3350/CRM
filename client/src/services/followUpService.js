import api from '../utils/api';

export const followUpService = {
  getFollowUps: (params) => api.get('/follow-ups', { params }),
  createFollowUp: (data) => api.post('/follow-ups', data),
  updateFollowUp: (id, data) => api.put(`/follow-ups/${id}`, data),
  deleteFollowUp: (id) => api.delete(`/follow-ups/${id}`),
};

