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
  Spin,
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  PrinterOutlined,
  SendOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { quotationService } from '../../services/quotationService';
import { followUpService } from '../../services/followUpService';
import { productService } from '../../services/productService';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

const QuotationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState(null);
  const [items, setItems] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  const [itemForm] = Form.useForm();
  const [followUpForm] = Form.useForm();

  useEffect(() => {
    loadQuotationDetail();
    loadAllProducts();
  }, [id]);

  const loadQuotationDetail = async () => {
    setLoading(true);
    try {
      const response = await quotationService.getQuotation(id);
      if (response.success) {
        setQuotation(response.data);
        setItems(response.data.items || []);
      } else {
        message.error(response.message || '加载报价单详情失败');
      }
    } catch (error) {
      message.error(error.message || '加载报价单详情失败');
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
        type: 'quotation',
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

  const handleSend = async () => {
    try {
      await quotationService.sendQuotation(id);
      message.success('报价单已发送');
      loadQuotationDetail();
    } catch (error) {
      message.error(error.message || '发送失败');
    }
  };

  const handleAddItem = () => {
    setItemModalVisible(true);
    itemForm.resetFields();
  };

  const handleItemSubmit = async (values) => {
    try {
      const product = allProducts.find(p => p.id === values.productId);
      if (!product) {
        message.error('产品不存在');
        return;
      }
      
      const amount = (values.quantity || 0) * (values.unitPrice || 0) * (1 - (values.discount || 0) / 100);
      
      const newItem = {
        ...values,
        productName: product.name || '',
        productCode: product.code || '',
        amount: amount
      };

      const updatedItems = [...items, newItem];
      
      // 重新计算总金额（考虑折扣和税率）
      let totalAmount = updatedItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      if (quotation.discount) {
        totalAmount = totalAmount * (1 - quotation.discount / 100);
      }
      if (quotation.taxRate) {
        totalAmount = totalAmount * (1 + quotation.taxRate / 100);
      }

      await quotationService.updateQuotation(id, {
        items: updatedItems,
        totalAmount: totalAmount
      });

      message.success('添加产品成功');
      setItemModalVisible(false);
      itemForm.resetFields();
      loadQuotationDetail();
    } catch (error) {
      message.error(error.message || '添加产品失败');
    }
  };

  const handleDeleteItem = async (itemIndex) => {
    try {
      const updatedItems = items.filter((_, index) => index !== itemIndex);
      
      // 重新计算总金额（考虑折扣和税率）
      let totalAmount = updatedItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      if (quotation.discount) {
        totalAmount = totalAmount * (1 - quotation.discount / 100);
      }
      if (quotation.taxRate) {
        totalAmount = totalAmount * (1 + quotation.taxRate / 100);
      }

      await quotationService.updateQuotation(id, {
        items: updatedItems,
        totalAmount: totalAmount
      });

      message.success('删除产品成功');
      loadQuotationDetail();
    } catch (error) {
      message.error(error.message || '删除产品失败');
    }
  };

  const handleFollowUpSubmit = async (values) => {
    try {
      await followUpService.createFollowUp({
        ...values,
        type: 'quotation',
        relatedId: id
      });
      message.success('添加跟进记录成功');
      setFollowUpModalVisible(false);
      followUpForm.resetFields();
      loadFollowUps();
    } catch (error) {
      message.error(error.message || '添加跟进记录失败');
    }
  };

  const statusOptions = [
    { value: 'draft', label: '草稿', color: 'default' },
    { value: 'sent', label: '已发送', color: 'blue' },
    { value: 'accepted', label: '已接受', color: 'green' },
    { value: 'rejected', label: '已拒绝', color: 'red' },
    { value: 'expired', label: '已过期', color: 'orange' },
  ];

  const itemColumns = [
    { title: '序号', key: 'index', width: 60, render: (_, __, index) => index + 1 },
    { title: '产品名称', dataIndex: 'productName', key: 'productName' },
    { title: '产品编码', dataIndex: 'productCode', key: 'productCode' },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', render: (qty) => qty?.toLocaleString() || 0 },
    { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', render: (price) => `¥${price?.toLocaleString() || 0}` },
    { title: '折扣(%)', dataIndex: 'discount', key: 'discount', render: (discount) => `${discount || 0}%` },
    { title: '金额', dataIndex: 'amount', key: 'amount', render: (amount) => `¥${amount?.toLocaleString() || 0}` },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, __, index) => (
        <Button type="link" danger size="small" onClick={() => handleDeleteItem(index)}>
          删除
        </Button>
      ),
    },
  ];

  const followUpColumns = [
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm') },
    { title: '类型', dataIndex: 'followUpType', key: 'followUpType' },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true },
  ];

  if (loading && !quotation) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!quotation) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <p>报价单不存在</p>
          <Button onClick={() => navigate('/quotations')}>返回列表</Button>
        </div>
      </Card>
    );
  }

  const statusOption = statusOptions.find(s => s.value === quotation.status);

  return (
    <div>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/quotations')}>
            返回
          </Button>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/quotations?edit=${id}`)}>
            编辑
          </Button>
          {quotation.status === 'draft' && (
            <Button type="primary" icon={<SendOutlined />} onClick={handleSend}>
              发送报价单
            </Button>
          )}
          <Button icon={<PrinterOutlined />}>打印</Button>
        </Space>

        <Descriptions title="报价单信息" bordered column={2}>
          <Descriptions.Item label="报价单号">{quotation.quotationNumber}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusOption?.color}>{statusOption?.label || quotation.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="标题">{quotation.title}</Descriptions.Item>
          <Descriptions.Item label="客户">{quotation.customerName || '-'}</Descriptions.Item>
          <Descriptions.Item label="关联商机">{quotation.opportunityName || '-'}</Descriptions.Item>
          <Descriptions.Item label="总金额">¥{quotation.totalAmount?.toLocaleString() || 0}</Descriptions.Item>
          <Descriptions.Item label="折扣率">{quotation.discount || 0}%</Descriptions.Item>
          <Descriptions.Item label="税率">{quotation.taxRate || 0}%</Descriptions.Item>
          <Descriptions.Item label="有效期至">
            {quotation.validUntil ? dayjs(quotation.validUntil).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="负责人">{quotation.ownerName || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {quotation.createdAt ? dayjs(quotation.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {quotation.updatedAt ? dayjs(quotation.updatedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          {quotation.terms && (
            <Descriptions.Item label="条款说明" span={2}>
              {quotation.terms}
            </Descriptions.Item>
          )}
          {quotation.notes && (
            <Descriptions.Item label="备注" span={2}>
              {quotation.notes}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Tabs
          defaultActiveKey="items"
          items={[
            {
              key: 'items',
              label: '产品明细',
              children: (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddItem}>
                      添加产品
                    </Button>
                  </div>
                  <Table
                    columns={itemColumns}
                    dataSource={items}
                    rowKey={(record, index) => index}
                    pagination={false}
                  />
                  <div style={{ marginTop: 16, textAlign: 'right', fontSize: '16px', fontWeight: 'bold' }}>
                    合计：¥{quotation.totalAmount?.toLocaleString() || 0}
                  </div>
                </div>
              ),
            },
            {
              key: 'followUps',
              label: '跟进记录',
              children: (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setFollowUpModalVisible(true)}>
                      添加跟进记录
                    </Button>
                  </div>
                  <Table
                    columns={followUpColumns}
                    dataSource={followUps}
                    rowKey="id"
                    pagination={false}
                  />
                </div>
              ),
            },
          ]}
          onChange={(key) => {
            if (key === 'followUps') {
              loadFollowUps();
            }
          }}
        />
      </Card>

      {/* 添加产品Modal */}
      <Modal
        title="添加产品"
        open={itemModalVisible}
        onCancel={() => setItemModalVisible(false)}
        onOk={() => itemForm.submit()}
      >
        <Form form={itemForm} layout="vertical" onFinish={handleItemSubmit}>
          <Form.Item name="productId" label="产品" rules={[{ required: true, message: '请选择产品' }]}>
            <Select placeholder="请选择产品" showSearch>
              {allProducts.map((product) => (
                <Option key={product.id} value={product.id}>
                  {product.name} ({product.code})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unitPrice" label="单价" rules={[{ required: true, message: '请输入单价' }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="discount" label="折扣(%)" initialValue={0}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="备注">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加跟进记录Modal */}
      <Modal
        title="添加跟进记录"
        open={followUpModalVisible}
        onCancel={() => setFollowUpModalVisible(false)}
        onOk={() => followUpForm.submit()}
      >
        <Form form={followUpForm} layout="vertical" onFinish={handleFollowUpSubmit}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="请输入标题" />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <TextArea rows={4} placeholder="请输入内容" />
          </Form.Item>
          <Form.Item name="followUpType" label="类型" initialValue="note">
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

export default QuotationDetail;

