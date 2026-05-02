/**
 * papers.js - 文献库和文献卡片逻辑
 */

// 状态
let currentTab = 'library';
let currentCardId = null;
let currentLibraryId = null;
let libraryLangCN = true;
let libraryDetailMode = false; // false=简, true=详 // 文献库语言，true=中文，false=英文

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadLibrary();
    loadCards();
    
    // 处理URL参数，自动打开详情
    const params = new URLSearchParams(window.location.search);
    const cardId = params.get('id');
    const libraryId = params.get('library');
    const fromFiles = params.has('fromFiles');
    
    if (cardId) {
        openCardDetail(cardId);
        // 标记来自文件管理页
        if (fromFiles) {
            document.body.dataset.fromFiles = 'true';
        }
    } else if (libraryId) {
        openLibraryDetail(libraryId);
        // 标记来自文件管理页
        if (fromFiles) {
            document.body.dataset.fromFiles = 'true';
        }
    }
});

// 初始化事件监听
function initEventListeners() {
    // Tab切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // 添加DOI
    document.getElementById('addDoiBtn')?.addEventListener('click', addByDoi);
    document.getElementById('doiInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addByDoi();
    });
    
    // 手动添加
    document.getElementById('manualAddBtn')?.addEventListener('click', openManualAddModal);
    document.getElementById('closeManualAddModal')?.addEventListener('click', closeManualAddModal);
    document.getElementById('cancelManualAddBtn')?.addEventListener('click', closeManualAddModal);
    document.getElementById('confirmManualAddBtn')?.addEventListener('click', confirmManualAdd);
    
    // 刷新
    document.getElementById('refreshLibraryBtn')?.addEventListener('click', loadLibrary);
    
    // 语言切换
    document.getElementById('libraryLangBtn')?.addEventListener('click', toggleLibraryLang);
    
    // 详简切换
    document.getElementById('libraryDetailBtn')?.addEventListener('click', toggleLibraryDetail);
    
    // 文献库词条详情语言切换
    document.getElementById('detailLibraryLangBtn')?.addEventListener('click', toggleDetailLibraryLang);
    
    // 筛选
    document.getElementById('libraryFilter')?.addEventListener('change', loadLibrary);
    document.getElementById('librarySearch')?.addEventListener('input', debounce(loadLibrary, 300));
    
    // 导入JSON卡片
    document.getElementById('importCardBtn')?.addEventListener('click', () => {
        document.getElementById('cardFileInput')?.click();
    });
    document.getElementById('cardFileInput')?.addEventListener('change', handleCardFileImport);
    
    // 粘贴JSON数据导入
    document.getElementById('importJsonBtn')?.addEventListener('click', handleJsonDataImport);
    
    // 复制AI提示词
    document.getElementById('copyAiPromptBtn')?.addEventListener('click', copyAiPrompt);
    
    // 卡片详情
    document.getElementById('closeCardDetailModal')?.addEventListener('click', closeCardDetailModal);
    document.getElementById('closeCardDetailBtn')?.addEventListener('click', closeCardDetailModal);
    document.getElementById('deleteCardBtn')?.addEventListener('click', deleteCurrentCard);
    
    // 模态框点击关闭
    document.getElementById('manualAddModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'manualAddModal') closeManualAddModal();
    });
    document.getElementById('cardDetailModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'cardDetailModal') closeCardDetailModal();
    });
}

