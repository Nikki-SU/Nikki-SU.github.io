/**
 * ai-parser.js - 多API文献解析模块
 * 支持硅基流动、豆包、千问、DeepSeek、Gemini等多个API
 */

const AI_PARSER_CONFIG = {
    // API提供商配置
    PROVIDERS: {
        siliconflow: {
            name: '硅基流动',
            url: 'https://api.siliconflow.cn/v1/chat/completions',
            models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'THUDM/glm-4-9b-chat'],
            defaultModel: 'deepseek-ai/DeepSeek-V3',
            authPrefix: 'Bearer'
        },
        deepseek: {
            name: 'DeepSeek',
            url: 'https://api.deepseek.com/v1/chat/completions',
            models: ['deepseek-chat', 'deepseek-coder'],
            defaultModel: 'deepseek-chat',
            authPrefix: 'Bearer'
        },
        qwen: {
            name: '通义千问',
            url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
            models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-longcontext'],
            defaultModel: 'qwen-plus',
            authPrefix: 'Bearer'
        },
        doubao: {
            name: '豆包',
            url: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
            models: ['自定义模型ID'],
            defaultModel: '',
            authPrefix: 'Bearer',
            needsModelInput: true
        },
        gemini: {
            name: 'Gemini',
            url: 'https://generativelanguage.googleapis.com/v1beta/models',
            models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'],
            defaultModel: 'gemini-1.5-flash',
            authPrefix: 'key',  // Gemini用key参数
            isGemini: true
        }
    },
    STORAGE_KEYS: {
        PROVIDER: 'ai_provider',
        API_KEY: 'ai_api_key',
        MODEL: 'ai_model',
        CUSTOM_MODEL: 'ai_custom_model'
    },
    DEFAULT_PROVIDER: 'siliconflow'
};

/**
 * 检查API Key是否已配置
 */
function isApiKeyConfigured() {
    return !!localStorage.getItem(AI_PARSER_CONFIG.STORAGE_KEYS.API_KEY);
}

/**
 * 获取当前选择的提供商
 */
function getProvider() {
    return localStorage.getItem(AI_PARSER_CONFIG.STORAGE_KEYS.PROVIDER) || AI_PARSER_CONFIG.DEFAULT_PROVIDER;
}

/**
 * 获取提供商配置
 */
function getProviderConfig() {
    const providerId = getProvider();
    return AI_PARSER_CONFIG.PROVIDERS[providerId] || AI_PARSER_CONFIG.PROVIDERS.siliconflow;
}

/**
 * 获取当前API Key
 */
function getApiKey() {
    return localStorage.getItem(AI_PARSER_CONFIG.STORAGE_KEYS.API_KEY);
}

/**
 * 获取当前选择的模型
 */
function getSelectedModel() {
    const providerConfig = getProviderConfig();
    if (providerConfig.needsModelInput) {
        return localStorage.getItem(AI_PARSER_CONFIG.STORAGE_KEYS.CUSTOM_MODEL) || providerConfig.defaultModel;
    }
    return localStorage.getItem(AI_PARSER_CONFIG.STORAGE_KEYS.MODEL) || providerConfig.defaultModel;
}

/**
 * 设置API配置
 */
function setApiConfig(provider, apiKey, model, customModel = '') {
    localStorage.setItem(AI_PARSER_CONFIG.STORAGE_KEYS.PROVIDER, provider);
    localStorage.setItem(AI_PARSER_CONFIG.STORAGE_KEYS.API_KEY, apiKey.trim());
    localStorage.setItem(AI_PARSER_CONFIG.STORAGE_KEYS.MODEL, model);
    if (customModel) {
        localStorage.setItem(AI_PARSER_CONFIG.STORAGE_KEYS.CUSTOM_MODEL, customModel);
    }
}

/**
 * 调用AI API解析文献
 * @param {string} doi - 文献DOI
 * @param {string} title - 文献标题
 * @param {string} abstractText - 文献摘要
 * @param {Function} onProgress - 进度回调
 * @returns {Promise<Object>} 解析结果
 */
