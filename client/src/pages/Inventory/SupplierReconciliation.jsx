import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Card,
  DatePicker,
  Select,
  message,
  Tabs,
  Statistic,
  Row,
  Col,
  Tag,
} from 'antd';
import {
  DownloadOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import inventoryService from '../../services/inventoryService';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TabPane } = Tabs;

const SupplierReconciliation = () => {
  const [data, setData] = useState({ purchaseOrders: [], payments: [], summary: {} });
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [supplierId, setSupplierId] = useState('');
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    loadData();
    loadSuppliers();
  }, []);

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

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange && dateRange.length === 2) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      if (supplierId) params.supplierId = supplierId;
      
      const response = await inventoryService.getSupplierReconciliation(params);
      if (response.success) {
        setData(response.data || { purchaseOrders: [], payments: [], summary: {} });
      } else {
        message.error(response.message || '加载供应商对账失败');
      }
    } catch (error) {
      message.error(error.message || '加载供应商对账失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    message.info('导出功能需要后端API支持');
  };

  const purchaseColumns = [
    { title: '序号', dataIndex: 'id', key: 'id', width: 80 },
    { title: '采购单号', dataIndex: 'orderNumber', key: 'orderNumber' },
    { title: '订单日期', dataIndex: 'orderDate', key: 'orderDate' },
    {
      title: '金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (a) => `¥${parseFloat(a || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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
  ];

  const paymentColumns = [
    { title: '序号', dataIndex: 'id', key: 'id', width: 80 },
    { title: '付款单号', dataIndex: 'paymentNumber', key: 'paymentNumber' },
    { title: '付款日期', dataIndex: 'paymentDate', key: 'paymentDate' },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (a) => `¥${parseFloat(a || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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
  ];

  return (
    <Card
      style={{
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="采购总额"
              value={data.summary?.totalPurchase || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已付款总额"
              value={data.summary?.totalPaid || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="余额"
              value={data.summary?.balance || 0}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: data.summary?.balance > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            format="YYYY-MM-DD"
          />
          <Select
            placeholder="选择供应商"
            value={supplierId}
            onChange={setSupplierId}
            style={{ width: 200 }}
            allowClear
          >
            {suppliers.map(s => (
              <Option key={s.id} value={s.id}>{s.name}</Option>
            ))}
          </Select>
          <Button type="primary" onClick={loadData}>查询</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
        </Space>
      </div>

      <Tabs defaultActiveKey="1">
        <TabPane tab="采购单" key="1">
          <Table
            columns={purchaseColumns}
            dataSource={data.purchaseOrders || []}
            rowKey="id"
            loading={loading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        </TabPane>
        <TabPane tab="付款记录" key="2">
          <Table
            columns={paymentColumns}
            dataSource={data.payments || []}
            rowKey="id"
            loading={loading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
          />
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default SupplierReconciliation;

