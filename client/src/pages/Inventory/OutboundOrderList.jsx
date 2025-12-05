import { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Tag, message, Popconfirm, Card, Drawer, Form, DatePicker, Select, InputNumber } from 'antd';
import { PlusOutlined, SearchOutlined, CheckOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import inventoryService from '../../services/inventoryService';
import { productService } from '../../services/productService';
import { customerService } from '../../services/customerService';
import BatchActions from '../../components/Common/BatchActions';
import FilterDrawer from '../../components/Common/FilterDrawer';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const OutboundOrderList = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadOrders();
    loadCustomers();
    loadProducts();
  }, [pagination.page, pagination.limit, searchText]);

  const loadCustomers = async () => {
    try {
      const response = await customerService.getCustomers({ limit: 1000 });
      if (response.success) {
        setCustomers(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载客户列表失败:', error);
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

  const loadOrders = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (searchText) params.orderNumber = searchText;
      
      const response = await inventoryService.getOutboundOrders(params);
      if (response.success) {
        setOrders(Array.isArray(response.data) ? response.data : (response.data?.data || []));
        setPagination({
          ...pagination,
          total: response.pagination?.total || response.data?.pagination?.total || 0
        });
      }
    } catch (error) {
      message.error('加载出库单失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingOrder(null);
    setOrderItems([]);
    setDrawerVisible(true);
    form.resetFields();
    form.setFieldsValue({
      orderDate: dayjs(),
      status: 'pending',
    });
  };

  const handleEdit = async (orderId) => {
    try {
      const response = await inventoryService.getOutboundOrder(orderId);
      if (response.success) {
        setEditingOrder(response.data);
        setOrderItems(response.data.items || []);
        setDrawerVisible(true);
        form.setFieldsValue({
          ...response.data,
          orderDate: response.data.orderDate ? dayjs(response.data.orderDate) : dayjs(),
        });
      }
    } catch (error) {
      message.error('加载出库单详情失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        orderDate: values.orderDate ? values.orderDate.format('YYYY-MM-DD') : null,
        items: orderItems,
      };
      
      if (editingOrder) {
        const response = await inventoryService.updateOutboundOrder(editingOrder.id, data);
        if (response.success) {
          message.success('更新成功');
          setDrawerVisible(false);
          setEditingOrder(null);
          setOrderItems([]);
          form.resetFields();
          loadOrders();
        }
      } else {
        const response = await inventoryService.createOutboundOrder(data);
        if (response.success) {
          message.success('创建成功');
          setDrawerVisible(false);
          setEditingOrder(null);
          setOrderItems([]);
          form.resetFields();
          loadOrders();
        }
      }
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const handleComplete = async (id) => {
    try {
      const response = await inventoryService.completeOutboundOrder(id);
      if (response.success) {
        message.success('出库单已完成');
        loadOrders();
      } else {
        message.error(response.message || '完成出库单失败');
      }
    } catch (error) {
      message.error(error.response?.data?.message || error.message || '完成出库单失败');
    }
  };

  const handleBatchDelete = async (keys) => {
    try {
      await Promise.all(keys.map(id => inventoryService.deleteOutboundOrder(id)));
      message.success(`成功删除 ${keys.length} 条数据`);
      setSelectedRowKeys([]);
      loadOrders();
    } catch (error) {
      message.error('批量删除失败');
    }
  };

  const handleExport = async (keys) => {
    try {
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

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => {
      setSelectedRowKeys(keys);
    },
  };

  const columns = [
    { title: '序号', dataIndex: 'id', key: 'id', width: 80 },
    { title: '出库单号', dataIndex: 'orderNumber', key: 'orderNumber' },
    { title: '客户', dataIndex: 'customerName', key: 'customerName' },
    { title: '订单日期', dataIndex: 'orderDate', key: 'orderDate' },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount) => `¥${parseFloat(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          pending: { label: '待处理', color: 'orange' },
          completed: { label: '已完成', color: 'green' },
          cancelled: { label: '已取消', color: 'red' },
        };
        const s = statusMap[status] || { label: status, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleEdit(record.id)}
          >
            查看
          </Button>
          {record.status === 'pending' && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record.id)}
            >
              编辑
            </Button>
          )}
          {record.status === 'pending' && (
            <Popconfirm
              title="确定要完成这个出库单吗？"
              onConfirm={() => handleComplete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" icon={<CheckOutlined />}>
                完成
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
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
              placeholder="搜索出库单号"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
              onPressEnter={loadOrders}
            />
            <Button onClick={loadOrders}>搜索</Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large">
            新增出库单
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
        dataSource={orders}
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

      <FilterDrawer
        visible={filterDrawerVisible}
        onClose={() => setFilterDrawerVisible(false)}
        onFilter={(values) => {
          if (values.search) {
            setSearchText(values.search);
          }
          loadOrders();
        }}
        config={[
          {
            name: 'search',
            label: '搜索',
            type: 'input',
            placeholder: '请输入出库单号',
          },
          {
            name: 'status',
            label: '状态',
            type: 'select',
            options: [
              { label: '待处理', value: 'pending' },
              { label: '已完成', value: 'completed' },
              { label: '已取消', value: 'cancelled' },
            ],
          },
        ]}
      />

      <Drawer
        title={editingOrder ? '编辑出库单' : '新增出库单'}
        width={900}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setEditingOrder(null);
          setOrderItems([]);
          form.resetFields();
        }}
        footer={
          <Space>
            <Button onClick={() => {
              setDrawerVisible(false);
              setEditingOrder(null);
              setOrderItems([]);
              form.resetFields();
            }}>取消</Button>
            <Button type="primary" onClick={handleSubmit}>确定</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="customerId"
            label="客户"
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <Select placeholder="请选择客户" showSearch>
              {customers.map(c => (
                <Option key={c.id} value={c.id}>{c.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="orderDate"
            label="出库日期"
            rules={[{ required: true, message: '请选择出库日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
          >
            <Select>
              <Option value="pending">待处理</Option>
              <Option value="completed">已完成</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
        <div style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 16, fontWeight: 'bold' }}>出库明细</div>
          <Table
            dataSource={orderItems}
            rowKey={(record, index) => index}
            pagination={false}
            columns={[
              {
                title: '产品',
                dataIndex: 'productId',
                key: 'productId',
                render: (productId, record, index) => (
                  <Select
                    placeholder="选择产品"
                    value={productId}
                    onChange={(value) => {
                      const newItems = [...orderItems];
                      newItems[index].productId = value;
                      const product = products.find(p => p.id === value);
                      if (product) {
                        newItems[index].productName = product.name;
                      }
                      setOrderItems(newItems);
                    }}
                    style={{ width: '100%' }}
                    showSearch
                  >
                    {products.map(p => (
                      <Option key={p.id} value={p.id}>{p.name}</Option>
                    ))}
                  </Select>
                ),
              },
              {
                title: '数量',
                dataIndex: 'quantity',
                key: 'quantity',
                render: (quantity, record, index) => (
                  <InputNumber
                    value={quantity}
                    onChange={(value) => {
                      const newItems = [...orderItems];
                      newItems[index].quantity = value || 0;
                      newItems[index].amount = (value || 0) * (newItems[index].unitPrice || 0);
                      setOrderItems(newItems);
                    }}
                    min={0}
                    style={{ width: '100%' }}
                  />
                ),
              },
              {
                title: '单价',
                dataIndex: 'unitPrice',
                key: 'unitPrice',
                render: (unitPrice, record, index) => (
                  <InputNumber
                    value={unitPrice}
                    onChange={(value) => {
                      const newItems = [...orderItems];
                      newItems[index].unitPrice = value || 0;
                      newItems[index].amount = (newItems[index].quantity || 0) * (value || 0);
                      setOrderItems(newItems);
                    }}
                    min={0}
                    precision={2}
                    style={{ width: '100%' }}
                  />
                ),
              },
              {
                title: '金额',
                dataIndex: 'amount',
                key: 'amount',
                render: (amount) => `¥${parseFloat(amount || 0).toFixed(2)}`,
              },
              {
                title: '操作',
                key: 'action',
                render: (_, record, index) => (
                  <Button
                    type="link"
                    danger
                    onClick={() => {
                      const newItems = orderItems.filter((_, i) => i !== index);
                      setOrderItems(newItems);
                    }}
                  >
                    删除
                  </Button>
                ),
              },
            ]}
          />
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() => {
              setOrderItems([...orderItems, { productId: null, quantity: 0, unitPrice: 0, amount: 0 }]);
            }}
            style={{ marginTop: 16 }}
          >
            添加产品
          </Button>
        </div>
      </Drawer>
    </Card>
  );
};

export default OutboundOrderList;

