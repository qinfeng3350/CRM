import { useState, useEffect } from 'react';
import { Table, Card, message } from 'antd';
import { salesService } from '../../services/salesService';

const SalesTeam = () => {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    setLoading(true);
    try {
      const response = await salesService.getTeam();
      if (response.success) {
        const teamList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setTeam(teamList);
      } else {
        message.error(response.message || '加载销售团队失败');
      }
    } catch (error) {
      message.error(error.message || '加载销售团队失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '部门', dataIndex: 'department', key: 'department' },
    { title: '角色', dataIndex: 'role', key: 'role' },
  ];

  return (
    <Card title="销售团队">
      <Table
        columns={columns}
        dataSource={team}
        rowKey="id"
        loading={loading}
      />
    </Card>
  );
};

export default SalesTeam;

