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
  Drawer,
  Form,
  DatePicker,
  Select,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import inventoryService from '../../services/inventoryService';
import BatchActions from '../../components/Common/BatchActions';
import FilterDrawer from '../../components/Common/FilterDrawer';
import dayjs from 'dayjs';

const { Option } = Select;

const PaymentRecordList = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [inboundOrders, setInboundOrders] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadPayments();
    loadSuppliers();
    loadPurchaseOrders();
    loadInboundOrders();
  }, [pagination.page, pagination.limit, searchText]);

  const loadSuppliers = async () => {
    try {
      const response = await inventoryService.getSuppliers({ limit: 1000 });
      if (response.success) {
        setSuppliers(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载供应商列表失败:', error);
    }
  };

  const loadPurchaseOrders = async () => {
    try {
      const response = await inventoryService.getPurchaseOrders({ limit: 1000 });
      if (response.success) {
        setPurchaseOrders(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载采购单列表失败:', error);
    }
  };

  const loadInboundOrders = async () => {
    try {
      const response = await inventoryService.getInboundOrders({ limit: 1000 });
      if (response.success) {
        setInboundOrders(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载入库单列表失败:', error);
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (searchText) params.paymentNumber = searchText;
      
      const response = await inventoryService.getPaymentRecords(params);
      if (response.success) {
        const paymentsList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setPayments(paymentsList);
        setPagination({
          ...pagination,
          total: response.pagination?.total || response.data?.pagination?.total || 0
        });
      } else {
        message.error(response.message || '加载付款单列表失败');
      }
    } catch (error) {
      message.error(error.message || '加载付款单列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingPayment(null);
    setDrawerVisible(true);
    form.resetFields();
    form.setFieldsValue({
      paymentDate: dayjs(),
      paymentMethod: 'bank_transfer',
    });
  };

  const handleEdit = async (paymentId) => {
    try {
      const response = await inventoryService.getPaymentRecord(paymentId);
      if (response.success) {
        setEditingPayment(response.data);
        setDrawerVisible(true);
        form.setFieldsValue({
          ...response.data,
          paymentDate: response.data.paymentDate ? dayjs(response.data.paymentDate) : dayjs(),
        });
      }
    } catch (error) {
      message.error('加载付款单详情失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        paymentDate: values.paymentDate ? values.paymentDate.format('YYYY-MM-DD') : null,
      };
      
      if (editingPayment) {
        const response = await inventoryService.updatePaymentRecord(editingPayment.id, data);
        if (response.success) {
          message.success('更新成功');
          setDrawerVisible(false);
          setEditingPayment(null);
          form.resetFields();
          loadPayments();
        }
      } else {
        const response = await inventoryService.createPaymentRecord(data);
        if (response.success) {
          message.success('创建成功');
          setDrawerVisible(false);
          setEditingPayment(null);
          form.resetFields();
          loadPayments();
        }
      }
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await inventoryService.deletePaymentRecord(id);
      if (response.success) {
        message.success('删除成功');
        loadPayments();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleBatchDelete = async (keys) => {
    try {
      await Promise.all(keys.map(id => inventoryService.deletePaymentRecord(id)));
      message.success(`成功删除 ${keys.length} 条数据`);
      setSelectedRowKeys([]);
      loadPayments();
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
    { title: '付款单号', dataIndex: 'paymentNumber', key: 'paymentNumber' },
    { title: '供应商', dataIndex: 'supplierName', key: 'supplierName' },
    { title: '采购单号', dataIndex: 'purchaseOrderNumber', key: 'purchaseOrderNumber' },
    { title: '入库单号', dataIndex: 'inboundOrderNumber', key: 'inboundOrderNumber' },
    { title: '付款日期', dataIndex: 'paymentDate', key: 'paymentDate' },
    {
      title: '付款金额',
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
            title="确定要删除这个付款单吗？"
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
              placeholder="搜索付款单号"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
              onPressEnter={loadPayments}
            />
            <Button onClick={loadPayments}>搜索</Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large">
            新增付款单
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
        dataSource={payments}
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
          loadPayments();
        }}
        config={[
          {
            name: 'search',
            label: '搜索',
            type: 'input',
            placeholder: '请输入付款单号',
          },
        ]}
      />

      <Drawer
        title={editingPayment ? '编辑付款单' : '新增付款单'}
        width={600}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setEditingPayment(null);
          form.resetFields();
        }}
        footer={
          <Space>
            <Button onClick={() => {
              setDrawerVisible(false);
              setEditingPayment(null);
              form.resetFields();
            }}>取消</Button>
            <Button type="primary" onClick={handleSubmit}>确定</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="supplierId"
            label="供应商"
            rules={[{ required: true, message: '请选择供应商' }]}
          >
            <Select placeholder="请选择供应商" showSearch>
              {suppliers.map(s => (
                <Option key={s.id} value={s.id}>{s.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="purchaseOrderId"
            label="采购单"
          >
            <Select placeholder="请选择采购单（可选）" showSearch allowClear>
              {purchaseOrders.map(o => (
                <Option key={o.id} value={o.id}>{o.orderNumber}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="inboundOrderId"
            label="入库单"
          >
            <Select placeholder="请选择入库单（可选）" showSearch allowClear>
              {inboundOrders.map(o => (
                <Option key={o.id} value={o.id}>{o.orderNumber}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="paymentDate"
            label="付款日期"
            rules={[{ required: true, message: '请选择付款日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="amount"
            label="付款金额"
            rules={[{ required: true, message: '请输入付款金额' }]}
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
          <Form.Item name="notes" label="备注">
            <TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  );
};

export default PaymentRecordList;

