import { useState, useEffect } from 'react';
import { Table, Button, Space, message, Card, Tag, Modal, Form, Input, Select, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, DollarOutlined } from '@ant-design/icons';
import { marketingService } from '../../services/marketingService';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { TextArea } = Input;

const MarketingLeads = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const response = await marketingService.getLeads({ page: 1, limit: 20 });
      if (response.success) {
        const leadsList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setLeads(leadsList);
      } else {
        message.error(response.message || '加载线索列表失败');
      }
    } catch (error) {
      message.error(error.message || '加载线索列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingLead(null);
    setModalVisible(true);
    form.resetFields();
  };

  const handleEdit = (record) => {
    setEditingLead(record);
    setModalVisible(true);
    form.setFieldsValue({
      ...record,
    });
  };

  const handleDelete = async (id) => {
    try {
      await marketingService.deleteLead(id);
      message.success('删除成功');
      loadLeads();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleConvert = async (id, convertTo) => {
    try {
      await marketingService.convertLead(id, { convertTo });
      message.success(convertTo === 'customer' ? '已转化为客户' : '已转化为商机');
      loadLeads();
    } catch (error) {
      message.error(error.message || '转化失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingLead) {
        await marketingService.updateLead(editingLead.id, values);
        message.success('更新成功');
      } else {
        await marketingService.createLead(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadLeads();
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const statusOptions = [
    { value: 'new', label: '新建', color: 'blue' },
    { value: 'contacted', label: '已联系', color: 'cyan' },
    { value: 'qualified', label: '已确认', color: 'green' },
    { value: 'converted', label: '已转化', color: 'success' },
    { value: 'lost', label: '已丢失', color: 'red' },
  ];

  const sourceOptions = [
    '网站',
    '电话',
    '邮件',
    '展会',
    '转介绍',
    '广告',
    '其他',
  ];

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '公司', dataIndex: 'company', key: 'company' },
    { title: '电话', dataIndex: 'phone', key: 'phone' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '来源', dataIndex: 'source', key: 'source' },
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
      title: '质量',
      dataIndex: 'quality',
      key: 'quality',
      render: (quality) => `${quality || 0}%`,
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.status !== 'converted' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<UserOutlined />}
                onClick={() => handleConvert(record.id, 'customer')}
              >
                转客户
              </Button>
              <Button
                type="link"
                size="small"
                icon={<DollarOutlined />}
                onClick={() => handleConvert(record.id, 'opportunity')}
              >
                转商机
              </Button>
            </>
          )}
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
            新增线索
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={leads}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={editingLead ? '编辑线索' : '新增线索'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingLead(null);
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            name="company"
            label="公司"
          >
            <Input placeholder="请输入公司名称" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="电话"
          >
            <Input placeholder="请输入电话" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item
            name="source"
            label="来源"
            rules={[{ required: true, message: '请选择来源' }]}
          >
            <Select placeholder="请选择来源">
              {sourceOptions.map(source => (
                <Option key={source} value={source}>
                  {source}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
            initialValue="new"
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
            name="quality"
            label="质量评分"
          >
            <Input type="number" min={0} max={100} placeholder="0-100" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={4} placeholder="请输入描述" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default MarketingLeads;
