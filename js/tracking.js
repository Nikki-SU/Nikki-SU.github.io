/**
 * tracking.js - 文献追踪逻辑
 */

// 状态
let journalsData = null;
let currentResults = [];
let isTracking = false;

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    loadJournalsData();
    loadConfig();
    loadHistory();
    initEventListeners();
    updateStats();
});

// 加载期刊数据
async function loadJournalsData() {
    try {
        const response = await fetch('data/journals.json');
        if (response.ok) {
            journalsData = await response.json();
            renderJournalList();
        }
    } catch (error) {
        console.error('加载期刊数据失败:', error);
    }
}

// 加载配置
function loadConfig() {
    const config = TrackingConfig.get();
    
    // 更新UI
    document.getElementById('autoTrackToggle').checked = config.autoTracking;
    
    // 渲染关键词
    renderKeywords(config.keywords || []);
    
    updateStats();
}

// 加载历史记录
function loadHistory() {
    const history = Storage.get('trackingHistory', []);
    renderHistory(history);
}

// 保存历史记录
function saveHistory(history) {
    Storage.set('trackingHistory', history);
}

// 渲染历史记录
function renderHistory(history) {
    const container = document.getElementById('historyList');
    
    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p>暂无追踪记录</p>
                <p class="text-muted">点击"开始追踪"获取最新文献</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = history.slice(0, 10).map(item => `
        <div class="list-item">
            <div class="list-item-main">
                <div class="list-item-title">${escapeHtml(item.date)}</div>
                <div class="list-item-sub">
                    ${item.journals.length} 个刊物 · ${item.totalResults} 篇结果
                </div>
            </div>
            <div class="list-item-actions">
                <button class="btn btn-sm btn-outline" onclick="viewHistoryDetail('${item.id}')">查看</button>
                <button class="btn btn-sm btn-danger" onclick="deleteHistory('${item.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

// 渲染期刊列表
function renderJournalList() {
    if (!journalsData) return;
    
    const container = document.getElementById('journalList');
    const config = TrackingConfig.get();
    const selected = config.selectedJournals || [];
    
    container.innerHTML = journalsData.categories.map(cat => `
        <div class="journal-category">
            <div class="journal-category-title">${cat.icon} ${cat.name}</div>
            ${cat.journals.map(j => `
                <div class="journal-item ${selected.includes(j.name) ? 'selected' : ''}" 
                     data-journal="${escapeAttr(j.name)}"
                     onclick="toggleJournal('${escapeAttr(j.name)}')">
                    <span class="journal-item-name">${escapeHtml(j.name)}</span>
                    <span class="journal-item-if">IF: ${j.if}</span>
                </div>
            `).join('')}
        </div>
    `).join('');
}

// 切换刊物选择
function toggleJournal(name) {
    const config = TrackingConfig.get();
    const selected = config.selectedJournals || [];
    const index = selected.indexOf(name);
    
    if (index === -1) {
        if (selected.length >= 50) {
            showToast('最多选择50个刊物', 'error');
            return;
        }
        selected.push(name);
    } else {
        selected.splice(index, 1);
    }
    
    config.selectedJournals = selected;
    TrackingConfig.save(config);
    
    // 更新UI
    document.querySelectorAll('.journal-item').forEach(el => {
        if (el.dataset.journal === name) {
            el.classList.toggle('selected', selected.includes(name));
        }
    });
    
    updateStats();
}

// 渲染关键词标签
function renderKeywords(keywords) {
    const container = document.getElementById('keywordTags');
    
    if (keywords.length === 0) {
        container.innerHTML = '<span class="text-muted">暂无关键词</span>';
        return;
    }
    
    container.innerHTML = keywords.map((kw, index) => `
        <span class="badge badge-primary" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px;">
            ${escapeHtml(kw)}
            <button onclick="removeKeyword(${index})" style="background: none; border: none; color: inherit; cursor: pointer; padding: 0; margin-left: 4px;">×</button>
        </span>
    `).join('');
}

// 添加关键词
function addKeyword() {
    const input = document.getElementById('keywordInput');
    const logic = document.getElementById('keywordLogic').value;
    let keyword = input.value.trim();
    
    if (!keyword) {
        showToast('请输入关键词', 'error');
        return;
    }
    
    const config = TrackingConfig.get();
    const keywords = config.keywords || [];
    
    // 添加逻辑前缀
    if (keywords.length > 0 && logic !== 'AND') {
        keyword = `${logic} ${keyword}`;
    }
    
    keywords.push(keyword);
    config.keywords = keywords;
    TrackingConfig.save(config);
    
    renderKeywords(keywords);
    input.value = '';
    updateStats();
}

// 删除关键词
function removeKeyword(index) {
    const config = TrackingConfig.get();
    const keywords = config.keywords || [];
    
    keywords.splice(index, 1);
    config.keywords = keywords;
    TrackingConfig.save(config);
    
    renderKeywords(keywords);
    updateStats();
}

// 更新统计
function updateStats() {
    const config = TrackingConfig.get();
    
    document.getElementById('journalCount').textContent = (config.selectedJournals || []).length;
    document.getElementById('keywordCount').textContent = (config.keywords || []).length;
    
    const lastTracking = config.lastTracking;
    if (lastTracking) {
        document.getElementById('lastTrackingTime').textContent = formatDate(lastTracking);
    }
    
    // 累计结果数
    const history = Storage.get('trackingHistory', []);
    const totalResults = history.reduce((sum, h) => sum + (h.totalResults || 0), 0);
    document.getElementById('totalResults').textContent = totalResults;
}

// 初始化事件监听
function initEventListeners() {
    document.getElementById('configBtn')?.addEventListener('click', openConfigModal);
    document.getElementById('trackBtn')?.addEventListener('click', startTracking);
    document.getElementById('closeConfigModal')?.addEventListener('click', closeConfigModal);
    document.getElementById('cancelConfigBtn')?.addEventListener('click', closeConfigModal);
    document.getElementById('saveConfigBtn')?.addEventListener('click', saveConfig);
    document.getElementById('addKeywordBtn')?.addEventListener('click', addKeyword);
    document.getElementById('keywordInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addKeyword();
    });
    document.getElementById('autoTrackToggle')?.addEventListener('change', (e) => {
        const config = TrackingConfig.get();
        config.autoTracking = e.target.checked;
        TrackingConfig.save(config);
    });
    
    // 导入相关
    document.getElementById('importAllBtn')?.addEventListener('click', openImportModal);
    document.getElementById('closeImportModal')?.addEventListener('click', closeImportModal);
    document.getElementById('cancelImportBtn')?.addEventListener('click', closeImportModal);
    document.getElementById('confirmImportBtn')?.addEventListener('click', confirmImport);
    
    // 模态框点击关闭
    document.getElementById('configModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'configModal') closeConfigModal();
    });
    document.getElementById('importModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'importModal') closeImportModal();
    });
}

// 打开配置模态框
function openConfigModal() {
    document.getElementById('configModal').classList.remove('hidden');
}

// 关闭配置模态框
function closeConfigModal() {
    document.getElementById('configModal').classList.add('hidden');
}

// 保存配置
function saveConfig() {
    showToast('配置已保存', 'success');
    closeConfigModal();
    updateStats();
}

// 开始追踪
async function startTracking() {
    const config = TrackingConfig.get();
    
    if ((config.selectedJournals || []).length === 0) {
        showToast('请先选择要追踪的刊物', 'error');
        return;
    }
    
    if (isTracking) {
        showToast('追踪正在进行中', 'warning');
        return;
    }
    
    isTracking = true;
    currentResults = [];
    
    const progressDiv = document.getElementById('trackingProgress');
    const resultsDiv = document.getElementById('trackingResults');
    const resultsList = document.getElementById('resultsList');
    
    progressDiv.classList.remove('hidden');
    resultsDiv.classList.add('hidden');
    resultsList.innerHTML = '';
    
    const journals = config.selectedJournals;
    const keywords = config.keywords || [];
    let currentIndex = 0;
    
    // 计算日期范围（最近7天）
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fromDate = weekAgo.toISOString().split('T')[0];
    const toDate = today.toISOString().split('T')[0];
    
    // 遍历每个刊物，调用CrossRef API
    for (const journal of journals) {
        currentIndex++;
        const percent = Math.round((currentIndex / journals.length) * 100);
        
        // 更新进度
        document.getElementById('trackingBar').style.width = `${percent}%`;
        document.getElementById('trackingPercent').textContent = `${percent}%`;
        document.getElementById('trackingStatus').textContent = `正在追踪...`;
        document.getElementById('currentJournal').innerHTML = `
            <strong>当前刊物:</strong> ${escapeHtml(journal)}<br>
            <span class="text-muted">第 ${currentIndex} / ${journals.length} 个</span>
        `;
        
        try {
            // 调用CrossRef API
            const results = await fetchFromCrossRef(journal, keywords, fromDate, toDate);
            currentResults.push({
                journal,
                results: results,
                count: results.length
            });
        } catch (error) {
            console.error(`追踪 ${journal} 失败:`, error);
            currentResults.push({
                journal,
                results: [],
                count: 0,
                error: error.message
            });
        }
        
        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 完成追踪
    isTracking = false;
    document.getElementById('trackingStatus').textContent = '追踪完成！';
    const totalCount = currentResults.reduce((sum, r) => sum + r.count, 0);
    document.getElementById('currentJournal').innerHTML = `
        <strong style="color: var(--success);">✅ 追踪完成！</strong><br>
        共找到 ${totalCount} 篇文献
    `;
    
    // 显示结果
    renderResults();
    
    // 更新配置中的最后追踪时间
    config.lastTracking = new Date().toISOString();
    TrackingConfig.save(config);
    updateStats();
    
    // 保存历史
    saveHistoryItem();
    
    showToast('追踪完成！', 'success');
}

// 调用CrossRef API获取文献
async function fetchFromCrossRef(journal, keywords, fromDate, toDate) {
    // 解析关键词逻辑
    const andKeywords = [];
    const orKeywords = [];
    const notKeywords = [];
    
    if (keywords && keywords.length > 0) {
        keywords.forEach(k => {
            const match = k.match(/^(AND|OR|NOT)\s+(.+)$/i);
            if (match) {
                const logic = match[1].toUpperCase();
                const word = match[2].toLowerCase();
                if (logic === 'AND') andKeywords.push(word);
                else if (logic === 'OR') orKeywords.push(word);
                else if (logic === 'NOT') notKeywords.push(word);
            } else {
                // 无前缀的默认为 AND
                andKeywords.push(k.toLowerCase());
            }
        });
    }
    
    // 构建查询URL - 使用所有关键词（不含NOT）进行搜索
    let url = 'https://api.crossref.org/works?';
    const params = new URLSearchParams();
    
    params.append('filter', `container-title:"${journal}",from-pub-date:${fromDate},until-pub-date:${toDate}`);
    
    // 用 AND 和 OR 关键词搜索
    const searchKeywords = [...andKeywords, ...orKeywords].join(' ');
    if (searchKeywords) {
        params.append('query', searchKeywords);
    }
    
    params.append('rows', '50');  // 获取更多结果用于筛选
    params.append('select', 'DOI,title,author,published-print,published-online,abstract,container-title');
    
    url += params.toString();
    
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'XiaoNAcademicSite/1.0 (mailto:contact@example.com)'
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // 解析并筛选结果
    const results = [];
    if (data.message && data.message.items) {
        for (const item of data.message.items) {
            if (!item.DOI || !item.title) continue;
            
            const title = Array.isArray(item.title) ? item.title[0] : item.title;
            const abstract = item.abstract || '';
            const searchText = (title + ' ' + abstract).toLowerCase();
            
            // 检查 AND 条件：必须包含所有 AND 关键词
            const matchAnd = andKeywords.length === 0 || andKeywords.every(kw => searchText.includes(kw));
            if (!matchAnd) continue;
            
            // 检查 NOT 条件：不能包含任何 NOT 关键词
            const matchNot = notKeywords.length === 0 || !notKeywords.some(kw => searchText.includes(kw));
            if (!matchNot) continue;
            
            // 检查 OR 条件：至少包含一个 OR 关键词（如果有 OR 关键词的话）
            const matchOr = orKeywords.length === 0 || orKeywords.some(kw => searchText.includes(kw));
            if (!matchOr) continue;
            
            results.push({
                title: title,
                titleEn: title,
                doi: item.DOI,
                authors: item.author ? item.author.slice(0, 5).map(a => `${a.given || ''} ${a.family || ''}`).join(', ') : '未知作者',
                year: item['published-print']?.['date-parts']?.[0]?.[0] || item['published-online']?.['date-parts']?.[0]?.[0] || new Date().getFullYear(),
                abstract: abstract,
                journal: item['container-title']?.[0] || journal
            });
        }
    }
    
    return results;
}

// 渲染追踪结果
function renderResults() {
    const resultsDiv = document.getElementById('trackingResults');
    const resultsList = document.getElementById('resultsList');
    
    resultsDiv.classList.remove('hidden');
    
    const flatResults = currentResults.filter(r => r.count > 0);
    
    if (flatResults.length === 0) {
        resultsList.innerHTML = `
            <div class="empty-state">
                <p>未找到匹配的文献</p>
            </div>
        `;
        return;
    }
    
    resultsList.innerHTML = flatResults.map(r => `
        <div class="tracking-item">
            <div class="tracking-item-header">
                <span class="tracking-item-name">${escapeHtml(r.journal)}</span>
                <span class="tracking-item-count">${r.count} 篇</span>
            </div>
            <div style="margin-bottom: 12px;">
                ${r.results.slice(0, 3).map(paper => `
                    <div style="padding: 8px; background: var(--card-bg); border-radius: 6px; margin-bottom: 6px;">
                        <div style="font-size: 0.9rem; margin-bottom: 4px;">${escapeHtml(paper.title)}</div>
                        <div class="text-muted" style="font-size: 0.8rem;">${escapeHtml(paper.authors.join(', '))}</div>
                    </div>
                `).join('')}
                ${r.count > 3 ? `<div class="text-muted" style="font-size: 0.85rem;">...还有 ${r.count - 3} 篇</div>` : ''}
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-sm btn-success" onclick="importJournal('${escapeAttr(r.journal)}')">
                    📥 导入此刊物
                </button>
            </div>
        </div>
    `).join('');
}

// 导入单个刊物的结果
function importJournal(journal) {
    const journalData = currentResults.find(r => r.journal === journal);
    if (!journalData) return;
    
    let imported = 0;
    let skipped = 0;
    
    journalData.results.forEach(paper => {
        const result = LibraryStore.add(paper);
        if (result.success) {
            imported++;
        } else {
            skipped++;
        }
    });
    
    showToast(`导入完成：${imported} 篇成功，${skipped} 篇已存在`, 'success');
}

// 打开导入确认模态框
function openImportModal() {
    if (currentResults.length === 0) {
        showToast('没有可导入的结果', 'error');
        return;
    }
    
    const total = currentResults.reduce((sum, r) => sum + r.count, 0);
    document.getElementById('importCount').textContent = total;
    document.getElementById('importModal').classList.remove('hidden');
}

// 关闭导入模态框
function closeImportModal() {
    document.getElementById('importModal').classList.add('hidden');
}

// 确认导入
function confirmImport() {
    const dedup = document.getElementById('dedupToggle').checked;
    let imported = 0;
    let skipped = 0;
    
    currentResults.forEach(journalData => {
        journalData.results.forEach(paper => {
            if (dedup) {
                const result = LibraryStore.add(paper);
                if (result.success) {
                    imported++;
                } else {
                    skipped++;
                }
            } else {
                LibraryStore.add({
                    ...paper,
                    id: Date.now().toString() + Math.random().toString(36).substr(2)
                });
                imported++;
            }
        });
    });
    
    closeImportModal();
    showToast(`导入完成：${imported} 篇成功${dedup ? `，${skipped} 篇已跳过` : ''}`, 'success');
}

// 保存历史记录项
function saveHistoryItem() {
    const history = Storage.get('trackingHistory', []);
    
    history.unshift({
        id: Date.now().toString(),
        date: new Date().toLocaleString('zh-CN'),
        journals: currentResults.map(r => r.journal),
        totalResults: currentResults.reduce((sum, r) => sum + r.count, 0),
        results: currentResults
    });
    
    // 只保留最近20条记录
    Storage.set('trackingHistory', history.slice(0, 20));
    loadHistory();
}

// 查看历史详情
function viewHistoryDetail(id) {
    const history = Storage.get('trackingHistory', []);
    const item = history.find(h => h.id === id);
    
    if (!item) {
        showToast('记录不存在', 'error');
        return;
    }
    
    // 加载历史结果用于查看
    currentResults = item.results || [];
    renderResults();
    showToast(`正在查看 ${item.date} 的追踪结果`, 'info');
}

// 删除历史记录
function deleteHistory(id) {
    if (!confirm('确定要删除这条追踪记录吗？')) return;
    
    const history = Storage.get('trackingHistory', []);
    const filtered = history.filter(h => h.id !== id);
    Storage.set('trackingHistory', filtered);
    loadHistory();
    updateStats();
    showToast('已删除', 'success');
}
