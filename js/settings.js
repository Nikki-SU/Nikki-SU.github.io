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
    
    // 同步到 ai-parser 的存储键，确保 translateField 等函数能正确读取
    if (typeof setApiConfig === 'function') {
        setApiConfig(currentProvider, apiKey, model);
    }
    
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

// ===== GitHub 同步功能 =====

// GitHub 同步配置（从用户设置读取）
function getGitHubConfig() {
    return {
        owner: Storage.get('githubOwner', ''),
        repo: Storage.get('githubRepo', ''),
        branch: 'main',
        path: 'academic-data.json'
    };
}

// 获取 GitHub Token
function getGitHubToken() {
    return Storage.get('githubToken', '');
}

// 保存 GitHub Token
// 保存GitHub配置（Token + 仓库）
function saveGitHubConfig() {
    const token = document.getElementById('githubToken').value.trim();
    const owner = document.getElementById('githubOwner').value.trim();
    const repo = document.getElementById('githubRepo').value.trim();
    
    if (!token) {
        showToast('请输入 Token', 'error');
        return;
    }


// 扫描GitHub仓库
async function scanGitHubRepos() {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) {
        showToast('请先输入Token', 'error');
        return;
    }
    
    const resultsDiv = document.getElementById('repoScanResults');
    const repoListDiv = document.getElementById('repoList');
    const manualInput = document.getElementById('manualRepoInput');
    
    resultsDiv.style.display = 'block';
    repoListDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">🔄 正在扫描仓库...</div>';
    manualInput.style.display = 'none';
    
    try {
        // 获取用户的所有仓库
        let allRepos = [];
        let page = 1;
        while (true) {
            const response = await fetch(
                `https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner,collaborator`,
                { headers: { 'Authorization': `token ${token}` } }
            );
            
            if (!response.ok) {
                throw new Error('Token无效或无权限');
            }
            
            const repos = await response.json();
            if (repos.length === 0) break;
            allRepos = allRepos.concat(repos);
            page++;
        }
        
        if (allRepos.length === 0) {
            repoListDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">未找到可访问的仓库</div>';
            return;
        }
        
        // 检查每个仓库是否有数据文件（并行请求，最多10个）
        const repoStatuses = [];
        const batchSize = 10;
        
        for (let i = 0; i < allRepos.length; i += batchSize) {
            const batch = allRepos.slice(i, i + batchSize);
            const promises = batch.map(async (repo) => {
                try {
                    const checkResponse = await fetch(
                        `https://api.github.com/repos/${repo.full_name}/contents/academic-data.json`,
                        { headers: { 'Authorization': `token ${token}` } }
                    );
                    return {
                        ...repo,
                        hasData: checkResponse.ok
                    };
                } catch (e) {
                    return { ...repo, hasData: false };
                }
            });
            
            const results = await Promise.all(promises);
            repoStatuses.push(...results);
        }
        
        // 排序：有数据的仓库排在前面
        repoStatuses.sort((a, b) => {
            if (a.hasData !== b.hasData) return b.hasData ? 1 : -1;
            return b.updated_at.localeCompare(a.updated_at);
        });
        
        // 生成仓库列表
        repoListDiv.innerHTML = repoStatuses.map(repo => `
            <div class="repo-item" onclick="selectRepo('${repo.owner.login}', '${repo.name}')" 
                 style="padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s;"
                 onmouseover="this.style.background='var(--bg)'" 
                 onmouseout="this.style.background='transparent'">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="font-weight: 500;">${repo.full_name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">
                            ${repo.description || '无描述'}
                        </div>
                    </div>
                    <div>${repo.hasData ? '✅ 有数据' : '📁 空仓库'}</div>
                </div>
            </div>
        `).join('');
        
    } catch (e) {
        repoListDiv.innerHTML = `<div style="padding: 20px; text-align: center; color: #dc3545;">扫描失败: ${e.message}</div>`;
    }
}

// 选择仓库
function selectRepo(owner, repo) {
    document.getElementById('githubOwner').value = owner;
    document.getElementById('githubRepo').value = repo;
    showToast(`已选择: ${owner}/${repo}`, 'success');
}

