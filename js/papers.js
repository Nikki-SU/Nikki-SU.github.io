/**
 * papers.js - 文献库和文献卡片逻辑
 */

// 状态
let currentTab = 'library';
let currentCardId = null;

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadLibrary();
    loadCards();
    loadPaperSelect();
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
    
    // 筛选
    document.getElementById('libraryFilter')?.addEventListener('change', loadLibrary);
    document.getElementById('librarySearch')?.addEventListener('input', debounce(loadLibrary, 300));
    
    // 生成卡片
    document.getElementById('generateCardBtn')?.addEventListener('click', generateCard);
    
    // 导入JSON卡片
    document.getElementById('importCardBtn')?.addEventListener('click', () => {
        document.getElementById('cardFileInput')?.click();
    });
    document.getElementById('cardFileInput')?.addEventListener('change', handleCardFileImport);
    
    // 粘贴JSON数据导入
    document.getElementById('importJsonBtn')?.addEventListener('click', handleJsonDataImport);
    
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

// 加载文献库
function loadLibrary() {
    const container = document.getElementById('libraryList');
    let papers = LibraryStore.getAll();
    
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
    
    container.innerHTML = papers.map(paper => `
        <div class="paper-card" data-id="${paper.id}">
            <div class="paper-card-title">${escapeHtml(paper.title || paper.titleCn || '无标题')}</div>
            ${paper.titleEn ? `<div class="text-muted" style="font-size: 0.9rem; margin-bottom: 8px;">${escapeHtml(paper.titleEn)}</div>` : ''}
            <div class="paper-card-meta">
                ${paper.authors ? `<span>${escapeHtml(paper.authors.join(', '))}</span>` : ''}
                ${paper.year ? `<span> · ${paper.year}</span>` : ''}
                ${paper.doi ? `<span> · DOI: ${escapeHtml(paper.doi)}</span>` : ''}
                <span class="badge badge-secondary" style="margin-left: 8px;">${formatDate(paper.addedAt)}</span>
            </div>
            <div class="paper-card-actions">
                ${paper.doi ? `<a href="https://doi.org/${paper.doi}" target="_blank" class="btn btn-sm btn-outline">🔗 原文</a>` : ''}
                <button class="btn btn-sm btn-primary" onclick="createCardFromPaper('${paper.id}')">🃏 生成卡片</button>
                <button class="btn btn-sm btn-danger" onclick="deletePaper('${paper.id}')">🗑️ 删除</button>
            </div>
        </div>
    `).join('');
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
    
    container.innerHTML = cards.map(card => `
        <div class="card" onclick="openCardDetail('${card.id}')" style="cursor: pointer;">
            <div style="font-weight: 600; margin-bottom: 8px;">
                ${escapeHtml(card.title || '文献卡片')}
            </div>
            ${card.summary ? `<p class="text-muted" style="font-size: 0.9rem; margin-bottom: 12px;">${escapeHtml(card.summary.substring(0, 100))}...</p>` : ''}
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
                ${(card.keywords || []).slice(0, 3).map(kw => `<span class="badge badge-primary">${escapeHtml(kw)}</span>`).join('')}
            </div>
            <div class="text-muted" style="font-size: 0.8rem;">
                ${card.vocabulary?.length || 0} 个词汇 · ${formatDate(card.createdAt)}
            </div>
        </div>
    `).join('');
}

// 加载论文选择器
function loadPaperSelect() {
    const select = document.getElementById('paperSelect');
    const papers = LibraryStore.getAll();
    
    select.innerHTML = '<option value="">-- 选择文献 --</option>' +
        papers.map(p => `
            <option value="${p.id}">${escapeHtml(p.title || p.titleCn || '无标题')}</option>
        `).join('');
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
            loadPaperSelect();
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
    showToast('文献已删除', 'success');
    loadLibrary();
    loadPaperSelect();
}

