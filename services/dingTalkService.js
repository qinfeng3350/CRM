const axios = require('axios');
const crypto = require('crypto');
const DingTalkConfig = require('../models/DingTalkConfig');

class DingTalkService {
  // 获取访问令牌（企业内部应用）
  async getAccessToken() {
    const config = await DingTalkConfig.findWithSecrets();
    if (!config || !config.enabled) {
      throw new Error('钉钉配置未启用或不存在');
    }

    // 检查必要的配置参数
    if (!config.appKey || !config.appSecret) {
      throw new Error('缺少参数 corpid or appkey: 请在系统管理 -> 钉钉集成中配置 AppKey 和 AppSecret');
    }

    const url = 'https://oapi.dingtalk.com/gettoken';
    try {
      const response = await axios.get(url, {
        params: {
          appkey: config.appKey,
          appsecret: config.appSecret,
        },
        timeout: 10000, // 10秒超时
      });

      if (response.data.errcode !== 0) {
        throw new Error(`获取访问令牌失败: ${response.data.errmsg}`);
      }

      return response.data.access_token;
    } catch (error) {
      // 处理网络连接错误
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error(`无法连接到钉钉服务器 (${error.code})。请检查：1. 网络连接是否正常 2. 是否配置了代理 3. 防火墙是否阻止了访问 4. DNS解析是否正常`);
      }
      if (error.response) {
        // 服务器返回了响应，但状态码不是2xx
        throw new Error(`获取访问令牌失败: HTTP ${error.response.status} - ${error.response.statusText}`);
      }
      if (error.request) {
        // 请求已发送，但没有收到响应
        throw new Error(`无法连接到钉钉服务器。请检查网络连接和DNS设置`);
      }
      // 其他错误
      throw error;
    }
  }

  // 获取扫码登录应用的访问令牌（OAuth2方式）
  // 根据钉钉官方demo：使用新的OAuth2 API
  // API文档：https://open.dingtalk.com/document/orgapp/obtain-identity-credentials
  async getQRLoginAccessToken(code) {
    console.log('\n[getQRLoginAccessToken] 开始获取访问令牌');
    console.log('[getQRLoginAccessToken] code:', code ? code.substring(0, 10) + '...' : 'null');
    
    const config = await DingTalkConfig.findWithSecrets();
    if (!config || !config.enabled) {
      console.error('[getQRLoginAccessToken] ❌ 钉钉配置未启用或不存在');
      throw new Error('钉钉配置未启用或不存在');
    }

    // 优先使用扫码登录应用的配置，否则使用企业内部应用的配置
    // 统一使用 appKey（扫码登录和免登使用同一个 AppKey）
    const clientId = config.appKey;
    const clientSecret = config.appSecret;

    if (!clientId || !clientSecret) {
      console.error('[getQRLoginAccessToken] ❌ 钉钉应用配置未设置');
      throw new Error('钉钉应用配置未设置');
    }

    console.log('[getQRLoginAccessToken] ✅ 配置已获取');
    console.log('[getQRLoginAccessToken] clientId:', clientId.substring(0, 10) + '...');

    // 使用新的OAuth2 API：/v1.0/oauth2/userAccessToken
    // 根据官方demo，使用POST方法，参数在body中
    // 注意：钉钉新版API使用 api.dingtalk.com，旧版使用 oapi.dingtalk.com
    // 扫码登录应用应该使用 api.dingtalk.com
    const url = 'https://api.dingtalk.com/v1.0/oauth2/userAccessToken';
    try {
      console.log('[getQRLoginAccessToken] 调用OAuth2获取访问令牌API:', url);
      console.log('[getQRLoginAccessToken] 请求参数:', {
        clientId: clientId ? clientId.substring(0, 10) + '...' : 'null',
        code: code ? code.substring(0, 10) + '...' : 'null',
        grantType: 'authorization_code',
      });
      console.log('[getQRLoginAccessToken] 准备发送axios请求...');
      
      const response = await axios.post(url, {
        clientId: clientId,
        clientSecret: clientSecret,
        code: code,
        grantType: 'authorization_code',
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10秒超时
      });
      
      console.log('[getQRLoginAccessToken] ✅ axios请求成功，收到响应');

      console.log('[getQRLoginAccessToken] HTTP状态码:', response.status);
      console.log('[getQRLoginAccessToken] 响应头:', JSON.stringify(response.headers, null, 2));
      console.log('[getQRLoginAccessToken] 响应数据类型:', typeof response.data);
      console.log('[getQRLoginAccessToken] 响应数据键:', Object.keys(response.data || {}));
      console.log('[getQRLoginAccessToken] 响应数据（完整）:');
      console.log(JSON.stringify(response.data, null, 2));

      // 检查是否有错误（钉钉API可能返回errcode和errmsg）
      if (response.data.errcode && response.data.errcode !== 0) {
        console.error('❌ 钉钉API返回错误:', {
          errcode: response.data.errcode,
          errmsg: response.data.errmsg,
          fullResponse: response.data,
        });
        throw new Error(`钉钉API错误 (${response.data.errcode}): ${response.data.errmsg || '未知错误'}`);
      }
      
      if (response.data.errorCode || response.data.errorMessage) {
        console.error('❌ 获取扫码登录访问令牌失败:', {
          errorCode: response.data.errorCode,
          errorMessage: response.data.errorMessage,
          fullResponse: response.data,
        });
        throw new Error(`获取扫码登录访问令牌失败: ${response.data.errorMessage || response.data.errorCode}`);
      }

      // 尝试多种可能的返回格式：
      // 1. 直接格式：{ accessToken: 'xxx', expireIn: 7200 }
      // 2. SDK格式：{ body: { accessToken: 'xxx', expireIn: 7200 } }
      // 3. 下划线格式：{ access_token: 'xxx', expires_in: 7200 }
      let accessToken = null;
      
      if (response.data.accessToken) {
        accessToken = response.data.accessToken;
        console.log('✅ 从 response.data.accessToken 获取到accessToken');
      } else if (response.data.body && response.data.body.accessToken) {
        accessToken = response.data.body.accessToken;
        console.log('✅ 从 response.data.body.accessToken 获取到accessToken');
      } else if (response.data.access_token) {
        accessToken = response.data.access_token;
        console.log('✅ 从 response.data.access_token 获取到accessToken');
      } else if (response.data.body && response.data.body.access_token) {
        accessToken = response.data.body.access_token;
        console.log('✅ 从 response.data.body.access_token 获取到accessToken');
      } else if (response.data.result && response.data.result.accessToken) {
        accessToken = response.data.result.accessToken;
        console.log('✅ 从 response.data.result.accessToken 获取到accessToken');
      }
      
      if (!accessToken) {
        console.error('❌ 响应中未找到accessToken，完整响应:', JSON.stringify(response.data, null, 2));
        console.error('❌ 尝试的字段路径:', [
          'response.data.accessToken',
          'response.data.body.accessToken',
          'response.data.access_token',
          'response.data.body.access_token',
          'response.data.result.accessToken',
        ]);
        throw new Error('获取访问令牌失败：响应中未包含accessToken，请检查钉钉API返回格式');
      }
      
      console.log('✅ 成功获取accessToken:', accessToken.substring(0, 20) + '...');
      return accessToken;
    } catch (error) {
      console.error('\n[getQRLoginAccessToken] ❌ 调用OAuth2 API失败！');
      console.error('[getQRLoginAccessToken] 错误类型:', error.constructor.name);
      console.error('[getQRLoginAccessToken] 错误消息:', error.message);
      
      if (error.response) {
        // 服务器返回了响应，但状态码不是2xx
        console.error('[getQRLoginAccessToken] HTTP状态码:', error.response.status);
        console.error('[getQRLoginAccessToken] HTTP状态文本:', error.response.statusText);
        console.error('[getQRLoginAccessToken] 响应数据:');
        console.error(JSON.stringify(error.response.data, null, 2));
        console.error('[getQRLoginAccessToken] 响应头:');
        console.error(JSON.stringify(error.response.headers, null, 2));
        
        // 提供更详细的错误信息
        if (error.response.status === 400) {
          const errorMsg = error.response.data?.errorMessage || error.response.data?.message || error.message;
          throw new Error(`授权码无效或已过期: ${errorMsg}`);
        } else if (error.response.status === 401) {
          throw new Error('应用凭证无效，请检查AppKey和AppSecret配置');
        } else if (error.response.data?.errorMessage) {
          throw new Error(`获取访问令牌失败: ${error.response.data.errorMessage}`);
        } else {
          throw new Error(`获取访问令牌失败: HTTP ${error.response.status} - ${error.response.statusText}`);
        }
      } else if (error.request) {
        // 请求已发送，但没有收到响应
        console.error('[getQRLoginAccessToken] ❌ 请求已发送，但未收到响应');
        console.error('[getQRLoginAccessToken] 请求详情:', {
          method: error.config?.method,
          url: error.config?.url,
          timeout: error.config?.timeout,
        });
        throw new Error('网络请求失败，请检查网络连接或钉钉服务状态');
      } else {
        // 其他错误
        console.error('[getQRLoginAccessToken] ❌ 其他错误');
        console.error('[getQRLoginAccessToken] 错误堆栈:', error.stack);
        throw error;
      }
    }
  }

  // 通过扫码登录的access_token获取用户信息
  // 根据钉钉官方demo：使用新的API /v1.0/contact/users/me
  async getUserInfoByQRLoginAccessToken(accessToken) {
    // 使用新的API：/v1.0/contact/users/me
    // 注意：钉钉新版API使用 api.dingtalk.com
    const url = 'https://api.dingtalk.com/v1.0/contact/users/me';
    try {
      console.log('调用获取用户信息API:', url);
      const response = await axios.get(url, {
        headers: {
          'x-acs-dingtalk-access-token': accessToken,
        },
      });

      console.log('获取用户信息API响应状态:', response.status);
      console.log('获取用户信息API响应数据:', JSON.stringify(response.data, null, 2));

      if (response.data.errorCode || response.data.errorMessage) {
        console.error('获取扫码登录用户信息失败:', {
          errorCode: response.data.errorCode,
          errorMessage: response.data.errorMessage,
          fullResponse: response.data,
        });
        throw new Error(`获取用户信息失败: ${response.data.errorMessage || response.data.errorCode}`);
      }

      // 新API返回格式：{ unionId, mobile, nick, stateCode, ... }
      // 根据钉钉文档，可能返回的字段：
      // - unionId: 用户的unionId
      // - openId: 用户的openId（如果应用有权限）
      // - nick: 用户昵称
      // - mobile: 手机号
      // - avatarUrl: 头像URL
      // - email: 邮箱
      if (!response.data || (!response.data.unionId && !response.data.openId && !response.data.userid)) {
        console.error('❌ 用户信息数据格式异常:', response.data);
        throw new Error('获取到的用户信息格式不正确，请检查钉钉应用权限配置');
      }

      return response.data;
    } catch (error) {
      console.error('❌ 调用获取用户信息API失败:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        stack: error.stack,
      });
      
      // 提供更详细的错误信息
      if (error.response?.status === 401) {
        throw new Error('访问令牌无效或已过期，请重新扫码登录');
      } else if (error.response?.status === 403) {
        throw new Error('应用没有获取用户信息的权限，请在钉钉开放平台配置相应权限');
      } else if (error.response?.data?.errorMessage) {
        throw new Error(`获取用户信息失败: ${error.response.data.errorMessage}`);
      }
      
      throw error;
    }
  }

  // 获取用户信息（通过免登码）
  async getUserInfoByCode(authCode) {
    const accessToken = await this.getAccessToken();
    const config = await DingTalkConfig.findWithSecrets();

    if (!authCode) {
      throw new Error('授权码code不能为空');
    }

    console.log('调用getUserInfoByCode，code长度:', authCode.length);
    
    // 企业内部应用免登：使用 getuserinfo API
    const url = 'https://oapi.dingtalk.com/topapi/v2/user/getuserinfo';
    // 钉钉API需要将access_token作为query参数，其他参数作为body
    const response = await axios.post(url, {
      code: authCode,
    }, {
      params: {
        access_token: accessToken,
      },
    });

    console.log('getUserInfoByCode响应:', {
      errcode: response.data.errcode,
      errmsg: response.data.errmsg,
      hasResult: !!response.data.result,
    });

    if (response.data.errcode !== 0) {
      console.error('getUserInfoByCode 失败:', {
        errcode: response.data.errcode,
        errmsg: response.data.errmsg,
        code: authCode ? `${authCode.substring(0, 10)}...` : 'null',
      });
      
      // 根据错误码提供更详细的错误信息
      if (response.data.errcode === 40014) {
        throw new Error(`获取用户信息失败: access_token无效或已过期`);
      } else if (response.data.errcode === 40029) {
        throw new Error(`获取用户信息失败: code无效或已过期，请重新获取`);
      } else if (response.data.errcode === 40004) {
        throw new Error(`获取用户信息失败: 应用未授权或权限不足`);
      }
      
      throw new Error(`获取用户信息失败: ${response.data.errmsg} (错误码: ${response.data.errcode})`);
    }

    if (!response.data.result || !response.data.result.userid) {
      throw new Error('获取用户信息失败: 返回数据不完整');
    }

    return response.data.result;
  }

  // 获取用户详情
  async getUserDetail(userId) {
    const accessToken = await this.getAccessToken();

    try {
      // 方法1: 使用 v2 API
      const url = 'https://oapi.dingtalk.com/topapi/v2/user/get';
      // 钉钉API需要将access_token作为query参数，其他参数作为body
      const response = await axios.post(url, {
        userid: userId,
      }, {
        params: {
          access_token: accessToken,
        },
      });

      if (response.data.errcode !== 0) {
        // 如果v2 API失败，尝试v1 API
        console.warn(`v2 API获取用户 ${userId} 失败: ${response.data.errmsg}，尝试v1 API`);
        return await this.getUserDetailV1(userId);
      }

      const result = response.data.result || {};
      // 返回完整的用户信息，包括所有字段
      return {
        userid: result.userid || userId,
        name: result.name || '',
        mobile: result.mobile || '',
        email: result.email || '',
        avatar: result.avatar || '',
        dept_id_list: result.dept_id_list || [],
        // 新增字段
        unionid: result.unionid || result.unionId || '',
        position: result.position || '',
        jobnumber: result.jobnumber || result.job_number || '',
        hired_date: result.hired_date || result.hiredDate || null,
        work_place: result.work_place || result.workPlace || '',
        remark: result.remark || '',
        manager_userid: result.manager_userid || result.managerUserId || '',
        is_admin: result.is_admin || result.isAdmin || false,
        is_boss: result.is_boss || result.isBoss || false,
        is_leader_in_depts: result.is_leader_in_depts || result.isLeaderInDepts || {},
        order_in_depts: result.order_in_depts || result.orderInDepts || {},
        active: result.active !== undefined ? result.active : true,
        real_authed: result.real_authed || result.realAuthed || false,
        org_email: result.org_email || result.orgEmail || '',
        org_email_type: result.org_email_type || result.orgEmailType || '',
        state_code: result.state_code || result.stateCode || '',
        telephone: result.telephone || '',
        extattr: result.extattr || result.extAttr || {},
        senior: result.senior || false,
        hide_mobile: result.hide_mobile || result.hideMobile || false,
        exclusive_account: result.exclusive_account || result.exclusiveAccount || false,
        login_id: result.login_id || result.loginId || '',
        exclusive_account_type: result.exclusive_account_type || result.exclusiveAccountType || '',
        title: result.title || '',
        dept_order_list: result.dept_order_list || result.deptOrderList || {},
        ...result, // 保留其他字段
      };
    } catch (error) {
      console.error(`获取用户 ${userId} 详情失败:`, error.message);
      // 尝试v1 API作为备用
      try {
        return await this.getUserDetailV1(userId);
      } catch (v1Error) {
        throw new Error(`获取用户详情失败: ${error.message}`);
      }
    }
  }

  // 获取用户详情（v1 API备用方法）
  async getUserDetailV1(userId) {
    const accessToken = await this.getAccessToken();
    
    const url = 'https://oapi.dingtalk.com/topapi/user/get';
    // 钉钉API需要将access_token作为query参数，其他参数作为body
    const response = await axios.post(url, {
      userid: userId,
    }, {
      params: {
        access_token: accessToken,
      },
    });

    if (response.data.errcode !== 0) {
      throw new Error(`获取用户详情失败: ${response.data.errmsg}`);
    }

    const result = response.data.result || {};
    // 返回完整的用户信息，包括所有字段
    return {
      userid: result.userid || userId,
      name: result.name || '',
      mobile: result.mobile || '',
      email: result.email || '',
      avatar: result.avatar || '',
      dept_id_list: result.dept_id_list || [],
      // 新增字段
      unionid: result.unionid || result.unionId || '',
      position: result.position || '',
      jobnumber: result.jobnumber || result.job_number || '',
      hired_date: result.hired_date || result.hiredDate || null,
      work_place: result.work_place || result.workPlace || '',
      remark: result.remark || '',
      manager_userid: result.manager_userid || result.managerUserId || '',
      is_admin: result.is_admin || result.isAdmin || false,
      is_boss: result.is_boss || result.isBoss || false,
      is_leader_in_depts: result.is_leader_in_depts || result.isLeaderInDepts || {},
      order_in_depts: result.order_in_depts || result.orderInDepts || {},
      active: result.active !== undefined ? result.active : true,
      real_authed: result.real_authed || result.realAuthed || false,
      org_email: result.org_email || result.orgEmail || '',
      org_email_type: result.org_email_type || result.orgEmailType || '',
      state_code: result.state_code || result.stateCode || '',
      telephone: result.telephone || '',
      extattr: result.extattr || result.extAttr || {},
      senior: result.senior || false,
      hide_mobile: result.hide_mobile || result.hideMobile || false,
      exclusive_account: result.exclusive_account || result.exclusiveAccount || false,
      login_id: result.login_id || result.loginId || '',
      exclusive_account_type: result.exclusive_account_type || result.exclusiveAccountType || '',
      title: result.title || '',
      dept_order_list: result.dept_order_list || result.deptOrderList || {},
      ...result, // 保留其他字段
    };
  }

  // 获取部门详情
  async getDepartmentDetail(deptId) {
    const accessToken = await this.getAccessToken();
    try {
      const url = 'https://oapi.dingtalk.com/topapi/v2/department/get';
      const response = await axios.post(url, {
        dept_id: deptId,
      }, {
        params: {
          access_token: accessToken,
        },
      });

      if (response.data.errcode === 0) {
        return response.data.result;
      }
      throw new Error(`获取部门详情失败: ${response.data.errmsg}`);
    } catch (error) {
      console.error(`获取部门 ${deptId} 详情失败:`, error.message);
      throw error;
    }
  }

  // 获取部门列表（使用多种方法，确保获取所有部门）
  async getDepartmentList() {
    const accessToken = await this.getAccessToken();
    const allDepartments = [];
    const processedDeptIds = new Set(); // 防止重复处理

    // 方法1: 尝试使用部门列表API（获取所有部门）
    try {
      console.log('尝试使用部门列表API获取所有部门...');
      
      // 尝试不同的API端点
      const apiEndpoints = [
        {
          url: 'https://oapi.dingtalk.com/topapi/v2/department/list',
          params: { fetch_child: true },
          name: 'v2/department/list (fetch_child=true)'
        },
        {
          url: 'https://oapi.dingtalk.com/topapi/v2/department/list',
          params: {},
          name: 'v2/department/list (无参数)'
        },
        {
          url: 'https://oapi.dingtalk.com/topapi/department/list',
          params: { fetch_child: true },
          name: 'v1/department/list (fetch_child=true)'
        }
      ];
      
      for (const endpoint of apiEndpoints) {
        try {
          console.log(`  尝试 ${endpoint.name}...`);
          const listResponse = await axios.post(endpoint.url, endpoint.params, {
            params: {
              access_token: accessToken,
            },
          });

          if (listResponse.data.errcode === 0) {
            const depts = listResponse.data.result || [];
            console.log(`  ✅ ${endpoint.name} 成功: 获取到 ${depts.length} 个部门`);
            
            if (depts.length > 0) {
              for (const dept of depts) {
                if (!dept.dept_id) continue;
                const deptIdStr = String(dept.dept_id);
                if (processedDeptIds.has(deptIdStr)) continue;
                
                allDepartments.push({
                  dept_id: dept.dept_id,
                  name: dept.name || `部门_${dept.dept_id}`,
                  parent_id: dept.parent_id || 0,
                  order: dept.order || 0,
                  description: dept.description || '',
                });
                processedDeptIds.add(deptIdStr);
              }
              
              if (allDepartments.length > 0) {
                console.log(`✅ 使用 ${endpoint.name} 获取到 ${allDepartments.length} 个部门`);
                // 不跳出循环，继续尝试其他API以获取更多部门
              }
            }
          } else {
            console.warn(`  ⚠️  ${endpoint.name} 失败: ${listResponse.data.errmsg} (错误码: ${listResponse.data.errcode})`);
          }
        } catch (endpointError) {
          console.warn(`  ⚠️  ${endpoint.name} 异常:`, endpointError.message);
        }
      }
    } catch (error) {
      console.warn('部门列表API失败，尝试其他方法:', error.message);
    }

    // 方法2: 递归获取所有子部门（补充方法，确保获取所有部门）
    console.log('使用递归方法补充获取部门...');
    
    // 递归获取所有子部门（包括根部门的所有子部门）
    const getSubDepartments = async (deptId, depth = 0, maxDepth = 20) => {
      const deptIdStr = String(deptId);
      const indent = '  '.repeat(depth);
      
      // 防止无限递归
      if (depth > maxDepth) {
        console.warn(`${indent}⚠️  达到最大递归深度 ${maxDepth}，停止递归`);
        return;
      }
      
      // 如果已经处理过，跳过（但根部门需要处理）
      if (processedDeptIds.has(deptIdStr) && deptId !== 1) {
        return;
      }

      try {
        const url = 'https://oapi.dingtalk.com/topapi/v2/department/listsub';
        const response = await axios.post(url, {
          dept_id: deptId,
        }, {
          params: {
            access_token: accessToken,
          },
        });

        if (response.data.errcode === 0) {
          const subDepts = response.data.result || [];
          console.log(`${indent}✅ 部门 ${deptId} 有 ${subDepts.length} 个子部门`);
          
          if (subDepts.length === 0 && depth === 0) {
            // 如果根部门没有子部门，尝试获取根部门本身
            console.log(`${indent}⚠️  根部门没有子部门，尝试获取根部门详情...`);
            try {
              const rootDept = await this.getDepartmentDetail(1);
              if (rootDept && rootDept.dept_id) {
                if (!processedDeptIds.has(String(rootDept.dept_id))) {
                  allDepartments.push(rootDept);
                  processedDeptIds.add(String(rootDept.dept_id));
                  console.log(`${indent}✅ 成功获取根部门: ID=${rootDept.dept_id}, 名称=${rootDept.name || '未命名'}`);
                }
              }
            } catch (rootError) {
              console.warn(`${indent}获取根部门详情失败:`, rootError.message);
              // 如果无法获取根部门详情，创建一个虚拟的根部门对象
              if (!processedDeptIds.has('1')) {
                allDepartments.push({
                  dept_id: 1,
                  name: '根部门',
                  parent_id: 0,
                  order: 0,
                  description: '',
                });
                processedDeptIds.add('1');
              }
            }
          }
          
          // 处理每个子部门
          for (const dept of subDepts) {
            if (!dept.dept_id) continue;
            
            const subDeptIdStr = String(dept.dept_id);
            if (processedDeptIds.has(subDeptIdStr)) {
              console.log(`${indent}  ⚠️  部门 ${dept.dept_id} 已处理过，跳过`);
              // 即使已处理过，也要递归获取其子部门，确保不遗漏
              await getSubDepartments(dept.dept_id, depth + 1, maxDepth);
              continue;
            }

            // 尝试获取部门详情以获取完整信息
            let deptInfo = null;
            try {
              const deptDetail = await this.getDepartmentDetail(dept.dept_id);
              if (deptDetail) {
                deptInfo = deptDetail;
                console.log(`${indent}  ✅ 获取部门详情: ${deptDetail.name || dept.dept_id} (ID: ${dept.dept_id})`);
              }
            } catch (detailError) {
              // 如果获取详情失败，使用基本信息
              console.warn(`${indent}  ⚠️  获取部门 ${dept.dept_id} 详情失败，使用基本信息:`, detailError.message);
              deptInfo = {
                dept_id: dept.dept_id,
                name: dept.name || `部门_${dept.dept_id}`,
                parent_id: dept.parent_id || deptId,
                order: dept.order || 0,
                description: dept.description || '',
              };
            }
            
            if (deptInfo) {
              allDepartments.push(deptInfo);
              processedDeptIds.add(subDeptIdStr);
              
              // 递归获取子部门的子部门（确保获取所有层级的部门）
              await getSubDepartments(dept.dept_id, depth + 1, maxDepth);
            }
          }
        } else {
          console.warn(`${indent}⚠️  获取部门 ${deptId} 的子部门失败: ${response.data.errmsg} (错误码: ${response.data.errcode})`);
          
          // 如果获取子部门失败，但这是根部门，尝试获取根部门本身
          if (deptId === 1 && !processedDeptIds.has('1')) {
            try {
              const rootDept = await this.getDepartmentDetail(1);
              if (rootDept && rootDept.dept_id) {
                allDepartments.push(rootDept);
                processedDeptIds.add(String(rootDept.dept_id));
                console.log(`${indent}✅ 成功获取根部门: ID=${rootDept.dept_id}, 名称=${rootDept.name || '未命名'}`);
              }
            } catch (rootError) {
              console.warn(`${indent}获取根部门详情失败:`, rootError.message);
              // 如果无法获取根部门详情，创建一个虚拟的根部门对象
              if (!processedDeptIds.has('1')) {
                allDepartments.push({
                  dept_id: 1,
                  name: '根部门',
                  parent_id: 0,
                  order: 0,
                  description: '',
                });
                processedDeptIds.add('1');
              }
            }
          }
        }
      } catch (error) {
        console.error(`${indent}❌ 获取部门 ${deptId} 的子部门失败:`, error.message);
        // 不抛出错误，继续处理其他部门
      }
    };

    // 从根部门开始获取所有子部门
    console.log('开始从根部门递归获取所有子部门...');
    await getSubDepartments(1, 0);

    console.log(`✅ 总共获取到 ${allDepartments.length} 个部门`);
    console.log(`部门ID列表: ${Array.from(processedDeptIds).sort((a, b) => parseInt(a) - parseInt(b)).join(', ')}`);
    return allDepartments;
  }

  // 获取部门用户列表
  async getDepartmentUsers(deptId) {
    const accessToken = await this.getAccessToken();
    const users = [];

    try {
      // 方法1：使用 listid API 获取用户ID列表
      const listIdUrl = 'https://oapi.dingtalk.com/topapi/user/listid';
      // 钉钉API需要将access_token作为query参数，其他参数作为body
      const listIdResponse = await axios.post(listIdUrl, {
        dept_id: deptId,
      }, {
        params: {
          access_token: accessToken,
        },
      });

      if (listIdResponse.data.errcode === 0) {
        const userIds = listIdResponse.data.result?.userid_list || [];
        console.log(`  ✅ listid API成功: 部门 ${deptId} 有 ${userIds.length} 个用户ID`);
        
        if (userIds.length === 0) {
          console.log(`  ⚠️  部门 ${deptId} 没有用户，尝试使用list API...`);
          // 如果listid返回空，尝试list API
          return await this.getDepartmentUsersByList(deptId);
        }
        
        // 尝试批量获取用户详情（如果API支持）
        // 如果批量获取失败，逐个获取
        try {
          // 尝试使用批量获取API（如果支持）
          const batchUrl = 'https://oapi.dingtalk.com/topapi/v2/user/list';
          const batchResponse = await axios.post(batchUrl, {
            dept_id: deptId,
            cursor: 0,
            size: 100,
          }, {
            params: {
              access_token: accessToken,
            },
          });

          if (batchResponse.data.errcode === 0) {
            const result = batchResponse.data.result || {};
            const userList = result.list || [];
            console.log(`  ✅ 批量获取API成功: 获取到 ${userList.length} 个用户`);
            
            for (const user of userList) {
              if (user.userid) {
                users.push({
                  userid: user.userid,
                  name: user.name || `用户_${user.userid}`,
                  mobile: user.mobile || '',
                  email: user.email || '',
                  avatar: user.avatar || '',
                  dept_id_list: user.dept_id_list || [deptId],
                });
              }
            }
            
            if (users.length > 0) {
              return users;
            }
          }
        } catch (batchError) {
          console.warn('批量获取用户失败，使用逐个获取方法:', batchError.message);
        }
        
        // 批量获取失败，逐个获取用户详情
        console.log(`  开始逐个获取 ${userIds.length} 个用户的详情...`);
        for (let i = 0; i < userIds.length; i++) {
          const userId = userIds[i];
          let userDetail = null;
          
          // 尝试多种方法获取用户详情
          try {
            // 方法1: 使用v2 API
            userDetail = await this.getUserDetail(userId);
            if (userDetail && userDetail.userid) {
              users.push(userDetail);
              if ((i + 1) % 10 === 0 || i === userIds.length - 1) {
                console.log(`  ✅ 已获取 ${i + 1}/${userIds.length} 个用户详情...`);
              }
              continue;
            }
          } catch (error) {
            // 不输出警告，避免日志过多
          }
          
          // 方法2: 尝试使用v1 API
          try {
            userDetail = await this.getUserDetailV1(userId);
            if (userDetail && userDetail.userid) {
              users.push(userDetail);
              if ((i + 1) % 10 === 0 || i === userIds.length - 1) {
                console.log(`  ✅ 已获取 ${i + 1}/${userIds.length} 个用户详情 (v1 API)...`);
              }
              continue;
            }
          } catch (v1Error) {
            // 不输出警告，避免日志过多
          }
          
          // 如果所有方法都失败，使用基本信息
          users.push({
            userid: userId,
            name: `用户_${userId}`,
            mobile: '',
            email: '',
            avatar: '',
            dept_id_list: [deptId],
            _incomplete: true, // 标记为不完整信息
          });
        }
      } else {
        const errcode = listIdResponse.data.errcode;
        const errmsg = listIdResponse.data.errmsg;
        console.warn(`  ❌ listid API失败 (错误码: ${errcode}): ${errmsg}`);
        
        // 根据错误码提供具体建议
        if (errcode === 40014) {
          console.warn(`  原因：access_token无效或已过期`);
        } else if (errcode === 40013) {
          console.warn(`  原因：部门ID不存在或无权限访问`);
        } else if (errcode === 88) {
          console.warn(`  原因：API调用频率超限，请稍后重试`);
        } else if (errcode === 40004) {
          console.warn(`  原因：应用没有"通讯录管理"权限`);
          console.warn(`  解决：登录钉钉开放平台 -> 应用管理 -> 权限管理 -> 申请"通讯录管理"权限`);
        }
        
        // 如果listid失败，尝试使用list API
        console.log(`  尝试使用list API作为备用...`);
        return await this.getDepartmentUsersByList(deptId);
      }
    } catch (error) {
      console.error(`获取部门 ${deptId} 用户失败:`, error.message);
      // 尝试使用list API作为备用
      try {
        return await this.getDepartmentUsersByList(deptId);
      } catch (listError) {
        throw error; // 如果都失败，抛出原始错误
      }
    }

    return users;
  }

  // 使用list API获取部门用户（备用方法）
  async getDepartmentUsersByList(deptId) {
    const accessToken = await this.getAccessToken();
    const users = [];
    
    try {
      const listUrl = 'https://oapi.dingtalk.com/topapi/user/list';
      const listResponse = await axios.post(listUrl, {
        access_token: accessToken,
        dept_id: deptId,
        cursor: 0,
        size: 100,
      });

      if (listResponse.data.errcode === 0) {
        const result = listResponse.data.result || {};
        const userList = result.list || [];
        console.log(`  ✅ list API成功: 获取到部门 ${deptId} 的 ${userList.length} 个用户`);
        
        if (userList.length > 0) {
          console.log(`  用户列表: ${userList.map(u => `${u.name || u.userid}(${u.userid})`).join(', ')}`);
        }
        
        for (const user of userList) {
          if (user.userid) {
            // list API可能已经返回了足够的信息，但为了完整性，还是获取详情
            try {
              const userDetail = await this.getUserDetail(user.userid);
              users.push(userDetail);
            } catch (error) {
              // 如果获取详情失败，使用list API返回的基本信息
              console.warn(`  ⚠️  获取用户 ${user.userid} 详情失败，使用基本信息:`, error.message);
              users.push({
                userid: user.userid,
                name: user.name || '',
                mobile: user.mobile || '',
                email: user.email || '',
                avatar: user.avatar || '',
                dept_id_list: user.dept_id_list || [deptId],
              });
            }
          }
        }
      } else {
        const errcode = listResponse.data.errcode;
        const errmsg = listResponse.data.errmsg;
        console.error(`  ❌ list API失败 (错误码: ${errcode}): ${errmsg}`);
        
        // 根据错误码提供具体建议
        if (errcode === 40014) {
          console.error(`  原因：access_token无效或已过期`);
        } else if (errcode === 40013) {
          console.error(`  原因：部门ID不存在或无权限访问`);
        } else if (errcode === 88) {
          console.error(`  原因：API调用频率超限，请稍后重试`);
        } else if (errcode === 40004) {
          console.error(`  原因：应用没有"通讯录管理"权限`);
          console.error(`  解决：登录钉钉开放平台 -> 应用管理 -> 权限管理 -> 申请"通讯录管理"权限`);
        }
        
        throw new Error(`list API失败 (错误码: ${errcode}): ${errmsg}`);
      }
    } catch (error) {
      console.error(`使用list API获取部门 ${deptId} 用户失败:`, error.message);
      throw error;
    }

    return users;
  }

  // 获取所有用户（使用部门遍历方式，确保完整）
  async getAllUsers() {
    const allUsers = [];
    const processedUserIds = new Set(); // 防止重复处理
    const errorDepts = []; // 记录出错的部门
    
    try {
      console.log('========== 开始获取钉钉所有用户 ==========');
      
      // 先获取所有部门
      console.log('步骤1: 获取部门列表...');
      const departments = await this.getDepartmentList();
      console.log(`✅ 获取到 ${departments.length} 个部门`);
      if (departments.length > 0) {
        console.log('部门列表:', departments.map(d => `ID:${d.dept_id} 名称:${d.name || '未命名'}`).join(', '));
      }
      
      // 收集所有部门ID（包括根部门）
      const allDeptIds = new Set();
      if (departments.length > 0) {
        departments.forEach(dept => {
          if (dept && dept.dept_id) {
            allDeptIds.add(dept.dept_id);
          }
        });
      }
      // 确保根部门也在列表中
      allDeptIds.add(1);
      
      console.log(`\n步骤2: 遍历 ${allDeptIds.size} 个部门获取用户...`);
      
      // 按层级顺序处理部门（先处理父部门，再处理子部门）
      const sortedDeptIds = Array.from(allDeptIds).sort((a, b) => {
        // 根部门优先
        if (a === 1) return -1;
        if (b === 1) return 1;
        return a - b;
      });
      
      let successCount = 0;
      let failCount = 0;
      
      for (const deptId of sortedDeptIds) {
        try {
          const dept = departments.find(d => d && d.dept_id === deptId);
          const deptName = dept ? (dept.name || `部门_${deptId}`) : (deptId === 1 ? '根部门' : `部门_${deptId}`);
          console.log(`\n  [${successCount + failCount + 1}/${sortedDeptIds.size}] 正在获取部门 ${deptName} (ID: ${deptId})...`);
          
          const users = await this.getDepartmentUsers(deptId);
          console.log(`  ✅ 部门 ${deptName} 有 ${users.length} 个用户`);
          
          if (users.length > 0) {
            let addedCount = 0;
            for (const user of users) {
              if (!user || !user.userid) continue;
              
              // 如果用户已处理过，合并部门列表
              if (processedUserIds.has(user.userid)) {
                // 找到已存在的用户，更新部门列表
                const existingUser = allUsers.find(u => u && u.userid === user.userid);
                if (existingUser) {
                  const existingDepts = Array.isArray(existingUser.dept_id_list) ? existingUser.dept_id_list : [];
                  const newDepts = Array.isArray(user.dept_id_list) ? user.dept_id_list : [deptId];
                  existingUser.dept_id_list = [...new Set([...existingDepts, ...newDepts, deptId])];
                }
              } else {
                // 新用户，添加到列表
                processedUserIds.add(user.userid);
                const enrichedUser = {
                  ...user,
                  dept_id_list: Array.isArray(user.dept_id_list) 
                    ? [...new Set([...user.dept_id_list, deptId])] 
                    : [deptId],
                };
                allUsers.push(enrichedUser);
                addedCount++;
              }
            }
            console.log(`  ✅ 部门 ${deptName}: 新增 ${addedCount} 个用户，合并 ${users.length - addedCount} 个已存在用户`);
          } else {
            console.log(`  ℹ️  部门 ${deptName} 没有用户`);
          }
          successCount++;
        } catch (error) {
          failCount++;
          const dept = departments.find(d => d && d.dept_id === deptId);
          const deptName = dept ? (dept.name || `部门_${deptId}`) : (deptId === 1 ? '根部门' : `部门_${deptId}`);
          console.error(`  ❌ 获取部门 ${deptName} (ID: ${deptId}) 用户失败:`, error.message);
          errorDepts.push({
            deptId: deptId,
            name: deptName,
            error: error.message,
          });
          // 继续处理下一个部门，不中断
        }
      }
      
      console.log(`\n步骤3: 部门遍历完成`);
      console.log(`  成功: ${successCount} 个部门`);
      console.log(`  失败: ${failCount} 个部门`);
      if (errorDepts.length > 0) {
        console.log(`  失败的部门:`, errorDepts.map(d => `${d.name}(ID:${d.deptId})`).join(', '));
      }

      // 去重（虽然已经用Set处理，但再次确保）
      console.log('\n步骤4: 最终去重处理...');
      const uniqueUsers = [];
      const finalUserIdSet = new Set();
      for (const user of allUsers) {
        if (user && user.userid && !finalUserIdSet.has(user.userid)) {
          finalUserIdSet.add(user.userid);
          uniqueUsers.push(user);
        }
      }

      console.log(`\n========== 获取完成 ==========`);
      console.log(`总计: ${uniqueUsers.length} 个唯一用户`);
      console.log(`处理了 ${allDeptIds.size} 个部门`);
      console.log(`成功: ${successCount} 个，失败: ${failCount} 个`);
      
      if (uniqueUsers.length === 0) {
        console.warn('\n⚠️  警告：未获取到任何用户！');
        console.warn('可能的原因：');
        console.warn('1. 钉钉应用没有"通讯录管理"权限');
        console.warn('   解决：登录钉钉开放平台 -> 应用管理 -> 权限管理 -> 申请"通讯录管理"权限');
        console.warn('2. 企业通讯录为空（但您说有用户，所以这个可能性较小）');
        console.warn('3. API调用失败或权限不足');
        console.warn('   解决：检查AppKey和AppSecret是否正确，确认应用已发布');
        console.warn('4. 用户不在根部门或已获取的子部门中');
        console.warn('   解决：检查钉钉企业通讯录结构，确认用户所在部门');
      }
      
      return uniqueUsers;
    } catch (error) {
      console.error('\n❌ 获取所有用户失败:', error.message);
      if (error.stack) {
        console.error('详细错误:', error.stack);
      }
      throw error;
    }
  }


  // 创建待办任务
  // 优先使用新版API（需要Todo.Todo.Write权限）
  // 根据钉钉官方文档：https://open.dingtalk.com/document/development/add-dingtalk-to-do-task
  // 新版API是推荐方式，旧版API（qyapi_work_record）已不推荐使用
  // todoId: 可选，用于构建详情页URL
  async createTodo(userId, subject, description, dueTime, todoId = null) {
    try {
      console.log('[createTodo] 开始创建钉钉待办');
      console.log('[createTodo] 参数:', { userId, subject, description: description?.substring(0, 50), dueTime });
      
      // 优先尝试新版API（使用Todo.Todo.Write权限）
      try {
        console.log('[createTodo] 尝试使用新版API（Todo.Todo.Write权限）...');
        console.log('[createTodo] 传递的todoId:', todoId);
        // 传递todoId参数用于构建详情页URL
        const result = await this.createTodoV2(userId, subject, description, dueTime, todoId);
        console.log('[createTodo] ✅ 新版API调用成功');
        return result;
      } catch (v2Error) {
        console.error('[createTodo] ❌ 新版API失败:', {
          message: v2Error.message,
          status: v2Error.response?.status,
          errorCode: v2Error.response?.data?.errorCode,
          errorMessage: v2Error.response?.data?.errorMessage,
        });
        
        // 检查是否是权限问题（更精确的判断）
        // 只有当HTTP状态码是403，或者错误信息明确提到权限相关问题时，才判定为权限错误
        const httpStatus = v2Error.response?.status;
        const errorData = v2Error.response?.data || {};
        const errorMessage = v2Error.message || '';
        const errorCode = errorData.errorCode || errorData.errcode;
        const errorMsg = errorData.errorMessage || errorData.errmsg || '';
        
        // 精确判断权限错误：
        // 1. HTTP状态码是403
        // 2. 错误码明确是权限相关（如PERMISSION_DENIED, 60011等）
        // 3. 错误信息明确提到权限且不是参数错误
        const isPermissionError = httpStatus === 403 || 
                                  errorCode === 'PERMISSION_DENIED' ||
                                  errorCode === '60011' ||
                                  (errorMsg.includes('权限') && !errorMsg.includes('参数') && !errorMsg.includes('格式')) ||
                                  (errorMessage.includes('权限') && !errorMessage.includes('参数') && !errorMessage.includes('格式') && httpStatus !== 400);
        
        if (isPermissionError) {
          // 如果是权限问题，提供明确的权限申请指导
          const errorMsg = `创建待办失败：应用尚未开通"待办应用中待办写权限"（Todo.Todo.Write）。\n` +
            `请按以下步骤申请权限：\n` +
            `1. 登录钉钉开放平台：https://open.dingtalk.com\n` +
            `2. 进入应用管理 -> 选择您的应用\n` +
            `3. 在"权限管理"中搜索"Todo.Todo.Write"或"待办应用中待办写权限"\n` +
            `4. 申请并开通该权限\n` +
            `5. 等待审核通过后重新尝试\n\n` +
            `注意：新版API（Todo.Todo.Write）是推荐方式，旧版API（qyapi_work_record）已不推荐使用。\n\n` +
            `如果权限已开通但仍出现此错误，可能是：\n` +
            `- access_token未刷新（权限开通后需要重新获取token）\n` +
            `- 应用使用范围未包含目标用户\n` +
            `- 权限范围设置不正确（需要设置为"全部员工"或包含目标用户）`;
          throw new Error(errorMsg);
        }
        
        // 如果是其他错误（如网络错误、参数错误等），直接抛出原始错误
        // 这样可以看到真实的错误信息，便于排查问题
        console.error('[createTodo] 新版API失败（非权限错误），抛出原始错误');
        throw v2Error;
      }
    } catch (error) {
      console.error('[createTodo] ❌ 创建钉钉待办异常:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw error;
    }
  }

  // 获取用户的unionId（优先从数据库获取，如果不存在则通过API获取）
  // 根据钉钉API文档，unionId需要通过用户详情API获取
  async getUserUnionId(userId) {
    try {
      console.log('[getUserUnionId] 开始获取用户unionId，userid:', userId);
      
      // 方法0: 优先从数据库中获取unionId（如果已存储）
      // 通过userId查找DingTalkUser关联，看是否已有unionid
      try {
        const DingTalkUser = require('../models/DingTalkUser');
        const dingTalkUser = await DingTalkUser.findByUserId(userId);
        if (dingTalkUser && dingTalkUser.unionid) {
          console.log('[getUserUnionId] ✅ 从数据库获取到unionId:', dingTalkUser.unionid);
          return dingTalkUser.unionid;
        }
        console.log('[getUserUnionId] 数据库中未找到unionId，尝试通过API获取...');
      } catch (dbError) {
        console.warn('[getUserUnionId] 从数据库获取unionId失败，继续尝试API:', dbError.message);
      }
      
      // 方法1: 通过用户详情API获取unionId
      // 根据钉钉官方文档：https://open.dingtalk.com/document/orgapp/query-user-details
      // 使用 v2 API：/topapi/v2/user/get
      const accessToken = await this.getAccessToken();
      const url = 'https://oapi.dingtalk.com/topapi/v2/user/get';
      
      console.log('[getUserUnionId] 调用v2 API获取用户详情，userid:', userId);
      console.log('[getUserUnionId] API URL:', url);
      
      let response;
      try {
        response = await axios.post(url, {
          userid: userId,
        }, {
          params: {
            access_token: accessToken,
          },
          timeout: 10000,
        });
      } catch (apiError) {
        console.error('[getUserUnionId] ❌ API调用失败:', {
          message: apiError.message,
          status: apiError.response?.status,
          statusText: apiError.response?.statusText,
          responseData: apiError.response?.data,
        });
        
        // 如果是权限错误，提供更详细的提示
        if (apiError.response?.data?.errcode === 88 || apiError.response?.status === 403) {
          throw new Error('获取用户信息权限不足。请确保应用已开通"通讯录管理"相关权限，并在钉钉开放平台中配置正确的权限范围。');
        }
        
        throw new Error(`调用钉钉API失败: ${apiError.message || '未知错误'}`);
      }

      console.log('[getUserUnionId] API响应状态:', response.status);
      console.log('[getUserUnionId] API响应数据:', JSON.stringify(response.data, null, 2));

      if (response.data.errcode !== 0) {
        const errorMsg = response.data.errmsg || '未知错误';
        console.error('[getUserUnionId] ❌ API返回错误:', {
          errcode: response.data.errcode,
          errmsg: errorMsg,
        });
        
        // 常见错误码处理
        if (response.data.errcode === 40014) {
          throw new Error('access_token无效或已过期，请重新获取');
        } else if (response.data.errcode === 88) {
          throw new Error('权限不足：应用未开通"通讯录管理"相关权限，请在钉钉开放平台申请并开通权限');
        } else if (response.data.errcode === 40004) {
          throw new Error(`用户不存在或userid格式错误: ${userId}`);
        }
        
        throw new Error(`获取用户信息失败: ${errorMsg} (错误码: ${response.data.errcode})`);
      }

      if (response.data.result) {
        const result = response.data.result;
        console.log('[getUserUnionId] 用户详情返回的字段:', Object.keys(result));
        console.log('[getUserUnionId] 用户详情完整数据:', JSON.stringify(result, null, 2));
        
        // 检查unionId字段（注意：可能是unionId或unionid，大小写可能不同）
        const unionId = result.unionId || result.unionid || result.union_id;
        
        if (unionId) {
          console.log('[getUserUnionId] ✅ 从API获取到unionId:', unionId);
          
          // 如果数据库中有DingTalkUser记录，更新unionid字段
          try {
            const DingTalkUser = require('../models/DingTalkUser');
            const dingTalkUser = await DingTalkUser.findByUserId(userId);
            if (dingTalkUser) {
              await DingTalkUser.upsert({
                dingTalkUserId: dingTalkUser.dingTalkUserId,
                userId: userId,
                unionid: unionId,
              });
              console.log('[getUserUnionId] ✅ 已更新数据库中的unionId');
            }
          } catch (updateError) {
            console.warn('[getUserUnionId] 更新数据库unionId失败（不影响使用）:', updateError.message);
          }
          
          return unionId;
        }
        
        // 如果API没有返回unionId，检查是否有其他标识符
        console.log('[getUserUnionId] ⚠️  用户详情中没有unionId字段');
        console.log('[getUserUnionId] 用户详情数据（部分）:', {
          userid: result.userid,
          name: result.name,
          hasUnionId: !!(result.unionId || result.unionid || result.union_id),
          allKeys: Object.keys(result),
        });
        
        // 如果确实没有unionId，可能是权限问题或用户类型问题
        throw new Error('用户详情API未返回unionId字段。可能的原因：1. 应用权限不足 2. 用户类型不支持（如外部联系人）3. 需要开通"通讯录管理"相关权限');
      } else {
        throw new Error('API返回数据格式错误：result字段为空');
      }
      
      // 注意：v1 API通常也不返回unionId，所以这里不再尝试
      // 如果v2 API已经调用但失败，直接抛出错误
    } catch (error) {
      console.error('[getUserUnionId] ❌ 获取unionId失败:', error.message);
      if (error.response?.data) {
        console.error('[getUserUnionId] API响应:', error.response.data);
      }
      throw error;
    }
  }

  // 新版待办API（使用Todo.Todo.Write权限）
  // API: https://api.dingtalk.com/v1.0/todo/tasks
  // 注意：从2024年2月1日起，detailUrl字段为必填项
  // 根据钉钉官方建议：
  // 1. 确保使用正确的权限（Todo.Todo.Write）
  // 2. 确保access_token是通过当前应用的AppKey和AppSecret获取的
  // 3. 确保所有参数都是String类型（除了数字类型字段）
  // 4. 路径参数需要使用unionId，而不是userid
  // 5. executorIds：执行人unionId列表，设置后待办会出现在"待我处理"中
  // 6. detailUrl：详情页URL，必须包含具体的待办ID才能查看
  async createTodoV2(userId, subject, description, dueTime, todoId = null) {
    try {
      console.log('[createTodoV2] 使用新版待办API（Todo.Todo.Write权限）');
      console.log('[createTodoV2] 检查权限和配置...');
      
      const accessToken = await this.getAccessToken();
      const config = await DingTalkConfig.findWithSecrets();

      // 验证配置
      if (!config || !config.enabled) {
        throw new Error('钉钉配置未启用，请在系统管理 -> 钉钉集成中启用配置');
      }
      
      if (!config.appKey || !config.appSecret) {
        throw new Error('钉钉AppKey或AppSecret未配置，请在系统管理 -> 钉钉集成中配置');
      }
      
      console.log('[createTodoV2] ✅ 配置验证通过');
      console.log('[createTodoV2] AppKey:', config.appKey.substring(0, 10) + '...');
      console.log('[createTodoV2] access_token:', accessToken ? accessToken.substring(0, 20) + '...' : 'null');

      // 获取用户的unionId（路径参数需要使用unionId，而不是userid）
      // 根据错误信息，路径参数需要unionId格式，不能直接使用userid
      console.log('[createTodoV2] 获取用户unionId...');
      let unionId;
      try {
        unionId = await this.getUserUnionId(userId);
        if (!unionId || unionId.trim() === '') {
          throw new Error('获取到的unionId为空');
        }
        console.log('[createTodoV2] ✅ 获取到unionId:', unionId);
      } catch (unionIdError) {
        console.error('[createTodoV2] ❌ 获取unionId失败:', unionIdError.message);
        // unionId是必填项，如果获取失败，直接抛出错误，不要使用userid
        throw new Error(`无法获取用户的unionId，这是创建待办的必填参数。错误: ${unionIdError.message}\n` +
          `请确保：1. 用户已正确绑定钉钉账号 2. 应用有获取用户信息的权限`);
      }

      // 新版待办API - 使用 v1.0 API
      // 官方文档：https://open.dingtalk.com/document/orgapp/create-a-dingtalk-to-do-task
      // 根据钉钉调试台，API路径格式：/v1.0/todo/users/{unionId}/tasks
      // 注意：unionId必须是有效的unionId格式，不能是userid
      const url = `https://api.dingtalk.com/v1.0/todo/users/${String(unionId)}/tasks`;
      
      // 构建detailUrl（必填项）
      // 优先使用 frontendUrl（前端地址），如果没有则使用 callbackUrl，最后使用环境变量或默认值
      // 注意：detailUrl必须是有效的HTTP/HTTPS URL，且必须是公网可访问的地址
      let baseUrl = config.frontendUrl || config.callbackUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
      
      // 如果 baseUrl 包含 localhost 或 127.0.0.1，尝试从 callbackUrl 推断服务器地址
      if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        // 尝试从 callbackUrl 提取服务器地址
        if (config.callbackUrl && !config.callbackUrl.includes('localhost') && !config.callbackUrl.includes('127.0.0.1')) {
          baseUrl = config.callbackUrl.replace('/auth/dingtalk/callback', '');
          console.log('[createTodoV2] ⚠️  检测到 localhost，已从 callbackUrl 推断服务器地址:', baseUrl);
        } else {
          // 如果还是 localhost，使用服务器IP（从数据库配置推断）
          // 这里假设服务器IP是 39.106.142.253（从数据库配置中获取）
          const dbConfig = require('../config/database');
          const serverHost = dbConfig.pool?.config?.host || '39.106.142.253';
          // 尝试使用服务器IP，但需要用户配置正确的端口
          baseUrl = `http://${serverHost}:5173`;
          console.log('[createTodoV2] ⚠️  使用服务器IP作为前端地址:', baseUrl);
          console.log('[createTodoV2] ⚠️  请确保在钉钉配置中设置正确的 frontendUrl（公网可访问的地址）');
        }
      }
      
      // 验证baseUrl格式
      if (!baseUrl || (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://'))) {
        throw new Error(`前端地址格式不正确，必须是有效的HTTP/HTTPS URL。当前值: ${baseUrl}`);
      }
      
      // 构建完整的待办详情页URL
      // 使用后端代理接口，这样即使前端地址是 localhost，钉钉也能通过后端服务器访问
      // 后端代理接口格式：/api/dingtalk/todo/redirect/:todoId
      // 获取服务器地址（后端API地址）
      // 优先级：环境变量 SERVER_URL > 数据库配置 serverUrl > 从数据库host推断
      let serverBaseUrl = process.env.SERVER_URL;
      
      if (!serverBaseUrl) {
        // 尝试从数据库配置获取 serverUrl
        const dbConfig = require('../config/database');
        if (config.serverUrl) {
          serverBaseUrl = config.serverUrl;
          console.log('[createTodoV2] 📍 使用数据库配置的serverUrl:', serverBaseUrl);
        } else {
          // 从数据库host推断（但数据库host是MySQL地址，不一定是后端地址）
          // 这里需要用户配置正确的后端地址
          const serverHost = dbConfig.pool?.config?.host || '39.106.142.253';
          const serverPort = process.env.PORT || 3000;
          serverBaseUrl = `http://${serverHost}:${serverPort}`;
          console.log('[createTodoV2] ⚠️  从数据库host推断服务器地址:', serverBaseUrl);
          console.log('[createTodoV2] ⚠️  建议：在钉钉配置中设置 serverUrl（后端公网可访问地址）');
        }
      } else {
        console.log('[createTodoV2] 📍 使用环境变量 SERVER_URL:', serverBaseUrl);
      }
      
      // 强制使用后端代理接口，不依赖前端服务
      // 如果没有todoId，抛出错误，因为这是必需的
      if (!todoId) {
        console.error('[createTodoV2] ❌ todoId为空，无法构建详情页URL');
        throw new Error('待办ID不能为空，无法构建详情页URL。请确保在同步待办时传递了正确的待办ID。');
      }
      
      const todoDetailUrl = `${serverBaseUrl.replace(/\/$/, '')}/api/dingtalk/todo/redirect/${todoId}`;
      
      console.log('[createTodoV2] 🔗 服务器地址:', serverBaseUrl);
      console.log('[createTodoV2] 🔗 待办ID:', todoId);
      console.log('[createTodoV2] 🔗 生成的详情URL:', todoDetailUrl);
      
      const detailUrl = {
        pcUrl: String(todoDetailUrl), // PC端URL，确保是String类型
        appUrl: String(todoDetailUrl), // 移动端URL，确保是String类型
      };
      
      console.log('[createTodoV2] ✅ 最终detailUrl:', JSON.stringify(detailUrl, null, 2));
      
      // 确保所有参数都是正确的类型
      // 根据钉钉官方建议和调试台示例，最小参数集为：subject 和 detailUrl
      // 根据钉钉官方建议，data中的key和value需为String类型（除了数字类型字段）
      
      // 验证必填参数
      if (!subject || subject.trim() === '') {
        throw new Error('待办标题（subject）不能为空');
      }
      
      // 在标题前添加墨枫CRM标识符
      const subjectWithBrand = `[墨枫CRM] ${subject.trim()}`;
      
      const requestBody = {
        subject: String(subjectWithBrand), // 标题，必填，确保是String，已添加标识符
        detailUrl: detailUrl, // detailUrl是必填项，从2024年2月1日起
      };
      
      // 可选参数
      if (description && description.trim()) {
        // 在描述中也添加标识符
        const descriptionWithBrand = `[墨枫CRM系统] ${description.trim()}`;
        requestBody.description = String(descriptionWithBrand); // 描述，确保是String，已添加标识符
      }
      
      // 如果有截止时间（数字类型，不需要转换为String）
      // dueTime应该是Unix时间戳（秒），需要转换为毫秒
      if (dueTime) {
        const dueTimeMs = Number(dueTime) * 1000;
        if (isNaN(dueTimeMs) || dueTimeMs <= 0) {
          console.warn('[createTodoV2] ⚠️  截止时间格式不正确，跳过该参数');
        } else {
          requestBody.dueTime = dueTimeMs; // 转换为毫秒，确保是Number类型
        }
      }
      
      // 设置执行人（executorIds）：必须设置，否则待办会出现在"我创建的"而不是"待我处理"
      // executorIds应该是unionId数组，不是userid
      // 注意：路径参数中的unionId是创建者，executorIds是执行人（待办分配给谁）
      // 这里userId是执行人的userid，需要转换为unionId
      try {
        const executorUnionId = await this.getUserUnionId(userId);
        requestBody.executorIds = [String(executorUnionId)]; // 执行人unionId列表
        console.log('[createTodoV2] ✅ 已设置执行人unionId:', executorUnionId);
      } catch (executorError) {
        console.warn('[createTodoV2] ⚠️  无法获取执行人unionId，待办可能出现在"我创建的"中:', executorError.message);
        // 如果无法获取执行人unionId，仍然创建待办，但会出现在"我创建的"中
      }
      
      // 可选：添加参与者（participantIds）
      // requestBody.participantIds = [String(executorUnionId)];
      
      console.log('[createTodoV2] 请求URL:', url);
      console.log('[createTodoV2] unionId (路径参数):', unionId);
      console.log('[createTodoV2] 原始userId:', userId);
      console.log('[createTodoV2] 请求参数（类型检查）:', {
        subject: typeof requestBody.subject,
        description: requestBody.description ? typeof requestBody.description : 'not set',
        detailUrl: typeof requestBody.detailUrl,
        dueTime: requestBody.dueTime ? typeof requestBody.dueTime : 'not set',
      });
      console.log('[createTodoV2] 请求参数（完整）:', JSON.stringify(requestBody, null, 2));
      
      const response = await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'x-acs-dingtalk-access-token': String(accessToken), // 使用header传递access_token，确保是String
        },
        timeout: 30000, // 30秒超时
      });

      console.log('[createTodoV2] API响应状态:', response.status);
      console.log('[createTodoV2] API响应数据:', JSON.stringify(response.data, null, 2));

      // 新API可能返回不同的错误格式
      if (response.data.errorCode || response.data.errorMessage) {
        console.error('[createTodoV2] ❌ 创建待办失败:', {
          errorCode: response.data.errorCode,
          errorMessage: response.data.errorMessage,
          fullResponse: response.data,
        });
        
        // 提供更详细的错误信息
        let errorMsg = response.data.errorMessage || response.data.errorCode || '未知错误';
        if (response.data.errorCode === '403' || errorMsg.includes('权限') || errorMsg.includes('permission')) {
          errorMsg = '权限不足，请确认：1. 已开通"待办应用中待办写权限"（Todo.Todo.Write） 2. access_token是通过当前应用的AppKey和AppSecret获取的';
        }
        
        throw new Error(`创建待办失败: ${errorMsg}`);
      }
      
      // 检查响应状态码
      if (response.status !== 200 && response.status !== 201) {
        console.error('[createTodoV2] ❌ 非成功状态码:', response.status);
        throw new Error(`创建待办失败: HTTP ${response.status}`);
      }

      // 新API返回格式：{ id, subject, ... }
      const result = response.data.result || response.data || {};
      console.log('[createTodoV2] ✅ 创建成功，id:', result.id || result.taskId);
      
      // 适配返回格式，统一返回record_id字段
      return {
        record_id: result.id || result.taskId || result.record_id,
        id: result.id || result.taskId,
        ...result,
      };
    } catch (error) {
      console.error('[createTodoV2] ❌ 调用新版API失败:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        requestUrl: error.config?.url,
        requestBody: error.config?.data,
        requestHeaders: error.config?.headers,
      });
      
      // 根据钉钉官方建议，提供详细的错误诊断
      if (error.response?.status === 400) {
        // 400错误通常是请求参数格式问题
        const errorData = error.response?.data || {};
        const errorMsg = errorData.errorMessage || errorData.errmsg || errorData.message || '请求参数格式错误';
        
        // 常见400错误原因
        let detailedMsg = `创建待办失败（400错误）: ${errorMsg}\n\n可能的原因：\n`;
        detailedMsg += '1. unionId格式不正确（需要使用unionId，不能使用userid）\n';
        detailedMsg += '2. detailUrl格式不正确（需要包含pcUrl和appUrl）\n';
        detailedMsg += '3. 请求参数类型不正确（subject必须是字符串，dueTime必须是数字）\n';
        detailedMsg += '4. 必填参数缺失（subject和detailUrl是必填项）\n\n';
        detailedMsg += `请求URL: ${error.config?.url}\n`;
        detailedMsg += `请求参数: ${JSON.stringify(JSON.parse(error.config?.data || '{}'), null, 2)}`;
        
        throw new Error(detailedMsg);
      } else if (error.response?.status === 403) {
        const permissionError = error.response?.data?.errorMessage || error.response?.data?.errorCode || '';
        if (permissionError.includes('权限') || permissionError.includes('permission') || permissionError.includes('Todo.Todo.Write')) {
          throw new Error('权限不足：应用尚未开通"待办应用中待办写权限"（Todo.Todo.Write）。\n' +
            '请登录钉钉开放平台（https://open.dingtalk.com）-> 应用管理 -> 选择您的应用 -> 权限管理 -> 搜索"Todo.Todo.Write"或"待办应用中待办写权限" -> 申请并开通该权限。');
        }
        throw new Error('权限不足，请检查：1. 已开通"待办应用中待办写权限"（Todo.Todo.Write） 2. access_token是通过当前应用的AppKey和AppSecret获取的 3. 应用的使用范围已包含需要调用接口的用户');
      } else if (error.response?.status === 401) {
        throw new Error('access_token无效或已过期，请重新获取（access_token有效期为2小时）');
      } else if (error.response?.data?.errorMessage?.includes('detailUrl') || 
          error.message?.includes('detailUrl')) {
        throw new Error('创建待办失败: detailUrl字段为必填项，请检查配置');
      } else if (error.response?.data?.errorMessage) {
        // 检查是否是权限相关的错误
        const errorMsg = error.response.data.errorMessage;
        if (errorMsg.includes('权限') || errorMsg.includes('permission') || errorMsg.includes('60011')) {
          throw new Error('权限不足：应用尚未开通"待办应用中待办写权限"（Todo.Todo.Write）。\n' +
            '请登录钉钉开放平台（https://open.dingtalk.com）-> 应用管理 -> 选择您的应用 -> 权限管理 -> 搜索"Todo.Todo.Write"或"待办应用中待办写权限" -> 申请并开通该权限。');
        }
        throw new Error(`创建待办失败: ${errorMsg}`);
      }
      
      throw error;
    }
  }

  // 创建待办任务（根据钉钉官方文档）
  // 文档：https://open.dingtalk.com/document/development/add-dingtalk-to-do-task
  // API：https://oapi.dingtalk.com/topapi/workrecord/add
  async createTodoLegacy(userId, subject, description, dueTime) {
    try {
      console.log('[createTodoLegacy] 使用钉钉官方API创建待办');
      const accessToken = await this.getAccessToken();
      const config = await DingTalkConfig.findWithSecrets();

      // 根据官方文档，使用旧版API
      const url = 'https://oapi.dingtalk.com/topapi/workrecord/add';
      
      // 在标题前添加墨枫CRM标识符
      const subjectWithBrand = `[墨枫CRM] ${subject}`;
      
      // 构建请求参数（根据官方文档格式）
      const requestBody = {
        userid: userId,
        create_time: Math.floor(Date.now() / 1000),
        title: subjectWithBrand, // 已添加标识符
        url: `${config.callbackUrl || 'http://localhost:3000'}/todos`,
      };
      
      // 如果有描述，添加到forms中
      if (description) {
        const descriptionWithBrand = `[墨枫CRM系统] ${description}`;
        requestBody.forms = [
          {
            title: '描述',
            content: descriptionWithBrand || '', // 已添加标识符
          },
        ];
      }
      
      // 如果有截止时间，添加到forms中
      if (dueTime) {
        if (!requestBody.forms) {
          requestBody.forms = [];
        }
        requestBody.forms.push({
          title: '截止时间',
          content: new Date(dueTime * 1000).toLocaleString('zh-CN'),
        });
      }
      
      console.log('[createTodoLegacy] 请求URL:', url);
      console.log('[createTodoLegacy] 请求参数:', JSON.stringify(requestBody, null, 2));
      console.log('[createTodoLegacy] access_token:', accessToken ? accessToken.substring(0, 20) + '...' : 'null');
      
      const response = await axios.post(url, requestBody, {
        params: {
          access_token: accessToken,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('[createTodoLegacy] API响应状态:', response.status);
      console.log('[createTodoLegacy] API响应数据:', JSON.stringify(response.data, null, 2));

      if (response.data.errcode !== 0) {
        console.error('[createTodoLegacy] ❌ 创建待办失败:', {
          errcode: response.data.errcode,
          errmsg: response.data.errmsg,
        });
        throw new Error(`创建待办失败: ${response.data.errmsg || '未知错误'} (错误码: ${response.data.errcode})`);
      }

      const result = response.data.result || {};
      console.log('[createTodoLegacy] ✅ 创建成功，record_id:', result.record_id);
      return result;
    } catch (error) {
      console.error('[createTodoLegacy] ❌ 调用钉钉API失败:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        stack: error.stack,
      });
      
      // 提供更详细的错误信息
      if (error.response?.status === 401) {
        throw new Error('访问令牌无效，请检查钉钉配置');
      } else if (error.response?.data?.errmsg) {
        throw new Error(`创建待办失败: ${error.response.data.errmsg} (错误码: ${error.response.data.errcode})`);
      }
      
      throw error;
    }
  }

  // 更新待办任务
  async updateTodo(recordId, userId, subject, description) {
    try {
      console.log('[updateTodo] 开始更新钉钉待办');
      const accessToken = await this.getAccessToken();

      // 尝试使用新版API
      const url = 'https://api.dingtalk.com/v1.0/todo/workrecords';
      try {
        const response = await axios.put(url, {
          userid: userId,
          recordId: recordId,
          title: subject,
          forms: description ? [
            {
              title: '描述',
              content: description || '',
            },
          ] : [],
        }, {
          headers: {
            'x-acs-dingtalk-access-token': accessToken,
            'Content-Type': 'application/json',
          },
        });

        if (response.data.errorCode || (response.data.errcode && response.data.errcode !== 0)) {
          throw new Error(response.data.errorMessage || response.data.errmsg || '更新失败');
        }

        return response.data.result || response.data.data || response.data;
      } catch (error) {
        // 如果新版API失败，使用旧版API
        if (error.response?.status === 404) {
          return await this.updateTodoLegacy(recordId, userId, subject, description);
        }
        throw error;
      }
    } catch (error) {
      console.error('[updateTodo] ❌ 更新钉钉待办失败:', error.message);
      throw error;
    }
  }

  // 旧版更新API（兼容性）
  async updateTodoLegacy(recordId, userId, subject, description) {
    const accessToken = await this.getAccessToken();
    const url = 'https://oapi.dingtalk.com/topapi/workrecord/update';
    const response = await axios.post(url, {
      userid: userId,
      record_id: recordId,
      title: subject,
      forms: description ? [
        {
          title: '描述',
          content: description || '',
        },
      ] : [],
    }, {
      params: {
        access_token: accessToken,
      },
    });

    if (response.data.errcode !== 0) {
      throw new Error(`更新待办失败: ${response.data.errmsg}`);
    }

    return response.data.result;
  }

  // 完成待办任务
  async completeTodo(recordId, userId) {
    try {
      console.log('[completeTodo] 开始完成钉钉待办');
      console.log('[completeTodo] recordId:', recordId, 'userId:', userId);
      
      const accessToken = await this.getAccessToken();
      
      // 获取用户的unionId（新版API需要使用unionId）
      let unionId;
      try {
        unionId = await this.getUserUnionId(userId);
        if (!unionId || unionId.trim() === '') {
          throw new Error('获取到的unionId为空');
        }
        console.log('[completeTodo] ✅ 获取到unionId:', unionId);
      } catch (unionIdError) {
        console.error('[completeTodo] ❌ 获取unionId失败:', unionIdError.message);
        // 如果获取unionId失败，尝试使用旧版API
        console.log('[completeTodo] 尝试使用旧版API...');
        return await this.completeTodoLegacy(recordId, userId);
      }

      // 使用新版API完成待办（Todo.Todo.Write权限）
      // 根据钉钉文档，完成待办应该使用 PUT /v1.0/todo/users/{unionId}/tasks/{taskId}
      // recordId 就是 taskId（创建待办时返回的 id）
      // 注意：完成待办需要更新任务状态，可能需要使用不同的API端点
      // 尝试使用更新任务API，设置 done 状态
      const url = `https://api.dingtalk.com/v1.0/todo/users/${String(unionId)}/tasks/${String(recordId)}`;
      
      console.log('[completeTodo] 使用新版API:', url);
      console.log('[completeTodo] 请求参数: { done: true }');
      
      try {
        // 根据钉钉文档，更新任务状态应该使用 PUT 方法
        const response = await axios.put(url, {
          done: true  // 标记为已完成
        }, {
          headers: {
            'x-acs-dingtalk-access-token': accessToken,
            'Content-Type': 'application/json',
          },
        });

        if (response.data.errorCode || (response.data.errcode && response.data.errcode !== 0)) {
          throw new Error(response.data.errorMessage || response.data.errmsg || '完成失败');
        }

        console.log('[completeTodo] ✅ 钉钉待办已完成（新版API）');
        return response.data.result || response.data.data || response.data;
      } catch (error) {
        console.error('[completeTodo] 新版API失败:', error.message);
        if (error.response?.data) {
          console.error('[completeTodo] 错误响应:', JSON.stringify(error.response.data, null, 2));
        }
        // 如果新版API失败，尝试使用旧版API
        if (error.response?.status === 404 || error.response?.status === 400 || error.response?.status === 403) {
          console.log('[completeTodo] 尝试使用旧版API...');
          return await this.completeTodoLegacy(recordId, userId);
        }
        throw error;
      }
    } catch (error) {
      console.error('[completeTodo] ❌ 完成钉钉待办失败:', error.message);
      throw error;
    }
  }

  // 旧版完成API（兼容性）
  async completeTodoLegacy(recordId, userId) {
    const accessToken = await this.getAccessToken();
    const url = 'https://oapi.dingtalk.com/topapi/workrecord/update';
    const response = await axios.post(url, {
      userid: userId,
      record_id: recordId,
      status: 1, // 1表示完成
    }, {
      params: {
        access_token: accessToken,
      },
    });

    if (response.data.errcode !== 0) {
      throw new Error(`完成待办失败: ${response.data.errmsg}`);
    }

    return response.data.result;
  }

  // 生成登录URL（已废弃，使用控制器中的方法）
  async generateLoginUrl(redirectUri) {
    const config = await DingTalkConfig.findWithSecrets();
    if (!config || !config.enabled) {
      throw new Error('钉钉配置未启用');
    }
    
    const baseUrl = 'https://oapi.dingtalk.com/connect/oauth2/sns_authorize';
    return `${baseUrl}?appid=${config.appKey}&response_type=code&scope=snsapi_login&state=STATE&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  // 验证回调签名
  verifyCallback(signature, timestamp, nonce, token) {
    const tmpArr = [token, timestamp, nonce].sort();
    const tmpStr = tmpArr.join('');
    const hash = crypto.createHash('sha1').update(tmpStr).digest('hex');
    return hash === signature;
  }

  /**
   * 创建钉钉审批流程实例（三方流程对接钉钉OA）
   * 文档：https://open.dingtalk.com/document/development/use-the-three-party-process-to-interface-with-the-dingtalk-oa
   * 
   * @param {Object} params - 审批流程参数
   * @param {string} params.processCode - 流程编码（自定义，用于标识流程类型）
   * @param {string} params.originatorUserId - 发起人钉钉用户ID
   * @param {string} params.deptId - 发起人部门ID（可选）
   * @param {Array} params.approvers - 审批人列表 [{userid: 'xxx', type: 'AND'|'OR'}]
   * @param {Array} params.formComponents - 表单组件列表
   * @param {string} params.title - 审批标题
   * @param {string} params.description - 审批描述（可选）
   * @param {string} params.businessId - 业务ID（用于关联自己的流程实例）
   * @param {string} params.callbackUrl - 回调地址（可选，使用配置中的默认回调）
   * @returns {Promise<Object>} 返回审批流程实例信息
   */
  async createApprovalProcessInstance(params) {
    try {
      console.log('[createApprovalProcessInstance] 开始创建钉钉审批流程实例');
      const accessToken = await this.getAccessToken();
      const config = await DingTalkConfig.findWithSecrets();
      
      if (!config || !config.enabled) {
        throw new Error('钉钉配置未启用或不存在');
      }

      // 构建审批人列表
      const approvers = params.approvers.map(approver => ({
        userid: approver.userid,
        type: approver.type || 'AND', // AND表示会签，OR表示或签
      }));

      // 获取审批模板编码（优先使用配置中的，否则使用传入的，最后使用默认值）
      const processCode = config.approvalProcessCode || params.processCode || 'DEFAULT_PROCESS';
      
      if (!config.approvalProcessCode && processCode === 'DEFAULT_PROCESS') {
        console.warn('[createApprovalProcessInstance] ⚠️  未配置审批模板编码，使用默认值可能失败');
        console.warn('[createApprovalProcessInstance] 提示：请在钉钉开放平台创建审批模板，并配置 approvalProcessCode');
      }

      // 构建请求体
      const requestBody = {
        processCode: processCode,
        originatorUserId: params.originatorUserId,
        deptId: params.deptId || -1, // -1表示不指定部门
        approvers: approvers,
        formComponentValues: params.formComponents || [],
        title: params.title,
        description: params.description || '',
        businessId: params.businessId, // 用于关联自己的流程实例
        callbackUrl: params.callbackUrl || `${config.serverUrl || process.env.SERVER_URL || 'http://localhost:3000'}/api/dingtalk/approval/callback`,
      };

      console.log('[createApprovalProcessInstance] 请求参数:', JSON.stringify(requestBody, null, 2));

      // 调用钉钉API创建审批流程实例
      // 使用新版API：/v1.0/workflow/processInstances
      const url = 'https://api.dingtalk.com/v1.0/workflow/processInstances';
      const response = await axios.post(url, requestBody, {
        headers: {
          'x-acs-dingtalk-access-token': accessToken,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      console.log('[createApprovalProcessInstance] 钉钉API响应:', JSON.stringify(response.data, null, 2));

      if (response.data.errorCode || (response.data.errcode && response.data.errcode !== 0)) {
        const errorCode = response.data.errorCode || response.data.errcode;
        const errorMsg = response.data.errorMessage || response.data.errmsg || '创建审批流程失败';
        
        console.error('[createApprovalProcessInstance] ❌ 创建失败:', errorMsg);
        console.error('[createApprovalProcessInstance] 错误代码:', errorCode);
        console.error('[createApprovalProcessInstance] 使用的ProcessCode:', processCode);
        console.error('[createApprovalProcessInstance] 发送的字段:', JSON.stringify(requestBody.formComponentValues, null, 2));
        
        // 如果是模板不存在错误，提供更详细的提示
        if (errorCode === 'processCodeError' || errorMsg.includes('模板') || errorMsg.includes('processCode')) {
          const detailedError = new Error(
            `审批模板不存在或配置错误。\n` +
            `ProcessCode: ${processCode}\n` +
            `可能的原因：\n` +
            `1. ProcessCode 不正确，请检查钉钉开放平台中的模板ID\n` +
            `2. 模板已被删除或未发布\n` +
            `3. 模板字段名称与系统不匹配\n` +
            `4. 模板所属应用不正确\n` +
            `\n请检查：\n` +
            `- 在钉钉开放平台确认模板ID是否正确\n` +
            `- 确认模板已发布\n` +
            `- 确认模板字段名称与系统一致（审批内容、编号、名称、客户名称、金额等）`
          );
          detailedError.code = errorCode;
          throw detailedError;
        }
        
        throw new Error(errorMsg);
      }

      const result = response.data.result || response.data.data || response.data;
      console.log('[createApprovalProcessInstance] ✅ 审批流程实例创建成功, processInstanceId:', result.processInstanceId);
      
      return {
        processInstanceId: result.processInstanceId,
        ...result,
      };
    } catch (error) {
      console.error('[createApprovalProcessInstance] ❌ 创建钉钉审批流程实例失败:', error.message);
      if (error.response) {
        console.error('[createApprovalProcessInstance] 响应数据:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * 查询钉钉审批流程实例
   * @param {string} processInstanceId - 审批流程实例ID
   * @returns {Promise<Object>} 返回审批流程实例详情
   */
  async getApprovalProcessInstance(processInstanceId) {
    try {
      const accessToken = await this.getAccessToken();
      const url = `https://api.dingtalk.com/v1.0/workflow/processInstances/${processInstanceId}`;
      
      const response = await axios.get(url, {
        headers: {
          'x-acs-dingtalk-access-token': accessToken,
        },
        timeout: 10000,
      });

      if (response.data.errorCode || (response.data.errcode && response.data.errcode !== 0)) {
        throw new Error(response.data.errorMessage || response.data.errmsg || '查询审批流程失败');
      }

      return response.data.result || response.data.data || response.data;
    } catch (error) {
      console.error('[getApprovalProcessInstance] ❌ 查询钉钉审批流程实例失败:', error.message);
      throw error;
    }
  }

  /**
   * 发送工作通知卡片（类似宜搭的效果）
   * API文档：https://open.dingtalk.com/document/orgapp/send-work-notification
   */
  async sendWorkNotificationCard(userId, todoId, title, description, moduleType, moduleId, initiatorName, initiatorId) {
    try {
      console.log('[sendWorkNotificationCard] 开始发送工作通知卡片');
      console.log('[sendWorkNotificationCard] 参数:', { userId, todoId, title, description: description?.substring(0, 50), moduleType, moduleId });

      // 检查todo状态，判断是否已处理
      const Todo = require('../models/Todo');
      const todo = await Todo.findById(todoId);
      const isProcessed = todo && (todo.status === 'completed' || todo.status === 'cancelled' || todo.action === 'approve' || todo.action === 'reject');
      const actionStatus = todo?.action === 'approve' ? '已同意' : todo?.action === 'reject' ? '已拒绝' : '';
      
      console.log('[sendWorkNotificationCard] Todo状态:', { status: todo?.status, action: todo?.action, isProcessed, actionStatus });

      const accessToken = await this.getAccessToken();
      const config = await DingTalkConfig.findWithSecrets();

      if (!config || !config.enabled) {
        throw new Error('钉钉配置未启用');
      }

      if (!config.agentId) {
        console.warn('[sendWorkNotificationCard] ⚠️  AgentId未配置，无法发送工作通知');
        return null;
      }

      // 获取服务器地址（用于构建详情页URL）
      let serverBaseUrl = process.env.SERVER_URL;
      if (!serverBaseUrl && config.serverUrl) {
        serverBaseUrl = config.serverUrl;
      }
      if (!serverBaseUrl) {
        const dbConfig = require('../config/database');
        const serverHost = dbConfig.pool?.config?.host || '39.106.142.253';
        const serverPort = process.env.PORT || 3000;
        serverBaseUrl = `http://${serverHost}:${serverPort}`;
      }

      const detailUrl = `${serverBaseUrl.replace(/\/$/, '')}/api/dingtalk/todo/redirect/${todoId}`;

      // 获取模块详细信息（合同、商机等）
      let moduleInfo = null;
      let cardTitle = title;
      let cardMarkdown = '';
      
      try {
        if (moduleType === 'contract' || moduleType === 'contracts') {
          const Contract = require('../models/Contract');
          moduleInfo = await Contract.findById(moduleId);
          if (moduleInfo) {
            // 构建类似宜搭的标题：[墨枫CRM] 审批合同: 合同编号 - 合同标题
            const contractNumber = moduleInfo.contractNumber || '';
            const contractTitle = moduleInfo.title || '';
            cardTitle = `[墨枫CRM] 审批合同: ${contractNumber}${contractTitle ? ' - ' + contractTitle : ''}`;
            
            // 构建简洁的markdown内容（类似宜搭样式）
            cardMarkdown = `**发起人:** ${initiatorName || '系统'}\n\n`;
            
            // 如果有客户名称，也显示
            if (moduleInfo.customerName) {
              cardMarkdown += `**客户名称:** ${moduleInfo.customerName}\n\n`;
            }
            
            // 如果有合同金额，也显示
            if (moduleInfo.amount) {
              cardMarkdown += `**合同金额:** ¥${parseFloat(moduleInfo.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
            }
          }
        } else if (moduleType === 'opportunity' || moduleType === 'opportunities') {
          const Opportunity = require('../models/Opportunity');
          moduleInfo = await Opportunity.findById(moduleId);
          if (moduleInfo) {
            cardTitle = `[墨枫CRM] 审批商机: ${moduleInfo.name || ''}`;
            // 构建简洁的markdown内容（类似宜搭样式）
            cardMarkdown = `**发起人:** ${initiatorName || '系统'}\n\n`;
            if (moduleInfo.amount) {
              cardMarkdown += `**预计金额:** ¥${parseFloat(moduleInfo.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
            }
          }
        }
      } catch (moduleError) {
        console.warn('[sendWorkNotificationCard] 获取模块信息失败:', moduleError.message);
      }
      
      // 如果没有获取到模块信息，使用默认格式
      if (!cardMarkdown) {
        cardTitle = `${initiatorName || '系统'}发起的${title}`;
        cardMarkdown = `**发起人:** ${initiatorName || '系统'}\n\n`;
        if (description && description.trim()) {
          const shortDesc = description.length > 100 ? description.substring(0, 100) + '...' : description;
          cardMarkdown += `**描述:** ${shortDesc}\n\n`;
        }
      }
      
      // 添加发起时间（使用更简洁的格式，类似宜搭）
      const initTime = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      cardMarkdown += `**发起时间:** ${initTime}`;
      
      // 如果已处理，添加状态标识
      if (actionStatus) {
        cardMarkdown += `\n\n**状态:** ${actionStatus}`;
      }
      
      // 构建actionCard消息体（模仿宜搭的简洁样式）
      const actionCard = {
        title: cardTitle,
        markdown: cardMarkdown,
        btn_orientation: '0' // 按钮横向排列（类似宜搭）
      };
      
      // 如果未处理，显示操作按钮；如果已处理，不显示按钮
      if (!isProcessed) {
        actionCard.btn_json_list = [
          {
            title: '拒绝',
            action_url: `${detailUrl}?action=reject` // 拒绝按钮（左侧）
          },
          {
            title: '同意',
            action_url: `${detailUrl}?action=approve` // 同意按钮（右侧）
          }
        ];
      } else {
        // 已处理，不显示按钮，只显示一个查看详情按钮
        actionCard.btn_json_list = [
          {
            title: actionStatus || '查看详情',
            action_url: detailUrl
          }
        ];
      }
      
      const cardMessage = {
        msgtype: 'action_card',
        action_card: actionCard
      };
      
      console.log('[sendWorkNotificationCard] 构建的actionCard:', JSON.stringify(actionCard, null, 2));

      // 调用工作通知API
      const url = `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${accessToken}`;
      
      const requestBody = {
        agent_id: String(config.agentId),
        userid_list: String(userId), // 接收通知的用户ID
        msg: cardMessage,
        to_all_user: false
      };

      console.log('[sendWorkNotificationCard] 请求URL:', url);
      console.log('[sendWorkNotificationCard] 请求参数:', JSON.stringify(requestBody, null, 2));

      const response = await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      console.log('[sendWorkNotificationCard] API响应状态:', response.status);
      console.log('[sendWorkNotificationCard] API响应数据:', JSON.stringify(response.data, null, 2));

      if (response.data.errcode !== 0) {
        throw new Error(`发送工作通知失败: ${response.data.errmsg || response.data.errorMessage}`);
      }

      console.log('[sendWorkNotificationCard] ✅ 工作通知卡片发送成功');
      return response.data;
    } catch (error) {
      console.error('[sendWorkNotificationCard] ❌ 发送工作通知卡片失败:', error.message);
      if (error.response) {
        console.error('[sendWorkNotificationCard] 响应数据:', JSON.stringify(error.response.data, null, 2));
      }
      // 不抛出错误，避免影响主流程
      return null;
    }
  }

  /**
   * 发送钉钉互动卡片（卡片实例）
   * 参考文档：https://open.dingtalk.com/document/development/interface-for-creating-a-card-instance
   */
  async sendInteractiveCard(options = {}) {
    try {
      const config = await DingTalkConfig.findWithSecrets();
      if (!config || !config.cardInstanceEnabled) {
        return null;
      }
      if (!config.cardTemplateId) {
        console.warn('[sendInteractiveCard] ⚠️  cardTemplateId 未配置，跳过发送');
        return null;
      }

      const {
        userId,
        todoId,
        title,
        description,
        moduleType,
        moduleId,
        initiatorName,
        customerName,
      } = options;

      const unionId = await this.getUserUnionId(userId);
      if (!unionId) {
        console.warn('[sendInteractiveCard] ⚠️  无法获取用户 unionId，跳过互动卡片推送');
        return null;
      }

      const accessToken = await this.getAccessToken();

      // 构建待办详情链接
      const configWithSecrets = config;
      let serverBaseUrl = process.env.SERVER_URL || configWithSecrets.serverUrl || configWithSecrets.callbackUrl;
      if (!serverBaseUrl) {
        const dbConfig = require('../config/database');
        const serverHost = dbConfig.pool?.config?.host || '127.0.0.1';
        const serverPort = process.env.PORT || 3000;
        serverBaseUrl = `http://${serverHost}:${serverPort}`;
      }
      const detailUrl = `${serverBaseUrl.replace(/\/$/, '')}/api/dingtalk/todo/redirect/${todoId}`;

      const summary = description && description.trim()
        ? description.substring(0, 80)
        : `请处理：${title}`;

      const paramMap = {
        title: `[墨枫CRM] ${title}`,
        statusTag: '待处理',
        summary: summary,
        initiator: initiatorName || '系统',
        customer: customerName || '',
        moduleLabel: moduleType || '',
        detailUrl,
        actionUrl: detailUrl,
      };

      const payload = {
        cardTemplateId: config.cardTemplateId,
        outTrackId: `crm_todo_${todoId || Date.now()}`,
        cardInstanceId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
        cardBizId: `crm_todo_${todoId || Date.now()}`,
        receiverUnionIds: [String(unionId)],
        cardData: {
          cardParamMap: paramMap,
        },
      };

      if (config.cardRouteKey) {
        payload.callbackRouteKey = config.cardRouteKey;
      }

      const url = 'https://api.dingtalk.com/v1.0/card/instances';
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-acs-dingtalk-access-token': accessToken,
        },
        timeout: 15000,
      });

      if (response.data?.errorCode) {
        throw new Error(response.data.errorMessage || response.data.errorCode);
      }

      console.log('[sendInteractiveCard] ✅ 互动卡片发送成功:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.error('[sendInteractiveCard] ❌ 发送互动卡片失败:', error.message);
      if (error.response) {
        console.error('[sendInteractiveCard] 响应数据:', JSON.stringify(error.response.data, null, 2));
      }
      return null;
    }
  }
}

module.exports = new DingTalkService();