// 切换到手动输入模式
function selectManualRepo() {
    document.getElementById('repoScanResults').style.display = 'none';
    document.getElementById('manualRepoInput').style.display = 'block';
    document.getElementById('githubOwner').value = '';
    document.getElementById('githubRepo').value = '';
}
    if (!owner || !repo) {
        showToast('请输入用户名和仓库名', 'error');
        return;
    }
    
    // 验证 Token 和仓库访问权限
    fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { 'Authorization': `token ${token}` }
    })
    .then(res => {
        if (res.ok) {
            Storage.set('githubToken', token);
            Storage.set('githubOwner', owner);
            Storage.set('githubRepo', repo);
            showToast('配置保存成功', 'success');
            updateGitHubStatus(true);
        } else if (res.status === 404) {
            showToast('仓库不存在或无访问权限', 'error');
        } else {
            showToast('Token 无效或权限不足', 'error');
        }
    })
    .catch(() => showToast('验证失败，请检查网络', 'error'));
}

function saveGitHubToken() {
    saveGitHubConfig();
}

// 更新 GitHub 状态显示
function updateGitHubStatus(configured) {
    const statusEl = document.getElementById('githubStatus');
    if (configured) {
        statusEl.className = 'status-indicator configured';
        statusEl.style.background = '#d4edda';
        statusEl.style.color = '#155724';
        statusEl.textContent = '✅ 已配置';
    } else {
        statusEl.className = 'status-indicator not-configured';
        statusEl.style.background = '#f8d7da';
        statusEl.style.color = '#721c24';
        statusEl.textContent = '❌ 未配置';
    }
}

