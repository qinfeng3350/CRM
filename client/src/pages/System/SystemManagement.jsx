import { Card, Tabs, Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { systemService } from '../../services/systemService';
import { userService } from '../../services/userService';
import { departmentService } from '../../services/departmentService';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const { Option } = Select;

const SystemManagement = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userPagination, setUserPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [roleForm] = Form.useForm();
  const [userForm] = Form.useForm();
  
  // 根据路径确定默认激活的 Tab
  const getDefaultActiveKey = () => {
    if (location.pathname === '/system/users') {
      return 'users';
    }
    return 'roles';
  };
  
  const [activeTab, setActiveTab] = useState(getDefaultActiveKey());

  useEffect(() => {
    loadRoles();
    loadUsers(userPagination.current, userPagination.pageSize);
    loadDepartments();
  }, []);

  useEffect(() => {
    // 当路径变化时，更新激活的 Tab
    const newActiveKey = getDefaultActiveKey();
    if (newActiveKey !== activeTab) {
      setActiveTab(newActiveKey);
    }
  }, [location.pathname]);

  const loadRoles = async () => {
    setLoading(true);
    try {
      const response = await systemService.getRoles();
      if (response.success) {
        const rolesList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        setRoles(rolesList);
      } else {
        message.error(response.message || '加载角色列表失败');
      }
    } catch (error) {
      message.error(error.message || '加载角色列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      console.log(`[loadUsers] 开始加载用户列表，页码: ${page}, 每页: ${pageSize}`);
      const response = await systemService.getUsers(page, pageSize);
      console.log('[loadUsers] 完整响应:', JSON.stringify(response, null, 2));
      
      if (response && response.success) {
        // 处理数据：可能是数组，也可能是对象
        let usersList = [];
        if (Array.isArray(response.data)) {
          usersList = response.data;
        } else if (response.data && Array.isArray(response.data.data)) {
          usersList = response.data.data;
        } else if (response.data && response.data.length !== undefined) {
          usersList = response.data;
        }
        
        console.log(`[loadUsers] 解析后的用户列表: ${usersList.length} 个用户`, usersList);
        setUsers(usersList);
        
        // 更新分页信息
        let total = usersList.length;
        if (response.pagination && response.pagination.total !== undefined) {
          total = response.pagination.total;
        } else if (response.data && response.data.pagination && response.data.pagination.total !== undefined) {
          total = response.data.pagination.total;
        }
        
        setUserPagination({
          current: response.pagination?.page || response.data?.pagination?.page || page,
          pageSize: response.pagination?.limit || response.data?.pagination?.limit || pageSize,
          total: total,
        });
        
        console.log(`[loadUsers] 分页信息设置完成: 当前页 ${page}, 每页 ${pageSize}, 总数 ${total}`);
      } else {
        console.error('[loadUsers] 响应失败:', response?.message || '未知错误');
        message.error(response?.message || '加载用户列表失败');
      }
    } catch (error) {
      console.error('[loadUsers] 加载失败:', error);
      const errorMsg = error.response?.data?.message || error.message || '加载用户列表失败';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      console.log('[loadDepartments] 开始加载部门列表...');
      const response = await departmentService.getDepartments();
      console.log('[loadDepartments] 响应:', response);
      
      if (response.success) {
        const deptList = Array.isArray(response.data) ? response.data : [];
        console.log(`[loadDepartments] 获取到 ${deptList.length} 个部门`);
        setDepartments(deptList);
      } else {
        console.error('[loadDepartments] 响应失败:', response.message);
      }
    } catch (error) {
      console.error('[loadDepartments] 加载失败:', error);
      const errorMsg = error.response?.data?.message || error.message || '加载部门列表失败';
      // 不显示错误消息，避免干扰用户（部门列表不是必须的）
      console.error('加载部门列表失败:', errorMsg);
    }
  };

  const handleAddRole = () => {
    setEditingRole(null);
    setRoleModalVisible(true);
    roleForm.resetFields();
  };

  const handleEditRole = (record) => {
    setEditingRole(record);
    setRoleModalVisible(true);
    roleForm.setFieldsValue({
      name: record.name,
      description: record.description,
    });
  };

  const handleDeleteRole = async (id) => {
    try {
      await systemService.deleteRole(id);
      message.success('删除成功');
      loadRoles();
    } catch (error) {
      message.error(error.message || '删除失败');
    }
  };

  const handleRoleSubmit = async (values) => {
    try {
      if (editingRole) {
        await systemService.updateRole(editingRole.id, values);
        message.success('更新成功');
      } else {
        await systemService.createRole(values);
        message.success('创建成功');
      }
      setRoleModalVisible(false);
      loadRoles();
    } catch (error) {
      message.error(error.message || (editingRole ? '更新失败' : '创建失败'));
    }
  };

  const handleEditUser = (record) => {
    setEditingUser(record);
    setUserModalVisible(true);
    userForm.setFieldsValue({
      name: record.name,
      email: record.email,
      role: record.role,
      department: record.department || '',
      phone: record.phone || '',
      status: record.status || 'active',
    });
  };

  const handleUserSubmit = async (values) => {
    try {
      await userService.updateUser(editingUser.id, values);
      message.success('更新成功');
      setUserModalVisible(false);
      loadUsers();
    } catch (error) {
      message.error(error.message || '更新失败');
    }
  };

  const roleColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '角色名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditRole(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => handleDeleteRole(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const roleOptions = [
    { value: 'admin', label: '管理员' },
    { value: 'sales_manager', label: '销售经理' },
    { value: 'sales', label: '销售' },
    { value: 'service', label: '客服' },
    { value: 'marketing', label: '市场' },
  ];

  const userColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role) => {
        const roleOption = roleOptions.find(r => r.value === role);
        return roleOption ? roleOption.label : role;
      },
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      render: (department) => department || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <span style={{ color: status === 'active' ? '#52c41a' : '#999' }}>
          {status === 'active' ? '启用' : '禁用'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditUser(record)}>
          编辑
        </Button>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'roles',
      label: '角色管理',
      children: (
        <>
          <div style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddRole}>
              新增角色
            </Button>
          </div>
          <Table
            columns={roleColumns}
            dataSource={roles}
            rowKey="id"
            loading={loading}
          />
        </>
      ),
    },
    {
      key: 'users',
      label: `用户管理${userPagination.total > 0 ? ` (总计: ${userPagination.total})` : ''}`,
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, color: '#666' }}>
              共 <strong style={{ color: '#1890ff' }}>{userPagination.total}</strong> 个用户
            </div>
          </div>
          <Table
            columns={userColumns}
            dataSource={users}
            rowKey="id"
            loading={loading}
            pagination={{
              current: userPagination.current,
              pageSize: userPagination.pageSize,
              total: userPagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
              pageSizeOptions: ['10', '20', '50', '100'],
              onChange: (page, pageSize) => {
                loadUsers(page, pageSize);
              },
              onShowSizeChange: (current, size) => {
                loadUsers(1, size);
              },
            }}
          />
        </>
      ),
    },
  ];

  const handleTabChange = (key) => {
    setActiveTab(key);
    if (key === 'users') {
      navigate('/system/users');
    } else {
      navigate('/system');
    }
  };

  return (
    <>
      <Card>
        <Tabs activeKey={activeTab} onChange={handleTabChange} items={tabItems} />
      </Card>

      {/* 角色编辑Modal */}
      <Modal
        title={editingRole ? '编辑角色' : '新增角色'}
        open={roleModalVisible}
        onCancel={() => setRoleModalVisible(false)}
        onOk={() => roleForm.submit()}
      >
        <Form form={roleForm} layout="vertical" onFinish={handleRoleSubmit}>
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="请输入角色名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea rows={3} placeholder="请输入角色描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 用户编辑Modal */}
      <Modal
        title="编辑用户"
        open={userModalVisible}
        onCancel={() => setUserModalVisible(false)}
        onOk={() => userForm.submit()}
        width={600}
      >
        <Form form={userForm} layout="vertical" onFinish={handleUserSubmit}>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              {roleOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="department"
            label="部门"
          >
            <Select placeholder="请选择部门" allowClear>
              {departments.map(dept => (
                <Option key={dept.id} value={dept.name}>
                  {dept.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="phone"
            label="电话"
          >
            <Input placeholder="请输入电话" />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Option value="active">启用</Option>
              <Option value="inactive">禁用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default SystemManagement;
