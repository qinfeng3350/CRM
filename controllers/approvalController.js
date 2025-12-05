const ApprovalWorkflow = require('../models/ApprovalWorkflow');
const ApprovalRecord = require('../models/ApprovalRecord');
const Todo = require('../models/Todo');
const Contract = require('../models/Contract');
const Opportunity = require('../models/Opportunity');
const Invoice = require('../models/Invoice');
const User = require('../models/User');

const normalizeModuleType = (type) => {
  const map = {
    contracts: 'contract',
    opportunities: 'opportunity',
    invoices: 'invoice',
    expenses: 'expense',
    payments: 'payment',
    quotations: 'quotation',
    leads: 'lead',
    projects: 'project',
    customers: 'customer',
  };
  return map[type] || type;
};

const moduleDisplayNameMap = {
  contract: '合同',
  opportunity: '商机',
  invoice: '发票',
  expense: '费用',
  payment: '付款',
  quotation: '报价',
  lead: '线索',
  project: '项目',
  customer: '客户',
};

const buildApprovalTitle = (moduleType, moduleData = {}) => {
  const normalized = normalizeModuleType(moduleType);
  const moduleName = moduleDisplayNameMap[normalized] || moduleType;
  const identifier =
    moduleData.contractNumber ||
    moduleData.title ||
    moduleData.name ||
    moduleData.invoiceNumber ||
    moduleData.code ||
    '';
  const title = identifier ? `审批${moduleName}: ${identifier}` : `审批${moduleName}`;
  const description = identifier ? `需要您审批${moduleName}: ${identifier}` : `需要您审批${moduleName}`;
  return { title, description };
};

const updateModuleStatus = async (moduleType, moduleId, status) => {
  try {
    const normalized = normalizeModuleType(moduleType);
    console.log(`[更新模块状态] moduleType=${moduleType}, normalized=${normalized}, moduleId=${moduleId}, status=${status}`);
    if (normalized === 'contract') {
      await Contract.findByIdAndUpdate(moduleId, { status });
      console.log(`[更新模块状态] 合同状态已更新: ${status}`);
    } else if (normalized === 'opportunity') {
      const mappedStatus = status === 'draft' ? 'new' : status;
      await Opportunity.findByIdAndUpdate(moduleId, { status: mappedStatus });
      console.log(`[更新模块状态] 商机状态已更新: ${mappedStatus}`);
    } else if (normalized === 'invoice') {
      let mappedStatus = status;
      if (status === 'approved') {
        mappedStatus = 'issued';
      }
      const result = await Invoice.findByIdAndUpdate(moduleId, { status: mappedStatus });
      console.log(`[更新模块状态] 发票状态已更新: ${mappedStatus}, result:`, result ? '成功' : '失败');
    }
  } catch (error) {
    console.error(`[更新模块状态] 失败: moduleType=${moduleType}, moduleId=${moduleId}, status=${status}`, error);
    throw error;
  }
};

const setModuleStatus = async (moduleType, moduleId, status) => {
  const normalized = normalizeModuleType(moduleType);
  switch (normalized) {
    case 'contract':
      await Contract.findByIdAndUpdate(moduleId, { status });
      break;
    case 'opportunity':
      await Opportunity.findByIdAndUpdate(moduleId, { status });
      break;
    case 'invoice':
      await Invoice.findByIdAndUpdate(moduleId, { status });
      break;
    default:
      break;
  }
};