async function parsePaperWithAI(doi, title, abstractText, onProgress = null) {
    const apiKey = getApiKey();
    const providerConfig = getProviderConfig();
    const model = getSelectedModel();
    
    if (!apiKey) {
        throw new Error('请先在设置页面配置API Key');
    }

    if (onProgress) onProgress('正在连接AI服务...');

    // 构建提示词
    const prompt = buildParsePrompt(doi, title, abstractText);

    if (onProgress) onProgress('正在分析文献，请稍候...');

    try {
        let response;
        
        if (providerConfig.isGemini) {
            // Gemini API 特殊处理
            response = await callGeminiAPI(apiKey, model, prompt);
        } else {
            // OpenAI 兼容 API
            response = await callOpenAICompatibleAPI(providerConfig, apiKey, model, prompt);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 401) {
                throw new Error('API Key无效或已过期，请检查设置');
            } else if (response.status === 429) {
                throw new Error('API调用次数超限，请稍后再试');
            } else {
                throw new Error(`API调用失败: ${response.status} ${errorData.error?.message || ''}`);
            }
        }

        const data = await response.json();
        let content;
        
        if (providerConfig.isGemini) {
            // Gemini 返回格式不同
            content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        } else {
            content = data.choices?.[0]?.message?.content;
        }
        
        if (!content) {
            throw new Error('API返回数据格式异常');
        }

        if (onProgress) onProgress('解析完成，正在处理...');

        return parseAIResponse(content);

    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('网络连接失败，请检查网络后重试');
        }
        throw error;
    }
}

/**
 * 调用OpenAI兼容API
 */
async function callOpenAICompatibleAPI(providerConfig, apiKey, model, prompt) {
    return await fetch(providerConfig.url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `${providerConfig.authPrefix} ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { 
                    role: 'system', 
                    content: '你是一位专业的学术论文分析助手，擅长提取学术文献的关键信息并生成结构化的双语分析。请严格按照指定的JSON格式返回结果。'
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 4000
        })
    });
}

/**
 * 调用Gemini API
 */
async function callGeminiAPI(apiKey, model, prompt) {
    const url = `${AI_PARSER_CONFIG.PROVIDERS.gemini.url}/${model}:generateContent?key=${apiKey}`;
    
    return await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `你是一位专业的学术论文分析助手，擅长提取学术文献的关键信息并生成结构化的双语分析。请严格按照指定的JSON格式返回结果。\n\n${prompt}`
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4000
            }
        })
    });
}

/**
 * 构建解析提示词
 */
function buildParsePrompt(doi, title, abstractText) {
    const vocabCount = getVocabCount();
    const minCount = Math.max(5, vocabCount - 5);
    const maxCount = vocabCount + 5;
    
    return `请分析以下学术文献，生成完整的文献卡片信息。

文献DOI: ${doi || '未知'}
标题: ${title || '未知'}
摘要: ${abstractText || '暂无完整摘要'}

请根据提供的DOI和摘要信息，推断并分析这篇文献，返回以下JSON格式的数据（所有字段必须完整）：

{
  "title": "英文标题（如果原文献是英文，保持原样；如果是中文文献，请翻译成英文）",
  "title_cn": "中文标题（如果原文献是中文，保持原样；如果是英文文献，请翻译成中文）",
  "abstract": "英文摘要（尽量完整，如果摘要不完整请根据标题和DOI推断主要内容）",
  "abstract_cn": "中文摘要翻译",
  "summary": "英文工作总结（本文做了什么、得到了什么结论，100-200字）",
  "summary_cn": "中文工作总结",
  "innovation": "英文创新点（本文的主要贡献和创新之处，列出2-4点）",
  "innovation_cn": "中文创新点",
  "application": "英文应用领域（本文工作的潜在应用方向）",
  "application_cn": "中文应用领域",
  "structure": "英文论证思路（各部分的论证逻辑总结，如：首先介绍了...背景，然后通过...方法验证了...，接着分析了...，最后得出...结论）",
  "structure_cn": "中文论证思路",
  "methods": "英文表征技术（如：XRD, SEM, UV-vis, PL, EIS等具体用到的实验方法）",
  "methods_cn": "中文表征技术",
  "keywords": ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"],
  "category": "分类（从以下选项中选择最合适的：synthesis/characterization/mechanism/application/industrial/custom）",
  "vocabulary": [
    {
      "word": "专业术语英文",
      "word_cn": "专业术语中文翻译",
      "definition": "术语的专业定义（英文，50字以内，要求准确专业）",
      "definition_cn": "术语的专业定义（中文，50字以内，要求准确专业）",
      "example": "该术语在文献中的典型用法例句"
    }
  ],
  "vocabulary_count": 提取的词汇总数
}

重要要求：
1. structure字段必须描述论证思路，而不是简单列出章节标题。需要说明：研究了什么问题→用了什么方法→得到什么结果→得出什么结论的逻辑流程
2. 如果摘要不完整或缺失，必须根据DOI和标题进行合理推断，生成完整的工作总结
3. vocabulary提取规范：
   - 提取${minCount}-${maxCount}个该文献中出现的专业术语和学术表达
   - 只提取专业术语，不要提取普通日常词汇（如study, result, method等通用词）
   - 优先提取：材料名称、实验技术、表征方法、专业概念、反应机理、特殊结构等专业内容
   - 每个词汇必须有准确的中英文翻译和专业的定义解释
   - definition必须解释该术语的含义，而不是翻译
   - example最好来自文献中的实际用法
4. category必须从以下选项中选择：synthesis（合成）、characterization（表征）、mechanism（机理）、application（应用）、industrial（工业化）、custom（自定义）
5. 所有字段必须完整，不能有null或空值
6. 返回的必须是有效的JSON格式，不要包含任何其他文字`;
}

/**
 * 解析AI返回的内容，提取JSON
 */
function parseAIResponse(content) {
    // 尝试提取JSON块
    let jsonStr = content;
    
    // 检查是否有markdown代码块
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        jsonStr = jsonMatch[1];
    }
    
    // 移除可能的前后空白
    jsonStr = jsonStr.trim();
    
    // 尝试直接解析
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        // 尝试移除前后的不相关字符
        const startIdx = jsonStr.indexOf('{');
        const endIdx = jsonStr.lastIndexOf('}');
        
        if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
            jsonStr = jsonStr.substring(startIdx, endIdx + 1);
            try {
                return JSON.parse(jsonStr);
            } catch (e2) {
                console.error('JSON解析失败:', e2);
                throw new Error('AI返回的数据格式异常，无法解析');
            }
        }
        
        throw new Error('AI返回的数据格式异常');
    }
}

/**
 * 测试API连接
 * @returns {Promise<Object>} 测试结果
 */
async function testApiConnection() {
    const apiKey = getApiKey();
    const providerConfig = getProviderConfig();
    const model = getSelectedModel();
    
    if (!apiKey) {
        throw new Error('请先输入API Key');
    }

    try {
        let response;
        
        if (providerConfig.isGemini) {
            // Gemini 测试
            const url = `${AI_PARSER_CONFIG.PROVIDERS.gemini.url}/${model}:generateContent?key=${apiKey}`;
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: '请回复"连接成功"确认API正常工作。' }] }]
                })
            });
        } else {
            // OpenAI 兼容 API 测试
            response = await fetch(providerConfig.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `${providerConfig.authPrefix} ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: '请回复"连接成功"确认API正常工作。' }],
                    max_tokens: 50
                })
            });
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 401) {
                throw new Error('API Key无效或已过期');
            }
            throw new Error(`API返回错误: ${response.status} ${errorData.error?.message || ''}`);
        }

        return { success: true, message: `${providerConfig.name} 连接成功！` };

    } catch (error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('网络连接失败');
        }
        throw error;
    }
}

