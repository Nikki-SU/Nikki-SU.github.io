/**
 * weekly.js - 周报模块脚本
 * 处理周报创建、编辑、期刊追踪、关键词管理和文献综述生成
 */

// 默认期刊列表
const DEFAULT_JOURNALS = [
    { name: 'Nature', category: 'top' },
    { name: 'Science', category: 'top' },
    { name: 'Nature Materials', category: 'top' },
    { name: 'Nature Energy', category: 'top' },
    { name: 'Nature Nanotechnology', category: 'top' },
    { name: 'Nature Photonics', category: 'top' },
    { name: 'Nature Communications', category: 'top' },
    { name: 'Science Advances', category: 'top' },
    { name: 'Advanced Materials', category: 'material' },
    { name: 'Energy & Environmental Science', category: 'material' },
    { name: 'Joule', category: 'material' },
    { name: 'Materials Horizons', category: 'material' },
    { name: 'Advanced Energy Materials', category: 'applied' },
    { name: 'Angewandte Chemie', category: 'applied' },
    { name: 'JACS', category: 'applied' },
    { name: 'Chemical Society Reviews', category: 'applied' },
    { name: 'Nano Energy', category: 'applied' },
    { name: 'ACS Materials Letters', category: 'applied' },
    { name: 'Materials Today', category: 'applied' },
    { name: 'Nano Letters', category: 'nanomaterial' },
    { name: 'ACS Nano', category: 'nanomaterial' },
    { name: 'Advanced Functional Materials', category: 'nanomaterial' },
    { name: 'Small', category: 'nanomaterial' },
    { name: 'Chemistry of Materials', category: 'nanomaterial' },
    { name: 'Journal of Materials Chemistry A', category: 'nanomaterial' },
    { name: 'Chem', category: 'energy' },
    { name: 'Energy Storage Materials', category: 'energy' },
    { name: 'Nano-Micro Letters', category: 'energy' },
    { name: 'ACS Energy Letters', category: 'energy' },
    { name: 'Solar RRL', category: 'other' },
    { name: 'Advanced Science', category: 'other' },
    { name: 'Scientific Reports', category: 'other' },
    { name: 'ACS Applied Energy Materials', category: 'other' }
];

const CATEGORY_NAMES = {
    'top': '顶级综合', 'material': '材料与能源', 'applied': '应用材料化学',
    'nanomaterial': '材料纳米', 'energy': '能源材料', 'other': '其他'
};

// 配置
const CONFIG = {
    weeklyUrl: 'data/weekly.json',
    libraryUrl: 'data/library.json',
    CROSSREF_API: 'https://api.crossref.org/works/'
};

// 状态
let weeklyReports = [];
let journals = [];
let keywords = [];  // 关键词列表
let currentReport = null;
let editingReportId = null;

// DOM元素
const elements = {};

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initEventListeners();
    loadData();
});

function initElements() {
    elements.weeklyList = document.getElementById('weeklyList');
    elements.reportModal = document.getElementById('reportModal');
    elements.createModal = document.getElementById('createModal');
    elements.journalModal = document.getElementById('journalModal');
    elements.keywordModal = document.getElementById('keywordModal');
    elements.reportForm = document.getElementById('reportForm');
    elements.journalList = document.getElementById('journalList');
    elements.keywordList = document.getElementById('keywordList');
    elements.totalReports = document.getElementById('totalReports');
    elements.papersThisWeek = document.getElementById('papersThisWeek');
    elements.wordsThisWeek = document.getElementById('wordsThisWeek');
    elements.reviewThisWeek = document.getElementById('reviewThisWeek');
}