// Tab切换
function switchTab(tab) {
    currentTab = tab;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tab}Tab`);
    });
    
    if (tab === 'library') loadLibrary();
    if (tab === 'cards') loadCards();
}

// 切换文献库语言
function toggleLibraryLang() {
    libraryLangCN = !libraryLangCN;
    const btn = document.getElementById('libraryLangBtn');
    btn.textContent = libraryLangCN ? '中' : 'EN';
    btn.classList.toggle('btn-primary', !libraryLangCN);
    btn.classList.toggle('btn-outline', libraryLangCN);
    loadLibrary();
}

// 切换文献库详简模式
function toggleLibraryDetail() {
    libraryDetailMode = !libraryDetailMode;
    const btn = document.getElementById('libraryDetailBtn');
    btn.textContent = libraryDetailMode ? '简' : '详';
    btn.classList.toggle('btn-primary', libraryDetailMode);
    btn.classList.toggle('btn-outline', !libraryDetailMode);
    loadLibrary();
}

// 切换文献库词条详情语言
function toggleDetailLibraryLang() {
    libraryLangCN = !libraryLangCN;
    const btn = document.getElementById('detailLibraryLangBtn');
    if (btn) {
        btn.textContent = libraryLangCN ? '中' : 'EN';
        btn.classList.toggle('btn-primary', !libraryLangCN);
        btn.classList.toggle('btn-outline', libraryLangCN);
    }
    // 如果有打开的文献库词条详情，重新渲染
    if (currentLibraryId) {
        openLibraryDetail(currentLibraryId);
    }
    // 同时更新列表页的按钮状态
    const listBtn = document.getElementById('libraryLangBtn');
    if (listBtn) {
        listBtn.textContent = libraryLangCN ? '中' : 'EN';
        listBtn.classList.toggle('btn-primary', !libraryLangCN);
        listBtn.classList.toggle('btn-outline', libraryLangCN);
    }
}

// 加载文献库
function loadLibrary() {
    const container = document.getElementById('libraryList');
    let papers = LibraryStore.getAll();
    
    // 更新语言按钮状态
    const langBtn = document.getElementById('libraryLangBtn');
    if (langBtn) {
        langBtn.textContent = libraryLangCN ? '中' : 'EN';
        langBtn.classList.toggle('btn-primary', !libraryLangCN);
        langBtn.classList.toggle('btn-outline', libraryLangCN);
    }
    
    // 筛选
    const filter = document.getElementById('libraryFilter')?.value;
    const search = document.getElementById('librarySearch')?.value?.toLowerCase() || '';
    
    if (filter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        papers = papers.filter(p => new Date(p.addedAt) > weekAgo);
    } else if (filter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        papers = papers.filter(p => new Date(p.addedAt) > monthAgo);
    }
    
    if (search) {
        papers = papers.filter(p => 
            (p.title && p.title.toLowerCase().includes(search)) ||
            (p.titleEn && p.titleEn.toLowerCase().includes(search)) ||
            (p.authors && p.authors.join(' ').toLowerCase().includes(search)) ||
            (p.abstract && p.abstract.toLowerCase().includes(search))
        );
    }
    
    if (papers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p>${search ? '没有匹配的文献' : '文献库为空'}</p>
                <p class="text-muted">${search ? '尝试其他关键词' : '通过追踪或手动添加文献'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = papers.map(paper => {
        // 根据语言选择标题
        const mainTitle = libraryLangCN 
            ? (paper.titleCn || paper.title || '无标题') 
            : (paper.titleEn || paper.title || 'No Title');
        const subTitle = libraryLangCN 
            ? (paper.titleEn ? paper.titleEn : '') 
            : (paper.titleCn ? paper.titleCn : '');
        
        // 摘要（详模式显示）
        const abstract = libraryLangCN 
            ? (paper.abstractCn || paper.abstract || '') 
            : (paper.abstract || paper.abstractCn || '');
        
        // 标签
        const uniqueTagIds = [...new Set(paper.tagIds || [])];
        const tags = uniqueTagIds.map(id => TagsStore.getById(id)).filter(Boolean);
        const tagHtml = tags.map(t => {
            const name = libraryLangCN ? (t.nameCn || t.nameEn) : (t.nameEn || t.nameCn);
            return `<span class="badge badge-primary" style="font-size: 0.75rem;">${escapeHtml(name)}</span>`;
        }).join('');
        
        return `
            <div class="paper-card" data-id="${paper.id}">
                <div class="paper-card-title">${escapeHtml(mainTitle)}</div>
                ${subTitle ? `<div class="text-muted" style="font-size: 0.9rem; margin-bottom: 8px;">${escapeHtml(subTitle)}</div>` : ''}
                ${libraryDetailMode && abstract ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px; line-height: 1.5;">${escapeHtml(abstract.substring(0, 300))}${abstract.length > 300 ? '...' : ''}</div>` : ''}
                ${tagHtml ? `<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">${tagHtml}</div>` : ''}
                <div class="paper-card-meta">
                    ${paper.authors ? `<span>${escapeHtml(paper.authors.join(', '))}</span>` : ''}
                    ${paper.year ? `<span> · ${paper.year}</span>` : ''}
                    ${paper.doi ? `<span> · DOI: ${escapeHtml(paper.doi)}</span>` : ''}
                    <span class="badge badge-secondary" style="margin-left: 8px;">${formatDate(paper.addedAt)}</span>
                </div>
                <div class="paper-card-actions">
                    ${paper.doi ? `<a href="https://doi.org/${paper.doi}" target="_blank" class="btn btn-sm btn-outline">🔗 原文</a>` : ''}
                    <button class="btn btn-sm btn-danger" onclick="deletePaper('${paper.id}')">🗑️ 删除</button>
                </div>
            </div>
        `;
    }).join('');
}


// 文献卡片列表全局语言
let cardListLang = 'cn';

function setCardListLang(lang) {
    cardListLang = lang;
    // 更新按钮状态
    document.getElementById('cardListLangCn').style.background = lang === 'cn' ? 'var(--primary)' : 'var(--bg)';
    document.getElementById('cardListLangCn').style.color = lang === 'cn' ? 'white' : 'var(--text)';
    document.getElementById('cardListLangEn').style.background = lang === 'en' ? 'var(--primary)' : 'var(--bg)';
    document.getElementById('cardListLangEn').style.color = lang === 'en' ? 'white' : 'var(--text)';
    // 重新加载卡片
    loadCards();
}

// 加载卡片列表
function loadCards() {
    const container = document.getElementById('cardList');
    const cards = PapersStore.getAll();
    
    if (cards.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">🃏</div>
                <p>暂无文献卡片</p>
                <p class="text-muted">使用AI生成或手动创建卡片</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = cards.map(card => {
        // 根据全局语言选择显示内容
        const title = cardListLang === 'cn' 
            ? (card.titleCn || card.titleEn || '文献卡片')
            : (card.titleEn || card.titleCn || 'Paper Card');
        
        const abstract = cardListLang === 'cn'
            ? (card.abstractCn || card.abstractEn || '')
            : (card.abstractEn || card.abstractCn || '');
        
        const keywords = cardListLang === 'cn'
            ? (card.keywordsCn && card.keywordsCn.length ? card.keywordsCn : card.keywords || [])
            : (card.keywords || []);
        
        return `
        <div class="card" onclick="openCardDetail('${card.id}')" style="cursor: pointer;">
            <div style="font-weight: 600; margin-bottom: 8px; line-height: 1.4;">
                ${escapeHtml(title)}
            </div>
            ${abstract ? `<p class="text-muted" style="font-size: 0.85rem; margin-bottom: 12px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(abstract)}</p>` : ''}
            ${keywords.length > 0 ? `<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
                ${keywords.slice(0, 4).map(kw => `<span class="badge badge-primary">${escapeHtml(kw)}</span>`).join('')}
            </div>` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-secondary);">
                <span>${card.doi ? `DOI: ${escapeHtml(card.doi)}` : ''}</span>
                <span>${card.vocabulary?.length || 0} 词</span>
            </div>
        </div>
    `}).join('');
}

// 通过DOI添加文献
async function addByDoi() {
    const doiInput = document.getElementById('doiInput');
    const doi = doiInput.value.trim();
    
    if (!doi) {
        showToast('请输入DOI', 'error');
        return;
    }
    
    // 清理DOI
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, '');
    
    showToast('正在获取文献信息...', 'info');
    
    try {
        // 尝试从CrossRef API获取信息
        const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`);
        
        if (!response.ok) {
            throw new Error('文献未找到');
        }
        
        const data = await response.json();
        const work = data.message;
        
        // 获取英文信息
        const titleEn = work.title?.[0] || '';
        const abstract = work.abstract?.replace(/<[^>]*>/g, '') || '';
        
        // 尝试翻译标题和摘要
        let titleCn = '';
        let abstractCn = '';
        
        if (titleEn && window.translateField) {
            showToast('正在翻译标题...', 'info');
            titleCn = await translateField(titleEn, 'cn') || '';
        }
        
        if (abstract && window.translateField) {
            showToast('正在翻译摘要...', 'info');
            abstractCn = await translateField(abstract, 'defCn') || '';
        }
        
        const paper = {
            doi: cleanDoi,
            title: titleCn || titleEn, // 优先显示中文标题
            titleCn: titleCn,
            titleEn: titleEn,
            authors: (work.author || []).map(a => `${a.given || ''} ${a.family || ''}`.trim()),
            year: work.published?.['date-parts']?.[0]?.[0] || work.created?.['date-parts']?.[0]?.[0],
            journal: work['container-title']?.[0] || '',
            abstract: abstract,
            abstractCn: abstractCn
        };
        
        const result = LibraryStore.add(paper);
        
        if (result.success) {
            showToast('文献添加成功！', 'success');
            doiInput.value = '';
            loadLibrary();
        } else {
            showToast(result.message, 'warning');
        }
    } catch (error) {
        console.error('获取文献失败:', error);
        showToast('获取文献信息失败，请尝试手动添加', 'error');
    }
}

