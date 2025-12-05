import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Card,
  DatePicker,
  Select,
  message,
  Tag,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import inventoryService from '../../services/inventoryService';
import { customerService } from '../../services/customerService';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const SalesDetails = () => {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    loadDetails();
    loadCustomers();
  }, [pagination.page, pagination.limit]);

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

  const loadDetails = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit };
      if (dateRange && dateRange.length === 2) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      if (customerId) params.customerId = customerId;
      
      const response = await inventoryService.getSalesDetails(params);
      if (response.success) {
        const detailsList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setDetails(detailsList);
        setPagination({
          ...pagination,
          total: response.pagination?.total || response.data?.pagination?.total || 0
        });
      } else {
        message.error(response.message || '加载销售明细失败');
      }
    } catch (error) {
      message.error(error.message || '加载销售明细失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    message.info('导出功能需要后端API支持');
  };

  const columns = [
    { title: '序号', dataIndex: 'id', key: 'id', width: 80 },
    { title: '出库单号', dataIndex: 'orderNumber', key: 'orderNumber' },
    { title: '订单日期', dataIndex: 'orderDate', key: 'orderDate' },
    { title: '客户', dataIndex: 'customerName', key: 'customerName' },
    { title: '产品编码', dataIndex: 'productCode', key: 'productCode' },
    { title: '产品名称', dataIndex: 'productName', key: 'productName' },
    { title: '单位', dataIndex: 'productUnit', key: 'productUnit' },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (q) => parseFloat(q || 0).toFixed(2),
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      render: (p) => `¥${parseFloat(p || 0).toFixed(2)}`,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (a) => `¥${parseFloat(a || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: '状态',
      dataIndex: 'orderStatus',
      key: 'orderStatus',
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
  ];

  return (
    <Card
      style={{
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索产品名称或订单号"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
            onPressEnter={loadDetails}
          />
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            format="YYYY-MM-DD"
          />
          <Select
            placeholder="选择客户"
            value={customerId}
            onChange={setCustomerId}
            style={{ width: 200 }}
            allowClear
          >
            {customers.map(c => (
              <Option key={c.id} value={c.id}>{c.name}</Option>
            ))}
          </Select>
          <Button onClick={loadDetails}>搜索</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={details}
        rowKey="id"
        loading={loading}
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
  );
};

export default SalesDetails;

