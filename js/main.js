/**
 * main.js - 全局公共函数
 */

// Toast通知
let toastContainer = null;

function showToast(message, type = 'info', duration = 3000) {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// 工具函数
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    if (!text) return '';
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

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

function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 数据存储
const Storage = {
    get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (e) {
            console.error('Storage get error:', e);
            return defaultValue;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },
    
    remove(key) {
        localStorage.removeItem(key);
    }
};

// 文献库数据
const LibraryStore = {
    key: 'libraryPapers',
    
    getAll() {
        return Storage.get(this.key, []);
    },
    
    add(paper) {
        const papers = this.getAll();
        const exists = papers.find(p => p.doi === paper.doi);
        if (exists) {
            return { success: false, message: '文献已存在' };
        }
        papers.unshift({
            id: Date.now().toString(),
            ...paper,
            addedAt: new Date().toISOString()
        });
        Storage.set(this.key, papers);
        return { success: true, message: '添加成功' };
    },
    
    remove(id) {
        const papers = this.getAll();
        const filtered = papers.filter(p => p.id !== id);
        Storage.set(this.key, filtered);
    },
    
    clear() {
        Storage.remove(this.key);
    }
};

// 文献卡片数据
const PapersStore = {
    key: 'papersData',
    
    getAll() {
        return Storage.get(this.key, []);
    },
    
    getById(id) {
        const papers = this.getAll();
        return papers.find(p => p.id === id);
    },
    
    add(card) {
        const cards = this.getAll();
        cards.unshift({
            id: Date.now().toString(),
            ...card,
            createdAt: new Date().toISOString()
        });
        Storage.set(this.key, cards);
        return { success: true, id: cards[0].id };
    },
    
    update(id, data) {
        const cards = this.getAll();
        const index = cards.findIndex(p => p.id === id);
        if (index !== -1) {
            cards[index] = { ...cards[index], ...data, updatedAt: new Date().toISOString() };
            Storage.set(this.key, cards);
            return true;
        }
        return false;
    },
    
    remove(id) {
        const cards = this.getAll();
        const filtered = cards.filter(p => p.id !== id);
        Storage.set(this.key, filtered);
    }
};

// 词汇本数据
const VocabularyStore = {
    key: 'vocabularyData',
    
    getAll() {
        return Storage.get(this.key, []);
    },
    
    // 同步添加（不翻译）
    add(word) {
        const words = this.getAll();
        // 统一转换为新格式：en, cn, defCn, defEn, ex
        const en = (word.en || word.word || word.english || '').toLowerCase();
        const cn = word.cn || word.word_cn || word.chinese || '';
        const defCn = word.defCn || word.definition_cn || word.definitionCn || '';
        const defEn = word.defEn || word.definition_en || word.definitionEn || '';
        const ex = word.ex || word.example || word.exampleSentence || '';
        
        // 检查重复
        const exists = words.find(w => {
            const existingEn = (w.en || w.word || '').toLowerCase();
            return existingEn === en;
        });
        if (exists) {
            return { success: false, message: '词汇已存在' };
        }
        
        // 只保存新格式字段
        words.unshift({
            id: Date.now().toString(),
            en: en,
            cn: cn,
            defCn: defCn,
            defEn: defEn,
            ex: ex,
            status: 'new',
            streak: 0,
            wrongCount: 0,
            category: word.category || 'custom',
            addedAt: new Date().toISOString()
        });
        Storage.set(this.key, words);
        return { success: true };
    },
    
    // 异步添加（自动翻译缺失字段）
    async addWithTranslation(word, onProgress) {
        const words = this.getAll();
        const en = (word.en || word.word || word.english || '').toLowerCase();
        
        // 检查重复
        const exists = words.find(w => {
            const existingEn = (w.en || w.word || '').toLowerCase();
            return existingEn === en;
        });
        if (exists) {
            return { success: false, message: '词汇已存在' };
        }
        
        // 获取现有字段或为空
        let cn = word.cn || word.word_cn || word.chinese || '';
        let defCn = word.defCn || word.definition_cn || word.definitionCn || '';
        let defEn = word.defEn || word.definition_en || word.definitionEn || '';
        const ex = word.ex || word.example || word.exampleSentence || '';
        
        // 翻译缺失字段
        const tasks = [];
        
        if (!cn && en) {
            tasks.push({ field: 'cn', type: 'cn', text: en });
        }
        if (!defCn && en) {
            tasks.push({ field: 'defCn', type: 'defCn', text: en });
        }
        if (!defEn && en) {
            tasks.push({ field: 'defEn', type: 'defEn', text: en });
        }
        
        // 执行翻译
        for (const task of tasks) {
            if (onProgress) onProgress(`正在翻译 ${task.field}...`);
            const result = await translateField(task.text, task.type);
            if (result) {
                if (task.field === 'cn') cn = result;
                else if (task.field === 'defCn') defCn = result;
                else if (task.field === 'defEn') defEn = result;
            }
        }
        
        // 保存词汇
        words.unshift({
            id: Date.now().toString(),
            en: en,
            cn: cn,
            defCn: defCn,
            defEn: defEn,
            ex: ex,
            status: 'new',
            streak: 0,
            wrongCount: 0,
            category: word.category || 'custom',
            addedAt: new Date().toISOString()
        });
        Storage.set(this.key, words);
        return { success: true };
    },
    
    // 翻译补全现有词汇
    async translateMissingFields(onProgress) {
        const words = this.getAll();
        let updated = 0;
        
        for (const word of words) {
            let modified = false;
            
            if (!word.cn && word.en) {
                if (onProgress) onProgress(`翻译: ${word.en}`);
                const result = await translateField(word.en, 'cn');
                if (result) { word.cn = result; modified = true; }
            }
            if (!word.defCn && word.en) {
                const result = await translateField(word.en, 'defCn');
                if (result) { word.defCn = result; modified = true; }
            }
            if (!word.defEn && word.en) {
                const result = await translateField(word.en, 'defEn');
                if (result) { word.defEn = result; modified = true; }
            }
            
            if (modified) {
                updated++;
                // 每更新5个保存一次
                if (updated % 5 === 0) {
                    Storage.set(this.key, words);
                }
            }
        }
        
        Storage.set(this.key, words);
        return updated;
    },
    
    update(id, data) {
        const words = this.getAll();
        const index = words.findIndex(w => w.id === id);
        if (index !== -1) {
            words[index] = { ...words[index], ...data };
            Storage.set(this.key, words);
            return true;
        }
        return false;
    },
    
    remove(id) {
        const words = this.getAll();
        const filtered = words.filter(w => w.id !== id);
        Storage.set(this.key, filtered);
    }
};



// 分类数据
const CategoriesStore = {
    key: 'categoriesData',
    
    getAll() {
        return Storage.get(this.key, []);
    },
    
    getById(id) {
        const categories = this.getAll();
        return categories.find(c => c.id === id);
    },
    
    getByName(name) {
        const categories = this.getAll();
        return categories.find(c => c.name === name);
    },
    
    add(category) {
        const categories = this.getAll();
        const newCategory = {
            id: 'cat_' + Date.now(),
            name: category.name,
            itemIds: [],
            createdAt: new Date().toISOString()
        };
        categories.push(newCategory);
        Storage.set(this.key, categories);
        return { success: true, category: newCategory };
    },
    
    // 添加数据到分类
    addItem(categoryId, itemId) {
        const categories = this.getAll();
        const category = categories.find(c => c.id === categoryId);
        if (category) {
            if (!category.itemIds) category.itemIds = [];
            if (!category.itemIds.includes(itemId)) {
                category.itemIds.push(itemId);
                Storage.set(this.key, categories);
            }
            return { success: true };
        }
        return { success: false, message: '分类不存在' };
    },
    
    // 从分类移除数据
    removeItem(categoryId, itemId) {
        const categories = this.getAll();
        const category = categories.find(c => c.id === categoryId);
        if (category && category.itemIds) {
            category.itemIds = category.itemIds.filter(id => id !== itemId);
            Storage.set(this.key, categories);
            return { success: true };
        }
        return { success: false };
    },
    
    // 获取分类下的直接关联数据
    getItems(categoryId) {
        const category = this.getById(categoryId);
        if (!category || !category.itemIds) return [];
        
        const papers = PapersStore.getAll().filter(p => category.itemIds.includes(p.id));
        const library = LibraryStore.getAll().filter(p => category.itemIds.includes(p.id));
        return { papers, library };
    },
    
    update(id, data) {
        const categories = this.getAll();
        const index = categories.findIndex(c => c.id === id);
        if (index !== -1) {
            categories[index] = { ...categories[index], ...data };
            Storage.set(this.key, categories);
            return true;
        }
        return false;
    },
    
    remove(id) {
        const categories = this.getAll();
        const filtered = categories.filter(c => c.id !== id);
        Storage.set(this.key, filtered);
    },
    
    initPresetCategories() {
        const categories = this.getAll();
        if (categories.length === 0) {
            this.add({ name: '表征技术' });
            this.add({ name: '未命名' });
        }
    }
};

// 标签数据
const TagsStore = {
    key: 'tagsData',
    
    getAll() {
        return Storage.get(this.key, []);
    },
    
    getById(id) {
        const tags = this.getAll();
        return tags.find(t => t.id === id);
    },
    
    findByName(nameCn, nameEn) {
        const tags = this.getAll();
        return tags.find(t => {
            const tNameCn = t.nameCn || t.name_cn || '';
            const tNameEn = t.nameEn || t.name_en || '';
            const searchCn = nameCn || '';
            const searchEn = nameEn || '';
            return tNameCn === searchCn || tNameEn === searchEn ||
                   tNameEn === searchCn || tNameCn === searchEn;
        });
    },
    
    add(tag) {
        const tags = this.getAll();
        const exists = this.findByName(tag.nameCn, tag.nameEn);
        if (exists) {
            return { success: false, message: '标签已存在', tag: exists };
        }
        
        const newTag = {
            id: 'tag_' + Date.now(),
            nameCn: tag.nameCn || tag.name_cn || '',
            nameEn: tag.nameEn || tag.name_en || '',
            source: tag.source || 'custom',
            categoryIds: tag.categoryIds || [],
            createdAt: new Date().toISOString()
        };
        tags.push(newTag);
        Storage.set(this.key, tags);
        return { success: true, tag: newTag };
    },
    
    addOrGet(tag) {
        const exists = this.findByName(tag.nameCn, tag.nameEn);
        if (exists) {
            return { success: true, tag: exists, isNew: false };
        }
        return { ...this.add(tag), isNew: true };
    },
    
    update(id, data) {
        const tags = this.getAll();
        const index = tags.findIndex(t => t.id === id);
        if (index !== -1) {
            const updateData = {
                ...data,
                nameCn: data.nameCn || data.name_cn,
                nameEn: data.nameEn || data.name_en
            };
            tags[index] = { ...tags[index], ...updateData };
            Storage.set(this.key, tags);
            return true;
        }
        return false;
    },
    
    remove(id) {
        const tags = this.getAll();
        const filtered = tags.filter(t => t.id !== id);
        Storage.set(this.key, filtered);
        this.removeFromAllData(id);
    },
    
    removeFromAllData(tagId) {
        const papers = PapersStore.getAll();
        papers.forEach(paper => {
            if (paper.tagIds && paper.tagIds.includes(tagId)) {
                paper.tagIds = paper.tagIds.filter(id => id !== tagId);
            }
        });
        Storage.set(PapersStore.key, papers);
        
        const library = LibraryStore.getAll();
        library.forEach(paper => {
            if (paper.tagIds && paper.tagIds.includes(tagId)) {
                paper.tagIds = paper.tagIds.filter(id => id !== tagId);
            }
        });
        Storage.set(LibraryStore.key, library);
    },
    
    addToCategory(tagId, categoryId) {
        const tags = this.getAll();
        const tag = tags.find(t => t.id === tagId);
        if (tag) {
            if (!tag.categoryIds) tag.categoryIds = [];
            if (tag.categoryIds.length >= 5) {
                return { success: false, message: '标签最多属于5个分类' };
            }
            if (!tag.categoryIds.includes(categoryId)) {
                tag.categoryIds.push(categoryId);
                Storage.set(this.key, tags);
            }
            return { success: true };
        }
        return { success: false, message: '标签不存在' };
    },
    
    getByCategory(categoryId) {
        const tags = this.getAll();
        return tags.filter(t => t.categoryIds && t.categoryIds.includes(categoryId));
    },
    
    getUncategorized() {
        const tags = this.getAll();
        return tags.filter(t => !t.categoryIds || t.categoryIds.length === 0);
    },
    
    // 清理无关联标签
    cleanupOrphanTags() {
        const tags = this.getAll();
        const orphanTags = [];
        
        tags.forEach(tag => {
            // 检查是否有文献卡片关联
            const papersWithTag = PapersStore.getAll().filter(p => 
                p.tagIds && p.tagIds.includes(tag.id)
            );
            
            // 检查是否有文献库词条关联
            const libraryWithTag = LibraryStore.getAll().filter(p => 
                p.tagIds && p.tagIds.includes(tag.id)
            );
            
            // 如果没有任何数据关联，标记为孤儿标签
            if (papersWithTag.length === 0 && libraryWithTag.length === 0) {
                orphanTags.push(tag.id);
            }
        });
        
        // 删除孤儿标签
        if (orphanTags.length > 0) {
            const remainingTags = tags.filter(t => !orphanTags.includes(t.id));
            Storage.set(this.key, remainingTags);
        }
        
        return orphanTags.length;
    }
};

// 摘要翻译练习数据
const AbstractTranslationStore = {
    key: 'abstractTranslationData',
    
    getAll() {
        return Storage.get(this.key, []);
    },
    
    getPending() {
        return this.getAll().filter(item => !item.translated);
    },
    
    getDone() {
        return this.getAll().filter(item => item.translated);
    },
    
    add(card) {
        const cards = this.getAll();
        // 检查是否已存在（使用paperId作为唯一标识）
        const exists = cards.find(c => c.paperId === card.paperId);
        if (exists) {
            return { success: false, message: '摘要已存在' };
        }
        cards.unshift({
            ...card,
            translated: card.translated || false,
            userTranslation: card.userTranslation || null,
            aiComment: card.aiComment || null,
            addedAt: card.addedAt || Date.now(),
            translatedAt: card.translatedAt || null
        });
        Storage.set(this.key, cards);
        return { success: true };
    },
    
    addMany(cards) {
        const existing = this.getAll();
        const existingIds = new Set(existing.map(c => c.paperId));
        const newCards = cards.filter(c => !existingIds.has(c.paperId));
        
        for (const card of newCards) {
            existing.unshift({
                ...card,
                translated: card.translated || false,
                userTranslation: card.userTranslation || null,
                aiComment: card.aiComment || null,
                addedAt: card.addedAt || Date.now(),
                translatedAt: card.translatedAt || null
            });
        }
        Storage.set(this.key, existing);
        return { success: true, count: newCards.length };
    },
    
    update(paperId, data) {
        const cards = this.getAll();
        const index = cards.findIndex(c => c.paperId === paperId);
        if (index !== -1) {
            cards[index] = { 
                ...cards[index], 
                ...data, 
                translatedAt: data.translated ? Date.now() : cards[index].translatedAt 
            };
            Storage.set(this.key, cards);
            return true;
        }
        return false;
    },
    
    remove(paperId) {
        const cards = this.getAll();
        const filtered = cards.filter(c => c.paperId !== paperId);
        Storage.set(this.key, filtered);
    },
    
    reset(paperId) {
        const cards = this.getAll();
        const index = cards.findIndex(c => c.paperId === paperId);
        if (index !== -1) {
            cards[index] = { 
                ...cards[index], 
                translated: false, 
                userTranslation: null, 
                aiComment: null, 
                translatedAt: null 
            };
            Storage.set(this.key, cards);
            return true;
        }
        return false;
    }
};

// 追踪配置
const TrackingConfig = {
    key: 'trackingConfig',
    
    get() {
        return Storage.get(this.key, {
            selectedJournals: [],
            keywords: [],
            lastTracking: null,
            autoTracking: false
        });
    },
    
    save(config) {
        Storage.set(this.key, config);
    }
};

// 全局设置
const GlobalSettings = {
    key: 'globalSettings',
    
    get() {
        return Storage.get(this.key, {
            apiProvider: 'siliconflow',
            apiKey: '',
            model: 'Qwen/Qwen2.5-7B-Instruct',
            vocabCount: 20
        });
    },
    
    save(settings) {
        Storage.set(this.key, settings);
    }
};

// 移动端菜单初始化
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('active'));
    }
});