// 从文献创建卡片
function createCardFromPaper(paperId) {
    const paper = LibraryStore.getAll().find(p => p.id === paperId);
    if (!paper) {
        showToast('文献不存在', 'error');
        return;
    }
    
    // 预填充摘要
    document.getElementById('paperSelect').value = paperId;
    document.getElementById('customAbstract').value = paper.abstract || paper.titleEn || paper.titleCn || '';
    
    // 切换到卡片Tab
    switchTab('cards');
    
    showToast('已加载文献信息，填写摘要后点击生成卡片', 'info');
}

// 生成卡片（AI或手动）
async function generateCard() {
    const paperSelect = document.getElementById('paperSelect');
    const customAbstract = document.getElementById('customAbstract').value.trim();
    
    const paperId = paperSelect.value;
    const paper = paperId ? LibraryStore.getAll().find(p => p.id === paperId) : null;
    const abstract = customAbstract || paper?.abstract || '';
    
    if (!abstract) {
        showToast('请提供摘要内容', 'error');
        return;
    }
    
    const settings = GlobalSettings.get();
    
    if (!settings.apiKey) {
        // 没有API，使用简单解析
        showToast('未配置API，使用基础解析模式', 'info');
        createSimpleCard(paper, abstract);
        return;
    }
    
    // 显示加载状态
    const btn = document.getElementById('generateCardBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> AI解析中...';
    btn.disabled = true;
    
    try {
        const card = await callAIForCard(abstract, settings);
        saveCard(card, paper);
    } catch (error) {
        console.error('AI解析失败:', error);
        showToast('AI解析失败，使用基础模式', 'warning');
        createSimpleCard(paper, abstract);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// 调用AI生成卡片
async function callAIForCard(abstract, settings) {
    const prompt = `请分析以下学术论文摘要，提取关键信息并生成简洁的文献卡片格式。

摘要内容：
${abstract}

请以JSON格式返回，包含以下字段：
- title: 论文标题（中文或英文）
- summary: 简明摘要（100字以内）
- keywords: 关键词数组（3-5个）
- vocabulary: 学术词汇数组，每个词汇包含：
  - word: 英文词汇
  - word_cn: 中文翻译
  - definition_cn: 中文释义
  - definition_en: 英文释义（可选）
  - example: 例句（可选，使用**词汇**标记）
- keyPoints: 关键要点数组（2-3个）

只返回JSON，不要有其他内容。`;

    let apiUrl, requestBody;
    
    switch (settings.apiProvider) {
        case 'siliconflow':
            apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
            requestBody = {
                model: settings.model || 'Qwen/Qwen2.5-7B-Instruct',
                messages: [{ role: 'user', content: prompt }],
                stream: false
            };
            break;
        case 'deepseek':
            apiUrl = 'https://api.deepseek.com/v1/chat/completions';
            requestBody = {
                model: settings.model || 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                stream: false
            };
            break;
        case 'qwen':
            apiUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
            requestBody = {
                model: settings.model || 'qwen-plus',
                messages: [{ role: 'user', content: prompt }],
                stream: false
            };
            break;
        default:
            throw new Error('不支持的API提供商');
    }
    
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || 'API调用失败');
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // 解析JSON响应
    let card;
    try {
        // 尝试提取JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            card = JSON.parse(jsonMatch[0]);
        } else {
            throw new Error('无法解析响应');
        }
    } catch (e) {
        console.error('解析失败:', e);
        throw e;
    }
    
    return card;
}

// 创建简单卡片（无API）
function createSimpleCard(paper, abstract) {
    // 简单提取关键词
    const commonWords = ['perovskite', 'solar', 'cell', 'efficiency', 'material', 'device', 'layer', 'film', 'interface', 'transport'];
    const words = abstract.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const wordCounts = {};
    words.forEach(w => {
        if (!commonWords.includes(w)) {
            wordCounts[w] = (wordCounts[w] || 0) + 1;
        }
    });
    const keywords = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);
    
    const card = {
        title: paper?.title || paper?.titleCn || '文献卡片',
        summary: abstract.substring(0, 200) + (abstract.length > 200 ? '...' : ''),
        keywords,
        vocabulary: keywords.map(w => ({
            word: w,
            word_cn: '（待查）',
            definition_cn: '（待查）'
        })),
        keyPoints: ['从摘要中提取的关键词已生成词汇卡片']
    };
    
    saveCard(card, paper);
}

