import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Drawer,
  Form,
  Select,
  InputNumber,
  DatePicker,
  message,
  Tag,
  Popconfirm,
  Card,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { opportunityService } from '../../services/opportunityService';
import { customerService } from '../../services/customerService';
import { productService } from '../../services/productService';
import BatchActions from '../../components/Common/BatchActions';
import FilterDrawer from '../../components/Common/FilterDrawer';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Option } = Select;

const OpportunityList = () => {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productSelectValue, setProductSelectValue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadOpportunities();
    loadCustomers();
    loadProducts();
  }, [pagination.page, pagination.limit, searchText, filterStatus]);

  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (searchText) params.search = searchText;
      if (filterStatus) params.status = filterStatus;
      
      const response = await opportunityService.getOpportunities(params);
      if (response.success) {
        const opportunitiesList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setOpportunities(opportunitiesList);
        setPagination({ 
          ...pagination, 
          total: response.pagination?.total || 0 
        });
      } else {
        message.error(response.message || '加载商机列表失败');
      }
    } catch (error) {
      message.error(error.message || '加载商机列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await customerService.getCustomers({ page: 1, limit: 1000 });
      if (response.success) {
        const customersList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setCustomers(customersList);
      }
    } catch (error) {
      console.error('加载客户列表失败', error);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await productService.getProducts({ limit: 1000, isActive: true });
      if (response.success) {
        setProducts(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载产品列表失败:', error);
    }
  };

  const handleAdd = () => {
    setEditingOpportunity(null);
    setSelectedProducts([]);
    setProductSelectValue([]);
    setDrawerVisible(true);
    form.resetFields();
  };

  const handleEdit = (record) => {
    setEditingOpportunity(record);
    setSelectedProducts(record.products || []);
    setDrawerVisible(true);
    form.setFieldsValue({
      ...record,
      expectedCloseDate: record.expectedCloseDate ? dayjs(record.expectedCloseDate) : null,
    });
  };

  const handleDelete = async (id) => {
    try {
      await opportunityService.deleteOpportunity(id);
      message.success('删除成功');
      loadOpportunities();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      // 计算总金额
      let totalAmount = 0;
      selectedProducts.forEach(item => {
        const amount = (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100);
        totalAmount += amount;
      });
      
      const data = {
        ...values,
        amount: totalAmount || values.amount || 0,
        expectedCloseDate: values.expectedCloseDate
          ? values.expectedCloseDate.format('YYYY-MM-DD')
          : null,
        products: selectedProducts,
      };
      if (editingOpportunity) {
        await opportunityService.updateOpportunity(editingOpportunity.id, data);
        message.success('更新成功');
      } else {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        await opportunityService.createOpportunity({
          ...data,
          ownerId: user.id,
        });
        message.success('创建成功');
      }
      setDrawerVisible(false);
      setEditingOpportunity(null);
      setSelectedProducts([]);
      setProductSelectValue([]);
      form.resetFields();
      loadOpportunities();
    } catch (error) {
      message.error(error.message || (editingOpportunity ? '更新失败' : '创建失败'));
    }
  };

  const handleBatchDelete = async (keys) => {
    try {
      await Promise.all(keys.map(id => opportunityService.deleteOpportunity(id)));
      message.success(`成功删除 ${keys.length} 条数据`);
      setSelectedRowKeys([]);
      loadOpportunities();
    } catch (error) {
      message.error('批量删除失败');
    }
  };

  const handleExport = async (keys) => {
    try {
      const params = keys.length > 0 ? { ids: keys.join(',') } : {};
      message.info('导出功能需要后端API支持');
    } catch (error) {
      message.error('导出失败');
    }
  };

  const handleImport = async (file) => {
    try {
      message.info('导入功能需要后端API支持');
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const handleFilterSubmit = (values) => {
    if (values.search) {
      setSearchText(values.search);
    }
    if (values.status) {
      setFilterStatus(values.status);
    }
    loadOpportunities();
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => {
      setSelectedRowKeys(keys);
    },
  };

  const handleAddProduct = async (productIds, customerId) => {
    // 支持多选，productIds 可能是数组或单个值
    const ids = Array.isArray(productIds) ? productIds : [productIds];
    
    for (const productId of ids) {
      // 检查是否已存在
      if (selectedProducts.find(p => p.productId === productId)) {
        continue; // 跳过已存在的产品
      }
      
      const product = products.find(p => p.id === productId);
      if (!product) continue;
      
      // 获取产品价格
      let unitPrice = 0;
      try {
        if (customerId) {
          const priceResponse = await productService.getCustomerProductPrice(productId, customerId);
          if (priceResponse.success && priceResponse.data) {
            unitPrice = parseFloat(priceResponse.data.price || 0);
          }
        }
        if (!unitPrice) {
          const pricesResponse = await productService.getProductPrices(productId, { customerId: null, isActive: true });
          if (pricesResponse.success && pricesResponse.data && pricesResponse.data.length > 0) {
            unitPrice = parseFloat(pricesResponse.data[0].price || 0);
          }
        }
      } catch (error) {
        console.error('获取产品价格失败:', error);
      }
      
      const newProduct = {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: unitPrice,
        discount: 0,
        amount: unitPrice,
        description: ''
      };
      
      setSelectedProducts(prev => [...prev, newProduct]);
    }
  };

  const handleRemoveProduct = (index) => {
    const newProducts = selectedProducts.filter((_, i) => i !== index);
    setSelectedProducts(newProducts);
  };

  const handleUpdateProduct = (index, field, value) => {
    const newProducts = [...selectedProducts];
    newProducts[index][field] = value;
    if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
      const item = newProducts[index];
      item.amount = (item.quantity || 0) * (item.unitPrice || 0) * (1 - (item.discount || 0) / 100);
    }
    setSelectedProducts(newProducts);
  };

  const statusOptions = [
    { value: 'new', label: '新建', color: 'blue' },
    { value: 'contacted', label: '已联系', color: 'cyan' },
    { value: 'qualified', label: '已确认', color: 'green' },
    { value: 'proposal', label: '提案中', color: 'orange' },
    { value: 'negotiation', label: '谈判中', color: 'purple' },
    { value: 'won', label: '成交', color: 'success' },
    { value: 'lost', label: '失败', color: 'red' },
  ];

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '客户',
      dataIndex: 'customerId',
      key: 'customerId',
      render: (id) => {
        const customer = customers.find((c) => c.id === id);
        return customer?.name || id;
      },
    },
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
        const option = statusOptions.find((s) => s.value === status);
        return <Tag color={option?.color}>{option?.label || status}</Tag>;
      },
    },
    {
      title: '成交概率',
      dataIndex: 'probability',
      key: 'probability',
      render: (prob) => `${prob || 0}%`,
    },
    {
      title: '预计成交日期',
      dataIndex: 'expectedCloseDate',
      key: 'expectedCloseDate',
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/opportunities/${record.id}`)}
          >
            查看详情
          </Button>
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

  const filterConfig = [
    {
      name: 'search',
      label: '搜索',
      type: 'input',
      placeholder: '请输入商机名称',
    },
    {
      name: 'status',
      label: '状态',
      type: 'select',
      options: statusOptions.map(opt => ({
        label: opt.label,
        value: opt.value,
      })),
    },
  ];

  return (
    <div>
      <Card
        style={{
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Space>
              <Input
                placeholder="搜索商机名称"
                prefix={<SearchOutlined />}
                style={{ width: 300 }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onPressEnter={loadOpportunities}
                allowClear
              />
              <Button onClick={loadOpportunities}>搜索</Button>
            </Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large">
              新增商机
            </Button>
          </div>

          <BatchActions
            selectedRowKeys={selectedRowKeys}
            onBatchDelete={handleBatchDelete}
            onExport={handleExport}
            onImport={handleImport}
            onFilter={() => setFilterDrawerVisible(true)}
          />
        </div>

        <Table
          columns={columns}
          dataSource={opportunities}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, page, limit: pageSize });
            },
          }}
        />
      </Card>

      <Drawer
        title={editingOpportunity ? '编辑商机' : '新增商机'}
        placement="right"
        onClose={() => {
          setDrawerVisible(false);
          setEditingOpportunity(null);
          setSelectedProducts([]);
          setProductSelectValue([]);
          form.resetFields();
        }}
        open={drawerVisible}
        width={900}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="customerId"
            label="客户"
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <Select placeholder="请选择客户">
              {customers.map((customer) => (
                <Option key={customer.id} value={customer.id}>
                  {customer.name} - {customer.company}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="商机名称"
            rules={[{ required: true, message: '请输入商机名称' }]}
          >
            <Input placeholder="请输入商机名称" />
          </Form.Item>

          <Form.Item label="产品明细">
            <div style={{ marginBottom: 8 }}>
              <Select
                mode="multiple"
                placeholder="选择产品（可多选）"
                showSearch
                style={{ width: '100%' }}
                value={productSelectValue}
                onChange={(productIds) => {
                  if (productIds && productIds.length > 0) {
                    const customerId = form.getFieldValue('customerId');
                    handleAddProduct(productIds, customerId);
                    // 清空选择
                    setProductSelectValue([]);
                  }
                }}
                filterOption={(input, option) =>
                  option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {products.map(product => (
                  <Option key={product.id} value={product.id}>
                    {product.name} ({product.code})
                  </Option>
                ))}
              </Select>
            </div>
            <Table
              size="small"
              dataSource={selectedProducts}
              rowKey={(record) => record.productId || Math.random()}
              pagination={false}
              columns={[
                { title: '产品名称', dataIndex: 'productName', key: 'productName' },
                {
                  title: '数量',
                  dataIndex: 'quantity',
                  key: 'quantity',
                  width: 100,
                  render: (qty, record, index) => (
                    <InputNumber
                      min={0}
                      value={qty}
                      onChange={(value) => handleUpdateProduct(index, 'quantity', value)}
                      style={{ width: '100%' }}
                    />
                  ),
                },
                {
                  title: '单价',
                  dataIndex: 'unitPrice',
                  key: 'unitPrice',
                  width: 120,
                  render: (price, record, index) => (
                    <InputNumber
                      min={0}
                      precision={2}
                      value={price}
                      onChange={(value) => handleUpdateProduct(index, 'unitPrice', value)}
                      style={{ width: '100%' }}
                    />
                  ),
                },
                {
                  title: '折扣(%)',
                  dataIndex: 'discount',
                  key: 'discount',
                  width: 100,
                  render: (discount, record, index) => (
                    <InputNumber
                      min={0}
                      max={100}
                      value={discount}
                      onChange={(value) => handleUpdateProduct(index, 'discount', value)}
                      style={{ width: '100%' }}
                    />
                  ),
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
                  width: 80,
                  render: (_, record, index) => (
                    <Button
                      type="link"
                      size="small"
                      danger
                      onClick={() => handleRemoveProduct(index)}
                    >
                      删除
                    </Button>
                  ),
                },
              ]}
            />
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <strong>
                合计: ¥{selectedProducts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0).toLocaleString()}
              </strong>
            </div>
          </Form.Item>

          <Form.Item
            name="amount"
            label="总金额（自动计算）"
          >
            <InputNumber
              style={{ width: '100%' }}
              value={selectedProducts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)}
              disabled
              formatter={(value) => `¥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <Form.Item name="status" label="状态" initialValue="new">
            <Select>
              {statusOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="probability" label="成交概率" initialValue={0}>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={100}
              formatter={(value) => `${value}%`}
              parser={(value) => value.replace('%', '')}
            />
          </Form.Item>

          <Form.Item name="expectedCloseDate" label="预计成交日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} placeholder="请输入描述" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => {
                setDrawerVisible(false);
                setEditingOpportunity(null);
                setSelectedProducts([]);
                setProductSelectValue([]);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>

      <FilterDrawer
        open={filterDrawerVisible}
        onClose={() => setFilterDrawerVisible(false)}
        filters={filterConfig}
        onSubmit={handleFilterSubmit}
        initialValues={{
          search: searchText,
          status: filterStatus,
        }}
      />
    </div>
  );
};

export default OpportunityList;

