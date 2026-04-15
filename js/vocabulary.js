/**
 * vocabulary.js - 词汇本核心脚本
 * 实现完整的学习流程、进度保存和复习功能
 */

// 学习阶段枚举
const StudyPhase = {
    CARD: 'card',
    EN_CN: 'en_cn',
    CN_EN: 'cn_en',
    EN_DEF: 'en_def',
    DEF_EN: 'def_en',
    SENT_EN: 'sent_en',
    SENT_DEF: 'sent_def'
};

// 单词状态
const WordStatus = {
    NEW: 'new',
    STUDYING: 'studying',
    LEARNED: 'learned',
    MASTERED: 'mastered'
};

// 配置
const VOCAB_CONFIG = {
    DEFAULT_STUDY_COUNT: 50,
    DEFAULT_MASTER_COUNT: 12,
    ERROR_THRESHOLD: 3
};

// 学习设置
let SETTINGS = {
    speakEnabled: false,
    masterCount: VOCAB_CONFIG.DEFAULT_MASTER_COUNT,
    phaseEnCn: true,
    phaseCnEn: true,
    phaseEnDef: true,
    phaseDefEn: true
};

// 状态
let vocabulary = [];
let currentMode = null;
let currentPhase = StudyPhase.EN_CN;
let studyCount = VOCAB_CONFIG.DEFAULT_STUDY_COUNT;
let currentWordQueue = [];
let currentWordIndex = 0;
let wrongWordsInRound = [];
let currentRetryWord = null;
let isWaiting = false;
let hasShownCardThisWord = false;

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadData();
});

// 初始化事件监听
function initEventListeners() {
    // Tab切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // 学习按钮
    document.getElementById('startStudyBtn')?.addEventListener('click', () => startStudy('new'));
    document.getElementById('startReviewBtn')?.addEventListener('click', () => startStudy('review'));
    document.getElementById('quitStudyBtn')?.addEventListener('click', quitStudy);
    
    // 学习词数
    document.getElementById('studyCountSelect')?.addEventListener('change', (e) => {
        studyCount = parseInt(e.target.value);
        saveSettings();
    });
    
    // 设置
    document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
    document.getElementById('closeSettingsModal')?.addEventListener('click', closeSettings);
    document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettings);
    
    // 添加单词
    document.getElementById('addWordBtn')?.addEventListener('click', openAddWord);
    document.getElementById('closeAddWordModal')?.addEventListener('click', closeAddWord);
    document.getElementById('cancelAddWordBtn')?.addEventListener('click', closeAddWord);
    document.getElementById('confirmAddWordBtn')?.addEventListener('click', confirmAddWord);
    
    // 错词本
    document.getElementById('reviewWrongBtn')?.addEventListener('click', reviewWrong);
    document.getElementById('clearWrongBtn')?.addEventListener('click', clearWrongWords);
    
    // 筛选
    document.getElementById('allCategoryFilter')?.addEventListener('change', renderAllWords);
    document.getElementById('allStatusFilter')?.addEventListener('change', renderAllWords);
    document.getElementById('allSearchInput')?.addEventListener('input', debounce(renderAllWords, 300));
    
    // 模态框点击关闭
    document.getElementById('addWordModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'addWordModal') closeAddWord();
    });
    document.getElementById('settingsModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'settingsModal') closeSettings();
    });
}