// 获取审批流程列表
exports.getWorkflows = async (req, res) => {
  try {
    const { moduleType, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (moduleType) query.moduleType = moduleType;
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const workflows = await ApprovalWorkflow.find(query);
    const total = workflows.length; // 简化处理
    
    res.json({
      success: true,
      data: workflows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个审批流程
exports.getWorkflow = async (req, res) => {
  try {
    const workflow = await ApprovalWorkflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, message: '审批流程不存在' });
    }
    res.json({ success: true, data: workflow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建审批流程
exports.createWorkflow = async (req, res) => {
  try {
    const workflowData = {
      ...req.body,
      createdBy: req.user.id
    };
    
    const workflow = await ApprovalWorkflow.create(workflowData);
    res.status(201).json({ success: true, data: workflow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新审批流程
exports.updateWorkflow = async (req, res) => {
  try {
    const workflow = await ApprovalWorkflow.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() }
    );
    
    if (!workflow) {
      return res.status(404).json({ success: false, message: '审批流程不存在' });
    }
    
    res.json({ success: true, data: workflow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除审批流程
exports.deleteWorkflow = async (req, res) => {
  try {
    const workflow = await ApprovalWorkflow.findByIdAndDelete(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, message: '审批流程不存在' });
    }
    res.json({ success: true, message: '审批流程已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 启动审批流程（优先使用新的流程引擎，如果没有则使用旧的审批系统）
exports.startApproval = async (req, res) => {
  try {
    const { moduleType, moduleId } = req.body;
    
    // 获取模块数据
    let moduleData = null;
    if (moduleType === 'contract') {
      moduleData = await Contract.findById(moduleId);
    } else if (moduleType === 'opportunity') {
      moduleData = await Opportunity.findById(moduleId);
    } else if (moduleType === 'invoice') {
      moduleData = await Invoice.findById(moduleId);
    }
    
    if (!moduleData) {
      return res.status(404).json({ success: false, message: '模块数据不存在' });
    }
    
    // 模块类型映射：前端使用的单数形式 -> 数据库表名（复数形式）
    const moduleTypeMap = {
      'contract': 'contracts',
      'opportunity': 'opportunities',
      'customer': 'customers',
      'expense': 'expenses',
      'payment': 'payments',
      'invoice': 'invoices',
      'quotation': 'quotations',
      'lead': 'leads',
      'project': 'projects',
    };
    
    // 优先尝试使用新的流程引擎
    try {
      const WorkflowDefinition = require('../models/WorkflowDefinition');
      const workflowEngine = require('../services/workflowEngine');
      
      // 查找匹配的新流程引擎定义
      // 先尝试使用传入的 moduleType，如果找不到，尝试映射后的表名
      const tableName = moduleTypeMap[moduleType] || moduleType;
      
      // 使用模型方法查询，避免连接管理冲突
      const workflows = await WorkflowDefinition.find({
        moduleType: moduleType,
        isActive: 1,
        limit: 1
      });
      
      // 如果没找到，尝试用表名查询
      let workflow = workflows.length > 0 ? workflows[0] : null;
      if (!workflow && tableName !== moduleType) {
        const workflowsByTable = await WorkflowDefinition.find({
          moduleType: tableName,
          isActive: 1,
          limit: 1
        });
        workflow = workflowsByTable.length > 0 ? workflowsByTable[0] : null;
      }
      
      // 如果找不到流程定义，先检查流程实例是否已经创建
      if (!workflow) {
        const { pool } = require('../config/database');
        const connection = await pool.getConnection();
        try {
          const [instances] = await connection.execute(
            `SELECT * FROM workflow_instances 
             WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND status = 'running'
             ORDER BY createdAt DESC LIMIT 1`,
            [moduleType, moduleTypeMap[moduleType] || moduleType, moduleId]
          );
          if (instances.length > 0) {
            // 流程已经启动，更新状态并返回成功
            console.log('[流程定义检查] 流程实例已存在，更新状态为pending');
            await updateModuleStatus(moduleType, moduleId, 'pending');
            if (res && res.json) {
              return res.json({
                success: true,
                data: { instanceId: instances[0].id },
                message: '审批流程已启动'
              });
            }
            return { success: true, data: { instanceId: instances[0].id } };
          }
        } catch (checkError) {
          console.error('[流程定义检查] 检查流程实例失败:', checkError);
        } finally {
          connection.release();
        }
      }
      
      if (workflow) {
        // 在启动流程前，先检查是否已有运行中的流程实例（防止重复提交）
        const { pool } = require('../config/database');
        const connection = await pool.getConnection();
        try {
          const [existingInstances] = await connection.execute(
            `SELECT * FROM workflow_instances 
             WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND status = 'running'
             ORDER BY createdAt DESC LIMIT 1`,
            [moduleType, moduleTypeMap[moduleType] || moduleType, moduleId]
          );
          
          if (existingInstances.length > 0) {
            // 流程已经启动，直接返回成功，不重复创建
            console.log('[startApproval] ⚠️ 流程实例已存在，防止重复提交:', existingInstances[0].id);
            await updateModuleStatus(moduleType, moduleId, 'pending');
            connection.release();
            return res.json({
              success: true,
              data: { instanceId: existingInstances[0].id },
              message: '审批流程已启动，请勿重复提交'
            });
          }
        } catch (checkError) {
          console.error('[startApproval] 检查流程实例失败:', checkError);
        } finally {
          connection.release();
        }
        
        // 使用新的流程引擎启动，使用原始的 moduleType（单数形式），而不是流程定义中的表名
        // 这样待办事项的 moduleType 就是正确的单数形式（contract, opportunity等）
        let result;
        try {
          result = await workflowEngine.startWorkflow(
            workflow.id,
            moduleType, // 使用原始的 moduleType（单数形式），如 'contract'
            moduleId,
            req.user.id,
            moduleData
          );
        } catch (workflowError) {
          // 检查流程是否已经启动（即使抛出错误，流程实例可能已经创建）
          const { pool } = require('../config/database');
          const connection = await pool.getConnection();
          try {
            const [instances] = await connection.execute(
              `SELECT * FROM workflow_instances 
               WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND status = 'running'
               ORDER BY createdAt DESC LIMIT 1`,
              [moduleType, moduleTypeMap[moduleType] || moduleType, moduleId]
            );
            if (instances.length > 0) {
              // 流程已经启动，更新状态并返回成功
              console.log('流程已启动，但启动过程中出现错误，继续更新状态');
              try {
                await updateModuleStatus(moduleType, moduleId, 'pending');
                console.log(`[流程启动] 模块状态已更新为pending: moduleType=${moduleType}, moduleId=${moduleId}`);
              } catch (statusError) {
                console.error(`[流程启动] 更新模块状态失败:`, statusError);
                // 即使状态更新失败，流程已启动，仍然返回成功
              }
              if (res && res.json) {
                return res.json({
                  success: true,
                  data: { instanceId: instances[0].id },
                  message: '审批流程已启动（新流程引擎）'
                });
              }
              return { success: true, data: { instanceId: instances[0].id } };
            }
          } finally {
            connection.release();
          }
          // 如果流程没有启动，继续抛出错误
          throw workflowError;
        }
        
        // 更新模块状态
        try {
          await updateModuleStatus(moduleType, moduleId, 'pending');
          console.log(`[流程启动] 模块状态已更新为pending: moduleType=${moduleType}, moduleId=${moduleId}`);
        } catch (statusError) {
          console.error(`[流程启动] 更新模块状态失败:`, statusError);
          // 即使状态更新失败，流程已启动，仍然返回成功
        }
        
        if (res && res.json) {
          res.json({
            success: true,
            data: result,
            message: '审批流程已启动（新流程引擎）'
          });
        }
        return { success: true, data: result };
      }
    } catch (newWorkflowError) {
      console.warn('新流程引擎启动失败，尝试使用旧审批系统:', newWorkflowError.message);
      console.error('详细错误:', newWorkflowError);
      
      // 检查流程实例是否已经创建（即使启动失败，流程实例可能已经创建）
      const { pool } = require('../config/database');
      const connection = await pool.getConnection();
      try {
        const [instances] = await connection.execute(
          `SELECT * FROM workflow_instances 
           WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND status = 'running'
           ORDER BY createdAt DESC LIMIT 1`,
          [moduleType, moduleTypeMap[moduleType] || moduleType, moduleId]
        );
        if (instances.length > 0) {
          // 流程已经启动，更新状态并返回成功
          console.log('[流程检查] 流程实例已存在，更新状态为pending');
          try {
            await updateModuleStatus(moduleType, moduleId, 'pending');
            console.log(`[流程启动] 模块状态已更新为pending: moduleType=${moduleType}, moduleId=${moduleId}`);
          } catch (statusError) {
            console.error(`[流程启动] 更新模块状态失败:`, statusError);
            // 即使状态更新失败，流程已启动，仍然返回成功
          }
          if (res && res.json) {
            return res.json({
              success: true,
              data: { instanceId: instances[0].id },
              message: '审批流程已启动（新流程引擎）'
            });
          }
          return { success: true, data: { instanceId: instances[0].id } };
        }
      } catch (checkError) {
        console.error('[流程检查] 检查流程实例失败:', checkError);
      } finally {
        connection.release();
      }
    }
    
    // 如果没有找到新流程，使用旧的审批系统
    const workflow = await ApprovalWorkflow.findActiveWorkflow(moduleType, {
      amount: moduleData.amount || moduleData.totalAmount || 0
    });
    
    if (!workflow) {
      // 在返回错误之前，先检查流程实例是否已经创建
      // 如果流程实例已存在，说明流程已经启动，更新状态并返回成功
      const { pool } = require('../config/database');
      const connection = await pool.getConnection();
      try {
        const [instances] = await connection.execute(
          `SELECT * FROM workflow_instances 
           WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND status = 'running'
           ORDER BY createdAt DESC LIMIT 1`,
          [moduleType, moduleTypeMap[moduleType] || moduleType, moduleId]
        );
        if (instances.length > 0) {
          // 流程已经启动，更新状态并返回成功
          console.log('[错误前检查] 流程实例已存在，更新状态为pending');
          await updateModuleStatus(moduleType, moduleId, 'pending');
          if (res && res.json) {
            return res.json({
              success: true,
              data: { instanceId: instances[0].id },
              message: '审批流程已启动'
            });
          }
          return { success: true, data: { instanceId: instances[0].id } };
        }
      } catch (checkError) {
        console.error('[错误前检查] 检查流程实例失败:', checkError);
      } finally {
        connection.release();
      }
      
      const moduleNameMap = {
        'contract': '合同',
        'opportunity': '商机',
        'invoice': '发票',
        'expense': '费用',
        'payment': '付款',
        'quotation': '报价',
        'lead': '线索',
        'project': '项目',
      };
      const moduleName = moduleNameMap[moduleType] || moduleType;
      const errorMsg = `未找到匹配的审批流程。请先在"系统管理 > 流程设计器"中创建${moduleName}审批流程。`;
      console.warn(errorMsg);
      if (res && res.status) {
        return res.status(400).json({ success: false, message: errorMsg });
      }
      throw new Error(errorMsg);
    }
    
    // 创建审批记录和待办事项
    const approvalRecords = [];
    const todos = [];
    const { title: defaultTodoTitle, description: defaultTodoDescription } = buildApprovalTitle(moduleType, moduleData);
    
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      let approverIds = [];
      
      // 根据步骤配置获取审批人
      if (step.type === 'role') {
        const users = await User.find({ role: step.value, status: 'active' });
        approverIds = users.map(u => u.id).filter(Boolean);
      } else if (step.type === 'user') {
        // 支持用户ID数组或用户名数组
        const userIds = Array.isArray(step.value) ? step.value : [step.value];
        approverIds = [];
        for (const userIdOrName of userIds) {
          // 如果是数字，直接作为ID
          if (typeof userIdOrName === 'number' || /^\d+$/.test(userIdOrName)) {
            approverIds.push(parseInt(userIdOrName));
          } else {
            // 如果是字符串，按用户名查找
            const user = await User.findOne({ name: userIdOrName, status: 'active' });
            if (user) {
              approverIds.push(user.id);
            }
          }
        }
      }
      
      if (approverIds.length === 0) {
        console.warn(`审批步骤 ${i} 未找到审批人`);
        continue;
      }
      
      // 为每个审批人创建审批记录
      for (const approverId of approverIds) {
        const record = await ApprovalRecord.create({
          workflowId: workflow.id,
          moduleType,
          moduleId,
          stepIndex: i,
          approverId,
          action: 'pending'
        });
        approvalRecords.push(record);
        
        // 创建待办事项（只创建第一步的待办）
        if (i === 0) {
          const todo = await Todo.create({
            type: 'approval',
            moduleType,
            moduleId,
            title: defaultTodoTitle,
            description: defaultTodoDescription,
            assigneeId: approverId,
            status: 'pending',
            priority: step.priority || 'medium',
            metadata: {
              workflowId: workflow.id,
              stepIndex: i,
              recordId: record.id
            },
            createdBy: req.user.id
          });
          todos.push(todo);
        }
      }
    }
    
    // 更新模块状态为待审批
    await updateModuleStatus(moduleType, moduleId, 'pending');
    
    const result = {
      success: true,
      data: {
        workflow,
        records: approvalRecords,
        todos
      },
      message: '审批流程已启动'
    };
    
    if (res && res.json) {
      res.json(result);
    }
    return result;
  } catch (error) {
    // 即使出错，也检查流程实例是否已创建，如果已创建则更新状态
    try {
      const { pool } = require('../config/database');
      const connection = await pool.getConnection();
      try {
        const [instances] = await connection.execute(
          `SELECT * FROM workflow_instances 
           WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND status = 'running'
           ORDER BY createdAt DESC LIMIT 1`,
          [moduleType, moduleTypeMap[moduleType] || moduleType, moduleId]
        );
        if (instances.length > 0) {
          // 流程已经启动，更新状态并返回成功
          console.log('[最终检查] 流程实例已存在，更新状态为pending');
          await updateModuleStatus(moduleType, moduleId, 'pending');
          if (res && res.json) {
            return res.json({
              success: true,
              data: { instanceId: instances[0].id },
              message: '审批流程已启动'
            });
          }
          return { success: true, data: { instanceId: instances[0].id } };
        }
      } finally {
        connection.release();
      }
    } catch (finalCheckError) {
      console.error('[最终检查] 检查流程实例失败:', finalCheckError);
    }
    
    const errorResult = { success: false, message: error.message };
    if (res && res.status) {
      res.status(500).json(errorResult);
    }
    throw error;
  }
};

// 审批操作（兼容新旧两套系统）
exports.approve = async (req, res) => {
  try {
    console.log('[审批操作] 收到请求:', {
      method: req.method,
      url: req.url,
      params: req.params,
      body: req.body
    });
    
    let { moduleType, moduleId } = req.params;
    const { action, comment, recordId, taskId, returnToNodeKey, transferToUserId } = req.body; // action: 'approve', 'reject', 'return', 'transfer'
    
    console.log('[审批操作] 解析后的参数:', { moduleType, moduleId, action, taskId, returnToNodeKey });
    
    // 模块类型映射：将复数形式转换为单数形式（用于查询）
    const moduleTypeMap = {
      'contracts': 'contract',
      'opportunities': 'opportunity',
      'customers': 'customer',
      'expenses': 'expense',
      'payments': 'payment',
      'invoices': 'invoice',
      'quotations': 'quotation',
      'leads': 'lead',
      'projects': 'project',
    };
    const normalizedModuleType = moduleTypeMap[moduleType] || moduleType;
    
    // 优先尝试使用新流程引擎
    if (taskId) {
      try {
        const workflowEngine = require('../services/workflowEngine');
        const options = {};
        if (returnToNodeKey) {
          options.returnToNodeKey = returnToNodeKey;
        }
        if (transferToUserId) {
          options.transferToUserId = transferToUserId;
        }
        // 传递moduleType和moduleId，用于备用查找
        options.moduleType = moduleType;
        options.moduleId = moduleId;
        const result = await workflowEngine.handleTask(taskId, req.user.id, action, comment || '', options);
        
        const actionMessages = {
          'approve': '审批通过',
          'reject': '审批已拒绝',
          'return': '已退回',
          'transfer': '已转办',
        };
        
        return res.json({
          success: true,
          message: actionMessages[action] || '操作成功',
          data: result
        });
      } catch (workflowError) {
        console.warn('新流程引擎审批失败，尝试使用旧审批系统:', workflowError.message);
        console.error('详细错误:', workflowError);
      }
    }
    
    // 如果没有taskId，尝试从待办事项中查找
    if (!taskId) {
      const { pool } = require('../config/database');
      const connection = await pool.getConnection();
      try {
        // 查找新流程引擎的待办任务
        // 先查找待办事项（同时支持单数和复数形式）
        const [todos] = await connection.execute(
          `SELECT * FROM todos 
           WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND assigneeId = ? 
           AND type = 'approval' AND status = 'pending'
           LIMIT 1`,
          [moduleType, normalizedModuleType, moduleId, req.user.id]
        );
        
        if (todos.length > 0) {
          const todo = todos[0];
          const metadata = typeof todo.metadata === 'string' ? JSON.parse(todo.metadata) : todo.metadata;
          
          // 如果有taskId，直接使用
          if (metadata && metadata.taskId) {
            try {
              const workflowEngine = require('../services/workflowEngine');
              const options = {};
              if (returnToNodeKey) {
                options.returnToNodeKey = returnToNodeKey;
              }
              if (transferToUserId) {
                options.transferToUserId = transferToUserId;
              }
              const result = await workflowEngine.handleTask(metadata.taskId, req.user.id, action, comment || '', options);
              
              connection.release();
              const actionMessages = {
                'approve': '审批通过',
                'reject': '审批已拒绝',
                'return': '已退回',
                'transfer': '已转办',
              };
              return res.json({
                success: true,
                message: actionMessages[action] || '操作成功',
                data: result
              });
            } catch (workflowError) {
              console.warn('通过taskId处理任务失败:', workflowError.message);
              console.error('详细错误:', workflowError);
              connection.release();
              return res.status(500).json({
                success: false,
                message: `处理审批任务失败: ${workflowError.message}`
              });
            }
          }
          
          // 如果没有taskId，尝试通过workflowInstanceId查找
          if (metadata && metadata.workflowInstanceId) {
            try {
              const [tasks] = await connection.execute(
                `SELECT wt.id FROM workflow_tasks wt
                 INNER JOIN workflow_node_instances wni ON wt.nodeInstanceId = wni.id
                 WHERE wt.instanceId = ? AND wt.assigneeId = ? AND wt.status = 'pending'
                 LIMIT 1`,
                [metadata.workflowInstanceId, req.user.id]
              );
              
              if (tasks.length > 0) {
                const workflowEngine = require('../services/workflowEngine');
                const options = {};
                if (returnToNodeKey) {
                  options.returnToNodeKey = returnToNodeKey;
                }
                if (transferToUserId) {
                  options.transferToUserId = transferToUserId;
                }
                const result = await workflowEngine.handleTask(tasks[0].id, req.user.id, action, comment || '', options);
                
                connection.release();
                const actionMessages = {
                  'approve': '审批通过',
                  'reject': '审批已拒绝',
                  'return': '已退回',
                  'transfer': '已转办',
                };
                return res.json({
                  success: true,
                  message: actionMessages[action] || '操作成功',
                  data: result
                });
              } else {
                // 没有找到待处理的任务
                connection.release();
                return res.status(404).json({
                  success: false,
                  message: '未找到待处理的审批任务，可能已被处理或已过期'
                });
              }
            } catch (workflowError) {
              console.warn('通过workflowInstanceId查找任务失败:', workflowError.message);
              console.error('详细错误:', workflowError);
              connection.release();
              return res.status(500).json({
                success: false,
                message: `查找审批任务失败: ${workflowError.message}`
              });
            }
          }
          
          // 如果待办事项存在但没有taskId和workflowInstanceId，返回错误
          connection.release();
          return res.status(400).json({
            success: false,
            message: '待办事项缺少必要的审批任务信息'
          });
        } else {
          // 没有找到待办事项，检查是否有运行中的流程实例
          const [instances] = await connection.execute(
            `SELECT * FROM workflow_instances 
             WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND status = 'running'
             ORDER BY createdAt DESC LIMIT 1`,
            [moduleType, normalizedModuleType, moduleId]
          );
          
          if (instances.length > 0) {
            // 有流程实例但没有待办事项，可能是权限问题或任务已被处理
            connection.release();
            return res.status(403).json({
              success: false,
              message: '未找到待处理的审批任务，可能您没有权限审批此记录或任务已被处理'
            });
          }
          
          // 没有流程实例，对于新模块类型（如invoice），直接返回错误
          // 旧审批系统只支持 contract 和 opportunity
          const supportedOldModules = ['contract', 'contracts', 'opportunity', 'opportunities'];
          if (!supportedOldModules.includes(moduleType) && !supportedOldModules.includes(normalizedModuleType)) {
            connection.release();
            return res.status(404).json({
              success: false,
              message: '未找到审批流程，请确认已配置审批流程且流程已启动'
            });
          }
          
          // 对于支持的模块类型，继续尝试旧系统
          connection.release();
        }
      } finally {
        if (connection && connection.release) {
          connection.release();
        }
      }
    }
    
    // 使用旧的审批系统（仅对支持的模块类型）
    const supportedOldModules = ['contract', 'contracts', 'opportunity', 'opportunities'];
    if (!supportedOldModules.includes(moduleType) && !supportedOldModules.includes(normalizedModuleType)) {
      return res.status(404).json({
        success: false,
        message: '未找到审批流程，请确认已配置审批流程且流程已启动'
      });
    }
    // 查找审批记录（同时支持单数和复数形式）
    let record = null;
    try {
      if (recordId) {
        record = await ApprovalRecord.findById(recordId);
      } else {
        // 如果没有指定recordId，查找当前用户的待审批记录
        const records1 = await ApprovalRecord.find({
          moduleType: normalizedModuleType,
          moduleId,
          approverId: req.user.id,
          action: 'pending'
        });
        const records2 = await ApprovalRecord.find({
          moduleType: moduleType,
          moduleId,
          approverId: req.user.id,
          action: 'pending'
        });
        record = records1[0] || records2[0];
      }
    } catch (recordError) {
      console.error('查找审批记录失败:', recordError);
      return res.status(500).json({ 
        success: false, 
        message: `查找审批记录失败: ${recordError.message}` 
      });
    }
    
    if (!record) {
      console.warn(`未找到审批记录: moduleType=${moduleType}, moduleId=${moduleId}, userId=${req.user.id}`);
      return res.status(404).json({ 
        success: false, 
        message: '审批记录不存在，请确认您有权限审批此记录' 
      });
    }
    
    if (record.approverId !== req.user.id) {
      return res.status(403).json({ success: false, message: '无权审批此记录' });
    }
    
    // 更新审批记录
    await ApprovalRecord.findByIdAndUpdate(record.id, {
      action: action,
      comment: comment || '',
      approvedAt: new Date()
    });
    
    // 更新待办状态
    const todos = await Todo.find({
      moduleType,
      moduleId,
      assigneeId: req.user.id,
      type: 'approval',
      status: 'pending'
    });
    for (const todo of todos) {
      await Todo.findByIdAndUpdate(todo.id, {
        status: 'completed',
        completedAt: new Date(),
        metadata: {
          ...(todo.metadata || {}),
          action,
          comment: comment || ''
        }
      });
    }
    
    // 检查是否所有步骤都已完成
    const workflow = await ApprovalWorkflow.findById(record.workflowId);
    if (workflow) {
      if (action === 'reject') {
        // 如果拒绝，更新模块状态为草稿
        await updateModuleStatus(moduleType, moduleId, 'draft');
      } else {
        // 检查当前步骤的所有记录是否都已完成
        const currentStepRecords = await ApprovalRecord.find({ 
          moduleType, 
          moduleId, 
          stepIndex: record.stepIndex 
        });
        const currentStepPending = currentStepRecords.filter(r => r.action === 'pending');
        
        // 如果当前步骤的所有记录都已完成，进入下一步
        if (currentStepPending.length === 0) {
          const nextStepIndex = record.stepIndex + 1;
          if (nextStepIndex < workflow.steps.length) {
            // 创建下一步的审批记录和待办
            const nextStep = workflow.steps[nextStepIndex];
            let approverIds = [];
            
            if (nextStep.type === 'role') {
              const users = await User.find({ role: nextStep.value, status: 'active' });
              approverIds = users.map(u => u.id).filter(Boolean);
            } else if (nextStep.type === 'user') {
              // 支持用户ID数组或用户名数组
              const userIds = Array.isArray(nextStep.value) ? nextStep.value : [nextStep.value];
              approverIds = [];
              for (const userIdOrName of userIds) {
                // 如果是数字，直接作为ID
                if (typeof userIdOrName === 'number' || /^\d+$/.test(userIdOrName)) {
                  approverIds.push(parseInt(userIdOrName));
                } else {
                  // 如果是字符串，按用户名查找
                  const user = await User.findOne({ name: userIdOrName, status: 'active' });
                  if (user) {
                    approverIds.push(user.id);
                  }
                }
              }
            }
            
            if (approverIds.length > 0) {
              // 获取模块数据
              let moduleData = null;
              if (moduleType === 'contract') {
                moduleData = await Contract.findById(moduleId);
              } else if (moduleType === 'opportunity') {
                moduleData = await Opportunity.findById(moduleId);
              } else if (moduleType === 'invoice') {
                moduleData = await Invoice.findById(moduleId);
              }
              const { title: nextTodoTitle, description: nextTodoDescription } = buildApprovalTitle(moduleType, moduleData || {});
              
              for (const approverId of approverIds) {
                const nextRecord = await ApprovalRecord.create({
                  workflowId: workflow.id,
                  moduleType,
                  moduleId,
                  stepIndex: nextStepIndex,
                  approverId,
                  action: 'pending'
                });
                
                await Todo.create({
                  type: 'approval',
                  moduleType,
                  moduleId,
                  title: nextTodoTitle,
                  description: nextTodoDescription,
                  assigneeId: approverId,
                  status: 'pending',
                  priority: nextStep.priority || 'medium',
                  metadata: {
                    workflowId: workflow.id,
                    stepIndex: nextStepIndex,
                    recordId: nextRecord.id
                  },
                  createdBy: req.user.id
                });
              }
            }
          } else {
            // 所有步骤都已完成，更新模块状态为已批准
            await updateModuleStatus(moduleType, moduleId, 'approved');
          }
        }
      }
    }
    
    res.json({
      success: true,
      message: action === 'approve' ? '审批通过' : '审批已拒绝'
    });
  } catch (error) {
    console.error('审批操作失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: error.message || '审批操作失败，请稍后重试',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// 撤回流程（只有提交人可以撤回）
exports.withdrawApproval = async (req, res) => {
  try {
    const { moduleType, moduleId } = req.params;
    const { comment } = req.body;
    
    // 模块类型映射：将复数形式转换为单数形式（用于查询）
    const moduleTypeMap = {
      'contracts': 'contract',
      'opportunities': 'opportunity',
      'customers': 'customer',
      'expenses': 'expense',
      'payments': 'payment',
      'invoices': 'invoice',
      'quotations': 'quotation',
      'leads': 'lead',
      'projects': 'project',
    };
    const normalizedModuleType = moduleTypeMap[moduleType] || moduleType;
    
    const { pool } = require('../config/database');
    const connection = await pool.getConnection();
    try {
      // 查找流程实例
      const [instances] = await connection.execute(
        `SELECT * FROM workflow_instances 
         WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND status = 'running'
         ORDER BY createdAt DESC LIMIT 1`,
        [moduleType, normalizedModuleType, moduleId]
      );
      
      if (instances.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: '未找到运行中的流程实例' 
        });
      }
      
      const instance = instances[0];
      
      // 检查是否是提交人
      if (instance.initiatorId !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          message: '只有流程提交人可以撤回流程' 
        });
      }
      
      // 调用流程引擎的撤回方法
      const workflowEngine = require('../services/workflowEngine');
      const result = await workflowEngine.withdrawWorkflow(instance.id, req.user.id, comment || '');
      
      res.json({
        success: true,
        message: '流程已撤回',
        data: result
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('撤回流程失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '撤回流程失败，请稍后重试' 
    });
  }
};

// 获取审批记录（兼容新旧两套系统）
exports.getApprovalRecords = async (req, res) => {
  try {
    const { moduleType, moduleId } = req.params;
    const { pool } = require('../config/database');
    const connection = await pool.getConnection();
    
    // 模块类型映射：前端使用的单数形式 -> 数据库表名（复数形式）
    const moduleTypeMap = {
      'contract': 'contracts',
      'opportunity': 'opportunities',
      'customer': 'customers',
      'expense': 'expenses',
      'payment': 'payments',
      'invoice': 'invoices',
      'quotation': 'quotations',
      'lead': 'leads',
      'project': 'projects',
    };
    const tableName = moduleTypeMap[moduleType] || moduleType;
    
    try {
      // 1. 获取旧的审批记录（approval_records表）
      // 同时查询单数和复数形式
      const oldRecords1 = await ApprovalRecord.find({ moduleType, moduleId });
      const oldRecords2 = await ApprovalRecord.find({ moduleType: tableName, moduleId });
      const oldRecords = [...oldRecords1, ...oldRecords2];
      
      const oldRecordsWithApprover = await Promise.all(oldRecords.map(async (record) => {
        const approver = await User.findById(record.approverId);
        return {
          id: record.id,
          type: 'old',
          approverId: record.approverId,
          approver: approver ? { id: approver.id, name: approver.name, email: approver.email } : null,
          action: record.action,
          comment: record.comment,
          approvedAt: record.approvedAt,
          createdAt: record.createdAt,
          stepIndex: record.stepIndex,
        };
      }));

      // 2. 获取新的流程引擎审批记录（workflow_tasks和workflow_history表）
      // 查找流程实例（同时支持单数和复数形式），包括发起人信息
      const [instances] = await connection.execute(
        `SELECT id, moduleType, status, initiatorId, workflowId, startTime, endTime 
         FROM workflow_instances 
         WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? 
         ORDER BY createdAt DESC`,
        [moduleType, tableName, moduleId]
      );
      
      console.log(`[审批记录查询] moduleType=${moduleType}, moduleId=${moduleId}, 找到 ${instances.length} 个流程实例`);

      const newRecords = [];
      if (instances.length > 0) {
        const instanceIds = instances.map(i => i.id);
        console.log(`[审批记录查询] 流程实例ID: ${instanceIds.join(', ')}`);
        
        // 获取流程实例的发起人信息
        const instanceInitiators = {};
        for (const inst of instances) {
          if (inst.initiatorId) {
            const initiator = await User.findById(inst.initiatorId);
            instanceInitiators[inst.id] = initiator ? { id: initiator.id, name: initiator.name, email: initiator.email } : null;
          }
        }
        
        // 获取所有审批任务
        const placeholders = instanceIds.map(() => '?').join(',');
        const [tasks] = await connection.execute(
          `SELECT t.*, n.name as nodeName, n.config as nodeConfig, n.nodeKey as nodeKey
           FROM workflow_tasks t
           LEFT JOIN workflow_nodes n ON t.nodeId = n.id
           WHERE t.instanceId IN (${placeholders})
           ORDER BY t.createdAt ASC`,
          instanceIds
        );
        console.log(`[审批记录查询] 找到 ${tasks.length} 个审批任务`);

        // 获取完整的流程历史记录（包括所有操作：start, complete, reject, return, withdraw, cancel等）
        const [history] = await connection.execute(
          `SELECT h.*, 
                  n.name as nodeName,
                  n.nodeType as nodeType,
                  n.config as nodeConfig,
                  n.nodeKey as nodeKey
           FROM workflow_history h
           LEFT JOIN workflow_nodes n ON h.toNodeKey = n.nodeKey OR h.fromNodeKey = n.nodeKey
           WHERE h.instanceId IN (${placeholders})
           ORDER BY h.createdAt ASC`,
          instanceIds
        );
        console.log(`[审批记录查询] 找到 ${history.length} 条流程历史记录`);
        
        // 处理历史记录，包括条件判断信息
        for (const hist of history) {
          const operator = await User.findById(hist.operatorId);
          // 获取流程实例的发起人信息
          const initiator = instanceInitiators[hist.instanceId] || null;
          
          // 根据action类型设置显示文本
          let actionText = '';
          let actionType = hist.action;
          switch (hist.action) {
            case 'start':
              actionText = '流程开始';
              actionType = 'start';
              break;
            case 'complete':
              actionText = '审批通过';
              actionType = 'approve';
              break;
            case 'reject':
              actionText = '审批拒绝';
              actionType = 'reject';
              break;
            case 'return':
              actionText = '退回';
              actionType = 'return';
              break;
            case 'withdraw':
              actionText = '撤回流程';
              actionType = 'withdraw';
              break;
            case 'transfer':
              actionText = '转办';
              actionType = 'transfer';
              break;
            default:
              actionText = hist.action;
          }
          
          let historyRecord = {
            id: `history_${hist.id}`,
            type: 'history',
            action: actionType,
            actionText: actionText,
            operatorId: hist.operatorId,
            operator: operator ? { id: operator.id, name: operator.name, email: operator.email } : null,
            operatorName: hist.operatorName || (operator ? operator.name : '未知'),
            initiator: initiator, // 发起人信息
            comment: hist.comment,
            nodeName: hist.nodeName,
            nodeType: hist.nodeType,
            nodeKey: hist.nodeKey,
            fromNodeKey: hist.fromNodeKey,
            toNodeKey: hist.toNodeKey,
            createdAt: hist.createdAt,
            // 条件判断信息
            conditionInfo: null
          };
          
          // 如果是条件节点，解析条件配置
          if (hist.nodeType === 'condition' && hist.nodeConfig) {
            try {
              const nodeConfig = typeof hist.nodeConfig === 'string' ? JSON.parse(hist.nodeConfig) : hist.nodeConfig;
              if (nodeConfig.conditionField) {
                historyRecord.conditionInfo = {
                  field: nodeConfig.conditionField,
                  operator: nodeConfig.conditionOperator,
                  value: nodeConfig.conditionValue,
                  value1: nodeConfig.conditionValue1,
                  value2: nodeConfig.conditionValue2
                };
              }
            } catch (e) {
              console.error('解析节点配置失败:', e);
            }
          }
          
          newRecords.push(historyRecord);
        }

        // 处理任务（待审批的和已完成的）
        for (const task of tasks) {
          const approver = await User.findById(task.assigneeId);
          // 只显示审批类型的任务
          if (task.taskType === 'approval') {
            // 检查是否已有对应的历史记录
            const hasHistory = history.some(h => h.taskId === task.id && ['complete', 'reject', 'return'].includes(h.action));
            // 如果是待审批任务，或者没有对应的历史记录，才添加
            if (task.status === 'pending' || !hasHistory) {
              // 获取流程实例的发起人信息
              const initiator = instanceInitiators[task.instanceId] || null;
              
              // 根据任务状态设置显示文本
              let actionText = '';
              let actionType = 'pending';
              if (task.status === 'approved' || task.status === 'completed') {
                actionText = '审批通过';
                actionType = 'approve';
              } else if (task.status === 'rejected') {
                actionText = '审批拒绝';
                actionType = 'reject';
              } else if (task.status === 'cancelled') {
                actionText = '已取消';
                actionType = 'cancel';
              } else {
                actionText = '待审批';
                actionType = 'pending';
              }
              
              newRecords.push({
                id: `task_${task.id}`,
                type: 'task',
                taskId: task.id,
                instanceId: task.instanceId,
                nodeName: task.nodeName || '审批节点',
                nodeKey: task.nodeKey,
                approverId: task.assigneeId,
                approver: approver ? { id: approver.id, name: approver.name, email: approver.email } : null,
                initiator: initiator, // 发起人信息
                action: actionType,
                actionText: actionText,
                comment: task.comment || null,
                approvedAt: task.approvedAt || null,
                createdAt: task.createdAt,
                status: task.status,
                dueTime: task.dueTime,
              });
            }
          }
        }
      }

      // 合并新旧记录，按时间排序
      const allRecords = [...oldRecordsWithApprover, ...newRecords].sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeA - timeB;
      });

      // 获取当前待审批的任务（用于显示"当前审批人"）
      const pendingTasks = newRecords.filter(r => r.action === 'pending' && r.status === 'pending');
      const currentApprovers = pendingTasks.map(t => t.approver).filter(Boolean);

      // 获取流程实例状态（用于判断是否可以撤回）
      let workflowStatus = null; // 'running', 'completed', 'rejected', 'withdrawn'
      let canWithdraw = false;
      if (instances.length > 0) {
        // 取最新的实例状态
        const latestInstance = instances[instances.length - 1];
        workflowStatus = latestInstance.status;
        // 只有运行中的流程才能撤回
        canWithdraw = workflowStatus === 'running';
      }

      console.log(`[审批记录查询] 总计: 旧记录 ${oldRecordsWithApprover.length} 条, 新记录 ${newRecords.length} 条, 待审批 ${pendingTasks.length} 条, 流程状态: ${workflowStatus}`);

      res.json({
        success: true,
        data: allRecords,
        currentApprovers: currentApprovers, // 当前待审批人列表
        pendingCount: pendingTasks.length, // 待审批任务数
        workflowStatus: workflowStatus, // 流程状态
        canWithdraw: canWithdraw, // 是否可以撤回
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