// 保存卡片
function saveCard(card, paper) {
    const cardData = {
        title: card.title,
        summary: card.summary,
        keywords: card.keywords || [],
        vocabulary: (card.vocabulary || []).map(v => ({
            ...v,
            status: 'new',
            correct_count: 0,
            error_count: 0,
            correct_streak: 0
        })),
        keyPoints: card.keyPoints || [],
        sourcePaperId: paper?.id || null,
        sourceAbstract: paper?.abstract || null
    };
    
    PapersStore.add(cardData);
    
    // 同时添加词汇到词汇本
    if (cardData.vocabulary.length > 0) {
        cardData.vocabulary.forEach(v => {
            VocabularyStore.add(v);
        });
        showToast(`卡片创建成功！已将 ${cardData.vocabulary.length} 个词汇添加到词汇本`, 'success');
    } else {
        showToast('卡片创建成功！', 'success');
    }
    
    // 清空表单
    document.getElementById('paperSelect').value = '';
    document.getElementById('customAbstract').value = '';
    
    // 重新加载卡片列表
    loadCards();
}

// 打开卡片详情
let cardLangCN = true; // 默认显示中文

function toggleCardLang() {
    cardLangCN = document.getElementById('cardLangSwitch').checked;
    if (currentCardId) {
        openCardDetail(currentCardId);
    }
}