// 同步到 GitHub
async function syncToGitHub() {
    const token = getGitHubToken();
    const config = getGitHubConfig();
    
    if (!token) {
        showToast('请先配置 GitHub Token', 'error');
        return;
    }
    if (!config.owner || !config.repo) {
        showToast('请配置私有仓库信息', 'error');
        return;
    }
    
    const statusEl = document.getElementById('syncStatus');
    statusEl.textContent = '正在上传...';
    
    try {
        // 收集所有数据
        const backupData = {
            version: '1.0',
            lastSync: new Date().toISOString(),
            data: {
                libraryPapers: LibraryStore.getAll(),
                papersData: PapersStore.getAll(),
                vocabularyData: VocabularyStore.getAll(),
                abstractTranslationData: AbstractTranslationStore.getAll(),
                categoriesData: CategoriesStore.getAll(),
                tagsData: TagsStore.getAll(),
                trackingConfig: TrackingConfig.get(),
                globalSettings: GlobalSettings.get()
            }
        };
        
        // 获取当前文件的 SHA（如果存在）
        let sha = null;
        const getResponse = await fetch(
            `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`,
            { headers: { 'Authorization': `token ${token}` } }
        );
        
        if (getResponse.ok) {
            const fileData = await getResponse.json();
            sha = fileData.sha;
        }
        
        // 上传文件
        const body = {
            message: `backup: ${new Date().toISOString()}`,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(backupData, null, 2)))),
            branch: config.branch
        };
        
        if (sha) body.sha = sha;
        
        const putResponse = await fetch(
            `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );
        
        if (putResponse.ok) {
            statusEl.textContent = `✅ 上传成功 (${new Date().toLocaleString()})`;
            showToast('数据已同步到 GitHub', 'success');
        } else {
            const error = await putResponse.json();
            throw new Error(error.message || '上传失败');
        }
    } catch (error) {
        statusEl.textContent = `❌ 上传失败: ${error.message}`;
        showToast('同步失败', 'error');
    }
}

// 从 GitHub 下载
async function syncFromGitHub() {
    const token = getGitHubToken();
    const config = getGitHubConfig();
    
    if (!token) {
        showToast('请先配置 GitHub Token', 'error');
        return;
    }
    if (!config.owner || !config.repo) {
        showToast('请配置私有仓库信息', 'error');
        return;
    }
    
    const statusEl = document.getElementById('syncStatus');
    statusEl.textContent = '正在下载...';
    
    try {
        const response = await fetch(
            `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`,
            { headers: { 'Authorization': `token ${token}` } }
        );
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('未找到备份文件，请先上传');
            }
            throw new Error('下载失败');
        }
        
        const fileData = await response.json();
        const content = JSON.parse(decodeURIComponent(escape(atob(fileData.content))));
        
        if (!content.data) {
            throw new Error('备份文件格式错误');
        }
        
        // 恢复数据
        if (content.data.libraryPapers) Storage.set('libraryPapers', content.data.libraryPapers);
        if (content.data.papersData) Storage.set('papersData', content.data.papersData);
        if (content.data.vocabularyData) Storage.set('vocabularyData', content.data.vocabularyData);
        if (content.data.abstractTranslationData) Storage.set('abstractTranslationData', content.data.abstractTranslationData);
        if (content.data.categoriesData) Storage.set('categoriesData', content.data.categoriesData);
        if (content.data.tagsData) Storage.set('tagsData', content.data.tagsData);
        if (content.data.trackingConfig) Storage.set('trackingConfig', content.data.trackingConfig);
        if (content.data.globalSettings) Storage.set('globalSettings', content.data.globalSettings);
        
        statusEl.textContent = `✅ 下载成功 (备份时间: ${content.lastSync || '未知'})`;
        showToast('数据已恢复，请刷新页面', 'success');
    } catch (error) {
        statusEl.textContent = `❌ 下载失败: ${error.message}`;
        showToast('同步失败', 'error');
    }
}

// ===== 数据迁移功能 =====

async function migrateData() {
    const statusEl = document.getElementById('migrateStatus');
    statusEl.textContent = '正在迁移...';
    
    // 初始化预置分类
    CategoriesStore.initPresetCategories();
    
    const categories = CategoriesStore.getAll();
    const unnamedCategory = categories.find(c => c.name === '未命名');
    const methodCategory = categories.find(c => c.name === '表征技术');
    
    let tagCount = 0;
    let paperCount = 0;
    
    // 遍历所有文献卡片
    const papers = PapersStore.getAll();
    
    for (const paper of papers) {
        // 如果已经有标签，跳过
        if (paper.tagIds && paper.tagIds.length > 0) continue;
        
        const tagIds = [];
        
        // 处理关键词
        const keywords = paper.keywords || [];
        const keywordsCn = paper.keywordsCn || paper.keywords_cn || [];
        
        for (let i = 0; i < Math.max(keywords.length, keywordsCn.length); i++) {
            const nameEn = keywords[i] || '';
            const nameCn = keywordsCn[i] || '';
            
            if (nameEn || nameCn) {
                const result = TagsStore.addOrGet({
                    nameCn, nameEn,
                    source: 'keyword',
                    categoryIds: unnamedCategory ? [unnamedCategory.id] : []
                });
                
                if (result.success && result.tag) {
                    tagIds.push(result.tag.id);
                    if (result.isNew) tagCount++;
                    
                    if (unnamedCategory && result.tag.categoryIds && !result.tag.categoryIds.includes(unnamedCategory.id)) {
                        TagsStore.addToCategory(result.tag.id, unnamedCategory.id);
                    }
                }
            }
        }
        
        // 处理表征技术
        const methodsCn = paper.methodsCn || paper.methods_cn || [];
        const methodsEn = paper.methodsEn || paper.methods_en || [];
        
        for (let i = 0; i < Math.max(methodsCn.length, methodsEn.length); i++) {
            const nameCn = methodsCn[i] || '';
            const nameEn = methodsEn[i] || '';
            
            if (nameEn || nameCn) {
                const result = TagsStore.addOrGet({
                    nameCn, nameEn,
                    source: 'method',
                    categoryIds: methodCategory ? [methodCategory.id] : []
                });
                
                if (result.success && result.tag) {
                    tagIds.push(result.tag.id);
                    if (result.isNew) tagCount++;
                    
                    if (methodCategory && result.tag.categoryIds && !result.tag.categoryIds.includes(methodCategory.id)) {
                        TagsStore.addToCategory(result.tag.id, methodCategory.id);
                    }
                }
            }
        }
        
        // 更新卡片
        if (tagIds.length > 0) {
            PapersStore.update(paper.id, { tagIds: tagIds.slice(0, 20) });
            paperCount++;
        }
    }
    
    statusEl.textContent = `✅ 迁移完成：创建了 ${tagCount} 个标签，更新了 ${paperCount} 条文献`;
    showToast('数据迁移完成', 'success');
}

// 页面加载时检查 GitHub 状态
document.addEventListener('DOMContentLoaded', () => {
    const token = getGitHubToken();
    updateGitHubStatus(!!token);
    
    // 初始化自动同步
    updateAutoSyncStatus();
    const config = getAutoSyncConfig();
    if (config.enabled && token) {
        startAutoSync();
    }
});


// ===== 自动同步功能 =====
const AUTO_SYNC_KEY = 'autoSyncConfig';
let autoSyncTimer = null;

function getAutoSyncConfig() {
    return Storage.get(AUTO_SYNC_KEY, {
        enabled: false,
        interval: 30,
        lastSync: null
    });
}

function saveAutoSyncConfig(config) {
    Storage.set(AUTO_SYNC_KEY, config);
}

function toggleAutoSync() {
    const toggle = document.getElementById('autoSyncToggle');
    const config = getAutoSyncConfig();
    config.enabled = toggle.checked;
    saveAutoSyncConfig(config);
    
    if (config.enabled) {
        startAutoSync();
        showToast('自动同步已开启', 'success');
    } else {
        stopAutoSync();
        showToast('自动同步已关闭', 'info');
    }
    updateAutoSyncStatus();
}

function saveAutoSyncInterval() {
    const interval = parseInt(document.getElementById('autoSyncInterval').value);
    const config = getAutoSyncConfig();
    config.interval = interval;
    saveAutoSyncConfig(config);
    
    if (config.enabled) {
        stopAutoSync();
        startAutoSync();
        showToast(`同步间隔已更新为 ${interval} 分钟`, 'success');
    }
}

function startAutoSync() {
    const config = getAutoSyncConfig();
    if (!config.enabled) return;
    
    const intervalMs = config.interval * 60 * 1000;
    
    if (autoSyncTimer) {
        clearInterval(autoSyncTimer);
    }
    
    autoSyncTimer = setInterval(() => {
        console.log('自动同步触发...');
        doAutoSync();
    }, intervalMs);
    
    updateAutoSyncStatus();
}

async function doAutoSync() {
    const token = getGitHubToken();
    const config = getGitHubConfig();
    
    if (!token || !config.owner || !config.repo) {
        console.warn('未配置GitHub同步，跳过自动同步');
        return;
    }
    
    try {
        const backupData = {
            version: '1.0',
            lastSync: new Date().toISOString(),
            data: {
                libraryPapers: LibraryStore.getAll(),
                papersData: PapersStore.getAll(),
                vocabularyData: VocabularyStore.getAll(),
                abstractTranslationData: AbstractTranslationStore.getAll(),
                categoriesData: CategoriesStore.getAll(),
                tagsData: TagsStore.getAll(),
                trackingConfig: TrackingConfig.get(),
                globalSettings: GlobalSettings.get()
            }
        };
        
        let sha = null;
        const getResponse = await fetch(
            `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`,
            { headers: { 'Authorization': `token ${token}` } }
        );
        
        if (getResponse.ok) {
            const fileData = await getResponse.json();
            sha = fileData.sha;
        }
        
        const body = {
            message: `auto-sync: ${new Date().toISOString()}`,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(backupData, null, 2)))),
            branch: config.branch
        };
        
        if (sha) body.sha = sha;
        
        const putResponse = await fetch(
            `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );
        
        if (putResponse.ok) {
            console.log('自动同步成功');
            const syncConfig = getAutoSyncConfig();
            syncConfig.lastSync = lastSync = new Date().toISOString();
            saveAutoSyncConfig(syncConfig);
            updateAutoSyncStatus();
        }
    } catch (error) {
        console.error('自动同步失败:', error);
    }
}