function initEventListeners() {
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('active'));
    }

    // 创建周报按钮
    document.getElementById('createReportBtn')?.addEventListener('click', () => openCreateModal());
    document.getElementById('closeCreate')?.addEventListener('click', closeCreateModal);
    document.getElementById('cancelCreate')?.addEventListener('click', closeCreateModal);
    
    // 期刊追踪 - 改为追踪管理
    document.getElementById('trackJournalsBtn')?.addEventListener('click', trackJournals);
    document.getElementById('manageJournalsBtn')?.addEventListener('click', openTrackingModal);
    document.getElementById('closeJournal')?.addEventListener('click', closeJournalModal);
    document.getElementById('addJournalBtn')?.addEventListener('click', addJournal);
    document.getElementById('deleteJournalBtn')?.addEventListener('click', deleteSelectedJournals);

    // 关键词管理
    document.getElementById('manageKeywordsBtn')?.addEventListener('click', openKeywordModal);
    document.getElementById('closeKeyword')?.addEventListener('click', closeKeywordModal);
    document.getElementById('addKeywordBtn')?.addEventListener('click', addKeyword);
    document.getElementById('deleteKeywordBtn')?.addEventListener('click', deleteSelectedKeywords);

    // AI总结
    document.getElementById('generateSummaryBtn')?.addEventListener('click', generateWeeklySummary);

    // 模态框点击背景关闭
    elements.reportModal?.addEventListener('click', (e) => {
        if (e.target === elements.reportModal) closeReportModal();
    });
    elements.createModal?.addEventListener('click', (e) => {
        if (e.target === elements.createModal) closeCreateModal();
    });
    elements.journalModal?.addEventListener('click', (e) => {
        if (e.target === elements.journalModal) closeJournalModal();
    });
    elements.keywordModal?.addEventListener('click', (e) => {
        if (e.target === elements.keywordModal) closeKeywordModal();
    });

    elements.reportForm?.addEventListener('submit', handleReportSubmit);
    document.getElementById('closeModal')?.addEventListener('click', closeReportModal);
}

async function loadData() {
    try {
        const weeklyRes = await fetch(CONFIG.weeklyUrl).catch(() => ({ ok: false }));
        if (weeklyRes.ok) {
            weeklyReports = await weeklyRes.json();
        }
        
        // 加载期刊列表
        const storedJournals = localStorage.getItem('journalsData');
        if (storedJournals) {
            journals = JSON.parse(storedJournals);
        } else {
            journals = [...DEFAULT_JOURNALS];
            saveJournals();
        }

        // 加载关键词列表
        const storedKeywords = localStorage.getItem('keywordsData');
        if (storedKeywords) {
            keywords = JSON.parse(storedKeywords);
        } else {
            keywords = [];
            saveKeywords();
        }
        
    } catch (error) {
        console.error('加载数据失败:', error);
        weeklyReports = [];
        journals = [...DEFAULT_JOURNALS];
        keywords = [];
    }
    
    renderWeeklyList();
    updateStats();
}

function saveJournals() {
    localStorage.setItem('journalsData', JSON.stringify(journals));
}

function saveKeywords() {
    localStorage.setItem('keywordsData', JSON.stringify(keywords));
}

/**
 * 渲染周报列表
 */
function renderWeeklyList() {
    if (!elements.weeklyList) return;
    
    if (weeklyReports.length === 0) {
        elements.weeklyList.innerHTML = `
            <div class="empty-message">
                <p>暂无周报记录</p>
                <button class="btn btn-primary mt-4" onclick="openCreateModal()">创建第一篇周报</button>
            </div>
        `;
        return;
    }
    
    elements.weeklyList.innerHTML = weeklyReports.map(report => createReportCard(report)).join('');
}

function createReportCard(report) {
    const weekNum = getWeekNumber(new Date(report.date));
    const paperCount = Array.isArray(report.paperIds) ? report.paperIds.length : 0;
    
    return `
        <div class="report-card" data-id="${report.id}">
            <div class="report-header">
                <div>
                    <span class="report-week">第 ${weekNum} 周</span>
                    <span class="report-date" style="margin-left: 12px;">${report.date}</span>
                </div>
                <div class="word-actions">
                    <button class="btn btn-sm btn-outline" onclick="openReportModal('${report.id}')">查看详情</button>
                    <button class="btn btn-sm btn-secondary" onclick="openCreateModal('${report.id}')">编辑</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteReport('${report.id}')">删除</button>
                </div>
            </div>
            <div class="report-content">
                <h4>本周总结</h4>
                <p>${escapeHtml(report.summary || '暂无总结')}</p>
                ${paperCount > 0 ? `<p class="text-muted mt-4">📄 包含 ${paperCount} 篇文献</p>` : ''}
                ${report.nextWeek ? `<p class="text-muted">📌 下周计划：${escapeHtml(report.nextWeek)}</p>` : ''}
            </div>
        </div>
    `;
}

/**
 * 周报详情模态框
 */
