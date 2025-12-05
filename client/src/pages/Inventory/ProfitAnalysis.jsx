import { useState, useEffect } from 'react';
import {
  Card,
  DatePicker,
  Button,
  Space,
  message,
  Statistic,
  Row,
  Col,
  Progress,
} from 'antd';
import {
  DollarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import inventoryService from '../../services/inventoryService';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const ProfitAnalysis = () => {
  const [data, setData] = useState({ totalIncome: 0, totalExpense: 0, profit: 0, profitRate: 0 });
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
      
      const response = await inventoryService.getProfitAnalysis(params);
      if (response.success) {
        setData(response.data || { totalIncome: 0, totalExpense: 0, profit: 0, profitRate: 0 });
      } else {
        message.error(response.message || '加载收支利润分析失败');
      }
    } catch (error) {
      message.error(error.message || '加载收支利润分析失败');
    } finally {
      setLoading(false);
    }
  };

  const profitColor = data.profit >= 0 ? '#52c41a' : '#ff4d4f';
  const profitIcon = data.profit >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />;

  return (
    <Card
      style={{
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            format="YYYY-MM-DD"
          />
          <Button type="primary" onClick={loadData} loading={loading}>
            查询
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总收入"
              value={data.totalIncome}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="总支出"
              value={data.totalExpense}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="利润"
              value={data.profit}
              prefix={profitIcon}
              precision={2}
              valueStyle={{ color: profitColor }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="利润率分析" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>利润率: {data.profitRate}%</div>
          <Progress
            percent={Math.abs(parseFloat(data.profitRate || 0))}
            status={data.profit >= 0 ? 'success' : 'exception'}
            strokeColor={profitColor}
          />
        </div>
        <div style={{ color: '#666', fontSize: 14 }}>
          {data.totalIncome > 0 ? (
            <>
              <p>收入占比: {((data.totalIncome / (data.totalIncome + Math.abs(data.totalExpense))) * 100).toFixed(2)}%</p>
              <p>支出占比: {((data.totalExpense / (data.totalIncome + Math.abs(data.totalExpense))) * 100).toFixed(2)}%</p>
            </>
          ) : (
            <p>暂无数据</p>
          )}
        </div>
      </Card>
    </Card>
  );
};

export default ProfitAnalysis;

