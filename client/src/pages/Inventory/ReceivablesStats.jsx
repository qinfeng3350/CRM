import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Card,
  DatePicker,
  Select,
  message,
  Tag,
  Statistic,
  Row,
  Col,
  Space,
} from 'antd';
import {
  DownloadOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import inventoryService from '../../services/inventoryService';
import { customerService } from '../../services/customerService';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const ReceivablesStats = () => {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState({ totalAmount: 0, receivedAmount: 0, receivableAmount: 0 });

  useEffect(() => {
    loadStats();
    loadCustomers();
  }, []);

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

  const loadStats = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange && dateRange.length === 2) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      if (customerId) params.customerId = customerId;
      
      const response = await inventoryService.getReceivablesStats(params);
      if (response.success) {
        const statsList = Array.isArray(response.data) ? response.data : [];
        setStats(statsList);
        
        // 计算汇总
        const total = statsList.reduce((sum, s) => sum + parseFloat(s.totalAmount || 0), 0);
        const received = statsList.reduce((sum, s) => sum + parseFloat(s.receivedAmount || 0), 0);
        const receivable = statsList.reduce((sum, s) => sum + parseFloat(s.receivableAmount || 0), 0);
        
        setSummary({
          totalAmount: total,
          receivedAmount: received,
          receivableAmount: receivable,
        });
      } else {
        message.error(response.message || '加载应收统计失败');
      }
    } catch (error) {
      message.error(error.message || '加载应收统计失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    message.info('导出功能需要后端API支持');
  };

  const columns = [
    { title: '客户编号', dataIndex: 'id', key: 'id', width: 100 },
    { title: '客户名称', dataIndex: 'customerName', key: 'customerName' },
    {
      title: '销售总额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (a) => `¥${parseFloat(a || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: '已收款',
      dataIndex: 'receivedAmount',
      key: 'receivedAmount',
      render: (a) => `¥${parseFloat(a || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: '应收金额',
      dataIndex: 'receivableAmount',
      key: 'receivableAmount',
      render: (a) => {
        const amount = parseFloat(a || 0);
        return <span style={{ color: amount > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}>
          ¥{amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>;
      },
    },
    {
      title: '收款率',
      key: 'receiptRate',
      render: (_, record) => {
        const total = parseFloat(record.totalAmount || 0);
        const received = parseFloat(record.receivedAmount || 0);
        const rate = total > 0 ? ((received / total) * 100).toFixed(2) : 0;
        return `${rate}%`;
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
              title="销售总额"
              value={summary.totalAmount}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已收款总额"
              value={summary.receivedAmount}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="应收总额"
              value={summary.receivableAmount}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#ff4d4f' }}
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
          <Button type="primary" onClick={loadStats}>查询</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={stats}
        rowKey="id"
        loading={loading}
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
      />
    </Card>
  );
};

export default ReceivablesStats;

