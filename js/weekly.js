/**
 * weekly.js - 周报模块脚本
 * 处理周报创建、编辑、期刊追踪和文献综述生成
 */

// 默认期刊列表
const DEFAULT_JOURNALS = [
    // 顶级综合
    { name: 'Nature', category: 'top' },
    { name: 'Science', category: 'top' },
    { name: 'Nature Materials', category: 'top' },
    { name: 'Nature Energy', category: 'top' },
    { name: 'Nature Nanotechnology', category: 'top' },
    { name: 'Nature Photonics', category: 'top' },
    { name: 'Nature Communications', category: 'top' },
    { name: 'Science Advances', category: 'top' },
    // 材料与能源
    { name: 'Advanced Materials', category: 'material' },
    { name: 'Energy & Environmental Science', category: 'material' },
    { name: 'Joule', category: 'material' },
    { name: 'Materials Horizons', category: 'material' },
    // 应用材料化学
    { name: 'Advanced Energy Materials', category: 'applied' },
    { name: 'Angewandte Chemie', category: 'applied' },
    { name: 'JACS', category: 'applied' },
    { name: 'Chemical Society Reviews', category: 'applied' },
    { name: 'Nano Energy', category: 'applied' },
    { name: 'ACS Materials Letters', category: 'applied' },
    { name: 'Materials Today', category: 'applied' },
    // 材料纳米
    { name: 'Nano Letters', category: 'nanomaterial' },
    { name: 'ACS Nano', category: 'nanomaterial' },
    { name: 'Advanced Functional Materials', category: 'nanomaterial' },
    { name: 'Small', category: 'nanomaterial' },
    { name: 'Chemistry of Materials', category: 'nanomaterial' },
    { name: 'Journal of Materials Chemistry A', category: 'nanomaterial' },
    // 能源材料
    { name: 'Chem', category: 'energy' },
    { name: 'Energy Storage Materials', category: 'energy' },
    { name: 'Nano-Micro Letters', category: 'energy' },
    { name: 'ACS Energy Letters', category: 'energy' },
    // 其他
    { name: 'Solar RRL', category: 'other' },
    { name: 'Advanced Science', category: 'other' },
    { name: 'Scientific Reports', category: 'other' },
    { name: 'ACS Applied Energy Materials', category: 'other' }
];

const CATEGORY_NAMES = {
    'top': '顶级综合',
    'material': '材料与能源',
    'applied': '应用材料化学',
    'nanomaterial': '材料纳米',
    'energy': '能源材料',
    'other': '其他'
};

// 配置
const CONFIG = {
    weeklyUrl: 'data/weekly.json',
    papersUrl: 'data/papers.json',
    journalsUrl: 'data/journals.json',
    CROSSREF_API: 'https://api.crossref.org/works/'
};

// 状态
let weeklyReports = [];
let journals = [];
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
    elements.reportForm = document.getElementById('reportForm');
    elements.journalList = document.getElementById('journalList');
    elements.totalReports = document.getElementById('totalReports');
    elements.papersThisWeek = document.getElementById('papersThisWeek');
    elements.wordsThisWeek = document.getElementById('wordsThisWeek');
    elements.reviewThisWeek = document.getElementById('reviewThisWeek');
}

function initEventListeners() {
    // 移动端菜单
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('active'));
    }

    // 创建周报按钮
    document.getElementById('createReportBtn')?.addEventListener('click', () => openCreateModal());
    document.getElementById('closeCreate')?.addEventListener('click', closeCreateModal);
    document.getElementById('cancelCreate')?.addEventListener('click', closeCreateModal);
    
    // 期刊追踪
    document.getElementById('trackJournalsBtn')?.addEventListener('click', trackJournals);
    document.getElementById('manageJournalsBtn')?.addEventListener('click', openJournalModal);
    document.getElementById('closeJournal')?.addEventListener('click', closeJournalModal);
    document.getElementById('addJournalBtn')?.addEventListener('click', addJournal);
    
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

    // 表单提交
    elements.reportForm?.addEventListener('submit', handleReportSubmit);
    
    // 模态框关闭按钮
    document.getElementById('closeModal')?.addEventListener('click', closeReportModal);
}

