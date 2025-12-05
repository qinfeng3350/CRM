import { useState, useEffect } from 'react';
import { Table, Button, Space, message, Card, Tag, Modal, Form, Input, Select, InputNumber, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { serviceService } from '../../services/serviceService';
import { customerService } from '../../services/customerService';

const { Option } = Select;
const { TextArea } = Input;

const ServiceTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadTickets();
    loadCustomers();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const response = await serviceService.getTickets({ page: 1, limit: 20 });
      if (response.success) {
        const ticketsList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setTickets(ticketsList);
      } else {
        message.error(response.message || '加载工单列表失败');
      }
    } catch (error) {
      message.error(error.message || '加载工单列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await customerService.getCustomers({ limit: 1000 });
      if (response.success) {
        const customersList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setCustomers(customersList);
      }
    } catch (error) {
      console.error('加载客户列表失败:', error);
    }
  };

  const handleCreate = () => {
    setEditingTicket(null);
    setModalVisible(true);
    form.resetFields();
  };

  const handleEdit = (record) => {
    setEditingTicket(record);
    setModalVisible(true);
    form.setFieldsValue({
      ...record,
      customerId: record.customerId,
    });
  };

  const handleDelete = async (id) => {
    try {
      await serviceService.deleteTicket(id);
      message.success('删除成功');
      loadTickets();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingTicket) {
        await serviceService.updateTicket(editingTicket.id, values);
        message.success('更新成功');
      } else {
        await serviceService.createTicket(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadTickets();
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const categoryOptions = [
    { value: 'consultation', label: '咨询' },
    { value: 'complaint', label: '投诉' },
    { value: 'technical', label: '技术问题' },
    { value: 'billing', label: '账单问题' },
    { value: 'other', label: '其他' },
  ];

  const priorityOptions = [
    { value: 'low', label: '低' },
    { value: 'medium', label: '中' },
    { value: 'high', label: '高' },
    { value: 'urgent', label: '紧急' },
  ];

  const columns = [
    { title: '工单号', dataIndex: 'ticketNumber', key: 'ticketNumber' },
    { title: '标题', dataIndex: 'title', key: 'title' },
    {
      title: '客户',
      dataIndex: 'customerId',
      key: 'customerId',
      render: (customerId) => {
        const customer = customers.find(c => c.id === customerId);
        return customer ? customer.name : customerId;
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category) => {
        const option = categoryOptions.find(c => c.value === category);
        return option ? option.label : category;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => {
        const colors = {
          low: 'default',
          medium: 'orange',
          high: 'red',
          urgent: 'purple',
        };
        const option = priorityOptions.find(p => p.value === priority);
        return <Tag color={colors[priority]}>{option ? option.label : priority}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          new: 'blue',
          assigned: 'cyan',
          in_progress: 'orange',
          resolved: 'green',
          closed: 'default',
        };
        const labels = {
          new: '新建',
          assigned: '已分配',
          in_progress: '处理中',
          resolved: '已解决',
          closed: '已关闭',
        };
        return <Tag color={colors[status]}>{labels[status] || status}</Tag>;
      },
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
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建工单
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={tickets}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={editingTicket ? '编辑工单' : '新建工单'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingTicket(null);
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="customerId"
            label="客户"
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <Select placeholder="请选择客户" showSearch filterOption={(input, option) =>
              option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }>
              {customers.map(customer => (
                <Option key={customer.id} value={customer.id}>
                  {customer.name} - {customer.company}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入工单标题" />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
            initialValue="other"
          >
            <Select>
              {categoryOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="priority"
            label="优先级"
            rules={[{ required: true, message: '请选择优先级' }]}
            initialValue="medium"
          >
            <Select>
              {priorityOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <TextArea rows={4} placeholder="请输入工单描述" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ServiceTickets;
