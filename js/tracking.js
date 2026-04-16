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

// 获取最近7天的日期范围
function getLast7DaysRange() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return {
        start: sevenDaysAgo.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
        startISO: sevenDaysAgo.toISOString(),
        endISO: now.toISOString()
    };
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
    
    // 获取最近7天的时间范围
    const dateRange = getLast7DaysRange();
    
    const progressDiv = document.getElementById('trackingProgress');
    const resultsDiv = document.getElementById('trackingResults');
    const resultsList = document.getElementById('resultsList');
    
    progressDiv.classList.remove('hidden');
    resultsDiv.classList.add('hidden');
    resultsList.innerHTML = '';
    
    const journals = config.selectedJournals;
    const keywords = (config.keywords || []).join(' ');
    let currentIndex = 0;
    
    // 更新状态显示
    document.getElementById('trackingStatus').textContent = `正在追踪最近7天文献...`;
    document.getElementById('currentJournal').innerHTML = `
        <strong>时间范围:</strong> ${dateRange.start} 至 ${dateRange.end}<br>
        <span class="text-muted">追踪最近7天发表的文献</span>
    `;
    
    // 模拟追踪过程（实际应用中需要调用真实的API）
    for (const journal of journals) {
        currentIndex++;
        const percent = Math.round((currentIndex / journals.length) * 100);
        
        // 更新进度
        document.getElementById('trackingBar').style.width = `${percent}%`;
        document.getElementById('trackingPercent').textContent = `${percent}%`;
        document.getElementById('trackingStatus').textContent = `正在追踪最近7天文献...`;
        document.getElementById('currentJournal').innerHTML = `
            <strong>当前刊物:</strong> ${escapeHtml(journal)}<br>
            <span class="text-muted">第 ${currentIndex} / ${journals.length} 个 | 时间范围: ${dateRange.start} 至 ${dateRange.end}</span>
        `;
        
        // 模拟API调用延迟
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // 模拟获取结果（实际应用中需要调用真实的学术API，并传入dateRange）
        const mockResults = generateMockResults(journal, keywords, dateRange);
        currentResults.push({
            journal,
            results: mockResults,
            count: mockResults.length
        });
    }
    
    // 完成追踪
    isTracking = false;
    document.getElementById('trackingStatus').textContent = '追踪完成！';
    document.getElementById('currentJournal').innerHTML = `
        <strong style="color: var(--success);">✅ 追踪完成！</strong><br>
        时间范围: ${dateRange.start} 至 ${dateRange.end}<br>
        共找到 ${currentResults.reduce((sum, r) => sum + r.count, 0)} 篇文献
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

// 生成模拟结果（用于演示）
function generateMockResults(journal, keywords, dateRange) {
    const count = Math.floor(Math.random() * 8) + 1;
    const results = [];
    
    // 在时间范围内生成随机日期
    const startDate = new Date(dateRange.startISO);
    const endDate = new Date(dateRange.endISO);
    const timeDiff = endDate.getTime() - startDate.getTime();
    
    for (let i = 0; i < count; i++) {
        // 生成时间范围内的随机日期
        const randomTime = startDate.getTime() + Math.random() * timeDiff;
        const randomDate = new Date(randomTime);
        
        results.push({
            title: keywords ? `${keywords.split(' ')[0] || '研究'}在${journal}中的最新进展` 
                : `${journal}最新研究进展`,
            titleEn: keywords ? `Recent advances in ${keywords.split(' ')[0] || 'research'} published in ${journal}`
                : `Latest research progress in ${journal}`,
            doi: `10.${Math.floor(Math.random() * 90000) + 10000}/${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 1000)}`,
            authors: generateMockAuthors(),
            year: randomDate.getFullYear(),
            publishDate: randomDate.toISOString().split('T')[0],
            abstract: keywords ? `This study investigates ${keywords} with promising results...`
                : `This paper presents significant findings...`
        });
    }
    
    return results;
}

// 生成模拟作者
function generateMockAuthors() {
    const names = ['Zhang Wei', 'Li Ming', 'Wang Fang', 'Liu Yang', 'Chen Hui', 'Yang Xia', 'Zhou Lin', 'Wu Qiang'];
    const count = Math.floor(Math.random() * 3) + 2;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
        const name = names[Math.floor(Math.random() * names.length)];
        if (!selected.includes(name)) selected.push(name);
    }
    
    return selected;
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
                        <div class="text-muted" style="font-size: 0.8rem;">${escapeHtml(paper.authors.join(', '))} · ${paper.publishDate || paper.year}</div>
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
    const dateRange = getLast7DaysRange();
    
    history.unshift({
        id: Date.now().toString(),
        date: new Date().toLocaleString('zh-CN'),
        dateRange: `${dateRange.start} 至 ${dateRange.end}`,
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
