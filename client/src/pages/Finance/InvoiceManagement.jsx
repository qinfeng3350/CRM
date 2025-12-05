import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  message,
  Tag,
  Descriptions,
  Tabs,
  Timeline,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PrinterOutlined,
  EyeOutlined,
  CheckOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { invoiceService } from '../../services/invoiceService';
import { contractService } from '../../services/contractService';
import { paymentService } from '../../services/paymentService';
import { approvalService } from '../../services/approvalService';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const invoiceStatusMap = {
  draft: { color: 'default', label: '草稿' },
  pending: { color: 'orange', label: '待审批' },
  approved: { color: 'green', label: '已审批' },
  issued: { color: 'green', label: '已开票' },
  rejected: { color: 'red', label: '已拒绝' },
  cancelled: { color: 'red', label: '已作废' },
};

const InvoiceManagement = () => {
  const [invoices, setInvoices] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [approvalRecords, setApprovalRecords] = useState([]);
  const [currentApprovers, setCurrentApprovers] = useState([]);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [form] = Form.useForm();
  const [withdrawForm] = Form.useForm();
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    loadInvoices();
    loadContracts();
    
    // 监听审批状态改变事件
    const handleApprovalChanged = (event) => {
      const { moduleId, action } = event.detail;
      console.log('[发票管理] 收到审批状态改变事件:', { moduleId, action });
      // 刷新列表
      loadInvoices();
      // 如果正在查看该发票的详情，也刷新详情
      if (viewingInvoice && viewingInvoice.id === moduleId) {
        handleViewDetail({ id: moduleId });
      }
    };
    
    window.addEventListener('invoiceApprovalChanged', handleApprovalChanged);
    
    return () => {
      window.removeEventListener('invoiceApprovalChanged', handleApprovalChanged);
    };
  }, [viewingInvoice]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const response = await invoiceService.getInvoices({});
      if (response.success) {
        let invoices = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        
        // 只检查状态为 draft 的发票，如果审批记录存在，则更新为 pending
        const draftInvoices = invoices.filter(inv => inv.status === 'draft');
        if (draftInvoices.length > 0) {
          const updatedInvoices = await Promise.all(invoices.map(async (invoice) => {
            if (invoice.status === 'draft') {
              try {
                const approvalResponse = await approvalService.getApprovalRecords('invoice', invoice.id);
                if (approvalResponse.success && approvalResponse.data && approvalResponse.data.length > 0) {
                  // 审批记录存在，说明流程已启动，更新状态
                  console.log(`[发票列表] 检测到发票 ${invoice.id} 有审批记录，更新状态为pending`);
                  return { ...invoice, status: 'pending' };
                }
              } catch (error) {
                console.error(`[发票列表] 检查发票 ${invoice.id} 审批记录失败:`, error);
              }
            }
            return invoice;
          }));
          setInvoices(updatedInvoices);
        } else {
          setInvoices(invoices);
        }
      }
    } catch (error) {
      message.error('加载发票列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadContracts = async () => {
    try {
      const response = await contractService.getContracts({ limit: 1000 });
      if (response.success) {
        setContracts(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载合同列表失败:', error);
    }
  };

  const loadPayments = async (contractId) => {
    try {
      const response = await paymentService.getPayments({ contractId });
      if (response.success) {
        setPayments(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载回款记录失败:', error);
    }
  };

  const handleAdd = () => {
    setEditingInvoice(null);
    setModalVisible(true);
    form.resetFields();
  };

  const handleEdit = (record) => {
    setEditingInvoice(record);
    setModalVisible(true);
    form.setFieldsValue({
      ...record,
      invoiceDate: record.invoiceDate ? dayjs(record.invoiceDate) : null,
    });
  };

  const handleDelete = async (id) => {
    try {
      await invoiceService.deleteInvoice(id);
      message.success('删除成功');
      loadInvoices();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleViewDetail = async (record) => {
    try {
      // 使用最新的记录数据，确保状态是最新的
      const invoiceId = record.id;
      const response = await invoiceService.getInvoice(invoiceId);
      if (response.success) {
        const invoiceData = response.data;
        setViewingInvoice(invoiceData);
        setWithdrawModalVisible(false);
        withdrawForm.resetFields();
        setDetailModalVisible(true);
        // 加载审批记录
        loadApprovalRecords(invoiceId);
        // 如果状态是 pending，也更新列表中的状态
        if (invoiceData.status === 'pending') {
          setInvoices(prevInvoices => 
            prevInvoices.map(inv => 
              inv.id === invoiceId ? { ...inv, status: 'pending' } : inv
            )
          );
        }
      } else {
        message.error('加载发票详情失败');
      }
    } catch (error) {
      message.error('加载发票详情失败');
    }
  };

  const loadApprovalRecords = async (invoiceId) => {
    try {
      const response = await approvalService.getApprovalRecords('invoice', invoiceId);
      if (response.success) {
        setApprovalRecords(response.data || []);
        setCurrentApprovers(response.currentApprovers || []);
        setPendingApprovalCount(response.pendingCount || 0);
      }
    } catch (error) {
      console.error('加载审批记录失败:', error);
    }
  };

  const handleStartApproval = async (record) => {
    try {
      console.log('[发起审批] 开始发起审批，发票ID:', record.id);
      
      const response = await approvalService.startApproval({
        moduleType: 'invoice',
        moduleId: record.id,
      });
      
      console.log('[发起审批] 响应:', response);
      
      // 无论成功与否，都检查审批记录和刷新列表
      let statusUpdated = false;
      if (response.success) {
        message.success('审批流程已启动');
        statusUpdated = true;
      } else {
        console.warn('[发起审批] 启动失败，但继续检查审批记录:', response.message);
        // 即使失败也检查审批记录，如果存在说明流程已启动
        try {
          const approvalResponse = await approvalService.getApprovalRecords('invoice', record.id);
          if (approvalResponse.success && approvalResponse.data && approvalResponse.data.length > 0) {
            // 审批记录存在，说明流程已启动
            console.log('[发起审批] 检测到审批记录，流程已启动');
            message.success('审批流程已启动');
            statusUpdated = true;
          } else {
            message.error(response.message || '启动审批失败');
          }
        } catch (checkError) {
          console.error('[发起审批] 检查审批记录失败:', checkError);
          message.error(response.message || '启动审批失败');
        }
      }
      
      // 强制刷新列表以确保数据同步
      await loadInvoices();
      
      // 如果状态已更新，再次确认并更新本地状态
      if (statusUpdated) {
        // 延迟一点再检查，确保后端状态已更新
        setTimeout(async () => {
          await loadInvoices();
        }, 500);
      }
    } catch (error) {
      console.error('[发起审批] 异常:', error);
      // 即使出错也检查审批记录，如果存在说明流程已启动
      try {
        const approvalResponse = await approvalService.getApprovalRecords('invoice', record.id);
        if (approvalResponse.success && approvalResponse.data && approvalResponse.data.length > 0) {
          // 审批记录存在，说明流程已启动
          console.log('[发起审批] 检测到审批记录，流程已启动');
          message.success('审批流程已启动');
          // 更新本地状态
          setInvoices(prevInvoices => 
            prevInvoices.map(inv => 
              inv.id === record.id ? { ...inv, status: 'pending' } : inv
            )
          );
        } else {
          message.error(error.message || '启动审批失败');
        }
      } catch (checkError) {
        console.error('[发起审批] 检查审批记录失败:', checkError);
        message.error(error.message || '启动审批失败');
      }
      // 刷新列表以确保数据同步
      await loadInvoices();
    }
  };

  const handleOpenWithdrawModal = () => {
    withdrawForm.resetFields();
    setWithdrawModalVisible(true);
  };

  const handleWithdraw = async () => {
    if (!viewingInvoice) return;
    try {
      const values = await withdrawForm.validateFields();
      const response = await approvalService.withdrawApproval('invoices', viewingInvoice.id, {
        comment: values.comment || '撤回流程',
      });
      if (response.success) {
        message.success('流程已撤回');
        // 立即更新本地状态
        setInvoices(prevInvoices => 
          prevInvoices.map(inv => 
            inv.id === viewingInvoice.id ? { ...inv, status: 'draft' } : inv
          )
        );
        setWithdrawModalVisible(false);
        withdrawForm.resetFields();
        setDetailModalVisible(false);
        setViewingInvoice(null);
        setApprovalRecords([]);
        setCurrentApprovers([]);
        setPendingApprovalCount(0);
        // 然后刷新列表以确保数据同步
        setTimeout(() => {
          loadInvoices();
        }, 500);
      } else {
        message.error(response.message || '撤回流程失败');
      }
    } catch (error) {
      if (error.errorFields) {
        return;
      }
      message.error(error.message || '撤回流程失败');
    }
  };

  const handlePrint = async (record) => {
    try {
      const response = await invoiceService.getInvoice(record.id);
      if (response.success) {
        setViewingInvoice(response.data);
        setPrintModalVisible(true);
      } else {
        message.error('加载发票信息失败');
      }
    } catch (error) {
      message.error('加载发票信息失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        invoiceDate: values.invoiceDate ? values.invoiceDate.format('YYYY-MM-DD') : null,
        totalAmount: (values.amount || 0) + (values.taxAmount || 0),
      };
      if (editingInvoice) {
        await invoiceService.updateInvoice(editingInvoice.id, data);
        message.success('更新成功');
      } else {
        await invoiceService.createInvoice(data);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadInvoices();
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const handleContractChange = (contractId) => {
    if (contractId) {
      loadPayments(contractId);
      const contract = contracts.find(c => c.id === contractId);
      if (contract) {
        form.setFieldsValue({
          buyerName: contract.customerName || '',
        });
      }
    }
  };

  const columns = [
    { title: '发票号码', dataIndex: 'invoiceNumber', key: 'invoiceNumber' },
    { title: '合同编号', dataIndex: 'contractNumber', key: 'contractNumber' },
    {
      title: '开票日期',
      dataIndex: 'invoiceDate',
      key: 'invoiceDate',
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '发票金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
    },
    {
      title: '价税合计',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const s = invoiceStatusMap[status] || { color: 'default', label: status || '-' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => handlePrint(record)}
          >
            打印
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleStartApproval(record)}
            >
              发起审批
            </Button>
          )}
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="发票管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增发票
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={invoices}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingInvoice ? '编辑发票' : '新增发票'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={800}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="contractId"
            label="合同"
            rules={[{ required: true }]}
          >
            <Select
              placeholder="请选择合同"
              showSearch
              onChange={handleContractChange}
            >
              {contracts.map(contract => (
                <Option key={contract.id} value={contract.id}>
                  {contract.contractNumber} - {contract.title}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="invoiceDate"
            label="开票日期"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="invoiceType"
            label="发票类型"
            initialValue="normal"
          >
            <Select>
              <Option value="normal">普通发票</Option>
              <Option value="special">专用发票</Option>
              <Option value="electronic">电子发票</Option>
            </Select>
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="amount"
              label="发票金额"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              />
            </Form.Item>
            <Form.Item
              name="taxRate"
              label="税率(%)"
              initialValue={0}
              style={{ flex: 1 }}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                max={100}
                formatter={(value) => `${value}%`}
              />
            </Form.Item>
          </Space>

          <Form.Item
            name="buyerName"
            label="购买方名称"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="buyerTaxNumber" label="购买方税号">
            <Input />
          </Form.Item>

          <Form.Item name="buyerAddress" label="购买方地址">
            <Input />
          </Form.Item>

          <Form.Item name="buyerPhone" label="购买方电话">
            <Input />
          </Form.Item>

          <Form.Item name="buyerBank" label="购买方开户行">
            <Input />
          </Form.Item>

          <Form.Item name="buyerAccount" label="购买方账号">
            <Input />
          </Form.Item>

          <Form.Item name="description" label="备注">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 发票详情Modal */}
      <Modal
        title="发票详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setViewingInvoice(null);
          setApprovalRecords([]);
          setCurrentApprovers([]);
          setPendingApprovalCount(0);
          setWithdrawModalVisible(false);
          withdrawForm.resetFields();
        }}
        footer={[
          <Button key="close" onClick={() => {
            setDetailModalVisible(false);
            setViewingInvoice(null);
            setApprovalRecords([]);
            setCurrentApprovers([]);
            setPendingApprovalCount(0);
            setWithdrawModalVisible(false);
            withdrawForm.resetFields();
          }}>
            关闭
          </Button>
        ]}
        width={900}
      >
        {viewingInvoice && (() => {
          const statusKey = viewingInvoice.status;
          const statusConfig = invoiceStatusMap[statusKey] || { color: 'default', label: statusKey || '-' };
          const isPending = statusKey === 'pending';
          // 确保ID比较时类型一致
          const currentUserId = currentUser?.id ? String(currentUser.id) : null;
          // 尝试多种可能的字段名
          const createdBy = viewingInvoice.createdBy || viewingInvoice.created_by || viewingInvoice.createdByUserId 
            ? String(viewingInvoice.createdBy || viewingInvoice.created_by || viewingInvoice.createdByUserId) 
            : null;
          const canWithdraw = isPending && currentUserId && createdBy && currentUserId === createdBy;
          // 调试信息（开发环境）
          if (process.env.NODE_ENV === 'development') {
            console.log('撤回按钮显示条件:', { 
              isPending, 
              statusKey,
              currentUserId, 
              createdBy, 
              viewingInvoice: { id: viewingInvoice.id, status: viewingInvoice.status, createdBy: viewingInvoice.createdBy, created_by: viewingInvoice.created_by },
              canWithdraw 
            });
          }
          return (
            <Tabs
              defaultActiveKey="info"
              items={[
                {
                  key: 'info',
                  label: '基本信息',
                  children: (
                    <>
                      {canWithdraw && (
                        <div style={{ textAlign: 'right', marginBottom: 16 }}>
                          <Button danger icon={<StopOutlined />} onClick={handleOpenWithdrawModal}>
                            撤回流程
                          </Button>
                        </div>
                      )}
                      {isPending && pendingApprovalCount > 0 && (
                        <Alert
                          message="当前审批状态"
                          description={
                            <div>
                              <div style={{ marginBottom: 8 }}>
                                <strong>当前审批人：</strong>
                                <Space>
                                  {currentApprovers.map((approver, index) => (
                                    <Tag key={approver.id || index} color="blue">
                                      {approver.name}
                                    </Tag>
                                  ))}
                                </Space>
                              </div>
                              <div>
                                <strong>待审批数量：</strong>{pendingApprovalCount}
                              </div>
                            </div>
                          }
                          type="info"
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                      )}
                      <Descriptions bordered column={2}>
                        <Descriptions.Item label="发票号码">{viewingInvoice.invoiceNumber}</Descriptions.Item>
                        <Descriptions.Item label="合同编号">{viewingInvoice.contractNumber}</Descriptions.Item>
                        <Descriptions.Item label="开票日期">
                          {viewingInvoice.invoiceDate ? dayjs(viewingInvoice.invoiceDate).format('YYYY-MM-DD') : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="发票类型">
                          {viewingInvoice.invoiceType === 'normal' ? '普通发票' :
                           viewingInvoice.invoiceType === 'special' ? '专用发票' :
                           viewingInvoice.invoiceType === 'electronic' ? '电子发票' : viewingInvoice.invoiceType}
                        </Descriptions.Item>
                        <Descriptions.Item label="发票金额">
                          <strong style={{ color: '#f5222d', fontSize: 16 }}>
                            ¥{viewingInvoice.amount?.toLocaleString() || 0}
                          </strong>
                        </Descriptions.Item>
                        <Descriptions.Item label="税率">
                          {viewingInvoice.taxRate || 0}%
                        </Descriptions.Item>
                        <Descriptions.Item label="税额">
                          ¥{((viewingInvoice.amount || 0) * (viewingInvoice.taxRate || 0) / 100).toLocaleString()}
                        </Descriptions.Item>
                        <Descriptions.Item label="价税合计">
                          <strong style={{ color: '#f5222d', fontSize: 16 }}>
                            ¥{viewingInvoice.totalAmount?.toLocaleString() || 0}
                          </strong>
                        </Descriptions.Item>
                        <Descriptions.Item label="状态" span={2}>
                          <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
                        </Descriptions.Item>
                        {isPending && currentApprovers.length > 0 && (
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
                        <Descriptions.Item label="购买方名称" span={2}>
                          {viewingInvoice.buyerName || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="购买方税号">{viewingInvoice.buyerTaxNumber || '-'}</Descriptions.Item>
                        <Descriptions.Item label="购买方电话">{viewingInvoice.buyerPhone || '-'}</Descriptions.Item>
                        <Descriptions.Item label="购买方地址" span={2}>
                          {viewingInvoice.buyerAddress || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="购买方开户行">{viewingInvoice.buyerBank || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="购买方账号">{viewingInvoice.buyerAccount || '-'}</Descriptions.Item>
                        <Descriptions.Item label="备注" span={2}>
                          {viewingInvoice.description || '-'}
                        </Descriptions.Item>
                      </Descriptions>
                    </>
                  ),
                },
                {
                  key: 'approval',
                  label: `审批记录 (${approvalRecords.length})${pendingApprovalCount > 0 ? ` - 待审批:${pendingApprovalCount}` : ''}`,
                  children: (
                    <Timeline
                      items={
                        approvalRecords.length === 0 ? [
                          { children: '暂无审批记录' }
                        ] : approvalRecords.map((record, index) => {
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
                            'pending': '待审批',
                          };
                          
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
                            'pending': 'orange',
                          };
                          
                          const actionLabel = actionMap[record.action] || record.action;
                          const actionColor = actionColorMap[record.action] || 'blue';
                          const operatorName = record.operatorName || '系统';
                          
                          return {
                            key: `${record.id}_${index}`,
                            color: actionColor,
                            children: (
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
                                </div>
                              </div>
                            ),
                          };
                        })
                      }
                    />
                  ),
                },
              ]}
            />
          );
        })()}
      </Modal>

      {/* 打印模板Modal */}
      <Modal
        title="发票打印"
        open={printModalVisible}
        onCancel={() => {
          setPrintModalVisible(false);
          setViewingInvoice(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setPrintModalVisible(false);
            setViewingInvoice(null);
          }}>
            关闭
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => {
              const printContent = document.getElementById('invoice-print-content');
              if (printContent) {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta charset="UTF-8">
                      <title>发票打印</title>
                      <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th, td { border: 1px solid #000; padding: 10px; text-align: left; }
                        th { background-color: #f0f0f0; text-align: center; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        h1 { text-align: center; font-size: 24px; margin-bottom: 30px; }
                      </style>
                    </head>
                    <body>
                      ${printContent.innerHTML}
                    </body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.print();
                }
              }
            }}
          >
            打印
          </Button>
        ]}
        width={900}
      >
        {viewingInvoice && (
          <div id="invoice-print-content" style={{ padding: 20, backgroundColor: '#fff' }}>
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
              <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10 }}>
                {viewingInvoice.invoiceType === 'special' ? '增值税专用发票' : '增值税普通发票'}
              </h1>
            </div>
            
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div><strong>发票号码：</strong>{viewingInvoice.invoiceNumber}</div>
                <div><strong>开票日期：</strong>{viewingInvoice.invoiceDate ? dayjs(viewingInvoice.invoiceDate).format('YYYY年MM月DD日') : '-'}</div>
              </div>
              <div>
                <div><strong>合同编号：</strong>{viewingInvoice.contractNumber || '-'}</div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, border: '1px solid #000' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #000', padding: 10, textAlign: 'center', width: '40%' }}>购买方信息</th>
                  <th style={{ border: '1px solid #000', padding: 10, textAlign: 'center', width: '60%' }}>销售方信息</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: 10, verticalAlign: 'top' }}>
                    <div><strong>名称：</strong>{viewingInvoice.buyerName || '-'}</div>
                    <div><strong>纳税人识别号：</strong>{viewingInvoice.buyerTaxNumber || '-'}</div>
                    <div><strong>地址、电话：</strong>{viewingInvoice.buyerAddress || '-'} {viewingInvoice.buyerPhone || ''}</div>
                    <div><strong>开户行及账号：</strong>{viewingInvoice.buyerBank || '-'} {viewingInvoice.buyerAccount || ''}</div>
                  </td>
                  <td style={{ border: '1px solid #000', padding: 10, verticalAlign: 'top' }}>
                    <div><strong>名称：</strong>（销售方信息）</div>
                    <div><strong>纳税人识别号：</strong>（销售方税号）</div>
                    <div><strong>地址、电话：</strong>（销售方地址电话）</div>
                    <div><strong>开户行及账号：</strong>（销售方开户行账号）</div>
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, border: '1px solid #000' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #000', padding: 10, textAlign: 'center' }}>货物或应税劳务名称</th>
                  <th style={{ border: '1px solid #000', padding: 10, textAlign: 'center' }}>规格型号</th>
                  <th style={{ border: '1px solid #000', padding: 10, textAlign: 'center' }}>单位</th>
                  <th style={{ border: '1px solid #000', padding: 10, textAlign: 'center' }}>数量</th>
                  <th style={{ border: '1px solid #000', padding: 10, textAlign: 'center' }}>单价</th>
                  <th style={{ border: '1px solid #000', padding: 10, textAlign: 'center' }}>金额</th>
                  <th style={{ border: '1px solid #000', padding: 10, textAlign: 'center' }}>税率</th>
                  <th style={{ border: '1px solid #000', padding: 10, textAlign: 'center' }}>税额</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', padding: 10, textAlign: 'center' }}>服务费</td>
                  <td style={{ border: '1px solid #000', padding: 10, textAlign: 'center' }}>-</td>
                  <td style={{ border: '1px solid #000', padding: 10, textAlign: 'center' }}>项</td>
                  <td style={{ border: '1px solid #000', padding: 10, textAlign: 'center' }}>1</td>
                  <td style={{ border: '1px solid #000', padding: 10, textAlign: 'right' }}>¥{viewingInvoice.amount?.toLocaleString() || 0}</td>
                  <td style={{ border: '1px solid #000', padding: 10, textAlign: 'right' }}>¥{viewingInvoice.amount?.toLocaleString() || 0}</td>
                  <td style={{ border: '1px solid #000', padding: 10, textAlign: 'center' }}>{viewingInvoice.taxRate || 0}%</td>
                  <td style={{ border: '1px solid #000', padding: 10, textAlign: 'right' }}>
                    ¥{((viewingInvoice.amount || 0) * (viewingInvoice.taxRate || 0) / 100).toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td colSpan={7} style={{ border: '1px solid #000', padding: 10, textAlign: 'right', fontWeight: 'bold' }}>合计</td>
                  <td style={{ border: '1px solid #000', padding: 10, textAlign: 'right', fontWeight: 'bold' }}>
                    ¥{viewingInvoice.totalAmount?.toLocaleString() || 0}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: 20, fontSize: 12 }}>
              <div><strong>价税合计（大写）：</strong>{convertToChineseCurrency(viewingInvoice.totalAmount || 0)}</div>
              <div style={{ marginTop: 10 }}><strong>价税合计（小写）：</strong>¥{viewingInvoice.totalAmount?.toLocaleString() || 0}</div>
            </div>

            {viewingInvoice.description && (
              <div style={{ marginTop: 20, padding: 10, border: '1px solid #ddd' }}>
                <strong>备注：</strong>{viewingInvoice.description}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 撤回流程 Modal */}
      <Modal
        title="撤回流程"
        open={withdrawModalVisible}
        onCancel={() => {
          setWithdrawModalVisible(false);
          withdrawForm.resetFields();
        }}
        onOk={handleWithdraw}
        okText="确认撤回"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Form form={withdrawForm} layout="vertical">
          <Form.Item
            name="comment"
            label="撤回原因"
            rules={[{ required: false }]}
          >
            <TextArea rows={4} placeholder="请输入撤回原因（可选）" />
          </Form.Item>
          <div style={{ color: '#999', fontSize: 12 }}>
            <p>提示：撤回流程后，所有待审批任务将被取消，发票状态将恢复为草稿。</p>
          </div>
        </Form>
      </Modal>
    </Card>
  );
};

// 数字转中文大写金额
const convertToChineseCurrency = (num) => {
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿'];
  
  if (num === 0) return '零元整';
  
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);
  
  let result = '';
  
  // 处理整数部分
  if (integerPart > 0) {
    const numStr = integerPart.toString();
    const len = numStr.length;
    
    for (let i = 0; i < len; i++) {
      const digit = parseInt(numStr[i]);
      const pos = len - i - 1;
      
      if (digit !== 0) {
        result += digits[digit] + units[pos % 4];
      } else if (result && result[result.length - 1] !== '零') {
        result += '零';
      }
      
      if (pos % 4 === 0 && pos > 0) {
        result += bigUnits[Math.floor(pos / 4)];
      }
    }
    result += '元';
  }
  
  // 处理小数部分
  if (decimalPart > 0) {
    const jiao = Math.floor(decimalPart / 10);
    const fen = decimalPart % 10;
    
    if (jiao > 0) {
      result += digits[jiao] + '角';
    }
    if (fen > 0) {
      result += digits[fen] + '分';
    }
  } else {
    result += '整';
  }
  
  return result;
};

export default InvoiceManagement;