async function loadData() {
    try {
        // 加载周报
        const weeklyRes = await fetch(CONFIG.weeklyUrl).catch(() => ({ ok: false }));
        if (weeklyRes.ok) {
            weeklyReports = await weeklyRes.json();
        }
        
        // 加载期刊列表
        const journalsRes = await fetch(CONFIG.journalsUrl).catch(() => ({ ok: false }));
        if (journalsRes.ok) {
            journals = await journalsRes.json();
        } else {
            journals = [...DEFAULT_JOURNALS];
            saveJournals();
        }
        
    } catch (error) {
        console.error('加载数据失败:', error);
        weeklyReports = [];
        journals = [...DEFAULT_JOURNALS];
    }
    
    renderWeeklyList();
    updateStats();
}

function saveJournals() {
    const data = JSON.stringify(journals, null, 2);
    localStorage.setItem('journalsData', data);
    // 提示用户需要同步到GitHub
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
    const paperCount = Array.isArray(report.papers) ? report.papers.length : 0;
    
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
            <!-- 统计 -->
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
            
            <!-- 本周总结 -->
            <div class="detail-section">
                <h4 class="detail-section-title">📝 本周总结</h4>
                <div class="detail-content">${escapeHtml(report.summary || '暂无')}</div>
            </div>
            
            <!-- 主要进展 -->
            ${progressItems.length > 0 ? `
            <div class="detail-section">
                <h4 class="detail-section-title">🎯 主要进展</h4>
                <ul style="padding-left: 20px;">
                    ${progressItems.map(item => `<li style="margin-bottom: 8px;">${escapeHtml(item)}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
            
            <!-- 文献综述 -->
            ${report.reviewContent ? `
            <div class="detail-section">
                <h4 class="detail-section-title">📚 文献综述</h4>
                <div class="detail-content review-summary">${report.reviewContent}</div>
            </div>
            ` : ''}
            
            <!-- 关联文献 -->
            ${paperIds.length > 0 ? `
            <div class="detail-section">
                <h4 class="detail-section-title">📄 关联文献</h4>
                <div id="reportPapersList">
                    <p class="text-muted">加载中...</p>
                </div>
            </div>
            ` : ''}
            
            <!-- 新学词汇 -->
            ${Array.isArray(report.newWords) && report.newWords.length > 0 ? `
            <div class="detail-section">
                <h4 class="detail-section-title">📝 新学词汇</h4>
                <div class="detail-keywords">
                    ${report.newWords.map(w => `<span class="keyword-tag">${escapeHtml(w)}</span>`).join('')}
                </div>
            </div>
            ` : ''}
            
            <!-- 下周计划 -->
            ${report.nextWeek ? `
            <div class="detail-section">
                <h4 class="detail-section-title">📌 下周计划</h4>
                <div class="detail-content">${escapeHtml(report.nextWeek)}</div>
            </div>
            ` : ''}
        </div>
    `;
    
    elements.reportModal.classList.remove('hidden');
    
    // 加载关联文献
    if (paperIds.length > 0) {
        loadReportPapers(paperIds);
    }
}

async function loadReportPapers(paperIds) {
    try {
        const res = await fetch(CONFIG.papersUrl);
        if (res.ok) {
            const papers = await res.json();
            const reportPapers = papers.filter(p => paperIds.includes(p.id));
            
            const container = document.getElementById('reportPapersList');
            if (container && reportPapers.length > 0) {
                container.innerHTML = reportPapers.map(p => `
                    <div class="review-item" style="cursor: pointer;" onclick="window.location.href='papers.html?id=${p.id}'">
                        <div class="review-paper-title">${escapeHtml(p.title)}</div>
                        <div class="review-paper-meta">${escapeHtml(p.authors)} | ${escapeHtml(p.journal)}</div>
                        ${p.doi ? `<a href="https://doi.org/${p.doi}" target="_blank" style="font-size: 0.85rem;">DOI: ${p.doi}</a>` : ''}
                    </div>
                `).join('');
            }
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
    
    // 解析文献并获取详情
    await processReportPapers(reportData);
    
    // 生成文献综述
    if (reportData.paperIds.length > 0) {
        reportData.reviewContent = generateLiteratureReview(reportData);
    }
    
    // 保存周报
    if (editingReportId) {
        const index = weeklyReports.findIndex(r => r.id === editingReportId);
        if (index !== -1) {
            weeklyReports[index] = { ...weeklyReports[index], ...reportData };
        }
    } else {
        weeklyReports.unshift(reportData);
    }
    
    // 保存到服务器
    await saveWeeklyReports();
    
    // 添加新词到词汇本
    if (reportData.newWords.length > 0) {
        await addNewWordsToVocabulary(reportData.newWords);
    }
    
    closeCreateModal();
    renderWeeklyList();
    updateStats();
    
    alert('周报保存成功！');
}

/**
 * 处理周报中的文献
 */
async function processReportPapers(reportData) {
    const paperIds = [];
    
    for (const paperRef of reportData.papers) {
        const trimmed = paperRef.trim();
        if (!trimmed) continue;
        
        let doi = null;
        
        // 检测DOI格式
        if (trimmed.includes('doi.org/')) {
            doi = trimmed.split('doi.org/')[1];
        } else if (trimmed.startsWith('10.')) {
            doi = trimmed;
        }
        
        if (doi) {
            // 尝试通过DOI获取文献信息
            try {
                const paperInfo = await fetchPaperByDOI(doi);
                if (paperInfo) {
                    paperIds.push(paperInfo.id);
                }
            } catch (error) {
                console.error('获取文献信息失败:', error);
            }
        }
    }
    
    reportData.paperIds = paperIds;
}

/**
 * 通过DOI获取文献信息
 */
async function fetchPaperByDOI(doi) {
    try {
        // 先检查本地是否存在
        const res = await fetch(CONFIG.papersUrl);
        if (res.ok) {
            const papers = await res.json();
            const existing = papers.find(p => p.doi === doi);
            if (existing) return existing;
        }
        
        // 从CrossRef API获取
        const response = await fetch(`${CONFIG.CROSSREF_API}${doi}`, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            const work = data.message;
            
            const paper = {
                id: generateId(),
                title: work.title?.[0] || 'Unknown Title',
                authors: work.author?.map(a => `${a.family}, ${a.given}`).join('; ') || 'Unknown',
                journal: work['container-title']?.[0] || 'Unknown Journal',
                publish_date: work.published?.['date-parts']?.[0] ? 
                    work.published['date-parts'][0].join('-') : '',
                doi: doi,
                abstract: work.abstract?.replace(/<[^>]*>/g, '') || '',
                category: 'custom',
                keywords: work.subject || [],
                source: 'weekly'
            };
            
            // 保存到本地papers
            await savePaper(paper);
            
            return paper;
        }
    } catch (error) {
        console.error('API请求失败:', error);
    }
    return null;
}

async function savePaper(paper) {
    try {
        const res = await fetch(CONFIG.papersUrl);
        let papers = [];
        if (res.ok) {
            papers = await res.json();
        }
        
        // 检查是否已存在
        if (!papers.find(p => p.doi === paper.doi)) {
            papers.unshift(paper);
            localStorage.setItem('papersData', JSON.stringify(papers));
        }
    } catch (error) {
        console.error('保存文献失败:', error);
    }
}

/**
 * 生成文献综述
 */
function generateLiteratureReview(reportData) {
    if (reportData.paperIds.length === 0) return '';
    
    const papers = getPapersByIds(reportData.paperIds);
    
    let review = `### 本周文献综述\n\n`;
    review += `本周阅读了 ${papers.length} 篇相关文献，主要涉及以下方面：\n\n`;
    
    // 按分类分组
    const byCategory = {};
    papers.forEach(p => {
        const cat = p.category || 'custom';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(p);
    });
    
    const categoryNames = {
        'synthesis': '合成方法',
        'characterization': '表征技术',
        'mechanism': '机理研究',
        'application': '应用研究',
        'industrial': '工业化进展',
        'custom': '其他'
    };
    
    for (const [cat, catPapers] of Object.entries(byCategory)) {
        review += `#### ${categoryNames[cat] || cat}\n\n`;
        
        catPapers.forEach((paper, idx) => {
            review += `**${idx + 1}. ${paper.title}**\n`;
            review += `- 作者：${paper.authors}\n`;
            review += `- 期刊：${paper.journal}\n`;
            if (paper.doi) {
                review += `- DOI：[${paper.doi}](papers.html?id=${paper.id})\n`;
            }
            if (paper.abstract) {
                review += `- 摘要：${paper.abstract.substring(0, 200)}...\n`;
            }
            review += `\n`;
        });
    }
    
    // 总结
    review += `### 阅读总结\n\n`;
    review += `这些文献涵盖了钙钛矿太阳能电池领域的重要研究进展，`;
    review += `包括材料合成、性能优化、稳定性提升等多个方面。`;
    review += `建议重点关注近期发表在Nature Energy、Joule等高水平期刊上的工作。\n\n`;
    
    // 参考文献
    review += `### 参考文献\n\n`;
    papers.forEach((paper, idx) => {
        if (paper.doi) {
            review += `[${idx + 1}] ${paper.authors}. ${paper.title}. ${paper.journal}. DOI: ${paper.doi}\n`;
        }
    });
    
    return review;
}

function getPapersByIds(ids) {
    // 这个函数在生成综述时需要访问papers数据
    // 实际使用时从localStorage或fetch获取
    const stored = localStorage.getItem('papersData');
    if (stored) {
        const papers = JSON.parse(stored);
        return papers.filter(p => ids.includes(p.id));
    }
    return [];
}

/**
 * 添加新词到词汇本
 */
async function addNewWordsToVocabulary(newWords) {
    try {
        const res = await fetch('data/vocabulary.json');
        let vocabulary = [];
        if (res.ok) {
            vocabulary = await res.json();
        }
        
        newWords.forEach(word => {
            const trimmed = word.trim().toLowerCase();
            if (!trimmed) return;
            
            // 检查是否已存在
            if (!vocabulary.find(v => v.word.toLowerCase() === trimmed)) {
                vocabulary.push({
                    id: generateId(),
                    word: trimmed,
                    word_cn: '',
                    definition: '',
                    example: '',
                    example_cn: '',
                    category: 'weekly',
                    status: 'new',
                    correct_count: 0,
                    error_count: 0,
                    phase_en_cn: false,
                    phase_cn_en: false,
                    phase_en_def: false,
                    phase_def_en: false,
                    last_practice_date: ''
                });
            }
        });
        
        localStorage.setItem('vocabularyData', JSON.stringify(vocabulary));
    } catch (error) {
        console.error('保存词汇失败:', error);
    }
}

/**
 * 保存周报到服务器
 */
async function saveWeeklyReports() {
    localStorage.setItem('weeklyData', JSON.stringify(weeklyReports));
    // 提示用户需要同步到GitHub
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
 * 期刊追踪
 */
async function trackJournals() {
    const btn = document.getElementById('trackJournalsBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '⏳ 检查中...';
    }
    
    const container = document.getElementById('journalTracking');
    container.innerHTML = `
        <p>正在追踪 ${journals.length} 个期刊...</p>
        <div id="trackingProgress" style="margin-top: 12px;">
            <div class="progress-bar"><div class="progress-fill" style="width: 0%"></div></div>
        </div>
    `;
    
    const newPapers = [];
    
    for (let i = 0; i < journals.length; i++) {
        const journal = journals[i];
        updateTrackingProgress((i / journals.length) * 100);
        
        try {
            const papers = await searchJournalPapers(journal.name);
            newPapers.push(...papers);
            // 避免请求过快
            await new Promise(r => setTimeout(r, 500));
        } catch (error) {
            console.error(`搜索${journal.name}失败:`, error);
        }
    }
    
    updateTrackingProgress(100);
    
    if (newPapers.length > 0) {
        // 保存追踪到的文献供后续使用
        localStorage.setItem('trackedPapers', JSON.stringify(newPapers));
        
        container.innerHTML = `
            <p style="color: var(--success-color);">🎉 发现 ${newPapers.length} 篇新文献！</p>
            <p class="text-muted" style="font-size: 0.85rem;">点击「制作卡片」可跳转到文献卡片页面进行AI解析</p>
            <div style="margin-top: 16px;" class="tracked-papers-list">
                ${newPapers.map((p, idx) => `
                    <div class="tracked-paper-item" style="padding: 12px; border: 1px solid var(--border-color); border-radius: var(--radius); margin-bottom: 12px;">
                        <div style="font-weight: 500; margin-bottom: 6px;">${idx + 1}. ${escapeHtml(p.title)}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;">
                            📖 ${escapeHtml(p.journal)} | 📅 ${p.publish_date}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">
                            DOI: <a href="https://doi.org/${p.doi}" target="_blank" style="color: var(--primary-color);">${p.doi}</a>
                        </div>
                        <button class="btn btn-sm btn-primary" onclick="makePaperCard('${p.doi}', '${escapeHtml(p.title).replace(/'/g, "\\'")}')">
                            📝 制作卡片
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="copyDOI('${p.doi}')" style="margin-left: 8px;">
                            📋 复制DOI
                        </button>
                    </div>
                `).join('')}
            </div>
            <div style="margin-top: 16px; display: flex; gap: 8px;">
                <button class="btn btn-outline" onclick="markAllAsRead()">全部标记为已读</button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <p>✅ 已是最新，暂无新文献</p>
            <p class="text-muted" style="font-size: 0.85rem;">上次检查: ${getLastCheckTime()}</p>
            <button class="btn btn-outline mt-4" onclick="loadData()">刷新</button>
        `;
    }
    
    // 更新检查时间
    localStorage.setItem('lastJournalCheck', new Date().toISOString());
    
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '🔄 检查更新';
    }
}

