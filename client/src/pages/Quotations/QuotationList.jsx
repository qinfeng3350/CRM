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
  message,
  Tag,
  Popconfirm,
  Card,
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  SendOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { quotationService } from '../../services/quotationService';
import { customerService } from '../../services/customerService';
import { productService } from '../../services/productService';
import { opportunityService } from '../../services/opportunityService';
import BatchActions from '../../components/Common/BatchActions';
import FilterDrawer from '../../components/Common/FilterDrawer';
import { useNavigate } from 'react-router-dom';
import { EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const QuotationList = () => {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [filteredOpportunities, setFilteredOpportunities] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState(null);
  const [form] = Form.useForm();
  const selectedCustomerId = Form.useWatch('customerId', form);

  useEffect(() => {
    loadQuotations();
    loadCustomers();
    loadOpportunities();
    loadProducts();
  }, [pagination.page, pagination.limit, searchText, filterStatus]);

  const loadQuotations = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (searchText) params.quotationNumber = searchText;
      if (filterStatus) params.status = filterStatus;
      
      const response = await quotationService.getQuotations(params);
      if (response.success) {
        const quotationsList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setQuotations(quotationsList);
        setPagination({
          ...pagination,
          total: response.pagination?.total || 0
        });
      } else {
        message.error(response.message || '加载报价单列表失败');
      }
    } catch (error) {
      message.error(error.message || '加载报价单列表失败');
    } finally {
      setLoading(false);
    }
  };

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

  const loadOpportunities = async () => {
    try {
      const response = await opportunityService.getOpportunities({ limit: 1000 });
      if (response.success) {
        const opps = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setOpportunities(opps);
        setFilteredOpportunities(opps);
      }
    } catch (error) {
      console.error('加载商机列表失败:', error);
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
    setEditingQuotation(null);
    setDrawerVisible(true);
    form.resetFields();
    setFilteredOpportunities(opportunities);
  };

  // 当客户改变时，过滤商机
  useEffect(() => {
    if (selectedCustomerId) {
      const filtered = opportunities.filter(opp => opp.customerId === selectedCustomerId);
      setFilteredOpportunities(filtered);
      // 如果当前选择的商机不属于该客户，清空商机选择
      const currentOppId = form.getFieldValue('opportunityId');
      if (currentOppId) {
        const currentOpp = opportunities.find(opp => opp.id === currentOppId);
        if (currentOpp && currentOpp.customerId !== selectedCustomerId) {
          form.setFieldsValue({ opportunityId: null });
        }
      }
    } else {
      setFilteredOpportunities(opportunities);
    }
  }, [selectedCustomerId, opportunities, form]);

  const handleCustomerChange = (customerId) => {
    // 由useEffect处理过滤逻辑
  };

  const handleEdit = (record) => {
    setEditingQuotation(record);
    setDrawerVisible(true);
    
    // 如果有客户ID，先过滤商机
    if (record.customerId) {
      const filtered = opportunities.filter(opp => opp.customerId === record.customerId);
      setFilteredOpportunities(filtered);
    } else {
      setFilteredOpportunities(opportunities);
    }
    
    form.setFieldsValue({
      ...record,
      validUntil: record.validUntil ? dayjs(record.validUntil) : null,
    });
  };

  const handleDelete = async (id) => {
    try {
      await quotationService.deleteQuotation(id);
      message.success('删除成功');
      loadQuotations();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleSend = async (id) => {
    try {
      await quotationService.sendQuotation(id);
      message.success('发送成功');
      loadQuotations();
    } catch (error) {
      message.error(error.message || '发送失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        validUntil: values.validUntil ? values.validUntil.format('YYYY-MM-DD') : null,
        items: form.getFieldValue('items') || [],
      };
      
      if (editingQuotation) {
        await quotationService.updateQuotation(editingQuotation.id, data);
        message.success('更新成功');
      } else {
        await quotationService.createQuotation(data);
        message.success('创建成功');
      }
      setDrawerVisible(false);
      setEditingQuotation(null);
      form.resetFields();
      loadQuotations();
    } catch (error) {
      message.error(error.message || (editingQuotation ? '更新失败' : '创建失败'));
    }
  };

  const handleBatchDelete = async (keys) => {
    try {
      await Promise.all(keys.map(id => quotationService.deleteQuotation(id)));
      message.success(`成功删除 ${keys.length} 条数据`);
      setSelectedRowKeys([]);
      loadQuotations();
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
    loadQuotations();
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => {
      setSelectedRowKeys(keys);
    },
  };

  const statusOptions = [
    { value: 'draft', label: '草稿', color: 'default' },
    { value: 'sent', label: '已发送', color: 'blue' },
    { value: 'accepted', label: '已接受', color: 'green' },
    { value: 'rejected', label: '已拒绝', color: 'red' },
    { value: 'expired', label: '已过期', color: 'orange' },
  ];

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '报价单号', dataIndex: 'quotationNumber', key: 'quotationNumber' },
    { title: '标题', dataIndex: 'title', key: 'title' },
    {
      title: '客户',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (name) => name || '-',
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
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
      title: '有效期至',
      dataIndex: 'validUntil',
      key: 'validUntil',
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/quotations/${record.id}`)}
          >
            查看详情
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleSend(record.id)}
            >
              发送
            </Button>
          )}
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
      placeholder: '请输入报价单号',
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
              placeholder="搜索报价单号"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              allowClear
              onPressEnter={loadQuotations}
            />
            <Button onClick={loadQuotations}>搜索</Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large">
            新增报价单
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
        dataSource={quotations}
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

      <Drawer
        title={editingQuotation ? '编辑报价单' : '新增报价单'}
        placement="right"
        onClose={() => {
          setDrawerVisible(false);
          setEditingQuotation(null);
          form.resetFields();
        }}
        open={drawerVisible}
        width={900}
        destroyOnClose
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="title"
            label="报价单标题"
            rules={[{ required: true, message: '请输入报价单标题' }]}
          >
            <Input placeholder="请输入报价单标题" />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="customerId"
              label="客户"
              rules={[{ required: true, message: '请选择客户' }]}
              style={{ flex: 1 }}
            >
              <Select 
                placeholder="请选择客户" 
                showSearch
                onChange={handleCustomerChange}
                filterOption={(input, option) =>
                  (option?.children?.props?.children || option?.children || '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              >
                {customers.map((customer) => (
                  <Option key={customer.id} value={customer.id}>
                    {customer.name || customer.company || `客户${customer.id}`}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item 
              name="opportunityId" 
              label="关联商机" 
              style={{ flex: 1 }}
            >
              <Select 
                placeholder={
                  filteredOpportunities.length === 0 && selectedCustomerId
                    ? "该客户暂无商机"
                    : "请选择商机"
                }
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.children?.props?.children || option?.children || '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                notFoundContent={
                  filteredOpportunities.length === 0 
                    ? (selectedCustomerId 
                        ? "该客户暂无商机，请先创建商机" 
                        : "未找到商机")
                    : "未找到商机"
                }
              >
                {filteredOpportunities.map((opportunity) => (
                  <Option key={opportunity.id} value={opportunity.id}>
                    {opportunity.name || `商机${opportunity.id}`} 
                    {opportunity.expectedAmount && ` - ¥${opportunity.expectedAmount.toLocaleString()}`}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="discount" label="折扣率(%)" initialValue={0} style={{ flex: 1 }}>
              <InputNumber min={0} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="taxRate" label="税率(%)" initialValue={0} style={{ flex: 1 }}>
              <InputNumber min={0} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="validUntil" label="有效期至" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Form.Item name="terms" label="条款说明">
            <TextArea rows={3} placeholder="请输入条款说明" />
          </Form.Item>

          <Form.Item name="notes" label="备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button onClick={() => {
                setDrawerVisible(false);
                setEditingQuotation(null);
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
    </Card>
  );
};

export default QuotationList;

