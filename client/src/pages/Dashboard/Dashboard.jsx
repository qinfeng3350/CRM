import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Spin } from 'antd';
import {
  UserOutlined,
  DollarOutlined,
  FileTextOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';
import { customerService } from '../../services/customerService';
import { opportunityService } from '../../services/opportunityService';
import { contractService } from '../../services/contractService';
import { serviceService } from '../../services/serviceService';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    customers: 0,
    opportunities: 0,
    contracts: 0,
    tickets: 0,
  });
  const [recentCustomers, setRecentCustomers] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // 这里可以调用统计接口，暂时用列表接口获取数量
      const [customersRes, opportunitiesRes, contractsRes, ticketsRes] = await Promise.all([
        customerService.getCustomers({ page: 1, limit: 1 }),
        opportunityService.getOpportunities({ page: 1, limit: 1 }),
        contractService.getContracts({ page: 1, limit: 1 }),
        serviceService.getTickets({ page: 1, limit: 1 }),
      ]);

      setStats({
        customers: customersRes.success ? (customersRes.data?.pagination?.total || customersRes.pagination?.total || 0) : 0,
        opportunities: opportunitiesRes.success ? (opportunitiesRes.data?.pagination?.total || opportunitiesRes.pagination?.total || 0) : 0,
        contracts: contractsRes.success ? (contractsRes.data?.pagination?.total || contractsRes.pagination?.total || 0) : 0,
        tickets: ticketsRes.success ? (ticketsRes.data?.pagination?.total || ticketsRes.pagination?.total || 0) : 0,
      });

      // 获取最近客户
      const customers = await customerService.getCustomers({ page: 1, limit: 5 });
      if (customers.success) {
        const customersList = Array.isArray(customers.data) ? customers.data : (customers.data?.data || []);
        setRecentCustomers(customersList);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const customerColumns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '公司', dataIndex: 'company', key: 'company' },
    { title: '电话', dataIndex: 'phone', key: 'phone' },
    { title: '分类', dataIndex: 'category', key: 'category' },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <h2>工作台</h2>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="客户总数"
              value={stats.customers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="商机总数"
              value={stats.opportunities}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="合同总数"
              value={stats.contracts}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="工单总数"
              value={stats.tickets}
              prefix={<CustomerServiceOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="最近客户">
        <Table
          columns={customerColumns}
          dataSource={recentCustomers}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
};

export default Dashboard;

