/**
 * settings.js - 设置页面脚本
 */

// API提供商帮助信息
const PROVIDER_HINTS = {
    siliconflow: {
        title: '硅基流动',
        hint: `1. 访问 <a href="https://cloud.siliconflow.cn" target="_blank">硅基流动官网</a> 注册账号<br>
               2. 进入控制台 → API密钥 → 创建新密钥<br>
               3. 新用户有免费额度可用`,
        models: [
            { value: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5-7B-Instruct' },
            { value: 'Qwen/Qwen2.5-14B-Instruct', label: 'Qwen2.5-14B-Instruct' },
            { value: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen2.5-72B-Instruct' }
        ]
    },
    deepseek: {
        title: 'DeepSeek',
        hint: `1. 访问 <a href="https://platform.deepseek.com" target="_blank">DeepSeek开放平台</a> 注册账号<br>
               2. 进入API Keys页面创建密钥<br>
               3. 新用户有免费额度`,
        models: [
            { value: 'deepseek-chat', label: 'DeepSeek Chat' },
            { value: 'deepseek-coder', label: 'DeepSeek Coder' }
        ]
    },
    qwen: {
        title: '通义千问',
        hint: `1. 访问 <a href="https://dashscope.console.aliyun.com" target="_blank">阿里云DashScope</a> 开通服务<br>
               2. 创建API-KEY管理 → 创建新的API-KEY<br>
               3. 部分模型有免费额度`,
        models: [
            { value: 'qwen-plus', label: 'Qwen Plus' },
            { value: 'qwen-max', label: 'Qwen Max' },
            { value: 'qwen-turbo', label: 'Qwen Turbo' }
        ]
    },
    gemini: {
        title: 'Google Gemini',
        hint: `1. 访问 <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio</a> 获取API Key<br>
               2. 创建API密钥并复制<br>
               3. 需要科学上网`,
        models: [
            { value: 'gemini-pro', label: 'Gemini Pro' },
            { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
        ]
    }
};

// 当前选中的提供商
let currentProvider = 'siliconflow';

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadDataInfo();
    initEventListeners();
    updateStatus();
});

// 初始化事件监听
function initEventListeners() {
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
    
    // 数据管理
    document.getElementById('clearLibraryBtn')?.addEventListener('click', () => clearData('library', '文献库'));
    document.getElementById('clearCardsBtn')?.addEventListener('click', () => clearData('cards', '文献卡片'));
    document.getElementById('clearVocabBtn')?.addEventListener('click', () => clearData('vocab', '词汇本'));
    document.getElementById('clearHistoryBtn')?.addEventListener('click', () => clearData('history', '追踪历史'));
    document.getElementById('clearAllBtn')?.addEventListener('click', clearAllData);
    
    // 导出数据
    document.getElementById('exportLibraryBtn')?.addEventListener('click', () => exportData('library', '文献库'));
    document.getElementById('exportCardsBtn')?.addEventListener('click', () => exportData('cards', '文献卡片'));
    document.getElementById('exportVocabBtn')?.addEventListener('click', () => exportData('vocab', '词汇本'));
}

// 选择提供商
function selectProvider(provider) {
    currentProvider = provider;
    
    // 更新UI
    document.querySelectorAll('.provider-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.provider === provider);
    });
    
    // 更新提示信息
    const info = PROVIDER_HINTS[provider];
    document.querySelector('#providerInfo h4').textContent = `💡 ${info.title}`;
    document.getElementById('providerHint').innerHTML = info.hint;
    
    // 更新模型选择
    const modelSelect = document.getElementById('modelSelect');
    modelSelect.innerHTML = info.models.map(m => 
        `<option value="${m.value}">${m.label}</option>`
    ).join('');
}

// 加载设置
function loadSettings() {
    const settings = GlobalSettings.get();
    
    currentProvider = settings.apiProvider || 'siliconflow';
    selectProvider(currentProvider);
    
    document.getElementById('apiKeyInput').value = settings.apiKey || '';
    document.getElementById('vocabCountInput').value = settings.vocabCount || '20';
    
    // 选中模型
    const modelSelect = document.getElementById('modelSelect');
    if (settings.model && [...modelSelect.options].some(o => o.value === settings.model)) {
        modelSelect.value = settings.model;
    }
}

// 保存设置
function saveSettings() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const model = document.getElementById('modelSelect').value;
    const vocabCount = document.getElementById('vocabCountInput').value;
    
    if (!apiKey) {
        showResult('请输入API Key', 'error');
        return;
    }
    
    const settings = {
        apiProvider: currentProvider,
        apiKey,
        model,
        vocabCount: parseInt(vocabCount)
    };
    
    GlobalSettings.save(settings);
    updateStatus();
    showResult('设置已保存！', 'success');
    showToast('API设置已保存', 'success');
}

