const { pool } = require('../config/database');
const WorkflowDefinition = require('../models/WorkflowDefinition');
const WorkflowInstance = require('../models/WorkflowInstance');
const User = require('../models/User');
const Todo = require('../models/Todo');

class WorkflowEngine {
  /**
   * 启动流程
   */
  async startWorkflow(workflowId, moduleType, moduleId, initiatorId, moduleData = {}) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const completeDingTalkTodoIfNeeded = (metadata, assigneeId) => {
        if (!metadata || !metadata.dingTalkRecordId || !assigneeId) {
          return;
        }
        setImmediate(async () => {
          try {
            const DingTalkUser = require('../models/DingTalkUser');
            const dingTalkUser = await DingTalkUser.findByUserId(assigneeId);
            if (!dingTalkUser || !dingTalkUser.dingTalkUserId) {
              console.warn(`[handleTask] ⚠️  找不到用户 ${assigneeId} 的钉钉绑定，无法同步钉钉待办状态`);
              return;
            }
            const dingTalkService = require('../services/dingTalkService');
            await dingTalkService.completeTodo(metadata.dingTalkRecordId, dingTalkUser.dingTalkUserId);
            console.log(`[handleTask] ✅ 已同步完成钉钉待办 recordId=${metadata.dingTalkRecordId}`);
          } catch (syncError) {
            console.error(`[handleTask] ❌ 同步钉钉待办状态失败:`, syncError.message);
          }
        });
      };

      // 获取流程定义
      const workflow = await WorkflowDefinition.findById(workflowId);
      if (!workflow || !workflow.isActive) {
        throw new Error('流程不存在或未启用');
      }

      // 获取开始节点
      const [startNodes] = await connection.execute(
        'SELECT * FROM workflow_nodes WHERE workflowId = ? AND nodeType = "start" ORDER BY sortOrder LIMIT 1',
        [workflowId]
      );

      if (startNodes.length === 0) {
        throw new Error('流程没有开始节点');
      }

      const startNode = startNodes[0];

      // 直接使用当前连接创建流程实例，避免连接冲突
      const [instanceResult] = await connection.execute(
        `INSERT INTO workflow_instances 
        (workflowId, workflowCode, moduleType, moduleId, status, currentNodeId, currentNodeKey, initiatorId, metadata, startTime) 
        VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?, NOW())`,
        [
          workflow.id,
          workflow.code,
          moduleType,
          moduleId,
          startNode.id,
          startNode.nodeKey,
          initiatorId,
          JSON.stringify(moduleData || {})
        ]
      );
      
      const instanceId = instanceResult.insertId;
      
      // 获取创建的实例
      const [instances] = await connection.execute(
        'SELECT * FROM workflow_instances WHERE id = ?',
        [instanceId]
      );
      const instance = instances[0];
      if (instance && instance.metadata) {
        instance.metadata = typeof instance.metadata === 'string' ? JSON.parse(instance.metadata) : instance.metadata;
      }

      // 创建开始节点实例
      const [nodeInstanceResult] = await connection.execute(
        `INSERT INTO workflow_node_instances 
        (instanceId, nodeId, nodeKey, nodeType, status, startTime) 
        VALUES (?, ?, ?, ?, 'completed', NOW())`,
        [instance.id, startNode.id, startNode.nodeKey, startNode.nodeType]
      );

      // 记录流程历史
      await connection.execute(
        `INSERT INTO workflow_history 
        (instanceId, nodeInstanceId, action, operatorId, operatorName, fromNodeKey, toNodeKey) 
        VALUES (?, ?, 'start', ?, (SELECT name FROM users WHERE id = ?), ?, ?)`,
        [instance.id, nodeInstanceResult.insertId, initiatorId, initiatorId, null, startNode.nodeKey]
      );

      // 执行开始节点的后续节点（传入连接，避免重复获取）
      await this.executeNextNodes(instance.id, startNode.id, moduleData, connection);

