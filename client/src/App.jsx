import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import './styles/responsive.css';
import MainLayout from './components/Layout/MainLayout';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import DingTalkCallback from './pages/Auth/DingTalkCallback';
import DingTalkLogin from './pages/Auth/DingTalkLogin';
import DingTalkQRLogin from './pages/Auth/DingTalkQRLogin';
import Dashboard from './pages/Dashboard/Dashboard';
import CustomerList from './pages/Customers/CustomerList';
import OpportunityList from './pages/Opportunities/OpportunityList';
import ContractList from './pages/Contracts/ContractList';
import MarketingLeads from './pages/Marketing/MarketingLeads';
import MarketingCampaigns from './pages/Marketing/MarketingCampaigns';
import ServiceTickets from './pages/Service/ServiceTickets';
import SalesTeam from './pages/Sales/SalesTeam';
import Analytics from './pages/Analytics/Analytics';
import SystemManagement from './pages/System/SystemManagement';
import MyTodos from './pages/Todos/MyTodos';
import TodoDetail from './pages/Todos/TodoDetail';
import ApprovalWorkflows from './pages/System/ApprovalWorkflows';
import ProductList from './pages/Products/ProductList';
import CustomerDetail from './pages/Customers/CustomerDetail';
import OpportunityDetail from './pages/Opportunities/OpportunityDetail';
import ContractDetail from './pages/Contracts/ContractDetail';
import QuotationList from './pages/Quotations/QuotationList';
import QuotationDetail from './pages/Quotations/QuotationDetail';
import CategoryManagement from './pages/Products/CategoryManagement';
import DepartmentManagement from './pages/System/DepartmentManagement';
import PaymentManagement from './pages/Finance/PaymentManagement';
import InvoiceManagement from './pages/Finance/InvoiceManagement';
import Profile from './pages/Profile/Profile';
import ProjectList from './pages/Projects/ProjectList';
import ProjectDetail from './pages/Projects/ProjectDetail';
import ProjectDashboard from './pages/Projects/ProjectDashboard';
import ProjectsDashboard from './pages/Projects/ProjectsDashboard';
import ProjectGantt from './pages/Projects/ProjectGantt';
import TransferRules from './pages/System/TransferRules';
import SupplierList from './pages/Inventory/SupplierList';
import PurchaseOrderList from './pages/Inventory/PurchaseOrderList';
import InboundOrderList from './pages/Inventory/InboundOrderList';
import OutboundOrderList from './pages/Inventory/OutboundOrderList';
import InventoryList from './pages/Inventory/InventoryList';
import ReceiptList from './pages/Inventory/ReceiptList';
import PaymentRecordList from './pages/Inventory/PaymentRecordList';
import PurchaseDetails from './pages/Inventory/PurchaseDetails';
import SalesDetails from './pages/Inventory/SalesDetails';
import LowStockProducts from './pages/Inventory/LowStockProducts';
import ReceivablesStats from './pages/Inventory/ReceivablesStats';
import PayablesStats from './pages/Inventory/PayablesStats';
import SupplierReconciliation from './pages/Inventory/SupplierReconciliation';
import CustomerReconciliation from './pages/Inventory/CustomerReconciliation';
import ProfitAnalysis from './pages/Inventory/ProfitAnalysis';
import SalesProfitAnalysis from './pages/Inventory/SalesProfitAnalysis';
import ApiDocumentation from './pages/System/ApiDocumentation';
import UserGuide from './pages/System/UserGuide';
import HelpDocumentation from './pages/System/HelpDocumentation';
import DingTalkIntegration from './pages/System/DingTalkIntegration';
import WorkflowDesigner from './pages/System/WorkflowDesigner';

dayjs.locale('zh-cn');

