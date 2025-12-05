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
} from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { opportunityService } from '../../services/opportunityService';
import { followUpService } from '../../services/followUpService';
import { productService } from '../../services/productService';

const { TextArea } = Input;
const { Option } = Select;

const OpportunityDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [opportunity, setOpportunity] = useState(null);
  const [products, setProducts] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  const [productForm] = Form.useForm();
  const [followUpForm] = Form.useForm();

  useEffect(() => {
    loadOpportunityDetail();
    loadAllProducts();
  }, [id]);

  const loadOpportunityDetail = async () => {
    setLoading(true);
    try {
      const response = await opportunityService.getOpportunity(id);
      if (response.success) {
        setOpportunity(response.data);
        setProducts(response.data.products || []);
      } else {
        message.error(response.message || '加载商机详情失败');
      }
    } catch (error) {
      message.error(error.message || '加载商机详情失败');
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
        type: 'opportunity',
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

  useEffect(() => {
    if (id) {
      loadFollowUps();
    }
  }, [id]);

  const handleAddProduct = () => {
    setProductModalVisible(true);
    productForm.resetFields();
  };

  const handleProductSubmit = async (values) => {
    try {
      const product = allProducts.find(p => p.id === values.productId);
      if (!product) {
        message.error('产品不存在');
        return;
      }
      
      const amount = (values.quantity || 0) * (values.unitPrice || 0) * (1 - (values.discount || 0) / 100);
      const newProduct = {
        productId: values.productId,
        productName: product.name,
        quantity: values.quantity,
        unitPrice: values.unitPrice,
        discount: values.discount || 0,
        amount: amount,
        description: values.description || ''
      };
      
      const currentProducts = [...products, newProduct];
      await opportunityService.updateOpportunity(id, { products: currentProducts });
      message.success('添加产品成功');
      setProductModalVisible(false);
      loadOpportunityDetail();
    } catch (error) {
      message.error(error.message || '添加产品失败');
    }
  };

  const handleDeleteProduct = async (index) => {
    try {
      const newProducts = products.filter((_, i) => i !== index);
      await opportunityService.updateOpportunity(id, { products: newProducts });
      message.success('删除产品成功');
      loadOpportunityDetail();
    } catch (error) {
      message.error(error.message || '删除产品失败');
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
        type: 'opportunity',
        relatedId: id,
      });
      message.success('添加跟进记录成功');
      setFollowUpModalVisible(false);
      loadFollowUps();
    } catch (error) {
      message.error(error.message || '添加跟进记录失败');
    }
  };

  const handleProductChange = (productId) => {
    const product = allProducts.find(p => p.id === productId);
    if (product) {
      productForm.setFieldsValue({
        productName: product.name,
        unitPrice: 0, // 可以从产品价格表获取
      });
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
    {
      title: '操作',
      key: 'action',
      render: (_, record, index) => (
        <Button
          type="link"
          size="small"
          danger
          onClick={() => handleDeleteProduct(index)}
        >
          删除
        </Button>
      ),
    },
  ];

  if (loading && !opportunity) {
    return <Card loading={loading}>加载中...</Card>;
  }

  if (!opportunity) {
    return <Card>商机不存在</Card>;
  }

  const totalAmount = products.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

  return (
    <div>
      <Card
        title={
          <Space>
            <Button icon={<EditOutlined />} onClick={() => navigate(`/opportunities?edit=${id}`)}>
              编辑
            </Button>
            <span>{opportunity.name}</span>
          </Space>
        }
      >
        <Descriptions bordered column={3}>
          <Descriptions.Item label="商机名称">{opportunity.name}</Descriptions.Item>
          <Descriptions.Item label="客户ID">{opportunity.customerId}</Descriptions.Item>
          <Descriptions.Item label="金额">
            <strong style={{ color: '#f5222d', fontSize: 16 }}>
              ¥{totalAmount.toLocaleString()}
            </strong>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={
              opportunity.status === 'won' ? 'green' :
              opportunity.status === 'lost' ? 'red' :
              opportunity.status === 'qualified' ? 'blue' : 'default'
            }>
              {opportunity.status === 'new' ? '新建' :
               opportunity.status === 'contacted' ? '已联系' :
               opportunity.status === 'qualified' ? '已确认' :
               opportunity.status === 'won' ? '成交' :
               opportunity.status === 'lost' ? '失败' : opportunity.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="成交概率">{opportunity.probability || 0}%</Descriptions.Item>
          <Descriptions.Item label="预计成交日期">
            {opportunity.expectedCloseDate ? new Date(opportunity.expectedCloseDate).toLocaleDateString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={3}>{opportunity.description || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Tabs defaultActiveKey="products">
          <Tabs.TabPane
            tab={`产品明细 (${products.length})`}
            key="products"
          >
            <div style={{ marginBottom: 16 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddProduct}>
                添加产品
              </Button>
            </div>
            <Table
              columns={productColumns}
              dataSource={products}
              rowKey={(record, index) => index}
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
                    <Table.Summary.Cell index={2} />
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Tabs.TabPane>

          <Tabs.TabPane tab={`跟进记录 (${followUps.length})`} key="followUps">
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
          </Tabs.TabPane>
        </Tabs>
      </Card>

      <Modal
        title="添加产品"
        open={productModalVisible}
        onCancel={() => setProductModalVisible(false)}
        onOk={() => productForm.submit()}
      >
        <Form form={productForm} onFinish={handleProductSubmit} layout="vertical">
          <Form.Item name="productId" label="选择产品" rules={[{ required: true }]}>
            <Select
              placeholder="请选择产品"
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
              onChange={handleProductChange}
            >
              {allProducts.map(product => (
                <Option key={product.id} value={product.id}>
                  {product.name} ({product.code})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unitPrice" label="单价" rules={[{ required: true }]}>
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

export default OpportunityDetail;

