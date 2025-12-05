import { Card, Typography, Timeline, Space, Tag, Alert, Divider, List } from 'antd';
import {
  QuestionCircleOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const HelpDocumentation = () => {
  const faqData = [
    {
      question: '如何登录系统？',
      answer: '使用您的邮箱和密码在登录页面登录。如果忘记密码，请联系系统管理员重置。首次登录后建议修改密码。',
    },
    {
      question: '如何认领客户？',
      answer: '在客户管理页面的公海客户列表中，找到要认领的客户，点击"认领"按钮。认领后客户会出现在您的私海客户列表中。',
    },
    {
      question: '商机状态有哪些？',
      answer: '商机状态包括：新建、已联系、已确认、提案中、谈判中、成交、失败、已退回。您可以根据业务进展更新商机状态。',
    },
    {
      question: '如何创建合同？',
      answer: '在商机详情页，如果商机状态为"成交"，可以点击"创建合同"按钮。也可以直接在合同管理页面创建合同，然后关联商机和客户。',
    },
    {
      question: '合同审批流程是什么？',
      answer: '创建合同后，选择状态为"待审批"，提交审批。系统管理员或销售经理会收到审批通知，审批通过后可以签订合同。',
    },
    {
      question: '项目数据大屏如何查看？',
      answer: '在项目管理菜单中点击"项目数据大屏"，系统会进入全屏模式。大屏会实时显示项目统计数据，每10秒自动刷新。点击返回按钮可退出。',
    },
    {
      question: '如何更新项目进度？',
      answer: '在项目列表中找到项目，点击"编辑"按钮，修改进度百分比。也可以在项目详情页面直接更新进度。进度更新后会自动记录日志。',
    },
    {
      question: '如何导出数据？',
      answer: '在数据分析页面，可以选择导出报表。支持导出为Excel、CSV或PDF格式。也可以在各个列表页面使用浏览器的打印功能。',
    },
    {
      question: '数据权限如何控制？',
      answer: '普通用户只能访问自己负责的数据和公海数据。销售经理和管理员可以访问所有数据。具体权限由系统管理员配置。',
    },
    {
      question: '如何联系技术支持？',
      answer: '如有技术问题，请联系技术支持：墨枫，QQ：1731813927。也可以联系系统管理员。',
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Card>
        <Title level={2}>帮助文档</Title>

        <Alert
          message="系统使用指南"
          description="本文档提供系统的详细使用说明和常见问题解答。如有其他问题，请联系系统管理员。"
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        <Title level={3}>系统功能介绍</Title>
        <Timeline
          items={[
            {
              color: 'green',
              children: (
                <>
                  <Title level={5}>客户管理</Title>
                  <Paragraph>
                    管理客户信息，包括公海客户和私海客户。支持客户认领、退回、分类管理等功能。
                    可以查看客户详情、跟进记录、关联商机等。
                  </Paragraph>
                </>
              ),
            },
            {
              color: 'blue',
              children: (
                <>
                  <Title level={5}>商机管理</Title>
                  <Paragraph>
                    跟踪销售商机，从新建到成交全流程管理。支持商机状态更新、转移、销售漏斗查看等功能。
                    可以设置预期成交金额和日期，跟踪商机进展。
                  </Paragraph>
                </>
              ),
            },
            {
              color: 'orange',
              children: (
                <>
                  <Title level={5}>合同管理</Title>
                  <Paragraph>
                    管理合同全生命周期，包括合同创建、审批、签订、执行等。支持合同产品管理、
                    审批流程、签订管理等。可以查看合同统计和金额统计。
                  </Paragraph>
                </>
              ),
            },
            {
              color: 'purple',
              children: (
                <>
                  <Title level={5}>项目管理</Title>
                  <Paragraph>
                    管理项目信息，跟踪项目进度。支持项目状态管理、进度更新、阶段管理、任务管理等。
                    可以查看项目数据大屏，了解项目整体情况。支持项目日志记录。
                  </Paragraph>
                </>
              ),
            },
            {
              color: 'cyan',
              children: (
                <>
                  <Title level={5}>数据分析</Title>
                  <Paragraph>
                    提供销售分析、客户分析、商机分析、合同分析等功能。支持自定义报表生成和数据导出。
                    可以查看各种统计图表和数据趋势。
                  </Paragraph>
                </>
              ),
            },
          ]}
        />

        <Divider />

        <Title level={3}>项目数据大屏使用说明</Title>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            message="数据大屏特性"
            description="项目数据大屏采用全屏横向布局，实时显示项目统计数据。支持自动刷新和动态图表展示。"
            type="success"
            showIcon
          />

          <Card title="功能说明" size="small">
            <List
              dataSource={[
                '全屏展示：自动隐藏侧边栏和顶部栏，充分利用屏幕空间',
                '实时更新：数据每10秒自动刷新，时间戳每秒更新',
                '核心指标：显示预期项目、进行中项目、待签订项目、已完结项目数量',
                '金额统计：显示项目签订总金额和平均进度',
                '图表展示：项目状态分布饼图、进度分布柱状图、优先级分布图',
                '人员排行：显示项目人员排行榜，包括项目数量和项目总金额',
                '数据列表：待签订项目列表和最近更新的项目列表，支持自动滚动',
                '返回功能：点击返回按钮或退出全屏按钮可返回项目列表',
              ]}
              renderItem={(item) => (
                <List.Item>
                  <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                  {item}
                </List.Item>
              )}
            />
          </Card>

          <Card title="操作步骤" size="small">
            <Space direction="vertical" size="small">
              <Text><Text strong>步骤1：</Text>在项目管理菜单中点击"项目数据大屏"</Text>
              <Text><Text strong>步骤2：</Text>系统自动进入全屏模式，显示项目统计数据</Text>
              <Text><Text strong>步骤3：</Text>查看各项指标和图表，数据会自动刷新</Text>
              <Text><Text strong>步骤4：</Text>点击左上角"返回"按钮或右上角退出全屏按钮退出大屏</Text>
            </Space>
          </Card>
        </Space>

        <Divider />

        <Title level={3}>常见问题解答</Title>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {faqData.map((item, index) => (
            <Card key={index} size="small">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <QuestionCircleOutlined style={{ color: '#1890ff', marginRight: '8px' }} />
                  <Text strong style={{ fontSize: '16px' }}>{item.question}</Text>
                </div>
                <div style={{ paddingLeft: '24px' }}>
                  <InfoCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                  <Text>{item.answer}</Text>
                </div>
              </Space>
            </Card>
          ))}
        </Space>

        <Divider />

        <Title level={3}>最佳实践</Title>
        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
              <Text strong>客户管理</Text>
              <Paragraph style={{ marginTop: '8px', marginLeft: '24px' }}>
                • 及时更新客户信息，保持数据准确性<br />
                • 定期跟进客户，记录跟进记录<br />
                • 合理使用公海和私海，提高客户分配效率<br />
                • 及时更新客户分类，便于数据分析
              </Paragraph>
            </div>

            <div>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
              <Text strong>商机管理</Text>
              <Paragraph style={{ marginTop: '8px', marginLeft: '24px' }}>
                • 及时更新商机状态，跟踪商机进展<br />
                • 设置合理的预期成交金额和日期<br />
                • 定期查看销售漏斗，了解商机分布<br />
                • 成交后及时创建合同
              </Paragraph>
            </div>

            <div>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
              <Text strong>项目管理</Text>
              <Paragraph style={{ marginTop: '8px', marginLeft: '24px' }}>
                • 及时更新项目进度，保持数据实时性<br />
                • 定期查看项目数据大屏，了解项目整体情况<br />
                • 记录项目日志，便于跟踪项目进展<br />
                • 合理设置项目优先级，提高管理效率
              </Paragraph>
            </div>

            <div>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
              <Text strong>数据分析</Text>
              <Paragraph style={{ marginTop: '8px', marginLeft: '24px' }}>
                • 定期查看数据分析报表，了解业务情况<br />
                • 利用数据大屏展示项目整体情况<br />
                • 导出数据报表，进行深度分析<br />
                • 根据数据分析结果调整业务策略
              </Paragraph>
            </div>
          </Space>
        </Card>

        <Divider />

        <Title level={3}>注意事项</Title>
        <Alert
          message="重要提示"
          description={
            <Space direction="vertical" size="small">
              <Text>• 删除操作不可恢复，请谨慎操作</Text>
              <Text>• 定期备份重要数据</Text>
              <Text>• 不要泄露登录账号和密码</Text>
              <Text>• 及时更新个人信息</Text>
              <Text>• 遇到问题及时联系系统管理员</Text>
            </Space>
          }
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
        />

        <Divider />

        <Title level={3}>版本信息</Title>
        <Card>
          <Space direction="vertical" size="small">
            <Text><Text strong>系统版本：</Text>墨枫CRM系统 v1.0</Text>
            <Text><Text strong>更新时间：</Text>2024年</Text>
            <Text><Text strong>技术支持：</Text>墨枫</Text>
            <Text><Text strong>QQ：</Text>1731813927</Text>
          </Space>
        </Card>
      </Card>
    </div>
  );
};

export default HelpDocumentation;