// 路由守卫
const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  // 发送日志到后端（用于钉钉客户端内调试）
  const logToBackend = (level, message, data = null) => {
    console.log(`[${level}] ${message}`, data || '');
    try {
      // 检查 fetch 是否可用
      if (typeof fetch === 'undefined' || typeof fetch !== 'function') {
        return; // fetch 不可用，直接返回
      }
      const fetchPromise = fetch('/api/dingtalk/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, message, data }),
      });
      // 确保 fetch 返回的是 Promise
      if (fetchPromise && typeof fetchPromise.catch === 'function') {
        fetchPromise.catch(() => {}); // 静默失败，避免阻塞
      }
    } catch (e) {
      // 忽略错误
    }
  };
  
  // 记录 App 组件加载
  useEffect(() => {
    logToBackend('info', '✅ App 组件已加载');
    logToBackend('info', '   当前路由:', window.location.pathname);
  }, []);
  
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/dingtalk/login" element={<DingTalkLogin />} />
          <Route path="/auth/dingtalk/qrlogin" element={<DingTalkQRLogin />} />
          <Route path="/auth/dingtalk/callback" element={<DingTalkCallback />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="customers" element={<CustomerList />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="products" element={<ProductList />} />
            <Route path="products/categories" element={<CategoryManagement />} />
            <Route path="opportunities" element={<OpportunityList />} />
            <Route path="opportunities/:id" element={<OpportunityDetail />} />
            <Route path="contracts" element={<ContractList />} />
            <Route path="contracts/:id" element={<ContractDetail />} />
            <Route path="quotations" element={<QuotationList />} />
            <Route path="quotations/:id" element={<QuotationDetail />} />
            <Route path="marketing/leads" element={<MarketingLeads />} />
            <Route path="marketing/campaigns" element={<MarketingCampaigns />} />
            <Route path="service" element={<ServiceTickets />} />
            <Route path="sales" element={<SalesTeam />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="todos" element={<MyTodos />} />
            <Route path="todos/:id" element={<TodoDetail />} />
            <Route path="system" element={<SystemManagement />} />
            <Route path="system/users" element={<SystemManagement />} />
            <Route path="system/approval-workflows" element={<ApprovalWorkflows />} />
            <Route path="system/workflow-designer" element={<WorkflowDesigner />} />
            <Route path="system/departments" element={<DepartmentManagement />} />
            <Route path="system/transfer-rules" element={<TransferRules />} />
            <Route path="system/api-docs" element={<ApiDocumentation />} />
            <Route path="system/user-guide" element={<UserGuide />} />
            <Route path="system/help" element={<HelpDocumentation />} />
            <Route path="system/dingtalk" element={<DingTalkIntegration />} />
            <Route path="finance/payments" element={<PaymentManagement />} />
            <Route path="finance/invoices" element={<InvoiceManagement />} />
            <Route path="projects" element={<ProjectList />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="projects/:id/dashboard" element={<ProjectDashboard />} />
            <Route path="projects/:id/gantt" element={<ProjectGantt />} />
            <Route path="projects/dashboard" element={<ProjectsDashboard />} />
            <Route path="inventory/suppliers" element={<SupplierList />} />
            <Route path="inventory/purchase-orders" element={<PurchaseOrderList />} />
            <Route path="inventory/inbound-orders" element={<InboundOrderList />} />
            <Route path="inventory/outbound-orders" element={<OutboundOrderList />} />
            <Route path="inventory/inventory" element={<InventoryList />} />
            <Route path="inventory/receipts" element={<ReceiptList />} />
            <Route path="inventory/payment-records" element={<PaymentRecordList />} />
            <Route path="inventory/purchase-details" element={<PurchaseDetails />} />
            <Route path="inventory/sales-details" element={<SalesDetails />} />
            <Route path="inventory/low-stock" element={<LowStockProducts />} />
            <Route path="inventory/receivables-stats" element={<ReceivablesStats />} />
            <Route path="inventory/payables-stats" element={<PayablesStats />} />
            <Route path="inventory/supplier-reconciliation" element={<SupplierReconciliation />} />
            <Route path="inventory/customer-reconciliation" element={<CustomerReconciliation />} />
            <Route path="inventory/profit-analysis" element={<ProfitAnalysis />} />
            <Route path="inventory/sales-profit-analysis" element={<SalesProfitAnalysis />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
