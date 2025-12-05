import { Breadcrumb } from 'antd';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { HomeOutlined } from '@ant-design/icons';

// 路由到中文名称的映射
const routeNameMap = {
  '/dashboard': '工作台',
  '/todos': '我的待办',
  '/customers': '客户管理',
  '/products': '产品管理',
  '/opportunities': '商机管理',
  '/contracts': '合同管理',
  '/quotations': '报价单管理',
  '/projects': '项目管理',
  '/projects/dashboard': '项目数据大屏',
  '/marketing': '市场管理',
  '/marketing/leads': '线索管理',
  '/marketing/campaigns': '市场活动',
  '/service': '服务管理',
  '/sales': '销售管理',
  '/analytics': '数据分析',
  '/finance': '财务管理',
  '/finance/payments': '回款管理',
  '/finance/invoices': '发票管理',
  '/inventory': '采购进销存',
  '/inventory/suppliers': '供应商管理',
  '/inventory/purchase-orders': '采购单',
  '/inventory/inbound-orders': '入库单',
  '/inventory/outbound-orders': '出库单',
  '/inventory/inventory': '库存管理',
  '/inventory/receipts': '收款单',
  '/inventory/payment-records': '付款单',
  '/inventory/purchase-details': '进货明细',
  '/inventory/sales-details': '销售明细',
  '/inventory/low-stock': '需进货物品统计',
  '/inventory/receivables-stats': '应收统计',
  '/inventory/payables-stats': '应付统计',
  '/inventory/supplier-reconciliation': '供应商对账',
  '/inventory/customer-reconciliation': '客户对账',
  '/inventory/profit-analysis': '收支利润分析',
  '/inventory/sales-profit-analysis': '销售利润分析',
  '/system': '系统管理',
  '/system/users': '用户角色',
  '/system/approval-workflows': '审批流程配置',
  '/system/workflow-designer': '流程设计器',
  '/system/departments': '组织架构',
  '/system/transfer-rules': '流转规则配置',
  '/system/dingtalk': '钉钉集成',
  '/system/api-docs': 'API文档',
  '/system/user-guide': '操作说明',
  '/system/help': '帮助文档',
  '/profile': '个人信息',
};

// 详情页名称映射（用于动态路由）
const detailPageNames = {
  'customers': '客户详情',
  'opportunities': '商机详情',
  'contracts': '合同详情',
  'quotations': '报价单详情',
  'projects': '项目详情',
  'todos': '待办详情',
  'suppliers': '供应商详情',
  'purchase-orders': '采购单详情',
  'inbound-orders': '入库单详情',
  'outbound-orders': '出库单详情',
  'receipts': '收款单详情',
  'payment-records': '付款单详情',
};

const BreadcrumbNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();

  // 生成面包屑路径
  const generateBreadcrumbs = () => {
    const pathnames = location.pathname.split('/').filter((x) => x);
    const breadcrumbs = [];

    // 首页
    breadcrumbs.push({
      title: (
        <span
          onClick={() => navigate('/dashboard')}
          style={{ cursor: 'pointer' }}
        >
          <HomeOutlined style={{ marginRight: 4 }} />
          首页
        </span>
      ),
    });

    // 处理路径段
    let currentPath = '';
    pathnames.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathnames.length - 1;

      // 检查是否是数字ID（动态路由参数）
      if (segment.match(/^\d+$/)) {
        // 这是一个ID参数，需要获取父路径的名称
        const parentPath = pathnames.slice(0, index).join('/');
        const parentRoute = parentPath ? `/${parentPath}` : '';
        
        // 获取详情页名称
        const detailName = detailPageNames[parentPath] || '详情';
        breadcrumbs.push({
          title: isLast ? (
            detailName
          ) : (
            <span
              onClick={() => navigate(currentPath)}
              style={{ cursor: 'pointer' }}
            >
              {detailName}
            </span>
          ),
        });
      } else {
        // 普通路径段 - 将英文路径转换为中文
        let routeName = routeNameMap[currentPath];
        if (!routeName) {
          // 如果没有映射，尝试将英文转换为中文
          const segmentMap = {
            'inventory': '采购进销存',
            'suppliers': '供应商管理',
            'purchase-orders': '采购单',
            'inbound-orders': '入库单',
            'outbound-orders': '出库单',
            'receipts': '收款单',
            'payment-records': '付款单',
            'purchase-details': '进货明细',
            'sales-details': '销售明细',
            'low-stock': '需进货物品统计',
            'receivables-stats': '应收统计',
            'payables-stats': '应付统计',
            'supplier-reconciliation': '供应商对账',
            'customer-reconciliation': '客户对账',
            'profit-analysis': '收支利润分析',
            'sales-profit-analysis': '销售利润分析',
          };
          routeName = segmentMap[segment] || segment;
        }
        breadcrumbs.push({
          title: isLast ? (
            routeName
          ) : (
            <span
              onClick={() => navigate(currentPath)}
              style={{ cursor: 'pointer' }}
            >
              {routeName}
            </span>
          ),
        });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  // 如果只有一个首页，不显示面包屑
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <Breadcrumb
      items={breadcrumbs}
      style={{ marginBottom: 16 }}
    />
  );
};

export default BreadcrumbNav;

