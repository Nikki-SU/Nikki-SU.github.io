/**
 * tracking.js - 文献追踪逻辑
 * 使用 CrossRef API 真实搜索文献
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
    document.getElementById('autoTrackToggle').checked = config.autoTracking;
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
    
    document.getElementById('importAllBtn')?.addEventListener('click', openImportModal);
    document.getElementById('closeImportModal')?.addEventListener('click', closeImportModal);
    document.getElementById('cancelImportBtn')?.addEventListener('click', closeImportModal);
    document.getElementById('confirmImportBtn')?.addEventListener('click', confirmImport);
    
    document.getElementById('configModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'configModal') closeConfigModal();
    });
    document.getElementById('importModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'importModal') closeImportModal();
    });
}

function openConfigModal() {
    document.getElementById('configModal').classList.remove('hidden');
}

function closeConfigModal() {
    document.getElementById('configModal').classList.add('hidden');
}

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
        end: now.toISOString().split('T')[0]
    };
}

// 使用 CrossRef API 搜索文献
async function searchPapersFromCrossRef(journalName, keywords, dateRange) {
    const baseUrl = 'https://api.crossref.org/works';
    
    // 构建查询
    const queryParts = [];
    if (keywords && keywords.trim()) {
        queryParts.push(keywords.trim());
    }
    
    const params = new URLSearchParams();
    params.set('rows', '20');
    params.set('select', 'DOI,title,author,published-print,published-online,abstract,container-title');
    
    // 时间过滤
    params.set('filter', `from-pub-date:${dateRange.start},until-pub-date:${dateRange.end}`);
    
    // 查询词：期刊名 + 关键词
    const query = `${journalName} ${keywords}`.trim();
    params.set('query', query);
    
    try {
        const response = await fetch(`${baseUrl}?${params.toString()}`, {
            headers: {
                'User-Agent': 'AcademicSite/1.0 (mailto:contact@example.com)'
            }
        });
        
        if (!response.ok) {
            console.warn(`CrossRef API 请求失败: ${response.status}`);
            return [];
        }
        
        const data = await response.json();
        const items = data.message?.items || [];
        
        // 过滤匹配期刊名的结果
        return items
            .filter(item => {
                const containerTitle = item['container-title']?.[0] || '';
                return containerTitle.toLowerCase().includes(journalName.toLowerCase()) ||
                       journalName.toLowerCase().includes(containerTitle.toLowerCase()) ||
                       containerTitle.length > 0; // 保留有期刊名的结果
            })
            .map(item => ({
                doi: item.DOI || '',
                title: item.title?.[0] || '无标题',
                titleEn: item.title?.[0] || '',
                authors: (item.author || []).map(a => `${a.given || ''} ${a.family || ''}`).filter(n => n.trim()),
                year: item['published-print']?.['date-parts']?.[0]?.[0] || 
                      item['published-online']?.['date-parts']?.[0]?.[0] || new Date().getFullYear(),
                publishDate: item['published-print']?.['date-parts']?.[0]?.join('-') ||
                             item['published-online']?.['date-parts']?.[0]?.join('-') || '',
                abstract: item.abstract || ''
            }));
    } catch (error) {
        console.error('CrossRef API 错误:', error);
        return [];
    }
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
    let totalFound = 0;
    
    document.getElementById('trackingStatus').textContent = `正在追踪最近7天文献...`;
    document.getElementById('currentJournal').innerHTML = `
        <strong>时间范围:</strong> ${dateRange.start} 至 ${dateRange.end}<br>
        <span class="text-muted">使用 CrossRef API 搜索</span>
    `;
    
    for (const journal of journals) {
        currentIndex++;
        const percent = Math.round((currentIndex / journals.length) * 100);
        
        document.getElementById('trackingBar').style.width = `${percent}%`;
        document.getElementById('trackingPercent').textContent = `${percent}%`;
        document.getElementById('trackingStatus').textContent = `正在搜索...`;
        document.getElementById('currentJournal').innerHTML = `
            <strong>当前刊物:</strong> ${escapeHtml(journal)}<br>
            <span class="text-muted">第 ${currentIndex} / ${journals.length} 个 | 通过 CrossRef API</span>
        `;
        
        try {
            const papers = await searchPapersFromCrossRef(journal, keywords, dateRange);
            
            if (papers.length > 0) {
                currentResults.push({
                    journal,
                    results: papers,
                    count: papers.length
                });
                totalFound += papers.length;
            }
        } catch (error) {
            console.error(`搜索 ${journal} 失败:`, error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    isTracking = false;
    document.getElementById('trackingStatus').textContent = '追踪完成！';
    document.getElementById('currentJournal').innerHTML = `
        <strong style="color: var(--success);">✅ 追踪完成！</strong><br>
        时间范围: ${dateRange.start} 至 ${dateRange.end}<br>
        共找到 ${totalFound} 篇文献 ${totalFound === 0 ? '<br><span class="text-muted">（最近7天可能无匹配论文，或期刊名需精确匹配）</span>' : ''}
    `;
    
    renderResults();
    
    config.lastTracking = new Date().toISOString();
    TrackingConfig.save(config);
    updateStats();
    
    if (totalFound > 0) {
        saveHistoryItem();
    }
    
    showToast(`追踪完成！找到 ${totalFound} 篇文献`, totalFound > 0 ? 'success' : 'info');
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
                <div class="empty-state-icon">📭</div>
                <p>未找到匹配的文献</p>
                <p class="text-muted">可能的原因：最近7天该期刊无相关论文</p>
                <p class="text-muted" style="font-size: 0.85rem; margin-top: 8px;">数据来源: CrossRef API</p>
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
                ${r.results.slice(0, 5).map(paper => `
                    <div style="padding: 10px; background: var(--card-bg); border-radius: 6px; margin-bottom: 6px; border-left: 3px solid var(--primary);">
                        <div style="font-size: 0.95rem; margin-bottom: 4px; color: var(--text-main);">${escapeHtml(paper.title)}</div>
                        <div class="text-muted" style="font-size: 0.8rem;">
                            ${escapeHtml(paper.authors.slice(0, 3).join(', '))}${paper.authors.length > 3 ? ' 等' : ''} 
                            · ${paper.publishDate || paper.year}
                        </div>
                        <div style="font-size: 0.75rem; margin-top: 4px;">
                            <a href="https://doi.org/${paper.doi}" target="_blank" style="color: var(--primary); text-decoration: none;">DOI: ${paper.doi}</a>
                        </div>
                    </div>
                `).join('')}
                ${r.count > 5 ? `<div class="text-muted" style="font-size: 0.85rem;">...还有 ${r.count - 5} 篇</div>` : ''}
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

function openImportModal() {
    if (currentResults.length === 0) {
        showToast('没有可导入的结果', 'error');
        return;
    }
    
    const total = currentResults.reduce((sum, r) => sum + r.count, 0);
    document.getElementById('importCount').textContent = total;
    document.getElementById('importModal').classList.remove('hidden');
}

function closeImportModal() {
    document.getElementById('importModal').classList.add('hidden');
}

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
    
    Storage.set('trackingHistory', history.slice(0, 20));
    loadHistory();
}

function viewHistoryDetail(id) {
    const history = Storage.get('trackingHistory', []);
    const item = history.find(h => h.id === id);
    
    if (!item) {
        showToast('记录不存在', 'error');
        return;
    }
    
    currentResults = item.results || [];
    renderResults();
    showToast(`正在查看 ${item.date} 的追踪结果`, 'info');
}

function deleteHistory(id) {
    if (!confirm('确定要删除这条追踪记录吗？')) return;
    
    const history = Storage.get('trackingHistory', []);
    const filtered = history.filter(h => h.id !== id);
    Storage.set('trackingHistory', filtered);
    loadHistory();
    updateStats();
    showToast('已删除', 'success');
}
