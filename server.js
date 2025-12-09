const express = require('express');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const { connectDB } = require('./config/database');
const dingTalkStreamService = require('./services/dingTalkStreamService');

// 加载环境变量
dotenv.config();

const app = express();

// 中间件
// 配置CORS，允许钉钉客户端访问
app.use(cors({
  origin: '*', // 允许所有来源（生产环境应该限制）
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(compression());

// 性能监控中间件（放在最前面，以便监控所有请求）
const performanceMonitor = require('./middleware/performance');
app.use(performanceMonitor);

// 请求去重中间件（防止重复请求，提高性能）
// 注意：暂时禁用，因为可能影响某些需要实时数据的接口
// const requestDeduplication = require('./middleware/requestDeduplication');
// app.use(requestDeduplication);

app.use(express.json({ limit: '10mb' })); // 增加body大小限制
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 提供前端静态文件（生产构建后）
// 注意：如果使用开发服务器，注释掉这两行
const distPath = path.join(__dirname, 'client/dist');
console.log(`[静态文件] 配置静态文件目录: ${distPath}`);
console.log(`[静态文件] 目录是否存在: ${require('fs').existsSync(distPath)}`);
app.use(express.static(distPath, {
  maxAge: 0, // 开发环境不缓存
  etag: false,
  lastModified: false
}));

// 数据库连接将在启动服务器时进行

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/opportunities', require('./routes/opportunities'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/marketing', require('./routes/marketing'));
app.use('/api/service', require('./routes/service'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/system', require('./routes/system'));
app.use('/api/integration', require('./routes/integration'));
app.use('/api/todos', require('./routes/todos'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/workflows', require('./routes/workflows'));
app.use('/api/modules', require('./routes/modules'));
app.use('/api/products', require('./routes/products'));
app.use('/api/quotations', require('./routes/quotations'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/follow-ups', require('./routes/followUps'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/operation-logs', require('./routes/operationLogs'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/dingtalk', require('./routes/dingtalk'));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '墨枫CRM系统运行正常' });
});

// 所有非API请求都返回前端应用（生产构建后）
// 注意：如果使用开发服务器，注释掉这个路由
app.get('*', (req, res, next) => {
  // API请求不处理
  if (req.path.startsWith('/api')) {
    return next();
  }
  // 静态资源请求不处理（由上面的express.static处理）
  if (req.path.startsWith('/assets') || req.path.includes('.')) {
    return next();
  }
  // 其他请求返回前端应用
  const indexPath = path.join(__dirname, 'client/dist/index.html');
  console.log(`[静态文件] 返回前端应用: ${req.path} -> ${indexPath}`);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error(`[静态文件] 返回前端应用失败: ${req.path}`, err);
      res.status(500).send('前端应用加载失败');
    }
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: err.message || '服务器内部错误' 
  });
});

const PORT = process.env.PORT || 3000;

// 全局异常处理 - 防止未捕获的异常导致进程退出
process.on('uncaughtException', (error) => {
  console.error('\n❌ 未捕获的异常:', error.message);
  console.error('   堆栈:', error.stack);
  console.error('   服务器将继续运行，但建议重启服务器\n');
  // 不退出进程，让服务器继续运行
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ 未处理的Promise拒绝:', reason);
  if (reason instanceof Error) {
    console.error('   错误:', reason.message);
    console.error('   堆栈:', reason.stack);
  } else {
    console.error('   原因:', reason);
  }
  console.error('   服务器将继续运行，但建议检查代码\n');
  // 不退出进程，让服务器继续运行
});

// 检查端口是否被占用
function checkPortInUse(port) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec(`netstat -ano | findstr ":${port}" | findstr "LISTENING"`, (error, stdout) => {
      if (stdout && stdout.trim()) {
        const lines = stdout.trim().split('\n');
        const pids = new Set();
        
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 0) {
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid)) {
              pids.add(pid);
            }
          }
        });
        
        resolve(Array.from(pids));
      } else {
        resolve([]);
      }
    });
  });
}

// 终止进程
function killProcess(pid) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec(`taskkill /PID ${pid} /F`, (error) => {
      if (error) {
        console.log(`   ⚠️  终止进程 ${pid} 失败: ${error.message}`);
        resolve(false);
      } else {
        console.log(`   ✅ 已终止进程 PID: ${pid}`);
        resolve(true);
      }
    });
  });
}

