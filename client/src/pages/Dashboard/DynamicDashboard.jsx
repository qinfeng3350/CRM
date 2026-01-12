/**
 * 动态数据大屏显示页面
 * 根据大屏配置动态加载和显示数据
 */

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Layout, Spin, message, Button, Space, Empty } from 'antd';
import { FullscreenOutlined, FullscreenExitOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import './DynamicDashboard.css';

const DynamicDashboard = () => {
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const [dashboardId, setDashboardId] = useState(routeId || searchParams.get('id'));
  const [dashboard, setDashboard] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const paramId = routeId || searchParams.get('id');
    setDashboardId(paramId);
  }, [routeId, searchParams]);

  // 加载大屏配置
  useEffect(() => {
    if (!dashboardId) {
      fetchDefaultDashboard();
      return;
    }
    loadDashboard(dashboardId);
  }, [dashboardId]);

  // 加载默认可用大屏（无参数时选第一个启用的大屏）
  const fetchDefaultDashboard = async () => {
    setLoading(true);
    try {
      const response = await api.get('/dashboards');
      const list = response.data.data || [];
      const active = list.find(item => item.isActive) || list[0];

      if (active) {
        setDashboardId(active.id);
      } else {
        message.warning('暂无可用数据大屏');
        setDashboard(null);
        setData(null);
      }
    } catch (error) {
      console.error('加载大屏列表失败:', error);
      message.error('加载大屏列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载数据大屏配置
  const loadDashboard = async targetId => {
    setLoading(true);
    try {
      const response = await api.get(`/dashboards/${targetId}`);
      setDashboard(response.data.data);
      await loadDashboardData(response.data.data);
    } catch (error) {
      console.error('加载大屏失败:', error);
      message.error('加载大屏失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载大屏数据
  const loadDashboardData = async (dashboardConfig) => {
    try {
      setLoading(true);

      // 根据数据源加载数据
      let dataUrl = '';
      switch (dashboardConfig.dataSource) {
        case 'projects':
          dataUrl = '/api/projects/dashboard/stats';
          break;
        case 'sales':
          dataUrl = '/api/sales/dashboard/stats';
          break;
        case 'inventory':
          dataUrl = '/api/inventory/dashboard/stats';
          break;
        default:
          dataUrl = `/api/${dashboardConfig.dataSource}/stats`;
      }

      const response = await api.get(dataUrl.replace('/api', ''));
      setData(response.data?.data ?? response.data);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 手动刷新
  const handleRefresh = () => {
    if (dashboard) {
      loadDashboardData(dashboard);
    }
  };

  // 自动刷新
  useEffect(() => {
    if (!dashboard) return;

    const interval = setInterval(() => {
      loadDashboardData(dashboard);
    }, dashboard.refreshInterval || 10000);

    return () => clearInterval(interval);
  }, [dashboard]);

  // 根据图表类型生成图表
  const renderChart = (chartType, chartData) => {
    const chartOptions = {
      pie: {
        title: { text: '数据分布' },
        tooltip: { trigger: 'item' },
        legend: { orient: 'vertical', left: 'left' },
        series: [
          {
            type: 'pie',
            radius: '50%',
            data: Object.entries(chartData || {}).map(([key, value]) => ({
              name: key,
              value: value,
            })),
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
          },
        ],
      },
      bar: {
        title: { text: '数据统计' },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category' },
        yAxis: { type: 'value' },
        series: [
          {
            type: 'bar',
            data: Array.isArray(chartData) ? chartData : Object.values(chartData || {}),
          },
        ],
      },
      line: {
        title: { text: '趋势分析' },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category' },
        yAxis: { type: 'value' },
        series: [
          {
            type: 'line',
            data: Array.isArray(chartData) ? chartData : Object.values(chartData || {}),
          },
        ],
      },
      radar: {
        title: { text: '多维度分析' },
        radar: {
          indicator: Object.keys(chartData || {}).map(key => ({
            name: key,
            max: 100,
          })),
        },
        series: [
          {
            type: 'radar',
            data: [
              {
                value: Object.values(chartData || {}),
                name: '数据',
              },
            ],
          },
        ],
      },
    };

    return chartOptions[chartType] || chartOptions.pie;
  };

  if (!dashboard) {
    return (
      <Layout className="dynamic-dashboard">
        <Empty description="大屏不存在" />
      </Layout>
    );
  }

  const chartTypes = dashboard.chartType ? dashboard.chartType.split(',') : [];

  return (
    <Layout className={`dynamic-dashboard ${fullscreen ? 'fullscreen' : ''}`}>
      <Layout.Header className="dashboard-header">
        <div className="dashboard-info">
          <h1>{dashboard.name}</h1>
          <p>{dashboard.description}</p>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
          >
            刷新
          </Button>
          <Button
            icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            onClick={() => setFullscreen(!fullscreen)}
          >
            {fullscreen ? '退出全屏' : '全屏'}
          </Button>
        </Space>
      </Layout.Header>

      <Layout.Content className="dashboard-content">
        <Spin spinning={loading}>
          {data ? (
            <div className="charts-grid">
              {chartTypes.map((chartType, index) => {
                // 根据配置确定使用哪个字段的数据
                let chartData = data;

                if (chartType === 'pie' && data.statusStats) {
                  chartData = data.statusStats;
                } else if (chartType === 'bar' && data.progressDistribution) {
                  chartData = data.progressDistribution;
                } else if (chartType === 'radar' && data.priorityStats) {
                  chartData = data.priorityStats;
                }

                const option = renderChart(chartType, chartData);

                return (
                  <div key={index} className="chart-item">
                    <ReactECharts
                      option={option}
                      style={{ height: '400px', width: '100%' }}
                      opts={{ renderer: 'canvas' }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty description="暂无数据" />
          )}
        </Spin>

        <div className="dashboard-footer">
          <p>最后更新: {dayjs().format('YYYY-MM-DD HH:mm:ss')}</p>
        </div>
      </Layout.Content>
    </Layout>
  );
};

export default DynamicDashboard;
