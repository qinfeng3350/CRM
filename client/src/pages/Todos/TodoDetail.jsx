import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Radio,
  message,
  Tag,
  Spin,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { todoService } from '../../services/todoService';
import { approvalService } from '../../services/approvalService';
import { dingTalkService } from '../../services/dingTalkService';

const { TextArea } = Input;
const { Option } = Select;

const TodoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [todo, setTodo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [action, setAction] = useState('approve');

  useEffect(() => {
    loadTodo();
    
    // 检查是否从钉钉跳转过来（通过URL参数）
    const fromDingTalk = searchParams.get('from') === 'dingtalk';
    if (fromDingTalk) {
      console.log('[TodoDetail] 从钉钉跳转过来');
    }
  }, [id]);

  const loadTodo = async () => {
    setLoading(true);
    try {
      // 通过待办ID获取详情
      const response = await todoService.getTodo(id);
      if (response.success) {
        setTodo(response.data);
      } else {
        message.error(response.message || '待办不存在');
        navigate('/todos');
      }
    } catch (error) {
      console.error('[TodoDetail] 加载待办详情失败:', error);
      message.error(error.message || '加载待办详情失败');
      navigate('/todos');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = () => {
    if (!todo) return;
    setAction('approve');
    setModalVisible(true);
    form.resetFields();
  };

  const handleReject = () => {
    if (!todo) return;
    setAction('reject');
    setModalVisible(true);
    form.resetFields();
  };

  const handleReturn = () => {
    if (!todo) return;
    setAction('return');
    setModalVisible(true);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      if (todo.type === 'approval') {
        // 审批操作
        const approvalData = {
          action,
          comment: values.comment,
          recordId: todo.metadata?.recordId,
          taskId: todo.metadata?.taskId,
        };
        
        // 如果是退回操作，需要传递 returnToNodeKey
        if (action === 'return' && values.returnToNodeKey) {
          approvalData.returnToNodeKey = values.returnToNodeKey;
        }
        
        await approvalService.approve(
          todo.moduleType,
          todo.moduleId,
          approvalData
        );
        
        const actionMessages = {
          'approve': '审批通过',
          'reject': '审批已拒绝',
          'return': '已退回',
        };
        message.success(actionMessages[action] || '操作成功');
        
        // 触发审批状态改变事件
        const moduleType = todo.moduleType;
        if (moduleType === 'invoice' || moduleType === 'invoices') {
          window.dispatchEvent(new CustomEvent('invoiceApprovalChanged', {
            detail: { moduleId: todo.moduleId, action }
          }));
        } else if (moduleType === 'contract' || moduleType === 'contracts') {
          window.dispatchEvent(new CustomEvent('contractApprovalChanged', {
            detail: { moduleId: todo.moduleId, action }
          }));
        }
      } else {
        // 普通待办完成
        await todoService.completeTodo(todo.id, {
          comment: values.comment,
        });
        message.success('待办已完成');
      }
      
      setModalVisible(false);
      // 返回待办列表
      navigate('/todos');
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const handleGoToModule = () => {
    if (!todo) return;
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!todo) {
    return (
      <Card>
        <Alert
          message="待办不存在"
          type="error"
          action={
            <Button onClick={() => navigate('/todos')}>
              返回待办列表
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/todos')}
            >
              返回
            </Button>
            <span>待办详情</span>
          </Space>
        }
        extra={
          todo.status === 'pending' && (
            <Space>
              {todo.type === 'approval' ? (
                <>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={handleApprove}
                  >
                    同意
                  </Button>
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    onClick={handleReject}
                  >
                    拒绝
                  </Button>
                  <Button
                    icon={<RollbackOutlined />}
                    onClick={handleReturn}
                  >
                    退回
                  </Button>
                </>
              ) : (
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => {
                    setAction('complete');
                    setModalVisible(true);
                    form.resetFields();
                  }}
                >
                  完成
                </Button>
              )}
              {todo.moduleId && (
                <Button onClick={handleGoToModule}>
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
                    return moduleTypeMap[todo.moduleType] || '详情';
                  })()}
                </Button>
              )}
            </Space>
          )
        }
      >
        <Descriptions column={2} bordered>
          <Descriptions.Item label="类型" span={1}>
            <Tag color={todo.type === 'approval' ? 'red' : 'blue'}>
              {todo.type === 'approval' ? '审批' : '任务'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="状态" span={1}>
            <Tag color={statusColors[todo.status]}>
              {statusLabels[todo.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="标题" span={2}>
            {todo.title}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {todo.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="优先级" span={1}>
            <Tag color={priorityColors[todo.priority]}>
              {priorityLabels[todo.priority]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="截止日期" span={1}>
            {todo.dueDate
              ? new Date(todo.dueDate).toLocaleString('zh-CN')
              : '-'}
          </Descriptions.Item>
          {todo.moduleType && (
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
                  return moduleTypeMap[todo.moduleType] || todo.moduleType;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="关联ID" span={1}>
                {todo.moduleId}
              </Descriptions.Item>
            </>
          )}
          <Descriptions.Item label="创建时间" span={1}>
            {todo.createdAt
              ? new Date(todo.createdAt).toLocaleString('zh-CN')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="完成时间" span={1}>
            {todo.completedAt
              ? new Date(todo.completedAt).toLocaleString('zh-CN')
              : '-'}
          </Descriptions.Item>
          {todo.metadata?.dingTalkSynced && (
            <>
              <Descriptions.Item label="钉钉同步状态" span={1}>
                <Tag color="green">已同步</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="同步时间" span={1}>
                {todo.metadata?.dingTalkSyncedAt
                  ? new Date(todo.metadata.dingTalkSyncedAt).toLocaleString('zh-CN')
                  : '-'}
              </Descriptions.Item>
            </>
          )}
          {todo.metadata?.comment && (
            <Descriptions.Item label="备注" span={2}>
              {todo.metadata.comment}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* 审批/完成Modal */}
      <Modal
        title={action === 'approve' ? '审批通过' : action === 'reject' ? '审批拒绝' : action === 'return' ? '退回审批' : '完成待办'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okText={action === 'approve' ? '确认通过' : action === 'reject' ? '确认拒绝' : action === 'return' ? '确认退回' : '确认完成'}
        okButtonProps={action === 'reject' || action === 'return' ? { danger: true } : {}}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="comment"
            label={action === 'approve' ? '审批意见' : action === 'reject' ? '拒绝原因' : action === 'return' ? '退回原因' : '备注'}
          >
            <TextArea rows={4} placeholder="请输入..." />
          </Form.Item>
          {action === 'return' && (
            <Form.Item
              name="returnToNodeKey"
              label="退回到节点"
              initialValue="start"
            >
              <Select placeholder="请选择退回目标节点">
                <Option value="start">开始节点</Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default TodoDetail;