function openReportModal(reportId) {
    const report = weeklyReports.find(r => r.id === reportId);
    if (!report) return;
    
    currentReport = report;
    
    const weekNum = getWeekNumber(new Date(report.date));
    const progressItems = Array.isArray(report.progress) ? report.progress : [];
    const paperIds = Array.isArray(report.paperIds) ? report.paperIds : [];
    
    document.getElementById('modalReportTitle').textContent = `第 ${weekNum} 周周报 - ${report.date}`;
    
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = `
        <div class="paper-detail">
            <div class="detail-meta">
                <div class="detail-meta-item">
                    <span class="detail-meta-label">周数</span>
                    <span class="detail-meta-value">第 ${weekNum} 周</span>
                </div>
                <div class="detail-meta-item">
                    <span class="detail-meta-label">文献数</span>
                    <span class="detail-meta-value">${paperIds.length} 篇</span>
                </div>
                <div class="detail-meta-item">
                    <span class="detail-meta-label">新词数</span>
                    <span class="detail-meta-value">${Array.isArray(report.newWords) ? report.newWords.length : 0} 个</span>
                </div>
            </div>
            
            <div class="detail-section">
                <h4 class="detail-section-title">📝 本周总结</h4>
                <div class="detail-content">${escapeHtml(report.summary || '暂无')}</div>
            </div>
            
            ${progressItems.length > 0 ? `
            <div class="detail-section">
                <h4 class="detail-section-title">🎯 主要进展</h4>
                <ul style="padding-left: 20px;">
                    ${progressItems.map(item => `<li style="margin-bottom: 8px;">${escapeHtml(item)}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${report.reviewContent ? `
            <div class="detail-section">
                <h4 class="detail-section-title">📚 文献综述</h4>
                <div class="detail-content review-summary">${report.reviewContent}</div>
            </div>
            ` : ''}
            
            ${paperIds.length > 0 ? `
            <div class="detail-section">
                <h4 class="detail-section-title">📄 关联文献</h4>
                <div id="reportPapersList">
                    <p class="text-muted">加载中...</p>
                </div>
            </div>
            ` : ''}
            
            ${Array.isArray(report.newWords) && report.newWords.length > 0 ? `
            <div class="detail-section">
                <h4 class="detail-section-title">📝 新学词汇</h4>
                <div class="detail-keywords">
                    ${report.newWords.map(w => `<span class="keyword-tag">${escapeHtml(w)}</span>`).join('')}
                </div>
            </div>
            ` : ''}
            
            ${report.nextWeek ? `
            <div class="detail-section">
                <h4 class="detail-section-title">📌 下周计划</h4>
                <div class="detail-content">${escapeHtml(report.nextWeek)}</div>
            </div>
            ` : ''}
        </div>
    `;
    
    elements.reportModal.classList.remove('hidden');
    
    if (paperIds.length > 0) {
        loadReportPapers(paperIds);
    }
}

async function loadReportPapers(paperIds) {
    try {
        const res = await fetch(CONFIG.libraryUrl).catch(() => ({ ok: false }));
        let papers = [];
        if (res.ok) {
            papers = await res.json();
        } else {
            const stored = localStorage.getItem('libraryData');
            if (stored) papers = JSON.parse(stored);
        }
        
        const reportPapers = papers.filter(p => paperIds.includes(p.id));
        
        const container = document.getElementById('reportPapersList');
        if (container && reportPapers.length > 0) {
            container.innerHTML = reportPapers.map(p => `
                <div class="review-item" style="cursor: pointer; padding: 8px; border-bottom: 1px solid var(--border-color);">
                    <div class="review-paper-title">${escapeHtml(p.title || p.title_cn)}</div>
                    <div class="review-paper-meta">${escapeHtml(p.authors)} | ${escapeHtml(p.journal)}</div>
                    ${p.doi ? `<a href="https://doi.org/${p.doi}" target="_blank" style="font-size: 0.85rem;">DOI: ${p.doi}</a>` : ''}
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('加载关联文献失败:', error);
    }
}

/**
 * 创建/编辑周报模态框
 */
function openCreateModal(reportId = null) {
    editingReportId = reportId;
    
    if (reportId) {
        const report = weeklyReports.find(r => r.id === reportId);
        if (report) {
            document.getElementById('createModalTitle').textContent = '编辑周报';
            document.getElementById('reportId').value = report.id;
            document.getElementById('reportDate').value = report.date;
            document.getElementById('reportSummary').value = report.summary || '';
            document.getElementById('reportPapers').value = Array.isArray(report.papers) ? report.papers.join('\n') : '';
            document.getElementById('reportWords').value = Array.isArray(report.newWords) ? report.newWords.join('\n') : '';
            document.getElementById('reportProgress').value = Array.isArray(report.progress) ? report.progress.join('\n') : '';
            document.getElementById('reportNextWeek').value = report.nextWeek || '';
        }
    } else {
        document.getElementById('createModalTitle').textContent = '新建周报';
        document.getElementById('reportForm').reset();
        document.getElementById('reportId').value = '';
        document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];
    }
    
    elements.createModal.classList.remove('hidden');
}

function closeCreateModal() {
    elements.createModal.classList.add('hidden');
    editingReportId = null;
}

function closeReportModal() {
    elements.reportModal.classList.add('hidden');
    currentReport = null;
}

/**
 * 处理周报表单提交
 */
async function handleReportSubmit(e) {
    e.preventDefault();
    
    const reportData = {
        id: document.getElementById('reportId').value || generateId(),
        date: document.getElementById('reportDate').value,
        summary: document.getElementById('reportSummary').value,
        papers: document.getElementById('reportPapers').value.split('\n').filter(p => p.trim()),
        newWords: document.getElementById('reportWords').value.split('\n').filter(w => w.trim()),
        progress: document.getElementById('reportProgress').value.split('\n').filter(p => p.trim()),
        nextWeek: document.getElementById('reportNextWeek').value,
        reviewContent: '',
        paperIds: [],
        updatedAt: new Date().toISOString()
    };
    
    // 保存周报
    if (editingReportId) {
        const index = weeklyReports.findIndex(r => r.id === editingReportId);
        if (index !== -1) {
            weeklyReports[index] = { ...weeklyReports[index], ...reportData };
        }
    } else {
        weeklyReports.unshift(reportData);
    }
    
    saveWeeklyReports();
    closeCreateModal();
    renderWeeklyList();
    updateStats();
    
    alert('周报保存成功！');
}

/**
 * 追踪管理模态框 - 包含期刊和关键词管理
 */
function openTrackingModal() {
    renderJournalList();
    renderKeywordList();
    elements.journalModal.classList.remove('hidden');
}

function closeJournalModal() {
    elements.journalModal.classList.add('hidden');
}

function renderJournalList() {
    if (!elements.journalList) return;

    // 按分类分组
    const grouped = {};
    journals.forEach(j => {
        if (!grouped[j.category]) grouped[j.category] = [];
        grouped[j.category].push(j);
    });

    let html = '';
    Object.entries(CATEGORY_NAMES).forEach(([cat, name]) => {
        const catJournals = grouped[cat] || [];
        if (catJournals.length === 0) return;

        html += `<div class="journal-category" style="margin-bottom: 16px;">
            <h5 style="color: var(--primary-color); margin-bottom: 8px;">${name} (${catJournals.length})</h5>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${catJournals.map((j, idx) => {
                    const globalIdx = journals.indexOf(j);
                    return `<label style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--card-bg); border-radius: 4px; font-size: 0.9rem;">
                        <input type="checkbox" class="journal-checkbox" data-index="${globalIdx}">
                        ${escapeHtml(j.name)}
                    </label>`;
                }).join('')}
            </div>
        </div>`;
    });

    elements.journalList.innerHTML = html || '<p class="text-muted">暂无期刊</p>';
}

function addJournal() {
    const name = document.getElementById('newJournalName')?.value.trim();
    const category = document.getElementById('newJournalCategory')?.value || 'other';
    
    if (!name) {
        alert('请输入期刊名称');
        return;
    }
    
    if (journals.find(j => j.name.toLowerCase() === name.toLowerCase())) {
        alert('该期刊已存在');
        return;
    }
    
    journals.push({ name, category });
    saveJournals();
    renderJournalList();
    
    document.getElementById('newJournalName').value = '';
}

function deleteSelectedJournals() {
    const checkboxes = document.querySelectorAll('.journal-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('请先选择要删除的期刊');
        return;
    }
    
    if (!confirm(`确定要删除选中的 ${checkboxes.length} 个期刊吗？`)) return;
    
    const indicesToDelete = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
    journals = journals.filter((_, idx) => !indicesToDelete.includes(idx));
    
    saveJournals();
    renderJournalList();
}

/**
 * 关键词管理
 */
function openKeywordModal() {
    renderKeywordList();
    elements.keywordModal.classList.remove('hidden');
}

function closeKeywordModal() {
    elements.keywordModal.classList.add('hidden');
}

function renderKeywordList() {
    if (!elements.keywordList) return;

    if (keywords.length === 0) {
        elements.keywordList.innerHTML = '<p class="text-muted">暂无关键词，点击下方添加</p>';
        return;
    }

    elements.keywordList.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
            ${keywords.map((kw, idx) => `
                <label style="display: flex; align-items: center; gap: 4px; padding: 6px 10px; background: var(--card-bg); border-radius: 6px; font-size: 0.9rem;">
                    <input type="checkbox" class="keyword-checkbox" data-index="${idx}">
                    <span class="keyword-badge ${kw.relation ? 'relation-' + kw.relation : ''}">${escapeHtml(kw.text)}</span>
                    ${kw.relation ? `<span style="font-size: 0.75rem; color: var(--text-secondary);">(${kw.relation.toUpperCase()})</span>` : ''}
                </label>
            `).join('')}
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary);">
            💡 支持 AND / OR / NOT 逻辑组合，最多10个关键词
        </p>
    `;
}

function addKeyword() {
    const text = document.getElementById('newKeywordText')?.value.trim();
    const relation = document.getElementById('newKeywordRelation')?.value || '';
    
    if (!text) {
        alert('请输入关键词');
        return;
    }
    
    if (keywords.length >= 10) {
        alert('最多只能添加10个关键词');
        return;
    }
    
    if (keywords.find(k => k.text.toLowerCase() === text.toLowerCase())) {
        alert('该关键词已存在');
        return;
    }
    
    keywords.push({ text, relation });
    saveKeywords();
    renderKeywordList();
    
    document.getElementById('newKeywordText').value = '';
}

function deleteSelectedKeywords() {
    const checkboxes = document.querySelectorAll('.keyword-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('请先选择要删除的关键词');
        return;
    }
    
    const indicesToDelete = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
    keywords = keywords.filter((_, idx) => !indicesToDelete.includes(idx));
    
    saveKeywords();
    renderKeywordList();
}

/**
 * 期刊追踪
 */
async function trackJournals() {
    const btn = document.getElementById('trackJournalsBtn');
    const container = document.getElementById('journalTracking');
    
    if (!container) return;
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ 检查中...';
    }
    
    container.innerHTML = `
        <p>正在追踪 ${journals.length} 个期刊...</p>
        <div id="trackingProgress" style="margin-top: 12px;">
            <div class="progress-bar" style="background: var(--border-color); border-radius: 4px; height: 8px;">
                <div class="progress-fill" style="width: 0%; height: 100%; background: var(--primary-color); border-radius: 4px; transition: width 0.3s;"></div>
            </div>
        </div>
        <p id="trackingStatus" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 8px;">准备中...</p>
    `;
    
    // 获取上次追踪时间
    const lastTrack = localStorage.getItem('lastJournalTrackDate');
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // 计算搜索日期范围（近一周）
    let startDate, endDate;
    if (lastTrack) {
        // 继续上次的位置
        startDate = new Date(lastTrack);
        endDate = new Date();
        endDate.setDate(endDate.getDate() - 7); // 只搜近7天
    } else {
        // 首次追踪，搜近一周
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
    }
    
    const results = {}; // { journalName: count }
    const newPapers = [];
    
    for (let i = 0; i < journals.length; i++) {
        const journal = journals[i];
        updateTrackingProgress((i / journals.length) * 100);
        updateTrackingStatus(`正在检查: ${journal.name}`);
        
        try {
            const count = await searchJournalRecentPapers(journal.name, startDate, endDate);
            results[journal.name] = count;
            
            // 获取实际文献
            if (count > 0) {
                const papers = await searchJournalPapers(journal.name, startDate, endDate);
                newPapers.push(...papers);
            }
            
            await new Promise(r => setTimeout(r, 300));
        } catch (error) {
            console.error(`搜索${journal.name}失败:`, error);
            results[journal.name] = 0;
        }
    }
    
    updateTrackingProgress(100);
    updateTrackingStatus('检查完成');
    
    // 保存追踪时间
    localStorage.setItem('lastJournalTrackDate', today);
    
    // 保存到文献库
    if (newPapers.length > 0) {
        await saveToLibrary(newPapers);
    }
    
    // 显示结果摘要
    const totalCount = Object.values(results).reduce((a, b) => a + b, 0);
    const journalSummary = Object.entries(results)
        .filter(([_, count]) => count > 0)
        .map(([name, count]) => `${name}: ${count}篇`)
        .join('<br>');
    
    container.innerHTML = `
        <div class="tracking-result">
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 2rem; margin-bottom: 8px;">📚</div>
                <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color);">
                    找到 ${totalCount} 篇新文献
                </div>
                <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 8px;">
                    近一周更新（${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}）
                </div>
            </div>
            ${journalSummary ? `
            <div style="margin-top: 16px; padding: 12px; background: var(--card-bg); border-radius: var(--radius);">
                <h5 style="margin-bottom: 8px;">各期刊分布：</h5>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">
                    ${journalSummary}
                </div>
            </div>
            ` : ''}
            <div style="margin-top: 16px; text-align: center;">
                <a href="library.html" class="btn btn-primary">📖 查看文献库</a>
                <button class="btn btn-outline mt-2" onclick="trackJournals()">再次检查</button>
            </div>
        </div>
    `;
    
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '🔄 检查更新';
    }
}

async function searchJournalRecentPapers(journal, startDate, endDate) {
    try {
        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];
        
        const response = await fetch(
            `${CONFIG.CROSSREF_API}?query.journal=${encodeURIComponent(journal)}&filter=from-pub-date:${start},until-pub-date:${end}&rows=0`,
            { headers: { 'Accept': 'application/json' } }
        );
        
        if (response.ok) {
            const data = await response.json();
            return data.message['total-results'] || 0;
        }
    } catch (error) {
        console.error('搜索失败:', error);
    }
    return 0;
}

async function searchJournalPapers(journal, startDate, endDate) {
    try {
        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];
        
        const response = await fetch(
            `${CONFIG.CROSSREF_API}?query.journal=${encodeURIComponent(journal)}&filter=from-pub-date:${start},until-pub-date:${end}&rows=50`,
            { headers: { 'Accept': 'application/json' } }
        );
        
        if (response.ok) {
            const data = await response.json();
            const items = data.message.items || [];
            
            return items.map(work => ({
                id: 'lib_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                title: work.title?.[0] || '',
                title_cn: '',
                authors: work.author?.map(a => `${a.family}, ${a.given}`).join('; ') || '',
                journal: work['container-title']?.[0] || journal,
                publish_date: work.published?.['date-parts']?.[0]?.join('-') || '',
                doi: work.DOI || '',
                abstract: work.abstract?.replace(/<[^>]*>/g, '') || '',
                abstract_cn: '',
                keywords: work.subject || [],
                importedAt: new Date().toISOString(),
                source: 'journal_track'
            }));
        }
    } catch (error) {
        console.error('获取文献失败:', error);
    }
    return [];
}

async function saveToLibrary(newPapers) {
    try {
        let library = [];
        const stored = localStorage.getItem('libraryData');
        if (stored) library = JSON.parse(stored);
        
        // 去重
        const existingDois = new Set(library.map(p => p.doi));
        const toAdd = newPapers.filter(p => !existingDois.has(p.doi));
        
        library.unshift(...toAdd);
        localStorage.setItem('libraryData', JSON.stringify(library));
        
    } catch (error) {
        console.error('保存到文献库失败:', error);
    }
}

function updateTrackingProgress(percent) {
    const fill = document.querySelector('#trackingProgress .progress-fill');
    if (fill) fill.style.width = percent + '%';
}

function updateTrackingStatus(text) {
    const status = document.getElementById('trackingStatus');
    if (status) status.textContent = text;
}

/**
 * AI生成周报总结
 */
async function generateWeeklySummary() {
    const btn = document.getElementById('generateSummaryBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ 生成中...';
    }
    
    try {
        // 获取近一周的文献库文献
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const stored = localStorage.getItem('libraryData');
        const library = stored ? JSON.parse(stored) : [];
        
        const recentPapers = library.filter(p => {
            if (!p.importedAt) return false;
            return new Date(p.importedAt) >= oneWeekAgo;
        });
        
        // 获取近一周的文献卡片
        const cardsStored = localStorage.getItem('papersData');
        const cards = cardsStored ? JSON.parse(cardsStored) : [];
        
        const recentCards = cards.filter(c => {
            if (!c.createdAt) return false;
            return new Date(c.createdAt) >= oneWeekAgo;
        });
        
        // 构建提示词
        const prompt = buildSummaryPrompt(recentPapers, recentCards);
        
        // 调用AI
        if (typeof parsePaperWithAI === 'function' && isApiKeyConfigured()) {
            const result = await parsePaperWithAI('', '周报总结', prompt);
            
            if (result && result.summary) {
                document.getElementById('reportSummary').value = result.summary_cn || result.summary;
                alert('✅ 周报总结已生成！');
            } else {
                alert('⚠️ AI返回格式异常，请手动填写');
            }
        } else {
            alert('⚠️ 请先在设置页面配置API Key');
        }
        
    } catch (error) {
        console.error('生成总结失败:', error);
        alert('生成失败: ' + error.message);
    }
    
    if (btn) {
        btn.disabled = false;
        btn.textContent = '🤖 AI生成总结';
    }
}

function buildSummaryPrompt(recentPapers, recentCards) {
    let prompt = '请为本周的学术学习生成周报总结。\n\n';
    
    if (recentPapers.length > 0) {
        prompt += `本周新增 ${recentPapers.length} 篇文献到文献库：\n`;
        recentPapers.slice(0, 10).forEach((p, i) => {
            prompt += `${i + 1}. ${p.title || p.title_cn} (${p.journal})\n`;
        });
        if (recentPapers.length > 10) {
            prompt += `...还有 ${recentPapers.length - 10} 篇\n`;
        }
        prompt += '\n';
    }
    
    if (recentCards.length > 0) {
        prompt += `本周制作了 ${recentCards.length} 个文献卡片：\n`;
        recentCards.slice(0, 5).forEach((c, i) => {
            prompt += `${i + 1}. ${c.title || c.title_cn}\n`;
            if (c.summary) prompt += `   总结: ${c.summary.substring(0, 100)}...\n`;
        });
        prompt += '\n';
    }
    
    prompt += `请生成一段150-200字的中文周报总结，内容包括：
1. 本周阅读的主要文献和主题
2. 重要的发现或创新点
3. 对后续研究的启发
4. 下周的学习计划建议

请以JSON格式返回：
{
  "summary": "中文周报总结",
  "nextWeek": "下周计划"
}`;
    
    return prompt;
}

/**
 * 删除周报
 */
function deleteReport(reportId) {
    if (!confirm('确定要删除这篇周报吗？')) return;
    
    weeklyReports = weeklyReports.filter(r => r.id !== reportId);
    saveWeeklyReports();
    renderWeeklyList();
    updateStats();
}

/**
 * 保存周报到服务器
 */
async function saveWeeklyReports() {
    localStorage.setItem('weeklyData', JSON.stringify(weeklyReports));
}

/**
 * 更新统计数据
 */
function updateStats() {
    const totalReports = weeklyReports.length;
    
    // 计算本周新增文献
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    let papersThisWeek = 0;
    try {
        const stored = localStorage.getItem('libraryData');
        if (stored) {
            const library = JSON.parse(stored);
            papersThisWeek = library.filter(p => {
                if (!p.importedAt) return false;
                return new Date(p.importedAt) >= oneWeekAgo;
            }).length;
        }
    } catch (e) {}
    
    // 计算本周新词
    let wordsThisWeek = 0;
    try {
        const vocabStored = localStorage.getItem('vocabularyData');
        if (vocabStored) {
            const vocabulary = JSON.parse(vocabStored);
            wordsThisWeek = vocabulary.filter(v => {
                if (!v.createdAt) return false;
                return new Date(v.createdAt) >= oneWeekAgo;
            }).length;
        }
    } catch (e) {}
    
    if (elements.totalReports) elements.totalReports.textContent = totalReports;
    if (elements.papersThisWeek) elements.papersThisWeek.textContent = papersThisWeek;
    if (elements.wordsThisWeek) elements.wordsThisWeek.textContent = wordsThisWeek;
    if (elements.reviewThisWeek) elements.reviewThisWeek.textContent = '0';
}

/**
 * 工具函数
 */
function getWeekNumber(date) {
    const startDate = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startDate.getDay() + 1) / 7);
}

function generateId() {
    return 'r_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
