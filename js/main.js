/**
 * main.js - 主页面脚本
 * 处理首页的统计信息、周报预览和最近文献加载
 */

// 配置
const CONFIG = {
    papersUrl: 'data/papers.json',
    vocabularyUrl: 'data/vocabulary.json',
    weeklyUrl: 'data/weekly.json',
    recentReportsCount: 3,
    recentPapersCount: 6
};

// DOM 加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    loadAllData();
});

/**
 * 移动端菜单切换
 */
function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.nav');
    
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
        });
    }
}

/**
 * 加载所有数据
 */
async function loadAllData() {
    try {
        const [papersRes, vocabRes, weeklyRes] = await Promise.all([
            fetch(CONFIG.papersUrl).catch(() => ({ ok: false, json: async () => [] })),
            fetch(CONFIG.vocabularyUrl).catch(() => ({ ok: false, json: async () => [] })),
            fetch(CONFIG.weeklyUrl).catch(() => ({ ok: false, json: async () => [] }))
        ]);
        
        let papers = [];
        let vocabularies = [];
        let weeklyReports = [];
        
        if (papersRes.ok) {
            papers = await papersRes.json();
        }
        
        if (vocabRes.ok) {
            vocabularies = await vocabRes.json();
        }
        
        if (weeklyRes.ok) {
            weeklyReports = await weeklyRes.json();
        }
        
        // 更新统计
        updateStatistics(papers, vocabularies, weeklyReports);
        
        // 加载最近周报
        loadRecentReports(weeklyReports);
        
        // 加载最近文献
        loadRecentPapers(papers);
        
    } catch (error) {
        console.error('加载数据失败:', error);
        // 使用本地存储作为后备
        loadFromLocalStorage();
    }
}

/**
 * 从本地存储加载数据
 */
function loadFromLocalStorage() {
    const storedPapers = localStorage.getItem('papersData');
    const storedVocab = localStorage.getItem('vocabularyData');
    const storedWeekly = localStorage.getItem('weeklyData');
    
    const papers = storedPapers ? JSON.parse(storedPapers) : [];
    const vocabularies = storedVocab ? JSON.parse(storedVocab) : [];
    const weeklyReports = storedWeekly ? JSON.parse(storedWeekly) : [];
    
    updateStatistics(papers, vocabularies, weeklyReports);
    loadRecentReports(weeklyReports);
    loadRecentPapers(papers);
}

/**
 * 更新统计数据
 */
function updateStatistics(papers, vocabularies, weeklyReports) {
    const masteredCount = vocabularies.filter(v => v.status === 'mastered').length;
    
    updateStat('paperCount', papers.length);
    updateStat('wordCount', vocabularies.length);
    updateStat('masteredCount', masteredCount);
    updateStat('weekCount', weeklyReports.length);
}

/**
 * 更新统计数字
 */
function updateStat(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

/**
 * 加载最近的周报
 */
function loadRecentReports(reports) {
    const container = document.getElementById('recentReports');
    if (!container) return;
    
    if (!Array.isArray(reports) || reports.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <p>暂无周报记录</p>
                <a href="weekly.html" class="btn btn-primary mt-4">创建第一篇周报</a>
            </div>
        `;
        return;
    }
    
    const recentReports = reports.slice(0, CONFIG.recentReportsCount);
    
    container.innerHTML = recentReports.map(report => createReportCard(report)).join('');
}

/**
 * 创建周报卡片HTML
 */
function createReportCard(report) {
    const weekNum = getWeekNumber(new Date(report.date));
    const progressItems = Array.isArray(report.progress) ? report.progress : [];
    
    return `
        <div class="report-card">
            <div class="report-header">
                <span class="report-week">第 ${weekNum} 周</span>
                <span class="report-date">${report.date}</span>
            </div>
            <div class="report-content">
                <h4>本周进展</h4>
                <ul>
                    ${progressItems.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                </ul>
                ${report.summary ? `<p class="mt-4" style="color: var(--text-secondary); font-size: 0.9rem;">${escapeHtml(report.summary.substring(0, 100))}...</p>` : ''}
            </div>
        </div>
    `;
}

/**
 * 获取周数
 */
function getWeekNumber(date) {
    const startDate = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startDate.getDay() + 1) / 7);
}

/**
 * 加载最近的文献
 */
function loadRecentPapers(papers) {
    const container = document.getElementById('recentPapers');
    if (!container) return;
    
    if (!Array.isArray(papers) || papers.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <p>暂无文献数据</p>
                <a href="papers.html" class="btn btn-primary mt-4">导入第一篇文献</a>
            </div>
        `;
        return;
    }
    
    const recentPapers = papers.slice(0, CONFIG.recentPapersCount);
    container.innerHTML = recentPapers.map(paper => createPaperCard(paper)).join('');
    
    // 添加点击事件
    container.querySelectorAll('.paper-card').forEach(card => {
        card.addEventListener('click', () => {
            const paperId = card.dataset.id;
            window.location.href = `papers.html?id=${paperId}`;
        });
    });
}

/**
 * 创建文献卡片HTML
 */
function createPaperCard(paper) {
    const categoryNames = {
        'synthesis': '合成',
        'characterization': '表征',
        'mechanism': '机理研究',
        'application': '应用',
        'industrial': '工业化',
        'custom': '自定义'
    };
    
    return `
        <div class="paper-card" data-id="${paper.id || ''}">
            <span class="paper-category">${categoryNames[paper.category] || '未分类'}</span>
            <h4 class="paper-title">${escapeHtml(paper.title || '无标题')}</h4>
            ${paper.title_cn ? `<p class="paper-title-cn">${escapeHtml(paper.title_cn)}</p>` : ''}
            <p class="paper-authors">${escapeHtml(paper.authors || '未知作者')}</p>
            <div class="paper-meta">
                <span class="paper-meta-item">📰 ${escapeHtml(paper.journal || '未知期刊')}</span>
                <span class="paper-meta-item">📅 ${paper.publish_date || ''}</span>
            </div>
            ${paper.abstract ? `<p class="paper-abstract">${escapeHtml(paper.abstract)}</p>` : ''}
        </div>
    `;
}

/**
 * HTML转义
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 防抖函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