// 打开手动添加模态框
function openManualAddModal() {
    document.getElementById('manualAddModal').classList.remove('hidden');
    document.getElementById('manualAddForm')?.reset();
}

// 关闭手动添加模态框
function closeManualAddModal() {
    document.getElementById('manualAddModal').classList.add('hidden');
}

// 确认手动添加
function confirmManualAdd() {
    const titleCn = document.getElementById('manualTitleCn').value.trim();
    const titleEn = document.getElementById('manualTitleEn').value.trim();
    const doi = document.getElementById('manualDoi').value.trim();
    const authors = document.getElementById('manualAuthors').value.trim();
    const year = document.getElementById('manualYear').value.trim();
    const abstract = document.getElementById('manualAbstract').value.trim();
    
    if (!titleCn && !titleEn) {
        showToast('请至少输入中文或英文标题', 'error');
        return;
    }
    
    const paper = {
        titleCn,
        titleEn,
        doi,
        authors: authors ? authors.split(',').map(a => a.trim()) : [],
        year: year ? parseInt(year) : null,
        abstract
    };
    
    const result = LibraryStore.add(paper);
    
    if (result.success) {
        showToast('文献添加成功！', 'success');
        closeManualAddModal();
        loadLibrary();
        loadPaperSelect();
    } else {
        showToast(result.message, 'warning');
    }
}

