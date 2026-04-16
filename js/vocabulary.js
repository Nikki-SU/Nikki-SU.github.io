/**
 * vocabulary.js - 词汇本核心脚本
 * 完全基于小N单词逻辑重写
 * 
 * 核心逻辑：
 * - 10个词一组，整组做完所有题型再进下一组
 * - 学习模式：英选中(首次对/错弹卡片) → 中选英 → 英选义(中) → 义选英(中) → 句选英 → 句选义(中)
 * - 复习模式：英选中 → 中选英 → 英选义(英) → 义选英(英) → 句选英 → 句选义(英)，不弹卡片
 * - 保存进度，下次继续
 */

// ===== 状态 =====
let vocabulary = [];
let study = null;
let pendingWrong = null;
let settings = {
    learnCount: 50,
    reviewCount: 10,
    masterCount: 12,
    speak: true,
    allowZhan: false,
    types: [1, 2, 3, 4, 5, 6]  // 1英选中 2中选英 3英选义 4义选英 5句选中 6句选义
};

const GROUP_SIZE = 10;

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initEventListeners();
    updateStats();
});

function loadData() {
    vocabulary = VocabularyStore.getAll();
    loadSettings();
}

function loadSettings() {
    const stored = Storage.get('vocabSettings', {});
    settings = { ...settings, ...stored };
}

function saveSettings() {
    Storage.set('vocabSettings', settings);
}

function saveVocabulary() {
    Storage.set(VocabularyStore.key, vocabulary);
}

// ===== 进度保存 =====
function saveProgress() {
    if (!study) return;
    const progress = {
        mode: study.mode,
        wrongOnly: study.wrongOnly,
        wordEns: study.allWords.map(w => w.en),
        groupIndex: study.groupIndex,
        phase: study.phase,
        typeIndex: study.typeIndex,
        idx: study.idx,
        queueEns: study.queue.map(w => w.en),
        showingCard: study.showingCard,
        pendingWrongEn: pendingWrong ? pendingWrong.word.en : null,
        pendingWrongType: pendingWrong ? pendingWrong.type : null
    };
    Storage.set('vocabProgress', progress);
}

function clearProgress() {
    Storage.remove('vocabProgress');
}

// ===== 分类与统计 =====
function classify(word) {
    if ((word.streak || 0) >= settings.masterCount) return 'mastered';
    if ((word.wrongCount || 0) >= 3) return 'wrong';
    const hasAllCorrect = settings.types.every(t => word.correctTypes && word.correctTypes.includes(t));
    if (!word.cardShown) return 'new';
    if (!hasAllCorrect) return 'learning';
    return 'learned';
}

function getStats() {
    let stats = { new: 0, learning: 0, learned: 0, mastered: 0, wrong: 0 };
    vocabulary.forEach(w => {
        stats[classify(w)]++;
    });
    return stats;
}

function updateStats() {
    const s = getStats();
    
    document.getElementById('newCount').textContent = s.new;
    document.getElementById('studyingCount').textContent = s.learning;
    document.getElementById('learnedCount').textContent = s.learned;
    document.getElementById('masteredCount').textContent = s.mastered;
    document.getElementById('wrongCount').textContent = s.wrong;
    
    const startLearnBtn = document.getElementById('startStudyBtn');
    const startReviewBtn = document.getElementById('startReviewBtn');
    
    if (startLearnBtn) {
        const learnable = s.new + s.learning;
        startLearnBtn.disabled = learnable === 0;
        startLearnBtn.textContent = `📖 学习 (${learnable})`;
    }
    if (startReviewBtn) {
        startReviewBtn.disabled = s.learned === 0;
        startReviewBtn.textContent = `🔄 复习 (${s.learned})`;
    }
}

