/**
 * library.js - 文献库模块脚本
 * 处理文献列表、DOI导入、滑动操作和批量管理
 */

// 配置
const CONFIG = {
    libraryUrl: 'data/library.json',  // 文献库数据
    papersUrl: 'data/papers.json',    // 文献卡片数据
    CROSSREF_API: 'https://api.crossref.org/works/'
};

// 状态
let libraryPapers = [];       // 文献库中的文献
let paperCards = [];           // 文献卡片
let filteredPapers = [];
let selectedPapers = new Set();
let displayLang = 'cn';       // 'cn' = 中文优先, 'en' = 英文优先
let cardStatusCache = {};     // 卡片状态缓存（一天更新一次）

// DOM元素
const elements = {};

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initEventListeners();
    loadData();
});

function initElements() {
    elements.paperList = document.getElementById('paperList');
    elements.emptyState = document.getElementById('emptyState');
    elements.totalCount = document.getElementById('totalCount');
    elements.pendingCount = document.getElementById('pendingCount');
    elements.completedCount = document.getElementById('completedCount');
    elements.batchActions = document.getElementById('batchActions');
    elements.selectedCount = document.getElementById('selectedCount');
    elements.batchCardBtn = document.getElementById('batchCardBtn');
    elements.batchDeleteBtn = document.getElementById('batchDeleteBtn');
    elements.journalFilter = document.getElementById('journalFilter');
    elements.statusFilter = document.getElementById('statusFilter');
    elements.searchInput = document.getElementById('searchInput');
}

function initEventListeners() {
    // 移动端菜单
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('active'));
    }
}

/**
 * 加载数据
 * 原则：localStorage有就用localStorage的（即使是空数组），没有才从文件读取
 */
async function loadData() {
    const storedLibrary = localStorage.getItem('libraryData');
    const storedCards = localStorage.getItem('papersData');
    
    // 文献库：localStorage有就用它
    if (storedLibrary !== null) {
        try {
            const parsed = JSON.parse(storedLibrary);
            if (Array.isArray(parsed)) {
                libraryPapers = parsed;
            }
        } catch (e) {
            console.error('文献库localStorage解析失败:', e);
        }
    } else {
        // localStorage完全没有数据（null），才从文件读取
        try {
            const libraryRes = await fetch(CONFIG.libraryUrl);
            if (libraryRes.ok) {
                const data = await libraryRes.json();
                libraryPapers = Array.isArray(data) ? data : [];
            }
        } catch (e) {
            console.error('加载文献库文件失败:', e);
        }
        localStorage.setItem('libraryData', JSON.stringify(libraryPapers));
    }

    // 文献卡片：localStorage有就用它
    if (storedCards !== null) {
        try {
            const parsed = JSON.parse(storedCards);
            if (Array.isArray(parsed)) {
                paperCards = parsed;
            }
        } catch (e) {
            console.error('文献卡片localStorage解析失败:', e);
        }
    } else {
        // localStorage完全没有数据（null），才从文件读取
        try {
            const cardsRes = await fetch(CONFIG.papersUrl);
            if (cardsRes.ok) {
                const data = await cardsRes.json();
                paperCards = Array.isArray(data) ? data : [];
            }
        } catch (e) {
            console.error('加载文献卡片文件失败:', e);
        }
        localStorage.setItem('papersData', JSON.stringify(paperCards));
    }

    console.log('数据加载成功 - 文献库:', libraryPapers.length, '篇, 卡片:', paperCards.length, '张');

    updateCardStatusCache();
    updateJournalFilter();
    filterPapers();
    updateStats();
}

/**
 * 更新卡片状态缓存（一天更新一次）
 */
function updateCardStatusCache() {
    const cacheKey = 'cardStatusCache';
    const cached = localStorage.getItem(cacheKey);
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (cached) {
        const cache = JSON.parse(cached);
        if (cache.date === today) {
            cardStatusCache = cache.data || {};
            return;
        }
    }

    // 重新计算卡片状态
    cardStatusCache = {};
    paperCards.forEach(card => {
        if (card.doi) {
            cardStatusCache[card.doi] = isCompleteCard(card);
        }
    });

    // 保存缓存
    localStorage.setItem(cacheKey, JSON.stringify({
        date: today,
        data: cardStatusCache
    }));
}

/**
 * 判断是否为完整卡片
 */
