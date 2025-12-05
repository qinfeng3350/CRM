import api from '../utils/api';

export const operationLogService = {
  getLogs: (params) => api.get('/operation-logs', { params }),
};

