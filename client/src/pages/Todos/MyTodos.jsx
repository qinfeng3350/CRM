import { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Tabs,
  Statistic,
  Row,
  Col,
  Descriptions,
  Divider,
} from 'antd';
import {
  CheckOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { todoService } from '../../services/todoService';
import { approvalService } from '../../services/approvalService';
import { dingTalkService } from '../../services/dingTalkService';
import { useNavigate } from 'react-router-dom';

const { TextArea } = Input;

const MyTodos = () => {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    completed: 0,
    urgent: 0,
  });
  const [activeTab, setActiveTab] = useState('pending');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
    loadTodos();
  }, [activeTab]);

  const loadStats = async () => {
    try {
      const response = await todoService.getTodoStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  const loadTodos = async () => {
    setLoading(true);
    try {
      // 根据标签页传递对应的status参数
      // 对于"待我处理"（pending）标签页，明确传递 'pending' 状态
      let status = activeTab === 'all' ? undefined : activeTab;
      console.log('[MyTodos] 加载待办列表，activeTab:', activeTab, 'status:', status);
      
      const response = await todoService.getMyTodos({
        status,
        page: 1,
        limit: 100,
      });
      console.log('[MyTodos] API响应:', response);
      
      if (response.success) {
        let todosList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        console.log('[MyTodos] 解析后的待办列表:', todosList.length, '条');
        console.log('[MyTodos] 待办列表详情:', todosList.map(t => ({ id: t.id, title: t.title, status: t.status })));
        
        // 前端二次过滤：确保只显示对应状态的待办
        if (activeTab === 'pending') {
          // 待处理标签页：只显示pending状态的，严格过滤
          todosList = todosList.filter(todo => {
            const isPending = todo.status === 'pending';
            if (!isPending) {
              console.log('[MyTodos] ⚠️  过滤掉非pending状态的待办:', { id: todo.id, title: todo.title, status: todo.status });
            }
            return isPending;
          });
          console.log('[MyTodos] ✅ 过滤后的待处理列表:', todosList.length, '条');
        } else if (activeTab === 'in_progress') {
          // 进行中标签页：只显示in_progress状态的
          todosList = todosList.filter(todo => todo.status === 'in_progress');
          console.log('[MyTodos] ✅ 过滤后的进行中列表:', todosList.length, '条');
        } else if (activeTab === 'completed') {
          // 已完成标签页：只显示completed状态的
          todosList = todosList.filter(todo => todo.status === 'completed');
          console.log('[MyTodos] ✅ 过滤后的已完成列表:', todosList.length, '条');
        }
        // all标签页：显示所有状态（后端已经过滤了cancelled）
        
        setTodos(todosList);
        
        if (todosList.length === 0) {
          console.log('[MyTodos] 待办列表为空');
        }
      } else {
        console.error('[MyTodos] API返回失败:', response.message);
        message.error(response.message || '加载待办列表失败');
      }
    } catch (error) {
      console.error('[MyTodos] 加载待办列表异常:', error);
      message.error(error.message || '加载待办列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = (todo) => {
    setSelectedTodo(todo);
    setModalVisible(true);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      if (selectedTodo.type === 'approval') {
        // 审批操作
        const action = values.action || 'approve';
        const approvalData = {
          action,
          comment: values.comment,
          recordId: selectedTodo.metadata?.recordId,
          taskId: selectedTodo.metadata?.taskId, // 新流程引擎需要taskId
        };
        
        // 如果是退回操作，需要传递 returnToNodeKey
        if (action === 'return' && values.returnToNodeKey) {
          approvalData.returnToNodeKey = values.returnToNodeKey;
        }
        
        await approvalService.approve(
          selectedTodo.moduleType,
          selectedTodo.moduleId,
          approvalData
        );
        
        const actionMessages = {
          'approve': '审批通过',
          'reject': '审批已拒绝',
          'return': '已退回',
        };
        message.success(actionMessages[action] || '操作成功');
        
        // 触发审批状态改变事件，通知相关页面刷新
        const moduleType = selectedTodo.moduleType;
        if (moduleType === 'invoice' || moduleType === 'invoices') {
          window.dispatchEvent(new CustomEvent('invoiceApprovalChanged', {
            detail: { moduleId: selectedTodo.moduleId, action }
          }));
        } else if (moduleType === 'contract' || moduleType === 'contracts') {
          window.dispatchEvent(new CustomEvent('contractApprovalChanged', {
            detail: { moduleId: selectedTodo.moduleId, action }
          }));
        }
      } else {
        // 普通待办完成
        await todoService.completeTodo(selectedTodo.id, {
          comment: values.comment,
        });
        message.success('待办已完成');
      }
      setModalVisible(false);
      loadTodos();
      loadStats();
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const handleViewDetail = (todo) => {
    console.log('[MyTodos] 查看待办详情:', todo);
    if (!todo) {
      message.error('待办数据不存在');
      return;
    }
    setSelectedTodo(todo);
    setDetailModalVisible(true);
  };

  const handleGoToModule = (todo) => {
    const moduleType = todo.moduleType;
    // 支持单数和复数形式
    if (moduleType === 'contract' || moduleType === 'contracts') {
      navigate(`/contracts/${todo.moduleId}`);
    } else if (moduleType === 'opportunity' || moduleType === 'opportunities') {
      navigate(`/opportunities/${todo.moduleId}`);
    } else if (moduleType === 'customer' || moduleType === 'customers') {
      navigate(`/customers/${todo.moduleId}`);
    } else if (moduleType === 'expense' || moduleType === 'expenses') {
      navigate(`/expenses/${todo.moduleId}`);
    } else if (moduleType === 'payment' || moduleType === 'payments') {
      navigate(`/payments/${todo.moduleId}`);
    } else if (moduleType === 'invoice' || moduleType === 'invoices') {
      navigate(`/invoices/${todo.moduleId}`);
    } else if (moduleType === 'quotation' || moduleType === 'quotations') {
      navigate(`/quotations/${todo.moduleId}`);
    } else if (moduleType === 'lead' || moduleType === 'leads') {
      navigate(`/leads/${todo.moduleId}`);
    } else if (moduleType === 'project' || moduleType === 'projects') {
      navigate(`/projects/${todo.moduleId}`);
    }
    setDetailModalVisible(false);
  };

  const handleSyncToDingTalk = async (todo) => {
    try {
      const response = await dingTalkService.syncTodoToDingTalk(todo.id);
      if (response.success) {
        message.success('已同步到钉钉');
        loadTodos();
      }
    } catch (error) {
      const errorData = error.response?.data || {};
      const errorMessage = errorData.message || '同步失败';
      
      // 如果是权限问题，显示更详细的提示
      if (errorData.errorCode === 'PERMISSION_REQUIRED' || errorMessage.includes('权限')) {
        message.error({
          content: (
            <div>
              <div style={{ marginBottom: 8, fontWeight: 'bold' }}>同步失败：权限不足</div>
              <div style={{ marginBottom: 8 }}>{errorMessage}</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                请在钉钉开放平台 → 应用开发 → 权限管理 → 申请"待办应用中待办写权限"
              </div>
            </div>
          ),
          duration: 8,
        });
      } else {
        message.error(errorMessage);
      }
    }
  };

  const priorityColors = {
    low: 'default',
    medium: 'blue',
    high: 'orange',
    urgent: 'red',
  };

  const priorityLabels = {
    low: '低',
    medium: '中',
    high: '高',
    urgent: '紧急',
  };

  const statusColors = {
    pending: 'orange',
    in_progress: 'blue',
    completed: 'green',
    cancelled: 'default',
  };

  const statusLabels = {
    pending: '待处理',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消',
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={type === 'approval' ? 'red' : 'blue'}>
          {type === 'approval' ? '审批' : '任务'}
        </Tag>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: { showTitle: true },
      width: 200,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => (
        <Tag color={priorityColors[priority]}>
          {priorityLabels[priority]}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status]}>
          {statusLabels[status]}
        </Tag>
      ),
    },
    {
      title: '截止日期',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            onClick={() => handleViewDetail(record)}
          >
            查看详情
          </Button>
          {record.status === 'pending' && record.type === 'approval' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleComplete(record)}
            >
              审批
            </Button>
          )}
          {record.status === 'pending' && record.type !== 'approval' && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleComplete(record)}
            >
              完成
            </Button>
          )}
          {record.status !== 'completed' && !record.metadata?.dingTalkSynced && (
            <Button
              type="link"
              size="small"
              icon={<LinkOutlined />}
              onClick={() => handleSyncToDingTalk(record)}
            >
              同步到钉钉
            </Button>
          )}
          {record.metadata?.dingTalkSynced && (
            <Tag color="green" size="small">已同步</Tag>
          )}
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'pending',
      label: `待处理 (${stats.pending})`,
    },
    {
      key: 'in_progress',
      label: `进行中 (${stats.inProgress})`,
    },
    {
      key: 'completed',
      label: `已完成 (${stats.completed})`,
    },
    {
      key: 'all',
      label: '全部',
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="待处理"
              value={stats.pending}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="进行中"
              value={stats.inProgress}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completed}
              prefix={<CheckOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="紧急"
              value={stats.urgent}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
        <Table
          columns={columns}
          dataSource={todos}
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          style={{ overflowX: 'auto' }}
        />
      </Card>

      {/* 待办详情Modal */}
      <Modal
        title="待办详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          selectedTodo?.moduleId && (
            <Button
              key="goto"
              type="primary"
              onClick={() => handleGoToModule(selectedTodo)}
            >
              查看关联{(() => {
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
                return moduleTypeMap[selectedTodo?.moduleType] || '详情';
              })()}
            </Button>
          ),
        ].filter(Boolean)}
        width={700}
      >
        {selectedTodo ? (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="类型" span={1}>
              <Tag color={selectedTodo.type === 'approval' ? 'red' : 'blue'}>
                {selectedTodo.type === 'approval' ? '审批' : '任务'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态" span={1}>
              <Tag color={statusColors[selectedTodo.status]}>
                {statusLabels[selectedTodo.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="标题" span={2}>
              {selectedTodo.title}
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {selectedTodo.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="优先级" span={1}>
              <Tag color={priorityColors[selectedTodo.priority]}>
                {priorityLabels[selectedTodo.priority]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="截止日期" span={1}>
              {selectedTodo.dueDate
                ? new Date(selectedTodo.dueDate).toLocaleString('zh-CN')
                : '-'}
            </Descriptions.Item>
            {selectedTodo.moduleType && (
              <>
                <Descriptions.Item label="关联模块" span={1}>
                  {(() => {
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
                    return moduleTypeMap[selectedTodo.moduleType] || selectedTodo.moduleType;
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="关联ID" span={1}>
                  {selectedTodo.moduleId}
                </Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="创建时间" span={1}>
              {selectedTodo.createdAt
                ? new Date(selectedTodo.createdAt).toLocaleString('zh-CN')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="完成时间" span={1}>
              {selectedTodo.completedAt
                ? new Date(selectedTodo.completedAt).toLocaleString('zh-CN')
                : '-'}
            </Descriptions.Item>
            {selectedTodo.metadata?.dingTalkSynced && (
              <>
                <Descriptions.Item label="钉钉同步状态" span={1}>
                  <Tag color="green">已同步</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="同步时间" span={1}>
                  {selectedTodo.metadata?.dingTalkSyncedAt
                    ? new Date(selectedTodo.metadata.dingTalkSyncedAt).toLocaleString('zh-CN')
                    : '-'}
                </Descriptions.Item>
              </>
            )}
            {selectedTodo.metadata?.comment && (
              <Descriptions.Item label="备注" span={2}>
                {selectedTodo.metadata.comment}
              </Descriptions.Item>
            )}
          </Descriptions>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
            待办数据不存在
          </div>
        )}
      </Modal>

      {/* 审批/完成Modal */}
      <Modal
        title={selectedTodo?.type === 'approval' ? '审批' : '完成待办'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okText={selectedTodo?.type === 'approval' ? '提交审批' : '完成'}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="comment"
            label={selectedTodo?.type === 'approval' ? '审批意见' : '备注'}
          >
            <TextArea rows={4} placeholder="请输入..." />
          </Form.Item>
          {selectedTodo?.type === 'approval' && (
            <Form.Item label="操作">
              <Space>
                <Button
                  type="primary"
                  danger
                  onClick={async () => {
                    try {
                      const values = await form.validateFields();
                      await handleSubmit({ ...values, action: 'reject' });
                    } catch (error) {
                      if (error.errorFields) {
                        return;
                      }
                      message.error(error.message || '操作失败');
                    }
                  }}
                >
                  拒绝
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      const values = await form.validateFields();
                      // 退回：退回到开始节点
                      await handleSubmit({ ...values, action: 'return', returnToNodeKey: 'start' });
                    } catch (error) {
                      if (error.errorFields) {
                        return;
                      }
                      message.error(error.message || '操作失败');
                    }
                  }}
                >
                  退回
                </Button>
                <Button
                  type="primary"
                  onClick={async () => {
                    try {
                      const values = await form.validateFields();
                      await handleSubmit({ ...values, action: 'approve' });
                    } catch (error) {
                      if (error.errorFields) {
                        return;
                      }
                      message.error(error.message || '操作失败');
                    }
                  }}
                >
                  通过
                </Button>
              </Space>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default MyTodos;

