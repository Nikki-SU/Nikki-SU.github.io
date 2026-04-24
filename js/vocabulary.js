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
    document.getElementById('closeSettingsModal')?.addEventListener('click', closeSettings);
    document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettingsAndClose);
    
    document.getElementById('reviewWrongBtn')?.addEventListener('click', () => startStudy('review', true));
    
    document.getElementById('allStatusFilter')?.addEventListener('change', renderAllWords);
    document.getElementById('allSearchInput')?.addEventListener('input', debounce(renderAllWords, 300));
    
    // 补全翻译按钮
    document.getElementById('btnTranslateAll')?.addEventListener('click', translateAllMissing);
    
    // 导出词汇按钮
    document.getElementById('exportVocabBtn')?.addEventListener('click', exportVocabularyToClipboard);
    document.getElementById('downloadVocabBtn')?.addEventListener('click', downloadVocabularyFile);

    // 摘要翻译练习事件
    document.getElementById('startTransBtn')?.addEventListener('click', startTransPractice);
    document.querySelectorAll('#transTabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTransTab(btn.dataset.tab));
    });
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
    
    // 进入全屏模式
    enterFullscreenStudy();
    
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
        html += `<div style="text-align:center;margin-top:20px;"><button class="btn btn-primary btn-lg" onclick="retryAfterCard()">重做</button></div>`;
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


// 词汇不足时跳过题目
function renderSkipQuestion(word, type, typeName) {
    return `
        <div class="question-area">
            <div class="alert alert-warning" style="margin-bottom:12px;">
                ⚠️ 词库中可用词汇不足，跳过此题型<br>
                <small>请添加更多词汇或使用"补全翻译"功能</small>
            </div>
            <div style="text-align: center; padding: 20px;">
                <button class="btn btn-primary" onclick="handleAnswer(true)">继续下一题</button>
            </div>
        </div>
    `;
}

function renderQuestion(word, type, typeName) {
    // 检查当前单词是否有该题型需要的字段
    const requiredFields = {
        1: ['cn'],           // 英选中需要 cn
        2: ['cn', 'en'],     // 中选英需要 cn（题目）和 en（答案）
        3: ['en'],           // 英选义需要 en，定义有降级
        4: ['en'],           // 义选英需要 en，定义有降级
        5: ['cn'],           // 句选中需要 cn（例句可选）
        6: []                // 句选义定义有降级
    };
    
    const required = requiredFields[type] || [];
    for (const field of required) {
        if (!word[field] || !word[field].trim()) {
            // 缺少必需字段，跳过此题型
            return renderSkipQuestion(word, type, typeName);
        }
    }
    
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
    
    // 如果干扰项太少（少于1个），跳过此题型
    if (others.length < 1) {
        return renderSkipQuestion(word, type, typeName);
    }
    
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
    
    // 选项不足4个时，有多少用多少（最少2个：正确答案+1个干扰项）
    
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
    const container = document.getElementById('masteredWordList');
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
    document.getElementById('settingAllowZhan').checked = settings.allowZhan;
    document.getElementById('settingMasterCount').value = settings.masterCount;
    
    // 题型开关 - 对应HTML中的ID
    const typeIds = { 1: 'settingEnCn', 2: 'settingCnEn', 3: 'settingEnDef', 4: 'settingDefEn', 5: 'settingSenCn', 6: 'settingSenDef' };
    Object.entries(typeIds).forEach(([type, id]) => {
        const cb = document.getElementById(id);
        if (cb) cb.checked = settings.types.includes(parseInt(type));
    });
}

function closeSettings() {
    document.getElementById('settingsModal')?.classList.add('hidden');
}

