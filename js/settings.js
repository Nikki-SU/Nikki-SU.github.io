/**
 * settings.js - 多API设置页面脚本
 */

// API提供商帮助信息
const PROVIDER_HINTS = {
    siliconflow: {
        title: '硅基流动',
        hint: `1. 访问 <a href="https://cloud.siliconflow.cn" target="_blank">硅基流动官网</a> 注册账号<br>
               2. 进入控制台 → API密钥 → 创建新密钥<br>
               3. 新用户有免费额度可用`
    },
    deepseek: {
        title: 'DeepSeek',
        hint: `1. 访问 <a href="https://platform.deepseek.com" target="_blank">DeepSeek开放平台</a> 注册账号<br>
               2. 进入API Keys页面创建密钥<br>
               3. 新用户有免费额度`
    },
    qwen: {
        title: '通义千问',
        hint: `1. 访问 <a href="https://dashscope.console.aliyun.com" target="_blank">阿里云DashScope</a> 开通服务<br>
               2. 创建API-KEY管理 → 创建新的API-KEY<br>
               3. 部分模型有免费额度`
    },
    doubao: {
        title: '豆包',
        hint: `1. 访问 <a href="https://console.volcengine.com/ark" target="_blank">火山引擎控制台</a> 开通方舟服务<br>
               2. 创建推理接入点，获取接入点ID<br>
               3. 获取API Key并填入，模型ID填入下方自定义模型ID`
    },
    gemini: {
        title: 'Google Gemini',
        hint: `1. 访问 <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio</a> 获取API Key<br>
               2. 创建API密钥并复制<br>
               3. 需要科学上网`
    }
};

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initProviderSelector();
    loadSettings();
    bindEvents();
    updateStatus();
});

// 初始化提供商选择器
function initProviderSelector() {
    const providerSelector = document.getElementById('providerSelector');
    
    // 绑定提供商切换事件
    providerSelector.querySelectorAll('input[name="provider"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            onProviderChange(e.target.value);
        });
    });
}

// 提供商切换
function onProviderChange(providerId) {
    const config = AI_PARSER_CONFIG.PROVIDERS[providerId];
    const hint = PROVIDER_HINTS[providerId];
    
    // 更新提示信息
    document.getElementById('providerHint').innerHTML = hint.hint;
    document.querySelector('#providerInfo h3').textContent = `💡 ${hint.title}`;
    
    // 更新模型选择
    const modelSelect = document.getElementById('modelSelect');
    modelSelect.innerHTML = config.models.map(model => 
        `<option value="${model}">${model}</option>`
    ).join('');
    
    // 显示/隐藏自定义模型输入框
    const customModelGroup = document.getElementById('customModelGroup');
    if (config.needsModelInput) {
        customModelGroup.style.display = 'block';
    } else {
        customModelGroup.style.display = 'none';
    }
    
    // 选择默认模型
    modelSelect.value = config.defaultModel || config.models[0];
}

// 加载已保存的设置
function loadSettings() {
    const provider = localStorage.getItem(AI_PARSER_CONFIG.STORAGE_KEYS.PROVIDER) || AI_PARSER_CONFIG.DEFAULT_PROVIDER;
    const apiKey = localStorage.getItem(AI_PARSER_CONFIG.STORAGE_KEYS.API_KEY) || '';
    const model = localStorage.getItem(AI_PARSER_CONFIG.STORAGE_KEYS.MODEL) || '';
    const customModel = localStorage.getItem(AI_PARSER_CONFIG.STORAGE_KEYS.CUSTOM_MODEL) || '';
    
    // 设置提供商
    const providerRadio = document.querySelector(`input[name="provider"][value="${provider}"]`);
    if (providerRadio) {
        providerRadio.checked = true;
        onProviderChange(provider);
    }
    
    // 设置API Key
    document.getElementById('apiKeyInput').value = apiKey;
    
    // 设置模型
    const modelSelect = document.getElementById('modelSelect');
    if (model && modelSelect.querySelector(`option[value="${model}"]`)) {
        modelSelect.value = model;
    }
    
    // 设置自定义模型
    document.getElementById('customModelInput').value = customModel;
}

