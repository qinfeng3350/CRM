import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tabs,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Tag,
  Timeline,
  Alert,
  Image,
  List,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  PrinterOutlined,
  CheckOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { contractService } from '../../services/contractService';
import { followUpService } from '../../services/followUpService';
import { productService } from '../../services/productService';
import { approvalService } from '../../services/approvalService';
import { paymentService } from '../../services/paymentService';
import { invoiceService } from '../../services/invoiceService';
import { userService } from '../../services/userService';

const { TextArea } = Input;
const { Option } = Select;

const ContractDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [products, setProducts] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [approvalRecords, setApprovalRecords] = useState([]);
  const [currentApprovers, setCurrentApprovers] = useState([]);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [workflowStatus, setWorkflowStatus] = useState(null); // 'running', 'completed', 'rejected', 'withdrawn'
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [productForm] = Form.useForm();
  const [followUpForm] = Form.useForm();
  const [withdrawForm] = Form.useForm();

  useEffect(() => {
    loadContractDetail();
    loadAllProducts();
    loadUsers();
    
    // 监听审批状态改变事件
    const handleApprovalChanged = (event) => {
      const { moduleId, action } = event.detail;
      if (moduleId === id) {
        console.log('[合同详情] 收到审批状态改变事件:', { moduleId, action });
        // 刷新合同详情和审批记录
        loadContractDetail();
        loadApprovalRecords();
      }
    };
    
    window.addEventListener('contractApprovalChanged', handleApprovalChanged);
    
    return () => {
      window.removeEventListener('contractApprovalChanged', handleApprovalChanged);
    };
  }, [id]);

  const loadUsers = async () => {
    try {
      const response = await userService.getUsers({ limit: 1000 });
      if (response.success) {
        setUsers(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载用户列表失败:', error);
    }
  };

  const loadContractDetail = async () => {
    setLoading(true);
    try {
      const response = await contractService.getContract(id);
      if (response.success) {
        setContract(response.data);
        setProducts(response.data.products || []);
      } else {
        message.error(response.message || '加载合同详情失败');
      }
    } catch (error) {
      message.error(error.message || '加载合同详情失败');
    } finally {
      setLoading(false);
    }
  };

  const loadAllProducts = async () => {
    try {
      const response = await productService.getProducts({ limit: 1000, isActive: true });
      if (response.success) {
        setAllProducts(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载产品列表失败:', error);
    }
  };

  const loadFollowUps = async () => {
    try {
      const response = await followUpService.getFollowUps({
        type: 'contract',
        relatedId: id,
        limit: 50
      });
      if (response.success) {
        setFollowUps(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载跟进记录失败:', error);
    }
  };

  const loadApprovalRecords = async () => {
    try {
      const response = await approvalService.getApprovalRecords('contract', id);
      if (response.success) {
        setApprovalRecords(response.data || []);
        setCurrentApprovers(response.currentApprovers || []);
        setPendingApprovalCount(response.pendingCount || 0);
        setWorkflowStatus(response.workflowStatus || null);
        setCanWithdraw(response.canWithdraw || false);
      }
    } catch (error) {
      console.error('加载审批记录失败:', error);
    }
  };

  useEffect(() => {
    if (id) {
      loadFollowUps();
      loadApprovalRecords();
      loadPaymentPlans();
      loadPayments();
      loadInvoices();
    }
  }, [id]);

  const loadPaymentPlans = async () => {
    try {
      const response = await paymentService.getPaymentPlans({ contractId: id });
      if (response.success) {
        setPaymentPlans(response.data || []);
      }
    } catch (error) {
      console.error('加载回款计划失败:', error);
    }
  };

  const loadPayments = async () => {
    try {
      const response = await paymentService.getPayments({ contractId: id });
      if (response.success) {
        setPayments(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载回款记录失败:', error);
    }
  };

  const loadInvoices = async () => {
    try {
      const response = await invoiceService.getInvoices({ contractId: id });
      if (response.success) {
        setInvoices(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载发票列表失败:', error);
    }
  };

  const handlePrint = () => {
    // 创建打印窗口
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>合同打印 - ${contract.contractNumber}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { text-align: center; }
              .info { margin: 20px 0; }
              .products { margin: 20px 0; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <h1>${contract.title}</h1>
            <div class="info">
              <p><strong>合同编号：</strong>${contract.contractNumber}</p>
              <p><strong>客户：</strong>${contract.customerName || ''}</p>
              <p><strong>金额：</strong>¥${totalAmount.toLocaleString()}</p>
              <p><strong>签署日期：</strong>${contract.signDate ? new Date(contract.signDate).toLocaleDateString() : '-'}</p>
            </div>
            <div class="products">
              <h3>产品明细</h3>
              <table>
                <thead>
                  <tr>
                    <th>产品名称</th>
                    <th>数量</th>
                    <th>单价</th>
                    <th>金额</th>
                  </tr>
                </thead>
                <tbody>
                  ${products.map(p => `
                    <tr>
                      <td>${p.productName}</td>
                      <td>${p.quantity}</td>
                      <td>¥${p.unitPrice?.toLocaleString() || 0}</td>
                      <td>¥${p.amount?.toLocaleString() || 0}</td>
                    </tr>
                  `).join('')}
                  <tr>
                    <td colspan="3" style="text-align: right;"><strong>合计</strong></td>
                    <td><strong>¥${totalAmount.toLocaleString()}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="info">
              <p><strong>合同内容：</strong></p>
              <p>${contract.content || ''}</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const productColumns = [
    { title: '产品名称', dataIndex: 'productName', key: 'productName' },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (qty) => qty?.toLocaleString() || 0,
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      render: (price) => `¥${price?.toLocaleString() || 0}`,
    },
    {
      title: '折扣',
      dataIndex: 'discount',
      key: 'discount',
      render: (discount) => `${discount || 0}%`,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
    },
  ];

  if (loading && !contract) {
    return <Card loading={loading}>加载中...</Card>;
  }

  if (!contract) {
    return <Card>合同不存在</Card>;
  }

  const totalAmount = products.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  return (
    <div>
      <Card
        title={
          <Space>
            <Button icon={<EditOutlined />} onClick={() => navigate(`/contracts?edit=${id}`)}>
              编辑
            </Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              打印
            </Button>
            <span>{contract.title}</span>
          </Space>
        }
      >
        <Descriptions bordered column={3}>
          <Descriptions.Item label="合同编号">{contract.contractNumber}</Descriptions.Item>
          <Descriptions.Item label="合同标题">{contract.title}</Descriptions.Item>
          <Descriptions.Item label="客户">
            {contract.customerName || contract.customer?.name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="金额">
            <strong style={{ color: '#f5222d', fontSize: 16 }}>
              ¥{totalAmount.toLocaleString()}
            </strong>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Space>
              <Tag color={
                contract.status === 'signed' ? 'green' :
                contract.status === 'approved' ? 'blue' :
                contract.status === 'pending' ? 'orange' :
                contract.status === 'rejected' ? 'red' : 'default'
              }>
                {contract.status === 'draft' ? '草稿' :
                 contract.status === 'pending' ? '待审批' :
                 contract.status === 'approved' ? '已审批' :
                 contract.status === 'signed' ? '已签署' :
                 contract.status === 'executing' ? '执行中' :
                 contract.status === 'completed' ? '已完成' :
                 contract.status === 'rejected' ? '已拒绝' : contract.status}
              </Tag>
              {contract.status === 'pending' && pendingApprovalCount > 0 && (
                <Tag color="orange">
                  待审批 ({pendingApprovalCount})
                </Tag>
              )}
            </Space>
          </Descriptions.Item>
          {contract.status === 'pending' && currentApprovers.length > 0 && (
            <Descriptions.Item label="当前审批人" span={2}>
              <Space>
                {currentApprovers.map((approver, index) => (
                  <Tag key={approver.id || index} color="blue">
                    {approver.name}
                  </Tag>
                ))}
              </Space>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="合同类型">
            {contract.contractType === 'sales' ? '销售合同' :
             contract.contractType === 'service' ? '服务合同' :
             contract.contractType === 'purchase' ? '采购合同' :
             contract.contractType === 'lease' ? '租赁合同' :
             contract.contractType === 'cooperation' ? '合作协议' :
             contract.contractType === 'other' ? '其他' :
             contract.contractType || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="签署日期">
            {contract.signDate ? new Date(contract.signDate).toLocaleDateString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="合同期限">
            {contract.startDate && contract.endDate
              ? `${new Date(contract.startDate).toLocaleDateString()} - ${new Date(contract.endDate).toLocaleDateString()}`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="签署人" span={2}>
            {(() => {
              const signers = contract.signers ? (typeof contract.signers === 'string' ? JSON.parse(contract.signers) : contract.signers) : [];
              return signers.length > 0 ? (
                <Space>
                  {signers.map((signerId, index) => {
                    const signer = users.find(u => u.id === signerId);
                    return (
                      <Tag key={index} color="blue">
                        {signer ? `${signer.name}${signer.email ? ` (${signer.email})` : ''}` : `签署人 ${index + 1} (ID: ${signerId})`}
                      </Tag>
                    );
                  })}
                </Space>
              ) : '-';
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="合同内容" span={3}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{contract.content || '-'}</div>
          </Descriptions.Item>
          <Descriptions.Item label="合同附件" span={3}>
            {(() => {
              const attachments = contract.attachments ? (typeof contract.attachments === 'string' ? JSON.parse(contract.attachments) : contract.attachments) : [];
              return attachments.length > 0 ? (
                <List
                  size="small"
                  dataSource={attachments}
                  renderItem={(item, index) => (
                    <List.Item>
                      <Space>
                        <a href={item.url || item.path} target="_blank" rel="noopener noreferrer">
                          {item.name || item.filename || `附件${index + 1}`}
                        </a>
                        {item.size && <span style={{ color: '#999', fontSize: 12 }}>
                          ({(item.size / 1024).toFixed(2)} KB)
                        </span>}
                      </Space>
                    </List.Item>
                  )}
                />
              ) : '-';
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="签名" span={3}>
            {(() => {
              const signatures = contract.signatures ? (typeof contract.signatures === 'string' ? JSON.parse(contract.signatures) : contract.signatures) : [];
              return signatures.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  {signatures.map((sig, index) => {
                    const signer = users.find(u => u.id === sig.userId);
                    return (
                      <div key={index} style={{ textAlign: 'center' }}>
                        <Image
                          src={sig.signature}
                          alt="签名"
                          width={150}
                          height={100}
                          style={{ objectFit: 'contain', border: '1px solid #d9d9d9', borderRadius: 4, padding: 8 }}
                        />
                        <div style={{ marginTop: 8, fontSize: 12 }}>
                          <div><strong>{signer ? signer.name : `用户${sig.userId}`}</strong></div>
                          {sig.signedAt && (
                            <div style={{ color: '#999' }}>
                              {new Date(sig.signedAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span style={{ color: '#999' }}>暂无签名</span>
              );
            })()}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Tabs
          defaultActiveKey="products"
          items={[
            {
              key: 'products',
              label: `产品明细 (${products.length})`,
              children: (
                <Table
                  columns={productColumns}
                  dataSource={products}
                  rowKey="id"
                  pagination={false}
                  summary={() => (
                    <Table.Summary fixed>
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={4}>
                          <strong>合计</strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1}>
                          <strong style={{ color: '#f5222d' }}>
                            ¥{totalAmount.toLocaleString()}
                          </strong>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              ),
            },
            {
              key: 'paymentPlans',
              label: `回款计划 (${paymentPlans.length})`,
              children: (
                <Table
                  size="small"
                  dataSource={paymentPlans}
                  rowKey="id"
                  pagination={false}
                  columns={[
                    { title: '计划编号', dataIndex: 'planNumber', key: 'planNumber' },
                    {
                      title: '计划日期',
                      dataIndex: 'planDate',
                      key: 'planDate',
                      render: (date) => (date ? new Date(date).toLocaleDateString() : '-'),
                    },
                    {
                      title: '计划金额',
                      dataIndex: 'amount',
                      key: 'amount',
                      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
                    },
                    {
                      title: '已回款',
                      dataIndex: 'receivedAmount',
                      key: 'receivedAmount',
                      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      render: (status) => {
                        const statusMap = {
                          pending: { color: 'orange', label: '待回款' },
                          partial: { color: 'blue', label: '部分回款' },
                          completed: { color: 'green', label: '已完成' },
                          overdue: { color: 'red', label: '逾期' },
                        };
                        const s = statusMap[status] || { color: 'default', label: status };
                        return <Tag color={s.color}>{s.label}</Tag>;
                      },
                    },
                  ]}
                />
              ),
            },
            {
              key: 'payments',
              label: `回款记录 (${payments.length})`,
              children: (
                <Table
                  size="small"
                  dataSource={payments}
                  rowKey="id"
                  pagination={false}
                  columns={[
                    { title: '回款单号', dataIndex: 'paymentNumber', key: 'paymentNumber' },
                    {
                      title: '回款日期',
                      dataIndex: 'paymentDate',
                      key: 'paymentDate',
                      render: (date) => (date ? new Date(date).toLocaleDateString() : '-'),
                    },
                    {
                      title: '回款金额',
                      dataIndex: 'amount',
                      key: 'amount',
                      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
                    },
                    {
                      title: '支付方式',
                      dataIndex: 'paymentMethod',
                      key: 'paymentMethod',
                    },
                  ]}
                />
              ),
            },
            {
              key: 'invoices',
              label: `发票记录 (${invoices.length})`,
              children: (
                <Table
                  size="small"
                  dataSource={invoices}
                  rowKey="id"
                  pagination={false}
                  columns={[
                    { title: '发票号码', dataIndex: 'invoiceNumber', key: 'invoiceNumber' },
                    {
                      title: '开票日期',
                      dataIndex: 'invoiceDate',
                      key: 'invoiceDate',
                      render: (date) => (date ? new Date(date).toLocaleDateString() : '-'),
                    },
                    {
                      title: '发票金额',
                      dataIndex: 'amount',
                      key: 'amount',
                      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      render: (status) => {
                        const statusMap = {
                          draft: { color: 'default', label: '草稿' },
                          issued: { color: 'green', label: '已开票' },
                          cancelled: { color: 'red', label: '已作废' },
                        };
                        const s = statusMap[status] || { color: 'default', label: status };
                        return <Tag color={s.color}>{s.label}</Tag>;
                      },
                    },
                  ]}
                />
              ),
            },
            {
              key: 'approvals',
              label: `审批记录 (${approvalRecords.length})${pendingApprovalCount > 0 ? ` - 待审批: ${pendingApprovalCount}` : ''}`,
              children: (
                <>
                  {pendingApprovalCount > 0 && (
                    <Alert
                      message="当前审批状态"
                      description={
                        <div>
                          <div style={{ marginBottom: 8 }}>
                            <strong>待审批任务数：</strong>{pendingApprovalCount}
                          </div>
                          {currentApprovers.length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <strong>当前审批人：</strong>
                              <Space style={{ marginLeft: 8 }}>
                                {currentApprovers.map((approver, index) => (
                                  <Tag key={approver.id || index} color="blue">
                                    {approver.name} {approver.email ? `(${approver.email})` : ''}
                                  </Tag>
                                ))}
                              </Space>
                            </div>
                          )}
                          {canWithdraw && workflowStatus === 'running' && (
                            <div>
                              <Button
                                type="default"
                                danger
                                icon={<StopOutlined />}
                                onClick={() => setWithdrawModalVisible(true)}
                              >
                                撤回流程
                              </Button>
                            </div>
                          )}
                          {workflowStatus === 'completed' && (
                            <div style={{ marginTop: 8, color: '#52c41a' }}>
                              <strong>✓ 流程已完成</strong>
                            </div>
                          )}
                        </div>
                      }
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  )}
                  {approvalRecords.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                      暂无审批记录
                      {contract.status === 'draft' && (
                        <div style={{ marginTop: 8 }}>
                          <Button 
                            type="link" 
                            onClick={async () => {
                              try {
                                const response = await approvalService.startApproval({
                                  moduleType: 'contract',
                                  moduleId: id
                                });
                                if (response.success) {
                                  message.success('审批流程已启动');
                                  loadApprovalRecords();
                                  loadContractDetail();
                                } else {
                                  message.error(response.message || '启动审批失败');
                                }
                              } catch (error) {
                                message.error(error.message || '启动审批失败');
                              }
                            }}
                          >
                            启动审批流程
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Timeline>
                      {approvalRecords.map((record, index) => {
                        // 使用后端返回的actionText，如果没有则使用映射
                        const actionMap = {
                          'start': '流程开始',
                          'complete': '流程完成',
                          'approve': '审批通过',
                          'reject': '审批拒绝',
                          'return': '退回',
                          'transfer': '转办',
                          'withdraw': '撤回流程',
                          'cancel': '取消',
                          'skip': '跳过',
                          'pending': '待审批'
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
                          'pending': 'orange'
                        };
                        
                        const actionLabel = record.actionText || actionMap[record.action] || record.action;
                        const actionColor = actionColorMap[record.action] || 'blue';
                        
                        // 获取操作人信息（优先使用operator，如果没有则使用approver）
                        const operator = record.operator || record.approver;
                        const operatorName = operator ? operator.name : (record.operatorName || record.approver?.name || '未知');
                        
                        // 获取发起人信息
                        const initiator = record.initiator;
                        const initiatorName = initiator ? initiator.name : '未知';
                        
                        // 获取节点名称
                        const nodeName = record.nodeName || '审批节点';
                        
                        return (
                          <Timeline.Item
                            key={record.id}
                            color={actionColor}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ marginBottom: 4 }}>
                                  <strong>{operatorName}</strong>
                                  <Tag color={actionColor} style={{ marginLeft: 8 }}>
                                    {actionLabel}
                                  </Tag>
                                  {record.action === 'start' && initiator && (
                                    <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>
                                      (发起人: {initiatorName})
                                    </span>
                                  )}
                                </div>
                                {record.comment && (
                                  <div style={{ color: '#666', marginTop: 4 }}>
                                    {record.comment}
                                  </div>
                                )}
                                {nodeName && (
                                  <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                                    节点: {nodeName}
                                    {record.nodeKey && (
                                      <span style={{ marginLeft: 8, color: '#ccc' }}>
                                        ({record.nodeKey})
                                      </span>
                                    )}
                                  </div>
                                )}
                                {record.action === 'pending' && record.dueTime && (
                                  <div style={{ color: '#ff9800', fontSize: 12, marginTop: 4 }}>
                                    截止: {new Date(record.dueTime).toLocaleString('zh-CN')}
                                  </div>
                                )}
                                {record.action === 'start' && initiator && (
                                  <div style={{ color: '#1890ff', fontSize: 12, marginTop: 4 }}>
                                    发起人: {initiatorName} {initiator.email ? `(${initiator.email})` : ''}
                                  </div>
                                )}
                                {record.action === 'pending' && operator && (
                                  <div style={{ color: '#1890ff', fontSize: 12, marginTop: 4 }}>
                                    审批人: {operatorName} {operator.email ? `(${operator.email})` : ''}
                                  </div>
                                )}
                                {record.fromNodeKey && record.toNodeKey && record.fromNodeKey !== record.toNodeKey && (
                                  <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                                    流程: {record.fromNodeKey} → {record.toNodeKey}
                                  </div>
                                )}
                                {record.nodeType === 'condition' && record.conditionInfo && (
                                  <div style={{ marginTop: 8, padding: 8, background: '#fff7e6', borderRadius: 4, fontSize: 12 }}>
                                    <div><strong>条件判断详情：</strong></div>
                                    <div>字段: {record.conditionInfo.field}</div>
                                    <div>操作符: {record.conditionInfo.operator}</div>
                                    <div>比较值: {record.conditionInfo.value || (record.conditionInfo.value1 && record.conditionInfo.value2 ? `${record.conditionInfo.value1} ~ ${record.conditionInfo.value2}` : '-')}</div>
                                  </div>
                                )}
                              </div>
                              <div style={{ color: '#999', fontSize: 12 }}>
                                {record.createdAt ? new Date(record.createdAt).toLocaleString('zh-CN') : '-'}
                              </div>
                            </div>
                          </Timeline.Item>
                        );
                      })}
                    </Timeline>
                  )}
                </>
              ),
            },
            {
              key: 'followUps',
              label: `跟进记录 (${followUps.length})`,
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setFollowUpModalVisible(true)}>
                      添加跟进记录
                    </Button>
                  </div>
                  <Timeline>
                    {followUps.map((followUp) => (
                      <Timeline.Item key={followUp.id}>
                        <div>
                          <strong>{followUp.title}</strong>
                          <div style={{ marginTop: 8 }}>{followUp.content}</div>
                          <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                            {followUp.userName} · {new Date(followUp.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="添加跟进记录"
        open={followUpModalVisible}
        onCancel={() => setFollowUpModalVisible(false)}
        onOk={() => followUpForm.submit()}
      >
        <Form form={followUpForm} onFinish={async (values) => {
          try {
            await followUpService.createFollowUp({
              ...values,
              type: 'contract',
              relatedId: id,
            });
            message.success('添加跟进记录成功');
            setFollowUpModalVisible(false);
            loadFollowUps();
          } catch (error) {
            message.error(error.message || '添加跟进记录失败');
          }
        }} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}>
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item name="followUpType" label="跟进类型" initialValue="note">
            <Select>
              <Option value="call">电话</Option>
              <Option value="email">邮件</Option>
              <Option value="meeting">会议</Option>
              <Option value="visit">拜访</Option>
              <Option value="note">备注</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 撤回流程 Modal */}
      <Modal
        title="撤回流程"
        open={withdrawModalVisible}
        onCancel={() => {
          setWithdrawModalVisible(false);
          withdrawForm.resetFields();
        }}
        onOk={async () => {
          try {
            const values = await withdrawForm.validateFields();
            const response = await approvalService.withdrawApproval('contracts', id, {
              comment: values.comment || '撤回流程'
            });
            if (response.success) {
              message.success('流程已撤回');
              setWithdrawModalVisible(false);
              withdrawForm.resetFields();
              loadApprovalRecords();
              loadContractDetail();
            } else {
              message.error(response.message || '撤回流程失败');
            }
          } catch (error) {
            if (error.errorFields) {
              // 表单验证错误
              return;
            }
            message.error(error.message || '撤回流程失败');
          }
        }}
        okText="确认撤回"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <Form form={withdrawForm} layout="vertical">
          <Form.Item
            name="comment"
            label="撤回原因"
            rules={[{ required: false }]}
          >
            <TextArea
              rows={4}
              placeholder="请输入撤回原因（可选）"
            />
          </Form.Item>
          <div style={{ color: '#999', fontSize: 12 }}>
            <p>提示：撤回流程后，所有待审批任务将被取消，合同状态将恢复为草稿。</p>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ContractDetail;