function saveSettingsAndClose() {
    settings.speak = document.getElementById('settingSpeak')?.checked ?? true;
    settings.allowZhan = document.getElementById('settingAllowZhan')?.checked ?? false;
    settings.masterCount = parseInt(document.getElementById('settingMasterCount')?.value) || 12;
    
    // 题型开关 - 对应HTML中的ID
    const types = [];
    if (document.getElementById('settingEnCn')?.checked) types.push(1);  // 英选中
    if (document.getElementById('settingCnEn')?.checked) types.push(2);  // 中选英
    if (document.getElementById('settingEnDef')?.checked) types.push(3); // 英选义
    if (document.getElementById('settingDefEn')?.checked) types.push(4); // 义选英
    if (document.getElementById('settingSenCn')?.checked) types.push(5); // 句选中
    if (document.getElementById('settingSenDef')?.checked) types.push(6); // 句选义
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

function getExportJsonData() {
    if (vocabulary.length === 0) {
        return null;
    }
    
    // 转换为小N单词格式
    return vocabulary.map(w => ({
        en: w.en || '',
        cn: w.cn || '',
        defCn: w.defCn || '',
        defEn: w.defEn || '',
        ex: w.ex || '',
        category: 'academic'
    }));
}

function exportVocabularyToClipboard() {
    const exportData = getExportJsonData();
    if (!exportData) {
        showToast('词汇本为空，无法导出', 'error');
        return;
    }
    
    const jsonStr = JSON.stringify(exportData, null, 2);
    
    navigator.clipboard.writeText(jsonStr).then(() => {
        showToast(`已复制 ${exportData.length} 个词汇到剪贴板`, 'success');
    }).catch(() => {
        // 降级方案
        const textarea = document.createElement('textarea');
        textarea.value = jsonStr;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast(`已复制 ${exportData.length} 个词汇到剪贴板`, 'success');
    });
}

function downloadVocabularyFile() {
    const exportData = getExportJsonData();
    if (!exportData) {
        showToast('词汇本为空，无法导出', 'error');
        return;
    }
    
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
    
    showToast(`已下载 ${exportData.length} 个词汇`, 'success');
}

// ===== 全屏学习模式 =====

function enterFullscreenStudy() {
    const studyArea = document.getElementById('studyArea');
    const queueInfo = document.getElementById('queueInfo');
    
    if (studyArea) {
        studyArea.classList.add('study-fullscreen');
    }
    
    // 修改退出按钮样式，移到右上角
    if (queueInfo) {
        queueInfo.classList.add('fullscreen-queue-info');
    }
    
    // 尝试进入浏览器全屏
    try {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen();
        }
    } catch (e) {
        console.log('浏览器不支持全屏API');
    }
}

function exitFullscreenStudy() {
    const studyArea = document.getElementById('studyArea');
    const queueInfo = document.getElementById('queueInfo');
    
    if (studyArea) {
        studyArea.classList.remove('study-fullscreen');
    }
    
    if (queueInfo) {
        queueInfo.classList.remove('fullscreen-queue-info');
    }
    
    // 退出浏览器全屏
    try {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    } catch (e) {
        console.log('退出全屏失败');
    }
}

// ============================================
// 摘要翻译练习功能
// ============================================

// 摘要翻译练习状态
let transState = {
    mode: 'practice', // 'practice' | 'done'
    currentIndex: 0,
    items: [],
    showingReference: false,
    currentReviewId: null,
    showingChinese: false
};

// 切换主标签
function switchMainTab(tab) {
    const vocabTabBtn = document.getElementById('vocabTabBtn');
    const transTabBtn = document.getElementById('transTabBtn');
    const vocabContent = document.getElementById('vocabContent');
    const transContent = document.getElementById('transContent');

    if (tab === 'vocab') {
        vocabTabBtn?.classList.add('active');
        transTabBtn?.classList.remove('active');
        vocabContent.style.display = 'block';
        transContent.style.display = 'none';
        updateStats();
    } else {
        vocabTabBtn?.classList.remove('active');
        transTabBtn?.classList.add('active');
        vocabContent.style.display = 'none';
        transContent.style.display = 'block';
        updateTransStats();
        loadTransDoneList();
    }
}

