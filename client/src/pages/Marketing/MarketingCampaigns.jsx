import { useState, useEffect } from 'react';
import { Table, Button, Space, message, Card, Tag, Modal, Form, Input, Select, InputNumber, DatePicker, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { marketingService } from '../../services/marketingService';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const MarketingCampaigns = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const response = await marketingService.getCampaigns({ page: 1, limit: 20 });
      if (response.success) {
        const campaignsList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setCampaigns(campaignsList);
      } else {
        message.error(response.message || '加载活动列表失败');
      }
    } catch (error) {
      message.error(error.message || '加载活动列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCampaign(null);
    setModalVisible(true);
    form.resetFields();
  };

  const handleEdit = (record) => {
    setEditingCampaign(record);
    setModalVisible(true);
    form.setFieldsValue({
      ...record,
      startDate: record.startDate ? dayjs(record.startDate) : null,
      endDate: record.endDate ? dayjs(record.endDate) : null,
    });
  };

  const handleDelete = async (id) => {
    try {
      await marketingService.deleteCampaign(id);
      message.success('删除成功');
      loadCampaigns();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : null,
        endDate: values.endDate ? values.endDate.format('YYYY-MM-DD') : null,
      };
      if (editingCampaign) {
        await marketingService.updateCampaign(editingCampaign.id, data);
        message.success('更新成功');
      } else {
        await marketingService.createCampaign(data);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadCampaigns();
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const typeOptions = [
    { value: 'online', label: '线上活动' },
    { value: 'offline', label: '线下活动' },
    { value: 'email', label: '邮件营销' },
    { value: 'social', label: '社交媒体' },
    { value: 'other', label: '其他' },
  ];

  const statusOptions = [
    { value: 'planned', label: '计划中', color: 'blue' },
    { value: 'executing', label: '执行中', color: 'orange' },
    { value: 'completed', label: '已完成', color: 'green' },
    { value: 'cancelled', label: '已取消', color: 'red' },
  ];

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '活动名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const option = typeOptions.find(t => t.value === type);
        return option ? option.label : type;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const option = statusOptions.find(s => s.value === status);
        return <Tag color={option?.color}>{option?.label || status}</Tag>;
      },
    },
    {
      title: '开始日期',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '结束日期',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '预算',
      dataIndex: 'budget',
      key: 'budget',
      render: (budget) => `¥${budget?.toLocaleString() || 0}`,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDelete(record.id)}
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
    <>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增活动
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={campaigns}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={editingCampaign ? '编辑市场活动' : '新增市场活动'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingCampaign(null);
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="活动名称"
            rules={[{ required: true, message: '请输入活动名称' }]}
          >
            <Input placeholder="请输入活动名称" />
          </Form.Item>
          <Form.Item
            name="type"
            label="活动类型"
            rules={[{ required: true, message: '请选择活动类型' }]}
            initialValue="other"
          >
            <Select>
              {typeOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
            initialValue="planned"
          >
            <Select>
              {statusOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="startDate"
            label="开始日期"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="endDate"
            label="结束日期"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="budget"
            label="预算"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
          <Form.Item
            name="targetAudience"
            label="目标受众"
          >
            <Input placeholder="请输入目标受众" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={4} placeholder="请输入活动描述" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default MarketingCampaigns;
