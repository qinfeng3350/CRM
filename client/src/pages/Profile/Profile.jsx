import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Space, Avatar, Descriptions } from 'antd';
import { UserOutlined, SaveOutlined } from '@ant-design/icons';
import { authService } from '../../services/authService';

const Profile = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await authService.getProfile();
      if (response.success) {
        setUser(response.data);
        form.setFieldsValue({
          name: response.data.name,
          email: response.data.email,
          phone: response.data.phone || '',
          department: response.data.department || '',
        });
      }
    } catch (error) {
      message.error('加载个人信息失败');
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const response = await authService.updateProfile(values);
      if (response.success) {
        message.success('更新成功');
        setEditing(false);
        // 更新本地存储的用户信息
        const localUser = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({
          ...localUser,
          ...values,
        }));
        loadProfile();
      }
    } catch (error) {
      message.error(error.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Avatar size={64} icon={<UserOutlined />} />
        <div>
          <h2 style={{ margin: 0 }}>{user?.name || '用户'}</h2>
          <p style={{ margin: 0, color: '#999' }}>{user?.email || ''}</p>
        </div>
      </div>

      {!editing ? (
        <>
          <Descriptions bordered column={2}>
            <Descriptions.Item label="用户名">{user?.username || '-'}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{user?.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="姓名">{user?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="电话">{user?.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="角色">
              {user?.role === 'admin' ? '管理员' :
               user?.role === 'sales_manager' ? '销售经理' :
               user?.role === 'sales' ? '销售' :
               user?.role === 'service' ? '客服' :
               user?.role === 'marketing' ? '市场' : user?.role || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="部门">{user?.department || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {user?.status === 'active' ? '正常' : '禁用'}
            </Descriptions.Item>
          </Descriptions>
          <div style={{ marginTop: 24 }}>
            <Button type="primary" icon={<UserOutlined />} onClick={() => setEditing(true)}>
              编辑个人信息
            </Button>
          </div>
        </>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ maxWidth: 600 }}
        >
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
            <Input placeholder="请输入邮箱" disabled />
          </Form.Item>
          <Form.Item
            name="phone"
            label="电话"
          >
            <Input placeholder="请输入电话" />
          </Form.Item>
          <Form.Item
            name="department"
            label="部门"
          >
            <Input placeholder="请输入部门" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading}>
                保存
              </Button>
              <Button onClick={() => {
                setEditing(false);
                form.setFieldsValue({
                  name: user?.name,
                  email: user?.email,
                  phone: user?.phone || '',
                  department: user?.department || '',
                });
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      )}
    </Card>
  );
};

export default Profile;

