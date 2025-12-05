import api from '../utils/api';

export const authService = {
  // 登录
  login: (email, password) => {
    return api.post('/auth/login', { email, password });
  },

  // 注册
  register: (data) => {
    return api.post('/auth/register', data);
  },

  // 获取个人信息
  getProfile: () => {
    return api.get('/auth/profile');
  },

  // 更新个人信息
  updateProfile: (data) => {
    return api.put('/auth/profile', data);
  },
};

