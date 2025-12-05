import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0', // 允许外部访问
    allowedHosts: [
      'localhost',
      '.cpolar.top', // 允许所有 cpolar 域名
      '.cpolar.io', // 允许所有 cpolar.io 域名
    ],
    // 配置CORS，允许钉钉客户端访问
    cors: {
      origin: '*',
      credentials: true,
    },
    // 配置headers，确保资源可以正确加载
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    // 配置 HMR WebSocket，改善内网穿透环境下的连接稳定性
    hmr: {
      protocol: 'ws',
      host: 'localhost', // 使用 localhost，避免内网穿透的 WebSocket 问题
      clientPort: 5173, // 客户端端口
      // 如果使用内网穿透，可以尝试禁用 HMR 或使用轮询
      // overlay: true, // 显示错误覆盖层
    },
    // 如果 HMR 不稳定，可以启用轮询模式（但会增加资源消耗）
    // watch: {
    //   usePolling: true,
    //   interval: 1000,
    // },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  // 构建配置
  build: {
    // 确保资源路径正确
    assetsDir: 'assets',
    // 启用sourcemap（可选）
    sourcemap: false,
  },
})
