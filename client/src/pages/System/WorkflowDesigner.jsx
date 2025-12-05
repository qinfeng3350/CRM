import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Drawer,
  Tabs,
  Checkbox,
  Table,
  Tag,
  Switch,
  Divider,
  Popconfirm,
  Tooltip,
  Alert,
  Timeline,
  Row,
  Col,
} from 'antd';
import {
  SaveOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined,
  EyeOutlined,
  EditOutlined,
  LockOutlined,
  ArrowRightOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { workflowService } from '../../services/workflowService';
import { userService } from '../../services/userService';
import { departmentService } from '../../services/departmentService';
import { moduleService } from '../../services/moduleService';

const { Option } = Select;
const { TextArea } = Input;

// 节点类型配置
const NODE_TYPES = [
  { value: 'start', label: '开始', color: '#52c41a', icon: '▶' },
  { value: 'end', label: '结束', color: '#ff4d4f', icon: '■' },
  { value: 'approval', label: '审批', color: '#1890ff', icon: '✓' },
  { value: 'condition', label: '条件', color: '#faad14', icon: '?' },
  { value: 'parallel', label: '并行', color: '#722ed1', icon: '∥' },
  { value: 'merge', label: '合并', color: '#13c2c2', icon: '∪' },
];

// 操作符选项
const OPERATORS = [
  { value: 'eq', label: '等于 (=)' },
  { value: 'ne', label: '不等于 (≠)' },
  { value: 'gt', label: '大于 (>)' },
  { value: 'gte', label: '大于等于 (≥)' },
  { value: 'lt', label: '小于 (<)' },
  { value: 'lte', label: '小于等于 (≤)' },
  { value: 'in', label: '在列表中' },
  { value: 'not_in', label: '不在列表中' },
  { value: 'contains', label: '包含' },
  { value: 'not_contains', label: '不包含' },
  { value: 'between', label: '在范围内' },
  { value: 'is_null', label: '为空' },
  { value: 'is_not_null', label: '不为空' },
];

const WorkflowDesigner = () => {
  const [workflows, setWorkflows] = useState([]);
  const [currentWorkflow, setCurrentWorkflow] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [configDrawerVisible, setConfigDrawerVisible] = useState(false);
  const [fieldPermissionDrawerVisible, setFieldPermissionDrawerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [workflowForm] = Form.useForm();
  const [nodeForm] = Form.useForm();
  const [fieldPermissionForm] = Form.useForm();
  const canvasRef = useRef(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeConfigDrawerVisible, setRouteConfigDrawerVisible] = useState(false);
  const [routeForm] = Form.useForm();
  const [moduleFields, setModuleFields] = useState([]); // 模块字段列表
  const [availableModules, setAvailableModules] = useState([]); // 可用模块列表
  const [showList, setShowList] = useState(true); // 是否显示流程列表
  const [logModalVisible, setLogModalVisible] = useState(false); // 流程日志Modal
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null); // 选中的流程ID
  const [workflowInstances, setWorkflowInstances] = useState([]); // 流程实例列表
  const [workflowHistory, setWorkflowHistory] = useState([]); // 流程历史记录
  const [loadingLogs, setLoadingLogs] = useState(false); // 加载日志状态

  useEffect(() => {
    loadWorkflows();
    loadUsers();
    loadDepartments();
    loadAvailableModules();
  }, []);

  const loadAvailableModules = async () => {
    try {
      const response = await moduleService.getModules();
      if (response.success) {
        setAvailableModules(response.data || []);
      }
    } catch (error) {
      console.error('加载模块列表失败:', error);
    }
  };

  const loadModuleFields = async (moduleCode) => {
    if (!moduleCode) {
      setModuleFields([]);
      return;
    }
    try {
      const response = await moduleService.getModuleFields(moduleCode);
      if (response.success) {
        setModuleFields(response.data || []);
      }
    } catch (error) {
      console.error('加载字段列表失败:', error);
      setModuleFields([]);
    }
  };

  // 加载流程日志
  const loadWorkflowLogs = async (workflowId) => {
    setLoadingLogs(true);
    try {
      // 获取流程实例
      const instancesResponse = await workflowService.getWorkflowInstances({ workflowId });
      if (instancesResponse.success) {
        setWorkflowInstances(instancesResponse.data || []);
        
        // 获取所有实例的历史记录
        const allHistory = [];
        for (const instance of instancesResponse.data || []) {
          try {
            const instanceResponse = await workflowService.getWorkflowInstance(instance.id);
            if (instanceResponse.success && instanceResponse.data) {
              const history = instanceResponse.data.history || [];
              allHistory.push(...history.map(h => ({ ...h, instanceId: instance.id, instance: instance })));
            }
          } catch (error) {
            console.error(`加载实例 ${instance.id} 的历史记录失败:`, error);
          }
        }
        
        // 按时间排序
        allHistory.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setWorkflowHistory(allHistory);
      }
    } catch (error) {
      console.error('加载流程日志失败:', error);
      message.error('加载流程日志失败');
    } finally {
      setLoadingLogs(false);
    }
  };

  // 模块字段配置（根据模块类型定义可用字段，对应实际数据库表字段）- 保留作为备用
  const MODULE_FIELDS = {
    contract: [
      { name: 'contractNumber', label: '合同编号', type: 'string' },
      { name: 'title', label: '合同标题', type: 'string' },
      { name: 'customerId', label: '客户', type: 'number' },
      { name: 'opportunityId', label: '关联商机', type: 'number' },
      { name: 'amount', label: '合同金额', type: 'number' },
      { name: 'status', label: '状态', type: 'string' },
      { name: 'ownerId', label: '负责人', type: 'number' },
      { name: 'signDate', label: '签署日期', type: 'date' },
      { name: 'startDate', label: '开始日期', type: 'date' },
      { name: 'endDate', label: '结束日期', type: 'date' },
      { name: 'content', label: '合同内容', type: 'text' },
      { name: 'paymentPlan', label: '付款计划', type: 'json' },
    ],
    opportunity: [
      { name: 'name', label: '商机名称', type: 'string' },
      { name: 'customerId', label: '客户', type: 'number' },
      { name: 'amount', label: '预计金额', type: 'number' },
      { name: 'status', label: '状态', type: 'string' },
      { name: 'ownerId', label: '负责人', type: 'number' },
      { name: 'probability', label: '成交概率(%)', type: 'number' },
      { name: 'expectedCloseDate', label: '预计成交日期', type: 'date' },
      { name: 'actualCloseDate', label: '实际成交日期', type: 'date' },
      { name: 'description', label: '描述', type: 'text' },
      { name: 'source', label: '来源', type: 'string' },
    ],
    expense: [
      { name: 'title', label: '费用标题', type: 'string' },
      { name: 'amount', label: '费用金额', type: 'number' },
      { name: 'category', label: '费用类别', type: 'string' },
      { name: 'status', label: '状态', type: 'string' },
      { name: 'description', label: '描述', type: 'text' },
      { name: 'expenseDate', label: '费用日期', type: 'date' },
    ],
    payment: [
      { name: 'amount', label: '付款金额', type: 'number' },
      { name: 'contractId', label: '关联合同', type: 'number' },
      { name: 'status', label: '状态', type: 'string' },
      { name: 'dueDate', label: '到期日期', type: 'date' },
      { name: 'paidDate', label: '付款日期', type: 'date' },
      { name: 'paymentMethod', label: '付款方式', type: 'string' },
      { name: 'description', label: '描述', type: 'text' },
    ],
  };

  useEffect(() => {
    if (currentWorkflow?.moduleType) {
      loadModuleFields(currentWorkflow.moduleType);
    }
  }, [currentWorkflow?.moduleType]);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const response = await workflowService.getWorkflowDefinitions({ page: 1, limit: 100 });
      if (response.success) {
        setWorkflows(response.data || []);
      }
    } catch (error) {
      message.error('加载流程列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      // 加载所有用户（设置较大的limit，确保获取所有用户）
      const response = await userService.getUsers({ page: 1, limit: 1000 });
      if (response.success) {
        const usersList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        console.log(`[WorkflowDesigner] 加载了 ${usersList.length} 个用户`);
        setUsers(usersList);
      }
    } catch (error) {
      console.error('加载用户列表失败:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await departmentService.getDepartments();
      if (response.success) {
        setDepartments(response.data || []);
      }
    } catch (error) {
      console.error('加载部门列表失败:', error);
    }
  };

  const handleCreateWorkflow = () => {
    setCurrentWorkflow(null);
    setNodes([]);
    setRoutes([]);
    setSelectedNode(null);
    setModuleFields([]);
    setShowList(false);
    workflowForm.resetFields();
    workflowForm.setFieldsValue({
      isActive: true,
      priority: 0,
    });
  };

  const handleLoadWorkflow = async (workflow) => {
    try {
      const response = await workflowService.getWorkflowDefinition(workflow.id);
      if (response.success) {
        const data = response.data;
        setCurrentWorkflow(data);
        setNodes(data.nodes || []);
        setRoutes(data.routes || []);
        workflowForm.setFieldsValue({
          name: data.name,
          code: data.code,
          moduleType: data.moduleType,
          description: data.description,
          isActive: data.isActive,
          priority: data.priority,
        });
        message.success('流程加载成功');
      }
    } catch (error) {
      message.error('加载流程失败');
    }
  };

  const handleAddNode = (nodeType) => {
    const nodeKey = `node_${Date.now()}`;
    const nodeTypeConfig = NODE_TYPES.find(t => t.value === nodeType);
    const newNode = {
      nodeKey,
      nodeType,
      name: nodeTypeConfig?.label || nodeType,
      description: '',
      position: { x: 200 + nodes.length * 50, y: 150 + nodes.length * 80 },
      config: nodeType === 'approval' ? {
        approvalType: 'or',
        approvers: [],
        dueHours: 24,
        priority: 'medium',
      } : {},
      sortOrder: nodes.length,
    };
    setNodes([...nodes, newNode]);
    setSelectedNode(newNode);
    setConfigDrawerVisible(true);
    nodeForm.setFieldsValue(newNode);
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);
    setConfigDrawerVisible(true);
    
    // 处理审批人配置的显示
    const config = node.config || {};
    let approversValue = [];
    if (config.approvers && Array.isArray(config.approvers)) {
      approversValue = config.approvers.map(a => {
        if (a.type === 'role') return `role:${a.value}`;
        if (a.type === 'user') return `user:${a.value}`;
        if (a.type === 'department') return `dept:${a.value}`;
        return `user:${a.value}`;
      });
    }
    
    // 如果是条件节点，尝试从条件表达式中解析字段、操作符和值
    let conditionConfig = {};
    if (node.nodeType === 'condition' && config.condition) {
      // 这里可以尝试解析，但为了简单起见，我们保留原始配置
      // 如果已经有conditionField等配置，就使用它们
      if (config.conditionField) {
        conditionConfig = {
          conditionField: config.conditionField,
          conditionOperator: config.conditionOperator,
          conditionValue: config.conditionValue,
          conditionValue1: config.conditionValue1,
          conditionValue2: config.conditionValue2,
        };
      }
    }
    
    nodeForm.setFieldsValue({
      ...node,
      config: {
        ...config,
        approvers: approversValue,
        ...conditionConfig,
      },
    });
  };

  const handleNodeDelete = (nodeKey) => {
    setNodes(nodes.filter(n => n.nodeKey !== nodeKey));
    setRoutes(routes.filter(r => r.fromNodeKey !== nodeKey && r.toNodeKey !== nodeKey));
    if (selectedNode?.nodeKey === nodeKey) {
      setSelectedNode(null);
      setConfigDrawerVisible(false);
    }
  };

  const handleSaveNode = () => {
    nodeForm.validateFields().then(values => {
      const config = values.config || {};
      
      // 如果是条件节点，将选择的字段、操作符和值组合成条件表达式
      if (selectedNode.nodeType === 'condition' && config.conditionField && config.conditionOperator) {
        const field = moduleFields.find(f => f.name === config.conditionField);
        const fieldName = config.conditionField;
        const operator = config.conditionOperator;
        
        let conditionExpression = '';
        
        if (operator === 'between') {
          conditionExpression = `${fieldName} >= ${config.conditionValue1} && ${fieldName} <= ${config.conditionValue2}`;
        } else if (operator === 'in') {
          const values = config.conditionValue.split(',').map(v => {
            const trimmed = v.trim();
            if (field?.type === 'string' || field?.type === 'text') {
              return `'${trimmed}'`;
            }
            return trimmed;
          }).join(', ');
          conditionExpression = `[${values}].includes(${fieldName})`;
        } else if (operator === 'not_in') {
          const values = config.conditionValue.split(',').map(v => {
            const trimmed = v.trim();
            if (field?.type === 'string' || field?.type === 'text') {
              return `'${trimmed}'`;
            }
            return trimmed;
          }).join(', ');
          conditionExpression = `![${values}].includes(${fieldName})`;
        } else if (operator === 'is_null') {
          conditionExpression = `${fieldName} == null || ${fieldName} === ''`;
        } else if (operator === 'is_not_null') {
          conditionExpression = `${fieldName} != null && ${fieldName} !== ''`;
        } else {
          // 根据字段类型处理值
          let value = config.conditionValue;
          if (field?.type === 'string' || field?.type === 'text') {
            value = `'${value}'`;
          }
          
          const operatorMap = {
            'eq': '===',
            'ne': '!==',
            'gt': '>',
            'gte': '>=',
            'lt': '<',
            'lte': '<=',
            'contains': '.includes',
            'not_contains': '.includes',
          };
          
          const op = operatorMap[operator] || operator;
          
          if (operator === 'contains') {
            conditionExpression = `${fieldName}${op}(${value})`;
          } else if (operator === 'not_contains') {
            conditionExpression = `!${fieldName}${op}(${value})`;
          } else {
            conditionExpression = `${fieldName} ${op} ${value}`;
          }
        }
        
        config.condition = conditionExpression;
      }
      
      const updatedNodes = nodes.map(n => 
        n.nodeKey === selectedNode.nodeKey 
          ? { ...n, ...values, config: config }
          : n
      );
      setNodes(updatedNodes);
      setSelectedNode(updatedNodes.find(n => n.nodeKey === selectedNode.nodeKey));
      message.success('节点配置已保存');
    });
  };

  const handleConnectNodes = (fromNodeKey, toNodeKey) => {
    if (fromNodeKey === toNodeKey) {
      setConnectingFrom(null);
      return;
    }
    
    // 检查连接是否已存在
    const exists = routes.some(r => r.fromNodeKey === fromNodeKey && r.toNodeKey === toNodeKey);
    if (exists) {
      message.warning('连接已存在');
      setConnectingFrom(null);
      return;
    }

    const newRoute = {
      fromNodeKey,
      toNodeKey,
      conditionType: 'always',
      conditionConfig: {},
      sortOrder: routes.length,
    };
    setRoutes([...routes, newRoute]);
    setConnectingFrom(null);
    message.success('连接已创建，可以点击连接线配置条件');
  };

  const handleRouteClick = (route) => {
    setSelectedRoute(route);
    setRouteConfigDrawerVisible(true);
    routeForm.setFieldsValue({
      conditionType: route.conditionType || 'always',
      conditionConfig: route.conditionConfig || {},
    });
  };

  const handleSaveRoute = () => {
    routeForm.validateFields().then(values => {
      const updatedRoutes = routes.map(r =>
        r.fromNodeKey === selectedRoute.fromNodeKey && r.toNodeKey === selectedRoute.toNodeKey
          ? { ...r, ...values }
          : r
      );
      setRoutes(updatedRoutes);
      setRouteConfigDrawerVisible(false);
      message.success('路由配置已保存');
    });
  };

  const handleDeleteRoute = (route) => {
    setRoutes(routes.filter(r => 
      !(r.fromNodeKey === route.fromNodeKey && r.toNodeKey === route.toNodeKey)
    ));
    if (selectedRoute && 
        selectedRoute.fromNodeKey === route.fromNodeKey && 
        selectedRoute.toNodeKey === route.toNodeKey) {
      setSelectedRoute(null);
      setRouteConfigDrawerVisible(false);
    }
  };

  const handleSaveWorkflow = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      const values = await workflowForm.validateFields();
      
      if (nodes.length === 0) {
        message.error('请至少添加一个节点');
        return;
      }

      const startNode = nodes.find(n => n.nodeType === 'start');
      const endNode = nodes.find(n => n.nodeType === 'end');
      
      if (!startNode) {
        message.error('流程必须有一个开始节点');
        return;
      }
      
      if (!endNode) {
        message.error('流程必须有一个结束节点');
        return;
      }

      setSaving(true);
      
      const workflowData = {
        ...values,
        nodes: nodes.map(n => ({
          ...n,
          position: n.position || { x: 0, y: 0 },
          config: n.config || {},
        })),
        routes: routes.map(r => ({
          ...r,
          conditionConfig: r.conditionConfig || {},
        })),
      };

      let response;
      if (currentWorkflow) {
        response = await workflowService.updateWorkflowDefinition(currentWorkflow.id, workflowData);
      } else {
        response = await workflowService.createWorkflowDefinition(workflowData);
      }

      if (response.success) {
        message.success(currentWorkflow ? '流程更新成功' : '流程创建成功');
        await loadWorkflows();
        if (!currentWorkflow && response.data) {
          setCurrentWorkflow(response.data);
        }
        setShowList(true);
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error) {
      console.error('保存流程失败:', error);
      message.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFieldPermissions = () => {
    fieldPermissionForm.validateFields().then(values => {
      // 将字段权限转换为对象格式
      const fieldPermissionsObj = {};
      if (values.fieldPermissions) {
        Object.keys(values.fieldPermissions).forEach(fieldName => {
          fieldPermissionsObj[fieldName] = values.fieldPermissions[fieldName];
        });
      }
      
      // 更新选中节点的字段权限配置
      const updatedNodes = nodes.map(n => 
        n.nodeKey === selectedNode.nodeKey 
          ? { 
              ...n, 
              config: { 
                ...n.config, 
                fieldPermissions: fieldPermissionsObj
              } 
            }
          : n
      );
      setNodes(updatedNodes);
      setSelectedNode(updatedNodes.find(n => n.nodeKey === selectedNode.nodeKey));
      setFieldPermissionDrawerVisible(false);
      message.success('字段权限配置已保存');
    });
  };

  const renderNode = (node) => {
    const nodeTypeConfig = NODE_TYPES.find(t => t.value === node.nodeType);
    const isSelected = selectedNode?.nodeKey === node.nodeKey;
    
    return (
      <div
        key={node.nodeKey}
        style={{
          position: 'absolute',
          left: node.position?.x || 0,
          top: node.position?.y || 0,
          width: 120,
          height: 60,
          border: isSelected ? '2px solid #1890ff' : `2px solid ${nodeTypeConfig?.color || '#666'}`,
          borderRadius: 8,
          backgroundColor: '#fff',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isSelected ? '0 0 10px rgba(24, 144, 255, 0.5)' : '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: isSelected ? 10 : 1,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (connectingFrom && connectingFrom !== 'waiting') {
            // 连接模式：已选择起始节点，点击目标节点
            handleConnectStart(node.nodeKey);
          } else if (connectingFrom === 'waiting') {
            // 连接模式：等待选择起始节点
            handleConnectStart(node.nodeKey);
          } else {
            // 普通模式：点击节点进行配置
            handleNodeClick(node);
          }
        }}
        onMouseDown={(e) => {
          // 在连接模式下，不允许拖拽
          if (e.button === 0 && !connectingFrom) {
            setDraggingNode({ node, offsetX: e.clientX - (node.position?.x || 0), offsetY: e.clientY - (node.position?.y || 0) });
          }
        }}
      >
        <div style={{ fontSize: 20, marginBottom: 4 }}>{nodeTypeConfig?.icon}</div>
        <div style={{ fontSize: 12, fontWeight: 'bold' }}>{node.name}</div>
        {node.nodeType === 'approval' && node.config?.approvers?.length > 0 && (
          <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
            {node.config.approvers.length}人
          </div>
        )}
      </div>
    );
  };

  const renderRoute = (route) => {
    const fromNode = nodes.find(n => n.nodeKey === route.fromNodeKey);
    const toNode = nodes.find(n => n.nodeKey === route.toNodeKey);
    
    if (!fromNode || !toNode) return null;

    const fromX = (fromNode.position?.x || 0) + 60;
    const fromY = (fromNode.position?.y || 0) + 30;
    const toX = (toNode.position?.x || 0) + 60;
    const toY = (toNode.position?.y || 0) + 30;

    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;

    return (
      <g key={`${route.fromNodeKey}-${route.toNodeKey}`}>
        <line
          x1={fromX}
          y1={fromY}
          x2={toX}
          y2={toY}
          stroke={route.conditionType === 'always' ? '#1890ff' : '#faad14'}
          strokeWidth={route === selectedRoute ? 4 : 2}
          markerEnd="url(#arrowhead)"
          style={{ cursor: 'pointer', pointerEvents: 'all' }}
          onClick={(e) => {
            e.stopPropagation();
            handleRouteClick(route);
          }}
        />
        {route.conditionType === 'condition' && (
          <text
            x={midX}
            y={midY - 5}
            fill="#faad14"
            fontSize="12"
            textAnchor="middle"
            style={{ pointerEvents: 'none' }}
          >
            {route.conditionConfig?.field || '条件'}
          </text>
        )}
      </g>
    );
  };

  const handleConnectStart = (nodeKey) => {
    if (connectingFrom && connectingFrom !== 'waiting') {
      // 已经选择了起始节点，现在点击的是目标节点
      if (connectingFrom === nodeKey) {
        setConnectingFrom(null);
        message.info('已取消连接');
      } else {
        handleConnectNodes(connectingFrom, nodeKey);
      }
    } else if (connectingFrom === 'waiting') {
      // 等待选择起始节点
      setConnectingFrom(nodeKey);
      message.success(`已选择起始节点：${nodes.find(n => n.nodeKey === nodeKey)?.name}，请点击目标节点`);
    } else {
      // 不应该到这里，但为了安全起见
      setConnectingFrom(nodeKey);
      message.info('已选择起始节点，请点击目标节点完成连接');
    }
  };

  // 处理鼠标移动（拖拽节点）
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (draggingNode) {
        const newX = e.clientX - draggingNode.offsetX;
        const newY = e.clientY - draggingNode.offsetY;
        const updatedNodes = nodes.map(n =>
          n.nodeKey === draggingNode.node.nodeKey
            ? { ...n, position: { x: newX, y: newY } }
            : n
        );
        setNodes(updatedNodes);
        if (selectedNode?.nodeKey === draggingNode.node.nodeKey) {
          setSelectedNode(updatedNodes.find(n => n.nodeKey === draggingNode.node.nodeKey));
        }
      }
    };

    const handleMouseUp = () => {
      setDraggingNode(null);
    };

    if (draggingNode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingNode, nodes, selectedNode]);

  return (
    <div style={{ padding: 24 }}>
      <>
      <Card
        title={
          <Space>
            <span>流程设计器</span>
            <Tooltip title="使用说明：1. 选择模块类型 2. 添加节点 3. 连接节点 4. 配置节点和路由条件 5. 保存流程">
              <Button type="link" size="small" icon={<EditOutlined />}>
                使用说明
              </Button>
            </Tooltip>
          </Space>
        }
        extra={
          <Space>
            <Button onClick={() => setShowList(!showList)}>
              {showList ? '隐藏列表' : '显示列表'}
            </Button>
            <Button onClick={handleCreateWorkflow}>新建流程</Button>
            <Select
              placeholder="选择流程"
              style={{ width: 200 }}
              onChange={(id) => {
                const workflow = workflows.find(w => w.id === id);
                if (workflow) {
                  handleLoadWorkflow(workflow);
                  setShowList(false);
                }
              }}
            >
              {workflows.map(w => (
                <Option key={w.id} value={w.id}>{w.name}</Option>
              ))}
            </Select>
            {!showList && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSaveWorkflow}
              >
                保存流程
              </Button>
            )}
          </Space>
        }
      >
        {showList ? (
          <Table
            dataSource={workflows}
            rowKey="id"
            loading={loading}
            columns={[
              { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
              { title: '流程名称', dataIndex: 'name', key: 'name' },
              {
                title: '模块类型',
                dataIndex: 'moduleType',
                key: 'moduleType',
                render: (type) => {
                  // 模块类型映射（支持单数和复数形式）
                  const moduleTypeMap = {
                    'contract': '合同',
                    'contracts': '合同',
                    'opportunity': '商机',
                    'opportunities': '商机',
                    'customer': '客户',
                    'customers': '客户',
                    'expense': '费用',
                    'expenses': '费用',
                    'payment': '付款',
                    'payments': '付款',
                    'invoice': '发票',
                    'invoices': '发票',
                    'quotation': '报价',
                    'quotations': '报价',
                    'lead': '线索',
                    'leads': '线索',
                    'project': '项目',
                    'projects': '项目',
                  };
                  const label = moduleTypeMap[type] || type;
                  return <Tag>{label}</Tag>;
                },
              },
              {
                title: '流程编码',
                dataIndex: 'code',
                key: 'code',
              },
              {
                title: '节点数',
                key: 'nodeCount',
                render: (_, record) => record.nodes?.length || 0,
              },
              {
                title: '状态',
                dataIndex: 'isActive',
                key: 'isActive',
                render: (isActive) => (
                  <Tag color={isActive ? 'green' : 'default'}>
                    {isActive ? '启用' : '禁用'}
                  </Tag>
                ),
              },
              {
                title: '操作',
                key: 'action',
                render: (_, record) => (
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => {
                        handleLoadWorkflow(record);
                        setShowList(false);
                      }}
                    >
                      编辑
                    </Button>
                    <Button
                      type="link"
                      size="small"
                      icon={<FileTextOutlined />}
                      onClick={() => {
                        setSelectedWorkflowId(record.id);
                        setLogModalVisible(true);
                        loadWorkflowLogs(record.id);
                      }}
                    >
                      流程日志
                    </Button>
                    <Popconfirm
                      title="确定删除此流程吗？"
                      onConfirm={async () => {
                        try {
                          await workflowService.deleteWorkflowDefinition(record.id);
                          message.success('删除成功');
                          loadWorkflows();
                        } catch (error) {
                          message.error('删除失败');
                        }
                      }}
                    >
                      <Button
                        type="link"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                      >
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        ) : (
        <>
        <Card
          size="small"
          style={{ marginBottom: 16 }}
          bodyStyle={{ padding: 16 }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: 12 }}>流程信息</div>
          <Form form={workflowForm} layout="vertical" size="middle">
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="moduleType" label="模块类型" rules={[{ required: true }]}>
                  <Select 
                    placeholder="选择模块/表单"
                    showSearch
                    allowClear
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    onChange={(value) => {
                      loadModuleFields(value);
                    }}
                  >
                    {availableModules.map(module => (
                      <Option key={module.code} value={module.code} label={module.name}>
                        {module.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="name" label="流程名称" rules={[{ required: true }]}>
                  <Input placeholder="流程名称" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="code" label="流程编码" rules={[{ required: true }]}>
                  <Input placeholder="唯一编码" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="priority" label="优先级">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="description" label="描述">
                  <TextArea rows={2} placeholder="流程描述" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="isActive" valuePropName="checked" label="启用">
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        <div style={{ display: 'flex', height: 'calc(100vh - 320px)' }}>
          {/* 左侧工具栏 */}
          <div style={{ 
            width: 250, 
            borderRight: '1px solid #f0f0f0', 
            padding: 16,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>节点类型</div>
              <Space direction="vertical" style={{ width: '100%' }}>
                {NODE_TYPES.map(type => (
                  <Button
                    key={type.value}
                    block
                    style={{ textAlign: 'left' }}
                    onClick={() => handleAddNode(type.value)}
                  >
                    <span style={{ color: type.color, marginRight: 8 }}>{type.icon}</span>
                    {type.label}
                  </Button>
                ))}
              </Space>
            </div>

            <Divider />

            <div>
              <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
                <strong>连接节点步骤：</strong>
                <ol style={{ margin: '8px 0', paddingLeft: 20, fontSize: 11 }}>
                  <li>点击"连接节点"按钮</li>
                  <li>点击起始节点</li>
                  <li>点击目标节点</li>
                </ol>
              </div>
              <Button
                block
                type={connectingFrom ? 'primary' : 'default'}
                onClick={() => {
                  if (connectingFrom) {
                    setConnectingFrom(null);
                    message.info('已取消连接模式');
                  } else {
                    setConnectingFrom('waiting');
                    message.info('连接模式已开启，请点击起始节点');
                  }
                }}
              >
                {connectingFrom ? '取消连接' : '连接节点'}
              </Button>
              {connectingFrom && connectingFrom !== 'waiting' && (
                <div style={{ marginTop: 8, padding: 8, backgroundColor: '#e6f7ff', borderRadius: 4, fontSize: 12 }}>
                  <div style={{ color: '#1890ff', fontWeight: 'bold', marginBottom: 4 }}>
                    ✓ 已选择起始节点: {nodes.find(n => n.nodeKey === connectingFrom)?.name}
                  </div>
                  <div style={{ color: '#faad14' }}>
                    → 请点击目标节点完成连接
                  </div>
                </div>
              )}
              {connectingFrom === 'waiting' && (
                <div style={{ marginTop: 8, padding: 8, backgroundColor: '#fff7e6', borderRadius: 4, fontSize: 12, color: '#faad14' }}>
                  ⚠ 连接模式已开启，请点击起始节点
                </div>
              )}
            </div>
          </div>

          {/* 中间画布 */}
          <div
            ref={canvasRef}
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'auto',
              backgroundColor: '#f5f5f5',
              border: '1px solid #d9d9d9',
            }}
            onClick={(e) => {
              // 如果点击的是画布本身（不是节点），在连接模式下取消连接
              if (connectingFrom && e.target === e.currentTarget) {
                setConnectingFrom(null);
                message.info('已取消连接模式');
              }
            }}
          >
            {/* SVG用于绘制连接线 */}
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#1890ff" />
                </marker>
              </defs>
              {routes.map(route => renderRoute(route))}
            </svg>

            {/* 节点 */}
            <div style={{ position: 'relative', width: '100%', height: '100%', zIndex: 1 }}>
              {nodes.map(node => renderNode(node))}
            </div>

            {nodes.length === 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: '#999',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <div>从左侧选择节点类型添加到画布</div>
              </div>
            )}
          </div>
        </div>
        </>
        )}

      {/* 节点配置抽屉 */}
      <Drawer
        title="节点配置"
        open={configDrawerVisible}
        onClose={() => setConfigDrawerVisible(false)}
        width={600}
        extra={
          <Space>
            {selectedNode?.nodeType === 'approval' && (
              <Button
                icon={<EyeOutlined />}
                onClick={() => {
                  setFieldPermissionDrawerVisible(true);
            const currentPermissions = selectedNode.config?.fieldPermissions || {};
            const fieldPermissionsData = {};
            moduleFields.forEach(field => {
              fieldPermissionsData[field.name] = {
                visible: currentPermissions[field.name]?.visible !== false,
                editable: currentPermissions[field.name]?.editable || false,
                required: currentPermissions[field.name]?.required || false,
              };
            });
            fieldPermissionForm.setFieldsValue({
              fieldPermissions: fieldPermissionsData,
            });
                }}
              >
                字段权限
              </Button>
            )}
            <Button type="primary" onClick={handleSaveNode}>
              保存
            </Button>
          </Space>
        }
      >
        {selectedNode && (
          <Form form={nodeForm} layout="vertical">
            <Form.Item name="name" label="节点名称" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="description" label="节点描述">
              <TextArea rows={2} />
            </Form.Item>

            {selectedNode.nodeType === 'approval' && (
              <>
                <Form.Item
                  name={['config', 'approvalType']}
                  label="审批方式"
                  initialValue="or"
                >
                  <Select>
                    <Option value="or">或签（一人通过即可）</Option>
                    <Option value="and">会签（全部通过）</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name={['config', 'approvers']}
                  label="审批人"
                  rules={[{ required: true, message: '请至少添加一个审批人' }]}
                  getValueFromEvent={(value) => {
                    // 将选中的值转换为审批人配置格式
                    return value.map(v => {
                      if (v.startsWith('role:')) {
                        return { type: 'role', value: v.replace('role:', '') };
                      } else if (v.startsWith('user:')) {
                        return { type: 'user', value: parseInt(v.replace('user:', '')) };
                      } else if (v.startsWith('dept:')) {
                        return { type: 'department', value: parseInt(v.replace('dept:', '')) };
                      }
                      return { type: 'user', value: v };
                    });
                  }}
                  getValueProps={(value) => {
                    // 将审批人配置格式转换为Select的值
                    if (!value || !Array.isArray(value)) return [];
                    return value.map(a => {
                      if (a.type === 'role') return `role:${a.value}`;
                      if (a.type === 'user') return `user:${a.value}`;
                      if (a.type === 'department') return `dept:${a.value}`;
                      return `user:${a.value}`;
                    });
                  }}
                >
                  <Select 
                    mode="multiple" 
                    placeholder="选择审批人（可搜索）"
                    showSearch
                    filterOption={(input, option) => {
                      const label = option?.label || option?.children?.toString() || '';
                      return label.toLowerCase().includes(input.toLowerCase());
                    }}
                    optionLabelProp="label"
                    style={{ width: '100%' }}
                  >
                    <Select.OptGroup label="按角色">
                      <Option value="role:admin" label="管理员">管理员</Option>
                      <Option value="role:sales_manager" label="销售经理">销售经理</Option>
                      <Option value="role:sales" label="销售">销售</Option>
                    </Select.OptGroup>
                    <Select.OptGroup label="按用户">
                      {users.map(user => {
                        const displayText = `${user.name}${user.email ? ` (${user.email})` : ''}`;
                        return (
                          <Option 
                            key={`user:${user.id}`} 
                            value={`user:${user.id}`}
                            label={displayText}
                          >
                            {displayText}
                          </Option>
                        );
                      })}
                    </Select.OptGroup>
                    <Select.OptGroup label="按部门">
                      {departments.map(dept => (
                        <Option 
                          key={`dept:${dept.id}`} 
                          value={`dept:${dept.id}`}
                          label={dept.name}
                        >
                          {dept.name}
                        </Option>
                      ))}
                    </Select.OptGroup>
                  </Select>
                </Form.Item>

                <Form.Item
                  name={['config', 'dueHours']}
                  label="审批时限（小时）"
                  initialValue={24}
                >
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>

                <Form.Item
                  name={['config', 'priority']}
                  label="优先级"
                  initialValue="medium"
                >
                  <Select>
                    <Option value="low">低</Option>
                    <Option value="medium">中</Option>
                    <Option value="high">高</Option>
                    <Option value="urgent">紧急</Option>
                  </Select>
                </Form.Item>
              </>
            )}

            {selectedNode.nodeType === 'condition' && (
              <>
                <Form.Item
                  name={['config', 'conditionField']}
                  label="条件字段"
                  rules={[{ required: true, message: '请选择条件字段' }]}
                >
                  <Select 
                    placeholder="选择要判断的字段"
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    notFoundContent={moduleFields.length === 0 ? '请先选择模块类型' : '无匹配字段'}
                  >
                    {moduleFields.map(field => (
                      <Option key={field.name} value={field.name} label={field.label}>
                        {field.label} ({field.type})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name={['config', 'conditionOperator']}
                  label="操作符"
                  rules={[{ required: true, message: '请选择操作符' }]}
                >
                  <Select placeholder="选择操作符">
                    {OPERATORS.map(op => (
                      <Option key={op.value} value={op.value}>
                        {op.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) =>
                    prevValues.config?.conditionOperator !== currentValues.config?.conditionOperator ||
                    prevValues.config?.conditionField !== currentValues.config?.conditionField
                  }
                >
                  {({ getFieldValue }) => {
                    const operator = getFieldValue(['config', 'conditionOperator']);
                    const fieldName = getFieldValue(['config', 'conditionField']);
                    const field = moduleFields.find(f => f.name === fieldName);
                    const fieldType = field?.type || 'string';

                    if (operator === 'between') {
                      return (
                        <>
                          <Form.Item
                            name={['config', 'conditionValue1']}
                            label="最小值"
                            rules={[{ required: true, message: '请输入最小值' }]}
                          >
                            <InputNumber 
                              style={{ width: '100%' }} 
                              placeholder="最小值"
                              disabled={fieldType === 'string' || fieldType === 'text'}
                            />
                          </Form.Item>
                          <Form.Item
                            name={['config', 'conditionValue2']}
                            label="最大值"
                            rules={[{ required: true, message: '请输入最大值' }]}
                          >
                            <InputNumber 
                              style={{ width: '100%' }} 
                              placeholder="最大值"
                              disabled={fieldType === 'string' || fieldType === 'text'}
                            />
                          </Form.Item>
                        </>
                      );
                    } else if (['in', 'not_in'].includes(operator)) {
                      return (
                        <Form.Item
                          name={['config', 'conditionValue']}
                          label="值（多个用逗号分隔）"
                          rules={[{ required: true, message: '请输入值' }]}
                        >
                          <Input placeholder="例如: 值1,值2,值3" />
                        </Form.Item>
                      );
                    } else if (['is_null', 'is_not_null'].includes(operator)) {
                      return null;
                    } else {
                      // 根据字段类型显示不同的输入框
                      if (fieldType === 'number') {
                        return (
                          <Form.Item
                            name={['config', 'conditionValue']}
                            label="值"
                            rules={[{ required: true, message: '请输入值' }]}
                          >
                            <InputNumber 
                              style={{ width: '100%' }} 
                              placeholder="请输入数字"
                            />
                          </Form.Item>
                        );
                      } else if (fieldType === 'date') {
                        return (
                          <Form.Item
                            name={['config', 'conditionValue']}
                            label="值"
                            rules={[{ required: true, message: '请选择日期' }]}
                          >
                            <Input placeholder="日期格式：YYYY-MM-DD" />
                          </Form.Item>
                        );
                      } else {
                        return (
                          <Form.Item
                            name={['config', 'conditionValue']}
                            label="值"
                            rules={[{ required: true, message: '请输入值' }]}
                          >
                            <Input placeholder="请输入文本值" />
                          </Form.Item>
                        );
                      }
                    }
                  }}
                </Form.Item>

                <div style={{ 
                  padding: 8, 
                  backgroundColor: '#e6f7ff', 
                  borderRadius: 4, 
                  fontSize: 12,
                  color: '#666',
                  marginBottom: 16,
                  border: '1px solid #91d5ff'
                }}>
                  <strong>💡 说明：</strong>
                  <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                    <li>选择字段、操作符和值后，系统会自动生成条件表达式</li>
                    <li>例如：选择"金额"、"大于"、"100000"，表示金额大于10万时执行</li>
                    <li>条件节点用于在流程中进行分支判断</li>
                  </ul>
                </div>
              </>
            )}

            <Divider />
            <Space>
              <Popconfirm
                title="确定删除此节点吗？"
                onConfirm={() => {
                  handleNodeDelete(selectedNode.nodeKey);
                  setConfigDrawerVisible(false);
                }}
              >
                <Button danger icon={<DeleteOutlined />}>
                  删除节点
                </Button>
              </Popconfirm>
            </Space>
          </Form>
        )}
      </Drawer>

      {/* 字段权限配置抽屉 */}
      <Drawer
        title="字段权限配置"
        open={fieldPermissionDrawerVisible}
        onClose={() => setFieldPermissionDrawerVisible(false)}
        width={700}
        extra={
          <Button type="primary" onClick={handleSaveFieldPermissions}>
            保存
          </Button>
        }
      >
        <Form form={fieldPermissionForm} layout="vertical">
          <div style={{ marginBottom: 16, color: '#666' }}>
            配置在此审批节点中，哪些字段对审批人可见、可编辑
          </div>
          <Form.Item name="fieldPermissions" initialValue={{}}>
            <Table
              dataSource={moduleFields}
              rowKey="name"
              pagination={false}
              columns={[
                {
                  title: '字段名称',
                  dataIndex: 'label',
                  key: 'label',
                  width: 150,
                },
                {
                  title: '字段类型',
                  dataIndex: 'type',
                  key: 'type',
                  width: 100,
                  render: (type) => {
                    const typeMap = { 
                      string: '文本', 
                      number: '数字', 
                      date: '日期',
                      text: '长文本',
                      json: 'JSON'
                    };
                    return <Tag>{typeMap[type] || type}</Tag>;
                  },
                },
                {
                  title: '可见',
                  key: 'visible',
                  width: 80,
                  render: (_, record) => {
                    const currentPermissions = selectedNode?.config?.fieldPermissions || {};
                    return (
                      <Form.Item
                        name={['fieldPermissions', record.name, 'visible']}
                        valuePropName="checked"
                        initialValue={currentPermissions[record.name]?.visible !== false}
                        style={{ margin: 0 }}
                      >
                        <Checkbox />
                      </Form.Item>
                    );
                  },
                },
                {
                  title: '可编辑',
                  key: 'editable',
                  width: 80,
                  render: (_, record) => {
                    const currentPermissions = selectedNode?.config?.fieldPermissions || {};
                    return (
                      <Form.Item
                        name={['fieldPermissions', record.name, 'editable']}
                        valuePropName="checked"
                        initialValue={currentPermissions[record.name]?.editable || false}
                        style={{ margin: 0 }}
                      >
                        <Checkbox />
                      </Form.Item>
                    );
                  },
                },
                {
                  title: '必填',
                  key: 'required',
                  width: 80,
                  render: (_, record) => {
                    const currentPermissions = selectedNode?.config?.fieldPermissions || {};
                    return (
                      <Form.Item
                        name={['fieldPermissions', record.name, 'required']}
                        valuePropName="checked"
                        initialValue={currentPermissions[record.name]?.required || false}
                        style={{ margin: 0 }}
                      >
                        <Checkbox />
                      </Form.Item>
                    );
                  },
                },
              ]}
            />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 路由配置抽屉 */}
      <Drawer
        title="路由条件配置"
        open={routeConfigDrawerVisible}
        onClose={() => setRouteConfigDrawerVisible(false)}
        width={600}
        extra={
          <Space>
            <Popconfirm
              title="确定删除此路由吗？"
              onConfirm={() => {
                if (selectedRoute) {
                  handleDeleteRoute(selectedRoute);
                }
              }}
            >
              <Button danger icon={<DeleteOutlined />}>
                删除路由
              </Button>
            </Popconfirm>
            <Button type="primary" onClick={handleSaveRoute}>
              保存
            </Button>
          </Space>
        }
      >
        {selectedRoute && (
          <Form form={routeForm} layout="vertical">
            <Form.Item label="起始节点">
              <Input 
                value={nodes.find(n => n.nodeKey === selectedRoute.fromNodeKey)?.name || ''}
                disabled
              />
            </Form.Item>
            <Form.Item label="目标节点">
              <Input 
                value={nodes.find(n => n.nodeKey === selectedRoute.toNodeKey)?.name || ''}
                disabled
              />
            </Form.Item>
            <Form.Item
              name="conditionType"
              label="路由类型"
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="always">无条件（总是执行）</Option>
                <Option value="condition">条件路由（满足条件时执行）</Option>
              </Select>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.conditionType !== currentValues.conditionType
              }
            >
              {({ getFieldValue }) => {
                const conditionType = getFieldValue('conditionType');
                if (conditionType === 'condition') {
                  return (
                    <>
                      <Form.Item
                        name={['conditionConfig', 'field']}
                        label="条件字段"
                        rules={[{ required: true, message: '请选择条件字段' }]}
                        tooltip="选择要判断的字段，例如：金额、状态等"
                      >
                        <Select 
                          placeholder="选择字段"
                          showSearch
                          filterOption={(input, option) =>
                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                          }
                          notFoundContent={moduleFields.length === 0 ? '请先选择模块类型' : '无匹配字段'}
                        >
                          {moduleFields.map(field => (
                            <Option key={field.name} value={field.name} label={field.label}>
                              {field.label} ({field.type})
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <div style={{ 
                        padding: 8, 
                        backgroundColor: '#fff7e6', 
                        borderRadius: 4, 
                        fontSize: 12,
                        color: '#666',
                        marginBottom: 16,
                        border: '1px solid #ffe58f'
                      }}>
                        <strong>💡 条件判断说明：</strong>
                        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                          <li>选择字段后，设置操作符和值</li>
                          <li>例如：金额 &gt; 100000，表示金额大于10万时走此路由</li>
                          <li>可以设置多个条件路由，系统会根据数据自动选择路径</li>
                        </ul>
                      </div>
                      <Form.Item
                        name={['conditionConfig', 'operator']}
                        label="操作符"
                        rules={[{ required: true, message: '请选择操作符' }]}
                      >
                        <Select placeholder="选择操作符">
                          {OPERATORS.map(op => (
                            <Option key={op.value} value={op.value}>
                              {op.label}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                      <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) =>
                          prevValues.conditionConfig?.operator !== currentValues.conditionConfig?.operator
                        }
                      >
                        {({ getFieldValue }) => {
                          const operator = getFieldValue(['conditionConfig', 'operator']);
                          if (operator === 'between') {
                            return (
                              <>
                                <Form.Item
                                  name={['conditionConfig', 'value1']}
                                  label="最小值"
                                  rules={[{ required: true }]}
                                >
                                  <InputNumber style={{ width: '100%' }} />
                                </Form.Item>
                                <Form.Item
                                  name={['conditionConfig', 'value2']}
                                  label="最大值"
                                  rules={[{ required: true }]}
                                >
                                  <InputNumber style={{ width: '100%' }} />
                                </Form.Item>
                              </>
                            );
                          } else if (['in', 'not_in'].includes(operator)) {
                            return (
                              <Form.Item
                                name={['conditionConfig', 'value']}
                                label="值（多个用逗号分隔）"
                                rules={[{ required: true }]}
                              >
                                <Input placeholder="例如: value1,value2,value3" />
                              </Form.Item>
                            );
                          } else if (!['is_null', 'is_not_null'].includes(operator)) {
                            return (
                              <Form.Item
                                name={['conditionConfig', 'value']}
                                label="值"
                                rules={[{ required: true }]}
                              >
                                <Input />
                              </Form.Item>
                            );
                          }
                          return null;
                        }}
                      </Form.Item>
                    </>
                  );
                }
                return null;
              }}
            </Form.Item>
          </Form>
        )}
      </Drawer>

      {/* 流程日志Modal */}
      <Modal
        title="流程日志"
        open={logModalVisible}
        onCancel={() => {
          setLogModalVisible(false);
          setSelectedWorkflowId(null);
          setWorkflowInstances([]);
          setWorkflowHistory([]);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setLogModalVisible(false);
            setSelectedWorkflowId(null);
            setWorkflowInstances([]);
            setWorkflowHistory([]);
          }}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <strong>流程实例数：</strong>{workflowInstances.length}
        </div>
        
        {loadingLogs ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : workflowHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无流程日志</div>
        ) : (
          <Timeline>
            {workflowHistory.map((record, index) => {
              // 操作类型映射
              const actionMap = {
                'start': '流程开始',
                'complete': '流程完成',
                'approve': '审批通过',
                'reject': '审批拒绝',
                'return': '退回',
                'transfer': '转办',
                'withdraw': '撤回',
                'cancel': '取消',
                'skip': '跳过',
              };
              
              // 操作颜色映射
              const actionColorMap = {
                'start': 'blue',
                'complete': 'green',
                'approve': 'green',
                'reject': 'red',
                'return': 'orange',
                'transfer': 'purple',
                'withdraw': 'default',
                'cancel': 'default',
                'skip': 'default',
              };
              
              const actionLabel = actionMap[record.action] || record.action;
              const actionColor = actionColorMap[record.action] || 'blue';
              const operatorName = record.operatorName || '系统';
              
              return (
                <Timeline.Item key={`${record.instanceId}_${record.id}_${index}`} color={actionColor}>
                  <div>
                    <Space>
                      <strong>{operatorName}</strong>
                      {record.nodeName && (
                        <Tag color="default" style={{ fontSize: 11 }}>
                          {record.nodeName}
                        </Tag>
                      )}
                      {record.nodeType === 'condition' && record.conditionInfo && (
                        <Tag color="orange" style={{ fontSize: 11 }}>
                          条件判断: {record.conditionInfo.field} {record.conditionInfo.operator} {record.conditionInfo.value || `${record.conditionInfo.value1} ~ ${record.conditionInfo.value2}`}
                        </Tag>
                      )}
                      <Tag color={actionColor}>
                        {actionLabel}
                      </Tag>
                    </Space>
                    {record.comment && (
                      <div style={{ marginTop: 8, color: '#666' }}>{record.comment}</div>
                    )}
                    {record.conditionInfo && record.nodeType === 'condition' && (
                      <div style={{ marginTop: 8, padding: 8, background: '#fff7e6', borderRadius: 4, fontSize: 12 }}>
                        <div><strong>条件判断详情：</strong></div>
                        <div>字段: {record.conditionInfo.field}</div>
                        <div>操作符: {record.conditionInfo.operator}</div>
                        <div>比较值: {record.conditionInfo.value || (record.conditionInfo.value1 && record.conditionInfo.value2 ? `${record.conditionInfo.value1} ~ ${record.conditionInfo.value2}` : '-')}</div>
                      </div>
                    )}
                    <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                      {record.createdAt ? new Date(record.createdAt).toLocaleString() : '-'}
                      {record.instance && (
                        <span style={{ marginLeft: 16, color: '#666' }}>
                          (实例ID: {record.instanceId}, 模块: {record.instance.moduleType}, 模块ID: {record.instance.moduleId})
                        </span>
                      )}
                    </div>
                  </div>
                </Timeline.Item>
              );
            })}
          </Timeline>
        )}
      </Modal>
      </Card>
      </>
    </div>
  );
};

export default WorkflowDesigner;