// 制作文献卡片 - 跳转到papers页面并预填DOI
function makePaperCard(doi, title) {
    // 存储到临时变量，供papers页面使用
    localStorage.setItem('pendingPaperDOI', doi);
    localStorage.setItem('pendingPaperTitle', title);
    // 跳转到文献卡片页面
    window.location.href = 'papers.html?action=import&doi=' + encodeURIComponent(doi);
}

// 复制DOI
function copyDOI(doi) {
    navigator.clipboard.writeText(doi).then(() => {
        alert('DOI已复制: ' + doi);
    }).catch(() => {
        prompt('复制失败，请手动复制:', doi);
    });
}

// 全部标记为已读
function markAllAsRead() {
    const tracked = JSON.parse(localStorage.getItem('trackedPapers') || '[]');
    const checked = JSON.parse(localStorage.getItem('checkedDOIs') || '[]');
    
    tracked.forEach(p => {
        if (!checked.includes(p.doi)) {
            checked.push(p.doi);
        }
    });
    
    localStorage.setItem('checkedDOIs', JSON.stringify(checked));
    localStorage.removeItem('trackedPapers');
    
    alert('已全部标记为已读');
    location.reload();
}

// 获取上次检查时间
function getLastCheckTime() {
    const last = localStorage.getItem('lastJournalCheck');
    if (!last) return '从未';
    const date = new Date(last);
    return date.toLocaleString('zh-CN');
}