function isCompleteCard(card) {
    const requiredFields = ['summary', 'summary_cn', 'innovation', 'innovation_cn', 
                           'application', 'application_cn', 'structure', 'structure_cn',
                           'methods', 'methods_cn'];
    
    for (const field of requiredFields) {
        if (!card[field] || card[field].trim() === '') {
            return false;
        }
    }
    return true;
}

/**
 * 更新统计
 */
function updateStats() {
    const total = libraryPapers.length;
    let completed = 0;  // 完整卡片
    let rough = 0;      // 粗略卡片
    let noCard = 0;     // 无卡片
    
    libraryPapers.forEach(p => {
        const card = paperCards.find(c => c.doi === p.doi);
        if (!card) {
            noCard++;
        } else if (card.isRough || !isCompleteCard(card)) {
            rough++;
        } else {
            completed++;
        }
    });

    if (elements.totalCount) elements.totalCount.textContent = total;
    if (elements.pendingCount) elements.pendingCount.textContent = noCard + rough;  // 待制 = 无卡片 + 粗略
    if (elements.completedCount) elements.completedCount.textContent = completed;
}

/**
 * 更新期刊筛选器
 */
function updateJournalFilter() {
    if (!elements.journalFilter) return;

    const journals = [...new Set(libraryPapers.map(p => p.journal).filter(Boolean))];
    journals.sort();

    elements.journalFilter.innerHTML = '<option value="">全部期刊</option>' +
        journals.map(j => `<option value="${escapeHtml(j)}">${escapeHtml(j)}</option>`).join('');
}

/**
 * 筛选文献
 */
function filterPapers() {
    const statusFilter = elements.statusFilter?.value || '';
    const journalFilter = elements.journalFilter?.value || '';
    const searchTerm = elements.searchInput?.value?.toLowerCase() || '';

    filteredPapers = libraryPapers.filter(paper => {
        // 状态筛选
        if (statusFilter === 'pending' && cardStatusCache[paper.doi] === true) return false;
        if (statusFilter === 'completed' && cardStatusCache[paper.doi] !== true) return false;

        // 期刊筛选
        if (journalFilter && paper.journal !== journalFilter) return false;

        // 搜索
        if (searchTerm) {
            const searchText = [
                paper.title,
                paper.title_cn,
                paper.doi,
                paper.journal
            ].filter(Boolean).join(' ').toLowerCase();
            if (!searchText.includes(searchTerm)) return false;
        }

        return true;
    });

    renderPapers();
}

/**
 * 渲染文献列表
 */
function renderPapers() {
    if (!elements.paperList) return;

    if (filteredPapers.length === 0) {
        elements.paperList.innerHTML = '';
        elements.emptyState.style.display = 'block';
        return;
    }

    elements.emptyState.style.display = 'none';
    elements.paperList.innerHTML = filteredPapers.map(paper => createPaperItem(paper)).join('');
}

/**
 * 创建文献项HTML（简化版）
 */
function createPaperItem(paper) {
    const title = displayLang === 'cn' 
        ? (paper.title_cn || paper.title)
        : (paper.title || paper.title_cn);

    const existingCard = paperCards.find(c => c.doi === paper.doi);
    let statusBadge = '';
    
    if (existingCard) {
        statusBadge = existingCard.isRough || !isCompleteCard(existingCard) 
            ? '<span style="background:#fef3c7;padding:2px 8px;border-radius:4px;font-size:12px;">📝 粗略卡片</span>'
            : '<span style="background:#d1fae5;padding:2px 8px;border-radius:4px;font-size:12px;">✓ 完整卡片</span>';
    }

    const doiLink = paper.doi 
        ? `<a href="https://doi.org/${escapeHtml(paper.doi)}" target="_blank" class="btn btn-sm btn-primary">🔗 原文</a>`
        : '';

    return `
        <div style="background:var(--card-bg);border-radius:var(--radius);padding:16px;margin-bottom:12px;box-shadow:var(--shadow-sm);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div style="flex:1;">
                    <div style="font-weight:600;margin-bottom:8px;">${escapeHtml(title || '无标题')}</div>
                    <div style="font-size:0.85rem;color:var(--text-secondary);">📰 ${escapeHtml(paper.journal || '未知期刊')} · 📅 ${paper.publish_date || ''}</div>
                    <div style="font-size:0.85rem;color:var(--text-secondary);">🔗 ${escapeHtml(paper.doi || '')}</div>
                    ${statusBadge ? `<div style="margin-top:8px;">${statusBadge}</div>` : ''}
                </div>
                ${doiLink}
            </div>
        </div>
    `;
}

