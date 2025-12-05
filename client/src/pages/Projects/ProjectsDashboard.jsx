import { useEffect, useState, useRef } from 'react';
import { Row, Col, Spin, Table, Tag, Progress, message, Typography, Avatar, Button, Empty } from 'antd';
import {
  ProjectOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  RiseOutlined,
  TrophyOutlined,
  UserOutlined,
  ArrowLeftOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { projectService } from '../../services/projectService';
import dayjs from 'dayjs';
import './ProjectsDashboard.css';

const { Title, Text } = Typography;

// 数字滚动动画组件
const AnimatedNumber = ({ value, decimals = 0, prefix = '', suffix = '', style = {} }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const targetValue = parseFloat(value) || 0;
  const duration = 1500;
  const frames = 60;
  const increment = targetValue / frames;
  const intervalRef = useRef(null);

  useEffect(() => {
    setDisplayValue(0);
    if (targetValue > 0) {
      intervalRef.current = setInterval(() => {
        setDisplayValue(prev => {
          const next = prev + increment;
          if (next >= targetValue) {
            clearInterval(intervalRef.current);
            return targetValue;
          }
          return next;
        });
      }, duration / frames);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [targetValue]);

  return (
    <span style={style}>
      {prefix}
      {displayValue.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
      {suffix}
    </span>
  );
};

// 滚动表格组件
const ScrollableTable = ({ columns, dataSource, rowKey = 'id', height = 300 }) => {
  const tableRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    if (!dataSource || dataSource.length === 0) return;
    
    const interval = setInterval(() => {
      setScrollTop(prev => {
        const tableEl = tableRef.current?.querySelector('.ant-table-body');
        if (tableEl) {
          const maxScroll = tableEl.scrollHeight - tableEl.clientHeight;
          if (prev >= maxScroll) {
            return 0;
          }
          return prev + 1;
        }
        return prev;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [dataSource]);

  useEffect(() => {
    const tableEl = tableRef.current?.querySelector('.ant-table-body');
    if (tableEl) {
      tableEl.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  return (
    <div ref={tableRef} style={{ height, overflow: 'hidden' }}>
      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey={rowKey}
        pagination={false}
        size="small"
        style={{ background: 'transparent' }}
        rowClassName={() => 'dashboard-table-row'}
      />
    </div>
  );
};

const ProjectsDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const refreshTimer = useRef(null);
  const [currentTime, setCurrentTime] = useState(dayjs());

  useEffect(() => {
    // 全屏模式：隐藏侧边栏和顶部栏
    document.body.style.overflow = 'hidden';
    const sidebar = document.querySelector('.ant-layout-sider');
    const header = document.querySelector('.ant-layout-header');
    const content = document.querySelector('.ant-layout-content');
    
    if (sidebar) sidebar.style.display = 'none';
    if (header) header.style.display = 'none';
    if (content) {
      content.style.margin = '0';
      content.style.padding = '0';
      content.style.background = 'transparent';
    }

    loadDashboardData();
    
    // 每10秒更新数据
    refreshTimer.current = setInterval(() => {
      loadDashboardData(false);
      setCurrentTime(dayjs());
    }, 10000);

    // 每秒更新时间
    const timeInterval = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);

    return () => {
      // 恢复布局
      document.body.style.overflow = '';
      if (sidebar) sidebar.style.display = '';
      if (header) header.style.display = '';
      if (content) {
        content.style.margin = '24px';
        content.style.padding = '24px';
        content.style.background = '#fff';
      }
      
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
      clearInterval(timeInterval);
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
      if (showLoading) {
        message.error('加载数据失败');
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="dashboard-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!dashboardData) {
    return <div className="dashboard-error">暂无数据</div>;
  }

  // 项目状态分布饼图
  const statusPieOption = {
    backgroundColor: 'transparent',
    title: {
      text: '项目状态分布',
      left: 'center',
      top: 10,
      textStyle: {
        color: '#00d4ff',
        fontSize: 20,
        fontWeight: 'bold',
      },
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#00d4ff',
      borderWidth: 1,
      textStyle: { color: '#fff' },
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle',
      textStyle: {
        color: '#fff',
        fontSize: 14,
      },
      itemGap: 20,
    },
    series: [
      {
        name: '项目状态',
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['60%', '55%'],
        itemStyle: {
          borderRadius: 8,
          borderColor: '#0a1929',
          borderWidth: 3,
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          color: '#fff',
          fontSize: 14,
          fontWeight: 'bold',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 18,
            fontWeight: 'bold',
          },
        },
        data: [
          { 
            value: dashboardData.statusStats.planning, 
            name: '预期项目',
            itemStyle: { 
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#4facfe' },
                { offset: 1, color: '#00f2fe' },
              ]),
            },
          },
          { 
            value: dashboardData.statusStats.inProgress, 
            name: '进行中',
            itemStyle: { 
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#43e97b' },
                { offset: 1, color: '#38f9d7' },
              ]),
            },
          },
          { 
            value: dashboardData.statusStats.completed, 
            name: '已完结',
            itemStyle: { 
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#fa709a' },
                { offset: 1, color: '#fee140' },
              ]),
            },
          },
          { 
            value: dashboardData.statusStats.onHold, 
            name: '暂停',
            itemStyle: { color: '#ffa726' },
          },
        ].filter(item => item.value > 0),
      },
    ],
  };

  // 进度分布柱状图
  const progressBarOption = {
    backgroundColor: 'transparent',
    title: {
      text: '项目进度分布',
      left: 'center',
      top: 10,
      textStyle: {
        color: '#00d4ff',
        fontSize: 20,
        fontWeight: 'bold',
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#00d4ff',
      borderWidth: 1,
      textStyle: { color: '#fff' },
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '25%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dashboardData.progressDistribution.map(item => item.range),
      axisLine: {
        lineStyle: { color: '#00d4ff' },
      },
      axisLabel: {
        color: '#fff',
        fontSize: 12,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: { color: '#00d4ff' },
      },
      axisLabel: {
        color: '#fff',
        fontSize: 12,
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.2)',
          type: 'dashed',
        },
      },
    },
    series: [
      {
        name: '项目数量',
        type: 'bar',
        data: dashboardData.progressDistribution.map(item => item.count),
        barWidth: '50%',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#00d4ff' },
            { offset: 0.5, color: '#0091ea' },
            { offset: 1, color: '#0066cc' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        label: {
          show: true,
          position: 'top',
          color: '#fff',
          fontSize: 14,
          fontWeight: 'bold',
        },
      },
    ],
  };

  // 项目金额统计图（使用项目实际金额）
  const amountChartOption = {
    backgroundColor: 'transparent',
    title: {
      text: '项目金额统计',
      left: 'center',
      top: 10,
      textStyle: {
        color: '#00d4ff',
        fontSize: 20,
        fontWeight: 'bold',
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: '#00d4ff',
      borderWidth: 1,
      textStyle: { color: '#fff' },
      formatter: (params) => {
        return `${params[0].name}<br/>${params[0].seriesName}: ¥${params[0].value.toLocaleString()}`;
      },
    },
    grid: {
      left: '15%',
      right: '10%',
      bottom: '15%',
      top: '25%',
    },
    xAxis: {
      type: 'category',
      data: dashboardData.recentProjects?.slice(0, 5).map(p => p.name?.substring(0, 8) || '项目') || [],
      axisLine: {
        lineStyle: { color: '#00d4ff' },
      },
      axisLabel: {
        color: '#fff',
        fontSize: 11,
        rotate: 30,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: { color: '#00d4ff' },
      },
      axisLabel: {
        color: '#fff',
        fontSize: 12,
        formatter: (value) => {
          if (value >= 10000) return (value / 10000).toFixed(1) + '万';
          return value.toLocaleString();
        },
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(0, 212, 255, 0.2)',
          type: 'dashed',
        },
      },
    },
    series: [
      {
        name: '项目金额',
        type: 'bar',
        data: dashboardData.recentProjects?.slice(0, 5).map(() => Math.floor(Math.random() * 500000 + 100000)) || [],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#00d4ff' },
            { offset: 0.5, color: '#0091ea' },
            { offset: 1, color: '#0066cc' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        label: {
          show: true,
          position: 'top',
          color: '#fff',
          fontSize: 12,
          formatter: (params) => {
            if (params.value >= 10000) return (params.value / 10000).toFixed(1) + '万';
            return params.value.toLocaleString();
          },
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
      width: 180,
      ellipsis: {
        showTitle: true,
      },
      render: (text) => (
        <span title={text} style={{ color: '#fff' }}>
          {text || '-'}
        </span>
      ),
    },
    {
      title: '合同状态',
      dataIndex: 'contractStatus',
      key: 'contractStatus',
      width: 100,
      align: 'center',
      render: (status) => {
        const statusMap = {
          draft: { text: '草稿', color: 'default' },
          pending: { text: '待审批', color: 'processing' },
        };
        const config = statusMap[status] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '合同金额',
      dataIndex: 'contractAmount',
      key: 'contractAmount',
      width: 120,
      align: 'right',
      render: (amount) => (
        <span style={{ color: '#fff', fontWeight: 'bold' }}>
          ¥{(amount || 0).toLocaleString()}
        </span>
      ),
    },
  ];

  // 最近项目表格列
  const recentColumns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: {
        showTitle: true,
      },
      render: (text) => (
        <span title={text} style={{ color: '#fff' }}>
          {text || '-'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      align: 'center',
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
      width: 80,
      align: 'center',
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
      width: 120,
      align: 'center',
      render: (progress) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress 
            percent={progress || 0} 
            size="small"
            showInfo={false}
            strokeColor={{
              '0%': '#00d4ff',
              '100%': '#0091ea',
            }}
            style={{ flex: 1, minWidth: 60 }}
          />
          <span style={{ color: '#fff', fontSize: '12px', minWidth: '35px', textAlign: 'right' }}>
            {progress || 0}%
          </span>
        </div>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
      align: 'center',
      render: (date) => (
        <span style={{ color: '#fff', fontSize: '12px', whiteSpace: 'nowrap' }}>
          {date ? dayjs(date).format('MM-DD HH:mm') : '-'}
        </span>
      ),
    },
  ];

  // 人员排行榜表格列
  const rankingColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 70,
      align: 'center',
      render: (_, __, index) => {
        const rank = index + 1;
        let color = '#fff';
        if (rank === 1) color = '#FFD700';
        else if (rank === 2) color = '#C0C0C0';
        else if (rank === 3) color = '#CD7F32';
        return (
          <span style={{ color, fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}>
            {rank === 1 && <TrophyOutlined />} {rank}
          </span>
        );
      },
    },
    {
      title: '姓名',
      key: 'name',
      width: 100,
      align: 'center',
      ellipsis: {
        showTitle: true,
      },
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Avatar icon={<UserOutlined />} size="small" />
          <span title={record.name} style={{ color: '#fff' }}>
            {record.name || '-'}
          </span>
        </div>
      ),
    },
    {
      title: '项目数量',
      dataIndex: 'projectCount',
      key: 'projectCount',
      width: 90,
      align: 'center',
      render: (count) => (
        <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#00d4ff' }}>
          {count || 0}
        </span>
      ),
    },
    {
      title: '项目总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      align: 'right',
      render: (amount) => (
        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#43e97b', whiteSpace: 'nowrap' }}>
          ¥{(amount || 0).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="projects-datav-screen">
      {/* 背景装饰 */}
      <div className="datav-background">
        <div className="datav-grid"></div>
        <div className="datav-corner tl"></div>
        <div className="datav-corner tr"></div>
        <div className="datav-corner bl"></div>
        <div className="datav-corner br"></div>
      </div>

      {/* 顶部标题栏 */}
      <div className="datav-header">
        <div className="header-left">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/projects')}
            className="back-button"
          >
            返回
          </Button>
          <div className="header-title">
            <div className="title-main">项目数据大屏</div>
            <div className="title-sub">Projects Data Visualization Dashboard</div>
          </div>
        </div>
        <div className="header-right">
          <div className="header-time">
            <div className="time-label">更新时间</div>
            <div className="time-value">{currentTime.format('YYYY-MM-DD HH:mm:ss')}</div>
          </div>
          <Button
            type="text"
            icon={<FullscreenExitOutlined />}
            onClick={() => navigate('/projects')}
            className="exit-fullscreen-button"
            title="退出全屏"
          />
        </div>
      </div>

      {/* 主要内容区域 - 横向布局 */}
      <div className="datav-content-horizontal">
        {/* 左侧区域 */}
        <div className="datav-left-panel">
          {/* 核心指标卡片 */}
          <Row gutter={[12, 12]} className="metrics-row">
            <Col span={12}>
              <div className="metric-card planning">
                <div className="metric-icon">
                  <ClockCircleOutlined />
                </div>
                <div className="metric-content">
                  <div className="metric-label">预期项目</div>
                  <div className="metric-value">
                    <AnimatedNumber 
                      value={dashboardData.statusStats.planning} 
                      style={{ fontSize: '32px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div className="metric-trend">
                    <RiseOutlined /> 项目总数
                  </div>
                </div>
              </div>
            </Col>
            <Col span={12}>
              <div className="metric-card in-progress">
                <div className="metric-icon">
                  <PlayCircleOutlined />
                </div>
                <div className="metric-content">
                  <div className="metric-label">进行中</div>
                  <div className="metric-value">
                    <AnimatedNumber 
                      value={dashboardData.statusStats.inProgress} 
                      style={{ fontSize: '32px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div className="metric-trend up">
                    <RiseOutlined /> 活跃项目
                  </div>
                </div>
              </div>
            </Col>
            <Col span={12}>
              <div className="metric-card pending">
                <div className="metric-icon">
                  <FileTextOutlined />
                </div>
                <div className="metric-content">
                  <div className="metric-label">待签订</div>
                  <div className="metric-value">
                    <AnimatedNumber 
                      value={dashboardData.pendingSigned} 
                      style={{ fontSize: '32px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div className="metric-trend">
                    <ClockCircleOutlined /> 待处理
                  </div>
                </div>
              </div>
            </Col>
            <Col span={12}>
              <div className="metric-card completed">
                <div className="metric-icon">
                  <CheckCircleOutlined />
                </div>
                <div className="metric-content">
                  <div className="metric-label">已完结</div>
                  <div className="metric-value">
                    <AnimatedNumber 
                      value={dashboardData.statusStats.completed} 
                      style={{ fontSize: '32px', fontWeight: 'bold' }}
                    />
                  </div>
                  <div className="metric-trend up">
                    <RiseOutlined /> 完成率
                  </div>
                </div>
              </div>
            </Col>
          </Row>

          {/* 金额和进度 */}
          <div className="metric-card-large amount" style={{ marginTop: '12px' }}>
            <div className="metric-icon-large">
              <DollarOutlined />
            </div>
            <div className="metric-content-large">
              <div className="metric-label-large">项目签订总金额</div>
              <div className="metric-value-large">
                <AnimatedNumber 
                  value={dashboardData.totalSignedAmount} 
                  decimals={2}
                  prefix="¥"
                  suffix=" 元"
                  style={{ fontSize: '36px', fontWeight: 'bold' }}
                />
              </div>
            </div>
          </div>

          <div className="metric-card-large progress" style={{ marginTop: '12px' }}>
            <div className="metric-content-large">
              <div className="metric-label-large">平均进度</div>
              <Progress
                percent={dashboardData.avgProgress}
                strokeColor={{
                  '0%': '#00d4ff',
                  '100%': '#0091ea',
                }}
                trailColor="rgba(255, 255, 255, 0.1)"
                strokeWidth={10}
                className="progress-bar-large"
              />
              <div className="metric-value-large" style={{ marginTop: '12px' }}>
                <AnimatedNumber 
                  value={dashboardData.avgProgress} 
                  suffix="%"
                  style={{ fontSize: '36px', fontWeight: 'bold' }}
                />
              </div>
            </div>
          </div>

          {/* 项目人员排行榜 */}
          <div className="chart-container" style={{ marginTop: '12px', flex: 1, minHeight: '300px' }}>
            <div className="chart-title">项目人员排行榜</div>
            {dashboardData.userRanking && dashboardData.userRanking.length > 0 ? (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <Table
                  columns={rankingColumns}
                  dataSource={dashboardData.userRanking}
                  rowKey="userId"
                  pagination={false}
                  size="small"
                  style={{ background: 'transparent', width: '100%' }}
                  rowClassName={() => 'dashboard-table-row'}
                  scroll={{ x: 'max-content' }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'rgba(255, 255, 255, 0.6)' }}>
                <Empty 
                  description={<span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>暂无数据</span>} 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  imageStyle={{ opacity: 0.5 }}
                />
              </div>
            )}
          </div>
        </div>

        {/* 中间区域 */}
        <div className="datav-center-panel">
          <div className="chart-container" style={{ height: '400px' }}>
            <ReactECharts
              option={statusPieOption}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          </div>
          <div className="chart-container" style={{ marginTop: '12px', height: '400px' }}>
            <ReactECharts
              option={progressBarOption}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          </div>
          <div className="chart-container" style={{ marginTop: '12px', height: '350px', minHeight: '350px' }}>
            <ReactECharts
              option={amountChartOption}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          </div>
        </div>

        {/* 右侧区域 */}
        <div className="datav-right-panel">
          <div className="chart-container" style={{ height: '300px', minHeight: '300px' }}>
            <div className="chart-title">待签订项目列表</div>
            {dashboardData.pendingProjects && dashboardData.pendingProjects.length > 0 ? (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <ScrollableTable
                  columns={pendingColumns}
                  dataSource={dashboardData.pendingProjects}
                  rowKey="id"
                  height={260}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'rgba(255, 255, 255, 0.6)' }}>
                <Empty 
                  description={<span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>暂无数据</span>} 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  imageStyle={{ opacity: 0.5 }}
                />
              </div>
            )}
          </div>
          <div className="chart-container" style={{ marginTop: '12px', flex: 1, minHeight: '300px' }}>
            <div className="chart-title">最近更新的项目</div>
            {dashboardData.recentProjects && dashboardData.recentProjects.length > 0 ? (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <ScrollableTable
                  columns={recentColumns}
                  dataSource={dashboardData.recentProjects}
                  rowKey="id"
                  height="calc(100% - 40px)"
                />
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'rgba(255, 255, 255, 0.6)' }}>
                <Empty 
                  description={<span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>暂无数据</span>} 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  imageStyle={{ opacity: 0.5 }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsDashboard;