// 绑定事件
function bindEvents() {
    // 显示/隐藏密钥
    document.getElementById('toggleKeyVisibility')?.addEventListener('click', () => {
        const input = document.getElementById('apiKeyInput');
        const btn = document.getElementById('toggleKeyVisibility');
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '🙈';
        } else {
            input.type = 'password';
            btn.textContent = '👁️';
        }
    });
    
    // 保存设置
    document.getElementById('saveBtn')?.addEventListener('click', saveSettings);
    
    // 测试连接
    document.getElementById('testBtn')?.addEventListener('click', testConnection);
    
    // 清除设置
    document.getElementById('clearBtn')?.addEventListener('click', clearSettings);
    
    // 移动端菜单
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('active'));
    }
}

// 保存设置
function saveSettings() {
    const provider = document.querySelector('input[name="provider"]:checked')?.value;
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const model = document.getElementById('modelSelect').value;
    const customModel = document.getElementById('customModelInput').value.trim();
    
    if (!provider) {
        showResult('请选择API服务商', 'error');
        return;
    }
    
    if (!apiKey) {
        showResult('请输入API Key', 'error');
        return;
    }
    
    setApiConfig(provider, apiKey, model, customModel);
    updateStatus();
    showResult('设置已保存！', 'success');
}

// 测试连接
async function testConnection() {
    // 先保存设置
    saveSettings();
    
    const testBtn = document.getElementById('testBtn');
    testBtn.disabled = true;
    testBtn.textContent = '测试中...';
    
    showResult('正在连接API...', 'loading');
    
    try {
        const result = await testApiConnection();
        showResult(result.message, 'success');
    } catch (error) {
        showResult(`连接失败: ${error.message}`, 'error');
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = '🔗 测试连接';
    }
}

// 清除设置
function clearSettings() {
    if (!confirm('确定要清除所有API设置吗？')) return;
    
    localStorage.removeItem(AI_PARSER_CONFIG.STORAGE_KEYS.PROVIDER);
    localStorage.removeItem(AI_PARSER_CONFIG.STORAGE_KEYS.API_KEY);
    localStorage.removeItem(AI_PARSER_CONFIG.STORAGE_KEYS.MODEL);
    localStorage.removeItem(AI_PARSER_CONFIG.STORAGE_KEYS.CUSTOM_MODEL);
    
    document.getElementById('apiKeyInput').value = '';
    document.getElementById('customModelInput').value = '';
    
    // 重置为默认提供商
    const defaultRadio = document.querySelector(`input[name="provider"][value="${AI_PARSER_CONFIG.DEFAULT_PROVIDER}"]`);
    if (defaultRadio) {
        defaultRadio.checked = true;
        onProviderChange(AI_PARSER_CONFIG.DEFAULT_PROVIDER);
    }
    
    updateStatus();
    showResult('设置已清除', 'success');
}

// 更新状态指示器
function updateStatus() {
    const indicator = document.getElementById('statusIndicator');
    const apiKey = localStorage.getItem(AI_PARSER_CONFIG.STORAGE_KEYS.API_KEY);
    const provider = localStorage.getItem(AI_PARSER_CONFIG.STORAGE_KEYS.PROVIDER);
    const providerConfig = AI_PARSER_CONFIG.PROVIDERS[provider] || AI_PARSER_CONFIG.PROVIDERS.siliconflow;
    
    if (apiKey) {
        indicator.className = 'status-indicator configured';
        indicator.textContent = `✅ ${providerConfig.name} 已配置`;
    } else {
        indicator.className = 'status-indicator not-configured';
        indicator.textContent = '❌ 未配置';
    }
}

// 显示结果
function showResult(message, type) {
    const result = document.getElementById('testResult');
    result.textContent = message;
    result.className = `test-result ${type}`;
    
    if (type !== 'loading') {
        setTimeout(() => {
            result.className = 'test-result';
        }, 5000);
    }
}