/**
 * 切换标题语言显示
 */
function toggleTitleLang(btn) {
    displayLang = displayLang === 'cn' ? 'en' : 'cn';
    btn.textContent = displayLang === 'cn' ? 'EN' : 'CN';
    filterPapers();
}

/**
 * 初始化滑动处理器
 */
function initSwipeHandlers() {
    const items = document.querySelectorAll('.paper-item');
    const threshold = 80;

    items.forEach(item => {
        let startX = 0;
        let currentX = 0;
        let isDragging = false;

        const resetSwipe = () => {
            item.classList.remove('swiped-left', 'swiped-right');
            const content = item.querySelector('.paper-content');
            if (content) content.style.transform = 'translateX(0)';
        };

        // 触摸事件
        item.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
            item.style.transition = 'none';
        });

        item.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentX = e.touches[0].clientX;
            const diff = currentX - startX;
            const slide = Math.max(-threshold, Math.min(threshold, diff));

            const content = item.querySelector('.paper-content');
            if (content) content.style.transform = `translateX(${slide}px)`;

            item.classList.remove('swiped-left', 'swiped-right');
            if (diff < -threshold / 2) {
                item.classList.add('swiped-left');
            } else if (diff > threshold / 2) {
                item.classList.add('swiped-right');
            }
        });

        item.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            item.style.transition = 'transform 0.3s ease';

            if (item.classList.contains('swiped-left')) {
                // 左滑删除
                handleDeletePaper(item.dataset.doi);
                setTimeout(resetSwipe, 300);
            } else if (item.classList.contains('swiped-right')) {
                // 右滑制卡
                handleMakeCard(item.dataset.doi);
                setTimeout(resetSwipe, 300);
            } else {
                resetSwipe();
            }
        });

        // 鼠标事件（PC端支持）
        item.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('paper-checkbox') || 
                e.target.classList.contains('lang-toggle')) return;
            startX = e.clientX;
            isDragging = true;
            item.style.transition = 'none';
            e.preventDefault();
        });

        item.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            currentX = e.clientX;
            const diff = currentX - startX;
            const slide = Math.max(-threshold, Math.min(threshold, diff));

            const content = item.querySelector('.paper-content');
            if (content) content.style.transform = `translateX(${slide}px)`;

            item.classList.remove('swiped-left', 'swiped-right');
            if (diff < -threshold / 2) {
                item.classList.add('swiped-left');
            } else if (diff > threshold / 2) {
                item.classList.add('swiped-right');
            }
        });

        item.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            item.style.transition = 'transform 0.3s ease';

            if (item.classList.contains('swiped-left')) {
                handleDeletePaper(item.dataset.doi);
                setTimeout(resetSwipe, 300);
            } else if (item.classList.contains('swiped-right')) {
                handleMakeCard(item.dataset.doi);
                setTimeout(resetSwipe, 300);
            } else {
                resetSwipe();
            }
        });

        item.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
                item.style.transition = 'transform 0.3s ease';
                resetSwipe();
            }
        });
    });
}

/**
 * 处理删除文献
 */
function handleDeletePaper(doi) {
    if (!confirm('确定要删除这篇文献吗？')) return;

    libraryPapers = libraryPapers.filter(p => p.doi !== doi);
    selectedPapers.delete(doi);
    saveLibrary();
    filterPapers();
    updateStats();
    updateBatchActions();
}

/**
 * 处理制作卡片
 */
