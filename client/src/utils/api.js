import axios from 'axios';

// 动态获取 API 基础地址
// 优先使用环境变量，否则根据当前域名推断
const getApiBaseUrl = () => {
  // 如果设置了环境变量，使用环境变量
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // 根据当前域名推断 API 地址
  const currentOrigin = window.location.origin;
  
  // 如果是 Vercel 部署域名，使用相同的域名
  if (currentOrigin.includes('vercel.app') || currentOrigin.includes('vercel.dev')) {
    return `${currentOrigin}/api`;
  }
  
  // 如果是 cpolar 域名，使用相同的域名
  if (currentOrigin.includes('cpolar.top') || currentOrigin.includes('cpolar.io')) {
    return `${currentOrigin}/api`;
  }
  
  // 开发环境使用 localhost
  if (currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')) {
    return 'http://localhost:3000/api';
  }
  
  // 默认使用当前域名（适用于所有部署环境）
  return `${currentOrigin}/api`;
};

const API_BASE_URL = getApiBaseUrl();

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 增加到30秒，给服务器更多时间
  headers: {
    'Content-Type': 'application/json',
  },
  // 启用请求去重（防止重复请求）
  maxRedirects: 5,
  validateStatus: function (status) {
    return status >= 200 && status < 500; // 接受4xx状态码，不抛出错误
  }
});

// 请求拦截器 - 添加token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => {
    // 如果响应数据已经是处理过的格式（有success字段），直接返回
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      return response.data;
    }
    // 否则返回data字段
    return response.data;
  },
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        // token过期，清除并跳转到登录页
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      const errorData = error.response.data || {};
      // 返回一个包含 message 的对象，而不是直接返回字符串
      const errorMessage = errorData.message || error.message || '请求失败';
      const errorObj = new Error(errorMessage);
      errorObj.response = error.response;
      errorObj.data = errorData;
      return Promise.reject(errorObj);
    }
    const networkError = new Error(error.message || '网络错误');
    return Promise.reject(networkError);
  }
);

export default api;

