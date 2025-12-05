import api from '../utils/api';

export const dingTalkService = {
  // 获取钉钉配置（需要认证）
  getConfig: () => api.get('/dingtalk/config'),
  
  // 获取扫码登录配置（公开接口，不需要认证，增加超时时间到30秒）
  getQRLoginConfig: () => api.get('/dingtalk/qrlogin-config', { timeout: 30000 }),
  
  // 更新钉钉配置
  updateConfig: (data) => api.put('/dingtalk/config', data),
  
  // 测试配置
  testConfig: () => api.post('/dingtalk/config/test'),
  
  // 获取登录URL（网页OAuth登录，已废弃）
  getLoginUrl: (redirectUri) => api.get('/dingtalk/login-url', { 
    params: { redirectUri } 
  }),
  
  // 获取扫码登录二维码URL
  getQRCodeUrl: (redirectUri) => api.get('/dingtalk/qrcode-url', { 
    params: { redirectUri } 
  }),
  
  // 企业内部应用免登（通过code登录）
  loginWithCode: (code) => api.post('/dingtalk/login', { code }),
  
  // 同步组织架构（部门）
  syncDepartments: () => api.post('/dingtalk/sync/departments'),
  
  // 同步通讯录
  syncContacts: () => api.post('/dingtalk/sync/contacts'),
  
  // 统一同步组织架构（部门和用户）
  syncOrganization: () => api.post('/dingtalk/sync/organization'),
  
  // 清除钉钉同步数据（后端立即返回，不需要长超时）
  clearSyncData: () => api.post('/dingtalk/sync/clear', {}, { timeout: 10000 }),
  
  // 同步单个待办到钉钉
  syncTodoToDingTalk: (todoId) => api.post(`/dingtalk/todos/${todoId}/sync`),
  
  // 批量同步待办到钉钉
  syncTodosToDingTalk: (todoIds) => api.post('/dingtalk/todos/sync', { todoIds }),
  
  // 获取钉钉用户关联列表
  getDingTalkUsers: () => api.get('/dingtalk/users'),
  cleanDuplicateUsers: () => api.post('/dingtalk/users/clean-duplicates'),
  
  // Stream连接状态
  getStreamStatus: () => api.get('/dingtalk/stream/status'),
  restartStream: () => api.post('/dingtalk/stream/restart'),
  
  // 生成钉钉模板配置（读取系统流程定义）
  generateTemplateConfig: () => api.get('/dingtalk/template-config'),
  
  // 发送日志到后端（用于调试）
  logToBackend: (level, message, data) => {
    // 不等待响应，避免阻塞，但返回 Promise 以便调用者可以链式调用
    try {
      return api.post('/dingtalk/log', { level, message, data }).catch(() => {
        // 静默失败，不影响主流程
      });
    } catch (e) {
      // 如果 api.post 失败，返回一个 resolved 的 Promise
      return Promise.resolve();
    }
  },
};