async function searchJournalPapers(journalName) {
    const query = encodeURIComponent(`${journalName} AND perovskite solar cell`);
    const url = `https://api.crossref.org/works?query=${query}&filter=from-pub-date:2024-01-01&rows=5&sort=published`;
    
    const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return (data.message?.items || []).map(item => ({
        title: item.title?.[0] || 'Unknown',
        authors: item.author?.map(a => `${a.family}, ${a.given}`).join('; ') || 'Unknown',
        journal: item['container-title']?.[0] || journalName,
        publish_date: item.published?.['date-parts']?.[0] ? 
            item.published['date-parts'][0].join('-') : '',
        doi: item.DOI,
        abstract: item.abstract?.replace(/<[^>]*>/g, '') || ''
    }));
}

function updateTrackingProgress(percent) {
    const fill = document.querySelector('#trackingProgress .progress-fill');
    if (fill) fill.style.width = `${percent}%`;
}

async function importTrackedPapers() {
    const tracked = JSON.parse(localStorage.getItem('trackedPapers') || '[]');
    if (tracked.length === 0) return;
    
    const res = await fetch(CONFIG.papersUrl);
    let papers = [];
    if (res.ok) {
        papers = await res.json();
    }
    
    let added = 0;
    for (const paper of tracked) {
        if (!papers.find(p => p.doi === paper.doi)) {
            papers.unshift({
                id: generateId(),
                title: paper.title,
                authors: paper.authors,
                journal: paper.journal,
                publish_date: paper.publish_date,
                doi: paper.doi,
                abstract: paper.abstract,
                category: 'custom',
                source: 'tracked'
            });
            added++;
        }
    }
    
    localStorage.setItem('papersData', JSON.stringify(papers));
    
    alert(`成功导入 ${added} 篇文献！`);
    localStorage.removeItem('trackedPapers');
    
    // 刷新页面
    window.location.reload();
}