async function handleMakeCard(doi) {
    const paper = libraryPapers.find(p => p.doi === doi);
    if (!paper) return;

    // 检查是否已有卡片
    const existingCard = paperCards.find(c => c.doi === doi);
    if (existingCard && isCompleteCard(existingCard)) {
        alert('该文献已有完整卡片');
        return;
    }

    // 显示加载提示
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'loading-overlay';
    loadingMsg.innerHTML = '<div class="loading-spinner"></div><span>正在生成粗略卡片...</span>';
    document.body.appendChild(loadingMsg);

    try {
        // 调用API翻译标题和摘要（如果没有中文版）
        let translatedPaper = { ...paper };
        if (!paper.title_cn || !paper.abstract_cn) {
            const translated = await translatePaper(paper);
            if (translated) {
                translatedPaper = { ...paper, ...translated };
                // 更新文献库中的数据
                const idx = libraryPapers.findIndex(p => p.doi === doi);
                if (idx >= 0) {
                    libraryPapers[idx] = translatedPaper;
                    saveLibrary();
                }
            }
        }

        // 创建粗略卡片
        const roughCard = createRoughCard(translatedPaper);
        
        if (existingCard) {
            Object.assign(existingCard, roughCard);
        } else {
            paperCards.push(roughCard);
        }

        cardStatusCache[doi] = isCompleteCard(roughCard);
        saveCards();
        filterPapers();
        updateStats();

        alert('✅ 粗略卡片已创建（标黄），可前往文献卡片页编辑完善');
    } catch (error) {
        console.error('创建卡片失败:', error);
        alert('创建失败: ' + error.message);
    } finally {
        loadingMsg.remove();
    }
}

/**
 * 调用AI API翻译文献信息
 */
async function translatePaper(paper) {
    // 检查是否有API配置
    const apiConfig = localStorage.getItem('ai_api_key');
    if (!apiConfig) {
        console.log('未配置API，跳过翻译');
        return null;
    }

    const provider = localStorage.getItem('ai_provider') || 'siliconflow';
    const model = localStorage.getItem('ai_model') || 'deepseek-ai/DeepSeek-V3';
    
    // API URL映射
    const apiUrls = {
        'siliconflow': 'https://api.siliconflow.cn/v1/chat/completions',
        'deepseek': 'https://api.deepseek.com/v1/chat/completions',
        'qwen': 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
    };
    
    const url = apiUrls[provider];
    if (!url) return null;

    const prompt = `请翻译以下学术文献信息，返回JSON格式：

标题：${paper.title || ''}
摘要：${paper.abstract || ''}

返回格式：
{
  "title_cn": "中文标题",
  "abstract_cn": "中文摘要"
}

只返回JSON，不要其他内容。`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiConfig}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            console.error('API请求失败:', response.status);
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        
        // 解析JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (parseErr) {
                console.error('JSON解析失败:', parseErr, '内容:', jsonMatch[0]);
                return null;
            }
        }
    } catch (error) {
        console.error('翻译失败:', error);
    }
    
    return null;
}

/**
 * 创建粗略卡片
 */
function createRoughCard(paper) {
    return {
        id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        title: paper.title || '',
        title_cn: paper.title_cn || '',
        authors: paper.authors || '',
        journal: paper.journal || '',
        publish_date: paper.publish_date || '',
        doi: paper.doi || '',
        abstract: paper.abstract || '',
        abstract_cn: paper.abstract_cn || '',
        keywords: paper.keywords || [],
        // 以下为粗略卡片的额外字段，完整卡片需要填写
        summary: '',
        summary_cn: '',
        innovation: '',
        innovation_cn: '',
        application: '',
        application_cn: '',
        structure: '',
        structure_cn: '',
        methods: '',
        methods_cn: '',
        vocabulary: [],
        category: 'custom',
        isRough: true,  // 标记为粗略卡片
        createdAt: new Date().toISOString()
    };
}

/**
 * 导入DOI
 */
async function importDois() {
    const input = document.getElementById('doiInput');
    const text = input.value.trim();
    
    if (!text) {
        alert('请输入DOI');
        return;
    }

    const lines = text.split('\n').filter(l => l.trim());
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const line of lines) {
        const doi = extractDoi(line.trim());
        if (!doi) {
            failed++;
            continue;
        }

        // 检查是否已存在
        if (libraryPapers.find(p => p.doi === doi)) {
            skipped++;
            continue;
        }

        try {
            const paper = await fetchPaperByDOI(doi);
            if (paper) {
                libraryPapers.unshift(paper);
                imported++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error('获取文献失败:', error);
            failed++;
        }

        // 避免请求过快
        await new Promise(r => setTimeout(r, 300));
    }

    saveLibrary();
    filterPapers();
    updateStats();

    input.value = '';
    alert(`导入完成！新增: ${imported}, 跳过: ${skipped}, 失败: ${failed}`);
}

/**
 * 提取DOI
 */
