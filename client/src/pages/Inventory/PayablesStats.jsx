import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Card,
  DatePicker,
  Select,
  message,
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
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const PayablesStats = () => {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [supplierId, setSupplierId] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [summary, setSummary] = useState({ totalAmount: 0, paidAmount: 0, payableAmount: 0 });

  useEffect(() => {
    loadStats();
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

  const loadStats = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange && dateRange.length === 2) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      if (supplierId) params.supplierId = supplierId;
      
      const response = await inventoryService.getPayablesStats(params);
      if (response.success) {
        const statsList = Array.isArray(response.data) ? response.data : [];
        setStats(statsList);
        
        // 计算汇总
        const total = statsList.reduce((sum, s) => sum + parseFloat(s.totalAmount || 0), 0);
        const paid = statsList.reduce((sum, s) => sum + parseFloat(s.paidAmount || 0), 0);
        const payable = statsList.reduce((sum, s) => sum + parseFloat(s.payableAmount || 0), 0);
        
        setSummary({
          totalAmount: total,
          paidAmount: paid,
          payableAmount: payable,
        });
      } else {
        message.error(response.message || '加载应付统计失败');
      }
    } catch (error) {
      message.error(error.message || '加载应付统计失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    message.info('导出功能需要后端API支持');
  };

  const columns = [
    { title: '供应商编号', dataIndex: 'id', key: 'id', width: 100 },
    { title: '供应商名称', dataIndex: 'supplierName', key: 'supplierName' },
    {
      title: '采购总额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (a) => `¥${parseFloat(a || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: '已付款',
      dataIndex: 'paidAmount',
      key: 'paidAmount',
      render: (a) => `¥${parseFloat(a || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: '应付金额',
      dataIndex: 'payableAmount',
      key: 'payableAmount',
      render: (a) => {
        const amount = parseFloat(a || 0);
        return <span style={{ color: amount > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}>
          ¥{amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>;
      },
    },
    {
      title: '付款率',
      key: 'paymentRate',
      render: (_, record) => {
        const total = parseFloat(record.totalAmount || 0);
        const paid = parseFloat(record.paidAmount || 0);
        const rate = total > 0 ? ((paid / total) * 100).toFixed(2) : 0;
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
              title="采购总额"
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
              title="已付款总额"
              value={summary.paidAmount}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="应付总额"
              value={summary.payableAmount}
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

export default PayablesStats;