/**
 * 合并AI解析结果与基础信息
 */
function mergeWithBaseInfo(baseInfo, aiResult) {
    return {
        ...baseInfo,
        title: aiResult.title || baseInfo.title || '',
        title_cn: aiResult.title_cn || '',
        abstract: aiResult.abstract || baseInfo.abstract || '',
        abstract_cn: aiResult.abstract_cn || '',
        summary: aiResult.summary || '',
        summary_cn: aiResult.summary_cn || '',
        innovation: aiResult.innovation || '',
        innovation_cn: aiResult.innovation_cn || '',
        application: aiResult.application || '',
        application_cn: aiResult.application_cn || '',
        structure: aiResult.structure || '',
        structure_cn: aiResult.structure_cn || '',
        methods: aiResult.methods || '',
        methods_cn: aiResult.methods_cn || '',
        keywords: aiResult.keywords || baseInfo.keywords || [],
        category: aiResult.category || baseInfo.category || 'custom',
        vocabulary: aiResult.vocabulary || []
    };
}

// 导出配置和函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        AI_PARSER_CONFIG,
        isApiKeyConfigured,
        getApiKey,
        getSelectedModel,
        setApiKey,
        setModel,
        getModelId,
        parsePaperWithAI,
        testApiConnection,
        mergeWithBaseInfo
    };
}
