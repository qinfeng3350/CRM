import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  TreeSelect,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { departmentService } from '../../services/departmentService';
import { userService } from '../../services/userService';
import { dingTalkService } from '../../services/dingTalkService';

const { Option } = Select;
const { TextArea } = Input;

const DepartmentManagement = () => {
  const [departments, setDepartments] = useState([]);
  const [departmentTree, setDepartmentTree] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadDepartments();
    loadUsers();
  }, []);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const response = await departmentService.getDepartments();
      if (response.success) {
        setDepartments(response.data || []);
      }
      
      const treeResponse = await departmentService.getDepartmentTree();
      if (treeResponse.success) {
        setDepartmentTree(treeResponse.data || []);
      }
    } catch (error) {
      message.error('加载部门列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await userService.getUsers();
      if (response.success) {
        setUsers(Array.isArray(response.data) ? response.data : (response.data?.data || []));
      }
    } catch (error) {
      console.error('加载用户列表失败:', error);
    }
  };

  const handleAdd = () => {
    setEditingDepartment(null);
    setModalVisible(true);
    form.resetFields();
  };

  const handleEdit = (record) => {
    setEditingDepartment(record);
    setModalVisible(true);
    form.setFieldsValue({
      ...record,
      parentId: record.parentId || undefined,
      managerId: record.managerId || undefined,
    });
  };

  const handleDelete = async (id) => {
    try {
      await departmentService.deleteDepartment(id);
      message.success('删除成功');
      loadDepartments();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingDepartment) {
        await departmentService.updateDepartment(editingDepartment.id, values);
        message.success('更新成功');
      } else {
        await departmentService.createDepartment(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadDepartments();
    } catch (error) {
      message.error(error.message || (editingDepartment ? '更新失败' : '创建失败'));
    }
  };

  const handleSyncFromDingTalk = async () => {
    try {
      setSyncing(true);
      // 使用统一同步接口，同时同步部门和用户
      const response = await dingTalkService.syncOrganization();
      if (response.success) {
        const { data } = response;
        const deptMsg = `部门：共${data.departments.total}个，新增${data.departments.created}个，更新${data.departments.updated}个`;
        const userMsg = `用户：共${data.users.total}人，新增${data.users.created}人，更新${data.users.updated}人`;
        message.success(
          `同步完成！${deptMsg}；${userMsg}`,
          8
        );
        if (data.departments.errors && data.departments.errors.length > 0) {
          console.warn('部门同步过程中的错误:', data.departments.errors);
          message.warning(`有 ${data.departments.errors.length} 个部门同步失败，请查看控制台`);
        }
        if (data.users.errors && data.users.errors.length > 0) {
          console.warn('用户同步过程中的错误:', data.users.errors);
          message.warning(`有 ${data.users.errors.length} 个用户同步失败，请查看控制台`);
        }
        // 刷新部门列表
        loadDepartments();
      } else {
        message.error(response.message || '同步失败');
      }
    } catch (error) {
      console.error('同步组织架构失败:', error);
      message.error(error.response?.data?.message || error.message || '同步失败，请检查钉钉配置');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearSyncData = async () => {
    try {
      setClearing(true);
      const response = await dingTalkService.clearSyncData();
      if (response.success) {
        // 后端立即返回，显示启动消息
        message.success('清除任务已启动，正在后台执行...', 3);
        
        // 延迟刷新部门列表，给后台任务一些时间
        setTimeout(() => {
          loadDepartments();
        }, 2000);
        
        // 如果响应中有数据，显示详细信息
        if (response.data && response.data.status === 'processing') {
          console.log('清除任务已在后台启动');
        }
      } else {
        message.error(response.message || '清除失败');
      }
    } catch (error) {
      // 如果是超时错误，但后端可能已经处理了，只显示警告
      if (error.message && error.message.includes('timeout')) {
        message.warning('请求超时，但清除任务可能已在后台启动，请稍后刷新查看结果', 5);
        setTimeout(() => {
          loadDepartments();
        }, 3000);
      } else {
        console.error('清除钉钉同步数据失败:', error);
        message.error(error.response?.data?.message || error.message || '清除失败');
      }
    } finally {
      setClearing(false);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '部门名称', dataIndex: 'name', key: 'name' },
    { title: '部门编码', dataIndex: 'code', key: 'code' },
    {
      title: '上级部门',
      dataIndex: 'parentId',
      key: 'parentId',
      render: (parentId) => {
        if (!parentId) return '-';
        const parent = departments.find(d => d.id === parentId);
        return parent?.name || parentId;
      },
    },
    {
      title: '部门经理',
      dataIndex: 'managerId',
      key: 'managerId',
      render: (managerId) => {
        if (!managerId) return '-';
        const manager = users.find(u => u.id === managerId);
        return manager?.name || managerId;
      },
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <span style={{ color: isActive ? 'green' : 'gray' }}>
          {isActive ? '启用' : '禁用'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="组织架构管理"
      extra={
        <Space>
          <Button 
            icon={<SyncOutlined />} 
            onClick={handleSyncFromDingTalk}
            loading={syncing}
            disabled={syncing || clearing}
          >
            同步钉钉组织架构
          </Button>
          <Popconfirm
            title="确定要清除所有钉钉同步数据吗？"
            description="此操作将删除所有通过钉钉同步创建的部门、用户关联和用户。此操作不可恢复！"
            onConfirm={handleClearSyncData}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button 
              danger
              icon={<DeleteOutlined />} 
              loading={clearing}
              disabled={syncing || clearing}
            >
              清除钉钉同步数据
            </Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增部门
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={departments}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingDepartment ? '编辑部门' : '新增部门'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" />
          </Form.Item>

          <Form.Item name="code" label="部门编码">
            <Input placeholder="请输入部门编码" />
          </Form.Item>

          <Form.Item name="parentId" label="上级部门">
            <TreeSelect
              treeData={departmentTree}
              placeholder="请选择上级部门"
              allowClear
              fieldNames={{ label: 'name', value: 'id', children: 'children' }}
            />
          </Form.Item>

          <Form.Item name="managerId" label="部门经理">
            <Select placeholder="请选择部门经理" allowClear showSearch>
              {users.map((user) => (
                <Option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入部门描述" />
          </Form.Item>

          <Form.Item name="isActive" label="状态" initialValue={true}>
            <Select>
              <Option value={true}>启用</Option>
              <Option value={false}>禁用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default DepartmentManagement;

