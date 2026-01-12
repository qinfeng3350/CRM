import { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, message, Drawer } from 'antd';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import BreadcrumbNav from './BreadcrumbNav';
import Logo from './Logo';
import './MainLayout.css';
import {
  UserOutlined,
  TeamOutlined,
  DollarOutlined,
  FileTextOutlined,
  CustomerServiceOutlined,
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ShopOutlined,
  RocketOutlined,
  FileDoneOutlined,
  ContainerOutlined,
  AccountBookOutlined,
  FundProjectionScreenOutlined,
  InboxOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content, Footer } = Layout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedKey = location.pathname.startsWith('/dashboard/view')
    ? '/dashboard/view'
    : location.pathname;

  // 检测是否为移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setCollapsed(false);
        setMobileMenuVisible(false);
      } else {
        setCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const dashboardMenuChildren = [
    { key: '/dashboard/view', label: '数据大屏展示' },
    ...(user.role === 'admin' || user.role === 'sales_manager'
      ? [{ key: '/admin/dashboards', label: '数据大屏管理' }]
      : []),
  ];

  const menuItems = [
    {
      key: '/dashboard',
      icon: <BarChartOutlined />,
      label: '工作台',
    },
    {
      key: '/todos',
      icon: <FileDoneOutlined />,
      label: '我的待办',
    },
    {
      key: '/customers',
      icon: <TeamOutlined />,
      label: '客户管理',
    },
    {
      key: '/products',
      icon: <ShopOutlined />,
      label: '产品管理',
    },
    {
      key: '/opportunities',
      icon: <DollarOutlined />,
      label: '商机管理',
    },
    {
      key: '/contracts',
      icon: <FileTextOutlined />,
      label: '合同管理',
    },
    {
      key: '/quotations',
      icon: <ContainerOutlined />,
      label: '报价单管理',
    },
    {
      key: 'projects-menu',
      icon: <FundProjectionScreenOutlined />,
      label: '项目管理',
      children: [
        { key: '/projects', label: '项目列表' },
        { key: '/projects/dashboard', label: '项目数据大屏' },
      ],
    },
    {
      key: '/marketing',
      icon: <RocketOutlined />,
      label: '市场管理',
      children: [
        { key: '/marketing/leads', label: '线索管理' },
        { key: '/marketing/campaigns', label: '市场活动' },
      ],
    },
    {
      key: '/service',
      icon: <CustomerServiceOutlined />,
      label: '服务管理',
    },
    {
      key: '/sales',
      icon: <ShopOutlined />,
      label: '销售管理',
    },
    {
      key: '/analytics',
      icon: <BarChartOutlined />,
      label: '数据分析',
    },
    {
      key: '/data-screens',
      icon: <FundProjectionScreenOutlined />,
      label: '数据大屏',
      children: dashboardMenuChildren,
    },
    {
      key: '/finance',
      icon: <AccountBookOutlined />,
      label: '财务管理',
      children: [
        { key: '/finance/payments', label: '回款管理' },
        { key: '/finance/invoices', label: '发票管理' },
      ],
    },
    {
      key: '/inventory',
      icon: <DatabaseOutlined />,
      label: '采购进销存',
      children: [
        { key: '/inventory/suppliers', label: '供应商管理' },
        { key: '/inventory/purchase-orders', label: '采购单' },
        { key: '/inventory/inbound-orders', label: '入库单' },
        { key: '/inventory/outbound-orders', label: '出库单' },
        { key: '/inventory/inventory', label: '库存管理' },
        { key: '/inventory/receipts', label: '收款单' },
        { key: '/inventory/payment-records', label: '付款单' },
        { key: '/inventory/purchase-details', label: '进货明细' },
        { key: '/inventory/sales-details', label: '销售明细' },
        { key: '/inventory/low-stock', label: '需进货物品统计' },
        { key: '/inventory/receivables-stats', label: '应收统计' },
        { key: '/inventory/payables-stats', label: '应付统计' },
        { key: '/inventory/supplier-reconciliation', label: '供应商对账' },
        { key: '/inventory/customer-reconciliation', label: '客户对账' },
        { key: '/inventory/profit-analysis', label: '收支利润分析' },
        { key: '/inventory/sales-profit-analysis', label: '销售利润分析' },
      ],
    },
    ...(user.role === 'admin' || user.role === 'sales_manager'
      ? [
    {
      key: '/system',
      icon: <SettingOutlined />,
      label: '系统管理',
      children: [
        { key: '/system/users', label: '用户角色' },
        { key: '/system/approval-workflows', label: '审批流程配置' },
        { key: '/system/workflow-designer', label: '流程设计器' },
        { key: '/system/departments', label: '组织架构' },
        { key: '/system/transfer-rules', label: '流转规则配置' },
        { key: '/system/dingtalk', label: '钉钉集成' },
        { key: '/system/api-docs', label: 'API文档' },
        { key: '/system/user-guide', label: '操作说明' },
        { key: '/system/help', label: '帮助文档' },
      ],
    },
        ]
      : []),
  ];


  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    message.success('退出登录成功');
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => navigate('/profile'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
    if (isMobile) {
      setMobileMenuVisible(false);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile ? (
        <Sider trigger={null} collapsible collapsed={collapsed} theme="light" width={200}>
          <div
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: '1px solid #f0f0f0',
              padding: '0 12px',
            }}
          >
            <Logo collapsed={collapsed} />
          </div>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Sider>
      ) : (
        <Drawer
          title={<Logo collapsed={false} />}
          placement="left"
          onClose={() => setMobileMenuVisible(false)}
          open={mobileMenuVisible}
          bodyStyle={{ padding: 0 }}
          width={250}
        >
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Drawer>
      )}
      <Layout>
        <Header
          style={{
            padding: isMobile ? '0 12px' : '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            position: isMobile ? 'fixed' : 'relative',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 999,
            width: '100%',
            height: isMobile ? 48 : 64,
            lineHeight: isMobile ? '48px' : '64px',
          }}
        >
          <div
            style={{ fontSize: 18, cursor: 'pointer' }}
            onClick={() => {
              if (isMobile) {
                setMobileMenuVisible(true);
              } else {
                setCollapsed(!collapsed);
              }
            }}
          >
            {isMobile ? <MenuUnfoldOutlined /> : (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
          </div>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} size={isMobile ? 'small' : 'default'} />
              {!isMobile && <span>{user.name || '用户'}</span>}
            </div>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: isMobile ? '48px 0 0 0' : '24px',
            padding: isMobile ? 8 : 24,
            background: '#fff',
            minHeight: isMobile ? 'calc(100vh - 48px)' : 280,
          }}
        >
          <BreadcrumbNav />
          <Outlet />
        </Content>
        <Footer style={{ textAlign: 'center', padding: isMobile ? '8px 12px' : '12px 24px' }}>
          <div style={{ fontSize: isMobile ? '11px' : '12px', color: '#999' }}>
            墨枫CRM系统 v1.0 | 技术支持：墨枫 | QQ：1731813927
          </div>
        </Footer>
      </Layout>
    </Layout>
  );
};

export default MainLayout;