function extractDoi(input) {
    if (input.includes('doi.org/')) {
        return input.split('doi.org/')[1];
    }
    if (input.startsWith('10.')) {
        return input;
    }
    return null;
}

/**
 * 通过DOI获取文献信息
 */
async function fetchPaperByDOI(doi) {
    try {
        const response = await fetch(`${CONFIG.CROSSREF_API}${doi}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) return null;

        const data = await response.json();
        const work = data.message;

        return {
            id: 'lib_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title: work.title?.[0] || '',
            title_cn: '',  // 需要翻译
            authors: work.author?.map(a => `${a.family}, ${a.given}`).join('; ') || '',
            journal: work['container-title']?.[0] || '',
            publish_date: work.published?.['date-parts']?.[0] 
                ? work.published['date-parts'][0].join('-') 
                : '',
            doi: doi,
            abstract: work.abstract?.replace(/<[^>]*>/g, '') || '',
            abstract_cn: '',  // 需要翻译
            keywords: work.subject || [],
            importedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('API请求失败:', error);
        return null;
    }
}

/**
 * 查看文献详情
 */
function viewPaper(doi) {
    // 跳转到文献卡片页查看
    window.location.href = `papers.html?doi=${encodeURIComponent(doi)}`;
}

/**
 * 选择/取消选择
 */
function toggleSelect(doi) {
    if (selectedPapers.has(doi)) {
        selectedPapers.delete(doi);
    } else {
        selectedPapers.add(doi);
    }
    updateBatchActions();
}

/**
 * 全选/取消全选
 */
function selectAll() {
    if (selectedPapers.size === filteredPapers.length) {
        selectedPapers.clear();
    } else {
        filteredPapers.forEach(p => selectedPapers.add(p.doi));
    }
    renderPapers();
    updateBatchActions();
}

/**
 * 清空选择
 */
function clearSelection() {
    selectedPapers.clear();
    renderPapers();
    updateBatchActions();
}

/**
 * 更新批量操作栏
 */
function updateBatchActions() {
    const count = selectedPapers.size;
    
    if (elements.batchActions) {
        elements.batchActions.classList.toggle('active', count > 0);
    }
    if (elements.selectedCount) {
        elements.selectedCount.textContent = `已选择 ${count} 篇`;
    }
    if (elements.batchCardBtn) {
        elements.batchCardBtn.disabled = count === 0;
    }
    if (elements.batchDeleteBtn) {
        elements.batchDeleteBtn.disabled = count === 0;
    }
}

/**
 * 批量制作卡片
 */
function batchMakeCards() {
    if (selectedPapers.size === 0) return;

    let created = 0;
    let skipped = 0;

    selectedPapers.forEach(doi => {
        const paper = libraryPapers.find(p => p.doi === doi);
        if (!paper) return;

        const existingCard = paperCards.find(c => c.doi === doi);
        if (existingCard && isCompleteCard(existingCard)) {
            skipped++;
            return;
        }

        const roughCard = createRoughCard(paper);
        
        if (existingCard) {
            Object.assign(existingCard, roughCard);
        } else {
            paperCards.push(roughCard);
        }

        cardStatusCache[doi] = isCompleteCard(roughCard);
        created++;
    });

    saveCards();
    filterPapers();
    updateStats();
    clearSelection();

    alert(`批量制作完成！新增: ${created}, 跳过: ${skipped}`);
}

/**
 * 批量删除
 */
function batchDelete() {
    if (selectedPapers.size === 0) return;
    
    if (!confirm(`确定要删除选中的 ${selectedPapers.size} 篇文献吗？`)) return;

    libraryPapers = libraryPapers.filter(p => !selectedPapers.has(p.doi));
    selectedPapers.clear();

    saveLibrary();
    filterPapers();
    updateStats();
    updateBatchActions();

    alert('已删除选中的文献');
}

/**
 * 保存文献库
 */
function saveLibrary() {
    localStorage.setItem('libraryData', JSON.stringify(libraryPapers));
}

/**
 * 保存文献卡片
 */
function saveCards() {
    try {
        const jsonStr = JSON.stringify(paperCards);
        localStorage.setItem('papersData', jsonStr);
        console.log('保存文献卡片:', paperCards.length, '张');
    } catch (e) {
        console.error('保存文献卡片失败:', e);
        alert('保存失败，数据可能有问题: ' + e.message);
    }
}

/**
 * 工具函数
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