// ===== 事件监听 =====
function initEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    document.getElementById('startStudyBtn')?.addEventListener('click', () => startStudy('learn'));
    document.getElementById('startReviewBtn')?.addEventListener('click', () => startStudy('review'));
    document.getElementById('quitStudyBtn')?.addEventListener('click', quitStudy);
    
    document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
    document.getElementById('closeSettings')?.addEventListener('click', closeSettings);
    document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettingsAndClose);
    
    document.getElementById('reviewWrongBtn')?.addEventListener('click', () => startStudy('review', true));
    
    document.getElementById('allStatusFilter')?.addEventListener('change', renderAllWords);
    document.getElementById('allSearchInput')?.addEventListener('input', debounce(renderAllWords, 300));
    
    // 补全翻译按钮
    document.getElementById('btnTranslateAll')?.addEventListener('click', translateAllMissing);
    
    // 导出词汇按钮
    document.getElementById('exportVocabBtn')?.addEventListener('click', exportVocabulary);
}

// ===== 补全翻译 =====
async function translateAllMissing() {
    const btn = document.getElementById('btnTranslateAll');
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = '🔄 正在翻译...';
    
    try {
        const updated = await VocabularyStore.translateMissingFields((msg) => {
            btn.textContent = `🔄 ${msg}`;
        });
        
        // 重新加载数据
        vocabulary = VocabularyStore.getAll();
        updateStats();
        
        showToast(`已完成，更新了 ${updated} 个词汇`, 'success');
    } catch (error) {
        console.error('翻译失败:', error);
        showToast('翻译失败，请检查API设置', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tab}Tab`);
    });
    
    if (tab === 'all') renderAllWords();
    if (tab === 'wrong') renderWrongWords();
    if (tab === 'mastered') renderMasteredWords();
}

// ===== 学习核心逻辑 =====

function chunkWords(words, size) {
    const chunks = [];
    for (let i = 0; i < words.length; i += size) {
        chunks.push(words.slice(i, i + size));
    }
    return chunks;
}

function getLearnWords() {
    const learning = vocabulary.filter(w => classify(w) === 'learning');
    const newWords = vocabulary.filter(w => classify(w) === 'new');
    return [...learning, ...newWords].slice(0, settings.learnCount);
}

function getReviewWords(wrongOnly) {
    if (wrongOnly) {
        return vocabulary.filter(w => classify(w) === 'wrong').slice(0, settings.reviewCount);
    }
    return vocabulary.filter(w => classify(w) === 'learned').slice(0, settings.reviewCount);
}

function startStudy(mode, wrongOnly = false) {
    let words = mode === 'learn' ? getLearnWords() : getReviewWords(wrongOnly);
    
    if (words.length === 0) {
        showToast(mode === 'learn' ? '没有可学习的单词' : '没有可复习的单词', 'error');
        return;
    }
    
    const groups = chunkWords(words, GROUP_SIZE);
    
    // 检查是否有保存的进度
    const savedProgress = Storage.get('vocabProgress');
    let shouldResume = false;
    
    if (savedProgress && savedProgress.mode === mode && savedProgress.wrongOnly === wrongOnly) {
        const savedWordEns = savedProgress.wordEns || [];
        const currentWordEns = words.map(w => w.en);
        if (savedWordEns.length === currentWordEns.length && 
            savedWordEns.every((en, i) => en === currentWordEns[i])) {
            shouldResume = true;
        }
    }
    
    // 学习模式：检查是否所有词都已展示过卡片（已完成第一阶段）
    let startPhase = 'first';
    if (mode === 'learn') {
        const allCardShown = words.every(w => w.cardShown);
        if (allCardShown) {
            startPhase = 'types';
        }
    } else {
        // 复习模式直接从题型开始
        startPhase = 'types';
    }
    
    study = {
        mode: mode,
        wrongOnly: wrongOnly,
        allWords: words,
        groups: groups,
        groupIndex: 0,
        phase: startPhase,
        typeIndex: 0,
        queue: [],
        idx: 0,
        wrongQueue: [],
        showingCard: false
    };
    
    if (shouldResume && savedProgress) {
        study.groupIndex = savedProgress.groupIndex || 0;
        study.phase = savedProgress.phase || study.phase;
        study.typeIndex = savedProgress.typeIndex || 0;
        study.idx = savedProgress.idx || 0;
        study.showingCard = savedProgress.showingCard || false;
        if (savedProgress.queueEns) {
            study.queue = savedProgress.queueEns.map(en => words.find(w => w.en === en)).filter(w => w);
        }
        
        if (savedProgress.pendingWrongEn) {
            const wrongWord = words.find(w => w.en === savedProgress.pendingWrongEn);
            if (wrongWord) {
                pendingWrong = { word: wrongWord, type: savedProgress.pendingWrongType || 1 };
            }
        }
        
        if (study.queue.length === 0) initGroup();
        showToast('继续上次进度', 'info');
    } else {
        initGroup();
    }
    
    document.getElementById('studyControls')?.classList.add('hidden');
    document.getElementById('queueInfo')?.classList.remove('hidden');
    document.getElementById('studyArea')?.classList.remove('hidden');
    
    renderStudy();
}

function initGroup() {
    const currentGroup = study.groups[study.groupIndex];
    study.wrongQueue = [];
    
    if (study.mode === 'learn' && study.phase === 'first') {
        // 学习模式第一阶段：只把未展示过卡片的词放入队列做英选中
        study.queue = currentGroup.filter(w => !w.cardShown);
        study.idx = 0;
        study.showingCard = false;
        
        if (study.queue.length === 0) {
            // 这组所有词都展示过卡片，直接进入题型阶段
            study.phase = 'types';
            study.typeIndex = 0;
            if (study.typeIndex >= settings.types.length) {
                study.groupIndex++;
                if (study.groupIndex < study.groups.length) {
                    initGroup();
                } else {
                    finishStudy();
                }
                return;
            }
            study.queue = [...currentGroup];
            study.idx = 0;
        }
    } else {
        // 题型阶段
        study.phase = 'types';
        study.typeIndex = 0;
        study.queue = [...currentGroup];
        study.idx = 0;
    }
    
    saveProgress();
}

function renderStudy() {
    const area = document.getElementById('studyArea');
    const totalWords = study.allWords.length;
    const groupNum = study.groupIndex + 1;
    const totalGroups = study.groups.length;
    
    let done = 0;
    for (let i = 0; i < study.groupIndex; i++) {
        done += study.groups[i].length;
    }
    done += study.idx;
    
    updateProgressDisplay(done, totalWords, groupNum, totalGroups);
    
    let html = '';
    
    // 显示错题卡片
    if (pendingWrong) {
        const word = pendingWrong.word;
        html = renderCard(word);
        html += `<div style="text-align:center;margin-top:20px;"><button class="btn btn-danger btn-lg" onclick="retryAfterCard()">🔄 重做</button></div>`;
        area.innerHTML = html;
        return;
    }
    
    // 显示卡片（学习模式第一阶段做对后）
    if (study.mode === 'learn' && study.phase === 'first' && study.showingCard) {
        const word = study.queue[study.idx];
        html = renderCard(word);
        html += `<div style="text-align:center;margin-top:20px;"><button class="btn btn-primary btn-lg" onclick="continueAfterCard()">继续</button></div>`;
        area.innerHTML = html;
        return;
    }
    
    if (study.mode === 'learn' && study.phase === 'first') {
        // 学习模式第一阶段：英选中
        const word = study.queue[study.idx];
        html = renderQuestion(word, 1, '英选中');
    } else if (study.phase === 'types') {
        // 题型阶段
        let currentType = settings.types[study.typeIndex];
        
        if (currentType === undefined || study.typeIndex >= settings.types.length) {
            // 这组所有题型完成，进入下一组
            study.groupIndex++;
            if (study.groupIndex < study.groups.length) {
                initGroup();
                renderStudy();
            } else {
                finishStudy();
            }
            return;
        }
        
        const typeNames = { 1: '英选中', 2: '中选英', 3: '英选义', 4: '义选英', 5: '句选英', 6: '句选义' };
        html = `<div class="stage-hint">${typeNames[currentType]}</div>`;
        const word = study.queue[study.idx];
        html += renderQuestion(word, currentType, typeNames[currentType]);
    }
    
    area.innerHTML = html;
}

function updateProgressDisplay(done, total, groupNum, totalGroups) {
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const progressText = document.getElementById('progressText');
    const wordProgress = document.getElementById('wordProgress');
    
    const percent = Math.round((done / total) * 100);
    
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressPercent) progressPercent.textContent = `${percent}%`;
    if (progressText) progressText.textContent = `第 ${done + 1}/${total} 个词`;
    if (wordProgress) wordProgress.textContent = `第 ${groupNum}/${totalGroups} 组`;
}

function renderCard(word) {
    const defCn = word.defCn || '';
    const defEn = word.defEn || '';
    const ex = word.ex || '';
    
    let html = `
        <div class="word-card-display">
            <div class="word">${escapeHtml(word.en)}</div>
            <div class="translation">${escapeHtml(word.cn)}</div>
            ${defCn ? `<div class="definition">📖 ${escapeHtml(defCn)}</div>` : ''}
            ${defEn ? `<div class="definition" style="font-size:0.85rem;">📘 ${escapeHtml(defEn)}</div>` : ''}
            ${ex ? `<div class="example">${formatExample(ex, word.en)}</div>` : ''}
        </div>
    `;
    
    if (settings.speak && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(word.en);
        u.lang = 'en-US';
        speechSynthesis.speak(u);
    }
    
    return html;
}

function renderQuestion(word, type, typeName) {
    // 获取其他词汇作为干扰项，过滤掉字段为空的词汇
    let others = vocabulary.filter(w => {
        if (w.en === word.en) return false;
        // 根据题型过滤
        if (type === 1 || type === 5) return w.cn && w.cn.trim(); // 英选中、句选中需要cn
        if (type === 2 || type === 4) return w.en && w.en.trim(); // 中选英、义选英需要en
        if (type === 3 || type === 6) return (w.defCn || w.cn) && (w.defCn || w.cn).trim(); // 英选义、句选义需要定义
        return true;
    });
    
    others.sort(() => Math.random() - 0.5);
    others = others.slice(0, 3);
    
    let question, options, correct;
    
    // 学习模式用中文定义，复习模式用英文定义
    const useEnDef = (study.mode === 'review');
    
    switch(type) {
        case 1: // 英选中
            question = `<span class="question-word">${escapeHtml(word.en)}</span>`;
            options = [word.cn, ...others.map(o => o.cn)].sort(() => Math.random() - 0.5);
            correct = word.cn;
            speak(word.en);
            break;
            
        case 2: // 中选英
            question = `<span class="question-text">${escapeHtml(word.cn)}</span>`;
            options = [word.en, ...others.map(o => o.en)].sort(() => Math.random() - 0.5);
            correct = word.en;
            break;
            
        case 3: // 英选义
            question = `<span class="question-word">${escapeHtml(word.en)}</span>`;
            const def3 = (useEnDef && word.defEn) ? word.defEn : (word.defCn || word.cn);
            const othersDef3 = others.map(o => (useEnDef && o.defEn) ? o.defEn : (o.defCn || o.cn));
            options = [def3, ...othersDef3].sort(() => Math.random() - 0.5);
            correct = def3;
            speak(word.en);
            break;
            
        case 4: // 义选英
            const def4 = (useEnDef && word.defEn) ? word.defEn : (word.defCn || word.cn);
            question = `<span class="question-text">${escapeHtml(def4)}</span>`;
            options = [word.en, ...others.map(o => o.en)].sort(() => Math.random() - 0.5);
            correct = word.en;
            break;
            
        case 5: // 句选中：给出例句（词标粗），选出该词的中文
            const ex5 = formatExample(word.ex, word.en);
            question = ex5 ? ex5 : `<span class="question-word">${escapeHtml(word.en)}</span> <span class="text-muted">(无例句)</span>`;
            options = [word.cn, ...others.map(o => o.cn)].sort(() => Math.random() - 0.5);
            correct = word.cn;
            if (word.ex) speak(word.ex.replace(/\*\*/g, '').replace(/<[^>]*>/g, ''));
            break;
            
        case 6: // 句选义
            const ex6 = formatExample(word.ex, word.en);
            question = ex6 ? ex6 : `<span class="question-word">${escapeHtml(word.en)}</span> <span class="text-muted">(无例句)</span>`;
            const def6 = (useEnDef && word.defEn) ? word.defEn : (word.defCn || word.cn);
            const othersDef6 = others.map(o => (useEnDef && o.defEn) ? o.defEn : (o.defCn || o.cn));
            options = [def6, ...othersDef6].sort(() => Math.random() - 0.5);
            correct = def6;
            if (word.ex) speak(word.ex.replace(/\*\*/g, '').replace(/<[^>]*>/g, ''));
            break;
    }
    
    // 确保至少有4个选项（如果干扰项不够，提示用户）
    if (options.length < 4) {
        // 显示提示信息
        const shortage = 4 - options.length;
        const hint = `<div class="alert alert-warning" style="margin-bottom:12px;">⚠️ 当前词库词汇不足，建议添加更多词汇或使用"补全翻译"功能</div>`;
        question = hint + question;
        // 用占位符填充
        while (options.length < 4) {
            options.push(`[选项${options.length + 1}]`);
        }
    }
    
    let html = `
        <div class="question-area">
            <div class="question-content">${question}</div>
            <div class="options-grid">
                ${options.map(opt => `
                    <button class="option-btn" onclick="checkAnswer('${escapeAttr(opt)}', '${escapeAttr(correct)}', ${type}, this)">
                        ${escapeHtml(opt)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    
    if (settings.allowZhan) {
        html += `<div style="text-align:center;margin-top:16px;"><button class="btn btn-outline" onclick="zhanWord()">⚔️ 斩（直接掌握）</button></div>`;
    }
    
    return html;
}

function formatExample(ex, word) {
    if (!ex) return '';
    let formatted = ex.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--primary);">$1</strong>');
    if (!ex.includes('**') && word) {
        const regex = new RegExp(`\\b(${word})\\b`, 'gi');
        formatted = ex.replace(regex, '<strong style="color:var(--primary);">$1</strong>');
    }
    return formatted;
}

function speak(text) {
    if (settings.speak && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        speechSynthesis.speak(u);
    }
}

// ===== 答题逻辑 =====

window.checkAnswer = function(selected, correct, type, btn) {
    const btns = document.querySelectorAll('.option-btn');
    
    // 立即禁用所有按钮防止重复点击
    btns.forEach(b => b.disabled = true);
    const isCorrect = selected === correct;
    
    btns.forEach(b => {
        b.classList.add('disabled');
        if (b.textContent === correct) b.classList.add('correct');
        else if (b.textContent === selected && !isCorrect) b.classList.add('wrong');
    });
    
    const word = study.queue[study.idx];
    const idx = vocabulary.findIndex(w => w.en === word.en);
    
    if (idx >= 0) {
        if (isCorrect) {
            vocabulary[idx].streak = (vocabulary[idx].streak || 0) + 1;
            if (!vocabulary[idx].correctTypes) vocabulary[idx].correctTypes = [];
            if (!vocabulary[idx].correctTypes.includes(type)) vocabulary[idx].correctTypes.push(type);
        } else {
            vocabulary[idx].streak = 0;
            vocabulary[idx].wrongCount = (vocabulary[idx].wrongCount || 0) + 1;
        }
        saveVocabulary();
    }
    
    setTimeout(() => {
        // 学习模式第一阶段（英选中）
        if (study.mode === 'learn' && study.phase === 'first') {
            if (isCorrect) {
                // 第一次做对：弹卡片
                vocabulary[idx].cardShown = true;
                if (!vocabulary[idx].correctTypes) vocabulary[idx].correctTypes = [];
                if (!vocabulary[idx].correctTypes.includes(1)) vocabulary[idx].correctTypes.push(1);
                saveVocabulary();
                
                study.showingCard = true;
                saveProgress();
                renderStudy();
            } else {
                // 做错：弹卡片后重做
                pendingWrong = { word: word, type: type };
                saveProgress();
                renderStudy();
            }
        } else {
            // 题型阶段
            if (isCorrect) {
                study.idx++;
                saveProgress();
                if (study.idx < study.queue.length) {
                    renderStudy();
                } else {
                    nextTypeOrGroup();
                }
            } else {
                pendingWrong = { word: word, type: type };
                saveProgress();
                renderStudy();
            }
        }
    }, 600);
};

// 卡片后继续（学习模式第一阶段做对后）
window.continueAfterCard = function() {
    study.idx++;
    study.showingCard = false;
    saveProgress();
    
    if (study.idx < study.queue.length) {
        renderStudy();
    } else {
        // 这组英选中完成，进入题型阶段
        study.phase = 'types';
        study.typeIndex = 0;
        study.queue = [...study.groups[study.groupIndex]];
        study.idx = 0;
        saveProgress();
        renderStudy();
    }
};

// 错题卡片后重做
window.retryAfterCard = function() {
    if (!pendingWrong) return;
    study.queue.push(pendingWrong.word);
    pendingWrong = null;
    saveProgress();
    renderStudy();
};

window.zhanWord = function() {
    const word = study.queue[study.idx];
    const idx = vocabulary.findIndex(w => w.en === word.en);
    
    if (idx >= 0) {
        vocabulary[idx].streak = settings.masterCount;
        vocabulary[idx].wrongCount = 0;
        vocabulary[idx].cardShown = true;
        if (!vocabulary[idx].correctTypes) vocabulary[idx].correctTypes = [];
        settings.types.forEach(t => {
            if (!vocabulary[idx].correctTypes.includes(t)) vocabulary[idx].correctTypes.push(t);
        });
        saveVocabulary();
    }
    
    study.idx++;
    showToast('已掌握！', 'success');
    saveProgress();
    
    if (study.idx < study.queue.length) {
        renderStudy();
    } else {
        if (study.mode === 'learn' && study.phase === 'first') {
            study.phase = 'types';
            study.typeIndex = 0;
            study.queue = [...study.groups[study.groupIndex]];
            study.idx = 0;
            saveProgress();
            renderStudy();
        } else {
            nextTypeOrGroup();
        }
    }
};

function nextTypeOrGroup() {
    // 进入下一题型
    study.typeIndex++;
    
    if (study.typeIndex < settings.types.length) {
        // 还有题型，重置队列
        study.queue = [...study.groups[study.groupIndex]];
        study.idx = 0;
        saveProgress();
        renderStudy();
    } else {
        // 这组所有题型完成，进入下一组
        study.groupIndex++;
        if (study.groupIndex < study.groups.length) {
            initGroup();
            renderStudy();
        } else {
            finishStudy();
        }
    }
}

function finishStudy() {
    clearProgress();
    showToast('学习完成！', 'success');
    updateStats();
    setTimeout(() => quitStudy(), 500);
}

function quitStudy() {
    study = null;
    pendingWrong = null;
    document.getElementById('studyControls')?.classList.remove('hidden');
    document.getElementById('queueInfo')?.classList.add('hidden');
    document.getElementById('studyArea')?.classList.add('hidden');
    updateStats();
}

// ===== 列表渲染 =====

function renderAllWords() {
    const container = document.getElementById('allWordsList');
    if (!container) return;
    
    const filter = document.getElementById('allStatusFilter')?.value || '';
    const search = document.getElementById('allSearchInput')?.value?.toLowerCase() || '';
    
    let words = [...vocabulary];
    if (filter) words = words.filter(w => classify(w) === filter);
    if (search) {
        words = words.filter(w => 
            (w.en && w.en.toLowerCase().includes(search)) ||
            (w.cn && w.cn.toLowerCase().includes(search))
        );
    }
    
    if (words.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>暂无词汇</p></div>`;
        return;
    }
    
    container.innerHTML = words.map(w => `
        <div class="list-item">
            <div class="list-item-main">
                <div class="list-item-title">${escapeHtml(w.en)}</div>
                <div class="list-item-sub">${escapeHtml(w.cn)}</div>
            </div>
            <span class="badge ${classify(w) === 'mastered' ? 'badge-success' : classify(w) === 'wrong' ? 'badge-danger' : 'badge-secondary'}">${classify(w)}</span>
        </div>
    `).join('');
}

function renderWrongWords() {
    const container = document.getElementById('wrongWordsList');
    if (!container) return;
    
    const words = vocabulary.filter(w => classify(w) === 'wrong');
    words.sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0));
    
    if (words.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>暂无错词</p></div>`;
        return;
    }
    
    container.innerHTML = words.map(w => `
        <div class="list-item">
            <div class="list-item-main">
                <div class="list-item-title">${escapeHtml(w.en)} <span class="badge badge-danger">错${w.wrongCount}次</span></div>
                <div class="list-item-sub">${escapeHtml(w.cn)}</div>
            </div>
        </div>
    `).join('');
}

function renderMasteredWords() {
    const container = document.getElementById('masteredWordsList');
    if (!container) return;
    
    const words = vocabulary.filter(w => classify(w) === 'mastered');
    words.sort((a, b) => a.en.localeCompare(b.en));
    
    if (words.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>暂无已掌握词汇</p></div>`;
        return;
    }
    
    container.innerHTML = words.map(w => `
        <div class="list-item">
            <div class="list-item-main">
                <div class="list-item-title">${escapeHtml(w.en)}</div>
                <div class="list-item-sub">${escapeHtml(w.cn)}</div>
            </div>
            <button class="btn btn-sm btn-outline" onclick="removeFromMastered('${escapeAttr(w.en)}')">移出</button>
        </div>
    `).join('');
}

