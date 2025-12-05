import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 发送日志到后端（用于钉钉客户端内调试）
const logToBackend = (level, message, data = null) => {
  console.log(`[${level}] ${message}`, data || '');
  try {
    // 检查 fetch 是否可用
    if (typeof fetch === 'undefined' || typeof fetch !== 'function') {
      return; // fetch 不可用，直接返回
    }
    const fetchPromise = fetch('/api/dingtalk/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, data }),
    });
    // 确保 fetch 返回的是 Promise
    if (fetchPromise && typeof fetchPromise.catch === 'function') {
      fetchPromise.catch(() => {}); // 静默失败，避免阻塞
    }
  } catch (e) {
    // 忽略错误
  }
};

// 全局错误处理
window.addEventListener('error', (event) => {
  logToBackend('error', '全局错误', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.stack
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logToBackend('error', '未处理的 Promise 拒绝', {
    reason: event.reason?.message || event.reason,
    stack: event.reason?.stack
  });
});

logToBackend('info', '==========================================');
logToBackend('info', '🚀 main.jsx 开始执行');
logToBackend('info', '   当前 URL:', window.location.href);
logToBackend('info', '   User-Agent:', navigator.userAgent.substring(0, 100));
logToBackend('info', '==========================================');

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    logToBackend('error', '❌ 未找到 root 元素');
    throw new Error('未找到 root 元素');
  }
  
  logToBackend('info', '✅ 找到 root 元素，开始渲染 React 应用');
  
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  
  logToBackend('info', '✅ React 应用渲染完成');
} catch (error) {
  logToBackend('error', '❌ React 应用渲染失败', {
    message: error.message,
    stack: error.stack
  });
  
  // 显示错误信息
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h2>应用加载失败</h2>
        <p>${error.message}</p>
        <p style="color: #666; font-size: 12px;">请刷新页面重试</p>
      </div>
    `;
  }
}