// 更新摘要翻译练习统计
function updateTransStats() {
    const pending = AbstractTranslationStore.getPending();
    const done = AbstractTranslationStore.getDone();
    
    document.getElementById('transPendingCount').textContent = pending.length;
    document.getElementById('transDoneCount').textContent = done.length;
}

// 切换翻译练习内部标签
function switchTransTab(tab) {
    document.querySelectorAll('#transTabs .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    const practiceTab = document.getElementById('transPracticeTab');
    const doneTab = document.getElementById('transDoneTab');
    
    if (tab === 'transPractice') {
        practiceTab?.classList.add('active');
        doneTab?.classList.remove('active');
    } else {
        practiceTab?.classList.remove('active');
        doneTab?.classList.add('active');
        loadTransDoneList();
    }
}

// 开始翻译练习
function startTransPractice() {
    const pending = AbstractTranslationStore.getPending();
    
    if (pending.length === 0) {
        showToast('暂无待练习的摘要', 'info');
        return;
    }
    
    transState.mode = 'practice';
    transState.items = [...pending];
    transState.currentIndex = 0;
    transState.showingReference = false;
    transState.currentReviewId = null;
    transState.showingChinese = false;
    
    showCurrentTransItem();
}

// 显示当前翻译练习项
function showCurrentTransItem() {
    const area = document.getElementById('transPracticeArea');
    
    if (transState.currentIndex >= transState.items.length) {
        // 练习完成
        area.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎉</div>
                <p>本轮练习完成！</p>
                <p class="text-muted">已完成 ${transState.items.length} 篇摘要翻译</p>
                <button class="btn btn-primary" onclick="startTransPractice()" style="margin-top: 16px;">
                    🔄 再练一轮
                </button>
            </div>
        `;
        updateTransStats();
        return;
    }
    
    const item = transState.items[transState.currentIndex];
    transState.showingReference = false;
    
    area.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="color: var(--text-secondary); font-size: 0.9rem;">
                    ${transState.currentIndex + 1} / ${transState.items.length}
                </span>
                <button class="btn btn-sm btn-secondary" onclick="skipTransItem()">
                    跳过
                </button>
            </div>
            <div class="card-title" style="margin-bottom: 12px;">
                <span>📄</span> 英文标题
            </div>
            <p style="font-size: 1rem; line-height: 1.6; color: var(--text);">${escapeHtml(item.titleEn || item.title || '无标题')}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            <div class="card-title" style="margin-bottom: 12px;">
                <span>📝</span> 英文摘要
            </div>
            <p style="font-size: 0.95rem; line-height: 1.8; color: var(--text);">${escapeHtml(item.abstractEn || item.abstract || '')}</p>
        </div>
        
        ${(item.keywordsEn || item.keywords || []).length > 0 ? `
        <div style="margin-bottom: 20px;">
            <div class="card-title" style="margin-bottom: 12px;">
                <span>🔑</span> 英文关键词
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${(item.keywordsEn || item.keywords || []).map(kw => 
                    `<span class="tag">${escapeHtml(kw)}</span>`
                ).join('')}
            </div>
        </div>
        ` : ''}
        
        <div style="margin-bottom: 20px;">
            <div class="card-title" style="margin-bottom: 12px;">
                <span>✍️</span> 你的翻译
            </div>
            <textarea id="transInput" class="form-textarea" rows="8" placeholder="请在此输入你的中文翻译...">${item.userTranslation || ''}</textarea>
        </div>
        
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="submitTrans()" id="submitTransBtn">
                ✅ 提交翻译
            </button>
            <button class="btn btn-secondary" onclick="showTransReference()" id="showRefBtn" ${item.translated ? '' : 'disabled'}>
                📖 查看参考译文
            </button>
        </div>
        
        <div id="transResult" style="margin-top: 20px; display: none;"></div>
    `;
}

// 提交翻译
async function submitTrans() {
    const input = document.getElementById('transInput');
    const userTranslation = input.value.trim();
    
    if (!userTranslation) {
        showToast('请先输入翻译', 'warning');
        return;
    }
    
    const item = transState.items[transState.currentIndex];
    
    // 保存用户翻译
    AbstractTranslationStore.update(item.id, { userTranslation });
    
    // 检查是否有API
    const settings = typeof GlobalSettings !== 'undefined' ? GlobalSettings.get() : null;
    const hasApi = settings && settings.apiKey;
    
    const resultDiv = document.getElementById('transResult');
    const submitBtn = document.getElementById('submitTransBtn');
    const showRefBtn = document.getElementById('showRefBtn');
    
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ 正在评阅...';
    
    if (hasApi) {
        // 调用AI评阅
        try {
            const feedback = await evaluateTranslation(
                item.abstractEn || item.abstract || '',
                userTranslation,
                item.abstractCn || ''
            );
            
            if (feedback) {
                // 显示评语
                resultDiv.innerHTML = `
                    <div class="card" style="background: var(--hover-bg);">
                        <div style="margin-bottom: 12px;">
                            <span style="font-weight: 600;">评分: ${feedback.score || 'N/A'}/100</span>
                        </div>
                        <p style="margin-bottom: 12px; line-height: 1.6;">${escapeHtml(feedback.comment || '')}</p>
                        ${feedback.wrongWords && feedback.wrongWords.length > 0 ? `
                        <div>
                            <p style="font-weight: 600; margin-bottom: 8px;">📚 错误单词已加入词汇本:</p>
                            ${feedback.wrongWords.map(w => `
                                <div style="margin-bottom: 8px; padding: 8px; background: var(--card-bg); border-radius: 6px;">
                                    <div><strong>${escapeHtml(w.en)}</strong> → ${escapeHtml(w.cn)}</div>
                                    <div style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(w.defCn || w.defEn || '')}</div>
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>
                `;
                resultDiv.style.display = 'block';
                
                // 保存AI评语
                AbstractTranslationStore.update(item.id, { 
                    aiComment: feedback,
                    translated: true
                });
            } else {
                // 降级显示参考译文
                showTransReferenceOnly();
            }
        } catch (error) {
            console.error('评阅失败:', error);
            showToast('评阅失败，将显示参考译文', 'error');
            showTransReferenceOnly();
        }
    } else {
        // 无API，直接显示参考译文
        showTransReferenceOnly();
    }
    
    submitBtn.textContent = '✅ 已提交';
    submitBtn.disabled = false;
    showRefBtn.disabled = false;
}

// 显示参考译文
function showTransReferenceOnly() {
    const item = transState.items[transState.currentIndex];
    const resultDiv = document.getElementById('transResult');
    
    resultDiv.innerHTML = `
        <div class="card" style="background: var(--hover-bg);">
            <div class="card-title" style="margin-bottom: 12px;">
                <span>📖</span> 参考译文
            </div>
            <div style="margin-bottom: 16px;">
                <div style="font-weight: 600; margin-bottom: 4px;">中文标题:</div>
                <p>${escapeHtml(item.titleCn || '暂无')}</p>
            </div>
            <div style="margin-bottom: 16px;">
                <div style="font-weight: 600; margin-bottom: 4px;">中文摘要:</div>
                <p style="line-height: 1.8;">${escapeHtml(item.abstractCn || '暂无')}</p>
            </div>
            ${(item.keywordsCn || []).length > 0 ? `
            <div>
                <div style="font-weight: 600; margin-bottom: 4px;">中文关键词:</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${(item.keywordsCn || []).map(kw => `<span class="tag">${escapeHtml(kw)}</span>`).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    `;
    resultDiv.style.display = 'block';
}

// 跳过当前项
function skipTransItem() {
    transState.currentIndex++;
    showCurrentTransItem();
}

// 查看参考译文（按钮触发）
function showTransReference() {
    const item = transState.items[transState.currentIndex];
    transState.showingReference = true;
    
    const resultDiv = document.getElementById('transResult');
    resultDiv.innerHTML = `
        <div class="card" style="background: var(--hover-bg);">
            <div class="card-title" style="margin-bottom: 12px;">
                <span>📖</span> 参考译文
            </div>
            <div style="margin-bottom: 16px;">
                <div style="font-weight: 600; margin-bottom: 4px;">中文标题:</div>
                <p>${escapeHtml(item.titleCn || '暂无')}</p>
            </div>
            <div style="margin-bottom: 16px;">
                <div style="font-weight: 600; margin-bottom: 4px;">中文摘要:</div>
                <p style="line-height: 1.8;">${escapeHtml(item.abstractCn || '暂无')}</p>
            </div>
            ${(item.keywordsCn || []).length > 0 ? `
            <div>
                <div style="font-weight: 600; margin-bottom: 4px;">中文关键词:</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${(item.keywordsCn || []).map(kw => `<span class="tag">${escapeHtml(kw)}</span>`).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    `;
    resultDiv.style.display = 'block';
    
    // 标记为已翻译
    AbstractTranslationStore.update(item.id, { translated: true });
    
    // 继续下一题
    setTimeout(() => {
        transState.currentIndex++;
        showCurrentTransItem();
    }, 2000);
}

// AI评阅翻译
async function evaluateTranslation(englishAbstract, userTranslation, referenceTranslation) {
    const settings = GlobalSettings.get();
    const apiKey = settings.apiKey;
    
    if (!apiKey) return null;
    
    const prompt = `你是一位学术英语翻译教师。请对照以下内容：
- 英文原文摘要
- 用户翻译
- 参考中文翻译

请评价用户的翻译质量，指出：
1. 翻译是否准确
2. 是否有遗漏或错误
3. 错误的单词或短语

请以JSON格式返回：
{
  "score": 85,
  "comment": "整体翻译较为准确，但有几处小问题...",
  "wrongWords": [
    {"en": "passivation", "cn": "钝化", "defCn": "表面处理技术", "defEn": "Surface treatment technique", "ex": "The **passivation** layer improved stability."}
  ]
}`;

    try {
        // 使用硅基流动API
        const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: settings.model || 'Qwen/Qwen2.5-7B-Instruct',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: `英文原文：\n${englishAbstract}\n\n用户翻译：\n${userTranslation}\n\n参考译文：\n${referenceTranslation}` }
                ],
                temperature: 0.3,
                max_tokens: 1000
            })
        });
        
        if (!response.ok) {
            throw new Error(`API错误: ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (!content) return null;
        
        // 解析JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            
            // 将错误单词添加到词汇本
            if (result.wrongWords && Array.isArray(result.wrongWords)) {
                for (const word of result.wrongWords) {
                    VocabularyStore.add({
                        en: word.en,
                        cn: word.cn,
                        defCn: word.defCn || '',
                        defEn: word.defEn || '',
                        ex: word.ex || '',
                        category: 'custom'
                    });
                }
            }
            
            return result;
        }
        
        return null;
    } catch (error) {
        console.error('评阅失败:', error);
        return null;
    }
}

// 加载已翻译列表
function loadTransDoneList() {
    const list = document.getElementById('transDoneList');
    const done = AbstractTranslationStore.getDone();
    
    if (done.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <p>暂无已翻译的摘要</p>
                <p class="text-muted">完成练习后会显示在这里</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = done.map(item => `
        <div class="list-item" style="padding: 16px; border-bottom: 1px solid var(--border);">
            <div style="margin-bottom: 8px;">
                <span style="font-weight: 600;">${escapeHtml(item.titleEn || item.title || '无标题')}</span>
            </div>
            ${item.aiComment ? `
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;">
                评分: ${item.aiComment.score || 'N/A'}/100 | ${formatDate(item.translatedAt)}
            </div>
            ` : `
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;">
                ${formatDate(item.translatedAt)}
            </div>
            `}
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn btn-sm btn-secondary" onclick="reviewTransItem('${item.id}')">
                    🔄 复习
                </button>
                <button class="btn btn-sm btn-outline" onclick="resetTransItem('${item.id}')">
                    🔁 重新练习
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteTransItem('${item.id}')">
                    🗑️ 删除
                </button>
            </div>
        </div>
    `).join('');
}

// 复习翻译项
function reviewTransItem(id) {
    const item = AbstractTranslationStore.getDone().find(i => i.id === id);
    if (!item) return;
    
    transState.mode = 'review';
    transState.currentReviewId = id;
    transState.showingChinese = false;
    
    const area = document.getElementById('transPracticeArea');
    
    // 切换到练习标签
    document.querySelectorAll('#transTabs .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === 'transPractice');
    });
    document.getElementById('transPracticeTab')?.classList.add('active');
    document.getElementById('transDoneTab')?.classList.remove('active');
    
    area.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="color: var(--text-secondary); font-size: 0.9rem;">复习模式</span>
                <button class="btn btn-sm btn-secondary" onclick="exitTransReview()">
                    退出复习
                </button>
            </div>
            <div class="card-title" style="margin-bottom: 12px;">
                <span>📄</span> 英文标题
            </div>
            <p style="font-size: 1rem; line-height: 1.6; color: var(--text);">${escapeHtml(item.titleEn || item.title || '无标题')}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            <div class="card-title" style="margin-bottom: 12px;">
                <span>📝</span> 英文摘要
            </div>
            <p style="font-size: 0.95rem; line-height: 1.8; color: var(--text);">${escapeHtml(item.abstractEn || item.abstract || '')}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            <div class="card-title" style="margin-bottom: 12px;">
                <span>✍️</span> 用户翻译
            </div>
            <p style="font-size: 0.95rem; line-height: 1.8; color: var(--text); background: var(--hover-bg); padding: 12px; border-radius: 6px;">${escapeHtml(item.userTranslation || '无')}</p>
        </div>
        
        <button class="btn btn-primary" onclick="toggleTransReviewChinese('${id}')" id="toggleCnBtn">
            ${transState.showingChinese ? '🙈 隐藏中文' : '👀 显示中文'}
        </button>
        
        <div id="transReviewCn" style="margin-top: 20px; display: ${transState.showingChinese ? 'block' : 'none'};">
            <div class="card" style="background: var(--hover-bg);">
                <div class="card-title" style="margin-bottom: 12px;">
                    <span>📖</span> 中文标题
                </div>
                <p style="margin-bottom: 16px;">${escapeHtml(item.titleCn || '暂无')}</p>
                
                <div class="card-title" style="margin-bottom: 12px;">
                    <span>📖</span> 中文摘要
                </div>
                <p style="line-height: 1.8;">${escapeHtml(item.abstractCn || '暂无')}</p>
                
                ${item.aiComment ? `
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
                    <div style="font-weight: 600; margin-bottom: 8px;">📝 AI评语 (${item.aiComment.score}/100)</div>
                    <p style="line-height: 1.6;">${escapeHtml(item.aiComment.comment || '')}</p>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

// 切换复习中文显示
function toggleTransReviewChinese(id) {
    transState.showingChinese = !transState.showingChinese;
    
    const cnDiv = document.getElementById('transReviewCn');
    const toggleBtn = document.getElementById('toggleCnBtn');
    
    if (cnDiv) {
        cnDiv.style.display = transState.showingChinese ? 'block' : 'none';
    }
    if (toggleBtn) {
        toggleBtn.textContent = transState.showingChinese ? '🙈 隐藏中文' : '👀 显示中文';
    }
}

// 退出复习
function exitTransReview() {
    transState.mode = 'practice';
    transState.currentReviewId = null;
    showCurrentTransItem();
}

// 重置翻译项
function resetTransItem(id) {
    AbstractTranslationStore.reset(id);
    updateTransStats();
    loadTransDoneList();
    showToast('已重置，可重新练习', 'success');
}

// 删除翻译项
function deleteTransItem(id) {
    if (!confirm('确定要删除吗？')) return;
    AbstractTranslationStore.remove(id);
    updateTransStats();
    loadTransDoneList();
    showToast('已删除', 'success');
}

// 导出主标签切换函数
window.switchMainTab = switchMainTab;


// ===== 摘要翻译练习 =====

// 主标签切换
function switchMainTab(tab) {
    const vocabBtn = document.getElementById('vocabTabBtn');
    const transBtn = document.getElementById('transTabBtn');
    const vocabContent = document.getElementById('vocabContent');
    const transContent = document.getElementById('transContent');
    
    if (tab === 'vocab') {
        vocabBtn?.classList.add('active');
        transBtn?.classList.remove('active');
        vocabContent?.classList.remove('hidden');
        transContent?.classList.add('hidden');
    } else {
        vocabBtn?.classList.remove('active');
        transBtn?.classList.add('active');
        vocabContent?.classList.add('hidden');
        transContent?.classList.remove('hidden');
        updateTransStats();
        renderTransDoneList();
    }
}

// 翻译练习子标签切换
function switchTransTab(tab) {
    document.querySelectorAll('#transTabs .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.getElementById('transPracticeTab')?.classList.toggle('hidden', tab !== 'practice');
    document.getElementById('transDoneTab')?.classList.toggle('hidden', tab !== 'done');
    
    if (tab === 'done') {
        renderTransDoneList();
    }
}

// 更新翻译练习统计
function updateTransStats() {
    const pending = AbstractTranslationStore.getPending();
    const done = AbstractTranslationStore.getDone();
    
    document.getElementById('transPendingCount').textContent = pending.length;
    document.getElementById('transDoneCount').textContent = done.length;
}

// 当前翻译练习状态
let transPractice = null;

// 开始翻译练习
function startTransPractice() {
    const pending = AbstractTranslationStore.getPending();
    
    if (pending.length === 0) {
        showToast('暂无可练习的摘要卡片，请先在文献卡片页面导入', 'warning');
        return;
    }
    
    // 随机选择一张
    const randomIndex = Math.floor(Math.random() * pending.length);
    const card = pending[randomIndex];
    
    transPractice = {
        card: card,
        startedAt: Date.now()
    };
    
    // 显示练习界面
    document.getElementById('transStartArea')?.classList.add('hidden');
    document.getElementById('transPracticeArea')?.classList.remove('hidden');
    
    // 填充英文内容
    document.getElementById('transTitleEn').textContent = card.titleEn || '无标题';
    document.getElementById('transAbstractEn').textContent = card.abstractEn || '无摘要';
    document.getElementById('transKeywordsEn').textContent = (card.keywords || []).join(', ') || '无关键词';
    
    // 清空用户输入
    document.getElementById('transTitleInput').value = '';
    document.getElementById('transAbstractInput').value = '';
    
    // 隐藏参考译文和结果区域
    document.getElementById('transReferenceArea')?.classList.add('hidden');
    document.getElementById('transResultArea')?.classList.add('hidden');
    document.getElementById('transSubmitBtn')?.classList.remove('hidden');
    document.getElementById('transShowRefBtn')?.classList.remove('hidden');
}

// 提交翻译
function submitTranslation() {
    if (!transPractice) return;
    
    const titleCn = document.getElementById('transTitleInput').value.trim();
    const abstractCn = document.getElementById('transAbstractInput').value.trim();
    
    if (!titleCn || !abstractCn) {
        showToast('请完成标题和摘要的翻译', 'warning');
        return;
    }
    
    // 保存用户翻译
    transPractice.userTitle = titleCn;
    transPractice.userAbstract = abstractCn;
    
    // 显示参考译文按钮
    document.getElementById('transShowRefBtn')?.classList.remove('hidden');
    
    showToast('已记录您的翻译，请查看参考译文', 'success');
}

// 显示参考译文
function showReference() {
    if (!transPractice) return;
    
    const card = transPractice.card;
    
    // 显示参考译文区域
    document.getElementById('transReferenceArea')?.classList.remove('hidden');
    
    // 填充参考译文
    document.getElementById('transTitleCn').textContent = card.titleCn || '无中文标题';
    document.getElementById('transAbstractCn').textContent = card.abstractCn || '无中文摘要';
    document.getElementById('transKeywordsCn').textContent = (card.keywordsCn || []).join(', ') || '无中文关键词';
    
    // 显示结果区域
    document.getElementById('transResultArea')?.classList.remove('hidden');
    
    // 隐藏提交和显示参考按钮
    document.getElementById('transSubmitBtn')?.classList.add('hidden');
    document.getElementById('transShowRefBtn')?.classList.add('hidden');
}

// 标记翻译完成
function finishTransPractice() {
    if (!transPractice) return;
    
    // 标记为已完成
    AbstractTranslationStore.update(transPractice.card.paperId, {
        translated: true,
        userTranslation: {
            title: transPractice.userTitle,
            abstract: transPractice.userAbstract
        },
        translatedAt: Date.now()
    });
    
    showToast('翻译已完成！', 'success');
    
    // 重置状态
    transPractice = null;
    
    // 返回开始界面
    document.getElementById('transStartArea')?.classList.remove('hidden');
    document.getElementById('transPracticeArea')?.classList.add('hidden');
    
    updateTransStats();
    renderTransDoneList();
}

// 跳过当前卡片
function skipTransPractice() {
    if (!transPractice) return;
    
    transPractice = null;
    document.getElementById('transStartArea')?.classList.remove('hidden');
    document.getElementById('transPracticeArea')?.classList.add('hidden');
}

// 渲染已翻译列表
function renderTransDoneList() {
    const list = document.getElementById('transDoneList');
    if (!list) return;
    
    const done = AbstractTranslationStore.getDone();
    
    if (done.length === 0) {
        list.innerHTML = '<div class="empty-state">暂无已翻译的卡片</div>';
        return;
    }
    
    list.innerHTML = done.map(item => `
        <div class="trans-done-item" data-id="${item.paperId}">
            <div class="trans-done-header">
                <span class="trans-done-title">${item.titleEn || '无标题'}</span>
                <span class="trans-done-date">${formatDate(item.translatedAt)}</span>
            </div>
            <div class="trans-done-actions">
                <button class="btn-small" onclick="viewTransDetail('${item.paperId}')">查看详情</button>
                <button class="btn-small" onclick="retryTrans('${item.paperId}')">重新练习</button>
                <button class="btn-small btn-danger" onclick="deleteTransCard('${item.paperId}')">删除</button>
            </div>
        </div>
    `).join('');
}

// 格式化日期
function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// 查看翻译详情
function viewTransDetail(paperId) {
    const item = AbstractTranslationStore.getAll().find(i => i.paperId === paperId);
    if (!item) return;
    
    alert(`【原文标题】\n${item.titleEn}\n\n【参考译文】\n${item.titleCn}\n\n【您的翻译】\n${item.userTranslation?.title || '未记录'}\n\n---\n\n【原文摘要】\n${item.abstractEn?.substring(0, 200)}...\n\n【参考译文】\n${item.abstractCn?.substring(0, 200)}...\n\n【您的翻译】\n${item.userTranslation?.abstract?.substring(0, 200) || '未记录'}...`);
}

// 重新练习
function retryTrans(paperId) {
    // 重置状态
    AbstractTranslationStore.reset(paperId);
    
    // 刷新统计和列表
    updateTransStats();
    renderTransDoneList();
    
    showToast('已重置，可以重新练习', 'success');
}

// 删除翻译卡片
function deleteTransCard(paperId) {
    if (!confirm('确定要删除这张翻译卡片吗？')) return;
    
    AbstractTranslationStore.remove(paperId);
    
    updateTransStats();
    renderTransDoneList();
    
    showToast('已删除', 'success');
}