/**
 * 期刊管理模态框
 */
function openJournalModal() {
    renderJournalList();
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
    for (const [cat, catJournals] of Object.entries(grouped)) {
        html += `<div style="margin-bottom: 16px;">
            <h4 style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 8px;">${CATEGORY_NAMES[cat] || cat}</h4>`;
        
        catJournals.forEach(j => {
            html += `
                <div class="journal-item">
                    <div>
                        <div class="journal-name">${escapeHtml(j.name)}</div>
                    </div>
                    <div class="journal-actions">
                        <button class="btn btn-sm btn-danger" onclick="removeJournal('${j.name}')">删除</button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    elements.journalList.innerHTML = html || '<p class="text-muted">暂无期刊</p>';
}

function addJournal() {
    const nameInput = document.getElementById('newJournalName');
    const categorySelect = document.getElementById('newJournalCategory');
    
    const name = nameInput.value.trim();
    const category = categorySelect.value;
    
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
    
    nameInput.value = '';
    renderJournalList();
    alert('期刊添加成功！');
}

function removeJournal(journalName) {
    if (!confirm(`确定要删除期刊 "${journalName}" 吗？`)) return;
    
    journals = journals.filter(j => j.name !== journalName);
    saveJournals();
    renderJournalList();
}

/**
 * 更新统计数据
 */
function updateStats() {
    if (elements.totalReports) {
        elements.totalReports.textContent = weeklyReports.length;
    }
    
    // 本周统计
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    
    const thisWeekReports = weeklyReports.filter(r => new Date(r.date) >= weekStart);
    
    if (elements.papersThisWeek) {
        const paperCount = thisWeekReports.reduce((sum, r) => sum + (r.paperIds?.length || 0), 0);
        elements.papersThisWeek.textContent = paperCount;
    }
    
    if (elements.wordsThisWeek) {
        const wordCount = thisWeekReports.reduce((sum, r) => sum + (r.newWords?.length || 0), 0);
        elements.wordsThisWeek.textContent = wordCount;
    }
    
    if (elements.reviewThisWeek) {
        elements.reviewThisWeek.textContent = thisWeekReports.length;
    }
}

/**
 * 工具函数
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getWeekNumber(date) {
    const startDate = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startDate.getDay() + 1) / 7);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