function stopAutoSync() {
    if (autoSyncTimer) {
        clearInterval(autoSyncTimer);
        autoSyncTimer = null;
    }
}

function updateAutoSyncStatus() {
    const config = getAutoSyncConfig();
    const statusEl = document.getElementById('autoSyncStatus');
    const toggle = document.getElementById('autoSyncToggle');
    const intervalSelect = document.getElementById('autoSyncInterval');
    
    if (!statusEl) return;
    
    if (toggle) toggle.checked = config.enabled;
    if (intervalSelect) intervalSelect.value = config.interval.toString();
    
    if (config.enabled) {
        const nextSync = config.lastSync 
            ? new Date(new Date(config.lastSync).getTime() + config.interval * 60 * 1000)
            : new Date(Date.now() + config.interval * 60 * 1000);
        statusEl.textContent = `✅ 已开启 · 下次同步: ${nextSync.toLocaleTimeString()}`;
        statusEl.style.color = 'var(--primary)';
    } else {
        statusEl.textContent = '未开启';
        statusEl.style.color = 'var(--text-secondary)';
    }
}

// 初始化自动同步
document.addEventListener('DOMContentLoaded', () => {
    const config = getAutoSyncConfig();
    const token = getGitHubToken();
    updateAutoSyncStatus();
    if (config.enabled && token) {
        startAutoSync();
    }
});
