import { useEffect, useState, useRef } from 'react';
import { Row, Col, Card, Statistic, Spin, Table, Tag, Progress, message, Typography } from 'antd';
import {
  ProjectOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  DollarOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { projectService } from '../../services/projectService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ProjectDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const refreshTimer = useRef(null);

  useEffect(() => {
    loadDashboardData();
    
    // 设置定时刷新，每30秒更新一次数据
    refreshTimer.current = setInterval(() => {
      loadDashboardData(false); // 静默刷新，不显示loading
    }, 30000);

    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, []);

  const loadDashboardData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await projectService.getAllProjectsDashboard();
      if (response.success) {
        setDashboardData(response.data);
      } else {
        message.error('加载数据失败');
      }
    } catch (error) {
      console.error('加载数据大屏失败:', error);
      message.error('加载数据失败');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  if (loading && !dashboardData) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!dashboardData) {
    return <div>暂无数据</div>;
  }

  // 状态配置
  const statusConfig = {
    planning: { label: '预期项目', color: '#1890ff', icon: <ClockCircleOutlined /> },
    inProgress: { label: '进行中', color: '#52c41a', icon: <PlayCircleOutlined /> },
    completed: { label: '已完结', color: '#722ed1', icon: <CheckCircleOutlined /> },
    pendingSigned: { label: '待签订', color: '#fa8c16', icon: <FileTextOutlined /> },
  };

  // 项目状态分布饼图配置
  const statusPieOption = {
    title: {
      text: '项目状态分布',
      left: 'center',
      textStyle: {
        color: '#fff',
        fontSize: 16,
      },
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      textStyle: {
        color: '#fff',
      },
    },
    series: [
      {
        name: '项目状态',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#1e1e1e',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          color: '#fff',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold',
          },
        },
        data: [
          { 
            value: dashboardData.statusStats.planning, 
            name: '预期项目',
            itemStyle: { color: '#1890ff' },
          },
          { 
            value: dashboardData.statusStats.inProgress, 
            name: '进行中',
            itemStyle: { color: '#52c41a' },
          },
          { 
            value: dashboardData.statusStats.completed, 
            name: '已完结',
            itemStyle: { color: '#722ed1' },
          },
          { 
            value: dashboardData.statusStats.onHold, 
            name: '暂停',
            itemStyle: { color: '#faad14' },
          },
          { 
            value: dashboardData.statusStats.cancelled, 
            name: '已取消',
            itemStyle: { color: '#ff4d4f' },
          },
        ].filter(item => item.value > 0),
      },
    ],
  };

  // 进度分布柱状图配置
  const progressBarOption = {
    title: {
      text: '项目进度分布',
      left: 'center',
      textStyle: {
        color: '#fff',
        fontSize: 16,
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dashboardData.progressDistribution.map(item => item.range),
      axisLabel: {
        color: '#fff',
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#fff',
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
    series: [
      {
        name: '项目数量',
        type: 'bar',
        data: dashboardData.progressDistribution.map(item => item.count),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#83bff6' },
            { offset: 0.5, color: '#188df0' },
            { offset: 1, color: '#188df0' },
          ]),
        },
        emphasis: {
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#2378f7' },
              { offset: 0.7, color: '#2378f7' },
              { offset: 1, color: '#83bff6' },
            ]),
          },
        },
        label: {
          show: true,
          position: 'top',
          color: '#fff',
        },
      },
    ],
  };

  // 优先级分布图配置
  const priorityOption = {
    title: {
      text: '项目优先级分布',
      left: 'center',
      textStyle: {
        color: '#fff',
        fontSize: 16,
      },
    },
    tooltip: {
      trigger: 'item',
    },
    xAxis: {
      type: 'category',
      data: ['低', '中', '高', '紧急'],
      axisLabel: {
        color: '#fff',
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#fff',
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
    series: [
      {
        data: [
          { value: dashboardData.priorityStats.low || 0, itemStyle: { color: '#8c8c8c' } },
          { value: dashboardData.priorityStats.medium || 0, itemStyle: { color: '#1890ff' } },
          { value: dashboardData.priorityStats.high || 0, itemStyle: { color: '#fa8c16' } },
          { value: dashboardData.priorityStats.urgent || 0, itemStyle: { color: '#ff4d4f' } },
        ],
        type: 'bar',
        label: {
          show: true,
          position: 'top',
          color: '#fff',
        },
      },
    ],
  };

  // 待签订项目表格列
  const pendingColumns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '合同状态',
      dataIndex: 'contractStatus',
      key: 'contractStatus',
      render: (status) => {
        const statusMap = {
          draft: { text: '草稿', color: 'default' },
          pending: { text: '待审批', color: 'processing' },
        };
        const config = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '合同金额',
      dataIndex: 'contractAmount',
      key: 'contractAmount',
      render: (amount) => `¥${(amount || 0).toLocaleString()}`,
    },
  ];

  // 最近项目表格列
  const recentColumns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          planning: { text: '预期', color: 'blue' },
          in_progress: { text: '进行中', color: 'green' },
          on_hold: { text: '暂停', color: 'orange' },
          completed: { text: '已完成', color: 'purple' },
          cancelled: { text: '已取消', color: 'red' },
        };
        const config = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => {
        const priorityMap = {
          low: { text: '低', color: 'default' },
          medium: { text: '中', color: 'blue' },
          high: { text: '高', color: 'orange' },
          urgent: { text: '紧急', color: 'red' },
        };
        const config = priorityMap[priority] || { text: priority, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress) => <Progress percent={progress || 0} size="small" />,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <div style={{ 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      padding: '24px',
    }}>
      <div style={{ 
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '12px',
        padding: '24px',
        backdropFilter: 'blur(10px)',
      }}>
        {/* 标题区域 */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '32px',
          paddingBottom: '24px',
          borderBottom: '2px solid rgba(255, 255, 255, 0.2)',
        }}>
          <Title level={1} style={{ color: '#fff', margin: 0 }}>
            项目数据大屏
          </Title>
          <Text style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
            最后更新: {dashboardData.lastUpdate ? dayjs(dashboardData.lastUpdate).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Text>
        </div>

        {/* 统计卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
              }}
            >
              <Statistic
                title={<span style={{ color: '#fff' }}>预期项目</span>}
                value={dashboardData.statusStats.planning}
                prefix={<ProjectOutlined style={{ color: '#fff' }} />}
                valueStyle={{ color: '#fff', fontSize: '28px' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
              }}
            >
              <Statistic
                title={<span style={{ color: '#fff' }}>进行中的项目</span>}
                value={dashboardData.statusStats.inProgress}
                prefix={<PlayCircleOutlined style={{ color: '#fff' }} />}
                valueStyle={{ color: '#fff', fontSize: '28px' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
              }}
            >
              <Statistic
                title={<span style={{ color: '#fff' }}>待签订项目</span>}
                value={dashboardData.pendingSigned}
                prefix={<FileTextOutlined style={{ color: '#fff' }} />}
                valueStyle={{ color: '#fff', fontSize: '28px' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                border: 'none',
                borderRadius: '12px',
                boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
              }}
            >
              <Statistic
                title={<span style={{ color: '#fff' }}>已完结项目</span>}
                value={dashboardData.statusStats.completed}
                prefix={<CheckCircleOutlined style={{ color: '#fff' }} />}
                valueStyle={{ color: '#fff', fontSize: '28px' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 签订金额和平均进度 */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12}>
            <Card
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Statistic
                title={<span style={{ color: '#fff' }}>项目签订总金额</span>}
                value={dashboardData.totalSignedAmount}
                prefix={<DollarOutlined style={{ color: '#fff' }} />}
                precision={2}
                valueStyle={{ color: '#fff', fontSize: '32px' }}
                suffix={<span style={{ color: '#fff', fontSize: '16px' }}>元</span>}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div>
                <Text style={{ color: '#fff', fontSize: '16px', display: 'block', marginBottom: '16px' }}>
                  平均进度
                </Text>
                <Progress
                  percent={dashboardData.avgProgress}
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                  size="default"
                  style={{ marginBottom: '8px' }}
                />
                <Text style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold' }}>
                  {dashboardData.avgProgress}%
                </Text>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 图表区域 */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={12}>
            <Card
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: 'none',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
              }}
            >
              <ReactECharts
                option={statusPieOption}
                style={{ height: '400px' }}
                opts={{ renderer: 'svg' }}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: 'none',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
              }}
            >
              <ReactECharts
                option={progressBarOption}
                style={{ height: '400px' }}
                opts={{ renderer: 'svg' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 优先级分布 */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={12}>
            <Card
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: 'none',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
              }}
            >
              <ReactECharts
                option={priorityOption}
                style={{ height: '300px' }}
                opts={{ renderer: 'svg' }}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={<span style={{ color: '#fff' }}>待签订项目列表</span>}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: 'none',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
              }}
              bodyStyle={{ background: 'transparent' }}
            >
              <Table
                columns={pendingColumns}
                dataSource={dashboardData.pendingProjects}
                rowKey="id"
                pagination={false}
                size="small"
                style={{ background: 'transparent' }}
                rowClassName={() => 'transparent-row'}
              />
            </Card>
          </Col>
        </Row>

        {/* 最近更新的项目 */}
        <Card
          title={<span style={{ color: '#fff' }}>最近更新的项目</span>}
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            border: 'none',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
          }}
          bodyStyle={{ background: 'transparent' }}
        >
          <Table
            columns={recentColumns}
            dataSource={dashboardData.recentProjects}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
            style={{ background: 'transparent' }}
          />
        </Card>
      </div>

      <style>{`
        .transparent-row {
          background: rgba(255, 255, 255, 0.05) !important;
        }
        .transparent-row:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .ant-table-thead > tr > th {
          background: rgba(255, 255, 255, 0.1) !important;
          color: #fff !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
        }
        .ant-table-tbody > tr > td {
          background: transparent !important;
          color: #fff !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        .ant-card-head-title {
          color: #fff !important;
        }
      `}</style>
    </div>
  );
};

export default ProjectDashboard;