window.removeFromMastered = function(en) {
    const idx = vocabulary.findIndex(w => w.en === en);
    if (idx >= 0) {
        vocabulary[idx].streak = 0;
        vocabulary[idx].cardShown = false;
        vocabulary[idx].correctTypes = [];
        saveVocabulary();
        showToast('已移出已掌握库', 'success');
        renderMasteredWords();
        updateStats();
    }
};

// ===== 设置 =====

function openSettings() {
    document.getElementById('settingsModal')?.classList.remove('hidden');
    document.getElementById('settingSpeak').checked = settings.speak;
    document.getElementById('settingCut').checked = settings.allowZhan;
    document.getElementById('settingMasterCount').value = settings.masterCount;
    
    // 6种题型开关
    const typeMap = {
        1: 'settingEnCn',  // 英选中
        2: 'settingCnEn',  // 中选英
        3: 'settingEnDef', // 英选义
        4: 'settingDefEn', // 义选英
        5: 'settingSentEn', // 句选中
        6: 'settingSentCn'  // 句选义
    };
    
    // 先全部设为false
    Object.values(typeMap).forEach(id => {
        const cb = document.getElementById(id);
        if (cb) cb.checked = false;
    });
    
    // 再根据settings.types设置选中的
    settings.types.forEach(t => {
        const cb = document.getElementById(typeMap[t]);
        if (cb) cb.checked = true;
    });
}

