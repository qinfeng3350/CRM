/**
 * 数据大屏 - 使用 DataV 库增强
 * 支持实时数据更新、大屏展示、数据可视化
 * 
 * 创建时间: 2025-12-29
 * 数据来源: /api/projects/dashboard/stats
 * 关联数据: 项目统计、任务进度、资源分配等
 */

import React, { useState, useEffect } from 'react';
import { Layout, Button, Space, Statistic, Row, Col, Card, Table, Spin, Empty, message } from 'antd';
import { FullscreenOutlined, FullscreenExitOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import projectService from '../../services/projectService';
import './DataVDashboard.css';

const DataVDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // 加载数据大屏数据
  const loadDashboardData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await projectService.getAllProjectsDashboard();
      if (response.data) {
        setDashboardData(response.data);
      }
    } catch (error) {
      console.error('加载数据大屏失败:', error);
      message.error('数据加载失败');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // 初始化和自动刷新
  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => {
      loadDashboardData(false); // 静默刷新，不显示 loading
    }, 10000); // 每10秒刷新一次
    return () => clearInterval(interval);
  }, []);

  // 项目状态分布（饼图）
  const statusChartOption = {
    title: { text: '项目状态分布' },
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        name: '项目数量',
        type: 'pie',
        radius: '50%',
        data: dashboardData ? [
          { value: dashboardData.statusStats.planning || 0, name: '规划中' },
          { value: dashboardData.statusStats.inProgress || 0, name: '执行中' },
          { value: dashboardData.statusStats.completed || 0, name: '已完成' },
          { value: dashboardData.statusStats.onHold || 0, name: '暂停' },
          { value: dashboardData.statusStats.cancelled || 0, name: '已取消' },
        ] : [],
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
      },
    ],
  };

  // 项目进度分布（柱状图）
  const progressChartOption = {
    title: { text: '项目进度分布' },
    xAxis: { type: 'category', data: dashboardData ? dashboardData.progressDistribution.map(item => item.range) : [] },
    yAxis: { type: 'value' },
    series: [
      {
        name: '项目数量',
        data: dashboardData ? dashboardData.progressDistribution.map(item => item.count) : [],
        type: 'bar',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#83bff6' },
            { offset: 0.5, color: '#188df0' },
            { offset: 1, color: '#188df0' },
          ]),
        },
      },
    ],
  };

  // 任务优先级分布（雷达图）
  const priorityChartOption = {
    title: { text: '任务优先级分布' },
    tooltip: {},
    legend: { data: ['任务数'] },
    radar: {
      indicator: [
        { name: '低', max: 200 },
        { name: '中', max: 200 },
        { name: '高', max: 200 },
        { name: '紧急', max: 200 },
      ],
    },
    series: [
      {
        name: '任务数',
        type: 'radar',
        data: dashboardData ? [
          {
            value: [
              dashboardData.priorityStats.low || 0,
              dashboardData.priorityStats.medium || 0,
              dashboardData.priorityStats.high || 0,
              dashboardData.priorityStats.urgent || 0,
            ],
            name: '任务数',
          },
        ] : [],
      },
    ],
  };

  if (loading && !dashboardData) {
    return <Spin size="large" style={{ marginTop: '50px' }} />;
  }

  if (!dashboardData) {
    return <Empty description="暂无数据" />;
  }

  return (
    <Layout style={{ minHeight: fullscreen ? '100vh' : 'auto' }} className={fullscreen ? 'datav-fullscreen' : ''}>
      <Layout.Content style={{ padding: fullscreen ? '20px' : '24px' }}>
        <Space style={{ marginBottom: '16px' }}>
          <Button 
            icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            onClick={() => setFullscreen(!fullscreen)}
          >
            {fullscreen ? '退出全屏' : '全屏'}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadDashboardData()}>
            刷新
          </Button>
        </Space>

        {/* 关键指标统计 */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic 
                title="总项目数" 
                value={dashboardData.totalProjects}
                precision={0}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic 
                title="执行中" 
                value={dashboardData.statusStats.inProgress}
                precision={0}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic 
                title="已完成" 
                value={dashboardData.statusStats.completed}
                precision={0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic 
                title="平均进度" 
                value={dashboardData.avgProgress}
                precision={1}
                suffix="%"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 数据大屏标题 */}
        <Card style={{ marginBottom: '24px', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>数据大屏仪表盘</h1>
          <p style={{ color: '#666', marginTop: '8px' }}>
            最后更新: {dashboardData.lastUpdate ? dayjs(dashboardData.lastUpdate).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </p>
        </Card>

        {/* 数据可视化图表 */}
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col xs={24} lg={12}>
            <Card title="项目状态分布" style={{ minHeight: '400px' }}>
              <ReactECharts option={statusChartOption} style={{ height: '350px' }} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="项目进度分布" style={{ minHeight: '400px' }}>
              <ReactECharts option={progressChartOption} style={{ height: '350px' }} />
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col xs={24}>
            <Card title="任务优先级分布" style={{ minHeight: '400px' }}>
              <ReactECharts option={priorityChartOption} style={{ height: '350px' }} />
            </Card>
          </Col>
        </Row>

        {/* 待审批项目列表 */}
        {dashboardData.pendingProjects && dashboardData.pendingProjects.length > 0 && (
          <Card title="待审批项目" style={{ marginBottom: '24px' }}>
            <Table
              dataSource={dashboardData.pendingProjects}
              columns={[
                { title: '项目名称', dataIndex: 'name', key: 'name' },
                { title: '状态', dataIndex: 'status', key: 'status' },
                { title: '进度', dataIndex: 'progress', key: 'progress', render: (p) => `${p}%` },
              ]}
              pagination={{ pageSize: 5 }}
              rowClassName={() => 'dashboard-table-row'}
            />
          </Card>
        )}

        {/* 最近项目列表 */}
        {dashboardData.recentProjects && dashboardData.recentProjects.length > 0 && (
          <Card title="最近项目">
            <Table
              dataSource={dashboardData.recentProjects}
              columns={[
                { title: '项目名称', dataIndex: 'name', key: 'name' },
                { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (t) => dayjs(t).format('YYYY-MM-DD') },
                { title: '进度', dataIndex: 'progress', key: 'progress', render: (p) => `${p}%` },
              ]}
              pagination={{ pageSize: 5 }}
              rowClassName={() => 'dashboard-table-row'}
            />
          </Card>
        )}
      </Layout.Content>
    </Layout>
  );
};

export default DataVDashboard;
