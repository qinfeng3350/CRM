const WorkflowDefinition = require('../models/WorkflowDefinition');
const WorkflowNode = require('../models/WorkflowNode');
const WorkflowRoute = require('../models/WorkflowRoute');
const WorkflowInstance = require('../models/WorkflowInstance');
const workflowEngine = require('../services/workflowEngine');
const Contract = require('../models/Contract');
const Opportunity = require('../models/Opportunity');
const User = require('../models/User');
const { pool } = require('../config/database');

// 获取流程定义列表
exports.getWorkflowDefinitions = async (req, res) => {
  try {
    const { moduleType, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (moduleType) query.moduleType = moduleType;
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const workflows = await WorkflowDefinition.find(query);
    
    // 获取每个流程的节点和路由
    const workflowsWithDetails = await Promise.all(workflows.map(async (workflow) => {
      const nodes = await WorkflowNode.findByWorkflowId(workflow.id);
      const routes = await WorkflowRoute.findByWorkflowId(workflow.id);
      
      // 创建节点ID到节点key的映射
      const nodeIdToKeyMap = new Map(nodes.map(n => [n.id, n.nodeKey]));
      
      // 将路由的fromNodeId和toNodeId转换为fromNodeKey和toNodeKey
      const routesWithKeys = routes.map(route => ({
        ...route,
        fromNodeKey: nodeIdToKeyMap.get(route.fromNodeId) || null,
        toNodeKey: nodeIdToKeyMap.get(route.toNodeId) || null,
      }));
      
      return {
        ...workflow,
        nodes,
        routes: routesWithKeys
      };
    }));
    
    res.json({
      success: true,
      data: workflowsWithDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: workflows.length,
        pages: Math.ceil(workflows.length / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个流程定义（包含节点和路由）
exports.getWorkflowDefinition = async (req, res) => {
  try {
    const workflow = await WorkflowDefinition.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ success: false, message: '流程定义不存在' });
    }
    
    const nodes = await WorkflowNode.findByWorkflowId(workflow.id);
    const routes = await WorkflowRoute.findByWorkflowId(workflow.id);
    
    // 创建节点ID到节点key的映射
    const nodeIdToKeyMap = new Map(nodes.map(n => [n.id, n.nodeKey]));
    
    // 将路由的fromNodeId和toNodeId转换为fromNodeKey和toNodeKey
    const routesWithKeys = routes.map(route => ({
      ...route,
      fromNodeKey: nodeIdToKeyMap.get(route.fromNodeId) || null,
      toNodeKey: nodeIdToKeyMap.get(route.toNodeId) || null,
    }));
    
    res.json({
      success: true,
      data: {
        ...workflow,
        nodes,
        routes: routesWithKeys
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建流程定义（包含节点和路由）
exports.createWorkflowDefinition = async (req, res) => {
  try {
    const { name, code, moduleType, description, nodes = [], routes = [] } = req.body;
    
    if (!name || !code || !moduleType) {
      return res.status(400).json({ success: false, message: '流程名称、编码和模块类型为必填项' });
    }
    
    // 检查编码是否已存在
    const existing = await WorkflowDefinition.findByCode(code);
    if (existing) {
      return res.status(400).json({ success: false, message: '流程编码已存在' });
    }
    
    // 创建流程定义
    const workflow = await WorkflowDefinition.create({
      name,
      code,
      moduleType,
      description,
      createdBy: req.user.id
    });
    
    // 创建节点
    const createdNodes = [];
    for (const nodeData of nodes) {
      const node = await WorkflowNode.create({
        ...nodeData,
        workflowId: workflow.id
      });
      createdNodes.push(node);
    }
    
    // 设置开始节点
    const startNode = createdNodes.find(n => n.nodeType === 'start');
    if (startNode) {
      await WorkflowDefinition.findByIdAndUpdate(workflow.id, { startNodeId: startNode.id });
    }
    
    // 创建路由（需要将节点key转换为ID）
    const nodeMap = new Map(createdNodes.map(n => [n.nodeKey, n.id]));
    for (const routeData of routes) {
      const fromNode = createdNodes.find(n => n.nodeKey === routeData.fromNodeKey);
      const toNode = createdNodes.find(n => n.nodeKey === routeData.toNodeKey);
      
      if (fromNode && toNode) {
        await WorkflowRoute.create({
          workflowId: workflow.id,
          fromNodeId: fromNode.id,
          toNodeId: toNode.id,
          conditionType: routeData.conditionType || 'always',
          conditionConfig: routeData.conditionConfig || {},
          sortOrder: routeData.sortOrder || 0
        });
      }
    }
    
    res.status(201).json({
      success: true,
      data: {
        ...workflow,
        nodes: createdNodes,
        routes: await WorkflowRoute.findByWorkflowId(workflow.id)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新流程定义
exports.updateWorkflowDefinition = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive, nodes, routes } = req.body;
    
    const workflow = await WorkflowDefinition.findById(id);
    if (!workflow) {
      return res.status(404).json({ success: false, message: '流程定义不存在' });
    }
    
    // 更新流程基本信息
    if (name !== undefined || description !== undefined || isActive !== undefined) {
      await WorkflowDefinition.findByIdAndUpdate(id, {
        name,
        description,
        isActive
      });
    }
    
    // 如果提供了节点和路由，更新它们
    if (nodes && Array.isArray(nodes)) {
      const { pool } = require('../config/database');
      const connection = await pool.getConnection();
      
      try {
        await connection.beginTransaction();
        
        // 检查是否有正在运行的实例（只检查数量，不查询详细信息）
        const [existingInstances] = await connection.execute(
          'SELECT COUNT(*) as count FROM workflow_instances WHERE workflowId = ? AND status = "running"',
          [id]
        );
        
        // 检查是否有已完成的实例（用于提示）
        const [completedInstances] = await connection.execute(
          'SELECT COUNT(*) as count FROM workflow_instances WHERE workflowId = ? AND status IN ("completed", "rejected", "withdrawn")',
          [id]
        );
        
        const hasRunningInstances = existingInstances[0].count > 0;
        const hasCompletedInstances = completedInstances[0].count > 0;
        
        // 如果有正在运行的实例，采用保守策略：只更新节点配置，不删除节点
        // 这样可以避免影响正在运行的流程实例
        if (hasRunningInstances) {
          console.log(`[updateWorkflowDefinition] ⚠️  检测到 ${existingInstances[0].count} 个正在运行的流程实例，采用保守更新策略`);
          const existingNodes = await WorkflowNode.findByWorkflowId(id);
          const nodeKeyMap = new Map(existingNodes.map(n => [n.nodeKey, n]));
          
          // 批量更新或创建节点
          const createdNodes = [];
          const nodeUpdates = [];
          const nodeInserts = [];
          
          for (const nodeData of nodes) {
            const existingNode = nodeKeyMap.get(nodeData.nodeKey);
            if (existingNode) {
              // 准备更新语句
              nodeUpdates.push({
                id: existingNode.id,
                data: {
                  name: nodeData.name,
                  description: nodeData.description,
                  position: nodeData.position,
                  config: nodeData.config,
                  sortOrder: nodeData.sortOrder
                }
              });
              // 先添加到结果列表（稍后会重新查询）
              createdNodes.push({ ...existingNode, ...nodeData });
            } else {
              // 准备插入数据
              nodeInserts.push({
                ...nodeData,
                workflowId: id
              });
            }
          }
          
          // 批量更新节点
          for (const update of nodeUpdates) {
            await WorkflowNode.findByIdAndUpdate(update.id, update.data);
          }
          
          // 批量创建新节点
          for (const insertData of nodeInserts) {
            const node = await WorkflowNode.create(insertData);
            createdNodes.push(node);
          }
          
          // 重新查询所有节点（包括更新的）
          const allNodes = await WorkflowNode.findByWorkflowId(id);
          const finalNodeMap = new Map(allNodes.map(n => [n.nodeKey, n]));
          const finalNodes = nodes.map(n => finalNodeMap.get(n.nodeKey)).filter(Boolean);
          
          // 删除旧路由并创建新路由
          await WorkflowRoute.deleteByWorkflowId(id);
          
          // 批量创建新路由
          for (const routeData of routes || []) {
            const fromNode = finalNodes.find(n => n.nodeKey === routeData.fromNodeKey);
            const toNode = finalNodes.find(n => n.nodeKey === routeData.toNodeKey);
            
            if (fromNode && toNode) {
              await WorkflowRoute.create({
                workflowId: id,
                fromNodeId: fromNode.id,
                toNodeId: toNode.id,
                conditionType: routeData.conditionType || 'always',
                conditionConfig: routeData.conditionConfig || {},
                sortOrder: routeData.sortOrder || 0
              });
            }
          }
          
          // 更新开始节点
          const startNode = finalNodes.find(n => n.nodeType === 'start');
          if (startNode) {
            await WorkflowDefinition.findByIdAndUpdate(id, { startNodeId: startNode.id });
          }
          
          await connection.commit();
        } else {
          // 没有正在运行的实例，可以安全删除所有节点（简化操作）
          // 但需要先删除或更新相关的 workflow_node_instances 记录，避免外键约束错误
          // 先查询所有相关的实例ID
          const [instances] = await connection.execute(
            'SELECT id FROM workflow_instances WHERE workflowId = ?',
            [id]
          );
          
          if (instances.length > 0) {
            const instanceIds = instances.map(i => i.id);
            // 删除所有相关的 workflow_node_instances（使用直接 SQL，避免外键约束）
            await connection.execute(
              `DELETE FROM workflow_node_instances WHERE instanceId IN (${instanceIds.map(() => '?').join(',')})`,
              instanceIds
            );
          }
          
          // 先删除路由（因为路由引用节点，必须先删除路由）
          // 传入连接，在同一个事务中执行
          await WorkflowRoute.deleteByWorkflowId(id, connection);
          // 然后删除节点（传入连接，在同一个事务中）
          await WorkflowNode.deleteByWorkflowId(id, connection);
          
          // 批量创建新节点
          const createdNodes = [];
          for (const nodeData of nodes) {
            const node = await WorkflowNode.create({
              ...nodeData,
              workflowId: id
            });
            createdNodes.push(node);
          }
          
          // 批量创建新路由
          for (const routeData of routes || []) {
            const fromNode = createdNodes.find(n => n.nodeKey === routeData.fromNodeKey);
            const toNode = createdNodes.find(n => n.nodeKey === routeData.toNodeKey);
            
            if (fromNode && toNode) {
              await WorkflowRoute.create({
                workflowId: id,
                fromNodeId: fromNode.id,
                toNodeId: toNode.id,
                conditionType: routeData.conditionType || 'always',
                conditionConfig: routeData.conditionConfig || {},
                sortOrder: routeData.sortOrder || 0
              });
            }
          }
          
          // 更新开始节点
          const startNode = createdNodes.find(n => n.nodeType === 'start');
          if (startNode) {
            await WorkflowDefinition.findByIdAndUpdate(id, { startNodeId: startNode.id });
          }
          
          // 提交事务（所有操作完成后统一提交）
          await connection.commit();
        }
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    
    const updated = await WorkflowDefinition.findById(id);
    const nodesList = await WorkflowNode.findByWorkflowId(id);
    const routesList = await WorkflowRoute.findByWorkflowId(id);
    
    // 创建节点ID到节点key的映射
    const nodeIdToKeyMap = new Map(nodesList.map(n => [n.id, n.nodeKey]));
    
    // 将路由的fromNodeId和toNodeId转换为fromNodeKey和toNodeKey
    const routesWithKeys = routesList.map(route => ({
      ...route,
      fromNodeKey: nodeIdToKeyMap.get(route.fromNodeId) || null,
      toNodeKey: nodeIdToKeyMap.get(route.toNodeId) || null,
    }));
    
    // 再次检查实例状态，用于返回提示信息
    const { pool: finalPool } = require('../config/database');
    const finalConnection = await finalPool.getConnection();
    try {
      const [finalRunningInstances] = await finalConnection.execute(
        'SELECT COUNT(*) as count FROM workflow_instances WHERE workflowId = ? AND status = "running"',
        [id]
      );
      const [finalCompletedInstances] = await finalConnection.execute(
        'SELECT COUNT(*) as count FROM workflow_instances WHERE workflowId = ? AND status IN ("completed", "rejected", "withdrawn")',
        [id]
      );
      
      const runningCount = finalRunningInstances[0].count;
      const completedCount = finalCompletedInstances[0].count;
      
      let message = '流程定义已更新';
      if (runningCount > 0) {
        message += `。注意：当前有 ${runningCount} 个正在运行的流程实例，它们将继续使用旧的流程定义完成，新启动的流程将使用新的流程定义。`;
      } else if (completedCount > 0) {
        message += `。注意：此流程已有 ${completedCount} 个历史实例，新启动的流程将使用新的流程定义。`;
      }
      
      res.json({
        success: true,
        message,
        data: {
          ...updated,
          nodes: nodesList,
          routes: routesWithKeys
        },
        warnings: runningCount > 0 ? {
          runningInstances: runningCount,
          message: `当前有 ${runningCount} 个正在运行的流程实例，它们将继续使用旧的流程定义完成`
        } : null
      });
    } finally {
      finalConnection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除流程定义
exports.deleteWorkflowDefinition = async (req, res) => {
  const { pool } = require('../config/database');
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const parsedId = parseInt(id);
    
    if (isNaN(parsedId)) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: '无效的流程ID' });
    }
    
    // 检查流程是否存在
    const workflow = await WorkflowDefinition.findById(parsedId);
    if (!workflow) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '流程定义不存在' });
    }
    
    // 检查是否有正在运行的流程实例（仅警告，不阻止删除）
    const [runningInstances] = await connection.execute(
      'SELECT COUNT(*) as count FROM workflow_instances WHERE workflowId = ? AND status IN ("running", "pending")',
      [parsedId]
    );
    
    if (runningInstances[0].count > 0) {
      console.warn(`警告：删除流程 ${parsedId} 时，有 ${runningInstances[0].count} 个正在运行的流程实例，将一并删除`);
    }
    
    // 获取所有相关的实例ID（用于删除关联数据）
    const [allInstances] = await connection.execute(
      'SELECT id FROM workflow_instances WHERE workflowId = ?',
      [parsedId]
    );
    const instanceIds = allInstances.map(i => i.id);
    
    if (instanceIds.length > 0) {
      // 使用 JOIN 或直接删除，避免子查询可能的问题
      const placeholders = instanceIds.map(() => '?').join(',');
      
      // 1. 删除审批任务
      await connection.execute(
        `DELETE FROM workflow_tasks WHERE instanceId IN (${placeholders})`,
        instanceIds
      );
      
      // 2. 删除审批历史
      await connection.execute(
        `DELETE FROM workflow_history WHERE instanceId IN (${placeholders})`,
        instanceIds
      );
      
      // 3. 删除节点实例
      await connection.execute(
        `DELETE FROM workflow_node_instances WHERE instanceId IN (${placeholders})`,
        instanceIds
      );
    }
    
    // 4. 删除流程实例
    await connection.execute('DELETE FROM workflow_instances WHERE workflowId = ?', [parsedId]);
    
    // 5. 删除路由（直接使用当前连接，避免连接冲突）
    await connection.execute('DELETE FROM workflow_routes WHERE workflowId = ?', [parsedId]);
    
    // 6. 删除节点（直接使用当前连接，避免连接冲突）
    await connection.execute('DELETE FROM workflow_nodes WHERE workflowId = ?', [parsedId]);
    
    // 7. 删除流程定义（直接使用当前连接）
    await connection.execute('DELETE FROM workflow_definitions WHERE id = ?', [parsedId]);
    
    await connection.commit();
    res.json({ success: true, message: '流程定义已删除' });
  } catch (error) {
    console.error('删除流程定义错误:', error);
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('回滚失败:', rollbackError);
    }
    res.status(500).json({ 
      success: false, 
      message: error.message || '删除流程定义失败',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    connection.release();
  }
};

// 启动流程
exports.startWorkflow = async (req, res) => {
  try {
    const { moduleType, moduleId, workflowId } = req.body;
    
    // 获取模块数据
    let moduleData = null;
    if (moduleType === 'contract') {
      moduleData = await Contract.findById(moduleId);
    } else if (moduleType === 'opportunity') {
      moduleData = await Opportunity.findById(moduleId);
    }
    
    if (!moduleData) {
      return res.status(404).json({ success: false, message: '模块数据不存在' });
    }
    
    // 查找匹配的流程
    let workflow = null;
    if (workflowId) {
      workflow = await WorkflowDefinition.findById(workflowId);
    } else {
      // 根据模块类型和条件自动匹配流程
      workflow = await WorkflowDefinition.findMatchingWorkflow(moduleType, {
        amount: moduleData.amount || 0,
        ...moduleData
      });
    }
    
    if (!workflow) {
      return res.status(400).json({
        success: false,
        message: `未找到匹配的审批流程。请先在"系统管理 > 流程配置"中创建${moduleType}类型的流程。`
      });
    }
    
    // 启动流程
    const instance = await workflowEngine.startWorkflow(
      workflow.id,
      moduleType,
      moduleId,
      req.user.id,
      moduleData
    );
    
    res.json({
      success: true,
      data: instance,
      message: '流程已启动'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 处理审批任务
exports.handleTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { action, comment, returnToNodeKey, transferToUserId } = req.body;
    
    if (!['approve', 'reject', 'return', 'transfer'].includes(action)) {
      return res.status(400).json({ success: false, message: '无效的操作类型' });
    }
    
    if (action === 'return' && !returnToNodeKey) {
      return res.status(400).json({ success: false, message: '退回操作必须指定退回节点' });
    }
    
    if (action === 'transfer' && !transferToUserId) {
      return res.status(400).json({ success: false, message: '转办操作必须指定转办用户' });
    }
    
    const result = await workflowEngine.handleTask(taskId, req.user.id, action, comment || '', {
      returnToNodeKey,
      transferToUserId
    });
    
    res.json({
      success: true,
      message: action === 'approve' ? '审批通过' : 
               action === 'reject' ? '已拒绝' :
               action === 'return' ? '已退回' : '已转办'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取流程实例
exports.getWorkflowInstances = async (req, res) => {
  try {
    const { moduleType, moduleId, status, workflowId, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (moduleType) query.moduleType = moduleType;
    if (moduleId) query.moduleId = parseInt(moduleId);
    if (status) query.status = status;
    if (workflowId) query.workflowId = parseInt(workflowId);
    
    query.limit = parseInt(limit);
    query.skip = (parseInt(page) - 1) * parseInt(limit);
    
    const instances = await WorkflowInstance.find(query);
    
    res.json({
      success: true,
      data: instances,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: instances.length,
        pages: Math.ceil(instances.length / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取流程实例详情（包含节点实例和任务）
exports.getWorkflowInstance = async (req, res) => {
  try {
    const instance = await WorkflowInstance.findById(req.params.id);
    if (!instance) {
      return res.status(404).json({ success: false, message: '流程实例不存在' });
    }
    
    const connection = await pool.getConnection();
    try {
      // 获取节点实例
      const [nodeInstances] = await connection.execute(
        'SELECT * FROM workflow_node_instances WHERE instanceId = ? ORDER BY createdAt',
        [instance.id]
      );
      
      // 获取任务
      const [tasks] = await connection.execute(
        'SELECT * FROM workflow_tasks WHERE instanceId = ? ORDER BY createdAt',
        [instance.id]
      );
      
      // 获取历史记录（包含节点信息）
      const [history] = await connection.execute(
        `SELECT h.*, 
                n.name as nodeName,
                n.nodeType as nodeType,
                n.config as nodeConfig
         FROM workflow_history h
         LEFT JOIN workflow_nodes n ON h.toNodeKey = n.nodeKey
         WHERE h.instanceId = ? 
         ORDER BY h.createdAt ASC`,
        [instance.id]
      );
      
      // 处理历史记录，解析条件判断信息
      const processedHistory = history.map(h => {
        const hist = { ...h };
        // 如果是条件节点，解析条件配置
        if (h.nodeType === 'condition' && h.nodeConfig) {
          try {
            const nodeConfig = typeof h.nodeConfig === 'string' ? JSON.parse(h.nodeConfig) : h.nodeConfig;
            if (nodeConfig.conditionField) {
              hist.conditionInfo = {
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
        return hist;
      });
      
      // 获取审批人信息
      const tasksWithApprover = await Promise.all(tasks.map(async (task) => {
        const approver = await User.findById(task.assigneeId);
        return {
          ...task,
          approver: approver ? { id: approver.id, name: approver.name, email: approver.email } : null
        };
      }));
      
      res.json({
        success: true,
        data: {
          ...instance,
          nodeInstances,
          tasks: tasksWithApprover,
          history: processedHistory
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取我的待办任务
exports.getMyTasks = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const connection = await pool.getConnection();
    try {
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const [tasks] = await connection.execute(
        `SELECT t.*, i.moduleType, i.moduleId, i.workflowCode, n.name as nodeName, n.config as nodeConfig
        FROM workflow_tasks t
        LEFT JOIN workflow_instances i ON t.instanceId = i.id
        LEFT JOIN workflow_nodes n ON t.nodeId = n.id
        WHERE t.assigneeId = ? AND t.status = ?
        ORDER BY t.createdAt DESC
        LIMIT ? OFFSET ?`,
        [req.user.id, status, parseInt(limit), offset]
      );
      
      // 解析节点配置
      const tasksWithConfig = tasks.map(task => {
        let nodeConfig = {};
        try {
          if (task.nodeConfig) {
            nodeConfig = typeof task.nodeConfig === 'string' 
              ? JSON.parse(task.nodeConfig) 
              : task.nodeConfig;
          }
        } catch (e) {
          console.error('解析节点配置失败:', e);
        }
        return {
          ...task,
          nodeConfig,
          fieldPermissions: nodeConfig.fieldPermissions || {}
        };
      });
      
      const [countRows] = await connection.execute(
        `SELECT COUNT(*) as total FROM workflow_tasks WHERE assigneeId = ? AND status = ?`,
        [req.user.id, status]
      );
      const total = countRows[0].total;
      
      res.json({
        success: true,
        data: tasksWithConfig,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取审批任务详情（包含模块数据和字段权限）
exports.getTaskDetail = async (req, res) => {
  try {
    const { taskId } = req.params;
    const connection = await pool.getConnection();
    const fieldPermissionFilter = require('../utils/fieldPermissionFilter');
    
    try {
      // 获取任务信息
      const [tasks] = await connection.execute(
        `SELECT t.*, i.moduleType, i.moduleId, i.workflowCode, i.metadata, n.config as nodeConfig
        FROM workflow_tasks t
        LEFT JOIN workflow_instances i ON t.instanceId = i.id
        LEFT JOIN workflow_nodes n ON t.nodeId = n.id
        WHERE t.id = ?`,
        [taskId]
      );
      
      if (tasks.length === 0) {
        return res.status(404).json({ success: false, message: '任务不存在' });
      }
      
      const task = tasks[0];
      
      // 检查权限
      if (task.assigneeId !== req.user.id) {
        return res.status(403).json({ success: false, message: '无权访问此任务' });
      }
      
      // 解析节点配置
      let nodeConfig = {};
      try {
        if (task.nodeConfig) {
          nodeConfig = typeof task.nodeConfig === 'string' 
            ? JSON.parse(task.nodeConfig) 
            : task.nodeConfig;
        }
      } catch (e) {
        console.error('解析节点配置失败:', e);
      }
      
      const fieldPermissions = nodeConfig.fieldPermissions || {};
      
      // 获取模块数据
      let moduleData = null;
      if (task.moduleType === 'contract') {
        const Contract = require('../models/Contract');
        moduleData = await Contract.findById(task.moduleId);
      } else if (task.moduleType === 'opportunity') {
        const Opportunity = require('../models/Opportunity');
        moduleData = await Opportunity.findById(task.moduleId);
      } else if (task.moduleType === 'expense') {
        // 费用模块
        const [expenses] = await connection.execute(
          'SELECT * FROM expenses WHERE id = ?',
          [task.moduleId]
        );
        moduleData = expenses[0] || null;
      } else if (task.moduleType === 'payment') {
        const Payment = require('../models/Payment');
        moduleData = await Payment.findById(task.moduleId);
      }
      
      // 根据字段权限过滤数据
      const filteredData = moduleData 
        ? fieldPermissionFilter.filterDataByPermissions(moduleData, fieldPermissions, 'view')
        : null;
      
      // 获取流程实例详情
      const instance = await WorkflowInstance.findById(task.instanceId);
      
      res.json({
        success: true,
        data: {
          task: {
            ...task,
            nodeConfig,
            fieldPermissions
          },
          moduleData: filteredData,
          instance,
          // 返回字段权限信息，供前端使用
          fieldPermissions
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