// Tab切换
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tab}Tab`);
    });
    
    if (tab === 'all') renderAllWords();
    if (tab === 'wrong') renderWrongWords();
}

// 加载数据
function loadData() {
    vocabulary = VocabularyStore.getAll();
    
    // 标准化词汇格式（兼容新旧两种字段名）
    vocabulary = vocabulary.map(v => normalizeWord(v));
    
    if (vocabulary.length === 0) {
        vocabulary = getSampleVocabulary();
        VocabularyStore.key && Storage.set(VocabularyStore.key, vocabulary);
    }
    
    loadSettings();
    updateStats();
    updateStudyButtons();
}

// 标准化词汇格式（兼容新旧两种字段名）
function normalizeWord(v) {
    return {
        id: v.id,
        // 兼容新格式 (en, cn, defCn, defEn, ex) 和旧格式 (word, word_cn, definition_cn, definition_en, example)
        word: v.word || v.en || '',
        word_cn: v.word_cn || v.cn || '',
        definition_cn: v.definition_cn || v.defCn || '',
        definition_en: v.definition_en || v.defEn || '',
        example: v.example || v.ex || '',
        phonetic: v.phonetic || '',
        status: v.status || 'new',
        correct_count: v.correct_count || 0,
        error_count: v.error_count || 0,
        correct_streak: v.correct_streak || 0
    };
}

// 加载设置
function loadSettings() {
    const stored = Storage.get('vocabSettings', {});
    SETTINGS = { ...SETTINGS, ...stored };
    
    studyCount = SETTINGS.studyCount || VOCAB_CONFIG.DEFAULT_STUDY_COUNT;
    SETTINGS.masterCount = SETTINGS.masterCount || VOCAB_CONFIG.DEFAULT_MASTER_COUNT;
    
    const studyCountSelect = document.getElementById('studyCountSelect');
    if (studyCountSelect) studyCountSelect.value = studyCount;
    
    const masterCountSelect = document.getElementById('settingMasterCount');
    if (masterCountSelect) masterCountSelect.value = SETTINGS.masterCount;
}

// 保存设置
function saveSettings() {
    SETTINGS.studyCount = studyCount;
    SETTINGS.speakEnabled = document.getElementById('settingSpeak')?.checked || false;
    SETTINGS.masterCount = parseInt(document.getElementById('settingMasterCount')?.value || '12');
    
    SETTINGS.phaseEnCn = document.getElementById('settingEnCn')?.checked ?? true;
    SETTINGS.phaseCnEn = document.getElementById('settingCnEn')?.checked ?? true;
    SETTINGS.phaseEnDef = document.getElementById('settingEnDef')?.checked ?? true;
    SETTINGS.phaseDefEn = document.getElementById('settingDefEn')?.checked ?? true;
    
    Storage.set('vocabSettings', SETTINGS);
    showToast('设置已保存', 'success');
}

// 保存词汇
function saveVocabulary() {
    Storage.set(VocabularyStore.key, vocabulary);
}

// 更新统计
function updateStats() {
    const newCount = vocabulary.filter(v => v.status === 'new').length;
    const studyingCount = vocabulary.filter(v => v.status === 'studying').length;
    const learnedCount = vocabulary.filter(v => v.status === 'learned').length;
    const masteredCount = vocabulary.filter(v => v.status === 'mastered').length;
    const wrongCount = vocabulary.filter(v => (v.error_count || 0) >= VOCAB_CONFIG.ERROR_THRESHOLD).length;
    
    document.getElementById('newCount').textContent = newCount;
    document.getElementById('studyingCount').textContent = studyingCount;
    document.getElementById('learnedCount').textContent = learnedCount;
    document.getElementById('masteredCount').textContent = masteredCount;
    document.getElementById('wrongCount').textContent = wrongCount;
    
    updateStudyButtons();
}

function updateStudyButtons() {
    const newCount = vocabulary.filter(v => v.status === 'new' || v.status === 'studying').length;
    const learnedCount = vocabulary.filter(v => v.status === 'learned').length;
    
    const startStudyBtn = document.getElementById('startStudyBtn');
    const startReviewBtn = document.getElementById('startReviewBtn');
    
    if (startStudyBtn) {
        startStudyBtn.disabled = newCount === 0;
        startStudyBtn.textContent = `📖 学习 (${newCount})`;
    }
    if (startReviewBtn) {
        startReviewBtn.disabled = learnedCount === 0;
        startReviewBtn.textContent = `🔄 复习 (${learnedCount})`;
    }
}

// 开始学习/复习
function startStudy(mode) {
    currentMode = mode;
    currentWordIndex = 0;
    currentPhase = StudyPhase.EN_CN;
    wrongWordsInRound = [];
    currentRetryWord = null;
    hasShownCardThisWord = false;
    
    if (mode === 'new') {
        currentWordQueue = vocabulary
            .filter(v => v.status === 'new' || v.status === 'studying')
            .slice(0, studyCount)
            .map(v => ({ ...v }));
    } else {
        currentWordQueue = vocabulary
            .filter(v => v.status === 'learned')
            .slice(0, studyCount)
            .map(v => ({ ...v }));
    }
    
    if (currentWordQueue.length === 0) {
        showToast(mode === 'new' ? '没有可学习的词汇' : '没有可复习的词汇', 'error');
        return;
    }
    
    document.getElementById('studyControls')?.classList.add('hidden');
    document.getElementById('queueInfo')?.classList.remove('hidden');
    
    renderCurrentQuestion();
}

// 渲染当前问题
function renderCurrentQuestion() {
    const word = currentRetryWord || currentWordQueue[currentWordIndex];
    if (!word) {
        finishStudy();
        return;
    }
    
    updateProgress();
    
    if (currentPhase === StudyPhase.CARD) {
        renderCard(word);
    } else {
        renderQuestion(word);
    }
}

// 渲染单词卡片
function renderCard(word) {
    const area = document.getElementById('studyArea');
    
    area.innerHTML = `
        <div class="word-card-display">
            <div class="word">${escapeHtml(word.word)}</div>
            ${word.phonetic ? `<div class="phonetic">${escapeHtml(word.phonetic)}</div>` : ''}
            <div class="translation">${escapeHtml(word.word_cn)}</div>
            ${word.definition_cn ? `<div class="definition">中文释义: ${escapeHtml(word.definition_cn)}</div>` : ''}
            ${word.definition_en ? `<div class="definition">英文释义: ${escapeHtml(word.definition_en)}</div>` : ''}
            ${word.example ? `<div class="example">例句: ${formatExample(word.example, word.word)}</div>` : ''}
        </div>
        <div style="text-align: center;">
            <button class="btn btn-primary btn-lg" onclick="continueAfterCard()">继续</button>
        </div>
    `;
    
    if (SETTINGS.speakEnabled && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(word.word);
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
    }
}

function formatExample(example, word) {
    return example.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function continueAfterCard() {
    hasShownCardThisWord = true;
    
    if (currentRetryWord) {
        currentRetryWord = null;
        currentPhase = StudyPhase.EN_CN;
        nextWord();
    } else {
        currentPhase = StudyPhase.EN_CN;
        renderCurrentQuestion();
    }
}

// 渲染选择题
function renderQuestion(word) {
    const area = document.getElementById('studyArea');
    const isReview = currentMode === 'review';
    
    let question, options, correctAnswer;
    
    switch (currentPhase) {
        case StudyPhase.EN_CN:
            question = `<span class="question-word">${escapeHtml(word.word)}</span>`;
            if (SETTINGS.speakEnabled && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(word.word);
                utterance.lang = 'en-US';
                speechSynthesis.speak(utterance);
            }
            options = generateOptions(word, 'word_cn');
            correctAnswer = word.word_cn;
            break;
            
        case StudyPhase.CN_EN:
            question = `<span class="question-text">${escapeHtml(word.word_cn)}</span>`;
            options = generateOptions(word, 'word');
            correctAnswer = word.word;
            break;
            
        case StudyPhase.EN_DEF:
            question = `<span class="question-word">${escapeHtml(word.word)}</span>`;
            options = generateOptions(word, 'definition_cn');
            correctAnswer = word.definition_cn || word.word_cn;
            break;
            
        case StudyPhase.DEF_EN:
            question = `<span class="question-text">${escapeHtml(word.definition_cn || word.word_cn)}</span>`;
            options = generateOptions(word, 'word');
            correctAnswer = word.word;
            break;
            
        default:
            currentPhase = StudyPhase.EN_CN;
            renderCurrentQuestion();
            return;
    }
    
    updatePhaseBadge();
    
    area.innerHTML = `
        <div class="question-area">
            <div class="question-content">${question}</div>
            <div class="options-grid">
                ${options.map((opt, i) => `
                    <button class="option-btn" onclick="checkAnswer('${escapeAttr(opt)}', '${escapeAttr(correctAnswer)}', this)">
                        ${escapeHtml(opt)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

// 生成选项
function generateOptions(word, field) {
    const correctAnswer = word[field];
    if (!correctAnswer) return [word.word, word.word_cn];
    
    const otherWords = vocabulary.filter(v => v.id !== word.id && v[field]);
    const distractors = otherWords
        .map(v => v[field])
        .filter(val => val && val !== correctAnswer)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
    
    while (distractors.length < 3) {
        distractors.push(`选项${distractors.length + 2}`);
    }
    
    const options = [correctAnswer, ...distractors.slice(0, 3)];
    return options.sort(() => Math.random() - 0.5);
}

// 检查答案
function checkAnswer(selected, correct, btn) {
    const word = currentRetryWord || currentWordQueue[currentWordIndex];
    const isCorrect = selected === correct;
    
    if (isCorrect) {
        btn.classList.add('correct');
        
        if (currentPhase === StudyPhase.EN_CN && !hasShownCardThisWord && currentMode === 'new') {
            setTimeout(() => {
                currentPhase = StudyPhase.CARD;
                renderCurrentQuestion();
            }, 500);
            return;
        }
        
        setTimeout(() => nextPhase(), 500);
    } else {
        btn.classList.add('wrong');
        
        word.error_count = (word.error_count || 0) + 1;
        word.correct_streak = 0;
        
        if (currentPhase === StudyPhase.EN_CN) {
            setTimeout(() => {
                currentPhase = StudyPhase.CARD;
                currentRetryWord = word;
                renderCurrentQuestion();
            }, 500);
            return;
        }
        
        if (!wrongWordsInRound.find(w => w.id === word.id)) {
            wrongWordsInRound.push({ ...word, retryPhase: currentPhase });
        }
        
        setTimeout(() => renderCurrentQuestion(), 800);
    }
    
    saveVocabulary();
}

// 进入下一阶段
function nextPhase() {
    const phases = [StudyPhase.EN_CN, StudyPhase.CN_EN, StudyPhase.EN_DEF, StudyPhase.DEF_EN];
    const availablePhases = phases.filter(p => {
        if (p === StudyPhase.EN_CN && !SETTINGS.phaseEnCn) return false;
        if (p === StudyPhase.CN_EN && !SETTINGS.phaseCnEn) return false;
        if (p === StudyPhase.EN_DEF && !SETTINGS.phaseEnDef) return false;
        if (p === StudyPhase.DEF_EN && !SETTINGS.phaseDefEn) return false;
        return true;
    });
    
    const currentIndex = availablePhases.indexOf(currentPhase);
    
    if (currentIndex < availablePhases.length - 1) {
        currentPhase = availablePhases[currentIndex + 1];
        renderCurrentQuestion();
    } else {
        wordCompleted();
    }
}

// 单词完成一轮
function wordCompleted() {
    const word = currentRetryWord || currentWordQueue[currentWordIndex];
    
    if (!currentRetryWord) {
        if (word.status === 'new') {
            word.status = 'studying';
        }
        
        word.correct_streak = (word.correct_streak || 0) + 1;
        
        if (word.correct_streak >= SETTINGS.masterCount) {
            word.status = 'mastered';
        } else if (word.status === 'studying') {
            word.status = 'learned';
        }
        
        saveVocabulary();
    }
    
    currentRetryWord = null;
    hasShownCardThisWord = false;
    currentPhase = StudyPhase.EN_CN;
    nextWord();
}

// 下一个单词
function nextWord() {
    currentWordIndex++;
    
    if (currentWordIndex >= currentWordQueue.length) {
        if (wrongWordsInRound.length > 0) {
            currentRetryWord = wrongWordsInRound.shift();
            currentPhase = currentRetryWord.retryPhase || StudyPhase.EN_CN;
            hasShownCardThisWord = currentMode === 'review';
            renderCurrentQuestion();
        } else {
            finishStudy();
        }
    } else {
        hasShownCardThisWord = false;
        currentPhase = StudyPhase.EN_CN;
        renderCurrentQuestion();
    }
}

// 更新进度显示
function updateProgress() {
    const total = currentWordQueue.length;
    const current = currentWordIndex + 1;
    const percent = Math.round((currentWordIndex / total) * 100);
    
    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const wordProgress = document.getElementById('wordProgress');
    
    if (progressText) progressText.textContent = `第 ${current} / ${total} 个词`;
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressPercent) progressPercent.textContent = `${percent}%`;
    if (wordProgress) wordProgress.textContent = `第 ${current} / ${total} 个词`;
}

// 更新阶段徽章
function updatePhaseBadge() {
    const phaseNames = {
        [StudyPhase.EN_CN]: '英选中',
        [StudyPhase.CN_EN]: '中选英',
        [StudyPhase.EN_DEF]: '英选义',
        [StudyPhase.DEF_EN]: '义选英'
    };
    
    const phaseBadge = document.getElementById('phaseBadge');
    if (phaseBadge) phaseBadge.textContent = phaseNames[currentPhase] || '';
}

// 完成学习
function finishStudy() {
    const area = document.getElementById('studyArea');
    area.innerHTML = `
        <div class="study-complete">
            <div class="complete-icon">🎉</div>
            <h3>${currentMode === 'new' ? '学习' : '复习'}完成！</h3>
            <p>已完成 ${currentWordQueue.length} 个词汇</p>
            ${wrongWordsInRound.length > 0 ? `<p class="text-muted">错题已加入复习队列</p>` : ''}
            <div class="complete-actions">
                <button class="btn btn-outline" onclick="quitStudy()">返回</button>
                <button class="btn btn-primary" onclick="startStudy('${currentMode}')">继续${currentMode === 'new' ? '学习' : '复习'}</button>
            </div>
        </div>
    `;
    
    updateStats();
}

function quitStudy() {
    currentMode = null;
    currentWordQueue = [];
    currentWordIndex = 0;
    currentPhase = StudyPhase.EN_CN;
    wrongWordsInRound = [];
    currentRetryWord = null;
    
    document.getElementById('studyControls')?.classList.remove('hidden');
    document.getElementById('queueInfo')?.classList.add('hidden');
    
    const area = document.getElementById('studyArea');
    area.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">📖</div>
            <p>选择上方按钮开始学习！</p>
            <p class="text-muted">支持6种题型：英选中、中选英、英选义、义选英、句选中、句选义</p>
        </div>
    `;
    
    updateStats();
    renderAllWords();
}

// 渲染所有词汇
function renderAllWords() {
    const container = document.getElementById('allWordList');
    if (!container) return;
    
    const categoryFilter = document.getElementById('allCategoryFilter')?.value || '';
    const statusFilter = document.getElementById('allStatusFilter')?.value || '';
    const searchTerm = document.getElementById('allSearchInput')?.value?.toLowerCase() || '';
    
    let filtered = vocabulary.filter(word => {
        if (categoryFilter && word.category !== categoryFilter) return false;
        if (statusFilter && word.status !== statusFilter) return false;
        if (searchTerm) {
            const searchFields = [word.word, word.word_cn, word.definition_cn, word.definition_en].join(' ').toLowerCase();
            if (!searchFields.includes(searchTerm)) return false;
        }
        return true;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无词汇</p></div>';
        return;
    }
    
    container.innerHTML = filtered.map(word => `
        <div class="list-item" data-id="${word.id}">
            <div class="list-item-main">
                <div class="list-item-title">
                    ${escapeHtml(word.word)}
                    <span class="text-muted"> - ${escapeHtml(word.word_cn)}</span>
                </div>
                <div class="list-item-sub">
                    ${getStatusName(word.status)} · 正确 ${word.correct_count || 0} · 错误 ${word.error_count || 0}
                </div>
            </div>
            <div class="list-item-actions">
                <button class="btn btn-sm btn-danger" onclick="deleteWord('${word.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

function getStatusName(status) {
    const names = {
        'new': '新词',
        'studying': '学习中',
        'learned': '已学',
        'mastered': '已掌握'
    };
    return names[status] || status;
}

// 渲染错词本
function renderWrongWords() {
    const container = document.getElementById('wrongWordList');
    if (!container) return;
    
    const wrongWords = vocabulary.filter(v => (v.error_count || 0) >= VOCAB_CONFIG.ERROR_THRESHOLD);
    
    if (wrongWords.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无错词</p></div>';
        return;
    }
    
    container.innerHTML = wrongWords.map(word => `
        <div class="list-item" data-id="${word.id}">
            <div class="list-item-main">
                <div class="list-item-title">${escapeHtml(word.word)} - ${escapeHtml(word.word_cn)}</div>
                <div class="list-item-sub">错误 ${word.error_count} 次</div>
            </div>
        </div>
    `).join('');
}

function reviewWrong() {
    const wrongWords = vocabulary.filter(v => (v.error_count || 0) >= VOCAB_CONFIG.ERROR_THRESHOLD);
    if (wrongWords.length === 0) {
        showToast('没有错词需要复习', 'error');
        return;
    }
    
    currentMode = 'review';
    currentWordIndex = 0;
    currentPhase = StudyPhase.EN_CN;
    wrongWordsInRound = [];
    currentRetryWord = null;
    hasShownCardThisWord = false;
    
    currentWordQueue = wrongWords.map(v => ({ ...v }));
    
    document.getElementById('studyControls')?.classList.add('hidden');
    document.getElementById('queueInfo')?.classList.remove('hidden');
    
    renderCurrentQuestion();
}

function clearWrongWords() {
    if (!confirm('确定要清空错词本吗？')) return;
    
    vocabulary.forEach(v => {
        v.error_count = 0;
    });
    saveVocabulary();
    renderWrongWords();
    updateStats();
    showToast('错词本已清空', 'success');
}

// 添加单词
function openAddWord() {
    document.getElementById('addWordModal').classList.remove('hidden');
    document.getElementById('wordEn').value = '';
    document.getElementById('wordCn').value = '';
    document.getElementById('defCn').value = '';
    document.getElementById('defEn').value = '';
    document.getElementById('wordExample').value = '';
}

function closeAddWord() {
    document.getElementById('addWordModal').classList.add('hidden');
}

function confirmAddWord() {
    const word = document.getElementById('wordEn').value.trim();
    const word_cn = document.getElementById('wordCn').value.trim();
    const definition_cn = document.getElementById('defCn').value.trim();
    const definition_en = document.getElementById('defEn').value.trim();
    const example = document.getElementById('wordExample').value.trim();
    const category = document.getElementById('wordCategory').value;
    
    if (!word || !word_cn) {
        showToast('请填写英文词汇和中文翻译', 'error');
        return;
    }
    
    const result = VocabularyStore.add({
        word,
        word_cn,
        definition_cn,
        definition_en,
        example,
        category,
        phonetic: ''
    });
    
    if (result.success) {
        showToast('词汇添加成功！', 'success');
        closeAddWord();
        vocabulary = VocabularyStore.getAll();
        updateStats();
        renderAllWords();
    } else {
        showToast(result.message, 'warning');
    }
}

function deleteWord(id) {
    if (!confirm('确定要删除这个词汇吗？')) return;
    
    VocabularyStore.remove(id);
    vocabulary = VocabularyStore.getAll();
    updateStats();
    renderAllWords();
    showToast('词汇已删除', 'success');
}

// 设置模态框
function openSettings() {
    document.getElementById('settingsModal').classList.remove('hidden');
    
    document.getElementById('settingSpeak').checked = SETTINGS.speakEnabled;
    document.getElementById('settingMasterCount').value = SETTINGS.masterCount;
    document.getElementById('settingEnCn').checked = SETTINGS.phaseEnCn;
    document.getElementById('settingCnEn').checked = SETTINGS.phaseCnEn;
    document.getElementById('settingEnDef').checked = SETTINGS.phaseEnDef;
    document.getElementById('settingDefEn').checked = SETTINGS.phaseDefEn;
}

function closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
}

// 示例词汇
function getSampleVocabulary() {
    return [
        {
            id: 'sample-1',
            word: 'perovskite',
            word_cn: '钙钛矿',
            definition_cn: '一种具有ABX3晶体结构的半导体材料',
            definition_en: 'A semiconductor material with ABX3 crystal structure',
            example: '**Perovskite** solar cells have shown remarkable efficiency improvements.',
            phonetic: '/pəˈrɒvskаɪt/',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            correct_streak: 0,
            category: 'material'
        },
        {
            id: 'sample-2',
            word: 'photovoltaic',
            word_cn: '光伏的',
            definition_cn: '将光能直接转换为电能的',
            definition_en: 'Converting light directly into electricity',
            example: 'The **photovoltaic** effect is the basis for solar cell operation.',
            phonetic: '/ˌfəʊtəʊvɒlˈteɪɪk/',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            correct_streak: 0,
            category: 'concept'
        },
        {
            id: 'sample-3',
            word: 'efficiency',
            word_cn: '效率',
            definition_cn: '能量转换或工作的有效程度',
            definition_en: 'The ratio of useful output to input',
            example: 'The power conversion **efficiency** reached 25% in this device.',
            phonetic: '/ɪˈfɪʃənsi/',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            correct_streak: 0,
            category: 'concept'
        },
        {
            id: 'sample-4',
            word: 'interface',
            word_cn: '界面',
            definition_cn: '两种不同材料或相之间的接触面',
            definition_en: 'The boundary between two different phases or materials',
            example: 'The **interface** engineering is crucial for device performance.',
            phonetic: '/ˈɪntəfeɪs/',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            correct_streak: 0,
            category: 'concept'
        },
        {
            id: 'sample-5',
            word: 'carrier',
            word_cn: '载流子',
            definition_cn: '在半导体中携带电荷的电子或空穴',
            definition_en: 'Electrons or holes that carry charge in a semiconductor',
            example: 'The **carrier** mobility determines the transport properties.',
            phonetic: '/ˈkæriə/',
            status: 'new',
            correct_count: 0,
            error_count: 0,
            correct_streak: 0,
            category: 'concept'
        }
    ];
}