// 测试连接
async function testConnection() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    
    if (!apiKey) {
        showResult('请先输入API Key', 'error');
        return;
    }
    
    const testBtn = document.getElementById('testBtn');
    testBtn.disabled = true;
    testBtn.innerHTML = '<span class="spinner"></span> 测试中...';
    
    showResult('正在连接API...', 'loading');
    
    try {
        const result = await testApiConnection(currentProvider, apiKey);
        showResult(result.message, 'success');
        showToast('连接测试成功！', 'success');
    } catch (error) {
        showResult(`连接失败: ${error.message}`, 'error');
        showToast('连接测试失败', 'error');
    } finally {
        testBtn.disabled = false;
        testBtn.innerHTML = '<span>🔗</span> 测试连接';
    }
}

// 测试API连接
async function testApiConnection(provider, apiKey) {
    const prompt = '请回复"连接成功"，只用中文回复这四个字。';
    
    let apiUrl, requestBody;
    
    switch (provider) {
        case 'siliconflow':
            apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
            requestBody = {
                model: 'Qwen/Qwen2.5-7B-Instruct',
                messages: [{ role: 'user', content: prompt }],
                stream: false
            };
            break;
        case 'deepseek':
            apiUrl = 'https://api.deepseek.com/v1/chat/completions';
            requestBody = {
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                stream: false
            };
            break;
        case 'qwen':
            apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
            requestBody = {
                model: 'qwen-plus',
                messages: [{ role: 'user', content: prompt }],
                stream: false
            };
            break;
        case 'gemini':
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
            requestBody = {
                contents: [{ parts: [{ text: prompt }] }]
            };
            break;
    }
    
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': provider !== 'gemini' ? `Bearer ${apiKey}` : undefined
        },
        body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
    }
    
    return { success: true, message: 'API连接成功！' };
}

// 清除设置
function clearSettings() {
    if (!confirm('确定要清除所有API设置吗？')) return;
    
    GlobalSettings.save({
        apiProvider: 'siliconflow',
        apiKey: '',
        model: '',
        vocabCount: 20
    });
    
    loadSettings();
    updateStatus();
    showResult('设置已清除', 'success');
    showToast('API设置已清除', 'success');
}

// 更新状态指示器
function updateStatus() {
    const indicator = document.getElementById('statusIndicator');
    const settings = GlobalSettings.get();
    
    if (settings.apiKey) {
        const providerName = PROVIDER_HINTS[settings.apiProvider]?.title || settings.apiProvider;
        indicator.className = 'status-indicator not-configured';
        indicator.style.background = 'rgba(16, 185, 129, 0.2)';
        indicator.innerHTML = `✅ ${providerName} 已配置`;
    } else {
        indicator.className = 'status-indicator not-configured';
        indicator.style.background = 'rgba(239, 68, 68, 0.2)';
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

// 加载数据信息
function loadDataInfo() {
    const library = LibraryStore.getAll();
    const cards = PapersStore.getAll();
    const vocab = VocabularyStore.getAll();
    const history = Storage.get('trackingHistory', []);
    
    document.getElementById('libraryDataInfo').textContent = `${library.length} 条记录`;
    document.getElementById('cardsDataInfo').textContent = `${cards.length} 条记录`;
    document.getElementById('vocabDataInfo').textContent = `${vocab.length} 条记录`;
    document.getElementById('historyDataInfo').textContent = `${history.length} 条记录`;
}

// 清除数据
function clearData(type, name) {
    if (!confirm(`确定要清空${name}数据吗？`)) return;
    
    switch (type) {
        case 'library':
            LibraryStore.clear();
            break;
        case 'cards':
            Storage.remove(PapersStore.key);
            break;
        case 'vocab':
            Storage.remove(VocabularyStore.key);
            break;
        case 'history':
            Storage.remove('trackingHistory');
            break;
    }
    
    loadDataInfo();
    showToast(`${name}已清空`, 'success');
}

// 清空所有数据
function clearAllData() {
    if (!confirm('⚠️ 确定要清空所有数据吗？\n这将删除：\n- 文献库\n- 文献卡片\n- 词汇本\n- 追踪历史\n- 所有设置\n\n此操作不可恢复！')) return;
    
    if (!confirm('再次确认：此操作不可恢复！')) return;
    
    localStorage.clear();
    
    loadSettings();
    loadDataInfo();
    updateStatus();
    
    showToast('所有数据已清空', 'success');
}

// 导出数据
function exportData(type, name) {
    let data, filename;
    const date = new Date().toISOString().slice(0, 10);
    
    switch (type) {
        case 'library':
            data = LibraryStore.getAll();
            filename = `library_${date}.json`;
            break;
        case 'cards':
            data = PapersStore.getAll();
            filename = `papers_${date}.json`;
            break;
        case 'vocab':
            data = VocabularyStore.getAll();
            // 导出简洁格式的词汇（兼容chem-words）
            data = data.map(w => ({
                en: w.en,
                cn: w.cn,
                defCn: w.defCn,
                defEn: w.defEn,
                ex: w.ex
            }));
            filename = `vocabulary_${date}.json`;
            break;
    }
    
    if (!data || data.length === 0) {
        showToast(`${name}为空，无法导出`, 'error');
        return;
    }
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`${name}已导出: ${filename}`, 'success');
}
