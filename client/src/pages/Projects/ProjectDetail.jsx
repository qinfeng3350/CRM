import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Progress,
  message,
  Tag,
  Popconfirm,
  Tabs,
  Table,
  Timeline,
  Descriptions,
  Row,
  Col,
  Statistic,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  DashboardOutlined,
  PartitionOutlined,
} from '@ant-design/icons';
import { projectService } from '../../services/projectService';
import { userService } from '../../services/userService';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [phases, setPhases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [phaseModalVisible, setPhaseModalVisible] = useState(false);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [editingPhase, setEditingPhase] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState(null);
  const [phaseForm] = Form.useForm();
  const [taskForm] = Form.useForm();

  useEffect(() => {
    loadProject();
    loadPhases();
    loadTasks();
    loadUsers();
  }, [id]);

  const loadProject = async () => {
    setLoading(true);
    try {
      const response = await projectService.getProject(id);
      if (response.success) {
        setProject(response.data);
      }
    } catch (error) {
      message.error('加载项目详情失败');
    } finally {
      setLoading(false);
    }
  };

  const loadPhases = async () => {
    try {
      const response = await projectService.getPhases(id);
      if (response.success) {
        setPhases(response.data || []);
      }
    } catch (error) {
      message.error('加载项目板块失败');
    }
  };

  const loadTasks = async (phaseId = null) => {
    try {
      const response = await projectService.getTasks(id, phaseId ? { phaseId } : {});
      if (response.success) {
        setTasks(response.data || []);
      }
    } catch (error) {
      message.error('加载任务失败');
    }
  };

  const loadUsers = async () => {
    try {
      const response = await userService.getUsers({ limit: 1000 });
      if (response.success) {
        setUsers(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载用户列表失败');
    }
  };

  const handleAddPhase = () => {
    setEditingPhase(null);
    setPhaseModalVisible(true);
    phaseForm.resetFields();
    phaseForm.setFieldsValue({
      status: 'not_started',
      progress: 0,
    });
  };

  const handleEditPhase = (record) => {
    setEditingPhase(record);
    setPhaseModalVisible(true);
    phaseForm.setFieldsValue({
      ...record,
      startDate: record.startDate ? dayjs(record.startDate) : null,
      expectedEndDate: record.expectedEndDate ? dayjs(record.expectedEndDate) : null,
      actualEndDate: record.actualEndDate ? dayjs(record.actualEndDate) : null,
    });
  };

  const handleDeletePhase = async (phaseId) => {
    try {
      await projectService.deletePhase(id, phaseId);
      message.success('删除成功');
      loadPhases();
      loadTasks();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handlePhaseSubmit = async (values) => {
    try {
      const data = {
        ...values,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : null,
        expectedEndDate: values.expectedEndDate ? values.expectedEndDate.format('YYYY-MM-DD') : null,
        actualEndDate: values.actualEndDate ? values.actualEndDate.format('YYYY-MM-DD') : null,
      };
      if (editingPhase) {
        await projectService.updatePhase(id, editingPhase.id, data);
        message.success('更新成功');
      } else {
        await projectService.createPhase(id, data);
        message.success('创建成功');
      }
      setPhaseModalVisible(false);
      loadPhases();
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const handleAddTask = (phaseId = null) => {
    setEditingTask(null);
    setSelectedPhaseId(phaseId);
    setTaskModalVisible(true);
    taskForm.resetFields();
    taskForm.setFieldsValue({
      phaseId: phaseId || null,
      status: 'todo',
      priority: 'medium',
      progress: 0,
    });
  };

  const handleEditTask = (record) => {
    setEditingTask(record);
    setTaskModalVisible(true);
    taskForm.setFieldsValue({
      ...record,
      startDate: record.startDate ? dayjs(record.startDate) : null,
      expectedEndDate: record.expectedEndDate ? dayjs(record.expectedEndDate) : null,
      actualEndDate: record.actualEndDate ? dayjs(record.actualEndDate) : null,
    });
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await projectService.deleteTask(id, taskId);
      message.success('删除成功');
      loadTasks(selectedPhaseId);
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleTaskSubmit = async (values) => {
    try {
      const data = {
        ...values,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : null,
        expectedEndDate: values.expectedEndDate ? values.expectedEndDate.format('YYYY-MM-DD') : null,
        actualEndDate: values.actualEndDate ? values.actualEndDate.format('YYYY-MM-DD') : null,
      };
      if (editingTask) {
        await projectService.updateTask(id, editingTask.id, data);
        message.success('更新成功');
      } else {
        await projectService.createTask(id, data);
        message.success('创建成功');
      }
      setTaskModalVisible(false);
      loadTasks(selectedPhaseId);
    } catch (error) {
      message.error(error.message || '操作失败');
    }
  };

  const statusOptions = [
    { value: 'not_started', label: '未开始', color: 'default' },
    { value: 'in_progress', label: '进行中', color: 'processing' },
    { value: 'completed', label: '已完成', color: 'success' },
    { value: 'blocked', label: '已阻塞', color: 'error' },
  ];

  const taskStatusOptions = [
    { value: 'todo', label: '待办', color: 'default' },
    { value: 'in_progress', label: '进行中', color: 'processing' },
    { value: 'review', label: '审核中', color: 'warning' },
    { value: 'completed', label: '已完成', color: 'success' },
    { value: 'blocked', label: '已阻塞', color: 'error' },
  ];

  const priorityOptions = [
    { value: 'low', label: '低', color: 'default' },
    { value: 'medium', label: '中', color: 'blue' },
    { value: 'high', label: '高', color: 'orange' },
    { value: 'urgent', label: '紧急', color: 'red' },
  ];

  const phaseColumns = [
    { title: '序号', dataIndex: 'phaseNumber', key: 'phaseNumber', width: 80 },
    { title: '板块名称', dataIndex: 'name', key: 'name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const option = statusOptions.find((s) => s.value === status);
        return <Tag color={option?.color}>{option?.label || status}</Tag>;
      },
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress) => <Progress percent={progress || 0} size="small" />,
    },
    {
      title: '负责人',
      dataIndex: 'ownerId',
      key: 'ownerId',
      render: (ownerId) => {
        const user = users.find((u) => u.id === ownerId);
        return user?.name || '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditPhase(record)}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => handleAddTask(record.id)}>
            添加任务
          </Button>
          <Popconfirm title="确定要删除吗？" onConfirm={() => handleDeletePhase(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const taskColumns = [
    { title: '任务编号', dataIndex: 'taskNumber', key: 'taskNumber' },
    { title: '任务名称', dataIndex: 'name', key: 'name' },
    {
      title: '所属板块',
      dataIndex: 'phaseId',
      key: 'phaseId',
      render: (phaseId) => {
        const phase = phases.find((p) => p.id === phaseId);
        return phase?.name || '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const option = taskStatusOptions.find((s) => s.value === status);
        return <Tag color={option?.color}>{option?.label || status}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => {
        const option = priorityOptions.find((p) => p.value === priority);
        return <Tag color={option?.color}>{option?.label || priority}</Tag>;
      },
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress) => <Progress percent={progress || 0} size="small" />,
    },
    {
      title: '负责人',
      dataIndex: 'assigneeId',
      key: 'assigneeId',
      render: (assigneeId) => {
        const user = users.find((u) => u.id === assigneeId);
        return user?.name || '-';
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditTask(record)}>
            编辑
          </Button>
          <Popconfirm title="确定要删除吗？" onConfirm={() => handleDeleteTask(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'phases',
      label: '项目板块',
      children: (
        <>
          <div style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPhase}>
              新增板块
            </Button>
          </div>
          <Table columns={phaseColumns} dataSource={phases} rowKey="id" />
        </>
      ),
    },
    {
      key: 'tasks',
      label: '任务列表',
      children: (
        <>
          <div style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAddTask()}>
              新增任务
            </Button>
          </div>
          <Table columns={taskColumns} dataSource={tasks} rowKey="id" />
        </>
      ),
    },
  ];

  if (loading) {
    return <Card><div>加载中...</div></Card>;
  }

  if (!project) {
    return <Card><div>项目不存在</div></Card>;
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')}>
              返回
            </Button>
            <Button
              type="primary"
              icon={<DashboardOutlined />}
              onClick={() => navigate(`/projects/${id}/dashboard`)}
            >
              数据大屏
            </Button>
            <Button
              icon={<PartitionOutlined />}
              onClick={() => navigate(`/projects/${id}/gantt`)}
            >
              项目甘特图
            </Button>
          </Space>
        </div>

        <Descriptions title={project.name} bordered column={2}>
          <Descriptions.Item label="项目编号">{project.projectNumber}</Descriptions.Item>
          <Descriptions.Item label="项目状态">
            <Tag color="blue">{project.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="项目进度" span={2}>
            <Progress percent={project.progress || 0} />
          </Descriptions.Item>
          <Descriptions.Item label="开始日期">
            {project.startDate ? dayjs(project.startDate).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="预期结束日期">
            {project.expectedEndDate ? dayjs(project.expectedEndDate).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <Tabs items={tabItems} />
      </Card>

      {/* 板块编辑Modal */}
      <Modal
        title={editingPhase ? '编辑板块' : '新增板块'}
        open={phaseModalVisible}
        onCancel={() => setPhaseModalVisible(false)}
        onOk={() => phaseForm.submit()}
        width={700}
      >
        <Form form={phaseForm} layout="vertical" onFinish={handlePhaseSubmit}>
          <Form.Item name="name" label="板块名称" rules={[{ required: true, message: '请输入板块名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="板块描述">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="not_started">
            <Select>
              {statusOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="progress" label="进度(%)" initialValue={0}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ownerId" label="负责人">
            <Select placeholder="请选择负责人" allowClear>
              {users.map((user) => (
                <Option key={user.id} value={user.id}>
                  {user.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="startDate" label="开始日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expectedEndDate" label="预期结束日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="budget" label="预算">
            <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 任务编辑Modal */}
      <Modal
        title={editingTask ? '编辑任务' : '新增任务'}
        open={taskModalVisible}
        onCancel={() => setTaskModalVisible(false)}
        onOk={() => taskForm.submit()}
        width={700}
      >
        <Form form={taskForm} layout="vertical" onFinish={handleTaskSubmit}>
          <Form.Item name="phaseId" label="所属板块">
            <Select placeholder="请选择板块" allowClear>
              {phases.map((phase) => (
                <Option key={phase.id} value={phase.id}>
                  {phase.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="任务描述">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="todo">
            <Select>
              {taskStatusOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select>
              {priorityOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="progress" label="进度(%)" initialValue={0}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="assigneeId" label="负责人">
            <Select placeholder="请选择负责人" allowClear>
              {users.map((user) => (
                <Option key={user.id} value={user.id}>
                  {user.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="startDate" label="开始日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expectedEndDate" label="预期结束日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="estimatedHours" label="预估工时">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProjectDetail;

