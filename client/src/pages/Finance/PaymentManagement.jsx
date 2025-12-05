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
  Tabs,
  Statistic,
  Row,
  Col,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { paymentService } from '../../services/paymentService';
import { contractService } from '../../services/contractService';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const PaymentManagement = () => {
  const [activeTab, setActiveTab] = useState('plans');
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [planForm] = Form.useForm();
  const [paymentForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    if (activeTab === 'plans') {
      loadPaymentPlans();
    } else if (activeTab === 'payments') {
      loadPayments();
    } else if (activeTab === 'summary') {
      loadSummary();
    }
  };

  const loadPaymentPlans = async () => {
    setLoading(true);
    try {
      const response = await paymentService.getPaymentPlans({});
      if (response.success) {
        setPaymentPlans(response.data || []);
      }
    } catch (error) {
      message.error('加载回款计划失败');
    } finally {
      setLoading(false);
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    try {
      const response = await paymentService.getPayments({});
      if (response.success) {
        setPayments(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      message.error('加载回款记录失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await paymentService.getFinancialSummary({});
      if (response.success) {
        setSummary(response.data || {});
      }
    } catch (error) {
      console.error('加载财务统计失败:', error);
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

  useEffect(() => {
    loadContracts();
  }, []);

  const handleAddPlan = () => {
    setEditingPlan(null);
    setPlanModalVisible(true);
    planForm.resetFields();
  };

  const handleEditPlan = (record) => {
    setEditingPlan(record);
    setPlanModalVisible(true);
    planForm.setFieldsValue({
      ...record,
      planDate: record.planDate ? dayjs(record.planDate) : null,
    });
  };

  const handleDeletePlan = async (id) => {
    try {
      await paymentService.deletePaymentPlan(id);
      message.success('删除成功');
      loadPaymentPlans();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handlePlanSubmit = async (values) => {
    try {
      const data = {
        ...values,
        planDate: values.planDate ? values.planDate.format('YYYY-MM-DD') : null,
      };
      if (editingPlan) {
        await paymentService.updatePaymentPlan(editingPlan.id, data);
        message.success('更新成功');
      } else {
        await paymentService.createPaymentPlan(data);
        message.success('创建成功');
      }
      setPlanModalVisible(false);
      loadPaymentPlans();
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const handleAddPayment = () => {
    setEditingPayment(null);
    setPaymentModalVisible(true);
    paymentForm.resetFields();
  };

  const handleDeletePayment = async (id) => {
    try {
      await paymentService.deletePayment(id);
      message.success('删除成功');
      loadPayments();
      loadSummary();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handlePaymentSubmit = async (values) => {
    try {
      const data = {
        ...values,
        paymentDate: values.paymentDate ? values.paymentDate.format('YYYY-MM-DD') : null,
      };
      if (editingPayment) {
        await paymentService.updatePayment(editingPayment.id, data);
        message.success('更新成功');
      } else {
        await paymentService.createPayment(data);
        message.success('创建成功');
      }
      setPaymentModalVisible(false);
      loadPayments();
      loadSummary();
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const planColumns = [
    { title: '计划编号', dataIndex: 'planNumber', key: 'planNumber' },
    { title: '合同编号', dataIndex: 'contractNumber', key: 'contractNumber' },
    {
      title: '计划日期',
      dataIndex: 'planDate',
      key: 'planDate',
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
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
          cancelled: { color: 'default', label: '已取消' },
        };
        const s = statusMap[status] || { color: 'default', label: status };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEditPlan(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDeletePlan(record.id)}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const paymentColumns = [
    { title: '回款单号', dataIndex: 'paymentNumber', key: 'paymentNumber' },
    { title: '合同编号', dataIndex: 'contractNumber', key: 'contractNumber' },
    {
      title: '回款日期',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
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
      render: (method) => {
        const methodMap = {
          cash: '现金',
          bank_transfer: '银行转账',
          check: '支票',
          alipay: '支付宝',
          wechat: '微信',
          other: '其他',
        };
        return methodMap[method] || method;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => {
            setEditingPayment(record);
            setPaymentModalVisible(true);
            paymentForm.setFieldsValue({
              ...record,
              paymentDate: record.paymentDate ? dayjs(record.paymentDate) : null,
            });
          }}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDeletePayment(record.id)}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'plans',
            label: '回款计划',
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPlan}>
                    新增回款计划
                  </Button>
                </div>
                <Table
                  columns={planColumns}
                  dataSource={paymentPlans}
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                />
              </>
            ),
          },
          {
            key: 'payments',
            label: '回款记录',
            children: (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPayment}>
                    新增回款记录
                  </Button>
                </div>
                <Table
                  columns={paymentColumns}
                  dataSource={payments}
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                />
              </>
            ),
          },
          {
            key: 'summary',
            label: '财务统计',
            children: (
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="合同总金额"
                    value={summary.totalContractAmount || 0}
                    prefix="¥"
                    precision={2}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="计划回款金额"
                    value={summary.totalPlannedAmount || 0}
                    prefix="¥"
                    precision={2}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="已回款金额"
                    value={summary.totalReceivedAmount || 0}
                    prefix="¥"
                    precision={2}
                    valueStyle={{ color: '#3f8600' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="未回款金额"
                    value={summary.totalOutstandingAmount || 0}
                    prefix="¥"
                    precision={2}
                    valueStyle={{ color: '#cf1322' }}
                  />
                </Col>
              </Row>
            ),
          },
        ]}
      />

      <Modal
        title={editingPlan ? '编辑回款计划' : '新增回款计划'}
        open={planModalVisible}
        onCancel={() => setPlanModalVisible(false)}
        onOk={() => planForm.submit()}
      >
        <Form form={planForm} onFinish={handlePlanSubmit} layout="vertical">
          <Form.Item
            name="contractId"
            label="合同"
            rules={[{ required: true }]}
          >
            <Select placeholder="请选择合同" showSearch>
              {contracts.map(contract => (
                <Option key={contract.id} value={contract.id}>
                  {contract.contractNumber} - {contract.title}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="planDate"
            label="计划日期"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="amount"
            label="计划金额"
            rules={[{ required: true }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingPayment ? '编辑回款记录' : '新增回款记录'}
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        onOk={() => paymentForm.submit()}
        width={600}
      >
        <Form form={paymentForm} onFinish={handlePaymentSubmit} layout="vertical">
          <Form.Item
            name="contractId"
            label="合同"
            rules={[{ required: true }]}
          >
            <Select placeholder="请选择合同" showSearch>
              {contracts.map(contract => (
                <Option key={contract.id} value={contract.id}>
                  {contract.contractNumber} - {contract.title}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="paymentDate"
            label="回款日期"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="amount"
            label="回款金额"
            rules={[{ required: true }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
          <Form.Item
            name="paymentMethod"
            label="支付方式"
            initialValue="bank_transfer"
          >
            <Select>
              <Option value="cash">现金</Option>
              <Option value="bank_transfer">银行转账</Option>
              <Option value="check">支票</Option>
              <Option value="alipay">支付宝</Option>
              <Option value="wechat">微信</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="bankAccount" label="银行账户">
            <Input />
          </Form.Item>
          <Form.Item name="receiptNumber" label="收据编号">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default PaymentManagement;