// AI翻译函数（使用硅基流动API）
async function translateField(text, fieldType = 'word') {
    // 使用 ai-parser.js 中的函数获取配置
    const apiKey = typeof getApiKey === 'function' ? getApiKey() : null;
    const providerConfig = typeof getProviderConfig === 'function' ? getProviderConfig() : null;
    const model = typeof getSelectedModel === 'function' ? getSelectedModel() : 'Qwen/Qwen2.5-7B-Instruct';
    
    if (!apiKey) {
        console.warn('未配置API Key，跳过翻译');
        return null;
    }
    
    if (!text || text.trim().length === 0) {
        return null;
    }
    
    let systemPrompt = '';
    if (fieldType === 'cn') {
        systemPrompt = '你是一位专业的学术翻译助手。请将用户提供的英文单词或短语翻译成中文，只返回中文翻译结果，不要添加任何解释或拼音。';
    } else if (fieldType === 'defCn') {
        systemPrompt = '你是一位专业的学术翻译助手。请将用户提供的英文定义翻译成中文定义，保持专业术语的准确性。只返回翻译结果，不要添加任何解释。';
    } else if (fieldType === 'defEn') {
        systemPrompt = 'You are an academic assistant. Please provide a brief English definition (under 50 words) for the given word or phrase. Only return the definition, no examples or explanations.';
    }
    
    try {
        let response;
        
        if (providerConfig && providerConfig.isGemini) {
            // Gemini API
            const url = `${providerConfig.url}/${model}:generateContent?key=${apiKey}`;
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\n${text}` }] }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 200 }
                })
            });
        } else if (providerConfig) {
            // OpenAI 兼容 API
            response = await fetch(providerConfig.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `${providerConfig.authPrefix} ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: text }
                    ],
                    temperature: 0.3,
                    max_tokens: 200
                })
            });
        } else {
            // 降级：使用 GlobalSettings 中的旧配置（兼容旧版本）
            const settings = GlobalSettings.get();
            response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.apiKey}`
                },
                body: JSON.stringify({
                    model: settings.model || 'Qwen/Qwen2.5-7B-Instruct',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: text }
                    ],
                    temperature: 0.3,
                    max_tokens: 200
                })
            });
        }
        
        if (!response.ok) {
            throw new Error(`API错误: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 根据不同 API 格式解析结果
        if (providerConfig && providerConfig.isGemini) {
            return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
        } else {
            return data.choices?.[0]?.message?.content?.trim() || null;
        }
    } catch (error) {
        console.error('翻译失败:', error);
        return null;
    }
}

