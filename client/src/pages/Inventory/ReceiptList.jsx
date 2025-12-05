import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  message,
  Popconfirm,
  Card,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import inventoryService from '../../services/inventoryService';
import BatchActions from '../../components/Common/BatchActions';
import FilterDrawer from '../../components/Common/FilterDrawer';
import { useNavigate } from 'react-router-dom';

const ReceiptList = () => {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [outboundOrders, setOutboundOrders] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadReceipts();
    loadCustomers();
    loadOutboundOrders();
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

  const loadOutboundOrders = async () => {
    try {
      const response = await inventoryService.getOutboundOrders({ limit: 1000, status: 'completed' });
      if (response.success) {
        setOutboundOrders(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载出库单列表失败:', error);
    }
  };

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (searchText) params.receiptNumber = searchText;
      
      const response = await inventoryService.getReceipts(params);
      if (response.success) {
        const receiptsList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setReceipts(receiptsList);
        setPagination({
          ...pagination,
          total: response.pagination?.total || response.data?.pagination?.total || 0
        });
      } else {
        message.error(response.message || '加载收款单列表失败');
      }
    } catch (error) {
      message.error(error.message || '加载收款单列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingReceipt(null);
    setDrawerVisible(true);
    form.resetFields();
    form.setFieldsValue({
      receiptDate: dayjs(),
      paymentMethod: 'bank_transfer',
    });
  };

  const handleEdit = async (receiptId) => {
    try {
      const response = await inventoryService.getReceipt(receiptId);
      if (response.success) {
        setEditingReceipt(response.data);
        setDrawerVisible(true);
        form.setFieldsValue({
          ...response.data,
          receiptDate: response.data.receiptDate ? dayjs(response.data.receiptDate) : dayjs(),
        });
      }
    } catch (error) {
      message.error('加载收款单详情失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        receiptDate: values.receiptDate ? values.receiptDate.format('YYYY-MM-DD') : null,
      };
      
      if (editingReceipt) {
        const response = await inventoryService.updateReceipt(editingReceipt.id, data);
        if (response.success) {
          message.success('更新成功');
          setDrawerVisible(false);
          setEditingReceipt(null);
          form.resetFields();
          loadReceipts();
        }
      } else {
        const response = await inventoryService.createReceipt(data);
        if (response.success) {
          message.success('创建成功');
          setDrawerVisible(false);
          setEditingReceipt(null);
          form.resetFields();
          loadReceipts();
        }
      }
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await inventoryService.deleteReceipt(id);
      if (response.success) {
        message.success('删除成功');
        loadReceipts();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleBatchDelete = async (keys) => {
    try {
      await Promise.all(keys.map(id => inventoryService.deleteReceipt(id)));
      message.success(`成功删除 ${keys.length} 条数据`);
      setSelectedRowKeys([]);
      loadReceipts();
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
    { title: '收款单号', dataIndex: 'receiptNumber', key: 'receiptNumber' },
    { title: '客户', dataIndex: 'customerName', key: 'customerName' },
    { title: '出库单号', dataIndex: 'outboundOrderNumber', key: 'outboundOrderNumber' },
    { title: '收款日期', dataIndex: 'receiptDate', key: 'receiptDate' },
    {
      title: '收款金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `¥${parseFloat(amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record.id)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个收款单吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
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
              placeholder="搜索收款单号"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
              onPressEnter={loadReceipts}
            />
            <Button onClick={loadReceipts}>搜索</Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large">
            新增收款单
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
        dataSource={receipts}
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
          loadReceipts();
        }}
        config={[
          {
            name: 'search',
            label: '搜索',
            type: 'input',
            placeholder: '请输入收款单号',
          },
        ]}
      />

      <Drawer
        title={editingReceipt ? '编辑收款单' : '新增收款单'}
        width={600}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setEditingReceipt(null);
          form.resetFields();
        }}
        footer={
          <Space>
            <Button onClick={() => {
              setDrawerVisible(false);
              setEditingReceipt(null);
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
            name="outboundOrderId"
            label="出库单"
          >
            <Select placeholder="请选择出库单（可选）" showSearch allowClear>
              {outboundOrders.map(o => (
                <Option key={o.id} value={o.id}>{o.orderNumber}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="receiptDate"
            label="收款日期"
            rules={[{ required: true, message: '请选择收款日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="amount"
            label="收款金额"
            rules={[{ required: true, message: '请输入收款金额' }]}
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
            rules={[{ required: true, message: '请选择支付方式' }]}
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
            <Input placeholder="请输入银行账户" />
          </Form.Item>
          <Form.Item name="receiptNote" label="收据编号">
            <Input placeholder="请输入收据编号" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  );
};

export default ReceiptList;

