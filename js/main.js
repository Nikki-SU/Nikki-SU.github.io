/**
 * main.js - 主页面脚本
 * 处理首页的统计信息和最近文献加载
 */

// 全局配置
const CONFIG = {
    papersUrl: 'data/papers.json',
    vocabularyUrl: 'data/vocabulary.json',
    itemsPerPage: 6
};

// DOM 加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    loadStatistics();
    loadRecentPapers();
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
 * 加载统计数据
 */
async function loadStatistics() {
    try {
        const [papersRes, vocabRes] = await Promise.all([
            fetch(CONFIG.papersUrl).catch(() => ({ ok: false, json: async () => [] })),
            fetch(CONFIG.vocabularyUrl).catch(() => ({ ok: false, json: async () => [] }))
        ]);
        
        let papers = [];
        let vocabularies = [];
        
        if (papersRes.ok) {
            papers = await papersRes.json();
        }
        
        if (vocabRes.ok) {
            vocabularies = await vocabRes.json();
        }
        
        // 更新统计数字
        updateStat('paperCount', papers.length);
        updateStat('wordCount', vocabularies.length);
        
        // 从localStorage获取已掌握单词数
        const mastered = JSON.parse(localStorage.getItem('masteredWords') || '[]');
        updateStat('masteredCount', mastered.length);
        
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
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
 * 加载最近的文献卡片
 */
async function loadRecentPapers() {
    const container = document.getElementById('recentPapers');
    if (!container) return;
    
    try {
        const response = await fetch(CONFIG.papersUrl);
        if (!response.ok) {
            throw new Error('无法加载文献数据');
        }
        
        const papers = await response.json();
        
        if (!Array.isArray(papers) || papers.length === 0) {
            container.innerHTML = '<p class="empty-message">暂无文献数据，添加你的第一篇文献吧！</p>';
            return;
        }
        
        // 获取最近的6篇文献
        const recentPapers = papers.slice(0, CONFIG.itemsPerPage);
        container.innerHTML = recentPapers.map(paper => createPaperCard(paper)).join('');
        
        // 添加点击事件
        container.querySelectorAll('.paper-card').forEach(card => {
            card.addEventListener('click', () => {
                const paperId = card.dataset.id;
                window.location.href = `papers.html?id=${paperId}`;
            });
        });
        
    } catch (error) {
        console.error('加载文献失败:', error);
        container.innerHTML = '<p class="empty-message">加载失败，请稍后重试</p>';
    }
}

/**
 * 创建文献卡片HTML
 */
function createPaperCard(paper) {
    const categoryNames = {
        synthesis: '合成',
        characterization: '表征',
        mechanism: '机理',
        application: '应用',
        custom: '自定义'
    };
    
    return `
        <div class="paper-card" data-id="${paper.id || ''}">
            <span class="paper-category">${categoryNames[paper.category] || '未分类'}</span>
            <h4 class="paper-title">${escapeHtml(paper.title || '无标题')}</h4>
            <p class="paper-authors">${escapeHtml(paper.authors || '未知作者')}</p>
            <div class="paper-meta">
                <span>${paper.journal || '未知期刊'}</span>
                <span>${paper.publish_date || ''}</span>
            </div>
            ${paper.abstract ? `<p class="paper-abstract">${escapeHtml(paper.abstract)}</p>` : ''}
        </div>
    `;
}

/**
 * HTML转义
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