function openCardDetail(cardId) {
    const card = PapersStore.getById(cardId);
    if (!card) {
        showToast('卡片不存在', 'error');
        return;
    }
    
    currentCardId = cardId;
    
    // 设置开关状态
    document.getElementById('cardLangSwitch').checked = cardLangCN;
    
    // 标题（驼峰命名字段）
    const title = cardLangCN ? (card.titleCn || card.title) : card.title;
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
                <h4>👥 ${cardLangCN ? '作者' : 'Authors'}</h4>
                <p style="font-size:13px;">${escapeHtml(card.authors)}</p>
            </div>
        `;
    }
    
    // 摘要
    const abstract = cardLangCN ? (card.abstractCn || card.abstract) : card.abstract;
    if (abstract) {
        html += `
            <div class="card-section">
                <h4>📝 ${cardLangCN ? '摘要' : 'Abstract'}</h4>
                <p>${escapeHtml(abstract)}</p>
            </div>
        `;
    }
    
    // 关键词
    if (card.keywords?.length) {
        html += `
            <div class="card-section">
                <h4>🏷️ ${cardLangCN ? '关键词' : 'Keywords'}</h4>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    ${card.keywords.map(kw => `<span class="badge badge-primary">${escapeHtml(kw)}</span>`).join('')}
                </div>
            </div>
        `;
    }
    
    // 工作总结
    const summary = cardLangCN ? (card.summaryCn || card.summary) : card.summary;
    if (summary) {
        html += `
            <div class="card-section">
                <h4>💡 ${cardLangCN ? '工作总结' : 'Summary'}</h4>
                <p>${escapeHtml(summary)}</p>
            </div>
        `;
    }
    
    // 创新点
    const innovations = cardLangCN ? (card.innovationCn || card.innovation) : card.innovation;
    if (innovations) {
        const items = Array.isArray(innovations) ? innovations : [innovations];
        if (items.length && items[0]) {
            html += `
                <div class="card-section">
                    <h4>⭐ ${cardLangCN ? '创新点' : 'Innovation'}</h4>
                    <ul>
                        ${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    }
    
    // 应用领域
    const application = cardLangCN ? (card.applicationCn || card.application) : card.application;
    if (application) {
        html += `
            <div class="card-section">
                <h4>🎯 ${cardLangCN ? '应用领域' : 'Application'}</h4>
                <p>${escapeHtml(application)}</p>
            </div>
        `;
    }
    
    // 论证思路
    const structure = cardLangCN ? (card.structureCn || card.structure) : card.structure;
    if (structure) {
        html += `
            <div class="card-section">
                <h4>📊 ${cardLangCN ? '论证思路' : 'Structure'}</h4>
                <p>${escapeHtml(structure)}</p>
            </div>
        `;
    }
    
    // 表征技术
    const methods = cardLangCN ? (card.methodsCn || card.methods) : card.methods;
    if (methods) {
        const methodItems = Array.isArray(methods) ? methods : methods.split(',').map(m => m.trim());
        if (methodItems.length && methodItems[0]) {
            html += `
                <div class="card-section">
                    <h4>🔬 ${cardLangCN ? '表征技术' : 'Methods'}</h4>
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
                <h4>📖 ${cardLangCN ? '学术词汇' : 'Vocabulary'} (${card.vocabulary.length})</h4>
                <div class="vocab-list">
                    ${card.vocabulary.map(v => {
                        const wordEn = v.en || v.word || '';
                        const wordCn = v.cn || v.word_cn || '';
                        const defCn = v.defCn || v.definition_cn || '';
                        const defEn = v.defEn || v.definition_en || '';
                        const ex = v.ex || v.example || '';
                        const def = cardLangCN ? defCn : defEn;
                        
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
                                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); addVocabToStudy('${wordEn.replace(/'/g, "\\'")}')">📚 ${cardLangCN ? '加入学习' : 'Study'}</button>
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
    
    document.getElementById('cardDetailBody').innerHTML = html;
    document.getElementById('cardDetailModal').classList.remove('hidden');
}

// 添加词汇到学习
function addVocabToStudy(word) {
    showToast(`已将 "${word}" 添加到学习队列`, 'success');
}

// 关闭卡片详情
function closeCardDetailModal() {
    document.getElementById('cardDetailModal').classList.add('hidden');
    currentCardId = null;
}

// 删除当前卡片
function deleteCurrentCard() {
    if (!currentCardId || !confirm('确定要删除这个卡片吗？')) return;
    
    PapersStore.remove(currentCardId);
    showToast('卡片已删除', 'success');
    closeCardDetailModal();
    loadCards();
}

// 处理粘贴的JSON数据导入
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
    if (!cardData.title) {
        showToast('JSON格式错误：缺少title字段', 'error');
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
        title: cardData.title,
        titleCn: cardData.title_cn || cardData.titleCn || '',
        authors: cardData.authors || '',
        journal: cardData.journal || '',
        publishDate: cardData.publish_date || cardData.publishDate || '',
        doi: cardData.doi || '',
        abstract: cardData.abstract || '',
        abstractCn: cardData.abstract_cn || cardData.abstractCn || '',
        keywords: cardData.keywords || [],
        summary: cardData.summary || '',
        summaryCn: cardData.summary_cn || cardData.summaryCn || '',
        innovation: cardData.innovation || [],
        innovationCn: cardData.innovation_cn || cardData.innovationCn || '',
        application: cardData.application || '',
        applicationCn: cardData.application_cn || cardData.applicationCn || '',
        structure: cardData.structure || '',
        structureCn: cardData.structure_cn || cardData.structureCn || '',
        methods: cardData.methods || [],
        methodsCn: cardData.methods_cn || cardData.methodsCn || [],
        category: cardData.category || '',
        vocabulary: vocabulary,
        sourcePaperId: null,
        sourceAbstract: cardData.abstract || ''
    };
    
    // 保存卡片
    PapersStore.add(card);
    
    // 同时添加词汇到词汇本
    if (vocabulary.length > 0) {
        vocabulary.forEach(v => {
            VocabularyStore.add(v);
        });
        showToast(`卡片导入成功！已将 ${vocabulary.length} 个词汇添加到词汇本`, 'success');
    } else {
        showToast('卡片导入成功！', 'success');
    }
    
    // 重新加载卡片列表
    loadCards();
}