// 检查并释放端口（带重试机制）
async function ensurePortAvailable(port, maxRetries = 5) {
  let initialPids = await checkPortInUse(port);
  
  if (initialPids.length === 0) {
    // 端口未被占用
    return true;
  }
  
  console.log(`⚠️  端口 ${port} 被占用，尝试释放...`);
  console.log(`   检测到 ${initialPids.length} 个进程占用端口: ${initialPids.join(', ')}`);
  
  // 记录初始进程ID，用于跟踪
  const originalPids = new Set(initialPids);
  
  // 终止所有占用端口的进程
  const killPromises = initialPids.map(pid => killProcess(pid));
  await Promise.all(killPromises);
  
  // 等待并重试验证端口是否释放
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(resolve => setTimeout(resolve, 1500)); // 等待1.5秒，给进程更多时间退出
    
    const currentPids = await checkPortInUse(port);
    if (currentPids.length === 0) {
      console.log(`✅ 端口 ${port} 已释放`);
      return true;
    }
    
    // 检查是否有新的进程（不是原来的进程）
    const newPids = currentPids.filter(pid => !originalPids.has(pid));
    const oldPids = currentPids.filter(pid => originalPids.has(pid));
    
    if (newPids.length > 0) {
      console.log(`   ⚠️  检测到新进程占用端口: ${newPids.join(', ')}`);
      // 将新进程添加到原始列表
      newPids.forEach(pid => originalPids.add(pid));
    }
    
    if (i < maxRetries - 1) {
      console.log(`   等待端口释放... (${i + 1}/${maxRetries})`);
      // 只尝试终止仍然存在的进程
      const pidsToKill = currentPids;
      if (pidsToKill.length > 0) {
        for (const pid of pidsToKill) {
          await killProcess(pid);
        }
      }
    }
  }
  
  // 最终检查
  await new Promise(resolve => setTimeout(resolve, 1000)); // 最后等待1秒
  const finalPids = await checkPortInUse(port);
  if (finalPids.length > 0) {
    console.error(`\n❌ 端口 ${port} 仍被以下进程占用: ${finalPids.join(', ')}`);
    console.error('   可能的原因：');
    console.error('   1. 进程需要管理员权限才能终止');
    console.error('   2. 进程正在被其他程序保护');
    console.error('   3. 进程正在快速重启（如 nodemon）');
    console.error('\n   解决方案：');
    console.error('   1. 以管理员身份运行此程序');
    console.error('   2. 手动终止进程：taskkill /PID <PID> /F');
    console.error('   3. 修改 .env 文件中的 PORT 环境变量使用其他端口\n');
    return false;
  }
  
  console.log(`✅ 端口 ${port} 已释放`);
  return true;
}

// 在 Vercel 环境下初始化数据库连接（延迟初始化）
if (process.env.VERCEL) {
  // Vercel serverless function 环境下，延迟连接数据库
  // 数据库连接会在第一次请求时自动建立（通过连接池）
  console.log('Vercel 环境：使用延迟数据库连接');
}

// 导出 app 供 Vercel serverless function 使用
module.exports = app;

// 启动服务器（仅在非 Vercel 环境下运行）
if (!process.env.VERCEL) {
  (async () => {
    try {
      // 先连接数据库
      await connectDB();
      
      // 检查并释放端口
      const portAvailable = await ensurePortAvailable(PORT);
      if (!portAvailable) {
        console.error(`\n❌ 无法释放端口 ${PORT}，请手动终止占用该端口的进程`);
        console.error('   或修改 .env 文件中的 PORT 环境变量使用其他端口\n');
        process.exit(1);
      }
      
      // 启动HTTP服务器
      const server = app.listen(PORT, () => {
      console.log('\n==========================================');
      console.log('✅ CRM系统服务器启动成功');
      console.log(`   端口: ${PORT}`);
      console.log(`   访问: http://localhost:${PORT}`);
      console.log('==========================================\n');
      
      // 延迟启动Stream服务，确保数据库连接完成
      setTimeout(async () => {
        try {
          console.log('========== 钉钉Stream服务启动 ==========');
          await dingTalkStreamService.start();
          const status = dingTalkStreamService.getStatus();
          console.log('==========================================\n');
          
          if (status.connected) {
            console.log('✅ 钉钉Stream服务已成功启动');
            console.log('   下一步：在钉钉开放平台验证连接通道');
            console.log('   路径：企业内部应用 -> 开发管理 -> 事件订阅 -> Stream模式推送 -> 验证连接通道\n');
          } else {
            console.log('⚠️  钉钉Stream服务未连接');
            console.log('   可能的原因：');
            console.log('   1. 钉钉配置未启用');
            console.log('   2. AppKey或AppSecret配置错误');
            console.log('   3. 网络连接问题');
            console.log('   提示：服务将继续运行，Stream连接可能会自动重试');
            console.log('   可以在系统管理 -> 钉钉集成中查看连接状态\n');
          }
        } catch (error) {
          console.error('\n❌ 启动钉钉Stream服务时发生错误:');
          console.error('   错误信息:', error.message);
          if (error.stack) {
            console.error('   详细堆栈:', error.stack);
          }
          console.log('   提示：服务将继续运行，Stream连接可能会自动重试');
          console.log('   HTTP API服务不受影响，可以正常使用\n');
          // 确保错误不会导致进程退出
        }
      }, 2000).unref(); // 使用 unref() 防止定时器阻止进程退出
    });
    
    // 处理服务器启动错误
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ 端口 ${PORT} 仍被占用，请手动终止占用该端口的进程`);
        console.error('   或修改 .env 文件中的 PORT 环境变量使用其他端口\n');
        process.exit(1);
      } else {
        console.error('\n❌ 服务器启动失败:', err.message);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('数据库连接失败，无法启动服务器:', error);
    process.exit(1);
  }
  })();
}

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  await dingTalkStreamService.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('收到SIGINT信号，正在关闭服务器...');
  await dingTalkStreamService.stop();
  process.exit(0);
});

