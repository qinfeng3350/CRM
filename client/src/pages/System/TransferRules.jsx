import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  message,
  Popconfirm,
  Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { systemService } from '../../services/systemService';

const { Option } = Select;
const { TextArea } = Input;

// 客户状态选项
const customerStatusOptions = [
  { value: 'potential', label: '潜在' },
  { value: 'intention', label: '意向' },
  { value: 'customer', label: '客户' },
  { value: 'lost', label: '流失' },
];

// 商机状态选项
const opportunityStatusOptions = [
  { value: 'new', label: '新建' },
  { value: 'contacted', label: '已联系' },
  { value: 'qualified', label: '已确认' },
  { value: 'proposal', label: '提案中' },
  { value: 'negotiation', label: '谈判中' },
  { value: 'won', label: '成交' },
  { value: 'lost', label: '失败' },
  { value: 'returned', label: '退回' },
];

const TransferRules = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await systemService.getTransferRules();
      if (response.success) {
        setRules(Array.isArray(response.data) ? response.data : []);
      } else {
        message.error(response.message || '加载规则列表失败');
      }
    } catch (error) {
      message.error('加载规则列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingRule(null);
    setModalVisible(true);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      autoTransfer: false,
      returnToPublic: false,
    });
  };

  const handleEdit = (record) => {
    setEditingRule(record);
    setModalVisible(true);
    form.setFieldsValue({
      ...record,
      conditions: record.conditions ? JSON.stringify(record.conditions, null, 2) : '',
    });
  };

  const handleDelete = async (id) => {
    try {
      await systemService.deleteTransferRule(id);
      message.success('删除成功');
      loadRules();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        conditions: values.conditions ? JSON.parse(values.conditions) : {},
      };
      
      if (editingRule) {
        await systemService.updateTransferRule(editingRule.id, data);
        message.success('更新成功');
      } else {
        await systemService.createTransferRule(data);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadRules();
    } catch (error) {
      message.error(error.message || (editingRule ? '更新失败' : '创建失败'));
    }
  };


  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '规则名称', dataIndex: 'name', key: 'name' },
    {
      title: '源状态',
      dataIndex: 'fromStatus',
      key: 'fromStatus',
      render: (status) => {
        const customerOption = customerStatusOptions.find((s) => s.value === status);
        const opportunityOption = opportunityStatusOptions.find((s) => s.value === status);
        return customerOption?.label || opportunityOption?.label || status;
      },
    },
    {
      title: '目标状态',
      dataIndex: 'toStatus',
      key: 'toStatus',
      render: (status) => {
        const customerOption = customerStatusOptions.find((s) => s.value === status);
        const opportunityOption = opportunityStatusOptions.find((s) => s.value === status);
        return customerOption?.label || opportunityOption?.label || status;
      },
    },
    {
      title: '自动流转',
      dataIndex: 'autoTransfer',
      key: 'autoTransfer',
      render: (auto) => <Tag color={auto ? 'green' : 'default'}>{auto ? '是' : '否'}</Tag>,
    },
    {
      title: '退回公海',
      dataIndex: 'returnToPublic',
      key: 'returnToPublic',
      render: (returnTo) => <Tag color={returnTo ? 'orange' : 'default'}>{returnTo ? '是' : '否'}</Tag>,
    },
    {
      title: '天数阈值',
      dataIndex: 'daysThreshold',
      key: 'daysThreshold',
      render: (days) => (days ? `${days}天` : '-'),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled) => <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定要删除吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增流转规则
        </Button>
      </div>
      <Table columns={columns} dataSource={rules} rowKey="id" loading={loading} />

      <Modal
        title={editingRule ? '编辑流转规则' : '新增流转规则'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingRule(null);
        }}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="例如：客户30天未跟进自动退回公海" />
          </Form.Item>
          <Form.Item name="fromStatus" label="源状态" rules={[{ required: true, message: '请选择源状态' }]}>
            <Select placeholder="请选择源状态" showSearch>
              {customerStatusOptions.map((option) => (
                <Option key={`customer_${option.value}`} value={option.value}>
                  {option.label} (客户)
                </Option>
              ))}
              {opportunityStatusOptions.map((option) => (
                <Option key={`opportunity_${option.value}`} value={option.value}>
                  {option.label} (商机)
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="toStatus" label="目标状态" rules={[{ required: true, message: '请选择目标状态' }]}>
            <Select placeholder="请选择目标状态" showSearch>
              {customerStatusOptions.map((option) => (
                <Option key={`customer_${option.value}`} value={option.value}>
                  {option.label} (客户)
                </Option>
              ))}
              {opportunityStatusOptions.map((option) => (
                <Option key={`opportunity_${option.value}`} value={option.value}>
                  {option.label} (商机)
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="autoTransfer" label="自动流转" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="returnToPublic" label="退回公海" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="daysThreshold" label="天数阈值（超过多少天未跟进触发）">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="留空则不限制" />
          </Form.Item>
          <Form.Item name="conditions" label="额外条件（JSON格式）">
            <TextArea rows={4} placeholder='例如: {"minAmount": 10000, "maxAmount": 100000}' />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default TransferRules;