function closeSettings() {
    document.getElementById('settingsModal')?.classList.add('hidden');
}

function saveSettingsAndClose() {
    settings.speak = document.getElementById('settingSpeak')?.checked ?? true;
    settings.allowZhan = document.getElementById('settingCut')?.checked ?? false;
    settings.masterCount = parseInt(document.getElementById('settingMasterCount')?.value) || 12;
    
    const typeMap = {
        'settingEnCn': 1,  // 英选中
        'settingCnEn': 2,  // 中选英
        'settingEnDef': 3, // 英选义
        'settingDefEn': 4, // 义选英
        'settingSentEn': 5, // 句选中
        'settingSentCn': 6  // 句选义
    };
    
    const types = [];
    Object.entries(typeMap).forEach(([id, type]) => {
        if (document.getElementById(id)?.checked) types.push(type);
    });
    
    if (types.length > 0) settings.types = types;
    
    saveSettings();
    showToast('设置已保存', 'success');
    closeSettings();
}

// ===== 工具函数 =====

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    if (!text) return '';
    return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}


// ===== 导出词汇 =====
function exportVocabulary() {
    if (vocabulary.length === 0) {
        showToast('词汇本为空，无法导出', 'error');
        return;
    }
    
    // 转换为小N单词格式
    const exportData = vocabulary.map(w => ({
        en: w.en || '',
        cn: w.cn || '',
        defCn: w.defCn || '',
        defEn: w.defEn || '',
        ex: w.ex || '',
        category: 'academic'
    }));
    
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `学术站词汇_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(`成功导出 ${exportData.length} 个词汇`, 'success');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        background: ${type === 'success' ? '#00A087' : type === 'error' ? '#E64B35' : '#4DBBD5'};
        color: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}
