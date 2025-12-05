import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Card,
  Tag,
  message,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import inventoryService from '../../services/inventoryService';

const LowStockProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [summary, setSummary] = useState({ total: 0, urgent: 0 });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await inventoryService.getLowStockProducts();
      if (response.success) {
        const productsList = Array.isArray(response.data) ? response.data : [];
        setProducts(productsList);
        
        // 计算统计
        const urgent = productsList.filter(p => {
          const qty = parseFloat(p.quantity || 0);
          const min = parseFloat(p.minStock || 0);
          return qty < min * 0.5; // 低于最低库存50%为紧急
        }).length;
        
        setSummary({
          total: productsList.length,
          urgent,
        });
      } else {
        message.error(response.message || '加载需进货物品统计失败');
      }
    } catch (error) {
      message.error(error.message || '加载需进货物品统计失败');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (!searchText) return true;
    const text = searchText.toLowerCase();
    return (
      (p.productName && p.productName.toLowerCase().includes(text)) ||
      (p.productCode && p.productCode.toLowerCase().includes(text))
    );
  });

  const columns = [
    { title: '序号', dataIndex: 'id', key: 'id', width: 80 },
    { title: '产品编码', dataIndex: 'productCode', key: 'productCode' },
    { title: '产品名称', dataIndex: 'productName', key: 'productName' },
    { title: '分类', dataIndex: 'categoryName', key: 'categoryName' },
    { title: '单位', dataIndex: 'productUnit', key: 'productUnit' },
    {
      title: '当前库存',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (q) => parseFloat(q || 0).toFixed(2),
    },
    {
      title: '最低库存',
      dataIndex: 'minStock',
      key: 'minStock',
      render: (m) => parseFloat(m || 0).toFixed(2),
    },
    {
      title: '库存状态',
      key: 'stockStatus',
      render: (_, record) => {
        const qty = parseFloat(record.quantity || 0);
        const min = parseFloat(record.minStock || 0);
        const percent = min > 0 ? (qty / min) * 100 : 0;
        
        if (qty <= 0) {
          return <Tag color="red" icon={<WarningOutlined />}>缺货</Tag>;
        } else if (qty < min * 0.5) {
          return <Tag color="red" icon={<WarningOutlined />}>紧急</Tag>;
        } else if (qty < min) {
          return <Tag color="orange">不足</Tag>;
        } else {
          return <Tag color="green">正常</Tag>;
        }
      },
    },
    {
      title: '缺货数量',
      key: 'shortage',
      render: (_, record) => {
        const qty = parseFloat(record.quantity || 0);
        const min = parseFloat(record.minStock || 0);
        const shortage = min - qty;
        if (shortage > 0) {
          return <span style={{ color: 'red', fontWeight: 'bold' }}>{shortage.toFixed(2)}</span>;
        }
        return '-';
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
              title="需进货产品总数"
              value={summary.total}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="紧急缺货产品"
              value={summary.urgent}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="一般缺货产品"
              value={summary.total - summary.urgent}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索产品名称或编码"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredProducts}
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

export default LowStockProducts;