// 导出全局函数
window.showToast = showToast;
window.Storage = Storage;
window.LibraryStore = LibraryStore;
window.PapersStore = PapersStore;
window.VocabularyStore = VocabularyStore;
window.CategoriesStore = CategoriesStore;
window.TagsStore = TagsStore;
window.AbstractTranslationStore = AbstractTranslationStore;
window.TrackingConfig = TrackingConfig;
window.GlobalSettings = GlobalSettings;
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.debounce = debounce;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.translateField = translateField;


// ==================== GitHub 同步功能（所有页面共用） ====================

// GitHub配置存储（与settings.js共用）
function getGitHubToken() {
    return Storage.get('githubToken', '');
}

function getGitHubConfig() {
    return {
        owner: Storage.get('githubOwner', ''),
        repo: Storage.get('githubRepo', ''),
        path: 'academic-data.json',
        branch: 'main'
    };
}

// 从GitHub下载数据
async function syncFromGitHub() {
    const token = getGitHubToken();
    const config = getGitHubConfig();
    
    if (!token || !config.owner || !config.repo) {
        console.log('未配置GitHub同步，跳过');
        return { success: false, message: '未配置' };
    }
    
    try {
        const response = await fetch(
            `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`,
            { headers: { 'Authorization': `token ${token}` } }
        );
        
        if (!response.ok) {
            if (response.status === 404) {
                return { success: true, message: '远端无数据，本地上传', needUpload: true };
            }
            throw new Error('下载失败');
        }
        
        const data = await response.json();
        const content = JSON.parse(atob(data.content));
        
        // 检查数据版本
        if (!content.data || !content.version) {
            throw new Error('数据格式错误');
        }
        
        // 比较时间戳，只在远端更新时才覆盖
        const remoteLastSync = new Date(content.lastSync || 0);
        const localLastSync = new Date(Storage.get('lastSyncTime', 0));
        
        if (remoteLastSync > localLastSync) {
            // 远端更新，更新本地
            const d = content.data;
            if (d.libraryPapers) Storage.set('libraryPapers', d.libraryPapers);
            if (d.papersData) Storage.set('papersData', d.papersData);
            if (d.vocabularyData) Storage.set('vocabularyData', d.vocabularyData);
            if (d.abstractTranslationData) Storage.set('abstractTranslationData', d.abstractTranslationData);
            if (d.categoriesData) Storage.set('categoriesData', d.categoriesData);
            if (d.tagsData) Storage.set('tagsData', d.tagsData);
            if (d.trackingConfig) Storage.set('trackingConfig', d.trackingConfig);
            if (d.globalSettings) Storage.set('globalSettings', d.globalSettings);
            
            Storage.set('lastSyncTime', content.lastSync);
            return { success: true, message: '已同步最新数据', updated: true };
        } else {
            return { success: true, message: '本地数据已是最新', updated: false };
        }
    } catch (e) {
        console.error('同步失败:', e);
        return { success: false, message: e.message };
    }
}

