const { connectDB, pool } = require('../config/database');
const DingTalkConfig = require('../models/DingTalkConfig');

async function updateConfig() {
  try {
    await connectDB();
    console.log('正在更新钉钉配置...\n');

    // 扫码登录应用配置
    const qrLoginAppKey = 'dingqqsqf8zlp67zccaw';
    const qrLoginAppSecret = 'pK-DqWC1mPHtL9yr9aCY08lCUCBAfZNWM91jYgogNkEKBlQxahBPos0qnbyUEXe9';
    
    // 企业内部应用配置（如果有的话）
    const appKey = 'dings4qylrxgdgsanqdg'; // 原来的企业内部应用AppKey
    const appSecret = 'T03d8zfKy2LggHuzmd91fnm-A9QBB1IQseTtGoB6sLVYUlDBZH6dppRMGnmIOI4p'; // 原来的AppSecret
    const corpId = 'ding989414ba5e7be680ffe93478753d9884';
    const agentId = '4109639870';

    await DingTalkConfig.upsert({
      enabled: true,
      appKey: appKey,
      appSecret: appSecret,
      qrLoginAppKey: qrLoginAppKey,
      qrLoginAppSecret: qrLoginAppSecret,
      corpId: corpId,
      agentId: agentId,
    });

    console.log('✅ 钉钉配置已更新');
    console.log('   扫码登录应用AppKey:', qrLoginAppKey);
    console.log('   企业内部应用AppKey:', appKey);
    console.log('   CorpId:', corpId);
    console.log('   AgentId:', agentId);
    console.log('\n配置已保存，可以重新测试扫码登录了。\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ 更新配置失败:', error.message);
    if (error.stack) {
      console.error('详细错误:', error.stack);
    }
    process.exit(1);
  }
}

updateConfig();

