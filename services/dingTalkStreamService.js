const { DWClient, EventAck } = require('dingtalk-stream');
const DingTalkConfig = require('../models/DingTalkConfig');
const DingTalkUser = require('../models/DingTalkUser');
const User = require('../models/User');
const Todo = require('../models/Todo');

class DingTalkStreamService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  // 启动Stream连接
  async start() {
    try {
      const config = await DingTalkConfig.findWithSecrets();
      if (!config) {
        console.log('⚠️  钉钉配置不存在，跳过Stream连接');
        console.log('   请先运行: npm run init-dingtalk');
        return;
      }
      
      if (!config.enabled) {
        console.log('⚠️  钉钉配置未启用，跳过Stream连接');
        console.log('   请在系统管理 -> 钉钉集成中启用配置');
        return;
      }

      if (!config.appKey || !config.appSecret) {
        console.log('⚠️  钉钉配置不完整，跳过Stream连接');
        console.log('   AppKey或AppSecret未设置');
        return;
      }

      console.log('正在初始化钉钉Stream客户端...');
      console.log(`   AppKey: ${config.appKey}`);
      
      this.client = new DWClient({
        clientId: config.appKey,
        clientSecret: config.appSecret,
      });

      // 注册所有事件监听器
      this.client.registerAllEventListener(async (event) => {
        try {
          console.log('收到钉钉事件:', JSON.stringify(event, null, 2));
          await this.handleEvent(event);
          return { status: EventAck.SUCCESS, message: 'OK' };
        } catch (error) {
          console.error('处理钉钉事件失败:', error);
          return { status: EventAck.FAIL, message: error.message };
        }
      });

      console.log('正在连接钉钉Stream服务...');
      console.log('   建立WebSocket连接中...');
      console.log('   请稍候，这可能需要几秒钟...');
      
      // 直接调用connect方法（返回Promise）
      // connect方法会建立WebSocket连接，连接成功后会自动保持连接
      try {
        // 设置连接超时（增加到30秒，给更多时间）
        const connectPromise = this.client.connect();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('连接超时（30秒）')), 30000);
        });
        
        await Promise.race([connectPromise, timeoutPromise]);
        this.isConnected = true;
        console.log('');
        console.log('✅ 钉钉Stream连接成功');
        console.log('   WebSocket连接已建立');
        console.log('   Stream服务已启动，等待事件推送...');
        console.log('');
      } catch (connectError) {
        console.error('❌ Stream连接失败');
        console.error('   错误:', connectError.message);
        
        // 提供更详细的错误提示
        if (connectError.message.includes('超时')) {
          console.error('   原因：连接超时，可能是网络问题或配置错误');
          console.error('   建议：');
          console.error('     1. 检查网络连接是否正常');
          console.error('     2. 确认AppKey和AppSecret是否正确');
          console.error('     3. 在钉钉开放平台检查应用状态');
        } else if (connectError.message.includes('401') || connectError.message.includes('unauthorized')) {
          console.error('   原因：认证失败，请检查AppKey和AppSecret是否正确');
          console.error('   建议：在系统管理 -> 钉钉集成中重新配置');
        } else if (connectError.message.includes('ECONNREFUSED') || connectError.message.includes('ENOTFOUND')) {
          console.error('   原因：无法连接到钉钉服务器，请检查网络连接');
          console.error('   建议：检查防火墙设置和网络代理配置');
        } else {
          console.error('   原因：未知错误');
          console.error('   建议：查看详细错误信息，或联系技术支持');
        }
        
        this.isConnected = false;
        // 不抛出错误，让服务继续运行，SDK可能会自动重试
        console.log('   提示：HTTP API服务不受影响，可以正常使用');
        console.log('   Stream连接可能会自动重试，或稍后手动重启连接');
      }
    } catch (error) {
      console.error('❌ 钉钉Stream连接失败:', error.message);
      if (error.stack) {
        console.error('详细错误:', error.stack);
      }
      this.isConnected = false;
      // 不抛出错误，让服务继续运行
      // HTTP API服务不受影响，Stream连接可以稍后重试
      console.log('   提示：HTTP API服务不受影响，可以正常使用');
      console.log('   Stream连接可以稍后手动重启或自动重试');
    }
  }

  // 停止Stream连接
  async stop() {
    if (this.client) {
      try {
        await this.client.disconnect();
        this.isConnected = false;
        console.log('钉钉Stream连接已断开');
      } catch (error) {
        console.error('断开Stream连接失败:', error);
      }
    }
  }

  // 处理事件
  async handleEvent(event) {
    const { type, headers, data } = event;

    // 钉钉Stream事件有两种格式：
    // 1. 简单格式：直接是 type 和 data
    // 2. 复杂格式：有 headers，实际事件类型在 headers.eventType 中
    
    // 检查是否是复杂格式（有headers）
    if (headers && headers.eventType) {
      const eventType = headers.eventType;
      console.log(`[Stream事件] 事件类型: ${eventType}`);
      
      // 处理审批任务变更事件
      if (eventType === 'bpms_task_change') {
        await this.handleBpmsTaskChange(headers, data);
        return;
      }
      
      // 处理审批流程变更事件
      if (eventType === 'bpms_instance_change') {
        await this.handleBpmsInstanceChange(headers, data);
        return;
      }
    }

    // 处理简单格式的事件
    switch (type) {
      case 'user_add_org':
        // 用户加入企业
        await this.handleUserAdd(data);
        break;
      case 'user_modify_org':
        // 用户信息变更
        await this.handleUserModify(data);
        break;
      case 'user_leave_org':
        // 用户离开企业
        await this.handleUserLeave(data);
        break;
      case 'dept_create':
        // 部门创建
        await this.handleDeptCreate(data);
        break;
      case 'dept_modify':
        // 部门修改
        await this.handleDeptModify(data);
        break;
      case 'dept_remove':
        // 部门删除
        await this.handleDeptRemove(data);
        break;
      default:
        console.log('未处理的事件类型:', type);
    }
  }

  // 处理审批任务变更事件（bpms_task_change）
  async handleBpmsTaskChange(headers, data) {
    try {
      console.log('[Stream事件] 处理审批任务变更事件');
      
      // data 可能是字符串，需要解析
      let eventData = data;
      if (typeof data === 'string') {
        try {
          eventData = JSON.parse(data);
        } catch (e) {
          console.error('[Stream事件] 解析data失败:', e);
          return;
        }
      }
      
      console.log('[Stream事件] 事件数据:', JSON.stringify(eventData, null, 2));
      
      const { 
        processInstanceId,  // 钉钉审批流程实例ID
        businessId,         // 业务ID（我们的workflow_instance ID）
        result,             // 审批结果：agree/refuse
        type: taskType,     // 任务类型：finish/start等
        activityName,       // 活动名称
        actualActionerId,   // 实际操作人ID
        title               // 审批标题
      } = eventData;
      
      console.log('[Stream事件] 审批任务变更详情:');
      console.log(`   流程实例ID: ${processInstanceId}`);
      console.log(`   业务ID: ${businessId}`);
      console.log(`   任务类型: ${taskType}`);
      console.log(`   审批结果: ${result}`);
      console.log(`   活动名称: ${activityName}`);
      console.log(`   操作人ID: ${actualActionerId}`);
      
      // 只处理完成的任务（type: "finish"）
      if (taskType !== 'finish') {
        console.log(`[Stream事件] 任务类型不是finish，跳过处理: ${taskType}`);
        return;
      }
      
      // 通过processInstanceId查找对应的workflow_instance
      // 方法1：尝试使用businessId（如果格式正确）
      let workflowInstanceId = null;
      
      // 尝试解析businessId为数字
      if (businessId) {
        const parsedBusinessId = parseInt(businessId);
        if (!isNaN(parsedBusinessId) && parsedBusinessId > 0 && parsedBusinessId < 1000000) {
          // businessId看起来像是我们的workflow_instance ID（应该是较小的数字）
          workflowInstanceId = parsedBusinessId;
          console.log(`[Stream事件] 使用businessId作为workflow_instance ID: ${workflowInstanceId}`);
        }
      }
      
      // 方法2：如果businessId格式不对，通过processInstanceId查找
      if (!workflowInstanceId && processInstanceId) {
        const { pool } = require('../config/database');
        const connection = await pool.getConnection();
        try {
          // 通过todos的metadata查找
          const [todos] = await connection.execute(
            `SELECT id, metadata FROM todos 
             WHERE type = 'approval' AND status = 'pending'`,
            []
          );
          
          for (const todo of todos) {
            try {
              const metadata = typeof todo.metadata === 'string' 
                ? JSON.parse(todo.metadata) 
                : (todo.metadata || {});
              
              if (metadata.dingTalkProcessInstanceId === processInstanceId) {
                workflowInstanceId = metadata.workflowInstanceId;
                console.log(`[Stream事件] 通过todo找到workflow_instance ID: ${workflowInstanceId} (todoId: ${todo.id})`);
                break;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
          
          // 如果还没找到，尝试通过workflow_instances的metadata查找
          if (!workflowInstanceId) {
            const [instances] = await connection.execute(
              `SELECT id, metadata FROM workflow_instances WHERE status = 'running'`,
              []
            );
            
            for (const instance of instances) {
              try {
                const metadata = typeof instance.metadata === 'string' 
                  ? JSON.parse(instance.metadata) 
                  : (instance.metadata || {});
                
                if (metadata.dingTalkApproval && 
                    metadata.dingTalkApproval.processInstanceId === processInstanceId) {
                  workflowInstanceId = instance.id;
                  console.log(`[Stream事件] 通过workflow_instance找到ID: ${workflowInstanceId}`);
                  break;
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        } finally {
          connection.release();
        }
      }
      
      if (!workflowInstanceId) {
        console.error('[Stream事件] ❌ 无法找到对应的workflow_instance ID');
        console.error(`   processInstanceId: ${processInstanceId}`);
        console.error(`   businessId: ${businessId}`);
        return;
      }
      
      // 调用审批回调处理逻辑（复用现有的回调处理代码）
      const dingTalkController = require('../controllers/dingTalkController');
      
      // 构建回调请求体（模拟回调格式）
      const callbackBody = {
        processInstanceId: processInstanceId,
        businessId: workflowInstanceId.toString(), // 使用找到的workflow_instance ID
        result: result, // 'agree' 或 'refuse'
        status: result === 'agree' ? 'COMPLETED' : 'TERMINATED',
        type: 'finish',
      };
      
      console.log('[Stream事件] 调用审批回调处理逻辑...');
      console.log(`   workflow_instance ID: ${workflowInstanceId}`);
      console.log(`   审批结果: ${result}`);
      
      // 创建一个模拟的req和res对象
      const mockReq = {
        body: callbackBody,
      };
      
      const mockRes = {
        json: (data) => {
          console.log('[Stream事件] ✅ 回调处理成功:', JSON.stringify(data, null, 2));
        },
        status: (code) => ({
          json: (data) => {
            console.error(`[Stream事件] ❌ 回调处理失败 (${code}):`, JSON.stringify(data, null, 2));
          }
        })
      };
      
      // 调用审批回调处理函数
      await dingTalkController.handleApprovalCallback(mockReq, mockRes);
      
      console.log('[Stream事件] ✅ 审批任务变更事件处理完成');
      
    } catch (error) {
      console.error('[Stream事件] ❌ 处理审批任务变更事件失败:', error);
      console.error('[Stream事件] 错误堆栈:', error.stack);
    }
  }

  // 处理审批流程变更事件（bpms_instance_change）
  async handleBpmsInstanceChange(headers, data) {
    try {
      console.log('[Stream事件] 处理审批流程变更事件');
      
      // data 可能是字符串，需要解析
      let eventData = data;
      if (typeof data === 'string') {
        try {
          eventData = JSON.parse(data);
        } catch (e) {
          console.error('[Stream事件] 解析data失败:', e);
          return;
        }
      }
      
      console.log('[Stream事件] 流程变更事件数据:', JSON.stringify(eventData, null, 2));
      
      // 可以在这里处理流程级别的变更（如流程完成、终止等）
      // 目前主要关注任务级别的变更，流程级别的变更通过回调处理
      
    } catch (error) {
      console.error('[Stream事件] ❌ 处理审批流程变更事件失败:', error);
    }
  }

  // 处理用户加入企业
  async handleUserAdd(data) {
    try {
      const { userId } = data;
      console.log('用户加入企业:', userId);
      
      // 可以在这里自动同步新用户到系统
      // 或者等待管理员手动同步通讯录
    } catch (error) {
      console.error('处理用户加入事件失败:', error);
    }
  }

  // 处理用户信息变更
  async handleUserModify(data) {
    try {
      const { userId } = data;
      console.log('用户信息变更:', userId);
      
      // 更新系统中的用户信息
      const dingTalkUser = await DingTalkUser.findByDingTalkUserId(userId);
      if (dingTalkUser && dingTalkUser.userId) {
        // 可以在这里同步更新用户信息
      }
    } catch (error) {
      console.error('处理用户变更事件失败:', error);
    }
  }

  // 处理用户离开企业
  async handleUserLeave(data) {
    try {
      const { userId } = data;
      console.log('用户离开企业:', userId);
      
      // 可以在这里处理用户离开的逻辑
      // 例如：禁用系统用户账号
    } catch (error) {
      console.error('处理用户离开事件失败:', error);
    }
  }

  // 处理部门创建
  async handleDeptCreate(data) {
    try {
      const { deptId } = data;
      console.log('部门创建:', deptId);
    } catch (error) {
      console.error('处理部门创建事件失败:', error);
    }
  }

  // 处理部门修改
  async handleDeptModify(data) {
    try {
      const { deptId } = data;
      console.log('部门修改:', deptId);
    } catch (error) {
      console.error('处理部门修改事件失败:', error);
    }
  }

  // 处理部门删除
  async handleDeptRemove(data) {
    try {
      const { deptId } = data;
      console.log('部门删除:', deptId);
    } catch (error) {
      console.error('处理部门删除事件失败:', error);
    }
  }

  // 获取连接状态
  getStatus() {
    return {
      connected: this.isConnected,
      clientId: this.client?.clientId || null,
    };
  }
}

module.exports = new DingTalkStreamService();

