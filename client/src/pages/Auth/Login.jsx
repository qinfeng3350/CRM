import { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Card, message, Divider, Tabs, Space } from 'antd';
import { UserOutlined, LockOutlined, QrcodeOutlined, MobileOutlined, DesktopOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { dingTalkService } from '../../services/dingTalkService';
import './DingTalkQRLogin.css';

const Login = () => {
  // 立即输出日志，确保组件被加载（使用 try-catch 确保不会因为错误而阻止渲染）
  // 使用 window 对象防止重复发送日志（模块级别）
  if (!window._loginRenderLogSent) {
    try {
      console.log('==========================================');
      console.log('✅ Login 组件开始渲染');
      console.log('==========================================');
      
      // 尝试发送日志到后端（但不阻塞渲染）
      if (typeof fetch === 'function') {
        fetch('/api/dingtalk/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            level: 'info', 
            message: '✅ Login 组件开始渲染',
            data: { 
              userAgent: navigator.userAgent.substring(0, 100),
              url: window.location.href.substring(0, 100)
            }
          }),
        }).catch(() => {}); // 静默失败
      }
      
      window._loginRenderLogSent = true;
    } catch (e) {
      // 忽略错误，确保组件能正常渲染
      console.warn('Login 组件初始化日志失败:', e);
    }
  }
  
  const [loading, setLoading] = useState(false);
  const [dingTalkLoading, setDingTalkLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('account'); // 'account' | 'dingtalk'
  const navigate = useNavigate();

  // 自动检测并处理钉钉免登（像宜搭一样）
  // 直接在 /login 页面处理免登，避免路径不匹配问题
  const loginAttemptedRef = useRef(false); // 使用 useRef 防止重复执行
  const readyCallbackSetRef = useRef(false); // 防止重复设置 ready 回调
  const checkIntervalRef = useRef(null); // 保存 interval 引用
  const configRef = useRef(null); // 保存配置，避免重复获取
  const useEffectExecutedRef = useRef(false); // 防止 useEffect 重复执行
  
  // 发送日志到后端（用于钉钉客户端内调试）
  const logToBackend = (level, message, data = null) => {
    // 先打印到控制台，确保即使后端日志失败也能看到
    console.log(`[${level}] ${message}`, data || '');
    try {
      // 检查 dingTalkService 是否可用
      if (dingTalkService && typeof dingTalkService.logToBackend === 'function') {
        const logPromise = dingTalkService.logToBackend(level, message, data);
        // 确保返回的是 Promise
        if (logPromise && typeof logPromise.catch === 'function') {
          logPromise.catch((err) => {
            // 静默失败，避免阻塞，但记录到控制台
            console.warn('发送日志到后端失败:', err);
          });
        }
      } else {
        // 如果 dingTalkService 不可用，尝试直接使用 fetch
        if (typeof fetch === 'function') {
          fetch('/api/dingtalk/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level, message, data }),
          }).catch(() => {}); // 静默失败
        }
      }
    } catch (e) {
      // 忽略错误，但记录到控制台
      console.warn('logToBackend 异常:', e);
    }
  };
  
  // 检测是否在钉钉客户端内（必须在 useEffect 之前定义）
  const isInDingTalkClient = () => {
    try {
      const userAgent = window.navigator.userAgent;
      const currentUrl = window.location.href;
      const referrer = document.referrer || '';
      
      // 检测方式1：User-Agent包含DingTalk（PC端和部分移动端）
      const hasDingTalkUserAgent = userAgent.indexOf('DingTalk') > -1 || 
                                   userAgent.toLowerCase().indexOf('dingtalk') > -1;
      
      // 检测方式2：检查window.dd是否存在（JSAPI已加载，说明在钉钉客户端内）
      const hasDd = typeof window.dd !== 'undefined';
      
      // 检测方式3：检查URL参数中是否有钉钉相关的参数（移动端可能通过这种方式）
      const urlParams = new URLSearchParams(window.location.search);
      const hasDingTalkParams = urlParams.has('dd_debug_h5') || 
                               urlParams.has('dd_debug_v1') || 
                               urlParams.has('dd_debug_unifiedAppId') ||
                               urlParams.has('dd_debug_os') ||
                               urlParams.has('dd_debug_token');
      
      // 检测方式4：检查window.location.href中是否包含钉钉相关字符串
      const hasDingTalkInUrl = currentUrl.includes('dd_debug') || 
                              currentUrl.toLowerCase().includes('dingtalk');
      
      // 检测方式5：检查referrer（某些情况下可能包含钉钉相关信息）
      const hasDingTalkInReferrer = referrer.toLowerCase().includes('dingtalk') ||
                                   referrer.includes('dd_debug');
      
      // 只要满足任一条件，就认为在钉钉客户端内
      const inDingTalk = hasDingTalkUserAgent || hasDd || hasDingTalkParams || 
                        hasDingTalkInUrl || hasDingTalkInReferrer;
      
      // 记录详细的检测信息
      const detectionInfo = {
        userAgent: userAgent.substring(0, 100),
        hasDingTalkUserAgent,
        hasDd,
        hasDingTalkParams,
        hasDingTalkInUrl,
        hasDingTalkInReferrer,
        referrer: referrer.substring(0, 100),
        currentUrl: currentUrl.substring(0, 100),
        inDingTalk
      };
      
      console.log('🔍 检测钉钉客户端环境:', detectionInfo);
      
      return inDingTalk;
    } catch (error) {
      console.error('检测钉钉客户端环境时出错:', error);
      return false;
    }
  };
  
  useEffect(() => {
    // 立即发送日志，不依赖任何函数，确保能看到执行情况
    console.log('==========================================');
    console.log('🚀 Login useEffect 执行');
    console.log('==========================================');
    
    // 直接使用 fetch 发送日志，不依赖 logToBackend 函数
    try {
      if (typeof fetch === 'function') {
        fetch('/api/dingtalk/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            level: 'info', 
            message: '🚀 Login useEffect 执行',
            data: {
              loginAttemptedRef: loginAttemptedRef.current,
              hasWindowDd: typeof window.dd !== 'undefined',
              userAgent: navigator.userAgent.substring(0, 100),
              currentUrl: window.location.href.substring(0, 100)
            }
          }),
        }).catch(() => {}); // 静默失败
      }
    } catch (e) {
      console.warn('发送 useEffect 日志失败:', e);
    }
    
    // 也使用 logToBackend 函数发送（双重保障）
    logToBackend('info', '==========================================');
    logToBackend('info', '🚀 Login useEffect 执行', {
      loginAttemptedRef: loginAttemptedRef.current,
      hasWindowDd: typeof window.dd !== 'undefined',
      userAgent: navigator.userAgent.substring(0, 100),
      currentUrl: window.location.href.substring(0, 100)
    });
    logToBackend('info', '==========================================');
    
    // 防止重复执行
    if (useEffectExecutedRef.current) {
      console.warn('⚠️ useEffect 已执行，跳过重复调用');
      logToBackend('warn', '⚠️ useEffect 已执行，跳过重复调用');
      return;
    }
    useEffectExecutedRef.current = true; // 立即设置标志，防止重复执行
    
    // 立即发送日志，确保能看到执行情况
    console.log('✅ useEffect 标志已设置，准备等待JSAPI加载');
    try {
      if (typeof fetch === 'function') {
        fetch('/api/dingtalk/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            level: 'info', 
            message: '✅ useEffect 标志已设置，准备等待JSAPI加载'
          }),
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('发送日志失败:', e);
    }
    
    // 对于手机端，先等待一段时间让JSAPI加载（手机端可能需要更长时间）
    const isMobileDevice = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const waitTime = isMobileDevice ? 2000 : 500; // 手机端等待2秒，PC端等待0.5秒
    
    console.log('⏳ 等待JSAPI加载...', { isMobileDevice, waitTime });
    
    // 立即发送日志，不依赖 logToBackend
    try {
      if (typeof fetch === 'function') {
        fetch('/api/dingtalk/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            level: 'info', 
            message: '⏳ 等待JSAPI加载...',
            data: { isMobileDevice, waitTime }
          }),
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('发送日志失败:', e);
    }
    
    logToBackend('info', '⏳ 等待JSAPI加载...', { isMobileDevice, waitTime });
    
    console.log('⏰ 设置 setTimeout，等待时间:', waitTime);
    const timer = setTimeout(() => {
      console.log('⏰ setTimeout 回调执行');
      
      // 立即发送日志
      try {
        if (typeof fetch === 'function') {
          fetch('/api/dingtalk/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              level: 'info', 
              message: '⏰ setTimeout 回调执行'
            }),
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('发送日志失败:', e);
      }
      
      // 检查是否在钉钉客户端内
      console.log('🔍 开始检查钉钉环境...');
      const inDingTalk = isInDingTalkClient();
      console.log('🔍 检查钉钉环境结果:', {
        inDingTalk,
        userAgent: navigator.userAgent.substring(0, 100),
        hasDd: typeof window.dd !== 'undefined',
        url: window.location.href.substring(0, 100)
      });
      
      // 立即发送日志
      try {
        if (typeof fetch === 'function') {
          fetch('/api/dingtalk/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              level: 'info', 
              message: '🔍 检查钉钉环境',
              data: {
                inDingTalk,
                userAgent: navigator.userAgent.substring(0, 100),
                hasDd: typeof window.dd !== 'undefined',
                url: window.location.href.substring(0, 100)
              }
            }),
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('发送日志失败:', e);
      }
      
      logToBackend('info', '🔍 检查钉钉环境', {
        inDingTalk,
        userAgent: navigator.userAgent.substring(0, 100),
        hasDd: typeof window.dd !== 'undefined',
        hasDdReady: typeof window.dd?.ready === 'function',
        hasDdRuntime: typeof window.dd?.runtime !== 'undefined',
        currentUrl: window.location.href.substring(0, 100)
      });
      
      if (!inDingTalk) {
        console.log('❌ 不在钉钉客户端内，显示登录选项');
        logToBackend('info', '❌ 不在钉钉客户端内，显示登录选项');
        // 即使不在钉钉客户端内，也尝试等待JSAPI加载（手机端可能需要时间）
        // 延迟3秒后再次检测
        setTimeout(() => {
          const retryInDingTalk = isInDingTalkClient();
          console.log('🔄 3秒后重新检测钉钉环境:', retryInDingTalk);
          logToBackend('info', '🔄 3秒后重新检测钉钉环境', { retryInDingTalk });
          if (retryInDingTalk && !loginAttemptedRef.current) {
            console.log('✅ 重新检测到钉钉环境，开始免登流程');
            logToBackend('info', '✅ 重新检测到钉钉环境，开始免登流程');
            performDingTalkLogin();
          }
        }, 3000);
        return;
      }
      
      // 在钉钉客户端内，开始免登流程
      console.log('✅ 检测到在钉钉客户端内，开始免登流程');
      
      // 立即发送日志
      try {
        if (typeof fetch === 'function') {
          fetch('/api/dingtalk/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              level: 'info', 
              message: '✅ 检测到在钉钉客户端内，开始免登流程',
              data: { inDingTalk, hasDd: typeof window.dd !== 'undefined' }
            }),
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('发送日志失败:', e);
      }
      
      logToBackend('info', '✅ 检测到在钉钉客户端内，开始免登流程');
      
      // 确保 performDingTalkLogin 函数存在
      if (typeof performDingTalkLogin === 'function') {
        console.log('✅ performDingTalkLogin 函数存在，开始调用');
        try {
          performDingTalkLogin();
        } catch (error) {
          console.error('❌ 调用 performDingTalkLogin 失败:', error);
          logToBackend('error', '❌ 调用 performDingTalkLogin 失败', {
            message: error.message,
            stack: error.stack
          });
        }
      } else {
        console.error('❌ performDingTalkLogin 函数不存在');
        logToBackend('error', '❌ performDingTalkLogin 函数不存在');
      }
    }, waitTime);
    
    // 清理函数
    return () => {
      clearTimeout(timer);
      // 清理 interval
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, []); // 使用空依赖数组，确保只执行一次
  
  // 免登流程函数（定义在 useEffect 外部，确保作用域正确）
  const performDingTalkLogin = async (skipConfig = false) => {
      console.log('🚀 performDingTalkLogin 开始执行', { skipConfig });
      
      // 立即发送日志
      try {
        if (typeof fetch === 'function') {
          fetch('/api/dingtalk/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              level: 'info', 
              message: '🚀 performDingTalkLogin 开始执行',
              data: { skipConfig }
            }),
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('发送日志失败:', e);
      }
      
      // 在开始执行时设置标志，防止重复执行
      if (loginAttemptedRef.current) {
        console.warn('⚠️ 免登流程已执行，跳过重复调用');
        logToBackend('warn', '⚠️ 免登流程已执行，跳过重复调用');
        return;
      }
      
      loginAttemptedRef.current = true;
      console.log('✅ 设置 loginAttemptedRef.current = true');
      logToBackend('info', '✅ 设置 loginAttemptedRef.current = true');
      logToBackend('info', '✅ 检测到在钉钉客户端内，开始免登流程...', { skipConfig });
      
      try {
        // 获取配置（只调用一次，如果已有配置则复用）
        console.log('🔵 开始获取钉钉配置...', { skipConfig, hasConfig: !!configRef.current });
        
        // 立即发送日志
        try {
          if (typeof fetch === 'function') {
            fetch('/api/dingtalk/log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                level: 'info', 
                message: '🔵 开始获取钉钉配置...',
                data: { skipConfig, hasConfig: !!configRef.current }
              }),
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('发送日志失败:', e);
        }
        
        let configResponse = configRef.current;
        if (!skipConfig && !configResponse) {
          logToBackend('info', '🔵 开始获取钉钉配置...');
          console.log('🔵 调用 dingTalkService.getQRLoginConfig()...');
          
          try {
            configResponse = await dingTalkService.getQRLoginConfig();
            console.log('✅ getQRLoginConfig 返回:', { 
              success: configResponse?.success, 
              hasData: !!configResponse?.data,
              hasClientId: !!configResponse?.data?.clientId 
            });
          } catch (error) {
            console.error('❌ getQRLoginConfig 失败:', error);
            logToBackend('error', '❌ getQRLoginConfig 失败', {
              message: error.message,
              stack: error.stack
            });
            setDingTalkLoading(false);
            return;
          }
          if (!configResponse || !configResponse.success || !configResponse.data) {
            console.error('❌ 钉钉配置未完成', configResponse);
            logToBackend('error', '❌ 钉钉配置未完成', configResponse);
            setDingTalkLoading(false);
            message.error('钉钉配置未完成，请使用扫码登录');
            // 不要重置标志，避免循环
            return;
          }
          configRef.current = configResponse; // 保存配置
          console.log('✅ 配置获取成功并已保存', {
            hasClientId: !!configResponse.data.clientId,
            hasCorpId: !!configResponse.data.corpId,
            clientId: configResponse.data.clientId ? configResponse.data.clientId.substring(0, 10) + '...' : '空'
          });
          
          // 立即发送日志
          try {
            if (typeof fetch === 'function') {
              fetch('/api/dingtalk/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  level: 'info', 
                  message: '✅ 配置获取成功并已保存',
                  data: {
                    hasClientId: !!configResponse.data.clientId,
                    hasCorpId: !!configResponse.data.corpId
                  }
                }),
              }).catch(() => {});
            }
          } catch (e) {
            console.warn('发送日志失败:', e);
          }
          
          logToBackend('info', '✅ 配置获取成功并已保存', {
            hasClientId: !!configResponse.data.clientId,
            hasCorpId: !!configResponse.data.corpId,
            clientId: configResponse.data.clientId ? configResponse.data.clientId.substring(0, 10) + '...' : '空'
          });
        } else if (skipConfig && configRef.current) {
          configResponse = configRef.current;
          logToBackend('info', '✅ 使用已保存的配置');
        } else {
          logToBackend('error', '❌ 没有配置可用');
          return;
        }
        
        if (!configResponse || !configResponse.success || !configResponse.data) {
          logToBackend('error', '❌ 钉钉配置未完成');
          return;
        }
        
        const corpId = configResponse.data.corpId || '';
        logToBackend('info', '✅ 获取到corpId', { corpId: corpId ? corpId.substring(0, 10) + '...' : '空（将使用当前企业）' });
        
        // 检查JSAPI是否已加载
        logToBackend('info', '🔍 检查 JSAPI 状态', {
          hasWindowDd: typeof window.dd !== 'undefined',
          hasDdReady: typeof window.dd?.ready === 'function',
          hasDdRuntime: typeof window.dd?.runtime !== 'undefined',
          hasDdError: typeof window.dd?.error === 'function',
          hasDdRuntimePermission: typeof window.dd?.runtime?.permission !== 'undefined',
          hasRequestAuthCode: typeof window.dd?.runtime?.permission?.requestAuthCode === 'function'
        });
        
        if (typeof window.dd === 'undefined') {
          logToBackend('warn', '⏳ JSAPI未加载，尝试动态加载并等待...');
          
          // 尝试动态加载JSAPI（如果index.html中没有加载）
          if (!document.querySelector('script[src*="dingtalk.open.js"]')) {
            logToBackend('info', '🔵 动态加载钉钉JSAPI...');
            const script = document.createElement('script');
            script.src = 'https://g.alicdn.com/dingding/dingtalk-jsapi/2.7.13/dingtalk.open.js';
            script.onerror = function() {
              logToBackend('error', '❌ 钉钉JSAPI动态加载失败');
            };
            script.onload = function() {
              logToBackend('info', '✅ 钉钉JSAPI动态加载成功');
            };
            document.head.appendChild(script);
          }
          
          let checkCount = 0;
          // 清除之前的 interval（如果存在）
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
          }
          checkIntervalRef.current = setInterval(() => {
            checkCount++;
            if (checkCount % 5 === 0) { // 每2.5秒打印一次日志
              logToBackend('info', `⏳ 等待 JSAPI 加载... (${checkCount}/40)`);
            }
            if (typeof window.dd !== 'undefined') {
              logToBackend('info', '✅ JSAPI已加载');
              if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
                checkIntervalRef.current = null;
              }
              // 重新执行免登流程，跳过配置获取
              // 注意：不要重置 loginAttemptedRef，因为我们已经执行过了
              // 但是需要重置 readyCallbackSetRef，允许重新设置回调
              readyCallbackSetRef.current = false;
              performDingTalkLogin(true); // 传入 true，跳过配置获取
            } else if (checkCount > 40) {
              // 20秒超时（手机端可能需要更长时间）
              logToBackend('error', '⏱️ JSAPI加载超时，可能不在钉钉客户端内或JSAPI加载失败', {
                checkCount,
                userAgent: navigator.userAgent.substring(0, 100),
                url: window.location.href.substring(0, 100)
              });
              if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
                checkIntervalRef.current = null;
              }
              setDingTalkLoading(false);
              message.warning('钉钉JSAPI加载超时，请确保在钉钉客户端内打开');
            }
          }, 500);
          return;
        }
        
        logToBackend('info', '✅ JSAPI 已加载，继续免登流程');
        
        // 定义授权请求函数
        const requestAuth = () => {
          logToBackend('info', '==========================================');
          logToBackend('info', '✅ 钉钉JSAPI已准备就绪，开始请求授权码...');
          logToBackend('info', '🔵 检查 window.dd.runtime', {
            hasRuntime: !!window.dd.runtime,
            hasPermission: !!window.dd.runtime?.permission,
            hasRequestAuthCode: !!window.dd.runtime?.permission?.requestAuthCode,
            corpId: corpId ? corpId.substring(0, 10) + '...' : '空（将使用当前企业）',
            appKey: configResponse.data.clientId ? configResponse.data.clientId.substring(0, 10) + '...' : '空'
          });
          logToBackend('info', '==========================================');
          
          if (!window.dd.runtime || !window.dd.runtime.permission || !window.dd.runtime.permission.requestAuthCode) {
            logToBackend('error', '❌ 钉钉JSAPI缺少 permission API', {
              hasDd: !!window.dd,
              hasRuntime: !!window.dd?.runtime,
              hasPermission: !!window.dd?.runtime?.permission,
              hasRequestAuthCode: !!window.dd?.runtime?.permission?.requestAuthCode
            });
            message.error('钉钉JSAPI版本过低或配置错误，请使用扫码登录');
            setDingTalkLoading(false);
            return;
          }
          
          try {
            // 请求授权码
            logToBackend('info', '🔵 准备调用 requestAuthCode...', { 
              corpId: corpId ? corpId.substring(0, 10) + '...' : '空（将使用当前企业）',
              appKey: configResponse.data.clientId ? configResponse.data.clientId.substring(0, 10) + '...' : '空'
            });
            
            setDingTalkLoading(true); // 显示加载状态
            
            // 根据钉钉官方文档，requestAuthCode 需要传递 corpId 参数
            // 如果不传递或传递空字符串，某些版本会报 "corpId 不合法" 错误
            // 如果配置了 corpId，使用配置的；否则传递空字符串，让钉钉使用当前企业
            const finalCorpId = (corpId && corpId.trim()) ? corpId : '';
            
            // 清理URL中的查询参数（钉钉客户端会自动添加 dd_debug_* 参数）
            // 这些参数会导致钉钉检查端内免登地址时匹配失败
            // 解决方案：在调用 requestAuthCode 之前，先清理URL中的查询参数
            const currentUrl = window.location.href;
            const urlWithoutParams = currentUrl.split('?')[0]; // 移除所有查询参数
            if (currentUrl !== urlWithoutParams) {
              logToBackend('info', '🔵 检测到URL包含查询参数，清理URL', {
                originalUrl: currentUrl.substring(0, 100) + '...',
                cleanedUrl: urlWithoutParams
              });
              // 使用 replaceState 清理URL中的查询参数，但不刷新页面
              window.history.replaceState({}, '', urlWithoutParams);
            }
            
            logToBackend('info', '🔵 调用 requestAuthCode', {
              corpId: finalCorpId ? finalCorpId.substring(0, 10) + '...' : '空字符串（使用当前企业）',
              configuredCorpId: corpId ? corpId.substring(0, 10) + '...' : '未配置',
              currentUrl: window.location.href
            });
            
            window.dd.runtime.permission.requestAuthCode({
              corpId: finalCorpId, // 传递 corpId，如果为空则传递空字符串
              onSuccess: async (result) => {
                logToBackend('info', '✅ 获取授权码成功', { 
                  hasCode: !!result.code,
                  codeLength: result.code?.length || 0,
                  codePreview: result.code ? result.code.substring(0, 10) + '...' : '空'
                });
                setDingTalkLoading(true);
                try {
                  // 使用授权码登录
                  logToBackend('info', '🔵 使用授权码登录...');
                  const loginResponse = await dingTalkService.loginWithCode(result.code);
                  if (loginResponse && loginResponse.success) {
                    logToBackend('info', '✅ 登录成功', {
                      hasToken: !!loginResponse.data.token,
                      userId: loginResponse.data.user?.id,
                      userName: loginResponse.data.user?.name
                    });
                    localStorage.setItem('token', loginResponse.data.token);
                    localStorage.setItem('user', JSON.stringify(loginResponse.data.user));
                    message.success('登录成功');
                    navigate('/dashboard');
                  } else {
                    logToBackend('error', '❌ 登录失败', loginResponse);
                    message.error(loginResponse?.message || '登录失败');
                    setDingTalkLoading(false);
                  }
                } catch (loginError) {
                  logToBackend('error', '❌ 使用授权码登录失败', {
                    message: loginError.message,
                    stack: loginError.stack
                  });
                  message.error(loginError.message || '登录失败');
                  setDingTalkLoading(false);
                }
              },
              onFail: (err) => {
                const errorMsg = err?.errorMessage || err?.message || '获取授权码失败';
                const errorCode = err?.errorCode;
                
                logToBackend('error', '❌ 获取授权码失败', {
                  errorCode,
                  errorMessage: errorMsg,
                  fullError: err
                });
                
                setDingTalkLoading(false);
                
                // 如果是域名未配置错误，自动跳转到扫码登录
                if (errorMsg.includes('域名微应用') || errorCode === '9' || errorMsg.includes('没有http') || errorMsg.includes('对应企业没有')) {
                  logToBackend('warn', '⚠️ 可信域名未配置，自动跳转到扫码登录页面', {
                    errorCode,
                    errorMessage: errorMsg,
                    redirectTo: '/auth/dingtalk/qrlogin'
                  });
                  message.warning('可信域名未配置，将使用扫码登录', 2);
                  // 立即跳转，不等待
                  setTimeout(() => {
                    logToBackend('info', '🔄 正在跳转到扫码登录页面...');
                    navigate('/auth/dingtalk/qrlogin', { replace: true });
                  }, 1000);
                } else {
                  logToBackend('error', '获取授权码失败（非域名配置问题）', {
                    errorCode,
                    errorMessage: errorMsg
                  });
                  message.error(`获取授权码失败: ${errorMsg}`);
                }
              }
            });
          } catch (error) {
            logToBackend('error', '❌ 调用 requestAuthCode 异常', {
              message: error.message,
              stack: error.stack
            });
            message.error('请求授权码异常: ' + error.message);
            setDingTalkLoading(false);
          }
        };
        
        // 防止重复设置 ready 回调
        logToBackend('info', '🔍 检查 ready 回调状态', {
          readyCallbackSetRef: readyCallbackSetRef.current,
          hasDdReady: typeof window.dd?.ready === 'function'
        });
        
        if (readyCallbackSetRef.current) {
          logToBackend('warn', '⚠️ ready 回调已设置，但尝试直接请求授权');
          // 如果已经设置过，直接尝试请求（可能JSAPI已经ready了）
          requestAuth();
          return;
        }
        
        readyCallbackSetRef.current = true;
        logToBackend('info', '🔵 设置 window.dd.ready 回调...');
        
        // 使用钉钉JSAPI获取免登授权码
        // 如果JSAPI已经ready，直接调用；否则等待ready
        if (window.dd && typeof window.dd.ready === 'function') {
          logToBackend('info', '✅ window.dd.ready 方法存在，设置回调');
          window.dd.ready(() => {
            logToBackend('info', '==========================================');
            logToBackend('info', '✅ window.dd.ready 回调执行');
            logToBackend('info', '   准备调用 requestAuth...');
            logToBackend('info', '==========================================');
            requestAuth();
          });
        } else {
          // 如果ready方法不存在，直接尝试请求（可能JSAPI已经准备好了）
          logToBackend('warn', '⚠️ window.dd.ready 不存在，直接尝试请求授权');
          requestAuth();
        }
        
        if (window.dd && typeof window.dd.error === 'function') {
          window.dd.error((err) => {
            logToBackend('error', '❌ 钉钉JSAPI错误', err);
            message.error('钉钉JSAPI错误，请使用扫码登录');
            readyCallbackSetRef.current = false;
            setTimeout(() => {
              navigate('/auth/dingtalk/qrlogin');
            }, 2000);
          });
        }
      } catch (error) {
        logToBackend('error', '❌ 免登流程失败', {
          message: error.message,
          stack: error.stack
        });
        readyCallbackSetRef.current = false;
      }
    };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await authService.login(values.email, values.password);
      if (response.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        message.success('登录成功');
        navigate('/dashboard');
      }
    } catch (error) {
      message.error(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };


  // 检测是否为移动端
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      window.navigator.userAgent
    );
  };

  // 检测PC端是否安装了钉钉客户端（通过尝试调用钉钉协议）
  const checkDingTalkInstalled = () => {
    return new Promise((resolve) => {
      // PC端可以通过尝试调用钉钉协议来检测
      // 如果钉钉已安装，会响应；如果未安装，不会有响应
      const testUrl = 'dingtalk://dingtalkclient/action/check';
      let responded = false;
      let blurHappened = false;
      
      // 监听页面焦点变化（如果钉钉打开，页面会失去焦点）
      const blurHandler = () => {
        if (!blurHappened) {
          blurHappened = true;
          console.log('✅ 检测到页面失去焦点，可能已打开钉钉');
        }
      };
      
      const focusHandler = () => {
        if (blurHappened && !responded) {
          // 如果先失去焦点然后又获得焦点，说明钉钉可能打开了然后又关闭了
          // 或者用户切换了窗口，这种情况下认为钉钉已安装
          responded = true;
          document.removeEventListener('blur', blurHandler);
          document.removeEventListener('focus', focusHandler);
          resolve(true);
        }
      };
      
      document.addEventListener('blur', blurHandler);
      document.addEventListener('focus', focusHandler);
      
      // 创建一个隐藏的iframe来尝试调用协议
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.src = testUrl;
      
      // 如果iframe加载失败，说明协议不可用
      iframe.onerror = () => {
        if (!responded) {
          responded = true;
          document.removeEventListener('blur', blurHandler);
          document.removeEventListener('focus', focusHandler);
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          resolve(false);
        }
      };
      
      document.body.appendChild(iframe);
      
      // 设置超时
      const timeout = setTimeout(() => {
        if (!responded) {
          responded = true;
          document.removeEventListener('blur', blurHandler);
          document.removeEventListener('focus', focusHandler);
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          // 如果失去了焦点，认为钉钉已安装；否则认为未安装
          resolve(blurHappened);
        }
      }, 1500);
      
      // 如果iframe加载成功，等待一下看是否失去焦点
      iframe.onload = () => {
        setTimeout(() => {
          if (!responded) {
            // 加载成功但未失去焦点，可能未安装或用户未响应
            // 这种情况下，我们仍然尝试调用授权，让用户决定
            responded = true;
            clearTimeout(timeout);
            document.removeEventListener('blur', blurHandler);
            document.removeEventListener('focus', focusHandler);
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
            // 即使不确定，也尝试调用授权（用户可以选择是否打开钉钉）
            resolve(true);
          }
        }, 500);
      };
    });
  };

  // 调用钉钉授权（PC端）
  const callDingTalkAuth = async () => {
    try {
      setDingTalkLoading(true);
      
      // 获取钉钉配置
      const config = await dingTalkService.getQRLoginConfig();
      if (!config.success || !config.data?.clientId) {
        message.error('钉钉配置未完成，请使用扫码登录');
        setDingTalkLoading(false);
        navigate('/auth/dingtalk/qrlogin');
        return;
      }

      const clientId = config.data.clientId;
      const redirectUri = `${window.location.origin}/auth/dingtalk/callback`;
      
      console.log('准备打开钉钉客户端授权...', { 
        clientId: clientId.substring(0, 10) + '...', 
        redirectUri,
        corpId: config.data.corpId || '未配置'
      });
      
      // PC端钉钉客户端授权：使用scheme协议打开钉钉客户端
      // 格式：dingtalk://dingtalkclient/page/link?url=xxx
      // 或者：dingtalk://dingtalkclient/action/openapp?appid=xxx&redirect_uri=xxx
      
      // 方法1：使用openapp方式（推荐，会打开应用并显示授权页面）
      const schemeUrl = `dingtalk://dingtalkclient/action/openapp?appid=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      console.log('尝试使用scheme协议打开钉钉:', schemeUrl);
      message.info('正在打开钉钉客户端，请确认授权...');
      
      // 创建一个隐藏的iframe来尝试调用scheme
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.src = schemeUrl;
      document.body.appendChild(iframe);
      
      // 监听页面焦点变化，判断是否打开了钉钉
      let opened = false;
      const blurHandler = () => {
        opened = true;
        console.log('✅ 检测到页面失去焦点，钉钉客户端可能已打开');
      };
      document.addEventListener('blur', blurHandler);
      
      // 等待一下，看是否打开了钉钉
      setTimeout(() => {
        document.removeEventListener('blur', blurHandler);
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        
        if (!opened) {
          // 如果scheme协议没有响应，使用OAuth URL作为备用
          console.log('⚠️ scheme协议未响应，使用OAuth URL在浏览器中打开授权页面');
          message.warning('未检测到钉钉客户端，将在浏览器中打开授权页面');
          
          // 使用OAuth URL在浏览器中打开授权页面
          const oauthUrl = `https://oapi.dingtalk.com/connect/oauth2/sns_authorize?appid=${clientId}&response_type=code&scope=snsapi_login&state=STATE&redirect_uri=${encodeURIComponent(redirectUri)}`;
          console.log('跳转到钉钉授权页面:', oauthUrl);
          window.location.href = oauthUrl;
        } else {
          console.log('✅ 钉钉客户端已打开，等待用户授权...');
          // 钉钉客户端已打开，等待用户授权后会自动跳转回redirectUri
          // 这里不需要做任何操作，用户授权后会跳转到回调地址
        }
      }, 2000);
      
      // 注意：如果钉钉客户端打开成功，页面会失去焦点
      // 用户授权后，钉钉会跳转回redirectUri并带上code参数
      // 如果2秒内没有打开，则使用OAuth URL作为备用
    } catch (error) {
      console.error('调用钉钉授权失败:', error);
      message.error('调用钉钉授权失败，请使用扫码登录');
      setDingTalkLoading(false);
      navigate('/auth/dingtalk/qrlogin');
    }
  };

  // 调用钉钉授权（移动端）
  const callDingTalkAuthMobile = async () => {
    try {
      setDingTalkLoading(true);
      // 获取钉钉配置
      const config = await dingTalkService.getQRLoginConfig();
      if (!config.success || !config.data?.clientId) {
        message.error('钉钉配置未完成，请使用扫码登录');
        navigate('/auth/dingtalk/qrlogin');
        return;
      }

      const clientId = config.data.clientId;
      const redirectUri = `${window.location.origin}/auth/dingtalk/callback`;
      
      // 移动端通过scheme协议调用钉钉
      // dingtalk://dingtalkclient/action/openapp?corpid=xxx&appid=xxx&redirect_uri=xxx
      const schemeUrl = `dingtalk://dingtalkclient/action/openapp?appid=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      console.log('调用钉钉scheme:', schemeUrl);
      
      // 尝试打开钉钉
      window.location.href = schemeUrl;
      
      // 如果3秒后还在当前页面，说明钉钉未安装或打开失败，跳转到扫码登录
      setTimeout(() => {
        message.warning('未检测到钉钉客户端，将使用扫码登录');
        navigate('/auth/dingtalk/qrlogin');
      }, 3000);
    } catch (error) {
      console.error('调用钉钉授权失败:', error);
      message.error('调用钉钉授权失败，请使用扫码登录');
      navigate('/auth/dingtalk/qrlogin');
    } finally {
      setDingTalkLoading(false);
    }
  };

  const handleDingTalkLogin = async (e) => {
    // 阻止默认行为和事件冒泡
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent?.stopImmediatePropagation?.();
    }
    
    console.log('========== 点击钉钉登录按钮 ==========');
    
    // 1. 首先检查是否在钉钉客户端内
    if (isInDingTalkClient()) {
      console.log('✅ 检测到在钉钉客户端内，使用免登方式');
      // 在钉钉客户端内，尝试验证JSAPI是否可用
      try {
        let verified = false;
        
        window.dd.ready(() => {
          if (!verified) {
            verified = true;
            console.log('✅ 确认在钉钉客户端内，使用免登方式');
            // 不再跳转，直接在 /login 页面处理免登
            // navigate('/auth/dingtalk/login', { replace: false });
          }
        });
        
        window.dd.error((err) => {
          if (!verified) {
            verified = true;
            console.log('❌ 钉钉JSAPI不可用，使用扫码登录');
            navigate('/auth/dingtalk/qrlogin', { replace: false });
          }
        });
        
        // 设置超时，如果1秒内没有响应，跳转到扫码登录
        setTimeout(() => {
          if (!verified) {
            verified = true;
            console.log('⏱️ 钉钉JSAPI响应超时，使用扫码登录');
            navigate('/auth/dingtalk/qrlogin', { replace: false });
          }
        }, 1000);
      } catch (error) {
        console.log('❌ 调用钉钉JSAPI失败，使用扫码登录');
        navigate('/auth/dingtalk/qrlogin', { replace: false });
      }
      return;
    }
    
    // 2. 不在钉钉客户端内，检测设备类型
    const mobile = isMobile();
    console.log('设备类型:', mobile ? '移动端' : 'PC端');
    
    if (mobile) {
      // 移动端：尝试通过scheme协议调用钉钉
      console.log('📱 移动端，尝试通过scheme协议调用钉钉');
      await callDingTalkAuthMobile();
    } else {
      // PC端：检测是否安装了钉钉客户端
      console.log('💻 PC端，检测是否安装了钉钉客户端');
      try {
        const installed = await checkDingTalkInstalled();
        if (installed) {
          console.log('✅ 检测到钉钉客户端已安装，调用授权');
          await callDingTalkAuth();
        } else {
          console.log('⚠️ 未检测到钉钉客户端，使用扫码登录');
          navigate('/auth/dingtalk/qrlogin', { replace: false });
        }
      } catch (error) {
        console.error('检测钉钉客户端失败:', error);
        // 检测失败，直接跳转到扫码登录
        navigate('/auth/dingtalk/qrlogin', { replace: false });
      }
    }
  };

  const handleWebLogin = async () => {
    setDingTalkLoading(true);
    try {
      console.log('========== 开始OAuth登录流程 ==========');
      const redirectUri = `${window.location.origin}/auth/dingtalk/callback`;
      console.log('1. 回调地址:', redirectUri);
      
      console.log('2. 调用API获取登录URL...');
      const response = await dingTalkService.getLoginUrl(redirectUri);
      console.log('3. API响应:', response);
      
      if (!response) {
        console.error('❌ API响应为空');
        message.error('获取登录URL失败，请检查网络连接');
        return;
      }
      
      if (response.success && response.data?.loginUrl) {
        const loginUrl = response.data.loginUrl;
        console.log('4. ✅ 获取登录URL成功');
        console.log('   登录URL:', loginUrl);
        console.log('5. 准备跳转到钉钉登录页面...');
        
        // 延迟一下，确保日志输出
        setTimeout(() => {
          console.log('6. 执行跳转...');
          window.location.href = loginUrl;
        }, 100);
      } else {
        const errorMsg = response?.message || '钉钉登录未配置，请联系管理员';
        console.error('❌ 获取登录URL失败:', errorMsg);
        console.error('   响应详情:', response);
        message.error(errorMsg);
      }
    } catch (error) {
      console.error('❌ 钉钉登录发生异常:', error);
      console.error('   错误类型:', error.constructor.name);
      console.error('   错误消息:', error.message);
      console.error('   错误堆栈:', error.stack);
      
      if (error.response) {
        console.error('   HTTP响应:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        });
      }
      
      if (error.request) {
        console.error('   请求详情:', error.request);
        message.error('网络请求失败，请检查网络连接或服务器状态');
      } else {
        const errorMsg = error.response?.data?.message || error.message || '钉钉登录失败';
        
        // 如果是appid错误，提示使用免登方式
        if (errorMsg.includes('appid') || errorMsg.includes('无效')) {
          message.error('当前配置为企业内部应用，请在钉钉客户端内打开使用免登登录，或配置扫码登录应用');
        } else {
          message.error(errorMsg);
        }
      }
    } finally {
      setDingTalkLoading(false);
    }
  };

  // 处理钉钉免登（在钉钉客户端内）- 像宜搭一样直接授权
  const handleDingTalkSSO = () => {
    if (isInDingTalkClient()) {
      console.log('✅ 在钉钉客户端内，直接触发免登授权...');
      // 不再跳转，直接在 /login 页面处理免登
      // navigate('/auth/dingtalk/login', { replace: true });
      message.info('正在使用免登方式登录...');
    } else {
      message.warning('请在钉钉客户端内打开此页面');
    }
  };

  // 处理钉钉扫码登录
  const handleDingTalkQR = () => {
    navigate('/auth/dingtalk/qrlogin');
  };

  // 处理钉钉授权登录（打开钉钉客户端）
  const handleDingTalkAuth = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    await handleDingTalkLogin(e);
  };

  return (
    <div className="dingtalk-qr-login-container auth-login-page">
      <div className="animated-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
        <div className="particles">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${10 + Math.random() * 10}s`,
              }}
            ></div>
          ))}
        </div>
        <div className="grid-overlay"></div>
      </div>

      <Card className="dingtalk-login-card auth-login-card">
        <div className="card-header">
          <div className="logo-container">
            <UserOutlined className="logo-icon" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div className="login-title">墨枫CRM系统</div>
            <div className="login-subtitle">安全便捷的企业级登录方式</div>
          </div>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'account',
              label: '账号登录',
              children: (
                <Form name="login" onFinish={onFinish} autoComplete="off" size="large">
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: '请输入邮箱' },
                      { type: 'email', message: '请输入有效的邮箱地址' },
                    ]}
                  >
                    <Input
                      prefix={<UserOutlined />}
                      placeholder="邮箱"
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="密码"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading}>
                      登录
                    </Button>
                  </Form.Item>

                  <div style={{ textAlign: 'center' }}>
                    <Button type="link" onClick={() => navigate('/register')}>
                      还没有账号？立即注册
                    </Button>
                  </div>
                </Form>
              ),
            },
            {
              key: 'dingtalk',
              label: '钉钉登录',
              children: (
                <div>
                  {/* 如果在钉钉客户端内，显示提示信息 */}
                  {isInDingTalkClient() && (
                    <div style={{ 
                      marginBottom: 16, 
                      padding: 12, 
                      background: '#e6f7ff', 
                      borderRadius: 4,
                      border: '1px solid #91d5ff'
                    }}>
                      <div style={{ color: '#1890ff', fontWeight: 'bold', marginBottom: 4 }}>
                        ✓ 检测到您在钉钉客户端内
                      </div>
                      <div style={{ color: '#666', fontSize: 12 }}>
                        点击下方按钮即可直接授权登录，无需扫码
                      </div>
                    </div>
                  )}

                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {/* 钉钉免登（在钉钉客户端内）- 像宜搭一样直接授权 */}
                    <Button
                      type="primary"
                      block
                      size="large"
                      icon={<MobileOutlined />}
                      onClick={handleDingTalkSSO}
                      loading={dingTalkLoading}
                    >
                      {isInDingTalkClient() 
                        ? '点击头像授权登录' 
                        : '钉钉免登（请在钉钉客户端内使用）'}
                    </Button>

                    {/* 钉钉扫码登录 */}
                    <Button
                      type="default"
                      block
                      size="large"
                      icon={<QrcodeOutlined />}
                      onClick={handleDingTalkQR}
                    >
                      扫码登录
                    </Button>

                    {/* 钉钉授权登录（打开钉钉客户端）- 仅在非钉钉客户端内显示 */}
                    {!isInDingTalkClient() && (
                      <Button
                        type="default"
                        block
                        size="large"
                        icon={<DesktopOutlined />}
                        loading={dingTalkLoading}
                        onClick={handleDingTalkAuth}
                      >
                        打开钉钉客户端授权登录
                      </Button>
                    )}
                  </Space>

                  <Divider style={{ margin: '16px 0' }}>或</Divider>

                  <div style={{ textAlign: 'center' }}>
                    <Button type="link" onClick={() => setActiveTab('account')}>
                      使用账号密码登录
                    </Button>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default Login;

