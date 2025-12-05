import { Card, Typography, Steps, Collapse, Tag, Space, Alert, Divider } from 'antd';
import {
  CheckCircleOutlined,
  UserOutlined,
  TeamOutlined,
  DollarOutlined,
  FileTextOutlined,
  FundProjectionScreenOutlined,
  BarChartOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

const UserGuide = () => {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Card>
        <Title level={2}>系统操作说明</Title>
        
        <Alert
          message="欢迎使用墨枫CRM系统"
          description="本系统提供完整的客户关系管理功能，包括客户管理、商机管理、合同管理、项目管理等功能。"
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Title level={3}>快速开始</Title>
        <Steps
          direction="vertical"
          size="small"
          items={[
            {
              title: '登录系统',
              status: 'finish',
              icon: <UserOutlined />,
              description: '使用您的邮箱和密码登录系统，首次使用请联系管理员创建账号。',
            },
            {
              title: '了解工作台',
              status: 'finish',
              icon: <BarChartOutlined />,
              description: '工作台提供系统概览，包括客户总数、商机总数、合同总数等关键指标。',
            },
            {
              title: '管理客户',
              status: 'finish',
              icon: <TeamOutlined />,
              description: '在客户管理中创建和管理客户信息，可以从公海认领客户到私海。',
            },
            {
              title: '跟踪商机',
              status: 'finish',
              icon: <DollarOutlined />,
              description: '在商机管理中创建商机，跟踪销售进度，查看销售漏斗。',
            },
            {
              title: '签订合同',
              status: 'finish',
              icon: <FileTextOutlined />,
              description: '商机成交后，可以创建合同并提交审批，审批通过后可以签订合同。',
            },
            {
              title: '项目管理',
              status: 'finish',
              icon: <FundProjectionScreenOutlined />,
              description: '创建项目并跟踪项目进度，查看项目数据大屏了解项目整体情况。',
            },
          ]}
        />

        <Divider />

        <Title level={3}>功能模块说明</Title>
        <Collapse defaultActiveKey={['1']} ghost>
          <Panel header="1. 工作台" key="1">
            <Space direction="vertical" size="small">
              <Text>• 查看系统关键指标统计</Text>
              <Text>• 查看最近客户信息</Text>
              <Text>• 快速了解系统整体情况</Text>
            </Space>
          </Panel>

          <Panel header="2. 客户管理" key="2">
            <Space direction="vertical" size="small">
              <Text><Tag color="blue">公海客户</Tag> - 未分配给任何销售人员的客户</Text>
              <Text><Tag color="green">私海客户</Tag> - 已分配给当前用户的客户</Text>
              <Text>• 可以从公海认领客户到私海</Text>
              <Text>• 可以退回客户到公海</Text>
              <Text>• 支持客户分类：潜在客户、意向客户、正式客户、流失客户</Text>
            </Space>
          </Panel>

          <Panel header="3. 商机管理" key="3">
            <Space direction="vertical" size="small">
              <Text>• 创建商机并设置预期成交金额和日期</Text>
              <Text>• 跟踪商机状态：新建、已联系、已确认、提案中、谈判中、成交、失败</Text>
              <Text>• 查看销售漏斗，了解商机分布情况</Text>
              <Text>• 可以转移商机给其他销售人员</Text>
            </Space>
          </Panel>

          <Panel header="4. 合同管理" key="4">
            <Space direction="vertical" size="small">
              <Text>• 从成交的商机创建合同</Text>
              <Text>• 提交合同审批流程</Text>
              <Text>• 审批通过后签订合同</Text>
              <Text>• 跟踪合同执行状态</Text>
              <Text>• 查看合同统计信息</Text>
            </Space>
          </Panel>

          <Panel header="5. 项目管理" key="5">
            <Space direction="vertical" size="small">
              <Text>• 创建项目并关联客户和合同</Text>
              <Text>• 设置项目状态：规划中、进行中、暂停、已完成、已取消</Text>
              <Text>• 更新项目进度</Text>
              <Text>• 查看项目数据大屏，了解项目整体情况</Text>
              <Text>• 管理项目阶段和任务</Text>
            </Space>
          </Panel>

          <Panel header="6. 项目数据大屏" key="6">
            <Space direction="vertical" size="small">
              <Text><Tag color="red">全屏展示</Tag> - 自动隐藏侧边栏，全屏展示数据</Text>
              <Text>• 实时显示项目统计数据</Text>
              <Text>• 查看预期项目、进行中项目、待签订项目、已完结项目数量</Text>
              <Text>• 查看项目签订总金额和平均进度</Text>
              <Text>• 查看项目状态分布、进度分布、优先级分布图表</Text>
              <Text>• 查看项目人员排行榜</Text>
              <Text>• 查看待签订项目列表和最近更新的项目</Text>
              <Text>• 数据每10秒自动刷新</Text>
              <Text>• 点击返回按钮或退出全屏按钮可返回项目列表</Text>
            </Space>
          </Panel>

          <Panel header="7. 报价单管理" key="7">
            <Space direction="vertical" size="small">
              <Text>• 创建报价单并关联商机</Text>
              <Text>• 添加产品到报价单</Text>
              <Text>• 查看报价单状态和历史记录</Text>
            </Space>
          </Panel>

          <Panel header="8. 财务管理" key="8">
            <Space direction="vertical" size="small">
              <Text>• <Tag color="green">回款管理</Tag> - 记录和跟踪合同回款情况</Text>
              <Text>• <Tag color="blue">发票管理</Tag> - 管理发票开具和记录</Text>
            </Space>
          </Panel>

          <Panel header="9. 市场管理" key="9">
            <Space direction="vertical" size="small">
              <Text>• <Tag color="orange">线索管理</Tag> - 管理市场线索，可以转化为客户或商机</Text>
              <Text>• <Tag color="purple">市场活动</Tag> - 创建和管理市场活动，跟踪活动效果</Text>
            </Space>
          </Panel>

          <Panel header="10. 服务管理" key="10">
            <Space direction="vertical" size="small">
              <Text>• 创建工单处理客户服务请求</Text>
              <Text>• 分配工单给服务人员</Text>
              <Text>• 跟踪工单处理状态</Text>
              <Text>• 记录服务解决方案</Text>
            </Space>
          </Panel>

          <Panel header="11. 数据分析" key="11">
            <Space direction="vertical" size="small">
              <Text>• 查看销售数据分析</Text>
              <Text>• 查看客户分析报告</Text>
              <Text>• 查看商机分析</Text>
              <Text>• 查看合同分析</Text>
              <Text>• 生成自定义报表</Text>
            </Space>
          </Panel>

          <Panel header="12. 系统管理（管理员）" key="12">
            <Space direction="vertical" size="small">
              <Text>• <Tag color="red">用户角色</Tag> - 管理用户账号和角色权限</Text>
              <Text>• <Tag color="orange">审批流程配置</Tag> - 配置合同等审批流程</Text>
              <Text>• <Tag color="green">组织架构</Tag> - 管理部门信息</Text>
              <Text>• <Tag color="blue">流转规则配置</Tag> - 配置商机自动流转规则</Text>
              <Text>• <Tag color="purple">API文档</Tag> - 查看系统API接口文档</Text>
              <Text>• <Tag color="cyan">操作说明</Tag> - 查看系统操作说明</Text>
              <Text>• <Tag color="magenta">帮助文档</Tag> - 查看系统帮助文档</Text>
            </Space>
          </Panel>
        </Collapse>

        <Divider />

        <Title level={3}>常见问题</Title>
        <Collapse ghost>
          <Panel header="如何认领公海客户？" key="q1">
            <Paragraph>
              在客户管理页面的公海客户列表中，找到要认领的客户，点击"认领"按钮即可将客户认领到您的私海。
            </Paragraph>
          </Panel>

          <Panel header="如何创建合同？" key="q2">
            <Paragraph>
              有两种方式创建合同：1) 从成交的商机创建合同，在商机详情页点击"创建合同"；2) 直接在合同管理页面点击"新增合同"按钮创建。
            </Paragraph>
          </Panel>

          <Panel header="如何查看项目数据大屏？" key="q3">
            <Paragraph>
              在项目管理菜单中点击"项目数据大屏"，系统会自动进入全屏模式展示项目数据。数据每10秒自动刷新。点击返回按钮可退出大屏模式。
            </Paragraph>
          </Panel>

          <Panel header="商机如何流转？" key="q4">
            <Paragraph>
              商机流转分为手动流转和自动流转。手动流转：在商机详情页点击"转移"按钮；自动流转：系统管理员配置流转规则后，满足条件的商机会自动流转。
            </Paragraph>
          </Panel>

          <Panel header="如何更新项目进度？" key="q5">
            <Paragraph>
              在项目列表中找到要更新的项目，点击"编辑"按钮，修改进度百分比。也可以在项目详情页直接更新进度。
            </Paragraph>
          </Panel>
        </Collapse>

        <Divider />

        <Title level={3}>权限说明</Title>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card size="small">
            <Title level={5}>管理员（admin）</Title>
            <Text>拥有所有权限，可以管理所有数据和系统配置。</Text>
          </Card>
          <Card size="small">
            <Title level={5}>销售经理（sales_manager）</Title>
            <Text>可以管理销售团队数据，查看所有销售相关数据，配置流转规则等。</Text>
          </Card>
          <Card size="small">
            <Title level={5}>销售人员（sales）</Title>
            <Text>只能访问自己负责的客户、商机、合同和项目数据，以及公海数据。</Text>
          </Card>
          <Card size="small">
            <Title level={5}>服务人员（service）</Title>
            <Text>只能访问分配给自己的工单数据。</Text>
          </Card>
          <Card size="small">
            <Title level={5}>市场人员（marketing）</Title>
            <Text>可以管理线索和市场活动数据。</Text>
          </Card>
        </Space>

        <Divider />

        <Title level={3}>联系方式</Title>
        <Paragraph>
          <Space direction="vertical" size="small">
            <Text><Text strong>技术支持：</Text>墨枫</Text>
            <Text><Text strong>QQ：</Text>1731813927</Text>
            <Text>如有问题或建议，请联系技术支持或系统管理员。</Text>
          </Space>
        </Paragraph>
      </Card>
    </div>
  );
};

export default UserGuide;