      await connection.commit();
      return instance;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('回滚失败:', rollbackError);
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 执行下一个节点
   */
  async executeNextNodes(instanceId, currentNodeId, moduleData = {}, providedConnection = null) {
    const connection = providedConnection || await pool.getConnection();
    const shouldRelease = !providedConnection;
    try {
      // 获取当前节点
      const [currentNodes] = await connection.execute('SELECT * FROM workflow_nodes WHERE id = ?', [currentNodeId]);
      if (currentNodes.length === 0) return;

      const currentNode = currentNodes[0];

      // 获取所有从当前节点出发的路由
      const [routes] = await connection.execute(
        'SELECT * FROM workflow_routes WHERE fromNodeId = ? ORDER BY sortOrder',
        [currentNodeId]
      );

      if (routes.length === 0) {
        // 如果没有路由，检查是否是结束节点
        if (currentNode.nodeType === 'end') {
          await this.completeWorkflow(instanceId, connection);
        }
        return;
      }

      // 获取流程实例（使用当前连接）
      const [instances] = await connection.execute(
        'SELECT * FROM workflow_instances WHERE id = ?',
        [instanceId]
      );
      if (instances.length === 0) return;
      
      const instance = instances[0];
      if (instance.metadata) {
        instance.metadata = typeof instance.metadata === 'string' ? JSON.parse(instance.metadata) : instance.metadata;
      }

      // 评估每个路由的条件，找到匹配的路由
      const matchedRoutes = [];
      // 合并 instance.metadata 和 moduleData，确保有完整的数据用于条件判断
      const dataForEvaluation = { ...(instance.metadata || {}), ...(moduleData || {}) };
      
      // 如果 moduleData 是对象，确保金额字段正确映射
      // 合同可能使用 amount 或 totalAmount，统一处理
      if (moduleData && typeof moduleData === 'object') {
        // 如果合同有 products，计算总金额
        if (moduleData.products && Array.isArray(moduleData.products)) {
          const totalAmount = moduleData.products.reduce((sum, p) => {
            return sum + (parseFloat(p.amount) || 0);
          }, 0);
          if (totalAmount > 0) {
            dataForEvaluation.amount = totalAmount;
            dataForEvaluation.totalAmount = totalAmount;
          }
        }
        // 确保 amount 字段存在
        if (!dataForEvaluation.amount && moduleData.amount) {
          dataForEvaluation.amount = parseFloat(moduleData.amount) || 0;
        }
      }
      
      console.log(`[条件判断准备] 流程实例ID: ${instanceId}, 当前节点ID: ${currentNodeId}`);
      console.log(`[条件判断准备] 可用数据字段:`, Object.keys(dataForEvaluation));
      console.log(`[条件判断准备] 金额相关字段:`, {
        amount: dataForEvaluation.amount,
        totalAmount: dataForEvaluation.totalAmount,
        'products.length': moduleData?.products?.length
      });
      
      // 如果当前节点是开始节点，且后面有多个路由指向条件节点，需要先判断条件
      // 获取目标节点类型，判断是否是条件节点
      const targetNodeIds = routes.map(r => r.toNodeId);
      let targetNodes = [];
      if (targetNodeIds.length > 0) {
        const placeholders = targetNodeIds.map(() => '?').join(',');
        const [targetNodesResult] = await connection.execute(
          `SELECT * FROM workflow_nodes WHERE id IN (${placeholders})`,
          targetNodeIds
        );
        targetNodes = targetNodesResult;
      }
      const targetNodeMap = new Map(targetNodes.map(n => [n.id, n]));
      
      // 检查是否有多个路由指向条件节点
      const conditionRoutes = routes.filter(r => {
        const targetNode = targetNodeMap.get(r.toNodeId);
        return targetNode && targetNode.nodeType === 'condition';
      });
      
      // 如果当前节点是开始节点，且后面有多个条件节点路由，需要判断条件
      const isStartNodeWithMultipleConditions = currentNode.nodeType === 'start' && conditionRoutes.length > 1;
      
      for (const route of routes) {
        const targetNode = targetNodeMap.get(route.toNodeId);
        const isConditionNode = targetNode && targetNode.nodeType === 'condition';
        
        if (route.conditionType === 'always') {
          // 如果是从开始节点到条件节点的路由，且后面有多个条件节点，需要判断条件
          if (isStartNodeWithMultipleConditions && isConditionNode) {
            // 这种情况下，需要读取条件节点的配置来判断
            // 但这里我们暂时跳过，让条件节点自己处理
            matchedRoutes.push(route);
          } else {
            matchedRoutes.push(route);
          }
        } else if (route.conditionType === 'condition') {
          // 从路由的 conditionConfig 中读取条件配置
          let conditionConfig = route.conditionConfig;
          if (typeof conditionConfig === 'string') {
            try {
              conditionConfig = JSON.parse(conditionConfig);
            } catch (e) {
              console.error('解析路由条件配置失败:', e);
              conditionConfig = {};
            }
          }
          
          let matches = true;
          
          // 如果 conditionConfig 中有条件字段配置，进行评估
          if (conditionConfig && conditionConfig.conditionField) {
            const fieldName = conditionConfig.conditionField;
            const operator = conditionConfig.conditionOperator;
            let fieldValue = dataForEvaluation[fieldName];
            
            console.log(`[条件判断开始] 路由ID: ${route.id}, 字段名: ${fieldName}, 操作符: ${operator}`);
            console.log(`[条件判断数据] dataForEvaluation:`, JSON.stringify(dataForEvaluation, null, 2));
            console.log(`[条件判断数据] 字段值: ${fieldValue}, 类型: ${typeof fieldValue}`);
            
            // 使用 WorkflowDefinition 的比较方法
            if (operator) {
              // 处理不同的值类型
              let compareValue = conditionConfig.conditionValue;
              
              // 如果是 between 操作符，需要两个值
              if (operator === 'between') {
                compareValue = [conditionConfig.conditionValue1, conditionConfig.conditionValue2];
              } else if (operator === 'in' || operator === 'not_in') {
                // 如果是 in/not_in，需要将字符串转换为数组
                if (typeof compareValue === 'string') {
                  compareValue = compareValue.split(',').map(v => v.trim());
                }
              }
              
              // 如果字段值为 undefined 或 null，检查是否为 is_null 或 is_not_null 操作符
              if (fieldValue === undefined || fieldValue === null) {
                if (operator === 'is_null') {
                  matches = true;
                } else if (operator === 'is_not_null') {
                  matches = false;
                } else {
                  matches = false;
                }
                console.log(`[条件判断] 字段值为空，操作符: ${operator}, 结果: ${matches}`);
              } else {
                // 直接调用静态方法进行比较
                const WorkflowDefinitionModel = require('../models/WorkflowDefinition');
                matches = WorkflowDefinitionModel.compareField(fieldValue, operator, compareValue);
                
                console.log(`[条件判断] 字段: ${fieldName}, 操作符: ${operator}, 字段值: ${fieldValue} (${typeof fieldValue}), 比较值: ${JSON.stringify(compareValue)} (${typeof compareValue}), 结果: ${matches}`);
              }
            } else {
              // 如果没有操作符，默认不匹配
              console.log(`[条件判断] 缺少操作符，默认不匹配`);
              matches = false;
            }
          } else {
            // 如果没有条件配置，默认匹配
            console.log(`[条件判断] 无条件配置，默认匹配`);
            matches = true;
          }

          if (matches) {
            matchedRoutes.push(route);
          }
        }
      }

      // 执行匹配的路由指向的节点（传递连接）
      // 对于条件节点，通常只执行第一个匹配的路由（互斥条件）
      // 如果是并行节点，可以执行多个路由
      if (matchedRoutes.length > 0) {
        const currentNode = currentNodes[0];
        
        // 如果是从开始节点到多个条件节点的路由，需要判断条件，只执行匹配的
        if (isStartNodeWithMultipleConditions) {
          console.log(`[开始节点] 检测到多个条件节点路由，需要判断条件`);
          console.log(`[开始节点] 找到 ${matchedRoutes.length} 个路由，需要判断条件`);
          
          // 重新评估条件，只保留匹配的路由
          const conditionMatchedRoutes = [];
          for (const route of matchedRoutes) {
            const targetNode = targetNodeMap.get(route.toNodeId);
            if (targetNode && targetNode.nodeType === 'condition') {
              // 获取条件节点的配置
              const conditionConfig = targetNode.config ? (typeof targetNode.config === 'string' ? JSON.parse(targetNode.config) : targetNode.config) : {};
              
              if (conditionConfig && conditionConfig.conditionField) {
                const fieldName = conditionConfig.conditionField;
                const operator = conditionConfig.conditionOperator;
                let fieldValue = dataForEvaluation[fieldName];
                
                console.log(`[开始节点条件判断] 路由ID: ${route.id}, 目标节点: ${targetNode.name}, 字段名: ${fieldName}, 操作符: ${operator}, 字段值: ${fieldValue}`);
                
                if (operator && fieldValue !== undefined && fieldValue !== null) {
                  let compareValue = conditionConfig.conditionValue;
                  if (operator === 'between') {
                    compareValue = [conditionConfig.conditionValue1, conditionConfig.conditionValue2];
                  }
                  
                  const WorkflowDefinitionModel = require('../models/WorkflowDefinition');
                  const matches = WorkflowDefinitionModel.compareField(fieldValue, operator, compareValue);
                  
                  console.log(`[开始节点条件判断] 路由ID: ${route.id}, 判断结果: ${matches}`);
                  
                  if (matches) {
                    conditionMatchedRoutes.push(route);
                  }
                }
              } else {
                // 如果没有条件配置，默认不匹配
                console.log(`[开始节点条件判断] 路由ID: ${route.id}, 无条件配置，跳过`);
              }
            } else {
              // 不是条件节点，直接添加
              conditionMatchedRoutes.push(route);
            }
          }
          
          if (conditionMatchedRoutes.length > 0) {
            console.log(`[开始节点] 找到 ${conditionMatchedRoutes.length} 个匹配的条件路由，只执行第一个`);
            await this.executeNode(instanceId, conditionMatchedRoutes[0].toNodeId, moduleData, connection);
          } else {
            console.warn(`[开始节点] 没有找到匹配的条件路由`);
          }
        } else if (currentNode && currentNode.nodeType === 'condition') {
          // 如果是条件节点，只执行第一个匹配的路由
          console.log(`[条件节点执行] 当前节点类型: ${currentNode.nodeType}`);
          console.log(`[条件节点执行] 找到 ${matchedRoutes.length} 个匹配的路由:`);
          matchedRoutes.forEach((route, index) => {
            console.log(`  [${index + 1}] 路由ID: ${route.id}, 目标节点ID: ${route.toNodeId}, 条件类型: ${route.conditionType}`);
          });
          console.log(`[条件节点执行] 只执行第一个匹配的路由 (路由ID: ${matchedRoutes[0].id})`);
          
          // 只执行第一个匹配的路由
          await this.executeNode(instanceId, matchedRoutes[0].toNodeId, moduleData, connection);
        } else {
          // 其他节点类型（如并行节点），可以执行多个路由
          // 但如果后续节点是条件节点，需要判断条件
          console.log(`[非条件节点] 当前节点类型: ${currentNode.nodeType}, 找到 ${matchedRoutes.length} 个匹配的路由`);
          
          // 检查后续节点是否是条件节点
          const routesToExecute = [];
          for (const route of matchedRoutes) {
            const targetNode = targetNodeMap.get(route.toNodeId);
            if (targetNode && targetNode.nodeType === 'condition') {
              // 如果是条件节点，需要判断条件
              const conditionConfig = targetNode.config ? (typeof targetNode.config === 'string' ? JSON.parse(targetNode.config) : targetNode.config) : {};
              
              if (conditionConfig && conditionConfig.conditionField) {
                const fieldName = conditionConfig.conditionField;
                const operator = conditionConfig.conditionOperator;
                let fieldValue = dataForEvaluation[fieldName];
                
                console.log(`[条件判断] 路由ID: ${route.id}, 目标节点: ${targetNode.name}, 字段名: ${fieldName}, 操作符: ${operator}, 字段值: ${fieldValue}`);
                
                if (operator && fieldValue !== undefined && fieldValue !== null) {
                  let compareValue = conditionConfig.conditionValue;
                  if (operator === 'between') {
                    compareValue = [conditionConfig.conditionValue1, conditionConfig.conditionValue2];
                  }
                  
                  const WorkflowDefinitionModel = require('../models/WorkflowDefinition');
                  const matches = WorkflowDefinitionModel.compareField(fieldValue, operator, compareValue);
                  
                  console.log(`[条件判断] 路由ID: ${route.id}, 判断结果: ${matches}`);
                  
                  if (matches) {
                    routesToExecute.push(route);
                  }
                }
              } else {
                // 如果没有条件配置，不执行
                console.log(`[条件判断] 路由ID: ${route.id}, 无条件配置，跳过`);
              }
            } else {
              // 不是条件节点，直接执行
              routesToExecute.push(route);
            }
          }
          
          if (routesToExecute.length > 0) {
            console.log(`[非条件节点] 执行 ${routesToExecute.length} 个路由`);
            for (const route of routesToExecute) {
              await this.executeNode(instanceId, route.toNodeId, moduleData, connection);
            }
          } else {
            console.warn(`[非条件节点] 没有找到可执行的路由`);
          }
        }
      } else {
        console.warn(`[条件判断] 没有找到匹配的路由，流程可能无法继续`);
        console.warn(`[条件判断] 当前节点ID: ${currentNodeId}, 路由总数: ${routes.length}`);
      }
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }

  /**
   * 执行节点
   */
  async executeNode(instanceId, nodeId, moduleData = {}, providedConnection = null) {
    const connection = providedConnection || await pool.getConnection();
    const shouldRelease = !providedConnection;
    try {
      // 获取节点
      const [nodes] = await connection.execute('SELECT * FROM workflow_nodes WHERE id = ?', [nodeId]);
      if (nodes.length === 0) return;

      const node = nodes[0];
      const nodeConfig = node.config ? (typeof node.config === 'string' ? JSON.parse(node.config) : node.config) : {};

      // 检查是否已经存在运行中的节点实例（避免重复创建）
      // 注意：只检查运行中的节点实例，已完成的节点实例可以重新执行（如退回时）
      const [existingNodeInstances] = await connection.execute(
        'SELECT id, status FROM workflow_node_instances WHERE instanceId = ? AND nodeId = ? AND status = "running"',
        [instanceId, node.id]
      );
      
      let nodeInstanceId;
      if (existingNodeInstances.length > 0) {
        // 如果已存在运行中的节点实例，使用现有的（避免重复创建）
        nodeInstanceId = existingNodeInstances[0].id;
        console.log(`[executeNode] 节点 ${node.nodeKey} 已存在运行中的实例，使用现有实例 ID: ${nodeInstanceId}`);
        // 注意：如果节点已经运行中，可能不需要重新执行，但为了安全，继续执行后续逻辑
      } else {
        // 创建新的节点实例（包括退回时重新执行已完成的节点）
        const [nodeInstanceResult] = await connection.execute(
          `INSERT INTO workflow_node_instances 
          (instanceId, nodeId, nodeKey, nodeType, status, startTime) 
          VALUES (?, ?, ?, ?, 'running', NOW())`,
          [instanceId, node.id, node.nodeKey, node.nodeType]
        );
        nodeInstanceId = nodeInstanceResult.insertId;
        console.log(`[executeNode] 创建新节点实例 ID: ${nodeInstanceId}，节点: ${node.nodeKey} (${node.nodeType})`);
      }

      // 更新流程实例的当前节点（使用当前连接）
      await connection.execute(
        'UPDATE workflow_instances SET currentNodeId = ?, currentNodeKey = ?, updatedAt = NOW() WHERE id = ?',
        [node.id, node.nodeKey, instanceId]
      );

      // 根据节点类型执行不同的逻辑
      switch (node.nodeType) {
        case 'approval':
          await this.executeApprovalNode(instanceId, nodeInstanceId, node, nodeConfig, moduleData, connection);
          break;
        case 'condition':
          // 条件节点直接评估并继续
          await this.executeNextNodes(instanceId, node.id, moduleData, connection);
          await connection.execute(
            'UPDATE workflow_node_instances SET status = "completed", endTime = NOW() WHERE id = ?',
            [nodeInstanceId]
          );
          break;
        case 'parallel':
          // 并行节点：创建多个分支
          await this.executeParallelNode(instanceId, nodeInstanceId, node, nodeConfig, moduleData, connection);
          break;
        case 'merge':
          // 合并节点：等待所有分支完成
          await this.executeMergeNode(instanceId, nodeInstanceId, node, nodeConfig, moduleData, connection);
          break;
        case 'end':
          // 结束节点
          await connection.execute(
            'UPDATE workflow_node_instances SET status = "completed", endTime = NOW() WHERE id = ?',
            [nodeInstanceId]
          );
          await this.completeWorkflow(instanceId, connection);
          break;
        default:
          // 其他类型节点直接完成
          await connection.execute(
            'UPDATE workflow_node_instances SET status = "completed", endTime = NOW() WHERE id = ?',
            [nodeInstanceId]
          );
          await this.executeNextNodes(instanceId, node.id, moduleData, connection);
      }
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }

  /**
   * 执行审批节点
   */
  async executeApprovalNode(instanceId, nodeInstanceId, node, nodeConfig, moduleData, providedConnection = null) {
    const connection = providedConnection || await pool.getConnection();
    const shouldRelease = !providedConnection;
    try {
      // 如果传入的 moduleData 为空，从数据库获取
      let finalModuleData = moduleData || {};
      if (!moduleData || Object.keys(moduleData).length === 0) {
        const [instances] = await connection.execute(
          'SELECT * FROM workflow_instances WHERE id = ?',
          [instanceId]
        );
        if (instances.length > 0) {
          const instance = instances[0];
          if (instance.metadata) {
            finalModuleData = typeof instance.metadata === 'string' ? JSON.parse(instance.metadata) : instance.metadata;
          }
        }
      }
      
      const approvers = nodeConfig.approvers || [];
      const approvalType = nodeConfig.approvalType || 'or'; // 'or' 或签, 'and' 会签
      const dueHours = nodeConfig.dueHours || 24; // 默认24小时

      if (approvers.length === 0) {
        // 如果没有审批人，跳过节点
        await connection.execute(
          'UPDATE workflow_node_instances SET status = "skipped", endTime = NOW() WHERE id = ?',
          [nodeInstanceId]
        );
        await this.executeNextNodes(instanceId, node.id, finalModuleData, connection);
        return;
      }

      // 解析审批人（支持用户ID、角色、部门等）
      const assigneeIds = await this.resolveApprovers(approvers, finalModuleData);

      if (assigneeIds.length === 0) {
        // 如果没有找到审批人，跳过节点
        await connection.execute(
          'UPDATE workflow_node_instances SET status = "skipped", endTime = NOW() WHERE id = ?',
          [nodeInstanceId]
        );
        await this.executeNextNodes(instanceId, node.id, finalModuleData, connection);
        return;
      }

      // 创建审批任务
      const dueTime = new Date();
      dueTime.setHours(dueTime.getHours() + dueHours);

      // 获取流程实例（用于生成标题等）
      const [instances] = await connection.execute(
        'SELECT * FROM workflow_instances WHERE id = ?',
        [instanceId]
      );
      if (instances.length === 0) return;
      
      const instance = instances[0];
      
      // 生成标题和描述
      const { title, description } = await this.generateTaskTitle(instance.moduleType, instance.moduleId, finalModuleData, node.name || node.nodeKey);

      // 检查是否启用钉钉审批（三方流程对接钉钉OA）
      // 注意：已禁用OA审批功能，统一使用普通待办模式
      const DingTalkConfig = require('../models/DingTalkConfig');
      const dingTalkConfig = await DingTalkConfig.findWithSecrets();
      const useDingTalkApproval = false; // 强制禁用OA审批，使用普通待办模式

      if (useDingTalkApproval) {
        // 使用钉钉审批（三方流程对接钉钉OA）
        console.log(`[executeApprovalNode] 使用钉钉审批创建审批流程实例`);
        
        try {
          const DingTalkUser = require('../models/DingTalkUser');
          const dingTalkService = require('../services/dingTalkService');
          
          // 获取发起人的钉钉用户ID
          const [initiatorRows] = await connection.execute(
            'SELECT * FROM users WHERE id = ?',
            [instance.initiatorId]
          );
          let originatorUserId = null;
          if (initiatorRows.length > 0) {
            const initiatorDingTalkUser = await DingTalkUser.findByUserId(instance.initiatorId);
            if (initiatorDingTalkUser && initiatorDingTalkUser.dingTalkUserId) {
              originatorUserId = initiatorDingTalkUser.dingTalkUserId;
            }
          }
          
          if (!originatorUserId) {
            console.warn(`[executeApprovalNode] 发起人未绑定钉钉账号，回退到普通待办模式`);
            // 回退到普通待办模式
          } else {
            // 获取所有审批人的钉钉用户ID
            const approvers = [];
            for (const assigneeId of assigneeIds) {
              const dingTalkUser = await DingTalkUser.findByUserId(assigneeId);
              if (dingTalkUser && dingTalkUser.dingTalkUserId) {
                approvers.push({
                  userid: dingTalkUser.dingTalkUserId,
                  type: approvalType === 'and' ? 'AND' : 'OR', // 会签或或签
                });
              }
            }
            
            if (approvers.length === 0) {
              console.warn(`[executeApprovalNode] 没有找到绑定钉钉账号的审批人，回退到普通待办模式`);
              // 回退到普通待办模式
            } else {
              // 构建审批表单组件（将模块数据映射到表单）
              const formComponents = this.buildApprovalFormComponents(instance.moduleType, finalModuleData);
              
              // 创建钉钉审批流程实例
              // 注意：processCode 会从配置中读取，如果配置中没有则使用传入的值
              // 如果都没有配置，createApprovalProcessInstance 会使用默认值并给出警告
              const processInstance = await dingTalkService.createApprovalProcessInstance({
                originatorUserId,
                approvers,
                formComponents,
                title: `[墨枫CRM] ${title}`,
                description: description || '',
                businessId: instanceId.toString(), // 用于回调时关联流程实例
              });
              
              console.log(`[executeApprovalNode] ✅ 钉钉审批流程实例创建成功: ${processInstance.processInstanceId}`);
              
              // 创建审批任务和本地待办（参考宜搭/氚云的做法：同时创建本地待办和钉钉审批）
              for (const assigneeId of assigneeIds) {
                const [taskResult] = await connection.execute(
                  `INSERT INTO workflow_tasks 
                  (instanceId, nodeInstanceId, nodeId, taskType, assigneeId, assigneeType, status, dueTime, priority) 
                  VALUES (?, ?, ?, 'approval', ?, 'user', 'pending', ?, ?)`,
                  [instanceId, nodeInstanceId, node.id, assigneeId, dueTime, nodeConfig.priority || 'medium']
                );
                
                const taskId = taskResult.insertId;
                
                // 保存钉钉审批流程实例ID到metadata
                const [nodeInstances] = await connection.execute(
                  'SELECT * FROM workflow_node_instances WHERE id = ?',
                  [nodeInstanceId]
                );
                if (nodeInstances.length > 0) {
                  let nodeMetadata = {};
                  try {
                    if (nodeInstances[0].metadata) {
                      nodeMetadata = typeof nodeInstances[0].metadata === 'string' 
                        ? JSON.parse(nodeInstances[0].metadata) 
                        : nodeInstances[0].metadata;
                    }
                  } catch (e) {}
                  
                  nodeMetadata.dingTalkProcessInstanceId = processInstance.processInstanceId;
                  
                  await connection.execute(
                    `UPDATE workflow_node_instances SET metadata = ? WHERE id = ?`,
                    [JSON.stringify(nodeMetadata), nodeInstanceId]
                  );
                }
                
                // 同时创建本地待办（让系统里也能看到待办，参考宜搭/氚云的做法）
                const existingTodos = await Todo.find({
                  type: 'approval',
                  moduleType: instance.moduleType,
                  moduleId: instance.moduleId,
                  assigneeId,
                  status: 'pending'
                });
                
                if (existingTodos.length === 0) {
                  const todoMetadata = {
                    workflowInstanceId: instanceId,
                    workflowTaskId: taskId,
                    nodeInstanceId: nodeInstanceId,
                    dingTalkProcessInstanceId: processInstance.processInstanceId,
                    dingTalkApproval: true, // 标记这是钉钉审批
                  };
                  
                  const createdTodo = await Todo.create({
                    type: 'approval',
                    moduleType: instance.moduleType,
                    moduleId: instance.moduleId,
                    title,
                    description: nodeConfig.description || description,
                    assigneeId,
                    status: 'pending',
                    priority: nodeConfig.priority || 'medium',
                    dueDate: dueTime,
                    metadata: todoMetadata,
                    createdBy: instance.initiatorId,
                  });
                  
                  console.log(`[executeApprovalNode] ✅ 已创建本地待办（钉钉审批模式）: todoId=${createdTodo.id}, taskId=${taskId}`);
                } else {
                  console.log(`[executeApprovalNode] ⚠️  待办已存在，跳过创建: assigneeId=${assigneeId}`);
                }
              }
              
              // 钉钉审批流程已创建，同时本地待办也已创建，等待回调同步状态
              return;
            }
          }
        } catch (error) {
          console.error(`[executeApprovalNode] ❌ 创建钉钉审批流程实例失败:`, error.message);
          console.error(`[executeApprovalNode] 回退到普通待办模式`);
          // 回退到普通待办模式，继续执行下面的代码
        }
      }

      // 普通待办模式（原有逻辑）
      // 无论是否启用钉钉审批，如果钉钉审批失败或未启用，都会执行这里的逻辑
      console.log(`[executeApprovalNode] 使用普通待办模式创建审批任务，审批人数量: ${assigneeIds.length}`);
      for (const assigneeId of assigneeIds) {
        // 检查是否已存在相同的待办任务，避免重复创建
        const existingTodos = await Todo.find({
          type: 'approval',
          moduleType: instance.moduleType,
          moduleId: instance.moduleId,
          assigneeId,
          status: 'pending'
        });
        
        // 检查是否已有相同的工作流任务
        const [existingTasks] = await connection.execute(
          `SELECT id FROM workflow_tasks 
           WHERE instanceId = ? AND nodeInstanceId = ? AND assigneeId = ? AND status = 'pending'`,
          [instanceId, nodeInstanceId, assigneeId]
        );
        
        if (existingTasks.length > 0) {
          console.warn(`审批任务已存在，跳过创建: instanceId=${instanceId}, nodeInstanceId=${nodeInstanceId}, assigneeId=${assigneeId}`);
          continue;
        }

        const [taskResult] = await connection.execute(
          `INSERT INTO workflow_tasks 
          (instanceId, nodeInstanceId, nodeId, taskType, assigneeId, assigneeType, status, dueTime, priority) 
          VALUES (?, ?, ?, 'approval', ?, 'user', 'pending', ?, ?)`,
          [instanceId, nodeInstanceId, node.id, assigneeId, dueTime, nodeConfig.priority || 'medium']
        );
        
        const taskId = taskResult.insertId;

        // 创建待办事项（如果不存在）
        if (existingTodos.length === 0) {
          const createdTodo = await Todo.create({
            type: 'approval',
            moduleType: instance.moduleType,
            moduleId: instance.moduleId,
            title,
            description: nodeConfig.description || description,
            assigneeId,
            status: 'pending',
            priority: nodeConfig.priority || 'medium',
            dueDate: dueTime,
            metadata: {
              workflowInstanceId: instanceId,
              nodeInstanceId,
              nodeId: node.id,
              nodeKey: node.nodeKey,
              taskId: taskId  // 存储taskId，方便审批时查找
            }
          });
          
          // 自动同步到钉钉待办（异步执行，不阻塞流程）
          // 注意：这里同步的是普通钉钉待办，不是OA审批
          if (createdTodo && createdTodo.id) {
            setImmediate(async () => {
              try {
                const DingTalkUser = require('../models/DingTalkUser');
                // 检查待办同步是否启用
                const DingTalkConfig = require('../models/DingTalkConfig');
                const dingTalkConfig = await DingTalkConfig.findWithSecrets();
                
                // 如果待办同步未启用，跳过同步
                if (!dingTalkConfig || !dingTalkConfig.todoSyncEnabled) {
                  console.log(`[自动同步钉钉待办] 待办同步已停用，跳过同步待办 ${createdTodo.id}`);
                  return;
                }
                
                const dingTalkService = require('../services/dingTalkService');
                
                // 查找用户的钉钉关联
                const dingTalkUser = await DingTalkUser.findByUserId(assigneeId);
                if (dingTalkUser && dingTalkUser.dingTalkUserId) {
                  console.log(`[自动同步钉钉待办] 开始同步待办 ${createdTodo.id} 到钉钉用户 ${dingTalkUser.dingTalkUserId}`);
                  
                  const dueTimeForDingTalk = dueTime 
                    ? Math.floor(new Date(dueTime).getTime() / 1000)
                    : null;
                  
                  // 先创建待办
                  const createResult = await dingTalkService.createTodo(
                    dingTalkUser.dingTalkUserId,
                    createdTodo.title,
                    createdTodo.description,
                    dueTimeForDingTalk,
                    createdTodo.id // 传递待办ID，用于构建详情页URL
                  );
                  const dingTalkRecordId = createResult?.record_id || createResult?.recordId || createResult?.id || null;
                  console.log(`[自动同步钉钉待办] ✅ 待办已创建${dingTalkRecordId ? `，recordId=${dingTalkRecordId}` : ''}`);
                  
                  // 发送工作通知卡片（类似宜搭的效果）
                  // 注意：工作通知卡片和待办是分开的，工作通知卡片会在"工作通知"中显示
                  // 这是关键功能，必须确保发送成功
                  try {
                    // 获取发起人信息
                    const User = require('../models/User');
                    const initiator = await User.findById(instance.initiatorId);
                    const initiatorName = initiator ? initiator.name : '系统';
                    
                    console.log(`[自动同步钉钉待办] 📤 准备发送工作通知卡片...`);
                    console.log(`   接收人: ${dingTalkUser.dingTalkUserId}`);
                    console.log(`   待办ID: ${createdTodo.id}`);
                    console.log(`   标题: ${createdTodo.title}`);
                    console.log(`   发起人: ${initiatorName}`);
                    
                    const notificationResult = await dingTalkService.sendWorkNotificationCard(
                      dingTalkUser.dingTalkUserId,
                      createdTodo.id,
                      createdTodo.title,
                      createdTodo.description,
                      instance.moduleType,
                      instance.moduleId,
                      initiatorName,
                      instance.initiatorId
                    );
                    
                    if (notificationResult) {
                      console.log(`[自动同步钉钉待办] ✅ 工作通知卡片已发送成功`);
                      console.log(`   任务ID: ${notificationResult.task_id || 'N/A'}`);
                    } else {
                      console.error(`[自动同步钉钉待办] ❌ 工作通知卡片发送失败`);
                      console.error(`   可能原因：1. AgentId未配置 2. 权限不足 3. API调用失败`);
                    }

                    // 获取客户名称（用于互动卡片）
                    let customerName = null;
                    try {
                      if (instance.moduleType === 'contract' || instance.moduleType === 'contracts') {
                        const Contract = require('../models/Contract');
                        const contractData = await Contract.findById(instance.moduleId);
                        if (contractData) {
                          customerName = contractData.customerName || null;
                        }
                      } else if (instance.moduleType === 'opportunity' || instance.moduleType === 'opportunities') {
                        const Opportunity = require('../models/Opportunity');
                        const opportunityData = await Opportunity.findById(instance.moduleId);
                        if (opportunityData) {
                          customerName = opportunityData.customerName || null;
                        }
                      }
                    } catch (e) {
                      console.warn(`[自动同步钉钉待办] 获取客户名称失败:`, e.message);
                    }

                    await dingTalkService.sendInteractiveCard({
                      userId: assigneeId,
                      todoId: createdTodo.id,
                      title: createdTodo.title,
                      description: createdTodo.description,
                      moduleType: instance.moduleType,
                      moduleId: instance.moduleId,
                      initiatorName,
                      customerName,
                    });
                  } catch (notificationError) {
                    console.error(`[自动同步钉钉待办] ❌ 发送工作通知卡片异常:`, notificationError.message);
                    console.error(`[自动同步钉钉待办] 错误堆栈:`, notificationError.stack);
                    // 通知失败不影响主流程，但记录详细错误
                  }
                  
                  // 更新待办的metadata，标记已同步到钉钉
                  const Todo = require('../models/Todo');
                  const todo = await Todo.findById(createdTodo.id);
                  if (todo) {
                    let metadata = todo.metadata || {};
                    if (typeof metadata === 'string') {
                      metadata = JSON.parse(metadata);
                    }
                    metadata.dingTalkSynced = true;
                    metadata.dingTalkUserId = dingTalkUser.dingTalkUserId;
                    if (dingTalkRecordId) {
                      metadata.dingTalkRecordId = dingTalkRecordId;
                    }
                    await Todo.findByIdAndUpdate(createdTodo.id, { metadata });
                  }
                  
                  console.log(`[自动同步钉钉待办] ✅ 待办 ${createdTodo.id} 已成功同步到钉钉`);
                } else {
                  console.log(`[自动同步钉钉待办] ⚠️  用户 ${assigneeId} 未绑定钉钉账号，跳过同步`);
                }
              } catch (syncError) {
                // 同步失败不影响主流程，只记录错误
                console.error(`[自动同步钉钉待办] ❌ 同步待办 ${createdTodo.id} 到钉钉失败:`, syncError.message);
              }
            });
          }
        }
      }

      // 如果是或签，只要一个人审批即可；如果是会签，需要所有人审批
      // 这里不自动完成节点，等待审批操作
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }

  /**
   * 构建钉钉审批表单组件
   * 将模块数据映射到钉钉审批表单字段
   */
  buildApprovalFormComponents(moduleType, moduleData) {
    const formComponents = [];
    
    // 通用模板字段映射：使用统一的字段名，系统会根据模块类型填充不同的值
    // 这样只需要在钉钉中创建一个包含所有可能字段的通用模板即可
    
    // 1. 审批内容（必填，所有模块都有）
    const moduleTitle = this.getModuleTitle(moduleType, moduleData);
    formComponents.push({
      name: '审批内容',
      value: moduleTitle || '请审批',
    });
    
    // 2. 模块类型（用于标识是哪种类型的审批）
    formComponents.push({
      name: '模块类型',
      value: this.getModuleTypeName(moduleType),
    });
    
    // 3. 编号字段（合同编号、商机编号、报价单编号等）
    const numberField = this.getNumberField(moduleType, moduleData);
    if (numberField) {
      formComponents.push({
        name: '编号',
        value: numberField,
      });
    }
    
    // 4. 名称字段（合同名称、商机名称、报价单名称等）
    const nameField = this.getNameField(moduleType, moduleData);
    if (nameField) {
      formComponents.push({
        name: '名称',
        value: nameField,
      });
    }
    
    // 5. 客户名称（通用字段）
    if (moduleData.customerName) {
      formComponents.push({
        name: '客户名称',
        value: moduleData.customerName,
      });
    }
    
    // 6. 金额字段（合同金额、预计金额、报价金额等）
    // 注意：钉钉模板中的金额字段如果是数字类型，不能包含货币符号，只发送纯数字
    if (moduleData.amount) {
      const amountLabel = this.getAmountLabel(moduleType);
      // 转换为数字，去掉货币符号和格式化字符
      let amountValue = moduleData.amount;
      if (typeof amountValue === 'string') {
        // 去掉货币符号、逗号等格式化字符
        amountValue = amountValue.replace(/[¥,\s]/g, '');
      }
      // 确保是数字格式（保留2位小数）
      const numericAmount = parseFloat(amountValue);
      if (!isNaN(numericAmount)) {
        formComponents.push({
          name: '金额',
          value: numericAmount.toFixed(2), // 保留2位小数，作为字符串发送（钉钉数字字段需要字符串格式）
        });
      }
    }
    
    // 7. 其他特定字段
    if (moduleType === 'contracts' || moduleType === 'contract') {
      // 合同特定字段
      if (moduleData.contractType) {
        formComponents.push({
          name: '合同类型',
          value: moduleData.contractType,
        });
      }
      if (moduleData.signDate) {
        // 格式化日期
        let signDateValue = moduleData.signDate;
        if (signDateValue instanceof Date) {
          signDateValue = signDateValue.toISOString().split('T')[0];
        } else if (typeof signDateValue === 'string' && signDateValue.includes('T')) {
          signDateValue = signDateValue.split('T')[0];
        }
        formComponents.push({
          name: '签署日期',
          value: signDateValue,
        });
      }
      if (moduleData.startDate) {
        // 格式化日期，只保留日期部分（YYYY-MM-DD）
        let startDateValue = moduleData.startDate;
        if (startDateValue instanceof Date) {
          startDateValue = startDateValue.toISOString().split('T')[0];
        } else if (typeof startDateValue === 'string' && startDateValue.includes('T')) {
          startDateValue = startDateValue.split('T')[0];
        }
        formComponents.push({
          name: '开始日期',
          value: startDateValue,
        });
      }
      if (moduleData.endDate) {
        // 格式化日期，只保留日期部分（YYYY-MM-DD）
        let endDateValue = moduleData.endDate;
        if (endDateValue instanceof Date) {
          endDateValue = endDateValue.toISOString().split('T')[0];
        } else if (typeof endDateValue === 'string' && endDateValue.includes('T')) {
          endDateValue = endDateValue.split('T')[0];
        }
        formComponents.push({
          name: '结束日期',
          value: endDateValue,
        });
      }
    } else if (moduleType === 'opportunities' || moduleType === 'opportunity') {
      // 商机特定字段
      if (moduleData.stage) {
        formComponents.push({
          name: '商机阶段',
          value: moduleData.stage,
        });
      }
      if (moduleData.probability) {
        formComponents.push({
          name: '成交概率',
          value: `${moduleData.probability}%`,
        });
      }
    } else if (moduleType === 'quotations' || moduleType === 'quotation') {
      // 报价单特定字段
      if (moduleData.quotationNumber) {
        formComponents.push({
          name: '报价单号',
          value: moduleData.quotationNumber,
        });
      }
      if (moduleData.validUntil) {
        formComponents.push({
          name: '有效期至',
          value: moduleData.validUntil,
        });
      }
    } else if (moduleType === 'projects' || moduleType === 'project') {
      // 项目特定字段
      if (moduleData.projectNumber) {
        formComponents.push({
          name: '项目编号',
          value: moduleData.projectNumber,
        });
      }
      if (moduleData.status) {
        formComponents.push({
          name: '项目状态',
          value: moduleData.status,
        });
      }
    }
    
    // 8. 备注说明（通用字段）
    if (moduleData.description) {
      formComponents.push({
        name: '备注说明',
        value: moduleData.description,
      });
    }
    
    // 钉钉要求至少有一个表单字段，如果没有则添加一个默认字段
    if (formComponents.length === 0) {
      formComponents.push({
        name: '审批内容',
        value: '请审批',
      });
    }
    
    return formComponents;
  }
  
  // 获取模块标题
  getModuleTitle(moduleType, moduleData) {
    if (moduleType === 'contracts' || moduleType === 'contract') {
      return moduleData.title || moduleData.contractNumber || '合同审批';
    } else if (moduleType === 'opportunities' || moduleType === 'opportunity') {
      return moduleData.name || '商机审批';
    } else if (moduleType === 'quotations' || moduleType === 'quotation') {
      return moduleData.title || moduleData.quotationNumber || '报价单审批';
    } else if (moduleType === 'projects' || moduleType === 'project') {
      return moduleData.name || moduleData.projectNumber || '项目审批';
    }
    return '审批';
  }
  
  // 获取模块类型名称
  getModuleTypeName(moduleType) {
    const typeMap = {
      'contracts': '合同',
      'contract': '合同',
      'opportunities': '商机',
      'opportunity': '商机',
      'quotations': '报价单',
      'quotation': '报价单',
      'projects': '项目',
      'project': '项目',
      'expenses': '费用',
      'expense': '费用',
    };
    return typeMap[moduleType] || '通用';
  }
  
  // 获取编号字段
  getNumberField(moduleType, moduleData) {
    if (moduleType === 'contracts' || moduleType === 'contract') {
      return moduleData.contractNumber;
    } else if (moduleType === 'opportunities' || moduleType === 'opportunity') {
      return moduleData.opportunityNumber || moduleData.number;
    } else if (moduleType === 'quotations' || moduleType === 'quotation') {
      return moduleData.quotationNumber || moduleData.number;
    } else if (moduleType === 'projects' || moduleType === 'project') {
      return moduleData.projectNumber || moduleData.number;
    }
    return moduleData.number || moduleData.id;
  }
  
  // 获取名称字段
  getNameField(moduleType, moduleData) {
    if (moduleType === 'contracts' || moduleType === 'contract') {
      return moduleData.title;
    } else if (moduleType === 'opportunities' || moduleType === 'opportunity') {
      return moduleData.name;
    } else if (moduleType === 'quotations' || moduleType === 'quotation') {
      return moduleData.title || moduleData.name;
    } else if (moduleType === 'projects' || moduleType === 'project') {
      return moduleData.name;
    }
    return moduleData.title || moduleData.name;
  }
  
  // 获取金额标签
  getAmountLabel(moduleType) {
    if (moduleType === 'contracts' || moduleType === 'contract') {
      return '合同金额';
    } else if (moduleType === 'opportunities' || moduleType === 'opportunity') {
      return '预计金额';
    } else if (moduleType === 'quotations' || moduleType === 'quotation') {
      return '报价金额';
    }
    return '金额';
  }

  /**
   * 解析审批人（支持对象格式和字符串格式）
   */
  async resolveApprovers(approvers, moduleData) {
    const assigneeIds = [];
    
    if (!Array.isArray(approvers) || approvers.length === 0) {
      return assigneeIds;
    }
    
    for (const approver of approvers) {
      let type, value;
      
      // 处理字符串格式：'user:1', 'role:admin', 'dept:2'
      if (typeof approver === 'string') {
        const parts = approver.split(':');
        if (parts.length === 2) {
          type = parts[0];
          value = parts[1];
          
          // 转换类型名称
          if (type === 'dept') type = 'department';
        } else {
          // 如果格式不正确，跳过
          continue;
        }
      } 
      // 处理对象格式：{type: 'user', value: 1}
      else if (typeof approver === 'object' && approver !== null) {
        type = approver.type;
        value = approver.value;
      } else {
        // 未知格式，跳过
        continue;
      }
      
      if (type === 'user') {
        // 直接是用户ID
        const userId = parseInt(value);
        if (!isNaN(userId)) {
          assigneeIds.push(userId);
        }
      } else if (type === 'role') {
        // 根据角色查找用户
        const users = await User.find({ role: value, status: 'active' });
        assigneeIds.push(...users.map(u => u.id).filter(Boolean));
      } else if (type === 'department') {
        // 根据部门查找用户
        const { pool } = require('../config/database');
        const connection = await pool.getConnection();
        try {
          const deptId = parseInt(value);
          if (!isNaN(deptId)) {
            const [rows] = await connection.execute(
              'SELECT id FROM users WHERE departmentId = ? AND status = "active"',
              [deptId]
            );
            assigneeIds.push(...rows.map(r => r.id));
          }
        } finally {
          connection.release();
        }
      } else if (type === 'expression') {
        // 表达式（如：创建人的上级）
        // 这里可以扩展支持更复杂的表达式
        if (value === 'creator_manager' && moduleData.createdBy) {
          const creator = await User.findById(moduleData.createdBy);
          if (creator && creator.managerId) {
            assigneeIds.push(creator.managerId);
          }
        }
      }
    }

    // 去重
    return [...new Set(assigneeIds)];
  }

  /**
   * 获取模块名称
   */
  getModuleName(moduleType) {
    const names = {
      contract: '合同',
      contracts: '合同',
      opportunity: '商机',
      opportunities: '商机',
      expense: '费用',
      expenses: '费用',
      payment: '付款',
      payments: '付款',
      quotation: '报价',
      quotations: '报价',
      invoice: '发票',
      invoices: '发票',
      customer: '客户',
      customers: '客户',
      lead: '线索',
      leads: '线索',
      project: '项目',
      projects: '项目'
    };
    return names[moduleType] || moduleType;
  }

  /**
   * 生成任务标题和描述
   */
  async generateTaskTitle(moduleType, moduleId, moduleData = {}, nodeName = '') {
    const moduleName = this.getModuleName(moduleType);
    let title = `审批${moduleName}`;
    let description = `需要您审批${moduleName}`;
    
    // 尝试从模块数据中获取更具体的信息
    if (moduleData && Object.keys(moduleData).length > 0) {
      if (moduleType === 'contracts' || moduleType === 'contract') {
        const contractNumber = moduleData.contractNumber || '';
        const contractTitle = moduleData.title || '';
        if (contractNumber || contractTitle) {
          title = `审批合同${contractNumber ? `: ${contractNumber}` : ''}${contractTitle ? ` - ${contractTitle}` : ''}`;
          description = `需要您审批合同${contractNumber ? ` ${contractNumber}` : ''}${contractTitle ? `: ${contractTitle}` : ''}`;
        }
      } else if (moduleType === 'opportunities' || moduleType === 'opportunity') {
        const oppName = moduleData.name || '';
        if (oppName) {
          title = `审批商机: ${oppName}`;
          description = `需要您审批商机: ${oppName}`;
        }
      } else if (moduleType === 'expenses' || moduleType === 'expense') {
        const expenseTitle = moduleData.title || moduleData.description || '';
        if (expenseTitle) {
          title = `审批费用: ${expenseTitle}`;
          description = `需要您审批费用: ${expenseTitle}`;
        }
      } else if (moduleType === 'invoices' || moduleType === 'invoice') {
        const invoiceNumber = moduleData.invoiceNumber || '';
        const buyerName = moduleData.buyerName || moduleData.contractTitle || '';
        if (invoiceNumber || buyerName) {
          title = `审批发票${invoiceNumber ? `: ${invoiceNumber}` : ''}${buyerName ? ` - ${buyerName}` : ''}`;
          description = `需要您审批发票${invoiceNumber ? ` ${invoiceNumber}` : ''}${buyerName ? `: ${buyerName}` : ''}`;
        }
      }
    } else {
      // 如果模块数据为空，尝试从数据库查询
      try {
        if (moduleType === 'contracts' || moduleType === 'contract') {
          const Contract = require('../models/Contract');
          const contract = await Contract.findById(moduleId);
          if (contract) {
            const contractNumber = contract.contractNumber || '';
            const contractTitle = contract.title || '';
            if (contractNumber || contractTitle) {
              title = `审批合同${contractNumber ? `: ${contractNumber}` : ''}${contractTitle ? ` - ${contractTitle}` : ''}`;
              description = `需要您审批合同${contractNumber ? ` ${contractNumber}` : ''}${contractTitle ? `: ${contractTitle}` : ''}`;
            }
          }
        } else if (moduleType === 'opportunities' || moduleType === 'opportunity') {
          const Opportunity = require('../models/Opportunity');
          const opportunity = await Opportunity.findById(moduleId);
          if (opportunity) {
            const oppName = opportunity.name || '';
            if (oppName) {
              title = `审批商机: ${oppName}`;
              description = `需要您审批商机: ${oppName}`;
            }
          }
        } else if (moduleType === 'invoices' || moduleType === 'invoice') {
          const Invoice = require('../models/Invoice');
          const invoice = await Invoice.findById(moduleId);
          if (invoice) {
            const invoiceNumber = invoice.invoiceNumber || '';
            const buyerName = invoice.buyerName || invoice.contractTitle || '';
            if (invoiceNumber || buyerName) {
              title = `审批发票${invoiceNumber ? `: ${invoiceNumber}` : ''}${buyerName ? ` - ${buyerName}` : ''}`;
              description = `需要您审批发票${invoiceNumber ? ` ${invoiceNumber}` : ''}${buyerName ? `: ${buyerName}` : ''}`;
            }
          }
        }
      } catch (error) {
        console.error('获取模块信息失败:', error);
      }
    }
    
    // 如果有节点名称，添加到描述中
    if (nodeName) {
      description += ` (${nodeName})`;
    }
    
    return { title, description };
  }

  /**
   * 处理审批任务
   */
  async handleTask(taskId, userId, action, comment = '', options = {}) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 定义完成钉钉待办的辅助函数
      const completeDingTalkTodoIfNeeded = (metadata, assigneeId) => {
        if (!metadata || !metadata.dingTalkRecordId || !assigneeId) {
          return;
        }
        setImmediate(async () => {
          try {
            const DingTalkUser = require('../models/DingTalkUser');
            const dingTalkUser = await DingTalkUser.findByUserId(assigneeId);
            if (!dingTalkUser || !dingTalkUser.dingTalkUserId) {
              console.warn(`[handleTask] ⚠️  找不到用户 ${assigneeId} 的钉钉绑定，无法同步钉钉待办状态`);
              return;
            }
            const dingTalkService = require('../services/dingTalkService');
            await dingTalkService.completeTodo(metadata.dingTalkRecordId, dingTalkUser.dingTalkUserId);
            console.log(`[handleTask] ✅ 已同步完成钉钉待办 recordId=${metadata.dingTalkRecordId}`);
          } catch (syncError) {
            console.error(`[handleTask] ❌ 同步钉钉待办状态失败:`, syncError.message);
          }
        });
      };

      // 获取任务
      // 首先尝试直接通过taskId查找（workflow_tasks表的ID）
      let [tasks] = await connection.execute('SELECT * FROM workflow_tasks WHERE id = ?', [taskId]);
      
      // 如果找不到，可能是传递的是todos表的ID，尝试通过todos表的metadata查找
      if (tasks.length === 0) {
        console.log(`[handleTask] 未找到workflow_tasks记录，尝试通过todos表查找，taskId: ${taskId}`);
        
        // 方法1：通过todos表的ID查找metadata中的taskId
        const [todos] = await connection.execute(
          `SELECT id, metadata FROM todos WHERE id = ? AND type = 'approval' AND status = 'pending'`,
          [taskId]
        );
        
        if (todos.length > 0) {
          const todo = todos[0];
          let metadata = {};
          try {
            metadata = typeof todo.metadata === 'string' ? JSON.parse(todo.metadata) : todo.metadata;
          } catch (e) {
            console.warn(`[handleTask] 解析todos metadata失败:`, e);
          }
          
          if (metadata && metadata.taskId) {
            console.log(`[handleTask] 从todos metadata中找到taskId: ${metadata.taskId}`);
            [tasks] = await connection.execute('SELECT * FROM workflow_tasks WHERE id = ?', [metadata.taskId]);
          }
        }
        
        // 方法2：如果还是找不到，尝试通过moduleType和moduleId查找
        if (tasks.length === 0 && options.moduleType && options.moduleId) {
          console.log(`[handleTask] 尝试通过moduleType和moduleId查找任务`);
          const [todosByModule] = await connection.execute(
            `SELECT metadata FROM todos 
             WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND assigneeId = ? 
             AND type = 'approval' AND status = 'pending' LIMIT 1`,
            [options.moduleType, options.moduleType === 'contracts' ? 'contract' : (options.moduleType === 'opportunities' ? 'opportunity' : options.moduleType), options.moduleId, userId]
          );
          
          if (todosByModule.length > 0) {
            const todo = todosByModule[0];
            let metadata = {};
            try {
              metadata = typeof todo.metadata === 'string' ? JSON.parse(todo.metadata) : todo.metadata;
            } catch (e) {
              console.warn(`[handleTask] 解析todos metadata失败:`, e);
            }
            
            if (metadata && metadata.taskId) {
              console.log(`[handleTask] 从moduleType查找中找到taskId: ${metadata.taskId}`);
              [tasks] = await connection.execute('SELECT * FROM workflow_tasks WHERE id = ?', [metadata.taskId]);
            }
          }
        }
      }
      
      if (tasks.length === 0) {
        console.error(`[handleTask] ❌ 任务不存在，taskId: ${taskId}, userId: ${userId}`);
        console.error(`[handleTask] 尝试的查找方式：`);
        console.error(`  1. 直接通过workflow_tasks.id查找`);
        console.error(`  2. 通过todos.id查找metadata中的taskId`);
        if (options.moduleType && options.moduleId) {
          console.error(`  3. 通过moduleType和moduleId查找`);
        }
        throw new Error('任务不存在');
      }

      const task = tasks[0];
      if (task.assigneeId !== userId) {
        throw new Error('无权操作此任务');
      }

      if (task.status !== 'pending') {
        throw new Error('任务已处理');
      }

      // 获取节点实例和流程实例
      const [nodeInstances] = await connection.execute(
        'SELECT * FROM workflow_node_instances WHERE id = ?',
        [task.nodeInstanceId]
      );
      if (nodeInstances.length === 0) {
        throw new Error('节点实例不存在');
      }
      const nodeInstance = nodeInstances[0];

      const instance = await WorkflowInstance.findById(task.instanceId);
      if (!instance) {
        throw new Error('流程实例不存在');
      }

      // 获取用户信息
      const user = await User.findById(userId);
      const operatorName = user ? user.name : '';

      // 更新任务状态
      let taskStatus = 'approved';
      let taskAction = 'approve';

      if (action === 'reject') {
        taskStatus = 'rejected';
        taskAction = 'reject';
      } else if (action === 'return') {
        taskStatus = 'returned';
        taskAction = 'return';
      } else if (action === 'transfer') {
        taskStatus = 'transferred';
        taskAction = 'transfer';
      }

      await connection.execute(
        `UPDATE workflow_tasks 
        SET status = ?, action = ?, comment = ?, approvedAt = NOW(), 
            returnToNodeKey = ?, transferToUserId = ?, updatedAt = NOW()
        WHERE id = ?`,
        [
          taskStatus,
          taskAction,
          comment,
          options.returnToNodeKey || null,
          options.transferToUserId || null,
          taskId
        ]
      );

      // 更新待办状态（同时支持单数和复数形式的 moduleType）
      // 优先通过taskId查找待办（更精确），如果没有找到，再通过moduleType和assigneeId查找
      let todoRows = [];
      
        // 方法1：通过taskId查找（最精确）
        // 使用更兼容的方式：先查询所有符合条件的记录，然后在代码中过滤
        const [todoRowsByTaskIdRaw] = await connection.execute(
          `SELECT id, assigneeId, metadata FROM todos 
          WHERE type = 'approval' AND status = 'pending'`,
          []
        );
        
        // 在代码中过滤metadata中包含taskId的记录
        const todoRowsByTaskId = todoRowsByTaskIdRaw.filter(row => {
          try {
            const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
            return metadata && metadata.taskId === taskId;
          } catch (e) {
            return false;
          }
        });
      
      if (todoRowsByTaskId.length > 0) {
        todoRows = todoRowsByTaskId;
        console.log(`[handleTask] 通过taskId找到 ${todoRows.length} 个待办`);
      } else {
        // 方法2：通过moduleType、moduleId和assigneeId查找（备用方法）
        const [todoRowsByModule] = await connection.execute(
          `SELECT id, assigneeId, metadata FROM todos 
          WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND assigneeId = ? AND type = 'approval' AND status = 'pending'`,
          [instance.moduleType, instance.moduleType === 'contracts' ? 'contract' : (instance.moduleType === 'opportunities' ? 'opportunity' : instance.moduleType), instance.moduleId, userId]
        );
        todoRows = todoRowsByModule;
        console.log(`[handleTask] 通过moduleType找到 ${todoRows.length} 个待办`);
      }
      
      if (todoRows.length > 0) {
        for (const todoRow of todoRows) {
          // 解析现有的metadata
          let metadata = {};
          try {
            if (todoRow.metadata) {
              metadata = typeof todoRow.metadata === 'string' ? JSON.parse(todoRow.metadata) : todoRow.metadata;
            }
          } catch (parseError) {
            console.warn('[workflowEngine] 解析待办metadata失败，使用空对象:', parseError.message);
            metadata = {};
          }
          
          // 更新metadata
          metadata.action = action;
          metadata.comment = comment;
          
          // 根据操作类型设置待办状态
          // 注意：todos表的status字段是ENUM('pending','in_progress','completed','cancelled')
          // 退回：设置为cancelled（因为退回的待办确实是被取消了）
          // 拒绝：设置为cancelled（拒绝后待办应该被取消）
          // 审批通过：设置为completed（这样就不会出现在"待我处理"列表中了）
          let todoStatus = 'completed';
          if (action === 'return') {
            todoStatus = 'cancelled'; // 使用cancelled表示退回
            metadata.returned = true; // 在metadata中标记为退回
            metadata.returnToNodeKey = options.returnToNodeKey || null; // 记录退回目标节点
          } else if (action === 'reject') {
            todoStatus = 'cancelled'; // 拒绝后待办应该被取消
            metadata.rejected = true; // 在metadata中标记为拒绝
          }
          if (metadata.dingTalkRecordId) {
            metadata.dingTalkCompleted = true;
          }
          
          // 保存更新后的metadata和状态
          // 重要：必须立即更新状态，确保待办从"待我处理"列表中消失
          await connection.execute(
            `UPDATE todos 
            SET status = ?, completedAt = NOW(), 
                metadata = ?
            WHERE id = ?`,
            [todoStatus, JSON.stringify(metadata), todoRow.id]
          );
          console.log(`[handleTask] ✅ 已更新待办 ${todoRow.id} 状态为 ${todoStatus}，待办将从"待我处理"列表中消失`);
          
          // 验证更新是否成功
          const [verifyTodo] = await connection.execute(
            `SELECT status FROM todos WHERE id = ?`,
            [todoRow.id]
          );
          if (verifyTodo.length > 0) {
            console.log(`[handleTask] ✅ 验证：待办 ${todoRow.id} 当前状态为 ${verifyTodo[0].status}`);
          }

          completeDingTalkTodoIfNeeded(metadata, todoRow.assigneeId);
        }
      } else {
        console.warn(`[handleTask] ⚠️  未找到待处理的待办，taskId: ${taskId}, userId: ${userId}, moduleType: ${instance.moduleType}, moduleId: ${instance.moduleId}`);
        
        // 如果通过taskId找不到，尝试通过moduleType和moduleId查找
        console.log(`[handleTask] 🔍 尝试通过moduleType和moduleId查找待办...`);
        const [fallbackTodos] = await connection.execute(
          `SELECT id, assigneeId, metadata FROM todos 
           WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND assigneeId = ? AND type = 'approval' AND status = 'pending'`,
          [
            instance.moduleType,
            instance.moduleType === 'contracts' ? 'contract' : (instance.moduleType === 'opportunities' ? 'opportunity' : instance.moduleType),
            instance.moduleId,
            userId
          ]
        );
        
        if (fallbackTodos.length > 0) {
          console.log(`[handleTask] ✅ 通过moduleType找到 ${fallbackTodos.length} 个待办，开始更新状态...`);
          for (const todoRow of fallbackTodos) {
            let metadata = {};
            try {
              if (todoRow.metadata) {
                metadata = typeof todoRow.metadata === 'string' ? JSON.parse(todoRow.metadata) : todoRow.metadata;
              }
            } catch (parseError) {
              metadata = {};
            }
            
            metadata.action = action;
            metadata.comment = comment;
            
            let todoStatus = 'completed';
            if (action === 'return') {
              todoStatus = 'cancelled';
              metadata.returned = true;
              metadata.returnToNodeKey = options.returnToNodeKey || null;
            } else if (action === 'reject') {
              todoStatus = 'cancelled';
              metadata.rejected = true;
            }
            if (metadata.dingTalkRecordId) {
              metadata.dingTalkCompleted = true;
            }
            
            await connection.execute(
              `UPDATE todos 
              SET status = ?, completedAt = NOW(), 
                  metadata = ?
              WHERE id = ?`,
              [todoStatus, JSON.stringify(metadata), todoRow.id]
            );
            console.log(`[handleTask] ✅ 已更新待办 ${todoRow.id} 状态为 ${todoStatus}`);

            completeDingTalkTodoIfNeeded(metadata, todoRow.assigneeId);
          }
        }
      }

      // 记录历史
      // 将 action 映射为 workflow_history 表支持的 ENUM 值
      // 'approve' -> 'complete', 'reject' -> 'reject', 'return' -> 'return', 'transfer' -> 'transfer'
      let historyAction = action;
      if (action === 'approve') {
        historyAction = 'complete';
      }
      
      await connection.execute(
        `INSERT INTO workflow_history 
        (instanceId, nodeInstanceId, taskId, action, operatorId, operatorName, comment, fromNodeKey, toNodeKey) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          instance.id,
          nodeInstance.id,
          taskId,
          historyAction,
          userId,
          operatorName,
          comment,
          nodeInstance.nodeKey,
          options.returnToNodeKey || null
        ]
      );

      // 处理不同的操作（传递连接）
      if (action === 'return') {
        // 退回：退回到指定节点
        await this.handleReturn(instance.id, nodeInstance.nodeId, options.returnToNodeKey, connection);
      } else if (action === 'reject') {
        // 拒绝：结束流程
        await this.rejectWorkflow(instance.id, connection);
      } else if (action === 'approve') {
        // 审批通过：检查节点是否完成
        // 如果是或签，需要更新其他审批人的待办状态
        const nodeConfig = nodeInstance.nodeConfig ? (typeof nodeInstance.nodeConfig === 'string' ? JSON.parse(nodeInstance.nodeConfig) : nodeInstance.nodeConfig) : {};
        const approvalType = nodeConfig.approvalType || 'or'; // 'or' 或签, 'and' 会签
        
        if (approvalType === 'or') {
          // 或签：一个人审批通过后，其他人的待办应该被取消
          console.log(`[handleTask] 或签模式，审批通过后取消其他审批人的待办`);
          const [allPendingTasks] = await connection.execute(
            `SELECT id, assigneeId FROM workflow_tasks 
             WHERE instanceId = ? AND nodeInstanceId = ? AND status = 'pending' AND id != ?`,
            [instance.id, nodeInstance.id, taskId]
          );
          
          for (const pendingTask of allPendingTasks) {
            // 更新其他审批人的待办状态为cancelled
          const [otherTodos] = await connection.execute(
            `SELECT id, assigneeId, metadata FROM todos 
               WHERE type = 'approval' AND status = 'pending' 
               AND JSON_EXTRACT(metadata, '$.workflowTaskId') = ?`,
              [pendingTask.id]
            );
            
            for (const otherTodo of otherTodos) {
              let metadata = {};
              try {
                if (otherTodo.metadata) {
                  metadata = typeof otherTodo.metadata === 'string' ? JSON.parse(otherTodo.metadata) : otherTodo.metadata;
                }
              } catch (e) {}
              
              metadata.cancelledByOtherApprover = true; // 标记为被其他审批人取消
              if (metadata.dingTalkRecordId) {
                metadata.dingTalkCompleted = true;
              }
              
              await connection.execute(
                `UPDATE todos SET status = 'cancelled', completedAt = NOW(), metadata = ? WHERE id = ?`,
                [JSON.stringify(metadata), otherTodo.id]
              );
              console.log(`[handleTask] ✅ 已取消其他审批人的待办 ${otherTodo.id}`);

              completeDingTalkTodoIfNeeded(metadata, otherTodo.assigneeId);
            }
            
            // 更新workflow_tasks状态
            await connection.execute(
              `UPDATE workflow_tasks SET status = 'cancelled', updatedAt = NOW() WHERE id = ?`,
              [pendingTask.id]
            );
          }
        }
        
        await this.checkNodeCompletion(instance.id, nodeInstance.id, nodeInstance.nodeId, connection);
      } else if (action === 'transfer') {
        // 转办：将任务转给其他用户
        if (options.transferToUserId) {
          await this.transferTask(taskId, options.transferToUserId, connection);
        }
      }

      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 检查节点是否完成
   */
  async checkNodeCompletion(instanceId, nodeInstanceId, nodeId, providedConnection = null) {
    const connection = providedConnection || await pool.getConnection();
    const shouldRelease = !providedConnection;
    try {
      // 获取节点配置
      const [nodes] = await connection.execute('SELECT * FROM workflow_nodes WHERE id = ?', [nodeId]);
      if (nodes.length === 0) return;

      const node = nodes[0];
      const nodeConfig = node.config ? (typeof node.config === 'string' ? JSON.parse(node.config) : node.config) : {};
      const approvalType = nodeConfig.approvalType || 'or'; // 'or' 或签, 'and' 会签

      // 获取该节点的所有任务
      const [tasks] = await connection.execute(
        'SELECT * FROM workflow_tasks WHERE nodeInstanceId = ?',
        [nodeInstanceId]
      );

      const pendingTasks = tasks.filter(t => t.status === 'pending');
      const approvedTasks = tasks.filter(t => t.status === 'approved');

      let nodeCompleted = false;

      if (approvalType === 'or') {
        // 或签：只要有一个通过即可
        nodeCompleted = approvedTasks.length > 0;
      } else {
        // 会签：需要所有人通过
        nodeCompleted = pendingTasks.length === 0 && approvedTasks.length > 0;
      }

      if (nodeCompleted) {
        // 节点完成，执行下一个节点
        await connection.execute(
          'UPDATE workflow_node_instances SET status = "completed", endTime = NOW() WHERE id = ?',
          [nodeInstanceId]
        );

        // 获取流程实例的元数据（使用当前连接）
        const [instances] = await connection.execute(
          'SELECT * FROM workflow_instances WHERE id = ?',
          [instanceId]
        );
        const instance = instances[0];
        if (instance) {
          // 节点完成后，将该节点的所有待处理待办标记为已完成
          // 因为节点已完成，所有相关的待办都应该不再显示在"待我处理"中
          // 使用更兼容的方式：先查询workflow_tasks，然后查询todos并过滤
          const [tasksForNode] = await connection.execute(
            `SELECT id FROM workflow_tasks WHERE nodeInstanceId = ? AND status = 'pending'`,
            [nodeInstanceId]
          );
          
          const taskIds = tasksForNode.map(t => t.id);
          let nodeInstanceTodos = [];
          
          if (taskIds.length > 0) {
            const placeholders = taskIds.map(() => '?').join(',');
            const [todosRaw] = await connection.execute(
              `SELECT id, metadata FROM todos 
               WHERE type = 'approval' AND status = 'pending'`,
              []
            );
            
            // 在代码中过滤metadata中包含taskId的记录
            nodeInstanceTodos = todosRaw.filter(row => {
              try {
                const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
                return metadata && metadata.taskId && taskIds.includes(metadata.taskId);
              } catch (e) {
                return false;
              }
            });
          }
          
          if (nodeInstanceTodos.length > 0) {
            const todoIds = nodeInstanceTodos.map(t => t.id);
            const placeholders = todoIds.map(() => '?').join(',');
            await connection.execute(
              `UPDATE todos 
               SET status = 'completed', completedAt = NOW() 
               WHERE id IN (${placeholders})`,
              todoIds
            );
            console.log(`[checkNodeCompletion] ✅ 节点完成后，已将 ${nodeInstanceTodos.length} 个待办标记为已完成`);
          }
          
          if (instance.metadata) {
            instance.metadata = typeof instance.metadata === 'string' ? JSON.parse(instance.metadata) : instance.metadata;
          }
          
          await this.executeNextNodes(instanceId, node.id, instance.metadata || {}, connection);
        }
      }
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }

  /**
   * 处理退回
   */
  async handleReturn(instanceId, currentNodeId, returnToNodeKey, providedConnection = null) {
    const connection = providedConnection || await pool.getConnection();
    const shouldRelease = !providedConnection;
    try {
      console.log('[handleReturn] 开始处理退回，instanceId:', instanceId, 'returnToNodeKey:', returnToNodeKey);
      
      // 先获取流程实例信息
      const [instances] = await connection.execute(
        'SELECT * FROM workflow_instances WHERE id = ?',
        [instanceId]
      );
      
      if (instances.length === 0) {
        throw new Error('流程实例不存在');
      }
      
      const instance = instances[0];
      const workflowId = instance.workflowId;
      console.log('[handleReturn] 流程实例信息:', {
        id: instance.id,
        workflowId: workflowId,
        currentNodeKey: instance.currentNodeKey,
        moduleType: instance.moduleType,
        moduleId: instance.moduleId
      });
      
      // 获取目标节点
      console.log('[handleReturn] 查询目标节点，workflowId:', workflowId, 'nodeKey:', returnToNodeKey);
      const [targetNodes] = await connection.execute(
        'SELECT * FROM workflow_nodes WHERE workflowId = ? AND nodeKey = ?',
        [workflowId, returnToNodeKey]
      );

      console.log('[handleReturn] 找到目标节点数量:', targetNodes.length);
      
      if (targetNodes.length === 0) {
        // 如果通过nodeKey没找到，尝试通过nodeType查找（如果returnToNodeKey是'start'）
        if (returnToNodeKey === 'start' || returnToNodeKey === '开始') {
          console.log('[handleReturn] 通过nodeKey未找到，尝试通过nodeType="start"查找开始节点');
          const [startNodes] = await connection.execute(
            'SELECT * FROM workflow_nodes WHERE workflowId = ? AND nodeType = "start" ORDER BY sortOrder LIMIT 1',
            [workflowId]
          );
          
          if (startNodes.length > 0) {
            console.log('[handleReturn] ✅ 通过nodeType找到开始节点:', startNodes[0].nodeKey);
            targetNodes.push(startNodes[0]);
          }
        }
        
        // 如果还是没找到，列出所有可用节点，帮助调试
        if (targetNodes.length === 0) {
          const [allNodes] = await connection.execute(
            'SELECT id, nodeKey, nodeType, name FROM workflow_nodes WHERE workflowId = ?',
            [workflowId]
          );
          console.error('[handleReturn] ❌ 目标节点不存在，可用节点列表:', allNodes);
          throw new Error(`退回目标节点不存在: nodeKey="${returnToNodeKey}"。可用节点: ${allNodes.map(n => `${n.nodeKey}(${n.nodeType})`).join(', ')}`);
        }
      }

      const targetNode = targetNodes[0];
      console.log('[handleReturn] ✅ 找到目标节点:', {
        id: targetNode.id,
        nodeKey: targetNode.nodeKey,
        nodeType: targetNode.nodeType,
        name: targetNode.name
      });

      // 退回时，先清理旧的待处理任务和节点实例，避免重复创建
      console.log('[handleReturn] 清理旧的待处理任务和节点实例...');
      
      // 1. 取消所有待处理的任务（pending状态）
      const [pendingTasks] = await connection.execute(
        'SELECT id FROM workflow_tasks WHERE instanceId = ? AND status = "pending"',
        [instanceId]
      );
      if (pendingTasks.length > 0) {
        await connection.execute(
          'UPDATE workflow_tasks SET status = "cancelled", updatedAt = NOW() WHERE instanceId = ? AND status = "pending"',
          [instanceId]
        );
        console.log(`[handleReturn] ✅ 已取消 ${pendingTasks.length} 个待处理任务`);
      }
      
      // 2. 取消所有待处理的待办（pending状态）
      const [pendingTodos] = await connection.execute(
        'SELECT id FROM todos WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND type = "approval" AND status = "pending"',
        [instance.moduleType, instance.moduleType === 'contracts' ? 'contract' : (instance.moduleType === 'opportunities' ? 'opportunity' : instance.moduleType), instance.moduleId]
      );
      if (pendingTodos.length > 0) {
        await connection.execute(
          'UPDATE todos SET status = "cancelled", updatedAt = NOW() WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND type = "approval" AND status = "pending"',
          [instance.moduleType, instance.moduleType === 'contracts' ? 'contract' : (instance.moduleType === 'opportunities' ? 'opportunity' : instance.moduleType), instance.moduleId]
        );
        console.log(`[handleReturn] ✅ 已取消 ${pendingTodos.length} 个待处理待办`);
      }
      
      // 3. 完成所有运行中的节点实例（除了目标节点）
      // 注意：workflow_node_instances.status 支持的值：'pending','running','completed','rejected','skipped','returned'
      // 退回时，将运行中的节点标记为 'rejected'（已拒绝）
      const [runningNodeInstances] = await connection.execute(
        'SELECT id FROM workflow_node_instances WHERE instanceId = ? AND status = "running" AND nodeId != ?',
        [instanceId, targetNode.id]
      );
      if (runningNodeInstances.length > 0) {
        await connection.execute(
          'UPDATE workflow_node_instances SET status = "rejected", endTime = NOW() WHERE instanceId = ? AND status = "running" AND nodeId != ?',
          [instanceId, targetNode.id]
        );
        console.log(`[handleReturn] ✅ 已拒绝 ${runningNodeInstances.length} 个运行中的节点实例`);
      }

      // 更新流程实例的当前节点（使用当前连接）
      await connection.execute(
        'UPDATE workflow_instances SET currentNodeId = ?, currentNodeKey = ?, updatedAt = NOW() WHERE id = ?',
        [targetNode.id, targetNode.nodeKey, instanceId]
      );

      // 使用之前获取的流程实例信息（避免重复查询）
      if (instance && instance.metadata) {
        instance.metadata = typeof instance.metadata === 'string' ? JSON.parse(instance.metadata) : instance.metadata;
      }
      
      // 退回：更新关联模块的状态为草稿，可以重新发起审批
      const moduleType = instance.moduleType;
      const moduleId = instance.moduleId;
      
      if (moduleType === 'contract' || moduleType === 'contracts') {
        const Contract = require('../models/Contract');
        await Contract.findByIdAndUpdate(moduleId, { status: 'draft' });
      } else if (moduleType === 'opportunity' || moduleType === 'opportunities') {
        const Opportunity = require('../models/Opportunity');
        await Opportunity.findByIdAndUpdate(moduleId, { status: 'new' });
      } else if (moduleType === 'invoice' || moduleType === 'invoices') {
        const Invoice = require('../models/Invoice');
        await Invoice.findByIdAndUpdate(moduleId, { status: 'draft' });
      }
      
      // 执行目标节点（传递连接）
      // 注意：如果目标节点是开始节点，它会自动执行后续节点
      console.log('[handleReturn] 执行目标节点:', targetNode.nodeKey, targetNode.nodeType);
      await this.executeNode(instanceId, targetNode.id, instance.metadata || {}, connection);
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }

  /**
   * 拒绝流程
   */
  async rejectWorkflow(instanceId, providedConnection = null) {
    const connection = providedConnection || await pool.getConnection();
    const shouldRelease = !providedConnection;
    try {
      // 获取实例信息
      const [instances] = await connection.execute(
        'SELECT * FROM workflow_instances WHERE id = ?',
        [instanceId]
      );
      
      if (instances.length === 0) return;
      
      const instance = instances[0];
      const startTime = new Date(instance.startTime);
      const endTime = new Date();
      const duration = Math.floor((endTime - startTime) / 1000);
      
      await connection.execute(
        'UPDATE workflow_instances SET status = ?, endTime = ?, duration = ?, updatedAt = NOW() WHERE id = ?',
        ['rejected', endTime, duration, instanceId]
      );
      
      // 拒绝流程：取消所有待处理的待办（设置为cancelled，不再出现在"待我处理"中）
      const moduleType = instance.moduleType;
      const moduleId = instance.moduleId;
      
      // 取消所有待处理的待办
      await connection.execute(
        `UPDATE todos 
         SET status = 'cancelled', completedAt = NOW() 
         WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND type = 'approval' AND status = 'pending'`,
        [moduleType, moduleType === 'contracts' ? 'contract' : (moduleType === 'opportunities' ? 'opportunity' : moduleType), moduleId]
      );
      console.log(`[rejectWorkflow] ✅ 已取消所有待处理的待办`);
      
      // 更新关联模块的状态为已拒绝（rejected），流程结束，不再显示"发起审批"按钮
      if (moduleType === 'contract' || moduleType === 'contracts') {
        const Contract = require('../models/Contract');
        await Contract.findByIdAndUpdate(moduleId, { status: 'rejected' });
      } else if (moduleType === 'opportunity' || moduleType === 'opportunities') {
        const Opportunity = require('../models/Opportunity');
        await Opportunity.findByIdAndUpdate(moduleId, { status: 'rejected' });
      } else if (moduleType === 'invoice' || moduleType === 'invoices') {
        const Invoice = require('../models/Invoice');
        await Invoice.findByIdAndUpdate(moduleId, { status: 'rejected' });
      }
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }

  /**
   * 完成流程
   */
  async completeWorkflow(instanceId, providedConnection = null) {
    const connection = providedConnection || await pool.getConnection();
    const shouldRelease = !providedConnection;
    try {
      // 获取实例信息
      const [instances] = await connection.execute(
        'SELECT * FROM workflow_instances WHERE id = ?',
        [instanceId]
      );
      
      if (instances.length === 0) return;
      
      const instance = instances[0];
      const startTime = new Date(instance.startTime);
      const endTime = new Date();
      const duration = Math.floor((endTime - startTime) / 1000);
      
      await connection.execute(
        'UPDATE workflow_instances SET status = ?, endTime = ?, duration = ?, updatedAt = NOW() WHERE id = ?',
        ['completed', endTime, duration, instanceId]
      );
      
      // 流程完成：将所有待处理的待办标记为已完成（不再出现在"待我处理"中）
      const moduleType = instance.moduleType;
      const moduleId = instance.moduleId;
      
      // 将所有待处理的待办标记为已完成
      await connection.execute(
        `UPDATE todos 
         SET status = 'completed', completedAt = NOW() 
         WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND type = 'approval' AND status = 'pending'`,
        [moduleType, moduleType === 'contracts' ? 'contract' : (moduleType === 'opportunities' ? 'opportunity' : moduleType), moduleId]
      );
      console.log(`[completeWorkflow] ✅ 已将待处理的待办标记为已完成`);
      
      // 更新关联模块的状态为已审批
      
      if (moduleType === 'contract' || moduleType === 'contracts') {
        const Contract = require('../models/Contract');
        await Contract.findByIdAndUpdate(moduleId, { status: 'approved' });
      } else if (moduleType === 'opportunity' || moduleType === 'opportunities') {
        const Opportunity = require('../models/Opportunity');
        await Opportunity.findByIdAndUpdate(moduleId, { status: 'approved' });
      } else if (moduleType === 'invoice' || moduleType === 'invoices') {
        const Invoice = require('../models/Invoice');
        await Invoice.findByIdAndUpdate(moduleId, { status: 'issued' });
      }
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }

  /**
   * 撤回流程（只有提交人可以撤回）
   */
  async withdrawWorkflow(instanceId, userId, comment = '', providedConnection = null) {
    const connection = providedConnection || await pool.getConnection();
    const shouldRelease = !providedConnection;
    try {
      await connection.beginTransaction();
      
      // 获取流程实例
      const [instances] = await connection.execute(
        'SELECT * FROM workflow_instances WHERE id = ?',
        [instanceId]
      );
      
      if (instances.length === 0) {
        throw new Error('流程实例不存在');
      }
      
      const instance = instances[0];
      
      // 检查是否是提交人
      if (instance.initiatorId !== userId) {
        throw new Error('只有流程提交人可以撤回流程');
      }
      
      // 检查流程状态
      if (instance.status !== 'running') {
        throw new Error('只能撤回运行中的流程');
      }
      
      // 获取用户信息
      const user = await User.findById(userId);
      const operatorName = user ? user.name : '';
      
      const startTime = new Date(instance.startTime);
      const endTime = new Date();
      const duration = Math.floor((endTime - startTime) / 1000);
      
      // 更新流程实例状态为已撤回
      await connection.execute(
        'UPDATE workflow_instances SET status = ?, endTime = ?, duration = ?, updatedAt = NOW() WHERE id = ?',
        ['withdrawn', endTime, duration, instanceId]
      );
      
      // 取消所有待处理的任务（使用 'skipped' 状态，因为 ENUM 中没有 'cancelled'）
      await connection.execute(
        `UPDATE workflow_tasks 
         SET status = 'skipped', updatedAt = NOW() 
         WHERE instanceId = ? AND status = 'pending'`,
        [instanceId]
      );
      
      // 取消所有待处理的节点实例（使用 'skipped' 状态，因为 ENUM 中没有 'cancelled'）
      await connection.execute(
        `UPDATE workflow_node_instances 
         SET status = 'skipped', endTime = NOW() 
         WHERE instanceId = ? AND status IN ('pending', 'running')`,
        [instanceId]
      );
      
      // 更新待办事项状态
      await connection.execute(
        `UPDATE todos 
         SET status = 'cancelled', completedAt = NOW() 
         WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND type = 'approval' AND status = 'pending'`,
        [instance.moduleType, instance.moduleType === 'contracts' ? 'contract' : (instance.moduleType === 'opportunities' ? 'opportunity' : instance.moduleType), instance.moduleId]
      );
      
      // 记录历史
      await connection.execute(
        `INSERT INTO workflow_history 
        (instanceId, action, operatorId, operatorName, comment, createdAt) 
        VALUES (?, 'withdraw', ?, ?, ?, NOW())`,
        [instanceId, userId, operatorName, comment || '撤回流程']
      );
      
      // 更新关联模块的状态为草稿/新建
      const moduleType = instance.moduleType;
      const moduleId = instance.moduleId;
      
      if (moduleType === 'contract' || moduleType === 'contracts') {
        const Contract = require('../models/Contract');
        await Contract.findByIdAndUpdate(moduleId, { status: 'draft' });
      } else if (moduleType === 'opportunity' || moduleType === 'opportunities') {
        const Opportunity = require('../models/Opportunity');
        await Opportunity.findByIdAndUpdate(moduleId, { status: 'new' });
      } else if (moduleType === 'invoice' || moduleType === 'invoices') {
        const Invoice = require('../models/Invoice');
        await Invoice.findByIdAndUpdate(moduleId, { status: 'draft' });
      }
      
      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }

  /**
   * 转办任务
   */
  async transferTask(taskId, transferToUserId, providedConnection = null) {
    const connection = providedConnection || await pool.getConnection();
    const shouldRelease = !providedConnection;
    try {
      // 更新任务
      await connection.execute(
        'UPDATE workflow_tasks SET assigneeId = ?, transferToUserId = ?, updatedAt = NOW() WHERE id = ?',
        [transferToUserId, transferToUserId, taskId]
      );

      // 更新待办
      const [tasks] = await connection.execute('SELECT * FROM workflow_tasks WHERE id = ?', [taskId]);
      if (tasks.length > 0) {
        const task = tasks[0];
        
        // 获取流程实例（使用当前连接）
        const [instances] = await connection.execute(
          'SELECT * FROM workflow_instances WHERE id = ?',
          [task.instanceId]
        );
        
        if (instances.length > 0) {
          const instance = instances[0];
          // 使用更兼容的方式：先查询符合条件的记录，然后在代码中过滤
          const [todosRaw] = await connection.execute(
            `SELECT id, metadata FROM todos 
             WHERE (moduleType = ? OR moduleType = ?) AND moduleId = ? AND type = 'approval' AND status = 'pending'`,
            [instance.moduleType, instance.moduleType === 'contracts' ? 'contract' : (instance.moduleType === 'opportunities' ? 'opportunity' : instance.moduleType), instance.moduleId]
          );
          
          // 在代码中过滤metadata中包含nodeInstanceId的记录
          const filteredTodos = todosRaw.filter(row => {
            try {
              const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
              return metadata && metadata.nodeInstanceId === task.nodeInstanceId;
            } catch (e) {
              return false;
            }
          });
          
          if (filteredTodos.length > 0) {
            const todoIds = filteredTodos.map(t => t.id);
            const placeholders = todoIds.map(() => '?').join(',');
            await connection.execute(
              `UPDATE todos SET assigneeId = ?, updatedAt = NOW() WHERE id IN (${placeholders})`,
              [transferToUserId, ...todoIds]
            );
          }
        }
      }
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }

  /**
   * 执行并行节点
   */
  async executeParallelNode(instanceId, nodeInstanceId, node, nodeConfig, moduleData, providedConnection = null) {
    const connection = providedConnection || await pool.getConnection();
    const shouldRelease = !providedConnection;
    try {
      // 并行节点：创建多个分支，每个分支独立执行
      // 这里简化处理，实际应该创建多个分支实例
      await this.executeNextNodes(instanceId, node.id, moduleData, connection);
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }

  /**
   * 执行合并节点
   */
  async executeMergeNode(instanceId, nodeInstanceId, node, nodeConfig, moduleData, providedConnection = null) {
    const connection = providedConnection || await pool.getConnection();
    const shouldRelease = !providedConnection;
    try {
      // 合并节点：等待所有分支完成后再继续
      // 这里简化处理，实际应该检查所有分支是否完成
      await this.executeNextNodes(instanceId, node.id, moduleData, connection);
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }
}

module.exports = new WorkflowEngine();