// 上传数据到GitHub
async function syncToGitHub() {
    const token = getGitHubToken();
    const config = getGitHubConfig();
    
    if (!token || !config.owner || !config.repo) {
        return { success: false, message: '未配置' };
    }
    
    try {
        const backupData = {
            version: '1.0',
            lastSync: new Date().toISOString(),
            data: {
                libraryPapers: LibraryStore.getAll(),
                papersData: PapersStore.getAll(),
                vocabularyData: VocabularyStore.getAll(),
                abstractTranslationData: AbstractTranslationStore.getAll(),
                categoriesData: CategoriesStore.getAll(),
                tagsData: TagsStore.getAll(),
                trackingConfig: TrackingConfig.get(),
                globalSettings: GlobalSettings.get()
            }
        };
        
        // 获取当前文件SHA
        let sha = null;
        try {
            const getResponse = await fetch(
                `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`,
                { headers: { 'Authorization': `token ${token}` } }
            );
            if (getResponse.ok) {
                const fileData = await getResponse.json();
                sha = fileData.sha;
            }
        } catch (e) {}
        
        // 上传文件
        const body = {
            message: `sync: ${new Date().toLocaleString()}`,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(backupData, null, 2)))),
            branch: config.branch
        };
        if (sha) body.sha = sha;
        
        const putResponse = await fetch(
            `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );
        
        if (putResponse.ok) {
            Storage.set('lastSyncTime', backupData.lastSync);
            return { success: true, message: '上传成功' };
        }
        throw new Error('上传失败');
    } catch (e) {
        console.error('上传失败:', e);
        return { success: false, message: e.message };
    }
}

// 页面加载时自动执行同步：先下载，再根据情况上传
async function runSyncOnLoad() {
    const token = getGitHubToken();
    const config = getGitHubConfig();
    
    if (!token || !config.owner || !config.repo) {
        return; // 未配置，静默跳过
    }
    
    // 显示同步状态
    const syncStatus = document.createElement('div');
    syncStatus.id = 'pageSyncStatus';
    syncStatus.style.cssText = `
        position: fixed; top: 10px; right: 10px; z-index: 10000;
        padding: 8px 16px; background: var(--primary); color: white;
        border-radius: 6px; font-size: 13px; opacity: 0; transition: opacity 0.3s;
    `;
    document.body.appendChild(syncStatus);
    
    const showStatus = (text, bg = 'var(--primary)') => {
        syncStatus.textContent = text;
        syncStatus.style.background = bg;
        syncStatus.style.opacity = '1';
    };
    
    const hideStatus = () => {
        setTimeout(() => syncStatus.style.opacity = '0', 2000);
        setTimeout(() => syncStatus.remove(), 2500);
    };
    
    try {
        showStatus('🔄 正在同步...');
        
        // 1. 先下载
        const downloadResult = await syncFromGitHub();
        
        if (downloadResult.success && downloadResult.needUpload) {
            // 远端无数据，直接上传
            showStatus('📤 上传本地数据...');
            const uploadResult = await syncToGitHub();
            if (uploadResult.success) {
                showStatus('✓ 同步完成', '#28a745');
            } else {
                showStatus('✗ 上传失败: ' + uploadResult.message, '#dc3545');
            }
        } else if (downloadResult.success && downloadResult.updated) {
            // 下载了新数据
            showStatus('✓ 已同步最新数据', '#28a745');
        } else if (downloadResult.success) {
            // 本地已是最新，检查是否需要上传（本地有更新但未同步）
            const localLastSync = new Date(Storage.get('lastSyncTime', 0));
            const now = new Date();
            // 如果距离上次同步超过5分钟，或者从未同步过，上传一次
            if (!localLastSync || (now - localLastSync) > 5 * 60 * 1000) {
                showStatus('📤 同步本地变更...');
                const uploadResult = await syncToGitHub();
                if (uploadResult.success) {
                    showStatus('✓ 同步完成', '#28a745');
                }
            } else {
                showStatus('✓ 数据已是最新', '#28a745');
            }
        } else {
            showStatus('✗ 同步失败: ' + downloadResult.message, '#dc3545');
        }
    } catch (e) {
        showStatus('✗ 同步失败', '#dc3545');
        console.error('同步异常:', e);
    }
    
    hideStatus();
}

// 页面加载完成后自动执行同步
document.addEventListener('DOMContentLoaded', () => {
    // 延迟执行，避免阻塞页面渲染
    setTimeout(() => runSyncOnLoad(), 500);
});
