const DingTalkConfig = require('../models/DingTalkConfig');
const DingTalkUser = require('../models/DingTalkUser');
const User = require('../models/User');
const Department = require('../models/Department');
const Todo = require('../models/Todo');
const dingTalkService = require('../services/dingTalkService');
const dingTalkStreamService = require('../services/dingTalkStreamService');
const jwt = require('jsonwebtoken');

// 获取钉钉配置
exports.getConfig = async (req, res) => {
  try {
    const config = await DingTalkConfig.find();
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新钉钉配置
exports.updateConfig = async (req, res) => {
  try {
    const config = await DingTalkConfig.upsert(req.body);
    res.json({ success: true, data: config, message: '配置已更新' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取扫码登录所需的最小配置（公开接口，不需要认证）
exports.getQRLoginConfig = async (req, res) => {
  const startTime = Date.now();
  try {
    console.log('[getQRLoginConfig] 开始获取扫码登录配置...');
    
    const config = await DingTalkConfig.findWithSecrets();
    const queryTime = Date.now() - startTime;
    console.log(`[getQRLoginConfig] 数据库查询耗时: ${queryTime}ms`);
    
    if (!config || !config.enabled) {
      console.log('[getQRLoginConfig] 配置未启用或不存在');
      return res.status(400).json({ 
        success: false, 
        message: '钉钉配置未启用，请联系管理员配置' 
      });
    }

    // 优先使用扫码登录应用的AppKey，否则使用企业内部应用的AppKey
    const clientId = config.qrLoginAppKey || config.appKey;
    if (!clientId) {
      console.log('[getQRLoginConfig] AppKey未配置');
      return res.status(400).json({ 
        success: false, 
        message: '钉钉AppKey未配置，请在系统管理 -> 钉钉集成中配置' 
      });
    }

    const totalTime = Date.now() - startTime;
    console.log(`[getQRLoginConfig] 配置获取成功，总耗时: ${totalTime}ms`);
    
    // 只返回扫码登录所需的最小配置，不包含敏感信息
    res.json({
      success: true,
      data: {
        enabled: config.enabled,
        clientId: clientId,
        corpId: config.corpId || null,
      }
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[getQRLoginConfig] 获取配置失败，耗时: ${totalTime}ms`, error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '获取配置失败，请稍后重试' 
    });
  }
};

// 获取钉钉扫码登录二维码URL
exports.getQRCodeUrl = async (req, res) => {
  try {
    const { redirectUri } = req.query;
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const finalRedirectUri = redirectUri || `${baseUrl}/auth/dingtalk/callback`;
    
    const config = await DingTalkConfig.findWithSecrets();
    if (!config || !config.enabled) {
      return res.status(400).json({ 
        success: false, 
        message: '钉钉配置未启用，请联系管理员配置' 
      });
    }

    // 根据文档：企业内部应用也支持扫码登录，直接使用企业内部应用的AppKey
    // 如果配置了扫码登录应用，优先使用（用于外部用户登录）
    // 否则使用企业内部应用的AppKey（企业内部用户扫码登录）
    const qrLoginAppKey = config.qrLoginAppKey || config.appKey;
    
    if (!qrLoginAppKey) {
      return res.status(400).json({ 
        success: false, 
        message: '钉钉AppKey未配置，请在系统管理 -> 钉钉集成中配置' 
      });
    }

    // 钉钉扫码登录URL（使用qrconnect）
    // 根据文档：https://open.dingtalk.com/document/orgapp/tutorial-obtaining-user-personal-information
    // 如果配置了扫码登录应用，使用扫码登录应用的AppKey
    // 否则使用企业内部应用的AppKey（企业内部应用也支持扫码登录）
    // 重要：回调域名必须在钉钉开放平台配置
    // 注意：redirect_uri 必须是钉钉开放平台配置的回调域名下的地址
    // 二维码内容应该是完整的登录URL，用户扫码后会跳转到钉钉确认页面
    const qrCodeUrl = `https://oapi.dingtalk.com/connect/qrconnect?appid=${qrLoginAppKey}&response_type=code&scope=snsapi_login&state=STATE&redirect_uri=${encodeURIComponent(finalRedirectUri)}`;
    
    console.log('生成扫码登录URL:', {
      appKey: qrLoginAppKey ? `${qrLoginAppKey.substring(0, 10)}...` : 'null',
      isQRLoginApp: !!config.qrLoginAppKey,
      redirectUri: finalRedirectUri,
      redirectDomain: new URL(finalRedirectUri).origin,
      fullUrl: qrCodeUrl.substring(0, 100) + '...',
    });
    
    // 检查回调域名配置提示
    const redirectDomain = new URL(finalRedirectUri).origin;
    if (redirectDomain.includes('localhost')) {
      console.log('⚠️  提示：开发环境使用localhost，请确保在钉钉开放平台配置回调域名为: http://localhost:5173');
    }
    
    res.json({ 
      success: true, 
      data: { 
        qrCodeUrl, 
        appKey: qrLoginAppKey,
        redirectUri: finalRedirectUri,
      } 
    });
  } catch (error) {
    console.error('获取扫码登录URL失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取钉钉OAuth登录URL（网页登录备用，已废弃，使用扫码登录）
exports.getLoginUrl = async (req, res) => {
  // 重定向到扫码登录
  return exports.getQRCodeUrl(req, res);
};

// 钉钉免登/扫码登录 - 通过code获取用户信息
// 支持两种方式：
// 1. 企业内部应用免登（使用getUserInfoByCode）
// 2. 扫码登录应用（使用getQRLoginAccessToken + getUserInfoByQRLoginAccessToken）
exports.loginWithCode = async (req, res) => {
  console.log('\n==========================================');
  console.log('🔵 开始处理钉钉登录请求');
  console.log('==========================================');
  try {
    const { code } = req.body;
    console.log('1. 收到请求，code:', code ? code.substring(0, 10) + '...' : 'null');
    
    if (!code) {
      console.error('❌ 缺少授权码code');
      return res.status(400).json({ 
        success: false, 
        message: '缺少授权码code' 
      });
    }

    console.log('2. 获取钉钉配置...');
    const config = await DingTalkConfig.findWithSecrets();
    if (!config || !config.enabled) {
      console.error('❌ 钉钉配置未启用或不存在');
      return res.status(400).json({ 
        success: false, 
        message: '钉钉配置未启用，请联系管理员配置' 
      });
    }
    console.log('✅ 配置已找到，enabled:', config.enabled);
    console.log('   有扫码登录配置:', !!(config.qrLoginAppKey && config.qrLoginAppSecret));

    let userDetail = null;
    let userInfo = null;

    // 根据文档：qrconnect返回的code是OAuth授权码，需要使用OAuth流程
    // getQRLoginAccessToken会自动使用扫码登录应用的配置，如果没有则使用企业内部应用的配置
    // 优先尝试OAuth流程（适用于扫码登录）
    if (config.appKey && config.appSecret) {
      console.log('3. 尝试使用OAuth流程处理code（自动使用扫码登录应用或企业内部应用配置）');
      try {
        console.log('4. 准备调用 getQRLoginAccessToken...');
        const accessToken = await dingTalkService.getQRLoginAccessToken(code);
        console.log('✅ 获取到accessToken:', accessToken ? accessToken.substring(0, 20) + '...' : 'null');
        
        userInfo = await dingTalkService.getUserInfoByQRLoginAccessToken(accessToken);
        console.log('✅ 获取到用户信息原始数据:', JSON.stringify(userInfo, null, 2));
        
        // 新API返回格式：{ unionId, mobile, nick, stateCode, ... }
        // 根据钉钉文档，可能返回的字段：unionId, openId, nick, mobile, avatarUrl等
        const userId = userInfo.unionId || userInfo.unionid || userInfo.openId || userInfo.openid || userInfo.userid || userInfo.userId;
        if (!userId) {
          console.error('❌ 无法从用户信息中提取userid，返回的数据:', userInfo);
          throw new Error('无法获取用户ID，请检查钉钉应用权限配置');
        }
        
        userDetail = {
          userid: userId,
          name: userInfo.nick || userInfo.name || userInfo.nickName || '',
          mobile: userInfo.mobile || userInfo.phone || userInfo.mobilePhone || '',
          email: userInfo.email || '',
          avatar: userInfo.avatarUrl || userInfo.avatar || '',
          dept_id_list: userInfo.deptIdList || userInfo.dept_id_list || [],
        };
        console.log('✅ OAuth方式获取到用户信息:', { userid: userDetail.userid, name: userDetail.name, mobile: userDetail.mobile });
        // OAuth成功，直接跳出，不再尝试免登流程
      } catch (oauthError) {
        console.error('❌ OAuth流程失败:', {
          message: oauthError.message,
          stack: oauthError.stack,
          response: oauthError.response?.data,
        });
        
        // 检查是否是code过期错误，如果是，不尝试免登流程（因为code已经无效）
        const isCodeExpired = oauthError.message.includes('40078') || 
                             oauthError.message.includes('临时授权码') || 
                             oauthError.message.includes('授权码无效') ||
                             oauthError.message.includes('不合法的临时授权码');
        
        if (isCodeExpired) {
          // code已过期，不尝试免登流程
          throw new Error(`登录失败: ${oauthError.message}。提示：授权码已过期，请重新扫码登录`);
        }
        
        // 如果OAuth失败且不是code过期，尝试使用企业内部应用的免登流程（作为备用）
        console.log('⚠️  OAuth流程失败，尝试使用企业内部应用免登流程...');
        try {
          userInfo = await dingTalkService.getUserInfoByCode(code);
          userDetail = await dingTalkService.getUserDetail(userInfo.userid);
          console.log('✅ 免登流程获取到用户信息:', { userid: userInfo.userid, name: userDetail.name });
        } catch (fallbackError) {
          console.error('❌ 免登流程也失败:', fallbackError.message);
          // 提供更详细的错误信息
          let errorMessage = `登录失败: ${oauthError.message}`;
          if (oauthError.message.includes('40078') || oauthError.message.includes('临时授权码')) {
            errorMessage += '。提示：如果使用的是扫码登录，请确保在钉钉开放平台配置了正确的回调域名，并且AppKey和AppSecret配置正确';
          }
          throw new Error(errorMessage);
        }
      }
    } else {
      // 没有配置任何AppKey和AppSecret
      return res.status(400).json({
        success: false,
        message: '钉钉AppKey或AppSecret未配置，请在系统管理 -> 钉钉集成中配置'
      });
    }
    
    if (!userDetail || !userDetail.userid) {
      return res.status(400).json({ 
        success: false, 
        message: '无法获取用户信息，请重试' 
      });
    }

    // 查找或创建用户关联
    // 注意：扫码登录时userDetail.userid可能是openid/unionid，需要统一使用userDetail.userid
    const dingTalkUserId = userDetail.userid || userInfo?.userid;
    if (!dingTalkUserId) {
      return res.status(400).json({ 
        success: false, 
        message: '无法获取钉钉用户ID' 
      });
    }
    
    let dingTalkUser = await DingTalkUser.findByDingTalkUserId(dingTalkUserId);
    let systemUser = null;

    if (dingTalkUser && dingTalkUser.userId) {
      // 已有关联，直接登录
      systemUser = await User.findById(dingTalkUser.userId);
    } else {
      // 查找系统中是否存在相同手机号或邮箱的用户
      if (userDetail.mobile) {
        const { pool } = require('../config/database');
        const connection = await pool.getConnection();
        try {
          const [rows] = await connection.execute('SELECT * FROM users WHERE phone = ? LIMIT 1', [userDetail.mobile]);
          systemUser = rows[0] || null;
        } finally {
          connection.release();
        }
      }
      if (!systemUser && userDetail.email) {
        systemUser = await User.findOne({ email: userDetail.email });
      }
      
      // 如果通过手机号或邮箱都没找到，尝试通过钉钉用户ID查找关联
      if (!systemUser && dingTalkUser) {
        systemUser = await User.findById(dingTalkUser.userId);
      }

      if (!systemUser) {
        // 创建新用户
        systemUser = await User.create({
          username: `dingtalk_${dingTalkUserId}`,
          email: userDetail.email || `${dingTalkUserId}@dingtalk.local`,
          password: require('crypto').randomBytes(16).toString('hex'), // 随机密码
          name: userDetail.name,
          phone: userDetail.mobile || '',
          role: 'sales', // 默认角色
          status: 'active',
        });
      }

      // 创建或更新关联
      await DingTalkUser.upsert({
        dingTalkUserId: dingTalkUserId,
        userId: systemUser.id,
        name: userDetail.name,
        mobile: userDetail.mobile,
        email: userDetail.email,
        avatar: userDetail.avatar,
        departmentIds: userDetail.dept_id_list || [],
      });
    }

    if (!systemUser) {
      return res.status(500).json({ 
        success: false, 
        message: '无法创建或查找系统用户' 
      });
    }

    // 生成JWT token
    const token = jwt.sign(
      { id: systemUser.id },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    console.log('登录成功，返回用户信息:', {
      userId: systemUser.id,
      username: systemUser.username,
      name: systemUser.name,
    });

    res.json({
      success: true,
      data: {
        user: {
          id: systemUser.id,
          username: systemUser.username,
          email: systemUser.email,
          name: systemUser.name,
          role: systemUser.role,
        },
        token
      }
    });
  } catch (error) {
    console.error('❌ 钉钉登录失败:', error);
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response?.data,
    });
    
    // 提供更友好的错误信息
    let errorMessage = error.message || '钉钉登录失败';
    if (error.message?.includes('access_token')) {
      errorMessage = '钉钉配置错误，请联系管理员检查AppKey和AppSecret';
    } else if (error.message?.includes('code无效') || error.message?.includes('tmp_auth_code')) {
      errorMessage = '授权码已过期或无效，请重新扫码登录';
    } else if (error.message?.includes('权限')) {
      errorMessage = '应用权限不足，请联系管理员';
    } else if (error.message?.includes('获取扫码登录访问令牌失败')) {
      errorMessage = '扫码登录失败，请检查扫码登录应用配置';
    }
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage 
    });
  }
};

// 钉钉OAuth回调处理（扫码登录回调）
exports.handleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=no_code`);
    }

    const config = await DingTalkConfig.findWithSecrets();
    
    // 判断是扫码登录还是免登
    // 如果配置了扫码登录应用，使用扫码登录流程
    if (config && config.qrLoginAppKey && config.qrLoginAppSecret) {
      console.log('使用扫码登录流程处理回调');
      
      // 扫码登录：通过code获取access_token，再获取用户信息
      const accessToken = await dingTalkService.getQRLoginAccessToken(code);
      const userInfo = await dingTalkService.getUserInfoByQRLoginAccessToken(accessToken);
      
      // 扫码登录获取的用户信息格式可能不同，需要适配
      const userDetail = {
        userid: userInfo.openid || userInfo.unionid || userInfo.userid,
        name: userInfo.nick || userInfo.name || '',
        mobile: userInfo.mobile || '',
        email: userInfo.email || '',
        avatar: userInfo.avatar || '',
        dept_id_list: [],
      };
      
      // 查找或创建用户关联
      let dingTalkUser = await DingTalkUser.findByDingTalkUserId(userDetail.userid);
      let systemUser = null;

      if (dingTalkUser && dingTalkUser.userId) {
        systemUser = await User.findById(dingTalkUser.userId);
      } else {
        // 查找系统中是否存在相同手机号或邮箱的用户
        if (userDetail.mobile) {
          const { pool } = require('../config/database');
          const connection = await pool.getConnection();
          try {
            const [rows] = await connection.execute('SELECT * FROM users WHERE phone = ? LIMIT 1', [userDetail.mobile]);
            systemUser = rows[0] || null;
          } finally {
            connection.release();
          }
        }
        if (!systemUser && userDetail.email) {
          systemUser = await User.findOne({ email: userDetail.email });
        }

        if (!systemUser) {
          systemUser = await User.create({
            username: `dingtalk_qr_${userDetail.userid}`,
            email: userDetail.email || `${userDetail.userid}@dingtalk.local`,
            password: require('crypto').randomBytes(16).toString('hex'),
            name: userDetail.name,
            phone: userDetail.mobile || '',
            role: 'sales',
            status: 'active',
          });
        }

        await DingTalkUser.upsert({
          dingTalkUserId: userDetail.userid,
          userId: systemUser.id,
          name: userDetail.name,
          mobile: userDetail.mobile,
          email: userDetail.email,
          avatar: userDetail.avatar,
          departmentIds: [],
        });
      }

      const token = jwt.sign(
        { id: systemUser.id },
        process.env.JWT_SECRET || 'your_jwt_secret_key_here',
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/dingtalk/callback?token=${token}`);
      return;
    }

    // 如果没有配置扫码登录应用，使用企业内部应用的免登流程（向后兼容）
    console.log('使用企业内部应用免登流程处理回调');
    const userInfo = await dingTalkService.getUserInfoByCode(code);
    const userDetail = await dingTalkService.getUserDetail(userInfo.userid);

    // 查找或创建用户关联
    let dingTalkUser = await DingTalkUser.findByDingTalkUserId(userInfo.userid);
    let systemUser = null;

    if (dingTalkUser && dingTalkUser.userId) {
      // 已有关联，直接登录
      systemUser = await User.findById(dingTalkUser.userId);
    } else {
      // 查找系统中是否存在相同手机号或邮箱的用户
      if (userDetail.mobile) {
        const { pool } = require('../config/database');
        const connection = await pool.getConnection();
        try {
          const [rows] = await connection.execute('SELECT * FROM users WHERE phone = ? LIMIT 1', [userDetail.mobile]);
          systemUser = rows[0] || null;
        } finally {
          connection.release();
        }
      }
      if (!systemUser && userDetail.email) {
        systemUser = await User.findOne({ email: userDetail.email });
      }
      
      // 如果通过手机号或邮箱都没找到，尝试通过钉钉用户ID查找关联
      if (!systemUser && dingTalkUser) {
        systemUser = await User.findById(dingTalkUser.userId);
      }

      if (!systemUser) {
        // 创建新用户
        systemUser = await User.create({
          username: `dingtalk_${userInfo.userid}`,
          email: userDetail.email || `${userInfo.userid}@dingtalk.local`,
          password: require('crypto').randomBytes(16).toString('hex'), // 随机密码
          name: userDetail.name,
          phone: userDetail.mobile || '',
          role: 'sales', // 默认角色
          status: 'active',
        });
      }

      // 创建或更新关联
      await DingTalkUser.upsert({
        dingTalkUserId: userInfo.userid,
        userId: systemUser.id,
        name: userDetail.name,
        mobile: userDetail.mobile,
        email: userDetail.email,
        avatar: userDetail.avatar,
        departmentIds: userDetail.dept_id_list || [],
      });
    }

    // 生成JWT token
    const token = jwt.sign(
      { id: systemUser.id },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // 重定向到前端，携带token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/dingtalk/success?token=${token}`);
  } catch (error) {
    console.error('钉钉登录回调处理失败:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error.message)}`);
  }
};

// 同步钉钉组织架构（部门）
exports.syncDepartments = async (req, res) => {
  try {
    console.log('收到同步组织架构请求');
    const config = await DingTalkConfig.findWithSecrets();
    if (!config || !config.enabled) {
      console.log('钉钉配置未启用');
      return res.status(400).json({ 
        success: false, 
        message: '钉钉配置未启用' 
      });
    }

    console.log('开始获取钉钉部门列表...');
    
    // 先测试API权限
    try {
      const testDept = await dingTalkService.getDepartmentList();
      console.log(`测试：成功获取到 ${testDept.length} 个部门`);
    } catch (testError) {
      console.error('测试部门API失败:', testError.message);
      return res.status(400).json({
        success: false,
        message: `无法访问钉钉组织架构：${testError.message}。请检查应用是否有"通讯录管理"权限`,
      });
    }
    
    // 获取所有钉钉部门
    const dingTalkDepartments = await dingTalkService.getDepartmentList();
    console.log(`获取到 ${dingTalkDepartments.length} 个钉钉部门`);
    
    if (dingTalkDepartments.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          total: 0,
          created: 0,
          updated: 0,
          errors: [],
        },
        message: '未获取到任何部门。请检查：1. 钉钉应用是否有"通讯录管理"权限 2. 企业通讯录是否有部门',
      });
    }

    const syncResults = {
      total: dingTalkDepartments.length,
      created: 0,
      updated: 0,
      errors: [],
    };

    // 创建钉钉部门ID到系统部门ID的映射
    const deptIdMap = new Map(); // key: 钉钉部门ID, value: 系统部门ID

    // 按层级排序：先处理父部门，确保父部门在子部门之前被处理
    // 使用拓扑排序：先处理没有父部门或父部门已处理的部门
    const sortedDepts = [];
    const processed = new Set();
    const deptMap = new Map(); // 钉钉部门ID -> 部门对象
    
    // 先建立索引
    dingTalkDepartments.forEach(dept => {
      if (dept.dept_id) {
        deptMap.set(String(dept.dept_id), dept);
      }
    });

    // 递归处理：先处理父部门
    const processDept = (deptId) => {
      if (processed.has(String(deptId))) return;
      
      const dept = deptMap.get(String(deptId));
      if (!dept) return;
      
      // 如果有父部门且父部门还没处理，先处理父部门
      if (dept.parent_id && dept.parent_id !== 1 && dept.parent_id !== 0) {
        const parentId = String(dept.parent_id);
        if (!processed.has(parentId) && deptMap.has(parentId)) {
          processDept(dept.parent_id);
        }
      }
      
      // 处理当前部门
      sortedDepts.push(dept);
      processed.add(String(deptId));
    };

    // 处理所有部门
    dingTalkDepartments.forEach(dept => {
      if (dept.dept_id) {
        processDept(dept.dept_id);
      }
    });

    console.log(`开始同步 ${sortedDepts.length} 个部门到系统...`);
    
    for (let i = 0; i < sortedDepts.length; i++) {
      const dtDept = sortedDepts[i];
      try {
        if (!dtDept.dept_id) {
          console.warn(`跳过无效部门（缺少dept_id）:`, dtDept);
          syncResults.errors.push({
            deptId: null,
            name: dtDept.name || '未知',
            error: '缺少dept_id',
          });
          continue;
        }

        const dingTalkDeptId = String(dtDept.dept_id);
        const deptCode = `dingtalk_${dingTalkDeptId}`; // 使用code字段存储钉钉部门ID
        
        // 查找系统中是否存在该部门（通过code字段）
        let systemDept = await Department.findByCode(deptCode);
        
        // 确定父部门ID
        let parentId = null;
        if (dtDept.parent_id && dtDept.parent_id !== 1 && dtDept.parent_id !== 0) {
          // 查找父部门在系统中的ID
          const parentDingTalkId = String(dtDept.parent_id);
          const parentSystemId = deptIdMap.get(parentDingTalkId);
          if (parentSystemId) {
            parentId = parentSystemId;
          } else {
            // 如果父部门还没同步，尝试通过code查找
            const parentCode = `dingtalk_${parentDingTalkId}`;
            const parentDept = await Department.findByCode(parentCode);
            if (parentDept) {
              parentId = parentDept.id;
              deptIdMap.set(parentDingTalkId, parentDept.id);
            }
          }
        }

        if (!systemDept) {
          // 创建新部门
          systemDept = await Department.create({
            name: dtDept.name || `部门_${dingTalkDeptId}`,
            code: deptCode,
            parentId: parentId,
            description: dtDept.description || '',
            sortOrder: dtDept.order || 0,
            isActive: true,
          });
          syncResults.created++;
          if (syncResults.created % 10 === 0) {
            console.log(`已创建 ${syncResults.created} 个新部门...`);
          }
        } else {
          // 更新部门信息
          await Department.findByIdAndUpdate(systemDept.id, {
            name: dtDept.name || systemDept.name,
            parentId: parentId !== null ? parentId : systemDept.parentId, // 只在有值时更新
            description: dtDept.description || systemDept.description,
            sortOrder: dtDept.order !== undefined ? dtDept.order : systemDept.sortOrder,
          });
          syncResults.updated++;
          if (syncResults.updated % 10 === 0) {
            console.log(`已更新 ${syncResults.updated} 个部门...`);
          }
        }

        // 记录映射关系
        deptIdMap.set(dingTalkDeptId, systemDept.id);
      } catch (error) {
        console.error(`同步部门 ${dtDept.dept_id} (${dtDept.name}) 失败:`, error.message);
        syncResults.errors.push({
          deptId: dtDept.dept_id,
          name: dtDept.name || '未知',
          error: error.message,
        });
      }
    }
    
    console.log(`同步完成：共${syncResults.total}个部门，新增${syncResults.created}个，更新${syncResults.updated}个，失败${syncResults.errors.length}个`);

    res.json({
      success: true,
      data: syncResults,
      message: `同步完成：共${syncResults.total}个部门，新增${syncResults.created}个，更新${syncResults.updated}个`,
    });
  } catch (error) {
    console.error('同步组织架构失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 统一同步钉钉组织架构（部门和用户）
exports.syncOrganization = async (req, res) => {
  try {
    console.log('========== 开始统一同步钉钉组织架构 ==========');
    const config = await DingTalkConfig.findWithSecrets();
    if (!config || !config.enabled) {
      console.log('钉钉配置未启用');
      return res.status(400).json({ 
        success: false, 
        message: '钉钉配置未启用' 
      });
    }

    const results = {
      departments: { total: 0, created: 0, updated: 0, errors: [] },
      users: { total: 0, created: 0, updated: 0, errors: [] },
    };

    // 部门映射：钉钉部门ID -> 系统部门ID（用于部门同步）
    const deptIdMap = new Map();
    // 部门名称映射：钉钉部门ID -> 系统部门名称（用于用户同步）
    const deptIdToNameMap = new Map();

    // 步骤1: 同步部门
    console.log('\n========== 步骤1: 同步部门 ==========');
    try {
      const dingTalkDepartments = await dingTalkService.getDepartmentList();
      console.log(`获取到 ${dingTalkDepartments.length} 个钉钉部门`);
      
      if (dingTalkDepartments.length > 0) {
        const sortedDepts = [];
        const processed = new Set();
        const deptMap = new Map();
        
        dingTalkDepartments.forEach(dept => {
          if (dept.dept_id) {
            deptMap.set(String(dept.dept_id), dept);
          }
        });

        const processDept = (deptId) => {
          if (processed.has(String(deptId))) return;
          const dept = deptMap.get(String(deptId));
          if (!dept) return;
          
          if (dept.parent_id && dept.parent_id !== 1 && dept.parent_id !== 0) {
            const parentId = String(dept.parent_id);
            if (!processed.has(parentId) && deptMap.has(parentId)) {
              processDept(dept.parent_id);
            }
          }
          
          sortedDepts.push(dept);
          processed.add(String(deptId));
        };

        dingTalkDepartments.forEach(dept => {
          if (dept.dept_id) {
            processDept(dept.dept_id);
          }
        });

        for (const dtDept of sortedDepts) {
          try {
            if (!dtDept.dept_id) continue;

            const dingTalkDeptId = String(dtDept.dept_id);
            const deptCode = `dingtalk_${dingTalkDeptId}`;
            
            let systemDept = await Department.findByCode(deptCode);
            
            let parentId = null;
            if (dtDept.parent_id && dtDept.parent_id !== 1 && dtDept.parent_id !== 0) {
              const parentDingTalkId = String(dtDept.parent_id);
              const parentSystemId = deptIdMap.get(parentDingTalkId);
              if (parentSystemId) {
                parentId = parentSystemId;
              } else {
                const parentCode = `dingtalk_${parentDingTalkId}`;
                const parentDept = await Department.findByCode(parentCode);
                if (parentDept) {
                  parentId = parentDept.id;
                  deptIdMap.set(parentDingTalkId, parentDept.id);
                }
              }
            }

            if (!systemDept) {
              systemDept = await Department.create({
                name: dtDept.name || `部门_${dingTalkDeptId}`,
                code: deptCode,
                parentId: parentId,
                description: dtDept.description || '',
                sortOrder: dtDept.order || 0,
                isActive: true,
              });
              results.departments.created++;
            } else {
              await Department.findByIdAndUpdate(systemDept.id, {
                name: dtDept.name || systemDept.name,
                parentId: parentId !== null ? parentId : systemDept.parentId,
                description: dtDept.description || systemDept.description,
                sortOrder: dtDept.order !== undefined ? dtDept.order : systemDept.sortOrder,
              });
              results.departments.updated++;
            }

            deptIdMap.set(dingTalkDeptId, systemDept.id);
            deptIdToNameMap.set(dingTalkDeptId, systemDept.name);
          } catch (error) {
            console.error(`同步部门 ${dtDept.dept_id} 失败:`, error.message);
            results.departments.errors.push({
              deptId: dtDept.dept_id,
              name: dtDept.name || '未知',
              error: error.message,
            });
          }
        }
      }

      results.departments.total = dingTalkDepartments.length;
      console.log(`部门同步完成：共${results.departments.total}个，新增${results.departments.created}个，更新${results.departments.updated}个`);
    } catch (deptError) {
      console.error('同步部门失败:', deptError.message);
      const errorMsg = deptError.message || '未知错误';
      
      // 检查是否是网络连接错误
      if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ETIMEDOUT') || errorMsg.includes('无法连接到钉钉服务器')) {
        results.departments.errors.push({ 
          error: '网络连接失败，无法访问钉钉服务器。请检查网络连接、DNS设置和防火墙配置。',
          details: errorMsg
        });
      } else {
        results.departments.errors.push({ error: errorMsg });
      }
    }

    // 步骤2: 同步用户
    console.log('\n========== 步骤2: 同步用户 ==========');
    try {
      const dingTalkUsers = await dingTalkService.getAllUsers();
      console.log(`获取到 ${dingTalkUsers.length} 个钉钉用户`);

      // 如果部门映射为空，从数据库重新加载
      if (deptIdToNameMap.size === 0) {
        console.log('⚠️  部门映射为空，从数据库重新加载...');
        const { pool } = require('../config/database');
        const connection = await pool.getConnection();
        try {
          const [deptRows] = await connection.execute(
            "SELECT id, name, code FROM departments WHERE code LIKE 'dingtalk_%'"
          );
          console.log(`从数据库查询到 ${deptRows.length} 个钉钉部门`);
          
          for (const dept of deptRows) {
            // 从code中提取钉钉部门ID: dingtalk_123456 -> 123456
            const dingTalkDeptId = dept.code.replace('dingtalk_', '');
            deptIdToNameMap.set(dingTalkDeptId, dept.name);
            console.log(`  映射: 钉钉部门ID ${dingTalkDeptId} -> ${dept.name}`);
          }
          console.log(`✅ 从数据库加载了 ${deptIdToNameMap.size} 个部门映射`);
        } catch (error) {
          console.error('❌ 从数据库加载部门映射失败:', error);
        } finally {
          connection.release();
        }
      } else {
        console.log(`✅ 使用已同步的部门映射，共 ${deptIdToNameMap.size} 个部门`);
      }

      // 角色映射函数：根据钉钉用户的职位和部门信息智能映射角色
      const mapRole = (dtUser) => {
        const position = (dtUser.position || '').toLowerCase();
        const title = (dtUser.title || '').toLowerCase();
        const deptName = dtUser.dept_id_list && dtUser.dept_id_list.length > 0 
          ? (deptIdToNameMap.get(String(dtUser.dept_id_list[0])) || '').toLowerCase()
          : '';
        
        // 根据职位和部门名称智能映射角色
        if (position.includes('经理') || position.includes('主管') || position.includes('总监') || 
            title.includes('经理') || title.includes('主管') || title.includes('总监') ||
            dtUser.is_boss || dtUser.is_admin) {
          if (deptName.includes('销售') || deptName.includes('业务')) {
            return 'sales_manager';
          }
          return 'admin'; // 默认管理员
        }
        
        if (deptName.includes('销售') || deptName.includes('业务')) {
          return 'sales';
        }
        if (deptName.includes('客服') || deptName.includes('服务')) {
          return 'service';
        }
        if (deptName.includes('市场') || deptName.includes('营销')) {
          return 'marketing';
        }
        if (deptName.includes('财务')) {
          return 'sales'; // 财务暂时映射为销售
        }
        
        // 默认角色
        return 'sales';
      };

      // 获取用户主要部门名称
      const getDepartmentName = (dtUser) => {
        if (!dtUser.dept_id_list || dtUser.dept_id_list.length === 0) {
          console.warn(`  ⚠️  用户 ${dtUser.name || dtUser.userid} 没有部门信息`);
          return '';
        }
        
        // 尝试所有部门ID，找到第一个匹配的
        for (const deptId of dtUser.dept_id_list) {
          const deptName = deptIdToNameMap.get(String(deptId));
          if (deptName) {
            return deptName;
          }
        }
        
        // 如果都没找到，记录警告
        console.warn(`  ⚠️  用户 ${dtUser.name || dtUser.userid} 的部门ID ${JSON.stringify(dtUser.dept_id_list)} 在部门映射中未找到`);
        return '';
      };

      if (dingTalkUsers.length > 0) {
        let processedCount = 0;
        for (const dtUser of dingTalkUsers) {
          try {
            if (!dtUser || !dtUser.userid) {
              console.warn(`⚠️  跳过无效用户数据:`, dtUser);
              continue;
            }

            processedCount++;
            if (processedCount % 50 === 0) {
              console.log(`  已处理 ${processedCount}/${dingTalkUsers.length} 个用户...`);
            }

            let systemUser = null;
            const existingLink = await DingTalkUser.findByDingTalkUserId(dtUser.userid);
            if (existingLink && existingLink.userId) {
              systemUser = await User.findById(existingLink.userId);
            }
            
            if (!systemUser && dtUser.mobile) {
              const { pool } = require('../config/database');
              const connection = await pool.getConnection();
              try {
                const [rows] = await connection.execute('SELECT * FROM users WHERE phone = ? LIMIT 1', [dtUser.mobile]);
                systemUser = rows[0] || null;
              } finally {
                connection.release();
              }
            }
            if (!systemUser && dtUser.email) {
              systemUser = await User.findOne({ email: dtUser.email });
            }

            // 确定角色和部门
            const userRole = mapRole(dtUser);
            const userDepartment = getDepartmentName(dtUser);

            if (!systemUser) {
              systemUser = await User.create({
                username: `dingtalk_${dtUser.userid}`,
                email: dtUser.email || `${dtUser.userid}@dingtalk.local`,
                password: require('crypto').randomBytes(16).toString('hex'),
                name: dtUser.name || `钉钉用户_${dtUser.userid}`,
                phone: dtUser.mobile || '',
                role: userRole,
                department: userDepartment,
                status: 'active',
              });
              results.users.created++;
              console.log(`  ✅ 创建用户: ${dtUser.name} (角色: ${userRole}, 部门: ${userDepartment || '未分配'})`);
            } else {
              // 强制更新角色和部门，即使为空也要更新（确保同步）
              const updateData = {
                name: dtUser.name || systemUser.name,
                phone: dtUser.mobile || systemUser.phone,
                email: dtUser.email || systemUser.email,
                role: userRole, // 强制更新角色
                department: userDepartment, // 强制更新部门（即使为空）
              };
              
              await User.findByIdAndUpdate(systemUser.id, updateData);
              results.users.updated++;
              
              // 详细日志
              const logMsg = `  ✅ 更新用户: ${dtUser.name} (角色: ${userRole}, 部门: ${userDepartment || '未分配'})`;
              if (!userDepartment) {
                console.warn(`  ⚠️  ${logMsg} - 警告: 部门为空，钉钉部门ID: ${dtUser.dept_id_list ? JSON.stringify(dtUser.dept_id_list) : '无'}`);
              } else {
                console.log(logMsg);
              }
            }

            await DingTalkUser.upsert({
              dingTalkUserId: dtUser.userid,
              userId: systemUser.id,
              name: dtUser.name || systemUser.name || '',
              mobile: dtUser.mobile || '',
              email: dtUser.email || '',
              avatar: dtUser.avatar || '',
              departmentIds: Array.isArray(dtUser.dept_id_list) ? dtUser.dept_id_list : [],
              // 新增字段
              unionid: dtUser.unionid || '',
              position: dtUser.position || '',
              jobnumber: dtUser.jobnumber || '',
              hired_date: dtUser.hired_date || null,
              work_place: dtUser.work_place || '',
              remark: dtUser.remark || '',
              manager_userid: dtUser.manager_userid || '',
              is_admin: dtUser.is_admin || false,
              is_boss: dtUser.is_boss || false,
              is_leader_in_depts: dtUser.is_leader_in_depts || {},
              order_in_depts: dtUser.order_in_depts || {},
              active: dtUser.active !== undefined ? dtUser.active : true,
              real_authed: dtUser.real_authed || false,
              org_email: dtUser.org_email || '',
              org_email_type: dtUser.org_email_type || '',
              state_code: dtUser.state_code || '',
              telephone: dtUser.telephone || '',
              extattr: dtUser.extattr || {},
              senior: dtUser.senior || false,
              hide_mobile: dtUser.hide_mobile || false,
              exclusive_account: dtUser.exclusive_account || false,
              login_id: dtUser.login_id || '',
              exclusive_account_type: dtUser.exclusive_account_type || '',
              title: dtUser.title || '',
              dept_order_list: dtUser.dept_order_list || {},
              // 注意：不传递 userid，因为 dingTalkUserId 已经存储了钉钉用户ID
            });
          } catch (error) {
            console.error(`同步用户 ${dtUser.userid} 失败:`, error.message);
            results.users.errors.push({
              userId: dtUser.userid,
              name: dtUser.name || '未知',
              error: error.message,
            });
          }
        }
      }

      results.users.total = dingTalkUsers.length;
      console.log(`用户同步完成：共${results.users.total}人，新增${results.users.created}人，更新${results.users.updated}人`);
    } catch (userError) {
      console.error('同步用户失败:', userError.message);
      const errorMsg = userError.message || '未知错误';
      
      // 检查是否是网络连接错误
      if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ETIMEDOUT') || errorMsg.includes('无法连接到钉钉服务器')) {
        results.users.errors.push({ 
          error: '网络连接失败，无法访问钉钉服务器。请检查网络连接、DNS设置和防火墙配置。',
          details: errorMsg
        });
      } else {
        results.users.errors.push({ error: errorMsg });
      }
    }

    // 步骤3: 验证数据完整性
    console.log('\n========== 步骤3: 验证数据完整性 ==========');
    try {
      const { pool } = require('../config/database');
      const connection = await pool.getConnection();
      try {
        // 统计数据库中实际同步的部门数量
        const [deptRows] = await connection.execute(
          "SELECT COUNT(*) as count FROM departments WHERE code LIKE 'dingtalk_%'"
        );
        const actualDeptCount = deptRows[0]?.count || 0;
        console.log(`数据库中的钉钉部门数量: ${actualDeptCount}`);
        
        // 统计数据库中实际同步的用户数量
        const [userRows] = await connection.execute(
          "SELECT COUNT(*) as count FROM users WHERE username LIKE 'dingtalk_%' OR username LIKE 'dingtalk_qr_%'"
        );
        const actualUserCount = userRows[0]?.count || 0;
        console.log(`数据库中的钉钉用户数量: ${actualUserCount}`);
        
        // 统计钉钉用户关联数量
        const [linkRows] = await connection.execute(
          "SELECT COUNT(*) as count FROM dingtalk_users"
        );
        const actualLinkCount = linkRows[0]?.count || 0;
        console.log(`钉钉用户关联数量: ${actualLinkCount}`);
        
        // 检查数据一致性
        if (actualDeptCount !== results.departments.total) {
          console.warn(`⚠️  部门数量不一致：期望 ${results.departments.total}，实际 ${actualDeptCount}`);
        }
        if (actualUserCount !== results.users.total) {
          console.warn(`⚠️  用户数量不一致：期望 ${results.users.total}，实际 ${actualUserCount}`);
        }
        if (actualLinkCount !== results.users.total) {
          console.warn(`⚠️  用户关联数量不一致：期望 ${results.users.total}，实际 ${actualLinkCount}`);
        }
        
        results.validation = {
          expectedDepartments: results.departments.total,
          actualDepartments: actualDeptCount,
          expectedUsers: results.users.total,
          actualUsers: actualUserCount,
          actualLinks: actualLinkCount,
        };
      } finally {
        connection.release();
      }
    } catch (validationError) {
      console.error('验证数据完整性失败:', validationError.message);
      // 不中断流程，继续返回结果
    }

    console.log('\n========== 同步完成 ==========');
    console.log(`部门：共${results.departments.total}个，新增${results.departments.created}个，更新${results.departments.updated}个，失败${results.departments.errors.length}个`);
    console.log(`用户：共${results.users.total}人，新增${results.users.created}人，更新${results.users.updated}人，失败${results.users.errors.length}个`);
    
    if (results.departments.errors.length > 0) {
      console.log(`\n部门同步错误详情:`);
      results.departments.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. ${err.name || err.deptId || '未知'} (ID: ${err.deptId || '未知'}): ${err.error}`);
      });
    }
    
    if (results.users.errors.length > 0) {
      console.log(`\n用户同步错误详情:`);
      results.users.errors.slice(0, 20).forEach((err, index) => {
        console.log(`  ${index + 1}. ${err.name || '未知'} (ID: ${err.userId || '未知'}): ${err.error}`);
      });
      if (results.users.errors.length > 20) {
        console.log(`  ... 还有 ${results.users.errors.length - 20} 个错误未显示`);
      }
    }

    // 检查是否有严重的网络错误
    const hasNetworkError = results.departments.errors.some(e => e.error?.includes('网络连接失败')) ||
                           results.users.errors.some(e => e.error?.includes('网络连接失败'));
    
    if (hasNetworkError) {
      return res.status(500).json({
        success: false,
        data: results,
        message: '同步失败：无法连接到钉钉服务器。请检查网络连接、DNS设置和防火墙配置。',
      });
    }

    // 检查是否有部分成功
    const hasPartialSuccess = (results.departments.created > 0 || results.departments.updated > 0) ||
                             (results.users.created > 0 || results.users.updated > 0);
    
    const hasErrors = (results.departments.errors.length > 0) || (results.users.errors.length > 0);
    
    // 构建详细的消息
    let message = '';
    if (hasPartialSuccess) {
      message = `同步完成：部门${results.departments.total}个（新增${results.departments.created}，更新${results.departments.updated}），用户${results.users.total}人（新增${results.users.created}，更新${results.users.updated}）`;
      if (hasErrors) {
        message += `。注意：有${results.departments.errors.length}个部门、${results.users.errors.length}个用户同步失败，请查看错误详情。`;
      }
    } else {
      message = '同步失败：未获取到任何数据。请检查钉钉配置和网络连接。';
    }

    res.json({
      success: hasPartialSuccess || !hasErrors,
      data: results,
      message: message,
    });
  } catch (error) {
    console.error('统一同步组织架构失败:', error);
    const errorMsg = error.message || '未知错误';
    
    // 检查是否是网络连接错误
    if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ETIMEDOUT') || errorMsg.includes('无法连接到钉钉服务器')) {
      return res.status(500).json({ 
        success: false, 
        message: '无法连接到钉钉服务器。请检查：1. 网络连接是否正常 2. 是否配置了代理 3. 防火墙是否阻止了访问 4. DNS解析是否正常',
        details: errorMsg
      });
    }
    
    res.status(500).json({ success: false, message: errorMsg });
  }
};

// 同步钉钉通讯录
exports.syncContacts = async (req, res) => {
  try {
    console.log('收到同步通讯录请求');
    const config = await DingTalkConfig.findWithSecrets();
    if (!config || !config.enabled) {
      console.log('钉钉配置未启用');
      return res.status(400).json({ 
        success: false, 
        message: '钉钉配置未启用' 
      });
    }

    console.log('开始获取钉钉用户列表...');
    
    // 先测试API权限
    try {
      const testDept = await dingTalkService.getDepartmentList();
      console.log(`测试：成功获取到 ${testDept.length} 个部门`);
    } catch (testError) {
      console.error('测试部门API失败:', testError.message);
      return res.status(400).json({
        success: false,
        message: `无法访问钉钉通讯录：${testError.message}。请检查应用是否有"通讯录管理"权限`,
      });
    }
    
    // 获取所有钉钉用户
    const dingTalkUsers = await dingTalkService.getAllUsers();
    console.log(`获取到 ${dingTalkUsers.length} 个钉钉用户`);
    
    if (dingTalkUsers.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          total: 0,
          created: 0,
          updated: 0,
          errors: [],
        },
        message: '未获取到任何用户。请检查：1. 钉钉应用是否有"通讯录管理"权限 2. 企业通讯录是否有用户',
      });
    }
    const syncResults = {
      total: dingTalkUsers.length,
      created: 0,
      updated: 0,
      errors: [],
    };

    console.log(`开始同步 ${dingTalkUsers.length} 个用户到系统...`);
    
    for (let i = 0; i < dingTalkUsers.length; i++) {
      const dtUser = dingTalkUsers[i];
      try {
        if (!dtUser.userid) {
          console.warn(`跳过无效用户（缺少userid）:`, dtUser);
          syncResults.errors.push({
            userId: null,
            name: dtUser.name || '未知',
            error: '缺少userid',
          });
          continue;
        }

        // 查找系统中是否存在该用户
        let systemUser = null;
        
        // 先查找是否已有关联
        const existingLink = await DingTalkUser.findByDingTalkUserId(dtUser.userid);
        if (existingLink && existingLink.userId) {
          systemUser = await User.findById(existingLink.userId);
        }
        
        // 如果没有关联，通过手机号或邮箱查找
        if (!systemUser && dtUser.mobile) {
          const { pool } = require('../config/database');
          const connection = await pool.getConnection();
          try {
            const [rows] = await connection.execute('SELECT * FROM users WHERE phone = ? LIMIT 1', [dtUser.mobile]);
            systemUser = rows[0] || null;
          } finally {
            connection.release();
          }
        }
        if (!systemUser && dtUser.email) {
          systemUser = await User.findOne({ email: dtUser.email });
        }

        if (!systemUser) {
          // 创建新用户
          systemUser = await User.create({
            username: `dingtalk_${dtUser.userid}`,
            email: dtUser.email || `${dtUser.userid}@dingtalk.local`,
            password: require('crypto').randomBytes(16).toString('hex'),
            name: dtUser.name || `钉钉用户_${dtUser.userid}`,
            phone: dtUser.mobile || '',
            role: 'sales',
            status: 'active',
          });
          syncResults.created++;
          if (syncResults.created % 10 === 0) {
            console.log(`已创建 ${syncResults.created} 个新用户...`);
          }
        } else {
          // 更新用户信息
          await User.findByIdAndUpdate(systemUser.id, {
            name: dtUser.name || systemUser.name,
            phone: dtUser.mobile || systemUser.phone,
            email: dtUser.email || systemUser.email,
          });
          syncResults.updated++;
          if (syncResults.updated % 10 === 0) {
            console.log(`已更新 ${syncResults.updated} 个用户...`);
          }
        }

        // 创建或更新关联
        try {
          await DingTalkUser.upsert({
            dingTalkUserId: dtUser.userid,
            userId: systemUser.id,
            name: dtUser.name || systemUser.name || '',
            mobile: dtUser.mobile || '',
            email: dtUser.email || '',
            avatar: dtUser.avatar || '',
            departmentIds: Array.isArray(dtUser.dept_id_list) ? dtUser.dept_id_list : [],
            // 新增字段
            unionid: dtUser.unionid || '',
            position: dtUser.position || '',
            jobnumber: dtUser.jobnumber || '',
            hired_date: dtUser.hired_date || null,
            work_place: dtUser.work_place || '',
            remark: dtUser.remark || '',
            manager_userid: dtUser.manager_userid || '',
            is_admin: dtUser.is_admin || false,
            is_boss: dtUser.is_boss || false,
            is_leader_in_depts: dtUser.is_leader_in_depts || {},
            order_in_depts: dtUser.order_in_depts || {},
            active: dtUser.active !== undefined ? dtUser.active : true,
            real_authed: dtUser.real_authed || false,
            org_email: dtUser.org_email || '',
            org_email_type: dtUser.org_email_type || '',
            state_code: dtUser.state_code || '',
            telephone: dtUser.telephone || '',
            extattr: dtUser.extattr || {},
            senior: dtUser.senior || false,
            hide_mobile: dtUser.hide_mobile || false,
            exclusive_account: dtUser.exclusive_account || false,
            login_id: dtUser.login_id || '',
            exclusive_account_type: dtUser.exclusive_account_type || '',
            title: dtUser.title || '',
            dept_order_list: dtUser.dept_order_list || {},
            userid: dtUser.userid || dtUser.userid,
          });
        } catch (upsertError) {
          console.error(`更新用户关联失败 ${dtUser.userid}:`, upsertError.message);
          // 不抛出错误，继续处理下一个用户
        }
      } catch (error) {
        console.error(`同步用户 ${dtUser.userid} (${dtUser.name}) 失败:`, error.message);
        syncResults.errors.push({
          userId: dtUser.userid,
          name: dtUser.name || '未知',
          error: error.message,
        });
      }
    }
    
    console.log(`同步完成：共${syncResults.total}人，新增${syncResults.created}人，更新${syncResults.updated}人，失败${syncResults.errors.length}人`);

    res.json({
      success: true,
      data: syncResults,
      message: `同步完成：共${syncResults.total}人，新增${syncResults.created}人，更新${syncResults.updated}人`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 同步待办到钉钉
exports.syncTodoToDingTalk = async (req, res) => {
  try {
    const { todoId } = req.params;
    const todo = await Todo.findById(todoId);
    
    if (!todo) {
      return res.status(404).json({ success: false, message: '待办不存在' });
    }

    // 查找用户的钉钉关联
    const dingTalkUser = await DingTalkUser.findByUserId(todo.assigneeId);
    if (!dingTalkUser) {
      return res.status(400).json({ 
        success: false, 
        message: '该用户未绑定钉钉账号' 
      });
    }

    // 创建钉钉待办
    const dueTime = todo.dueDate 
      ? Math.floor(new Date(todo.dueDate).getTime() / 1000)
      : null;
    
    // 传递todoId用于构建详情页URL，这样点击待办时可以跳转到具体的待办详情页
    const result = await dingTalkService.createTodo(
      dingTalkUser.dingTalkUserId,
      todo.title,
      todo.description,
      dueTime,
      todoId // 传递待办ID，用于构建详情页URL
    );

    // 获取钉钉记录ID（支持多种可能的字段名）
    const recordId = result.record_id || result.recordId || result.id || null;
    
    if (!recordId) {
      console.warn('钉钉待办创建成功，但未返回record_id，完整响应:', result);
    }

    // 更新待办的metadata，记录钉钉记录ID
    await Todo.findByIdAndUpdate(todoId, {
      metadata: {
        ...(todo.metadata || {}),
        ...(recordId ? { dingTalkRecordId: recordId } : {}),
        dingTalkSynced: true,
        dingTalkSyncedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: result,
      message: '待办已同步到钉钉',
    });
  } catch (error) {
    // 检查是否是权限问题
    let errorMessage = error.message;
    let errorCode = null;
    
    // 提取钉钉错误码和权限信息
    if (error.message.includes('qyapi_work_record') || error.message.includes('60011')) {
      errorCode = 'PERMISSION_REQUIRED';
      errorMessage = '应用尚未开通"待办应用中待办写权限"，请在钉钉开放平台申请并开通该权限。';
    } else if (error.message.includes('errcode: 88')) {
      errorCode = 'PERMISSION_REQUIRED';
      errorMessage = '应用权限不足，请检查钉钉开放平台的应用权限配置。';
    }
    
    console.error('同步待办到钉钉失败:', {
      message: error.message,
      errorCode,
      stack: error.stack,
    });
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage,
      errorCode,
      detail: error.message, // 保留原始错误信息用于调试
    });
  }
};

// 批量同步待办到钉钉
exports.syncTodosToDingTalk = async (req, res) => {
  try {
    const { todoIds } = req.body;
    const results = {
      total: todoIds.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const todoId of todoIds) {
      try {
        const todo = await Todo.findById(todoId);
        if (!todo) continue;

        const dingTalkUser = await DingTalkUser.findByUserId(todo.assigneeId);
        if (!dingTalkUser) {
          results.failed++;
          results.errors.push({ todoId, error: '用户未绑定钉钉账号' });
          continue;
        }

        // 检查是否已同步
        if (todo.metadata?.dingTalkSynced) {
          results.success++;
          continue;
        }

        const dueTime = todo.dueDate 
          ? Math.floor(new Date(todo.dueDate).getTime() / 1000)
          : null;

        const result = await dingTalkService.createTodo(
          dingTalkUser.dingTalkUserId,
          todo.title,
          todo.description,
          dueTime
        );

        await Todo.findByIdAndUpdate(todoId, {
          metadata: {
            ...(todo.metadata || {}),
            dingTalkRecordId: result.record_id,
            dingTalkSynced: true,
            dingTalkSyncedAt: new Date(),
          },
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ todoId, error: error.message });
      }
    }

    res.json({
      success: true,
      data: results,
      message: `同步完成：成功${results.success}个，失败${results.failed}个`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取钉钉用户关联列表
exports.getDingTalkUsers = async (req, res) => {
  try {
    console.log('[getDingTalkUsers] 开始获取钉钉用户关联列表');
    const users = await DingTalkUser.findAll();
    console.log(`[getDingTalkUsers] ✅ 获取到 ${users.length} 个用户关联`);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('[getDingTalkUsers] ❌ 获取用户关联失败:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ 
      success: false, 
      message: error.message || '获取用户关联失败' 
    });
  }
};

// 清理重复的钉钉用户关联
exports.cleanDuplicateUsers = async (req, res) => {
  try {
    console.log('[cleanDuplicateUsers] 开始清理重复的钉钉用户关联');
    const result = await DingTalkUser.removeDuplicates();
    res.json({ 
      success: true, 
      message: `已清理 ${result.removed} 条重复记录`,
      data: result 
    });
  } catch (error) {
    console.error('[cleanDuplicateUsers] ❌ 清理失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '清理失败' 
    });
  }
};

// 测试钉钉配置
exports.testConfig = async (req, res) => {
  try {
    const config = await DingTalkConfig.findWithSecrets();
    if (!config || !config.enabled) {
      return res.status(400).json({ 
        success: false, 
        message: '钉钉配置未启用' 
      });
    }

    const results = {
      accessToken: false,
      departments: { count: 0, error: null },
      rootUsers: { count: 0, error: null },
      allUsers: { count: 0, error: null },
    };

    // 测试1: 获取访问令牌
    try {
      const token = await dingTalkService.getAccessToken();
      results.accessToken = true;
      console.log('✅ 访问令牌获取成功');
    } catch (error) {
      results.accessToken = false;
      results.accessTokenError = error.message;
      console.error('❌ 访问令牌获取失败:', error.message);
    }

    // 测试2: 获取部门列表
    try {
      const departments = await dingTalkService.getDepartmentList();
      results.departments.count = departments.length;
      console.log(`✅ 获取到 ${departments.length} 个部门`);
      if (departments.length > 0) {
        console.log('部门列表:', departments.map(d => ({ id: d.dept_id, name: d.name })));
      }
    } catch (error) {
      results.departments.error = error.message;
      console.error('❌ 获取部门列表失败:', error.message);
    }

    // 测试3: 获取根部门用户（直接测试）
    try {
      const accessToken = await dingTalkService.getAccessToken();
      const axios = require('axios');
      
      // 方法1: 使用 listid API
      console.log('测试方法1: topapi/user/listid (部门ID=1)');
      const listIdResponse = await axios.post('https://oapi.dingtalk.com/topapi/user/listid', {
        access_token: accessToken,
        dept_id: 1,
      });
      
      if (listIdResponse.data.errcode === 0) {
        const userIds = listIdResponse.data.result?.userid_list || [];
        console.log(`✅ listid API成功: 获取到 ${userIds.length} 个用户ID`);
        results.rootUsers.count = userIds.length;
        results.rootUsers.userIds = userIds;
        
        // 如果有用户ID，尝试获取第一个用户的详情
        if (userIds.length > 0) {
          try {
            const userDetail = await dingTalkService.getUserDetail(userIds[0]);
            console.log('✅ 用户详情获取成功:', userDetail.name || userDetail.userid);
            results.rootUsers.sampleUser = {
              userid: userDetail.userid,
              name: userDetail.name,
              mobile: userDetail.mobile,
            };
          } catch (detailError) {
            console.error('❌ 获取用户详情失败:', detailError.message);
          }
        }
      } else {
        console.error('❌ listid API失败:', listIdResponse.data.errmsg);
        results.rootUsers.error = listIdResponse.data.errmsg;
        
        // 方法2: 尝试使用 list API
        console.log('测试方法2: topapi/user/list (部门ID=1)');
        const listResponse = await axios.post('https://oapi.dingtalk.com/topapi/user/list', {
          access_token: accessToken,
          dept_id: 1,
          cursor: 0,
          size: 100,
        });
        
        if (listResponse.data.errcode === 0) {
          const result = listResponse.data.result || {};
          const userList = result.list || [];
          console.log(`✅ list API成功: 获取到 ${userList.length} 个用户`);
          results.rootUsers.count = userList.length;
          if (userList.length > 0) {
            results.rootUsers.sampleUser = {
              userid: userList[0].userid,
              name: userList[0].name,
              mobile: userList[0].mobile,
            };
          }
        } else {
          console.error('❌ list API也失败:', listResponse.data.errmsg);
          results.rootUsers.error = `listid: ${listIdResponse.data.errmsg}, list: ${listResponse.data.errmsg}`;
        }
      }
    } catch (error) {
      results.rootUsers.error = error.message;
      console.error('❌ 获取根部门用户失败:', error.message);
    }

    // 测试4: 获取所有用户
    try {
      const allUsers = await dingTalkService.getAllUsers();
      results.allUsers.count = allUsers.length;
      console.log(`✅ 获取到 ${allUsers.length} 个用户`);
    } catch (error) {
      results.allUsers.error = error.message;
      console.error('❌ 获取所有用户失败:', error.message);
    }

    // 返回测试结果
    const allTestsPassed = results.accessToken && 
                           results.departments.count >= 0 && 
                           results.rootUsers.count > 0;
    
    res.json({
      success: allTestsPassed,
      message: allTestsPassed 
        ? `配置测试成功：获取到 ${results.rootUsers.count} 个根部门用户，共 ${results.allUsers.count} 个用户`
        : `配置测试完成，但未获取到用户。请检查权限设置。`,
      data: results,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: `配置测试失败: ${error.message}` 
    });
  }
};

// 获取Stream连接状态
exports.getStreamStatus = async (req, res) => {
  try {
    const status = dingTalkStreamService.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// 重启Stream连接
exports.restartStream = async (req, res) => {
  try {
    await dingTalkStreamService.stop();
    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
    await dingTalkStreamService.start();
    
    const status = dingTalkStreamService.getStatus();
    res.json({
      success: true,
      message: 'Stream连接已重启',
      data: status,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: `重启Stream失败: ${error.message}` 
    });
  }
};

// 清除钉钉同步数据 - 优化为快速响应，后台执行
// 钉钉待办详情页（后端渲染，公开接口，不需要认证）
// 这个接口直接返回HTML页面，不依赖前端服务，解决钉钉无法访问本地地址的问题
exports.redirectTodoDetail = async (req, res) => {
  try {
    const { todoId } = req.params;
    
    if (!todoId) {
      return res.status(400).send(`
        <html>
          <head><title>错误</title></head>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h1>错误</h1>
            <p>待办ID不能为空</p>
          </body>
        </html>
      `);
    }

    // 获取钉钉配置（包含serverUrl）
    const DingTalkConfig = require('../models/DingTalkConfig');
    const config = await DingTalkConfig.find();

    // 获取待办信息（不需要认证，因为是从钉钉跳转过来的）
    const Todo = require('../models/Todo');
    const todo = await Todo.findById(todoId);
    
    if (!todo) {
      return res.status(404).send(`
        <html>
          <head><title>待办不存在</title></head>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h1>待办不存在</h1>
            <p>找不到ID为 ${todoId} 的待办</p>
          </body>
        </html>
      `);
    }

    // 解析 metadata（如果是字符串）
    let metadata = {};
    if (todo.metadata) {
      try {
        metadata = typeof todo.metadata === 'string' ? JSON.parse(todo.metadata) : todo.metadata;
      } catch (e) {
        console.error('解析 metadata 失败:', e);
      }
    }
    
    // 兼容不同的字段名：instanceId 或 workflowInstanceId
    if (!metadata.instanceId && metadata.workflowInstanceId) {
      metadata.instanceId = metadata.workflowInstanceId;
      console.log('[redirectTodoDetail] 使用 workflowInstanceId 作为 instanceId:', metadata.instanceId);
    }
    
    console.log('[redirectTodoDetail] 解析后的 metadata:', JSON.stringify(metadata, null, 2));

    // 获取发起人信息
    let initiator = null;
    let initiatorName = '系统';
    let initiatorDepartment = '';
    let initiatorAvatar = '';
    let workflowInstance = null;
    let approvalProgress = [];
    
    try {
      const User = require('../models/User');
      const { pool } = require('../config/database');
      const connection = await pool.getConnection();
      
      try {
        // 从metadata中获取initiatorId，或者从workflow_instance获取
        let initiatorId = metadata.initiatorId;
        
        // 如果没有，尝试从workflow_instance获取
        if (!initiatorId && metadata.instanceId) {
          const [instances] = await connection.execute(
            'SELECT * FROM workflow_instances WHERE id = ?',
            [metadata.instanceId]
          );
          if (instances.length > 0) {
            workflowInstance = instances[0];
            initiatorId = workflowInstance.initiatorId;
          }
        }
        
        // 如果还是没有，使用todo的创建者
        if (!initiatorId) {
          initiatorId = todo.createdBy || todo.assigneeId;
        }
        
        if (initiatorId) {
          initiator = await User.findById(initiatorId);
          if (initiator) {
            initiatorName = initiator.name || initiator.username || '未知用户';
            initiatorDepartment = initiator.department || '未设置部门';
            initiatorAvatar = initiator.avatar || '';
          }
        }
        
        // 获取审批进度（workflow_tasks的历史记录，包括所有状态）
        console.log('[redirectTodoDetail] ========== 开始获取审批进度 ==========');
        console.log('[redirectTodoDetail] metadata.instanceId:', metadata.instanceId);
        if (metadata.instanceId) {
          // 确保 workflowInstance 已获取
          if (!workflowInstance) {
            console.log('[redirectTodoDetail] workflowInstance 不存在，从数据库获取');
            const [instances] = await connection.execute(
              'SELECT * FROM workflow_instances WHERE id = ?',
              [metadata.instanceId]
            );
            if (instances.length > 0) {
              workflowInstance = instances[0];
              console.log('[redirectTodoDetail] 从数据库获取到 workflowInstance:', workflowInstance.id, 'workflowId:', workflowInstance.workflowId);
            } else {
              console.log('[redirectTodoDetail] 数据库中没有找到 workflowInstance');
            }
          } else {
            console.log('[redirectTodoDetail] workflowInstance 已存在:', workflowInstance.id, 'workflowId:', workflowInstance.workflowId);
          }
          
          const [tasks] = await connection.execute(
            `SELECT wt.*, u.name as userName, u.username 
             FROM workflow_tasks wt 
             LEFT JOIN users u ON wt.assigneeId = u.id 
             WHERE wt.instanceId = ? 
             ORDER BY wt.createdAt ASC`,
            [metadata.instanceId]
          );
          
          // 同时获取所有审批记录（包括已完成的、已拒绝的等所有状态）
          const [allTasks] = await connection.execute(
            `SELECT wt.*, u.name as userName, u.username 
             FROM workflow_tasks wt 
             LEFT JOIN users u ON wt.assigneeId = u.id 
             WHERE wt.instanceId = ? 
             ORDER BY wt.createdAt ASC`,
            [metadata.instanceId]
          );
          
          console.log('[redirectTodoDetail] 所有任务记录（包括所有状态）:', allTasks.map(t => ({
            id: t.id,
            nodeKey: t.nodeKey,
            nodeId: t.nodeId,
            nodeName: t.nodeName,
            status: t.status,
            action: t.action,
            comment: t.comment,
            userName: t.userName,
            assigneeId: t.assigneeId,
            createdAt: t.createdAt,
            approvedAt: t.approvedAt
          })));
          
          console.log('[redirectTodoDetail] 所有任务详情:', tasks.map(t => ({
            id: t.id,
            nodeKey: t.nodeKey,
            nodeId: t.nodeId,
            nodeName: t.nodeName,
            status: t.status,
            action: t.action,
            userName: t.userName,
            assigneeId: t.assigneeId,
            createdAt: t.createdAt,
            approvedAt: t.approvedAt
          })));
          
          console.log('[redirectTodoDetail] 找到任务数量:', tasks.length);
          if (tasks.length > 0) {
            console.log('[redirectTodoDetail] 任务列表:', tasks.map(t => ({ id: t.id, nodeKey: t.nodeKey, nodeName: t.nodeName, status: t.status, userName: t.userName, assigneeId: t.assigneeId })));
          }
          console.log('[redirectTodoDetail] workflowInstance:', workflowInstance ? '存在' : '不存在');
          console.log('[redirectTodoDetail] workflowId:', workflowInstance?.workflowId);
          
          // 获取流程定义，以便显示完整的节点信息（包括待审批的节点）
          if (workflowInstance && workflowInstance.workflowId) {
            console.log('[redirectTodoDetail] 开始获取流程定义，workflowId:', workflowInstance.workflowId);
            const [workflowDef] = await connection.execute(
              'SELECT * FROM workflow_definitions WHERE id = ?',
              [workflowInstance.workflowId]
            );
            
            console.log('[redirectTodoDetail] 流程定义数量:', workflowDef.length);
            if (workflowDef.length > 0) {
              console.log('[redirectTodoDetail] 开始获取流程节点，workflowId:', workflowInstance.workflowId);
              const [nodes] = await connection.execute(
                'SELECT * FROM workflow_nodes WHERE workflowId = ? ORDER BY sortOrder ASC',
                [workflowInstance.workflowId]
              );
              
              console.log('[redirectTodoDetail] 流程节点总数:', nodes.length);
              if (nodes.length > 0) {
                console.log('[redirectTodoDetail] 节点列表:', nodes.map(n => ({ nodeKey: n.nodeKey, nodeType: n.nodeType, name: n.name, assigneeType: n.assigneeType, assigneeId: n.assigneeId })));
              }
                  
                  // 构建完整的进度列表
                  approvalProgress = [];
                  
                  // 检查流程是否已终止（拒绝或取消）
                  const isTerminated = workflowInstance.status === 'rejected' || workflowInstance.status === 'cancelled' || 
                                      allTasks.some(t => t.status === 'rejected' || t.action === 'reject');
                  
                  console.log('[redirectTodoDetail] 流程状态:', workflowInstance.status, '是否已终止:', isTerminated);
                  
                  // 1. 先添加发起人的"提交申请"记录
                  approvalProgress.push({
                    id: 'submit',
                    nodeName: '提交申请',
                    assigneeName: initiatorName,
                    assigneeAvatar: initiatorAvatar,
                    status: 'completed',
                    action: 'submit',
                    comment: '',
                    createdAt: workflowInstance?.createdAt || todo.createdAt,
                    approvedAt: workflowInstance?.createdAt || todo.createdAt,
                    nodeKey: 'start'
                  });
                  
                  console.log('[redirectTodoDetail] ✅ 添加发起人提交申请记录:', initiatorName);
                  
                  // 2. 然后添加所有任务记录，按创建时间排序显示（包括所有状态：已完成、已拒绝、待处理等）
                  console.log('[redirectTodoDetail] 直接使用所有任务记录，数量:', allTasks.length);
                  
                  for (const task of allTasks) {
                    // 获取审批人头像
                    let assigneeAvatar = '';
                    if (task.assigneeId) {
                      try {
                        const [assigneeUser] = await connection.execute(
                          'SELECT avatar FROM users WHERE id = ?',
                          [task.assigneeId]
                        );
                        if (assigneeUser.length > 0 && assigneeUser[0].avatar) {
                          assigneeAvatar = assigneeUser[0].avatar;
                        }
                      } catch (e) {
                        // 如果avatar字段不存在，忽略
                        console.log('[redirectTodoDetail] 无法获取头像（字段可能不存在）');
                      }
                    }
                    
                    approvalProgress.push({
                      id: task.id,
                      nodeName: task.nodeName || '审批节点',
                      assigneeName: task.userName || task.username || '未知用户',
                      assigneeAvatar: assigneeAvatar,
                      status: task.status,
                      action: task.action,
                      comment: task.comment,
                      createdAt: task.createdAt,
                      approvedAt: task.approvedAt,
                      nodeKey: task.nodeKey
                    });
                    
                    console.log('[redirectTodoDetail] ✅ 添加任务记录:', {
                      id: task.id,
                      nodeName: task.nodeName,
                      assigneeName: task.userName || task.username,
                      status: task.status,
                      action: task.action
                    });
                  }
                  
                  // 3. 如果流程已终止（拒绝或取消），不再显示待审批节点
                  if (!isTerminated) {
                    // 如果还有未处理的节点（没有对应任务记录的），也显示出来
                    const processedNodeKeys = new Set(allTasks.map(t => t.nodeKey).filter(k => k));
                    for (const node of nodes) {
                      // 跳过开始节点和结束节点
                      if (node.nodeType === 'start' || node.nodeType === 'end') {
                        continue;
                      }
                      
                      // 如果节点还没有对应的任务记录，添加为待审批
                      if (!processedNodeKeys.has(node.nodeKey)) {
                        // 如果节点没有分配人（assigneeType和assigneeId都是undefined），不显示"待分配"
                        if (!node.assigneeType || !node.assigneeId) {
                          console.log('[redirectTodoDetail] 跳过未分配节点:', node.nodeKey, node.name);
                          continue;
                        }
                        
                        let assigneeName = '待分配';
                        let assigneeAvatar = '';
                        
                        if (node.assigneeType === 'user' && node.assigneeId) {
                          const [assigneeUser] = await connection.execute(
                            'SELECT name, username FROM users WHERE id = ?',
                            [node.assigneeId]
                          );
                          if (assigneeUser.length > 0) {
                            assigneeName = assigneeUser[0].name || assigneeUser[0].username || '未知用户';
                            try {
                              const [avatarUser] = await connection.execute(
                                'SELECT avatar FROM users WHERE id = ?',
                                [node.assigneeId]
                              );
                              if (avatarUser.length > 0 && avatarUser[0].avatar) {
                                assigneeAvatar = avatarUser[0].avatar;
                              }
                            } catch (e) {
                              console.log('[redirectTodoDetail] 无法获取头像（字段可能不存在）');
                            }
                          }
                        } else if (node.assigneeType === 'role' && node.assigneeId) {
                          const [role] = await connection.execute(
                            'SELECT name FROM roles WHERE id = ?',
                            [node.assigneeId]
                          );
                          if (role.length > 0) {
                            assigneeName = role[0].name || '角色审批';
                          }
                        } else if (node.assigneeType === 'department' && node.assigneeId) {
                          assigneeName = '部门审批';
                        }
                        
                        approvalProgress.push({
                          id: `pending_${node.nodeKey}`,
                          nodeName: node.name || '审批节点',
                          assigneeName: assigneeName,
                          assigneeAvatar: assigneeAvatar,
                          status: 'pending',
                          action: null,
                          comment: null,
                          createdAt: null,
                          approvedAt: null,
                          nodeKey: node.nodeKey
                        });
                      }
                    }
                  } else {
                    console.log('[redirectTodoDetail] 流程已终止，不显示待审批节点');
                  }
                  console.log('[redirectTodoDetail] ✅ 有流程定义，最终审批进度数量:', approvalProgress.length);
                  console.log('[redirectTodoDetail] ✅ 审批进度详情:', JSON.stringify(approvalProgress.map(p => ({ id: p.id, nodeName: p.nodeName, assigneeName: p.assigneeName, status: p.status })), null, 2));
                } else {
                  console.log('[redirectTodoDetail] ⚠️  没有找到流程定义，尝试从任务记录构建流程');
                  // 如果没有流程定义，先添加提交申请，然后显示任务记录
                  approvalProgress = [{
                    id: 'submit',
                    nodeName: '提交申请',
                    assigneeName: initiatorName,
                    status: 'completed',
                    action: 'submit',
                    comment: '',
                    createdAt: workflowInstance?.createdAt || todo.createdAt,
                    approvedAt: workflowInstance?.createdAt || todo.createdAt
                  }];
                  
                  // 按创建时间排序任务
                  const sortedTasks = tasks.sort((a, b) => {
                    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return timeA - timeB;
                  });
                  
                  console.log('[redirectTodoDetail] 任务记录数量:', sortedTasks.length);
                  sortedTasks.forEach(task => {
                    console.log('[redirectTodoDetail] 添加任务记录:', task.id, task.nodeName, task.status);
                    approvalProgress.push({
                      id: task.id,
                      nodeName: task.nodeName || '审批节点',
                      assigneeName: task.userName || task.username || '未知用户',
                      status: task.status,
                      action: task.action,
                      comment: task.comment,
                      createdAt: task.createdAt,
                      approvedAt: task.approvedAt
                    });
                  });
                  
                  console.log('[redirectTodoDetail] ⚠️  没有流程定义，最终审批进度数量:', approvalProgress.length);
                  console.log('[redirectTodoDetail] ⚠️  审批进度详情:', JSON.stringify(approvalProgress.map(p => ({ id: p.id, nodeName: p.nodeName, assigneeName: p.assigneeName, status: p.status })), null, 2));
                }
              } else {
                console.log('[redirectTodoDetail] 没有流程实例，只显示任务记录');
                // 如果没有流程实例，先添加提交申请，然后显示任务记录
                approvalProgress = [{
                  id: 'submit',
                  nodeName: '提交申请',
                  assigneeName: initiatorName,
                  status: 'completed',
                  action: 'submit',
                  comment: '',
                  createdAt: todo.createdAt,
                  approvedAt: todo.createdAt
                }];
                
                // 按创建时间排序任务
                const sortedTasks = tasks.sort((a, b) => {
                  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  return timeA - timeB;
                });
                
                sortedTasks.forEach(task => {
                  approvalProgress.push({
                    id: task.id,
                    nodeName: task.nodeName || '审批节点',
                    assigneeName: task.userName || task.username || '未知用户',
                    status: task.status,
                    action: task.action,
                    comment: task.comment,
                    createdAt: task.createdAt,
                    approvedAt: task.approvedAt
                  });
                });
                
                console.log('[redirectTodoDetail] 没有流程实例，最终审批进度数量:', approvalProgress.length);
              }
        }
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('获取发起人信息失败:', error);
    }

    // 获取关联模块的详细信息
    let moduleDetails = null;
    let customerName = null;
    let products = [];
    let moduleContent = null;
    
    if (todo.moduleType && todo.moduleId) {
      try {
        const moduleType = todo.moduleType === 'contracts' ? 'contract' : (todo.moduleType === 'opportunities' ? 'opportunity' : todo.moduleType);
        
        if (moduleType === 'contract') {
          const Contract = require('../models/Contract');
          const ContractProduct = require('../models/ContractProduct');
          moduleDetails = await Contract.findById(todo.moduleId);
          if (moduleDetails) {
            // 优先从客户表获取完整的客户名称（全称）
            if (moduleDetails.customerId) {
              try {
                const { pool } = require('../config/database');
                const connection = await pool.getConnection();
                try {
                  const [customerRows] = await connection.execute(
                    'SELECT name FROM customers WHERE id = ?',
                    [moduleDetails.customerId]
                  );
                  if (customerRows.length > 0 && customerRows[0].name) {
                    customerName = customerRows[0].name;
                    console.log('[redirectTodoDetail] 从客户表获取客户名称（全称）:', customerName);
                  } else {
                    customerName = moduleDetails.customerName || null;
                    console.log('[redirectTodoDetail] 客户表中未找到，使用合同中的customerName:', customerName);
                  }
                } finally {
                  connection.release();
                }
              } catch (customerError) {
                console.error('[redirectTodoDetail] 获取客户名称失败:', customerError);
                customerName = moduleDetails.customerName || null;
              }
            } else {
              customerName = moduleDetails.customerName || null;
            }
            moduleContent = moduleDetails.content || null;
            // 获取产品明细
            products = await ContractProduct.findByContractId(todo.moduleId);
          }
        } else if (moduleType === 'opportunity') {
          const Opportunity = require('../models/Opportunity');
          moduleDetails = await Opportunity.findById(todo.moduleId);
          if (moduleDetails) {
            // 优先从客户表获取完整的客户名称（全称）
            if (moduleDetails.customerId) {
              try {
                const { pool } = require('../config/database');
                const connection = await pool.getConnection();
                try {
                  const [customerRows] = await connection.execute(
                    'SELECT name FROM customers WHERE id = ?',
                    [moduleDetails.customerId]
                  );
                  if (customerRows.length > 0 && customerRows[0].name) {
                    customerName = customerRows[0].name;
                    console.log('[redirectTodoDetail] 从客户表获取客户名称（全称）:', customerName);
                  } else {
                    customerName = moduleDetails.customerName || null;
                    console.log('[redirectTodoDetail] 客户表中未找到，使用商机中的customerName:', customerName);
                  }
                } finally {
                  connection.release();
                }
              } catch (customerError) {
                console.error('[redirectTodoDetail] 获取客户名称失败:', customerError);
                customerName = moduleDetails.customerName || null;
              }
            } else {
              customerName = moduleDetails.customerName || null;
            }
            moduleContent = moduleDetails.description || null;
          }
        } else if (moduleType === 'invoice' || moduleType === 'invoices') {
          const Invoice = require('../models/Invoice');
          moduleDetails = await Invoice.findById(todo.moduleId);
          if (moduleDetails) {
            moduleContent = moduleDetails.description || null;
          }
        }
      } catch (moduleError) {
        console.error('获取关联模块信息失败:', moduleError);
      }
    }

    // 构建HTML页面
    const statusLabels = {
      pending: '待处理',
      in_progress: '进行中',
      completed: '已完成',
      cancelled: '已取消',
    };

    const priorityLabels = {
      low: '低',
      medium: '中',
      high: '高',
      urgent: '紧急',
    };

    const moduleTypeMap = {
      'contract': '合同',
      'contracts': '合同',
      'opportunity': '商机',
      'opportunities': '商机',
      'customer': '客户',
      'customers': '客户',
    };

    // 获取服务器地址（后端API地址）
    // 优先级：环境变量 SERVER_URL > 数据库配置 serverUrl > 从数据库host推断
    let apiBaseUrl = process.env.SERVER_URL;
    
    if (!apiBaseUrl) {
      // 尝试从数据库配置获取 serverUrl
      if (config.serverUrl) {
        apiBaseUrl = config.serverUrl;
        console.log('[redirectTodoDetail] 📍 使用数据库配置的serverUrl:', apiBaseUrl);
      } else {
        // 从数据库host推断（但数据库host是MySQL地址，不一定是后端地址）
        const dbConfig = require('../config/database');
        const serverHost = dbConfig.pool?.config?.host || '39.106.142.253';
        const serverPort = process.env.PORT || 3000;
        apiBaseUrl = `http://${serverHost}:${serverPort}`;
        console.log('[redirectTodoDetail] ⚠️  从数据库host推断服务器地址:', apiBaseUrl);
        console.log('[redirectTodoDetail] ⚠️  建议：在钉钉配置中设置 serverUrl（后端公网可访问地址）');
      }
    } else {
      console.log('[redirectTodoDetail] 📍 使用环境变量 SERVER_URL:', apiBaseUrl);
    }
    
    console.log('[redirectTodoDetail] 🔗 API基础地址:', apiBaseUrl);

    // 生成操作按钮HTML
    let actionButtons = '';
    if (todo.status === 'pending' && todo.type === 'approval') {
      actionButtons = `
        <div class="action-section">
          <div class="action-title">审批操作</div>
          <form id="approvalForm">
            <div class="form-group">
              <label class="form-label">审批意见</label>
              <textarea id="comment" name="comment" class="form-control" rows="4" placeholder="请输入审批意见..."></textarea>
            </div>
            <div class="button-group">
              <button type="button" onclick="submitApproval('approve')" class="btn btn-primary">同意</button>
              <button type="button" onclick="submitApproval('reject')" class="btn btn-danger">拒绝</button>
              <button type="button" onclick="submitApproval('return')" class="btn btn-warning">退回</button>
            </div>
          </form>
          <div id="message" class="message"></div>
        </div>
      `;
    } else if (todo.status === 'pending') {
      actionButtons = `
        <div class="action-section">
          <div class="action-title">操作</div>
          <form id="completeForm">
            <div class="form-group">
              <label class="form-label">备注</label>
              <textarea id="comment" name="comment" class="form-control" rows="4" placeholder="请输入备注..."></textarea>
            </div>
            <div class="button-group">
              <button type="button" onclick="completeTodo()" class="btn btn-primary">完成</button>
            </div>
          </form>
          <div id="message" class="message"></div>
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>待办详情 - ${todo.title}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
              background: #f0f2f5;
              padding: 20px;
              min-height: 100vh;
            }
            .modal-container {
              max-width: 900px;
              margin: 0 auto;
              background: white;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              overflow: hidden;
            }
            .modal-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 16px 24px;
              border-bottom: 1px solid #e8e8e8;
              background: white;
            }
            .modal-title {
              font-size: 16px;
              font-weight: 500;
              color: #262626;
              flex: 1;
            }
            .header-actions {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .action-icon {
              font-size: 16px;
              color: #8c8c8c;
              cursor: pointer;
              padding: 4px;
              border-radius: 4px;
              transition: all 0.2s;
            }
            .action-icon:hover {
              background: #f0f0f0;
              color: #262626;
            }
            .close-btn {
              background: none;
              border: none;
              font-size: 20px;
              color: #8c8c8c;
              cursor: pointer;
              padding: 0;
              width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 4px;
              transition: all 0.2s;
            }
            .close-btn:hover {
              background: #f0f0f0;
              color: #262626;
            }
            .top-info-bar {
              padding: 20px 24px;
              background: #fafafa;
              border-bottom: 1px solid #e8e8e8;
            }
            .info-row-top {
              display: flex;
              flex-direction: row;
              align-items: flex-start;
              gap: 32px;
              flex-wrap: nowrap;
              overflow-x: auto;
            }
            .info-item-top {
              display: flex;
              flex-direction: column;
              gap: 4px;
              min-width: 0;
            }
            .status-badge {
              padding: 4px 12px;
              border-radius: 4px;
              font-size: 14px;
              font-weight: 500;
            }
            .status-pending {
              background: #fff7e6;
              color: #d46b08;
              border: 1px solid #ffe7ba;
            }
            .status-completed {
              background: #f6ffed;
              color: #52c41a;
              border: 1px solid #b7eb8f;
            }
            .status-in_progress {
              background: #e6f7ff;
              color: #1890ff;
              border: 1px solid #91d5ff;
            }
            .status-cancelled {
              background: #fff1f0;
              color: #ff4d4f;
              border: 1px solid #ffccc7;
            }
            .info-label-inline {
              font-size: 12px;
              color: #8c8c8c;
              line-height: 1.5;
            }
            .info-value-inline {
              font-size: 14px;
              color: #262626;
              display: flex;
              align-items: center;
              gap: 6px;
              line-height: 1.5;
            }
            .avatar {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: #1890ff;
              color: white;
              font-size: 12px;
              font-weight: 500;
            }
            .avatar-small {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #1890ff;
              color: white;
              font-size: 11px;
              font-weight: 500;
            }
            .form-data-section {
              padding: 24px;
              border-bottom: 1px solid #e8e8e8;
              background: white;
            }
            .approval-progress-section {
              padding: 24px;
              background: white;
              border-top: 1px solid #e8e8e8;
            }
            .section-divider {
              height: 12px;
              background: #f0f2f5;
              border-top: 1px solid #e8e8e8;
              border-bottom: 1px solid #e8e8e8;
            }
            .progress-list {
              display: flex;
              flex-direction: column;
              gap: 0;
              position: relative;
            }
            .progress-item {
              display: flex;
              align-items: flex-start;
              gap: 12px;
              position: relative;
              padding-bottom: 20px;
            }
            .progress-item:not(:last-child)::after {
              content: '';
              position: absolute;
              left: 11px;
              top: 24px;
              width: 2px;
              height: calc(100% - 4px);
              background: #e8e8e8;
            }
            .progress-item:not(:last-child) .progress-icon.completed::after {
              content: '';
              position: absolute;
              left: 11px;
              top: 24px;
              width: 2px;
              height: calc(100% - 4px);
              background: #52c41a;
            }
            .progress-icon {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              font-size: 14px;
              font-weight: bold;
              flex-shrink: 0;
              position: relative;
              z-index: 1;
            }
            .progress-icon.completed {
              background: #f6ffed;
              color: #52c41a;
              border: 2px solid #b7eb8f;
            }
            .progress-icon.rejected {
              background: #fff1f0;
              color: #ff4d4f;
              border: 2px solid #ffccc7;
            }
            .progress-icon.pending {
              background: #f0f0f0;
              color: #8c8c8c;
              border: 2px solid #d9d9d9;
            }
            .progress-content {
              flex: 1;
            }
            .progress-user {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 4px;
            }
            .progress-name {
              font-size: 14px;
              color: #262626;
              font-weight: 500;
            }
            .progress-time {
              font-size: 12px;
              color: #8c8c8c;
              margin-bottom: 4px;
            }
            .progress-action {
              font-size: 14px;
              color: #262626;
              margin-bottom: 4px;
            }
            .progress-comment {
              font-size: 13px;
              color: #595959;
              margin-top: 4px;
              padding: 8px;
              background: #fafafa;
              border-radius: 4px;
            }
            .modal-body {
              padding: 24px;
            }
            .section-title {
              font-size: 16px;
              font-weight: 500;
              color: #262626;
              margin-bottom: 16px;
            }
            .info-list {
              display: flex;
              flex-direction: column;
              gap: 0;
            }
            .info-item {
              display: flex;
              padding: 12px 0;
              border-bottom: 1px solid #f0f0f0;
              min-height: 44px;
              align-items: flex-start;
            }
            .info-item:last-child {
              border-bottom: none;
            }
            .info-label {
              width: 100px;
              color: #8c8c8c;
              font-size: 14px;
              flex-shrink: 0;
              padding-right: 16px;
            }
            .info-value {
              flex: 1;
              color: #262626;
              font-size: 14px;
              word-break: break-word;
            }
            .info-value strong {
              color: #262626;
              font-weight: 500;
            }
            .tag {
              display: inline-block;
              padding: 2px 8px;
              border-radius: 2px;
              font-size: 12px;
              line-height: 20px;
              font-weight: 400;
            }
            .tag-approval {
              background: #fff1f0;
              color: #ff4d4f;
              border: 1px solid #ffccc7;
            }
            .tag-pending {
              background: #fff7e6;
              color: #d46b08;
              border: 1px solid #ffe7ba;
            }
            .tag-completed {
              background: #f6ffed;
              color: #52c41a;
              border: 1px solid #b7eb8f;
            }
            .tag-cancelled {
              background: #fff1f0;
              color: #ff4d4f;
              border: 1px solid #ffccc7;
            }
            .tag-medium {
              background: #e6f7ff;
              color: #1890ff;
              border: 1px solid #91d5ff;
            }
            .tag-high {
              background: #fff7e6;
              color: #d46b08;
              border: 1px solid #ffe7ba;
            }
            .amount-value {
              color: #ff4d4f;
              font-weight: 500;
              font-size: 14px;
            }
            .product-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
            }
            .product-table th {
              background: #fafafa;
              padding: 10px 12px;
              text-align: left;
              font-weight: 500;
              font-size: 13px;
              color: #595959;
              border-bottom: 1px solid #e8e8e8;
            }
            .product-table th:last-child,
            .product-table td:last-child {
              text-align: right;
            }
            .product-table td {
              padding: 10px 12px;
              border-bottom: 1px solid #f0f0f0;
              font-size: 13px;
              color: #262626;
            }
            .product-table tr:last-child td {
              background: #fafafa;
              font-weight: 500;
              border-bottom: none;
            }
            .product-table .total-amount {
              color: #ff4d4f;
            }
            .action-section {
              margin-top: 24px;
              padding-top: 24px;
              border-top: 1px solid #e8e8e8;
            }
            .action-title {
              font-size: 14px;
              font-weight: 500;
              color: #262626;
              margin-bottom: 16px;
            }
            .form-group {
              margin-bottom: 16px;
            }
            .form-label {
              display: block;
              margin-bottom: 8px;
              font-size: 14px;
              color: #262626;
              font-weight: 400;
            }
            .form-control {
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #d9d9d9;
              border-radius: 4px;
              font-size: 14px;
              font-family: inherit;
              transition: border-color 0.2s;
            }
            .form-control:focus {
              outline: none;
              border-color: #1890ff;
              box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
            }
            textarea.form-control {
              resize: vertical;
              min-height: 80px;
            }
            .button-group {
              display: flex;
              gap: 12px;
              margin-top: 20px;
            }
            .btn {
              padding: 8px 20px;
              border-radius: 4px;
              font-size: 14px;
              cursor: pointer;
              border: none;
              transition: all 0.2s;
              font-weight: 400;
            }
            .btn-primary {
              background: #1890ff;
              color: white;
            }
            .btn-primary:hover {
              background: #40a9ff;
            }
            .btn-danger {
              background: white;
              color: #ff4d4f;
              border: 1px solid #ff4d4f;
            }
            .btn-danger:hover {
              background: #fff1f0;
            }
            .btn-warning {
              background: white;
              color: #faad14;
              border: 1px solid #faad14;
            }
            .btn-warning:hover {
              background: #fffbe6;
            }
            .btn:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
            .message {
              margin-top: 16px;
              padding: 12px;
              border-radius: 4px;
              font-size: 14px;
              display: none;
            }
            .message-success {
              background: #f6ffed;
              color: #52c41a;
              border: 1px solid #b7eb8f;
            }
            .message-error {
              background: #fff1f0;
              color: #ff4d4f;
              border: 1px solid #ffccc7;
            }
            .message-info {
              background: #e6f7ff;
              color: #1890ff;
              border: 1px solid #91d5ff;
            }
          </style>
        </head>
        <body>
          <div class="modal-container">
            <div class="modal-header">
              <div class="modal-title">${todo.title || '待办详情'}</div>
              <div class="header-actions">
                <span class="action-icon" title="附件">📎</span>
                <span class="action-icon" title="参与者">👥</span>
                <span class="action-icon" title="更多">⋯</span>
                <button class="close-btn" onclick="window.close()" title="关闭">×</button>
              </div>
            </div>
            <div class="modal-body">
              <!-- 顶部信息栏：状态、发起人、发起人部门、流程版本号 -->
              <div class="top-info-bar">
                <div class="info-row-top">
                  <div class="info-item-top">
                    <span class="info-label-inline">当前状态</span>
                    <span class="status-badge status-${todo.status}">
                      ${statusLabels[todo.status] || todo.status}
                    </span>
                  </div>
                  <div class="info-item-top">
                    <span class="info-label-inline">发起人</span>
                    <span class="info-value-inline">
                      ${initiatorAvatar ? `<img src="${initiatorAvatar}" alt="${initiatorName}" class="avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';" /><span class="avatar" style="display:none;">${initiatorName.charAt(0)}</span>` : `<span class="avatar">${initiatorName.charAt(0)}</span>`}
                      ${initiatorName}
                    </span>
                  </div>
                  <div class="info-item-top">
                    <span class="info-label-inline">发起人部门</span>
                    <span class="info-value-inline">${initiatorDepartment || '未设置'}</span>
                  </div>
                  <div class="info-item-top">
                    <span class="info-label-inline">流程版本号</span>
                    <span class="info-value-inline">V${workflowInstance?.version || 0}</span>
                  </div>
                </div>
              </div>
              
              <!-- 表单数据区域 -->
              <div class="form-data-section">
                <div class="section-title">表单数据</div>
                <div class="info-list">
                ${customerName ? `
                <div class="info-item">
                  <div class="info-label">客户名称</div>
                  <div class="info-value"><strong>${String(customerName).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong></div>
                </div>
                ` : ''}
                
                ${moduleDetails && moduleDetails.contractNumber ? `
                <div class="info-item">
                  <div class="info-label">合同编号</div>
                  <div class="info-value">${String(moduleDetails.contractNumber).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                </div>
                ` : ''}
                
                ${moduleDetails && moduleDetails.amount ? `
                <div class="info-item">
                  <div class="info-label">合同金额</div>
                  <div class="info-value"><span class="amount-value">¥${parseFloat(moduleDetails.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                </div>
                ` : ''}
                
                
                ${products && products.length > 0 ? `
                <div class="info-item" style="flex-direction: column; align-items: stretch; padding-top: 16px;">
                  <div class="info-label" style="width: 100%; margin-bottom: 8px;">产品明细</div>
                  <div class="info-value" style="width: 100%;">
                    <table class="product-table">
                      <thead>
                        <tr>
                          <th>产品</th>
                          <th>数量</th>
                          <th>单价</th>
                          <th>金额</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${products.map((p, idx) => {
                          const productName = String(p.productName || '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                          const quantity = p.quantity || 0;
                          const unitPrice = parseFloat(p.unitPrice || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          const amount = parseFloat(p.amount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          return `
                          <tr>
                            <td>${productName}</td>
                            <td style="text-align: right;">${quantity}</td>
                            <td style="text-align: right;">¥${unitPrice}</td>
                            <td style="text-align: right; font-weight: 500;">¥${amount}</td>
                          </tr>
                        `;
                        }).join('')}
                        <tr>
                          <td colspan="3" style="text-align: right; font-weight: 500;">合计：</td>
                          <td style="text-align: right; font-weight: 500;" class="total-amount">¥${products.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                ` : ''}
                
              </div>
              
              <div class="section-divider"></div>
              
              <!-- 审批进度 -->
              <div class="approval-progress-section">
                <div class="section-title">审批进度</div>
                <div class="progress-list">
                  ${approvalProgress && approvalProgress.length > 0 ? approvalProgress.map((progress, idx) => {
                    const statusIcon = progress.status === 'completed' || progress.status === 'approved' 
                      ? '<span class="progress-icon completed">✓</span>' 
                      : progress.status === 'rejected' 
                      ? '<span class="progress-icon rejected">✗</span>' 
                      : '<span class="progress-icon pending">○</span>';
                    const actionText = progress.action === 'approve' ? '同意' : progress.action === 'reject' ? '拒绝' : progress.action === 'return' ? '退回' : progress.action === 'submit' ? '提交申请' : (progress.status === 'pending' ? '待审批' : '');
                    const time = progress.approvedAt ? new Date(progress.approvedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : (progress.createdAt ? new Date(progress.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
                    const avatarHtml = progress.assigneeAvatar 
                      ? `<img src="${progress.assigneeAvatar}" alt="${progress.assigneeName}" class="avatar-small-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';" /><span class="avatar-small" style="display:none;">${progress.assigneeName.charAt(0)}</span>`
                      : `<span class="avatar-small">${progress.assigneeName.charAt(0)}</span>`;
                    return `
                      <div class="progress-item">
                        ${statusIcon}
                        <div class="progress-content">
                          <div class="progress-user">
                            ${avatarHtml}
                            <span class="progress-name">${progress.assigneeName}</span>
                          </div>
                          ${time ? `<div class="progress-time">${time}</div>` : ''}
                          ${actionText ? `<div class="progress-action">${actionText}</div>` : ''}
                          ${progress.comment ? `<div class="progress-comment">${String(progress.comment).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
                        </div>
                      </div>
                    `;
                  }).join('') : `
                    <div class="progress-item">
                      <span class="progress-icon completed">✓</span>
                      <div class="progress-content">
                        <div class="progress-user">
                          ${initiatorAvatar ? `<img src="${initiatorAvatar}" alt="${initiatorName}" class="avatar-small-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';" /><span class="avatar-small" style="display:none;">${initiatorName.charAt(0)}</span>` : `<span class="avatar-small">${initiatorName.charAt(0)}</span>`}
                          <span class="progress-name">${initiatorName}</span>
                        </div>
                        <div class="progress-time">${todo.createdAt ? new Date(todo.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                        <div class="progress-action">提交申请</div>
                      </div>
                    </div>
                  `}
                </div>
              </div>
              
              ${actionButtons}
            </div>
          </div>
          
          <script>
            const apiBaseUrl = '${apiBaseUrl}';
            const todoId = ${todoId};
            const moduleType = '${todo.moduleType || 'contract'}';
            const moduleId = ${todo.moduleId || 'null'};
            const taskId = ${metadata.taskId || 'null'};
            
            // 检查URL参数中的action，如果存在则自动触发审批操作
            (function() {
              const urlParams = new URLSearchParams(window.location.search);
              const action = urlParams.get('action');
              if (action && (action === 'approve' || action === 'reject')) {
                // 延迟执行，确保页面已加载
                setTimeout(() => {
                  const confirmed = confirm(action === 'approve' ? '确认同意此审批？' : '确认拒绝此审批？');
                  if (confirmed) {
                    submitApproval(action);
                  } else {
                    // 用户取消，移除URL参数
                    window.history.replaceState({}, document.title, window.location.pathname);
                  }
                }, 500);
              }
            })();
            
            // 显示/隐藏退回节点选择
            document.getElementById('action')?.addEventListener('change', function() {
              const returnNodeDiv = document.getElementById('returnNodeDiv');
              if (returnNodeDiv) {
                returnNodeDiv.style.display = this.value === 'return' ? 'block' : 'none';
              }
            });
            
            async function submitApproval(action) {
              const comment = document.getElementById('comment')?.value || '';
              const returnToNodeKey = document.getElementById('returnToNodeKey')?.value || 'start';
              const messageDiv = document.getElementById('message');
              
              // 禁用按钮
              const buttons = document.querySelectorAll('button');
              buttons.forEach(btn => btn.disabled = true);
              
              messageDiv.style.display = 'block';
              messageDiv.className = 'message message-info';
              messageDiv.textContent = '正在提交...';
              
              try {
                // 使用公开的审批接口（通过待办ID验证）
                const requestBody = {
                  action: action,
                  comment: comment,
                  recordId: ${metadata.recordId || 'null'},
                  taskId: taskId
                };
                if (action === 'return') {
                  requestBody.returnToNodeKey = returnToNodeKey;
                }
                const apiUrl = apiBaseUrl + '/api/dingtalk/todo/' + todoId + '/approve';
                console.log('提交审批请求:', { apiUrl, action, requestBody });
                
                const response = await fetch(apiUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(requestBody),
                  credentials: 'include'
                });
                
                console.log('API响应状态:', response.status, response.statusText);
                
                if (!response.ok) {
                  const errorText = await response.text();
                  console.error('API响应错误:', errorText);
                  throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                const data = await response.json();
                console.log('API响应数据:', data);
                
                if (data.success) {
                  messageDiv.className = 'message message-success';
                  messageDiv.textContent = action === 'approve' ? '审批通过！' : action === 'reject' ? '审批已拒绝！' : '已退回！';
                  setTimeout(() => {
                    window.close();
                  }, 2000);
                } else {
                  throw new Error(data.message || '操作失败');
                }
              } catch (error) {
                console.error('审批操作异常:', error);
                messageDiv.className = 'message message-error';
                let errorMsg = '操作失败: ' + error.message;
                if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
                  errorMsg += '\\n\\n可能的原因：\\n1. 后端服务未运行\\n2. 内网穿透服务未运行\\n3. 网络连接问题\\n\\nAPI地址: ' + apiBaseUrl + '/api/dingtalk/todo/' + todoId + '/approve';
                }
                messageDiv.innerHTML = errorMsg.replace(/\\n/g, '<br>');
                buttons.forEach(btn => btn.disabled = false);
              }
            }
            
            async function completeTodo() {
              const comment = document.getElementById('comment')?.value || '';
              const messageDiv = document.getElementById('message');
              
              // 禁用按钮
              const buttons = document.querySelectorAll('button');
              buttons.forEach(btn => btn.disabled = true);
              
              messageDiv.style.display = 'block';
              messageDiv.className = 'message message-info';
              messageDiv.textContent = '正在提交...';
              
              try {
                // 使用公开的完成接口（通过待办ID验证）
                const apiUrl = apiBaseUrl + '/api/dingtalk/todo/' + todoId + '/complete';
                console.log('提交完成请求:', { apiUrl, comment });
                
                const response = await fetch(apiUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    comment: comment
                  }),
                  credentials: 'include'
                });
                
                console.log('API响应状态:', response.status, response.statusText);
                
                if (!response.ok) {
                  const errorText = await response.text();
                  console.error('API响应错误:', errorText);
                  throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                const data = await response.json();
                console.log('API响应数据:', data);
                
                if (data.success) {
                  messageDiv.className = 'message message-success';
                  messageDiv.textContent = '待办已完成！';
                  setTimeout(() => {
                    window.close();
                  }, 2000);
                } else {
                  throw new Error(data.message || '操作失败');
                }
              } catch (error) {
                console.error('完成操作异常:', error);
                messageDiv.className = 'message message-error';
                let errorMsg = '操作失败: ' + error.message;
                if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
                  errorMsg += '\\n\\n可能的原因：\\n1. 后端服务未运行\\n2. 内网穿透服务未运行\\n3. 网络连接问题\\n\\nAPI地址: ' + apiBaseUrl + '/api/dingtalk/todo/' + todoId + '/complete';
                }
                messageDiv.innerHTML = errorMsg.replace(/\\n/g, '<br>');
                buttons.forEach(btn => btn.disabled = false);
              }
            }
          </script>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('[redirectTodoDetail] 渲染失败:', error);
    res.status(500).send(`
      <html>
        <head><title>错误</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>错误</h1>
          <p>加载待办详情失败: ${error.message}</p>
        </body>
      </html>
    `);
  }
};

// 通过待办ID进行审批（公开接口，不需要认证，用于钉钉跳转）
exports.approveTodoByDingTalk = async (req, res) => {
  try {
    const { todoId } = req.params;
    const { action, comment, recordId, taskId, returnToNodeKey } = req.body;
    
    if (!todoId) {
      return res.status(400).json({ success: false, message: '待办ID不能为空' });
    }
    
    // 获取待办信息
    const Todo = require('../models/Todo');
    const todo = await Todo.findById(todoId);
    
    if (!todo) {
      return res.status(404).json({ success: false, message: '待办不存在' });
    }
    
    // 获取待办分配的用户信息（用于模拟认证）
    const User = require('../models/User');
    const user = await User.findById(todo.assigneeId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: '待办分配的用户不存在' });
    }
    
    // 模拟 req.user，用于审批接口
    req.user = user;
    
    // 调用审批接口
    const approvalController = require('./approvalController');
    const moduleType = todo.moduleType || 'contract';
    const moduleId = todo.moduleId;
    
    // 设置路由参数
    req.params = { moduleType, moduleId };
    req.body = { action, comment, recordId, taskId, returnToNodeKey };
    
    // 调用审批逻辑
    await approvalController.approve(req, res);
  } catch (error) {
    console.error('[approveTodoByDingTalk] 审批失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 通过待办ID完成待办（公开接口，不需要认证，用于钉钉跳转）
exports.completeTodoByDingTalk = async (req, res) => {
  try {
    const { todoId } = req.params;
    const { comment } = req.body;
    
    if (!todoId) {
      return res.status(400).json({ success: false, message: '待办ID不能为空' });
    }
    
    // 获取待办信息
    const Todo = require('../models/Todo');
    const todo = await Todo.findById(todoId);
    
    if (!todo) {
      return res.status(404).json({ success: false, message: '待办不存在' });
    }
    
    // 获取待办分配的用户信息（用于模拟认证）
    const User = require('../models/User');
    const user = await User.findById(todo.assigneeId);
    
    if (!user) {
      return res.status(404).json({ success: false, message: '待办分配的用户不存在' });
    }
    
    // 模拟 req.user，用于完成接口
    req.user = user;
    
    // 调用完成接口
    const todoController = require('./todoController');
    req.params = { id: todoId };
    req.body = { comment };
    
    // 调用完成逻辑
    await todoController.completeTodo(req, res);
  } catch (error) {
    console.error('[completeTodoByDingTalk] 完成失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.clearSyncData = async (req, res) => {
  // 立即返回响应，不等待后台任务完成
  const responseData = {
    success: true,
    message: '清除任务已启动，正在后台执行...',
    data: { 
      status: 'processing',
      departments: { deleted: 0, errors: [] },
      dingTalkUsers: { deleted: 0, errors: [] },
      users: { deleted: 0, errors: [] }
    }
  };
  
  // 立即发送响应
  res.status(200).json(responseData);
  
  // 确保响应已发送
  res.end();
  
  // 后台异步执行清除操作（不阻塞响应）
  setImmediate(async () => {
    const { pool } = require('../config/database');
    const connection = await pool.getConnection();
    let foreignKeyDisabled = false;
    
    try {
      console.log('========== 开始清除钉钉同步数据（后台执行） ==========');
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      foreignKeyDisabled = true;
      await connection.beginTransaction();
      
      const results = {
        departments: { deleted: 0, errors: [] },
        dingTalkUsers: { deleted: 0, errors: [] },
        users: { deleted: 0, errors: [] },
      };

      try {
        console.log('\n步骤1: 删除钉钉同步的部门...');
        try {
          // 递归删除所有钉钉部门及其子部门
          // 由于已禁用外键约束，可以安全删除
          let totalDeleted = 0;
          let hasMore = true;
          let iterations = 0;
          const maxIterations = 20; // 防止无限循环，支持最多20层嵌套
          
          // 先删除所有子部门（父部门是钉钉部门的）
          while (hasMore && iterations < maxIterations) {
            iterations++;
            const [childDeptResult] = await connection.execute(
              `DELETE child
               FROM departments AS child
               INNER JOIN departments AS parent ON child.parentId = parent.id
               WHERE parent.code LIKE 'dingtalk_%'`
            );
            totalDeleted += childDeptResult.affectedRows;
            hasMore = childDeptResult.affectedRows > 0;
            if (hasMore) {
              console.log(`  🔄 第 ${iterations} 轮：删除 ${childDeptResult.affectedRows} 个子部门`);
            }
          }
          
          // 最后删除所有钉钉部门本身（code以dingtalk_开头）
          const [parentDeptResult] = await connection.execute(
            `DELETE FROM departments WHERE code LIKE 'dingtalk_%'`
          );
          totalDeleted += parentDeptResult.affectedRows;
          results.departments.deleted = totalDeleted;
          console.log(`  ✅ 共删除 ${totalDeleted} 个部门（${parentDeptResult.affectedRows} 个钉钉部门 + ${totalDeleted - parentDeptResult.affectedRows} 个子部门）`);
        } catch (error) {
          console.error('删除部门失败:', error.message);
          results.departments.errors.push({ error: error.message });
          throw error;
        }

        console.log('\n步骤2: 删除钉钉用户关联...');
        try {
          const [tableExists] = await connection.query(`SHOW TABLES LIKE 'dingtalk_users'`);
          if (tableExists.length) {
            const [userLinkResult] = await connection.execute('DELETE FROM dingtalk_users');
            results.dingTalkUsers.deleted = userLinkResult.affectedRows;
            console.log(`钉钉用户关联删除完成：共删除 ${results.dingTalkUsers.deleted} 条关联`);
          } else {
            console.log('  ⚠️ 未找到 dingtalk_users 表，跳过删除关联步骤');
          }
        } catch (error) {
          console.error('删除钉钉用户关联失败:', error.message);
          results.dingTalkUsers.errors.push({ error: error.message });
          throw error;
        }

        console.log('\n步骤3: 删除钉钉同步创建的用户...');
        try {
          const [userResult] = await connection.execute(
            `DELETE FROM users WHERE username LIKE 'dingtalk_%' OR username LIKE 'dingtalk_qr_%'`
          );
          results.users.deleted = userResult.affectedRows;
          console.log(`用户删除完成：共删除 ${results.users.deleted} 个用户`);
        } catch (error) {
          console.error('删除用户失败:', error.message);
          results.users.errors.push({ error: error.message });
          throw error;
        }

        await connection.commit();
        console.log('\n========== 清除完成 ==========');
        console.log(`部门：删除 ${results.departments.deleted} 个`);
        console.log(`钉钉用户关联：删除 ${results.dingTalkUsers.deleted} 条`);
        console.log(`用户：删除 ${results.users.deleted} 个`);
        
        // 清除部门列表缓存，确保前端显示最新数据
        try {
          const { flushByPrefix } = require('../utils/cache');
          flushByPrefix('departments');
          console.log('  ✅ 已清除部门列表缓存');
        } catch (cacheError) {
          console.error('清除缓存失败:', cacheError.message);
        }
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    } catch (error) {
      console.error('清除钉钉同步数据失败:', error);
    } finally {
      if (foreignKeyDisabled) {
        try {
          await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        } catch (err) {
          console.error('恢复 FOREIGN_KEY_CHECKS 失败:', err.message);
        }
      }
      connection.release();
    }
  })().catch(err => {
    console.error('后台清除任务执行失败:', err);
  });
};

// 前端日志接口（用于调试，公开接口）
exports.logFromFrontend = async (req, res) => {
  try {
    const { level, message, data } = req.body;
    const timestamp = new Date().toISOString();
    const logMessage = `[前端日志][${level || 'info'}] ${message || ''}`;
    
    if (data) {
      console.log(logMessage, JSON.stringify(data, null, 2));
    } else {
      console.log(logMessage);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[前端日志接口错误]', error);
    res.json({ success: true }); // 即使出错也返回成功，避免影响前端
  }
};

// 生成钉钉模板配置（读取系统流程定义和字段）
exports.generateTemplateConfig = async (req, res) => {
  try {
    const WorkflowDefinition = require('../models/WorkflowDefinition');
    const WorkflowNode = require('../models/WorkflowNode');
    const WorkflowRoute = require('../models/WorkflowRoute');
    const { pool } = require('../config/database');
    const connection = await pool.getConnection();

    try {
      // 获取所有启用的流程定义
      const workflows = await WorkflowDefinition.find({ isActive: 1 });
      
      const configs = [];
      
      for (const workflow of workflows) {
        // 获取流程节点
        const nodes = await WorkflowNode.findByWorkflowId(workflow.id);
        const routes = await WorkflowRoute.findByWorkflowId(workflow.id);

        // 生成字段列表
        const fields = generateFieldsForModule(workflow.moduleType);
        
        // 生成流程设计说明
        const processDesign = generateProcessDesignDescription(nodes, routes);

        configs.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          moduleType: workflow.moduleType,
          description: workflow.description,
          fields: fields,
          processDesign: processDesign,
          nodes: nodes.map(n => ({
            id: n.id,
            nodeKey: n.nodeKey,
            nodeType: n.nodeType,
            name: n.name,
            config: n.config
          }))
        });
      }

      res.json({
        success: true,
        data: {
          workflows: configs,
          summary: {
            totalWorkflows: configs.length,
            commonFields: generateCommonFields(),
            instructions: generateInstructions()
          }
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[generateTemplateConfig] 生成配置失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 生成模块字段
function generateFieldsForModule(moduleType) {
  const commonFields = {
    required: [
      { name: '审批内容', type: '多行文本', description: '系统自动填充模块标题和描述', mapping: 'moduleTitle' }
    ],
    optional: [
      { name: '模块类型', type: '单行文本', description: '显示审批类型（合同、商机等）', mapping: 'moduleType' },
      { name: '编号', type: '单行文本', description: '显示合同编号、商机编号等', mapping: 'number' },
      { name: '名称', type: '单行文本', description: '显示合同名称、商机名称等', mapping: 'name' },
      { name: '客户名称', type: '单行文本', description: '显示关联的客户名称', mapping: 'customerName' },
      { name: '金额', type: '数字', description: '显示合同金额、预计金额等', mapping: 'amount' },
      { name: '备注说明', type: '多行文本', description: '显示模块的备注信息', mapping: 'description' }
    ]
  };

  // 根据模块类型添加特定字段
  if (moduleType === 'contracts' || moduleType === 'contract') {
    commonFields.optional.push(
      { name: '合同类型', type: '单行文本', description: '显示合同类型', mapping: 'contractType' },
      { name: '签署日期', type: '日期', description: '显示签署日期', mapping: 'signDate' }
    );
  } else if (moduleType === 'opportunities' || moduleType === 'opportunity') {
    commonFields.optional.push(
      { name: '商机阶段', type: '单行文本', description: '显示商机阶段', mapping: 'stage' }
    );
  }

  return commonFields;
}

// 生成通用字段说明
function generateCommonFields() {
  return {
    required: ['审批内容'],
    optional: ['模块类型', '编号', '名称', '客户名称', '金额', '备注说明'],
    note: '系统已优化为使用通用模板，只需创建一个包含所有字段的模板即可处理所有模块类型'
  };
}

// 生成流程设计说明
function generateProcessDesignDescription(nodes, routes) {
  if (nodes.length === 0) {
    return { description: '暂无流程节点', steps: [] };
  }

  const steps = [];
  const approvalNodes = nodes.filter(n => n.nodeType === 'approval');
  
  approvalNodes.forEach((node, index) => {
    const config = node.config || {};
    const approvalMode = config.approvalMode || 'AND';
    
    steps.push({
      step: index + 1,
      name: node.name || node.nodeKey,
      approvalMode: approvalMode === 'AND' ? '会签（所有人都同意）' : '或签（任意一人同意）',
      approvers: config.approvers || []
    });
  });

  return {
    description: `共 ${steps.length} 个审批节点`,
    steps: steps
  };
}

// 生成配置说明
function generateInstructions() {
  return [
    '1. 登录钉钉开放平台，进入"应用开发" -> 企业内部应用 -> 墨枫CRM',
    '2. 进入"OA审批 -> 审批模板管理"中创建模板',
    '3. 按照系统生成的字段列表添加表单字段（字段名称必须完全一致）',
    '4. 按照系统生成的流程设计配置审批流程',
    '5. 获取ProcessCode并配置到系统中',
    '6. 系统会自动根据模块类型填充对应的字段'
  ];
}

// 钉钉审批回调处理（三方流程对接钉钉OA）
// 文档：https://open.dingtalk.com/document/development/use-the-three-party-process-to-interface-with-the-dingtalk-oa
exports.handleApprovalCallback = async (req, res) => {
  try {
    console.log('[handleApprovalCallback] 收到钉钉审批回调');
    console.log('[handleApprovalCallback] 请求体:', JSON.stringify(req.body, null, 2));
    
    // 钉钉回调会发送审批流程实例的信息
    const { processInstanceId, businessId, result, status, type } = req.body;
    
    if (!processInstanceId || !businessId) {
      console.error('[handleApprovalCallback] 缺少必要参数');
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    
    console.log('[handleApprovalCallback] 审批流程实例ID:', processInstanceId);
    console.log('[handleApprovalCallback] 业务ID（关联的workflow_instance ID）:', businessId);
    console.log('[handleApprovalCallback] 审批结果:', result);
    console.log('[handleApprovalCallback] 审批状态:', status);
    console.log('[handleApprovalCallback] 回调类型:', type);
    
    // businessId 应该是 workflow_instance 的 ID
    const workflowInstanceId = parseInt(businessId);
    if (isNaN(workflowInstanceId)) {
      console.error('[handleApprovalCallback] businessId 不是有效的数字', businessId);
      return res.status(400).json({ success: false, message: '无效的业务ID' });
    }
    
    // 查找流程实例
    const { pool } = require('../config/database');
    const connection = await pool.getConnection();
    
    try {
      const [instances] = await connection.execute(
        'SELECT * FROM workflow_instances WHERE id = ?',
        [workflowInstanceId]
      );
      
      if (instances.length === 0) {
        console.error('[handleApprovalCallback] 找不到流程实例', workflowInstanceId);
        return res.status(404).json({ success: false, message: '流程实例不存在' });
      }
      
      const instance = instances[0];
      console.log('[handleApprovalCallback] 找到流程实例:', instance.id, instance.status);
      
      // 根据审批结果更新流程状态
      // status: 'RUNNING' | 'COMPLETED' | 'TERMINATED' | 'CANCELED'
      // result: 'agree' | 'refuse' | 'redirect' | 'finish'
      
      const workflowEngine = require('../services/workflowEngine');
      
      if (status === 'COMPLETED' && result === 'agree') {
        // 审批通过，继续流程
        console.log('[handleApprovalCallback] 审批通过，继续流程');
        
        // 查找当前审批节点实例（优先找running的，如果没有则找最近的一个approval节点）
        let [nodeInstances] = await connection.execute(
          'SELECT * FROM workflow_node_instances WHERE instanceId = ? AND status = \'running\' AND nodeType = \'approval\' ORDER BY createdAt DESC LIMIT 1',
          [workflowInstanceId]
        );
        
        // 如果没有running的，找最近的一个approval节点实例
        if (nodeInstances.length === 0) {
          [nodeInstances] = await connection.execute(
            'SELECT * FROM workflow_node_instances WHERE instanceId = ? AND nodeType = \'approval\' ORDER BY createdAt DESC LIMIT 1',
            [workflowInstanceId]
          );
        }
        
        if (nodeInstances.length > 0) {
          const nodeInstance = nodeInstances[0];
          
          // 查找对应的审批任务（包括所有pending的任务，不限于当前节点实例）
          const [tasks] = await connection.execute(
            'SELECT * FROM workflow_tasks WHERE instanceId = ? AND status = \'pending\'',
            [workflowInstanceId]
          );
          
          // 更新所有待审批任务为已批准
          for (const task of tasks) {
            await connection.execute(
              'UPDATE workflow_tasks SET status = \'approved\', action = \'approve\', approvedAt = NOW() WHERE id = ?',
              [task.id]
            );
          }
          
          // 更新所有相关的待办状态（查询所有相关待办，然后在代码中过滤）
          const [allTodos] = await connection.execute(
            'SELECT * FROM todos WHERE type = \'approval\' AND status = \'pending\'',
            []
          );
          
          // 在代码中过滤metadata，匹配workflowInstanceId
          const matchingTodos = allTodos.filter(todo => {
            try {
              const metadata = typeof todo.metadata === 'string' 
                ? JSON.parse(todo.metadata) 
                : (todo.metadata || {});
              return metadata.workflowInstanceId === workflowInstanceId;
            } catch (e) {
              return false;
            }
          });
          
          for (const todo of matchingTodos) {
            await connection.execute(
              'UPDATE todos SET status = \'completed\', completedAt = NOW() WHERE id = ?',
              [todo.id]
            );
          }
          
          // 更新节点实例状态（如果还是running）
          if (nodeInstance.status === 'running') {
            await connection.execute(
              'UPDATE workflow_node_instances SET status = \'completed\', endTime = NOW() WHERE id = ?',
              [nodeInstance.id]
            );
            
            // 继续执行流程引擎的下一步
            await workflowEngine.executeNode(workflowInstanceId, nodeInstance.nodeId);
          }
        }
        
      } else if (status === 'TERMINATED' || (status === 'COMPLETED' && result === 'refuse')) {
        // 审批拒绝，终止流程
        console.log('[handleApprovalCallback] 审批拒绝，终止流程');
        
        // 先更新所有相关的待办状态为已取消
        const [allTodos] = await connection.execute(
          'SELECT * FROM todos WHERE type = \'approval\' AND status = \'pending\'',
          []
        );
        
        const matchingTodos = allTodos.filter(todo => {
          try {
            const metadata = typeof todo.metadata === 'string' 
              ? JSON.parse(todo.metadata) 
              : (todo.metadata || {});
            return metadata.workflowInstanceId === workflowInstanceId;
          } catch (e) {
            return false;
          }
        });
        
        for (const todo of matchingTodos) {
          await connection.execute(
            'UPDATE todos SET status = \'cancelled\', completedAt = NOW() WHERE id = ?',
            [todo.id]
          );
        }
        
        await workflowEngine.rejectWorkflow(workflowInstanceId, '审批被拒绝');
        
      } else if (status === 'CANCELED') {
        // 审批被撤销
        console.log('[handleApprovalCallback] 审批被撤销');
        
        // 先更新所有相关的待办状态为已取消
        const [allTodos] = await connection.execute(
          'SELECT * FROM todos WHERE type = \'approval\' AND status = \'pending\'',
          []
        );
        
        const matchingTodos = allTodos.filter(todo => {
          try {
            const metadata = typeof todo.metadata === 'string' 
              ? JSON.parse(todo.metadata) 
              : (todo.metadata || {});
            return metadata.workflowInstanceId === workflowInstanceId;
          } catch (e) {
            return false;
          }
        });
        
        for (const todo of matchingTodos) {
          await connection.execute(
            'UPDATE todos SET status = \'cancelled\', completedAt = NOW() WHERE id = ?',
            [todo.id]
          );
        }
        
        await workflowEngine.withdrawWorkflow(workflowInstanceId);
      }
      
      // 保存审批回调记录到metadata
      let metadata = {};
      try {
        if (instance.metadata) {
          metadata = typeof instance.metadata === 'string' 
            ? JSON.parse(instance.metadata) 
            : instance.metadata;
        }
      } catch (e) {
        console.warn('[handleApprovalCallback] 解析metadata失败:', e.message);
      }
      
      metadata.dingTalkApproval = {
        processInstanceId,
        status,
        result,
        type,
        callbackTime: new Date().toISOString(),
      };
      
      await connection.execute(
        'UPDATE workflow_instances SET metadata = ? WHERE id = ?',
        [JSON.stringify(metadata), workflowInstanceId]
      );
      
      console.log('[handleApprovalCallback] 审批回调处理完成');
      
      // 钉钉要求返回成功响应
      res.json({ success: true, message: '回调处理成功' });
      
    } catch (error) {
      console.error('[handleApprovalCallback] 处理审批回调失败:', error);
      console.error('[handleApprovalCallback] 错误堆栈:', error.stack);
      res.status(500).json({ success: false, message: error.message });
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('[handleApprovalCallback] 审批回调处理异常:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 测试接口：手动触发审批回调（仅用于本地测试）
// 使用方法：POST /api/dingtalk/approval/test-callback
// 参数：{ processInstanceId, businessId, result: 'agree'|'refuse', status: 'COMPLETED'|'TERMINATED' }
exports.testApprovalCallback = async (req, res) => {
  try {
    // 仅允许在开发环境使用
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: '此接口仅用于开发环境测试' });
    }

    const { processInstanceId, businessId, result = 'agree', status = 'COMPLETED' } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要参数：businessId（workflow_instance的ID）' 
      });
    }

    console.log('[testApprovalCallback] 手动触发审批回调测试');
    console.log('[testApprovalCallback] 参数:', { processInstanceId, businessId, result, status });

    // 直接调用回调处理函数，传入模拟的请求体
    const originalBody = req.body;
    req.body = {
      processInstanceId: processInstanceId || 'test-' + Date.now(),
      businessId,
      result,
      status,
      type: 'finish',
    };

    // 调用回调处理函数
    await exports.handleApprovalCallback(req, res);
    
  } catch (error) {
    console.error('[testApprovalCallback] 测试回调失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

