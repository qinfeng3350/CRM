import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  ProjectOutlined,
  OrderedListOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Timeline,
  message,
} from 'antd';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import { projectService } from '../../services/projectService';

const typeLabels = {
  project: '项目',
  phase: '阶段',
  task: '任务',
};

const typeColors = {
  project: '#1f78b4',
  phase: '#33a02c',
  task: '#ff7f00',
};

const statusColors = {
  not_started: 'default',
  planning: 'default',
  todo: 'default',
  in_progress: 'processing',
  review: 'warning',
  blocked: 'error',
  on_hold: 'warning',
  completed: 'success',
};

const ProjectGantt = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [ganttData, setGanttData] = useState(null);

  useEffect(() => {
    loadGanttData();
  }, [id]);

  const loadGanttData = async () => {
    setLoading(true);
    try {
      const response = await projectService.getProjectGantt(id);
      if (response.success) {
        setGanttData(response.data);
      } else {
        message.error(response.message || '加载甘特图数据失败');
      }
    } catch (error) {
      console.error('加载甘特图失败:', error);
      message.error('加载甘特图数据失败');
    } finally {
      setLoading(false);
    }
  };

  const chartOption = useMemo(() => {
    if (!ganttData || !ganttData.rows || !ganttData.rows.length) {
      return null;
    }

    const rowsWithDates = ganttData.rows.filter(
      (row) => row.startDate && row.endDate
    );

    if (!rowsWithDates.length) {
      return null;
    }

    const categories = rowsWithDates.map(
      (row) => `${typeLabels[row.type] || '任务'}｜${row.name}`
    );

    const dataSource = rowsWithDates.map((row, index) => ({
      value: [
        index,
        dayjs(row.startDate).valueOf(),
        dayjs(row.endDate).valueOf(),
        row.progress || 0,
      ],
      itemStyle: {
        color: typeColors[row.type] || typeColors.task,
      },
      rowMeta: row,
    }));

    const minTime = Math.min(...dataSource.map((item) => item.value[1]));
    const maxTime = Math.max(...dataSource.map((item) => item.value[2]));

    const renderItem = (params, api) => {
      const categoryIndex = api.value(0);
      const start = api.coord([api.value(1), categoryIndex]);
      const end = api.coord([api.value(2), categoryIndex]);
      const height = api.size([0, 1])[1] * 0.6;
      const rectShape = echarts.graphic.clipRectByRect(
        {
          x: start[0],
          y: start[1] - height / 2,
          width: Math.max(end[0] - start[0], 2),
          height,
        },
        {
          x: params.coordSys.x,
          y: params.coordSys.y,
          width: params.coordSys.width,
          height: params.coordSys.height,
        }
      );
      return (
        rectShape && {
          type: 'rect',
          shape: rectShape,
          style: api.style(),
        }
      );
    };

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const row = params.data.rowMeta;
          return `
            <div>
              <div><strong>${row.name}</strong></div>
              <div>类型：${typeLabels[row.type] || '任务'}</div>
              <div>状态：${row.status || '未知'}</div>
              <div>开始：${dayjs(row.startDate).format('YYYY-MM-DD')}</div>
              <div>结束：${dayjs(row.endDate).format('YYYY-MM-DD')}</div>
              <div>进度：${row.progress || 0}%</div>
            </div>
          `;
        },
      },
      grid: {
        top: 40,
        left: 120,
        right: 40,
        bottom: 40,
      },
      xAxis: {
        type: 'time',
        min: minTime,
        max: maxTime,
        axisLabel: {
          formatter: (value) => dayjs(value).format('MM-DD'),
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
          },
        },
      },
      yAxis: {
        type: 'category',
        data: categories,
        inverse: true,
        axisLabel: {
          formatter: (value) => value,
          width: 250,
          overflow: 'truncate',
        },
      },
      series: [
        {
          type: 'custom',
          renderItem,
          encode: {
            x: [1, 2],
            y: 0,
          },
          data: dataSource,
        },
      ],
    };
  }, [ganttData]);

  const renderTimeline = () => {
    if (!ganttData || !ganttData.rows) return null;
    const milestones = ganttData.rows
      .filter((row) => row.type !== 'task')
      .sort((a, b) => dayjs(a.startDate).valueOf() - dayjs(b.startDate).valueOf());

    if (!milestones.length) {
      return <Empty description="暂无里程碑数据" />;
    }

    return (
      <Timeline mode="left">
        {milestones.map((item) => (
          <Timeline.Item
            key={item.id}
            color={typeColors[item.type] ? undefined : 'blue'}
          >
            <Space direction="vertical">
              <span style={{ fontWeight: 500 }}>{item.name}</span>
              <div>
                <Tag color="default">{typeLabels[item.type] || '任务'}</Tag>
                <Tag color={statusColors[item.status] || 'default'}>
                  {item.status || '未知'}
                </Tag>
              </div>
              <div>开始：{item.startDate ? dayjs(item.startDate).format('YYYY-MM-DD') : '未设置'}</div>
              <div>结束：{item.endDate ? dayjs(item.endDate).format('YYYY-MM-DD') : '未设置'}</div>
            </Space>
          </Timeline.Item>
        ))}
      </Timeline>
    );
  };

  const renderSummary = () => {
    if (!ganttData) return null;
    const { summary, project } = ganttData;
    return (
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="项目进度"
              value={project?.progress || 0}
              suffix="%"
              prefix={<ProjectOutlined />}
            />
            <div style={{ marginTop: 12 }}>
              <Tag color={statusColors[project?.status] || 'processing'}>
                {project?.status || '进行中'}
              </Tag>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="阶段数量"
              value={summary?.phases || 0}
              prefix={<OrderedListOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="任务总数"
              value={summary?.tasks || 0}
              prefix={<OrderedListOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="已完成任务"
              value={summary?.completedTasks || 0}
              suffix={`/ ${summary?.tasks || 0}`}
            />
            <div style={{ marginTop: 8 }}>进行中：{summary?.inProgressTasks || 0}</div>
          </Card>
        </Col>
      </Row>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
        <Button icon={<ReloadOutlined />} onClick={loadGanttData}>
          刷新
        </Button>
      </Space>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : !ganttData ? (
        <Empty description="暂无甘特图数据" />
      ) : (
        <>
          {renderSummary()}
          <Row gutter={16}>
            <Col xs={24} lg={16}>
              <Card
                title={`${ganttData.project?.name || '项目'} - 甘特图`}
                extra={
                  <Tag color="blue">
                    时间范围：{ganttData.project?.startDate ? dayjs(ganttData.project.startDate).format('YYYY-MM-DD') : '未设置'} ~{' '}
                    {ganttData.project?.endDate ? dayjs(ganttData.project.endDate).format('YYYY-MM-DD') : '未设置'}
                  </Tag>
                }
              >
                {chartOption ? (
                  <ReactECharts style={{ height: 500 }} option={chartOption} notMerge lazyUpdate />
                ) : (
                  <Empty description="暂无可展示的时间区间" />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="项目里程碑">
                {renderTimeline()}
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default ProjectGantt;


