import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Card,
  DatePicker,
  Select,
  message,
  Tag,
  Space,
} from 'antd';
import {
  DownloadOutlined,
} from '@ant-design/icons';
import inventoryService from '../../services/inventoryService';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const SalesProfitAnalysis = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange && dateRange.length === 2) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      
      const response = await inventoryService.getSalesProfitAnalysis(params);
      if (response.success) {
        const dataList = Array.isArray(response.data) ? response.data : [];
        setData(dataList);
      } else {
        message.error(response.message || '加载销售利润分析失败');
      }
    } catch (error) {
      message.error(error.message || '加载销售利润分析失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    message.info('导出功能需要后端API支持');
  };

  const columns = [
    { title: '产品编号', dataIndex: 'id', key: 'id', width: 100 },
    { title: '产品编码', dataIndex: 'productCode', key: 'productCode' },
    { title: '产品名称', dataIndex: 'productName', key: 'productName' },
    {
      title: '销售数量',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      render: (q) => parseFloat(q || 0).toFixed(2),
    },
    {
      title: '销售金额',
      dataIndex: 'totalSalesAmount',
      key: 'totalSalesAmount',
      render: (a) => `¥${parseFloat(a || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: '采购数量',
      dataIndex: 'totalPurchaseQuantity',
      key: 'totalPurchaseQuantity',
      render: (q) => parseFloat(q || 0).toFixed(2),
    },
    {
      title: '采购金额',
      dataIndex: 'totalPurchaseAmount',
      key: 'totalPurchaseAmount',
      render: (a) => `¥${parseFloat(a || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: '利润',
      dataIndex: 'profit',
      key: 'profit',
      render: (profit) => {
        const p = parseFloat(profit || 0);
        return <span style={{ color: p >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
          ¥{p.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>;
      },
    },
    {
      title: '利润率',
      key: 'profitRate',
      render: (_, record) => {
        const sales = parseFloat(record.totalSalesAmount || 0);
        const profit = parseFloat(record.profit || 0);
        const rate = sales > 0 ? ((profit / sales) * 100).toFixed(2) : 0;
        return <Tag color={rate >= 0 ? 'green' : 'red'}>{rate}%</Tag>;
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
        <Space>
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            format="YYYY-MM-DD"
          />
          <Button type="primary" onClick={loadData} loading={loading}>
            查询
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
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

export default SalesProfitAnalysis;

