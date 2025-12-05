const axios = require('axios');

// 搜索企业名称（优先使用本地数据库，外部API作为补充）
exports.searchCompanies = async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword || keyword.trim().length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const keywordTrimmed = keyword.trim();
    let companies = [];
    
    console.log('搜索企业名称，关键词:', keywordTrimmed);

    // 方案1: 优先从本地数据库中搜索（快速、可靠、总是可用）
    try {
      const { pool } = require('../config/database');
      const connection = await pool.getConnection();
      
      try {
        // 使用LIKE模糊查询，支持部分匹配
        const searchSql = `
          SELECT DISTINCT company 
          FROM customers 
          WHERE company IS NOT NULL 
            AND company != '' 
            AND company LIKE ?
          ORDER BY 
            CASE 
              WHEN company = ? THEN 1
              WHEN company LIKE ? THEN 2
              WHEN company LIKE ? THEN 3
              ELSE 4
            END,
            company
          LIMIT 20
        `;
        
        // 精确匹配优先，然后是开头匹配，最后是包含匹配
        const exactMatch = keywordTrimmed;
        const startMatch = `${keywordTrimmed}%`;
        const containsMatch = `%${keywordTrimmed}%`;
        
        const [rows] = await connection.execute(searchSql, [
          containsMatch,
          exactMatch,
          startMatch,
          containsMatch
        ]);
        
        if (rows && rows.length > 0) {
          companies = rows.map(row => ({
            name: row.company,
            code: '',
            address: '',
            legalPerson: '',
            status: '',
            regCapital: '',
            source: 'local' // 标记来源
          }));
          console.log('从本地数据库找到', companies.length, '条匹配记录');
        }
      } finally {
        connection.release();
      }
    } catch (dbError) {
      console.error('本地数据库查询失败:', dbError.message);
    }

    // 立即返回本地数据库结果（快速响应）
    res.status(200).json({
      success: true,
      data: companies.slice(0, 20),
      fromCache: true // 标记这是缓存结果
    });
    
    // 确保响应已发送
    res.end();

    // 后台异步调用外部API补充结果（不阻塞响应）
    setImmediate(async () => {

    // 方案2: 调用外部API获取更多结果（并行调用多个API，快速失败）
    // 使用Promise.allSettled确保即使部分API失败也不影响主流程
    const apiPromises = [];
    
    // API 1: 百度搜索建议API（已验证可用，返回搜索建议，可能包含企业名称）
    apiPromises.push(
      axios.get('https://www.baidu.com/sugrec', {
        params: { 
          prod: 'pc', 
          wd: keywordTrimmed 
        },
        timeout: 2000,
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      }).then(response => {
        console.log('百度搜索建议API响应:', response.status);
        if (response.data && response.data.g && Array.isArray(response.data.g)) {
          // 智能过滤：识别真正的企业名称
          const allSuggestions = response.data.g.map(item => item.q);
          
          // 严格过滤：只返回真正的企业名称
          // 企业名称特征：通常以"公司"、"有限公司"、"股份公司"、"集团"等结尾
          const companySuffixes = [
            '公司', '有限公司', '股份公司', '集团公司', '企业', '集团', '实业', 
            '贸易', '商贸', '科技公司', '技术公司', '旅行社', '咨询公司', 
            '服务公司', '投资公司', '管理公司', '文化公司', '传媒公司'
          ];
          
          // 非企业关键词（排除这些）
          const nonCompanyKeywords = [
            '天气', '旅游', '攻略', '景点', '歌曲', '播放', '官网', '注册', '需要', '条件', 
            '是干嘛', '是什么', '属于', '英文', '歌词', '汤', '怎么回复', '背景故事', 
            '成语', '诗句', '有哪些', '意思', '旅行社', '合唱', '回复', '故事', 
            '歌词', '诗句', '成语', '意思', '怎么', '如何', '什么', '哪里', '多少',
            '价格', '费用', '多少钱', '怎么样', '好不好', '推荐', '排名', '列表'
          ];
          
          // 高优先级：明确的企业名称（以企业后缀结尾）
          const highPriority = allSuggestions.filter(q => {
            const trimmed = q.trim();
            // 必须以企业后缀结尾，且不包含非企业关键词
            return companySuffixes.some(suffix => {
              return trimmed.endsWith(suffix) && 
                     !nonCompanyKeywords.some(nk => trimmed.includes(nk));
            });
          });
          
          // 中优先级：包含企业后缀但不一定在结尾（如"XX科技有限公司"）
          const mediumPriority = allSuggestions.filter(q => {
            const trimmed = q.trim();
            // 包含企业后缀，长度合理，不包含非企业关键词
            return companySuffixes.some(suffix => trimmed.includes(suffix)) &&
                   trimmed.length >= 4 && 
                   trimmed.length <= 50 &&
                   !nonCompanyKeywords.some(nk => trimmed.includes(nk)) &&
                   !highPriority.includes(trimmed);
          });
          
          // 只返回高优先级和中优先级的结果，如果没有就不返回（不返回非企业名称）
          const suggestions = [...highPriority, ...mediumPriority].slice(0, 15);
          
          console.log(`百度API过滤结果: 高优先级${highPriority.length}条, 中优先级${mediumPriority.length}条, 最终${suggestions.length}条`);
          
          const result = suggestions.map(name => ({
            name: String(name || '').trim(),
            code: '',
            address: '',
            legalPerson: '',
            status: '',
            regCapital: '',
            source: 'external_baidu'
          })).filter(item => item.name.length > 0);
          
          console.log(`百度API处理后返回${result.length}条有效数据`);
          return result;
        }
        return [];
      }).catch(err => {
        console.log('百度搜索建议API失败:', err.message);
        return [];
      })
    );

    // API 2: OpenData.vip（接口可用，但可能返回空数据）
    apiPromises.push(
      axios.get('https://opendata.vip/data/company', {
        params: { keyword: keywordTrimmed },
        timeout: 3000,
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      }).then(response => {
        console.log('opendata.vip API响应:', response.status);
        if (response.data) {
          // 处理不同的返回格式
          let data = [];
          if (response.data.output && Array.isArray(response.data.output)) {
            data = response.data.output;
          } else if (Array.isArray(response.data)) {
            data = response.data;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            data = response.data.data;
          }
          
          return data.map(item => ({
            name: item.name || item.companyName || item.enterpriseName || item.entName,
            code: item.code || item.creditCode || item.unifiedCode || item.regNo,
            address: item.address || item.regAddress || item.regAddr,
            legalPerson: item.legalPerson || item.legalRepresentative || item.operName,
            status: item.status || item.enterpriseStatus || item.entStatus,
            regCapital: item.regCapital || item.registeredCapital,
            source: 'external_opendata'
          })).filter(item => item.name);
        }
        return [];
      }).catch(err => {
        console.log('opendata.vip API失败:', err.message);
        return [];
      })
    );

      // 等待所有API调用完成（快速失败，不阻塞）
      const results = await Promise.allSettled(apiPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          result.value.forEach(company => {
            if (company.name && !companies.find(c => c.name === company.name)) {
              companies.push(company);
            }
          });
          if (result.value.length > 0) {
            console.log(`外部API${index + 1}找到`, result.value.length, '条记录');
          }
        }
      });
      
      // 方案3: 如果还是没有结果，尝试从本地数据库返回相似的公司名称（字符级别模糊匹配）
      if (companies.length === 0) {
        try {
          const { pool } = require('../config/database');
          const connection = await pool.getConnection();
          
          try {
            // 使用更宽松的搜索：只要包含关键词中的任何字符
            const keywordChars = keywordTrimmed.split('').filter(c => c.trim());
            if (keywordChars.length > 0 && keywordChars.length <= 10) {
              // 构建LIKE查询：包含任意字符
              const likePatterns = keywordChars.map(char => `company LIKE '%${char}%'`).join(' OR ');
              const searchSql = `
                SELECT DISTINCT company 
                FROM customers 
                WHERE company IS NOT NULL 
                  AND company != '' 
                  AND (${likePatterns})
                ORDER BY company
                LIMIT 10
              `;
              
              const [rows] = await connection.execute(searchSql);
              
              if (rows && rows.length > 0) {
                const fuzzyCompanies = rows.map(row => ({
                  name: row.company,
                  code: '',
                  address: '',
                  legalPerson: '',
                  status: '',
                  regCapital: '',
                  source: 'local_fuzzy'
                }));
                companies.push(...fuzzyCompanies);
                console.log('从本地数据库模糊搜索找到', fuzzyCompanies.length, '条记录');
              }
            }
          } finally {
            connection.release();
          }
        } catch (dbError) {
          console.error('本地数据库模糊查询失败:', dbError.message);
        }
      }

      console.log('后台API补充完成，共找到', companies.length, '条企业记录');
      // 注意：这里不再发送响应，因为已经发送过了
    })().catch(err => {
      console.error('后台API调用失败:', err.message);
    });
  } catch (error) {
    console.error('搜索企业名称错误:', error);
    res.status(500).json({
      success: false,
      message: error.message || '搜索失败'
    });
  }
};
