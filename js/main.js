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
            correct_count: 0,
            error_count: 0,
            correct_streak: 0,
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
            correct_count: 0,
            error_count: 0,
            correct_streak: 0,
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
window.TrackingConfig = TrackingConfig;
window.GlobalSettings = GlobalSettings;
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.debounce = debounce;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.translateField = translateField;