// 删除文献
function deletePaper(id) {
    if (!confirm('确定要删除这篇文献吗？')) return;
    
    LibraryStore.remove(id);
    
    // 清理无关联标签
    const cleaned = TagsStore.cleanupOrphanTags();
    if (cleaned > 0) {
        showToast(`文献已删除，清理了 ${cleaned} 个无用标签`, 'success');
    } else {
        showToast('文献已删除', 'success');
    }
    
    loadLibrary();
}

// 复制AI提示词
function copyAiPrompt() {
    const promptText = document.getElementById('aiPromptText').textContent;
    navigator.clipboard.writeText(promptText).then(() => {
        showToast('AI提示词已复制到剪贴板', 'success');
    }).catch(err => {
        console.error('复制失败:', err);
        showToast('复制失败，请手动复制', 'error');
    });
}

// 打开卡片详情
function openCardDetail(cardId) {
    const card = PapersStore.getById(cardId);
    if (!card) {
        showToast('卡片不存在', 'error');
        return;
    }
    
    currentCardId = cardId;
    
    // 显示/隐藏返回按钮
    const backBtn = document.getElementById('backToFilesBtn');
    if (backBtn) {
        backBtn.style.display = document.body.dataset.fromFiles === 'true' ? 'inline-block' : 'none';
    }
    
    // 设置开关状态
    // 使用全局语言设置
    
    // 标题（驼峰命名字段）
    const title = (cardListLang === 'cn') ? card.titleCn : card.titleEn;
    document.getElementById('cardDetailTitle').textContent = title || '文献卡片';
    
    // 构建内容
    let html = '';
    
    // 元信息
    html += `
        <div class="card-meta">
            ${card.journal ? `<span>📖 ${escapeHtml(card.journal)}</span>` : ''}
            ${card.publishDate ? `<span>📅 ${escapeHtml(card.publishDate)}</span>` : ''}
            ${card.doi ? `<span>🔗 <a href="https://doi.org/${escapeHtml(card.doi)}" target="_blank" style="color:var(--primary);">${escapeHtml(card.doi)}</a></span>` : ''}
            ${card.category ? `<span>🏷️ ${escapeHtml(card.category)}</span>` : ''}
        </div>
    `;
    
    // 作者
    if (card.authors) {
        html += `
            <div class="card-section">
                <h4>👥 ${(cardListLang === 'cn') ? '作者' : 'Authors'}</h4>
                <p style="font-size:13px;">${escapeHtml(card.authors)}</p>
            </div>
        `;
    }
    
    // 摘要
    const abstract = (cardListLang === 'cn') ? card.abstractCn : card.abstractEn;
    if (abstract) {
        html += `
            <div class="card-section">
                <h4>📝 ${(cardListLang === 'cn') ? '摘要' : 'Abstract'}</h4>
                <p>${escapeHtml(abstract)}</p>
            </div>
        `;
    }
    
    // 关键词（支持中英文切换）
    const keywords = (cardListLang === 'cn') ? (card.keywordsCn?.length ? card.keywordsCn : card.keywords) : card.keywords;
    if (keywords?.length) {
        html += `
            <div class="card-section">
                <h4>🏷️ ${(cardListLang === 'cn') ? '关键词' : 'Keywords'}</h4>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    ${keywords.map(kw => `<span class="badge badge-primary">${escapeHtml(kw)}</span>`).join('')}
                </div>
            </div>
        `;
    }
    
    // 工作总结
    const summary = (cardListLang === 'cn') ? card.summaryCn : card.summaryEn;
    if (summary) {
        html += `
            <div class="card-section">
                <h4>💡 ${(cardListLang === 'cn') ? '工作总结' : 'Summary'}</h4>
                <p>${escapeHtml(summary)}</p>
            </div>
        `;
    }
    
    // 创新点
    const innovations = (cardListLang === 'cn') ? card.innovationCn : card.innovationEn;
    if (innovations) {
        const items = Array.isArray(innovations) ? innovations : [innovations];
        if (items.length && items[0]) {
            html += `
                <div class="card-section">
                    <h4>⭐ ${(cardListLang === 'cn') ? '创新点' : 'Innovation'}</h4>
                    <ul>
                        ${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    }
    
    // 应用领域
    const application = (cardListLang === 'cn') ? card.applicationCn : card.applicationEn;
    if (application) {
        html += `
            <div class="card-section">
                <h4>🎯 ${(cardListLang === 'cn') ? '应用领域' : 'Application'}</h4>
                <p>${escapeHtml(application)}</p>
            </div>
        `;
    }
    
    // 论证思路
    const structure = (cardListLang === 'cn') ? card.structureCn : card.structureEn;
    if (structure) {
        html += `
            <div class="card-section">
                <h4>📊 ${(cardListLang === 'cn') ? '论证思路' : 'Structure'}</h4>
                <p>${escapeHtml(structure)}</p>
            </div>
        `;
    }
    
    // 表征技术
    const methods = (cardListLang === 'cn') ? card.methodsCn : card.methodsEn;
    if (methods) {
        const methodItems = Array.isArray(methods) ? methods : methods.split(',').map(m => m.trim());
        if (methodItems.length && methodItems[0]) {
            html += `
                <div class="card-section">
                    <h4>🔬 ${(cardListLang === 'cn') ? '表征技术' : 'Methods'}</h4>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;">
                        ${methodItems.map(m => `<span class="badge" style="background:var(--bg);color:var(--text);">${escapeHtml(m)}</span>`).join('')}
                    </div>
                </div>
            `;
        }
    }
    
    // 学术词汇
    if (card.vocabulary?.length) {
        html += `
            <div class="card-section">
                <h4>📖 ${(cardListLang === 'cn') ? '学术词汇' : 'Vocabulary'} (${card.vocabulary.length})</h4>
                <div class="vocab-list">
                    ${card.vocabulary.map(v => {
                        const wordEn = v.en || v.word || '';
                        const wordCn = v.cn || v.word_cn || '';
                        const defCn = v.defCn || v.definition_cn || '';
                        const defEn = v.defEn || v.definition_en || '';
                        const ex = v.ex || v.example || '';
                        const def = (cardListLang === 'cn') ? defCn : defEn;
                        
                        // 格式化例句（标粗词汇）
                        let exFormatted = ex;
                        if (ex && ex.includes('**')) {
                            exFormatted = ex.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
                        } else if (ex && wordEn) {
                            const regex = new RegExp(`\\b(${wordEn})\\b`, 'gi');
                            exFormatted = ex.replace(regex, '<strong>$1</strong>');
                        }
                        
                        return `
                            <div class="vocab-item" style="flex-direction:column;align-items:flex-start;">
                                <div style="width:100%;display:flex;justify-content:space-between;align-items:center;">
                                    <div>
                                        <span class="word">${escapeHtml(wordEn)}</span>
                                        <span class="cn">${escapeHtml(wordCn)}</span>
                                    </div>
                                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); addVocabToStudy(JSON.stringify({en: wordEn, cn: wordCn, defCn: defCn, defEn: defEn, ex: ex}).replace(/"/g, '&quot;'))">📚 ${(cardListLang === 'cn') ? '加入学习' : 'Study'}</button>
                                </div>
                                ${def ? `<div class="def">${escapeHtml(def)}</div>` : ''}
                                ${ex ? `<div class="ex">${exFormatted}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    

    // 标签编辑
    const cardTags = (card.tagIds || []).map(id => TagsStore.getById(id)).filter(Boolean);
    html += `
        <div class="card-section">
            <h4>🏷️ ${(cardListLang === 'cn') ? '标签' : 'Tags'}</h4>
            <div id="cardTagsContainer" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
                ${cardTags.map(t => {
                    const name = (cardListLang === 'cn') ? (t.nameCn || t.nameEn) : (t.nameEn || t.nameCn);
                    return `<span class="badge badge-primary" style="cursor:pointer;" onclick="removeTagFromCard('${t.id}')">${escapeHtml(name)} ×</span>`;
                }).join('')}
            </div>
            <div style="display:flex;gap:8px;">
                <select id="tagSelect" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:6px;">
                    <option value="">${(cardListLang === 'cn') ? '选择标签...' : 'Select tag...'}</option>
                    ${TagsStore.getAll().map(t => {
                        const name = (cardListLang === 'cn') ? (t.nameCn || t.nameEn) : (t.nameEn || t.nameCn);
                        const selected = cardTags.some(ct => ct.id === t.id);
                        return selected ? '' : `<option value="${t.id}">${escapeHtml(name)}</option>`;
                    }).join('')}
                </select>
                <button class="btn btn-sm btn-primary" onclick="addTagToCard()" style="padding:8px 16px;border:none;border-radius:6px;background:var(--primary);color:white;cursor:pointer;">
                    ${(cardListLang === 'cn') ? '添加' : 'Add'}
                </button>
            </div>
        </div>
    `;

    // 分类管理
    const categories = CategoriesStore.getAll();
    const cardCategories = categories.filter(c => (c.itemIds || []).includes(card.id));
    html += `
        <div class="card-section">
            <h4>📂 ${(cardListLang === 'cn') ? '所属分类' : 'Categories'}</h4>
            <div id="cardCategoriesContainer" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
                ${cardCategories.map(c => `
                    <span class="badge" style="cursor:pointer;background:var(--bg);border:1px solid var(--border);" onclick="removeCardFromCategory('${c.id}')">
                        ${escapeHtml(c.name)} ×
                    </span>
                `).join('')}
            </div>
            <div style="display:flex;gap:8px;">
                <select id="categorySelect" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:6px;">
                    <option value="">${(cardListLang === 'cn') ? '选择分类...' : 'Select category...'}</option>
                    ${categories.filter(c => !(c.itemIds || []).includes(card.id)).map(c => `
                        <option value="${c.id}">${escapeHtml(c.name)}</option>
                    `).join('')}
                </select>
                <button class="btn btn-sm btn-secondary" onclick="addCardToCategory()" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--bg);cursor:pointer;">
                    ${(cardListLang === 'cn') ? '添加' : 'Add'}
                </button>
            </div>
        </div>
    `;

    document.getElementById('cardDetailBody').innerHTML = html;
    document.getElementById('cardDetailModal').classList.remove('hidden');
}

// 添加词汇到词汇本

// 打开文献库词条详情
function openLibraryDetail(libraryId) {
    const paper = LibraryStore.getById(libraryId);
    if (!paper) {
        showToast('文献库词条不存在', 'error');
        return;
    }
    
    currentLibraryId = libraryId;
    
    // 显示/隐藏返回按钮
    const backBtn = document.getElementById('backToFilesBtn');
    if (backBtn) {
        backBtn.style.display = document.body.dataset.fromFiles === 'true' ? 'inline-block' : 'none';
    }
    
    // 标题
    const title = (libraryLangCN) ? (paper.titleCn || paper.title || paper.titleEn) : (paper.titleEn || paper.title || paper.titleCn);
    document.getElementById('cardDetailTitle').textContent = title || '文献库词条';
    
    // 构建内容
    let html = '';
    
    // 元信息
    html += `
        <div class="card-meta">
            ${paper.journal ? `<span>📖 ${escapeHtml(paper.journal)}</span>` : ''}
            ${paper.publishDate ? `<span>📅 ${escapeHtml(paper.publishDate)}</span>` : ''}
            ${paper.doi ? `<span>🔗 <a href="https://doi.org/${escapeHtml(paper.doi)}" target="_blank" style="color:var(--primary);">${escapeHtml(paper.doi)}</a></span>` : ''}
        </div>
    `;
    
    // 作者
    if (paper.authors) {
        html += `
            <div class="card-section">
                <h4>👥 ${(libraryLangCN) ? '作者' : 'Authors'}</h4>
                <p style="font-size:13px;">${escapeHtml(paper.authors)}</p>
            </div>
        `;
    }
    
    // 摘要
    const abstract = (libraryLangCN) ? paper.abstractCn : paper.abstractEn;
    if (abstract) {
        html += `
            <div class="card-section">
                <h4>📝 ${(libraryLangCN) ? '摘要' : 'Abstract'}</h4>
                <p style="font-size:13px; line-height: 1.6;">${escapeHtml(abstract)}</p>
            </div>
        `;
    }
    
    // 关键词
    if (paper.keywords) {
        html += `
            <div class="card-section">
                <h4>🔑 ${(libraryLangCN) ? '关键词' : 'Keywords'}</h4>
                <p style="font-size:13px;">${escapeHtml(paper.keywords)}</p>
            </div>
        `;
    }
    
    // 标签
    const uniqueTagIds = [...new Set(paper.tagIds || [])];
    const tags = uniqueTagIds.map(id => TagsStore.getById(id)).filter(Boolean);
    if (tags.length > 0) {
        const seenTags = new Set();
        const tagHtml = tags.filter(t => {
            const key = t.nameCn || t.nameEn;
            if (seenTags.has(key)) return false;
            seenTags.add(key);
            return true;
        }).map(t => {
            const name = (libraryLangCN) ? (t.nameCn || t.nameEn) : (t.nameEn || t.nameCn);
            return `<span class="data-tag">${escapeHtml(name)}</span>`;
        }).join('');
        
        html += `
            <div class="card-section">
                <h4>🏷️ ${(libraryLangCN) ? '标签' : 'Tags'}</h4>
                <div>${tagHtml}</div>
            </div>
        `;
    }
    
    document.getElementById('cardDetailBody').innerHTML = html;
    document.getElementById('cardDetailModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}
function addVocabToStudy(vocabJson) {
    try {
        const vocab = JSON.parse(vocabJson);
        const result = VocabularyStore.add(vocab);
        if (result.success) {
            showToast(`已将 "${vocab.en}" 添加到词汇本`, 'success');
        } else {
            showToast(`"${vocab.en}" 已在词汇本中`, 'info');
        }
    } catch (e) {
        console.error('添加词汇失败:', e);
        showToast('添加词汇失败', 'error');
    }
}

// 关闭卡片详情
function closeCardDetailModal() {
    document.getElementById('cardDetailModal').classList.add('hidden');
    currentCardId = null;
}

// 返回文件管理页
function goBackToFiles() {
    closeCardDetail();
    window.location.href = 'files.html';
}

// 删除当前卡片
function deleteCurrentCard() {
    if (!currentCardId || !confirm('确定要删除这个卡片吗？')) return;
    
    PapersStore.remove(currentCardId);
    
    // 清理无关联标签
    TagsStore.cleanupOrphanTags();
    showToast('卡片已删除', 'success');
    closeCardDetailModal();
    loadCards();
}

// 处理粘贴的JSON数据导入
// 复制AI提示词
function copyAiPrompt() {
    const promptText = document.getElementById('aiPromptText').textContent;
    navigator.clipboard.writeText(promptText).then(() => {
        showToast('AI提示词已复制到剪贴板', 'success');
    }).catch(err => {
        console.error('复制失败:', err);
        showToast('复制失败，请手动复制', 'error');
    });
}

function handleJsonDataImport() {
    const textarea = document.getElementById('importJsonData');
    const jsonText = textarea.value.trim();
    
    if (!jsonText) {
        showToast('请先粘贴JSON数据', 'error');
        return;
    }
    
    try {
        const cardData = JSON.parse(jsonText);
        processAndSaveCard(cardData);
        textarea.value = ''; // 清空输入
    } catch (error) {
        console.error('JSON解析失败:', error);
        showToast('JSON格式错误：' + error.message, 'error');
    }
}

// 处理JSON卡片文件导入
async function handleCardFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const cardData = JSON.parse(text);
        processAndSaveCard(cardData);
        event.target.value = '';
    } catch (error) {
        console.error('导入失败:', error);
        showToast('导入失败：' + error.message, 'error');
        event.target.value = '';
    }
}

// 处理并保存卡片数据（被粘贴导入和文件导入共用）
function processAndSaveCard(cardData) {
    // 验证基本字段
    if (!cardData.title_cn && !cardData.title_en && !cardData.titleCn && !cardData.titleEn && !cardData.title) {
        showToast('JSON格式错误：缺少标题字段', 'error');
        return;
    }
    
    // 转换词汇格式以适配新的词汇本格式
    // 新格式: en, cn, defCn, defEn, ex (词汇在例句中标粗)
    const vocabulary = (cardData.vocabulary || []).map(v => {
        // 兼容多种可能的字段名
        const en = v.en || v.word || v.english || '';
        const cn = v.cn || v.word_cn || v.chinese || '';
        const defCn = v.defCn || v.definition_cn || v.definitionCn || v.cnDef || '';
        const defEn = v.defEn || v.definition_en || v.definitionEn || v.enDef || '';
        const ex = v.ex || v.example || v.exampleSentence || '';
        
        return {
            en: en,
            cn: cn,
            defCn: defCn,
            defEn: defEn,
            ex: ex,
            status: 'new',
            correct_count: 0,
            error_count: 0,
            correct_streak: 0
        };
    });
    
    // 构建卡片数据
    const card = {
        titleCn: cardData.title_cn || cardData.titleCn || '',
        titleEn: cardData.title_en || cardData.titleEn || '',
        authors: cardData.authors || '',
        journal: cardData.journal || '',
        publishDate: cardData.publish_date || cardData.publishDate || '',
        doi: cardData.doi || '',
        abstractCn: cardData.abstract_cn || cardData.abstractCn || '',
        abstractEn: cardData.abstract_en || cardData.abstractEn || '',
        keywords: cardData.keywords || [],
        keywordsCn: cardData.keywords_cn || cardData.keywordsCn || [],
        summaryCn: cardData.summary_cn || cardData.summaryCn || '',
        summaryEn: cardData.summary_en || cardData.summaryEn || '',
        innovationCn: cardData.innovation_cn || cardData.innovationCn || [],
        innovationEn: cardData.innovation_en || cardData.innovationEn || [],
        applicationCn: cardData.application_cn || cardData.applicationCn || '',
        applicationEn: cardData.application_en || cardData.applicationEn || '',
        structureCn: cardData.structure_cn || cardData.structureCn || '',
        structureEn: cardData.structure_en || cardData.structureEn || '',
        methodsCn: cardData.methods_cn || cardData.methodsCn || [],
        methodsEn: cardData.methods_en || cardData.methodsEn || [],
        category: cardData.category || '',
        vocabulary: vocabulary,
        sourcePaperId: null,
        sourceAbstract: cardData.abstract_cn || cardData.abstractCn || '',
        tagIds: []
    };
    
    // 保存卡片
    const result = PapersStore.add(card);
    card.id = result.id;
    
    // 同时添加词汇到词汇本
    if (vocabulary.length > 0) {
        vocabulary.forEach(v => {
            VocabularyStore.add(v);
        });
        showToast(`卡片导入成功！已将 ${vocabulary.length} 个词汇添加到词汇本`, 'success');
    } else {
        showToast('卡片导入成功！', 'success');
    }
    
    
    // 自动创建标签
    autoCreateTagsForCard(card, cardData);
    
// 自动创建摘要翻译练习卡片（如果有英文摘要）
    if (cardData.abstract_cn || cardData.abstract_en || cardData.abstractCn || cardData.abstractEn) {
        const transCard = {
            paperId: card.id,
            titleEn: cardData.title_en || cardData.titleEn || '',
            titleCn: cardData.title_cn || cardData.titleCn || '',
            abstractEn: cardData.abstract_en || cardData.abstractEn || '',
            abstractCn: cardData.abstract_cn || cardData.abstractCn || '',
            keywords: cardData.keywords || [],
            keywordsCn: cardData.keywordsCn || cardData.keywords_cn || cardData.keywordsCn || [],
            translated: false,
            userTranslation: null,
            aiComment: null,
            addedAt: Date.now(),
            translatedAt: null
        };
        AbstractTranslationStore.add(transCard);
    }
    
    // 重新加载卡片列表
    loadCards();
}


// 自动创建标签并关联到卡片
function autoCreateTagsForCard(card, cardData) {
    // 确保分类已初始化
    CategoriesStore.initPresetCategories();
    
    const tagIds = [];
    const categories = CategoriesStore.getAll();
    
    // 找到预置分类
    const unnamedCategory = categories.find(c => c.name === '未命名');
    const methodCategory = categories.find(c => c.name === '表征技术');
    
    // 处理关键词标签（加入"未命名"分类）
    const keywords = cardData.keywords || [];
    const keywordsCn = cardData.keywords_cn || cardData.keywordsCn || [];
    
    // 合并中英文关键词
    for (let i = 0; i < Math.max(keywords.length, keywordsCn.length); i++) {
        const nameEn = keywords[i] || '';
        const nameCn = keywordsCn[i] || '';
        
        if (nameEn || nameCn) {
            const result = TagsStore.addOrGet({
                nameCn: nameCn,
                nameEn: nameEn,
                source: 'keyword',
                categoryIds: unnamedCategory ? [unnamedCategory.id] : []
            });
            
            if (result.success && result.tag) {
                tagIds.push(result.tag.id);
                
                // 如果标签已存在但没有加入未命名分类，则加入
                if (unnamedCategory && result.tag.categoryIds && !result.tag.categoryIds.includes(unnamedCategory.id)) {
                    TagsStore.addToCategory(result.tag.id, unnamedCategory.id);
                }
            }
        }
    }
    
    // 处理表征技术标签（加入"表征技术"分类）
    const methodsCn = cardData.methods_cn || cardData.methodsCn || [];
    const methodsEn = cardData.methods_en || cardData.methodsEn || [];
    
    // 合并中英文表征技术
    for (let i = 0; i < Math.max(methodsCn.length, methodsEn.length); i++) {
        const nameCn = methodsCn[i] || '';
        const nameEn = methodsEn[i] || '';
        
        if (nameEn || nameCn) {
            const result = TagsStore.addOrGet({
                nameCn: nameCn,
                nameEn: nameEn,
                source: 'method',
                categoryIds: methodCategory ? [methodCategory.id] : []
            });
            
            if (result.success && result.tag) {
                tagIds.push(result.tag.id);
                
                // 如果标签已存在但没有加入表征技术分类，则加入
                if (methodCategory && result.tag.categoryIds && !result.tag.categoryIds.includes(methodCategory.id)) {
                    TagsStore.addToCategory(result.tag.id, methodCategory.id);
                }
            }
        }
    }
    
    // 更新卡片的 tagIds
    if (tagIds.length > 0 && card.id) {
        PapersStore.update(card.id, { tagIds: tagIds.slice(0, 20) });
    }
    
    return tagIds;
}


// 添加标签到卡片
function addTagToCard() {
    if (!currentCardId) return;
    
    const select = document.getElementById('tagSelect');
    const tagId = select.value;
    if (!tagId) {
        showToast((cardListLang === 'cn') ? '请选择标签' : 'Please select a tag', 'error');
        return;
    }
    
    const card = PapersStore.getById(currentCardId);
    if (!card) return;
    
    const tagIds = card.tagIds || [];
    if (tagIds.length >= 20) {
        showToast((cardListLang === 'cn') ? '最多添加20个标签' : 'Maximum 20 tags', 'error');
        return;
    }
    
    if (tagIds.includes(tagId)) {
        showToast((cardListLang === 'cn') ? '标签已存在' : 'Tag already exists', 'warning');
        return;
    }
    
    tagIds.push(tagId);
    PapersStore.update(currentCardId, { tagIds });
    openCardDetail(currentCardId); // 刷新详情
    showToast((cardListLang === 'cn') ? '标签已添加' : 'Tag added', 'success');
}

// 从卡片移除标签
function removeTagFromCard(tagId) {
    if (!currentCardId) return;
    
    const card = PapersStore.getById(currentCardId);
    if (!card) return;
    
    const tagIds = (card.tagIds || []).filter(id => id !== tagId);
    PapersStore.update(currentCardId, { tagIds });
    openCardDetail(currentCardId); // 刷新详情
    showToast((cardListLang === 'cn') ? '标签已移除' : 'Tag removed', 'success');
}


// 添加卡片到分类
function addCardToCategory() {
    if (!currentCardId) return;
    
    const select = document.getElementById('categorySelect');
    const categoryId = select.value;
    if (!categoryId) {
        showToast((cardListLang === 'cn') ? '请选择分类' : 'Please select a category', 'error');
        return;
    }
    
    CategoriesStore.addItem(categoryId, currentCardId);
    openCardDetail(currentCardId); // 刷新详情
    showToast((cardListLang === 'cn') ? '已添加到分类' : 'Added to category', 'success');
}

// 从分类移除卡片
function removeCardFromCategory(categoryId) {
    if (!currentCardId) return;
    
    CategoriesStore.removeItem(categoryId, currentCardId);
    openCardDetail(currentCardId); // 刷新详情
    showToast((cardListLang === 'cn') ? '已从分类移除' : 'Removed from category', 'success');
}

