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
  Select,
  message,
  Tag,
  Timeline,
  Divider,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  PhoneOutlined,
  MailOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { customerService } from '../../services/customerService';
import { contactService } from '../../services/contactService';
import { followUpService } from '../../services/followUpService';
import { opportunityService } from '../../services/opportunityService';

const { TabPane } = Tabs;
const { TextArea } = Input;

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm] = Form.useForm();
  const [followUpForm] = Form.useForm();

  useEffect(() => {
    loadCustomerDetail();
  }, [id]);

  const loadCustomerDetail = async () => {
    setLoading(true);
    try {
      const response = await customerService.getCustomer(id);
      if (response.success) {
        setCustomer(response.data);
        setContacts(response.data.contacts || []);
        setFollowUps(response.data.followUps || []);
        setOpportunities(response.data.opportunities || []);
      } else {
        message.error(response.message || '加载客户详情失败');
      }
    } catch (error) {
      message.error(error.message || '加载客户详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = () => {
    setEditingContact(null);
    setContactModalVisible(true);
    contactForm.resetFields();
    contactForm.setFieldsValue({ customerId: id });
  };

  const handleEditContact = (contact) => {
    setEditingContact(contact);
    setContactModalVisible(true);
    contactForm.setFieldsValue(contact);
  };

  const handleContactSubmit = async (values) => {
    try {
      if (editingContact) {
        await contactService.updateContact(editingContact.id, values);
        message.success('更新联系人成功');
      } else {
        await contactService.createContact({ ...values, customerId: id });
        message.success('创建联系人成功');
      }
      setContactModalVisible(false);
      loadCustomerDetail();
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const handleAddFollowUp = () => {
    setFollowUpModalVisible(true);
    followUpForm.resetFields();
  };

  const handleFollowUpSubmit = async (values) => {
    try {
      await followUpService.createFollowUp({
        ...values,
        type: 'customer',
        relatedId: id,
      });
      message.success('添加跟进记录成功');
      setFollowUpModalVisible(false);
      loadCustomerDetail();
    } catch (error) {
      message.error(error.message || '添加跟进记录失败');
    }
  };

  const contactColumns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '职位', dataIndex: 'position', key: 'position' },
    { title: '电话', dataIndex: 'phone', key: 'phone' },
    { title: '手机', dataIndex: 'mobile', key: 'mobile' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '主要联系人',
      dataIndex: 'isPrimary',
      key: 'isPrimary',
      render: (isPrimary) => (
        <Tag color={isPrimary ? 'green' : 'default'}>
          {isPrimary ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => handleEditContact(record)}>
          编辑
        </Button>
      ),
    },
  ];

  const opportunityColumns = [
    { title: '商机名称', dataIndex: 'name', key: 'name' },
    {
      title: '金额',
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
          new: { color: 'blue', label: '新建' },
          contacted: { color: 'cyan', label: '已联系' },
          qualified: { color: 'green', label: '已确认' },
          won: { color: 'success', label: '成交' },
          lost: { color: 'red', label: '失败' },
        };
        const s = statusMap[status] || { color: 'default', label: status };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(`/opportunities?customerId=${id}`)}
        >
          查看
        </Button>
      ),
    },
  ];

  if (loading && !customer) {
    return <Card loading={loading}>加载中...</Card>;
  }

  if (!customer) {
    return <Card>客户不存在</Card>;
  }

  return (
    <div>
      <Card
        title={
          <Space>
            <Button icon={<EditOutlined />} onClick={() => navigate(`/customers?edit=${id}`)}>
              编辑
            </Button>
            <span>{customer.name}</span>
          </Space>
        }
        extra={
          <Space>
            {customer.phone && (
              <Button icon={<PhoneOutlined />} href={`tel:${customer.phone}`}>
                拨打电话
              </Button>
            )}
            {customer.email && (
              <Button icon={<MailOutlined />} href={`mailto:${customer.email}`}>
                发送邮件
              </Button>
            )}
          </Space>
        }
      >
        <Descriptions bordered column={3}>
          <Descriptions.Item label="客户名称">{customer.name}</Descriptions.Item>
          <Descriptions.Item label="公司">{customer.company || '-'}</Descriptions.Item>
          <Descriptions.Item label="电话">{customer.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{customer.email || '-'}</Descriptions.Item>
          <Descriptions.Item label="客户池">
            <Tag color={customer.poolType === 'public' ? 'blue' : 'green'}>
              {customer.poolType === 'public' ? '公海' : '私海'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="分类">
            <Tag>
              {customer.category === 'potential' ? '潜在' :
               customer.category === 'intention' ? '意向' :
               customer.category === 'customer' ? '客户' : '流失'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="行业">{customer.industry || '-'}</Descriptions.Item>
          <Descriptions.Item label="规模">
            {customer.scale === 'small' ? '小型' :
             customer.scale === 'medium' ? '中型' : '大型'}
          </Descriptions.Item>
          <Descriptions.Item label="地址" span={3}>{customer.address || '-'}</Descriptions.Item>
          <Descriptions.Item label="描述" span={3}>{customer.description || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Tabs defaultActiveKey="contacts">
          <TabPane
            tab={
              <span>
                <UserOutlined /> 联系人 ({contacts.length})
              </span>
            }
            key="contacts"
          >
            <div style={{ marginBottom: 16 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddContact}>
                新增联系人
              </Button>
            </div>
            <Table
              columns={contactColumns}
              dataSource={contacts}
              rowKey="id"
              pagination={false}
            />
          </TabPane>

          <TabPane tab={`跟进记录 (${followUps.length})`} key="followUps">
            <div style={{ marginBottom: 16 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddFollowUp}>
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
          </TabPane>

          <TabPane tab={`关联商机 (${opportunities.length})`} key="opportunities">
            <Table
              columns={opportunityColumns}
              dataSource={opportunities}
              rowKey="id"
              pagination={false}
            />
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title={editingContact ? '编辑联系人' : '新增联系人'}
        open={contactModalVisible}
        onCancel={() => setContactModalVisible(false)}
        onOk={() => contactForm.submit()}
      >
        <Form form={contactForm} onFinish={handleContactSubmit} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="position" label="职位">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input />
          </Form.Item>
          <Form.Item name="mobile" label="手机">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input />
          </Form.Item>
          <Form.Item name="isPrimary" label="主要联系人" valuePropName="checked">
            <Select>
              <Option value={true}>是</Option>
              <Option value={false}>否</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加跟进记录"
        open={followUpModalVisible}
        onCancel={() => setFollowUpModalVisible(false)}
        onOk={() => followUpForm.submit()}
      >
        <Form form={followUpForm} onFinish={handleFollowUpSubmit} layout="vertical">
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
    </div>
  );
};

export default CustomerDetail;

