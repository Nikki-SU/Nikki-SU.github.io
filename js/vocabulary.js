/**
 * vocabulary.js - 词汇本核心脚本
 * 实现完整的学习流程、进度保存和复习功能
 */

// 学习阶段枚举
const StudyPhase = {
    CARD: 'card',           // 展示单词卡片
    EN_CN: 'en_cn',         // 英文 -> 选中文
    CN_EN: 'cn_en',         // 中文 -> 选英文
    EN_DEF: 'en_def',       // 英文 -> 选释义
    DEF_EN: 'def_en',       // 释义 -> 选英文
    SENT_EN: 'sent_en',     // 例句 -> 选英文（选出例句中标粗的词）
    SENT_CN: 'sent_cn'      // 例句 -> 选中文（选出例句中标粗词的中文释义）
};

// 单词状态
const WordStatus = {
    NEW: 'new',             // 新词
    STUDYING: 'studying',   // 正在学
    LEARNED: 'learned',     // 已学
    MASTERED: 'mastered'    // 已掌握
};

// 配置
const CONFIG = {
    vocabularyUrl: 'data/vocabulary.json',
    DEFAULT_STUDY_COUNT: 50,
    DEFAULT_MASTER_COUNT: 12,
    ERROR_THRESHOLD: 3
};

// 学习设置（默认值）- 6种题型
let SETTINGS = {
    speakEnabled: false,
    cutEnabled: false,
    masterCount: 12,
    phaseEnCn: true,        // 英选中
    phaseCnEn: true,        // 中选英
    phaseEnDef: true,       // 英选义
    phaseDefEn: true,       // 义选英
    phaseSentEn: true,      // 句选中
    phaseSentCn: true,      // 句选义
    autoSync: false,        // 自动同步开关
    lastSyncDate: null      // 上次同步日期
};

// 状态
let vocabulary = [];
let currentMode = null;      // 'new' | 'review'
let currentPhase = StudyPhase.EN_CN;
let studyCount = CONFIG.DEFAULT_STUDY_COUNT;
let currentWordQueue = [];
let currentWordIndex = 0;
let wrongWordsInRound = [];
let currentRetryWord = null;
let studyProgress = {};
let isWaiting = false;
let hasShownCardThisWord = false;  // 当前单词本轮是否已显示过卡片

// DOM元素
const elements = {};

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initEventListeners();
    loadData();
});

function initElements() {
    elements.studyArea = document.getElementById('studyArea');
    elements.queueInfo = document.getElementById('queueInfo');
    elements.studyControls = document.getElementById('studyControls');
    elements.studyResult = document.getElementById('studyResult');
    elements.queueBadge = document.getElementById('queueBadge');
    elements.phaseBadge = document.getElementById('phaseBadge');
    elements.wordProgress = document.getElementById('wordProgress');
    elements.progressText = document.getElementById('progressText');
    elements.progressFill = document.getElementById('progressFill');
    elements.allWordList = document.getElementById('allWordList');
    elements.wrongWordList = document.getElementById('wrongWordList');
}

function initEventListeners() {
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.querySelector('.nav');
    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => nav.classList.toggle('active'));
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('startStudyBtn')?.addEventListener('click', () => startStudy('new'));
    document.getElementById('startReviewBtn')?.addEventListener('click', () => startStudy('review'));
    document.getElementById('quitStudyBtn')?.addEventListener('click', quitStudy);
    document.getElementById('backToStudyBtn')?.addEventListener('click', backToStudy);

    document.getElementById('studyCountSelect')?.addEventListener('change', (e) => {
        studyCount = parseInt(e.target.value);
        saveSettings();
    });

    document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
    document.getElementById('closeSettings')?.addEventListener('click', closeSettings);
    document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettings);
    document.getElementById('settingCut')?.addEventListener('change', (e) => {
        SETTINGS.cutEnabled = e.target.checked;
    });

    // 同步按钮
    document.getElementById('syncToAppBtn')?.addEventListener('click', syncToVocabApp);
    document.getElementById('autoSyncToggle')?.addEventListener('change', (e) => {
        SETTINGS.autoSync = e.target.checked;
        saveSettings();
    });

    document.getElementById('addWordBtn')?.addEventListener('click', openAddWord);
    document.getElementById('closeAddWord')?.addEventListener('click', closeAddWord);
    document.getElementById('cancelAddWord')?.addEventListener('click', closeAddWord);
    document.getElementById('addWordForm')?.addEventListener('submit', handleAddWord);

    document.getElementById('reviewWrongBtn')?.addEventListener('click', () => reviewWrong());
    document.getElementById('clearWrongBtn')?.addEventListener('click', clearWrongWords);

    document.getElementById('masteredCount')?.parentElement?.addEventListener('click', openMastered);
    document.getElementById('closeMastered')?.addEventListener('click', closeMastered);
    document.getElementById('masteredSearchInput')?.addEventListener('input', debounce(renderMasteredList, 300));

    document.getElementById('allCategoryFilter')?.addEventListener('change', renderAllWords);
    document.getElementById('allStatusFilter')?.addEventListener('change', renderAllWords);
    document.getElementById('allSearchInput')?.addEventListener('input', debounce(renderAllWords, 300));

    document.getElementById('settingsModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'settingsModal') closeSettings();
    });
    document.getElementById('addWordModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'addWordModal') closeAddWord();
    });
    document.getElementById('masteredModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'masteredModal') closeMastered();
    });
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tab}Mode`);
    });

    if (tab === 'all') renderAllWords();
    if (tab === 'wrong') renderWrongWords();
}

/**
 * 同步到小N单词App
 */
async function syncToVocabApp() {
    const btn = document.getElementById('syncToAppBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '同步中...';
    }

    try {
        // 准备同步的词汇数据（使用新格式：en/cn/defCn/defEn/ex）
        const wordsToSync = vocabulary.map(w => ({
            en: w.en || w.word || '',
            cn: w.cn || w.word_cn || '',
            defCn: w.defCn || w.definition_cn || '',
            defEn: w.defEn || w.definition_en || '',
            ex: w.ex || w.example || ''
        }));

        let added = 0;
        let skipped = 0;

        if (typeof window.vocabApp !== 'undefined' && typeof window.vocabApp.importToBook === 'function') {
            // 调用小N单词App的导入接口
            const result = window.vocabApp.importToBook('academic', wordsToSync, '学术站词汇');
            added = result.added || 0;
            skipped = result.skipped || 0;
        } else {
            // 如果vocabApp未定义，通过localStorage共享
            const STORAGE_KEY = 'vocab_books_v1';
            let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            if (!data.books) data.books = {};
            if (!data.books['academic']) {
                data.books['academic'] = {
                    name: '学术站词汇',
                    words: [],
                    settings: { learnCount: 50, reviewCount: 10, masterCount: 12, speak: true, allowZhan: false, types: [1,2,3,4,5,6] },
                    progress: null
                };
            }
            
            const existingEns = new Set(data.books['academic'].words.map(w => (w.en || '').toLowerCase()));
            wordsToSync.forEach(w => {
                if (w.en && !existingEns.has(w.en.toLowerCase())) {
                    data.books['academic'].words.push({
                        ...w,
                        cardShown: false,
                        streak: 0,
                        wrongCount: 0,
                        correctTypes: []
                    });
                    added++;
                } else {
                    skipped++;
                }
            });
            
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }

        // 更新同步状态
        SETTINGS.lastSyncDate = new Date().toISOString();
        saveSettings();

        // 显示结果
        showSyncResult(added, skipped);

    } catch (error) {
        console.error('同步失败:', error);
        alert('同步失败: ' + error.message);
    }

    if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄 同步到小N单词';
    }
}

/**
 * 显示同步结果
 */
function showSyncResult(added, skipped) {
    const result = `✅ 同步完成！
新增: ${added} 个
跳过: ${skipped} 个
总计词汇: ${vocabulary.length} 个`;
    alert(result);
}

/**
 * 检查是否需要自动同步
 */
function checkAutoSync() {
    if (!SETTINGS.autoSync) return;

    const today = new Date().toISOString().split('T')[0];
    const lastSync = SETTINGS.lastSyncDate?.split('T')[0];

    if (lastSync !== today) {
        syncToVocabApp();
    }
}

/**
 * 加载数据
 * 原则：localStorage有就用localStorage的（即使是空数组），没有才从文件读取
 */
async function loadData() {
    const stored = localStorage.getItem('vocabularyData');
    
    // localStorage有数据（包括空数组[]）就用它
    if (stored !== null) {
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                vocabulary = parsed;
                console.log('从localStorage加载词汇:', vocabulary.length, '个');
            }
        } catch (e) {
            console.error('词汇localStorage解析失败:', e);
        }
    } else {
        // localStorage完全没有数据（null），才从文件读取
        try {
            const response = await fetch(CONFIG.vocabularyUrl);
            if (response.ok) {
                const data = await response.json();
                vocabulary = Array.isArray(data) ? data : [];
            }
        } catch (error) {
            console.error('加载词汇文件失败:', error);
            vocabulary = [];
        }

        if (vocabulary.length === 0) {
            vocabulary = getSampleVocabulary();
        }
        
        // 首次加载，保存到localStorage
        localStorage.setItem('vocabularyData', JSON.stringify(vocabulary));
        console.log('首次加载词汇:', vocabulary.length, '个');
    }

    loadSettings();

    const savedProgress = localStorage.getItem('studyProgress');
    if (savedProgress) {
        studyProgress = JSON.parse(savedProgress);
    }

    updateStats();
    updateStudyButtons();
    checkAutoSync();
}

function loadSettings() {
    const stored = localStorage.getItem('vocabularySettings');
    if (stored) {
        SETTINGS = { ...SETTINGS, ...JSON.parse(stored) };
    }
    
    studyCount = SETTINGS.studyCount || CONFIG.DEFAULT_STUDY_COUNT;
    SETTINGS.masterCount = SETTINGS.masterCount || CONFIG.DEFAULT_MASTER_COUNT;
    
    // 应用设置到UI
    const studyCountSelect = document.getElementById('studyCountSelect');
    if (studyCountSelect) studyCountSelect.value = studyCount;
    
    const masterCountSelect = document.getElementById('masterCountSelect');
    if (masterCountSelect) masterCountSelect.value = SETTINGS.masterCount;

    // 应用题型开关到UI
    const typeToggles = {
        'settingEnCn': 'phaseEnCn',
        'settingCnEn': 'phaseCnEn',
        'settingEnDef': 'phaseEnDef',
        'settingDefEn': 'phaseDefEn',
        'settingSentEn': 'phaseSentEn',
        'settingSentCn': 'phaseSentCn'
    };

    Object.entries(typeToggles).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.checked = SETTINGS[key];
    });

    // 自动同步开关
    const autoSyncToggle = document.getElementById('autoSyncToggle');
    if (autoSyncToggle) autoSyncToggle.checked = SETTINGS.autoSync;
}

function saveSettings() {
    SETTINGS.studyCount = studyCount;
    localStorage.setItem('vocabularySettings', JSON.stringify(SETTINGS));
}

function saveVocabulary() {
    localStorage.setItem('vocabularyData', JSON.stringify(vocabulary));
}

function saveProgress() {
    localStorage.setItem('studyProgress', JSON.stringify(studyProgress));
}

/**
 * 更新统计
 */
function updateStats() {
    const newCount = vocabulary.filter(v => v.status === 'new').length;
    const studyingCount = vocabulary.filter(v => v.status === 'studying').length;
    const learnedCount = vocabulary.filter(v => v.status === 'learned').length;
    const masteredCount = vocabulary.filter(v => v.status === 'mastered').length;
    const wrongCount = vocabulary.filter(v => (v.error_count || 0) >= CONFIG.ERROR_THRESHOLD).length;

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
        startStudyBtn.textContent = `📚 学习 (${newCount})`;
    }
    if (startReviewBtn) {
        startReviewBtn.disabled = learnedCount === 0;
        startReviewBtn.textContent = `🔄 复习 (${learnedCount})`;
    }
}

/**
 * 开始学习/复习
 */
function startStudy(mode) {
    currentMode = mode;
    currentWordIndex = 0;
    currentPhase = StudyPhase.EN_CN;
    wrongWordsInRound = [];
    currentRetryWord = null;
    hasShownCardThisWord = false;

    // 获取词汇队列
    if (mode === 'new') {
        // 学习：新词 + 正在学的词
        currentWordQueue = vocabulary
            .filter(v => v.status === 'new' || v.status === 'studying')
            .slice(0, studyCount)
            .map(v => ({ ...v }));
    } else {
        // 复习：已学的词
        currentWordQueue = vocabulary
            .filter(v => v.status === 'learned')
            .slice(0, studyCount)
            .map(v => ({ ...v }));
    }

    if (currentWordQueue.length === 0) {
        alert(mode === 'new' ? '没有可学习的词汇' : '没有可复习的词汇');
        return;
    }

    // 显示学习界面
    document.getElementById('studyMode').classList.add('active');
    document.getElementById('allMode').classList.remove('active');
    document.getElementById('wrongMode').classList.remove('active');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    renderCurrentQuestion();
}

/**
 * 渲染当前问题
 */
function renderCurrentQuestion() {
    const word = currentRetryWord || currentWordQueue[currentWordIndex];
    if (!word) {
        finishStudy();
        return;
    }

    const area = elements.studyArea;
    area.innerHTML = '';

    // 更新进度
    updateProgress();

    // 根据阶段渲染题目
    if (currentPhase === StudyPhase.CARD) {
        renderCard(word);
    } else {
        renderQuestion(word);
    }
}

/**
 * 渲染单词卡片
 */
function renderCard(word) {
    const area = elements.studyArea;
    
    area.innerHTML = `
        <div class="word-card">
            <div class="card-word">${escapeHtml(word.en || word.word)}</div>
            <div class="card-phonetic">${escapeHtml(word.phonetic || '')}</div>
            <div class="card-cn">${escapeHtml(word.cn || word.word_cn)}</div>
            <div class="card-def">
                <p><strong>中文释义：</strong>${escapeHtml(word.defCn || word.definition_cn || '')}</p>
                <p><strong>英文释义：</strong>${escapeHtml(word.defEn || word.definition_en || '')}</p>
            </div>
            ${(word.ex || word.example) ? `
                <div class="card-example">
                    <strong>例句：</strong>${formatExample(word.ex || word.example, word.en || word.word)}
                </div>
            ` : ''}
        </div>
        <div class="card-actions">
            <button class="btn btn-primary btn-lg" onclick="continueAfterCard()">继续</button>
        </div>
    `;

    // 朗读
    if (SETTINGS.speakEnabled && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(word.en || word.word);
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
    }
}

/**
 * 格式化例句（将标粗的词保持标粗）
 */
function formatExample(example, word) {
    // 例句中已经用**word**格式标粗
    return example.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/**
 * 卡片后继续
 */
function continueAfterCard() {
    hasShownCardThisWord = true;
    
    if (currentRetryWord) {
        // 重做完成，回到队列末尾
        currentRetryWord = null;
        currentPhase = StudyPhase.EN_CN;
        nextWord();
    } else {
        // 正常流程，进入英选中
        currentPhase = StudyPhase.EN_CN;
        renderCurrentQuestion();
    }
}

/**
 * 渲染选择题 - 6种题型
 */
function renderQuestion(word) {
    const area = elements.studyArea;
    const isReview = currentMode === 'review';
    const useEnDef = isReview; // 复习用英文释义，学习用中文释义

    let question, options, correctAnswer;

    switch (currentPhase) {
        case StudyPhase.EN_CN: // 英选中
            question = `<span class="question-word">${escapeHtml(word.en || word.word)}</span>`;
            if (SETTINGS.speakEnabled && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(word.en || word.word);
                utterance.lang = 'en-US';
                speechSynthesis.speak(utterance);
            }
            options = generateOptions(word, 'cn');
            correctAnswer = word.cn || word.word_cn;
            break;

        case StudyPhase.CN_EN: // 中选英
            question = `<span class="question-text">${escapeHtml(word.cn || word.word_cn)}</span>`;
            options = generateOptions(word, 'en');
            correctAnswer = word.en || word.word;
            break;

        case StudyPhase.EN_DEF: // 英选义
            question = `<span class="question-word">${escapeHtml(word.en || word.word)}</span>`;
            options = generateOptions(word, useEnDef ? 'defEn' : 'defCn');
            correctAnswer = useEnDef ? (word.defEn || word.definition_en) : (word.defCn || word.definition_cn);
            break;

        case StudyPhase.DEF_EN: // 义选英
            const defKey = useEnDef ? 'defEn' : 'defCn';
            const defValue = useEnDef ? (word.definition_en || word.defEn) : (word.definition_cn || word.defCn);
            question = `<span class="question-text">${escapeHtml(word[defKey] || defValue)}</span>`;
            options = generateOptions(word, 'en');
            correctAnswer = word.en || word.word;
            break;

        case StudyPhase.SENT_EN: // 句选中
            question = `<div class="question-sentence">${formatExample(word.ex || word.example, word.en || word.word)}</div>
                        <p class="question-hint">选出句中标粗的词汇</p>`;
            options = generateOptions(word, 'en');
            correctAnswer = word.en || word.word;
            break;

        case StudyPhase.SENT_CN: // 句选义
            question = `<div class="question-sentence">${formatExample(word.ex || word.example, word.en || word.word)}</div>
                        <p class="question-hint">选出句中标粗词汇的中文释义</p>`;
            options = generateOptions(word, 'cn');
            correctAnswer = word.cn || word.word_cn;
            break;
    }

    // 更新阶段显示
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

/**
 * 生成选项
 */
function generateOptions(word, field) {
    // 兼容新旧字段名
    const fieldMapping = {
        'en': ['en', 'word'],
        'cn': ['cn', 'word_cn'],
        'defCn': ['defCn', 'definition_cn'],
        'defEn': ['defEn', 'definition_en']
    };
    
    let correctAnswer;
    if (fieldMapping[field]) {
        for (const f of fieldMapping[field]) {
            if (word[f]) {
                correctAnswer = word[f];
                break;
            }
        }
    } else {
        correctAnswer = word[field];
    }
    
    if (!correctAnswer) return [word.en || word.word, word.cn || word.word_cn];

    // 获取其他词汇的同字段值作为干扰项
    const otherWords = vocabulary.filter(v => v.id !== word.id);
    const distractors = [];
    
    for (const f of (fieldMapping[field] || [field])) {
        otherWords.forEach(v => {
            if (v[f] && v[f] !== correctAnswer && !distractors.includes(v[f])) {
                distractors.push(v[f]);
            }
        });
        if (distractors.length >= 3) break;
    }
    
    distractors.sort(() => Math.random() - 0.5);
    distractors.splice(3);

    // 如果干扰项不足，用默认值填充
    while (distractors.length < 3) {
        distractors.push(`选项${distractors.length + 2}`);
    }

    // 打乱顺序
    const options = [correctAnswer, ...distractors.slice(0, 3)];
    return options.sort(() => Math.random() - 0.5);
}

/**
 * 检查答案
 */
function checkAnswer(selected, correct, btn) {
    const word = currentRetryWord || currentWordQueue[currentWordIndex];
    const isCorrect = selected === correct;

    if (isCorrect) {
        btn.classList.add('correct');
        
        // 检查是否是英选中且需要显示卡片
        if (currentPhase === StudyPhase.EN_CN && !hasShownCardThisWord && currentMode === 'new') {
            // 第一次英选中正确，显示卡片
            setTimeout(() => {
                currentPhase = StudyPhase.CARD;
                renderCurrentQuestion();
            }, 500);
            return;
        }

        // 进入下一阶段
        setTimeout(() => nextPhase(), 500);
    } else {
        btn.classList.add('wrong');
        
        // 答错处理
        word.error_count = (word.error_count || 0) + 1;
        
        // 清零连续正确次数
        word.correct_streak = 0;

        // 英选中做错：立即弹卡片重做
        if (currentPhase === StudyPhase.EN_CN) {
            setTimeout(() => {
                currentPhase = StudyPhase.CARD;
                currentRetryWord = word;
                renderCurrentQuestion();
            }, 500);
            return;
        }

        // 其他题型做错：加到错题队列，本轮末尾补做
        if (!wrongWordsInRound.find(w => w.id === word.id)) {
            wrongWordsInRound.push({ ...word, retryPhase: currentPhase });
        }

        // 继续当前阶段
        setTimeout(() => renderCurrentQuestion(), 800);
    }

    saveVocabulary();
}

/**
 * 获取启用的题型列表
 */
function getEnabledPhases() {
    const phases = [];
    
    if (SETTINGS.phaseEnCn) phases.push(StudyPhase.EN_CN);      // 英选中
    if (SETTINGS.phaseCnEn) phases.push(StudyPhase.CN_EN);      // 中选英
    if (SETTINGS.phaseEnDef) phases.push(StudyPhase.EN_DEF);     // 英选义
    if (SETTINGS.phaseDefEn) phases.push(StudyPhase.DEF_EN);    // 义选英
    if (SETTINGS.phaseSentEn) phases.push(StudyPhase.SENT_EN);   // 句选中
    if (SETTINGS.phaseSentCn) phases.push(StudyPhase.SENT_CN);   // 句选义
    
    return phases;
}

/**
 * 进入下一阶段
 */
function nextPhase() {
    const enabledPhases = getEnabledPhases();
    const currentIndex = enabledPhases.indexOf(currentPhase);
    
    if (currentIndex < enabledPhases.length - 1) {
        currentPhase = enabledPhases[currentIndex + 1];
        renderCurrentQuestion();
    } else {
        // 该词完成
        wordCompleted();
    }
}

/**
 * 单词完成一轮
 */
function wordCompleted() {
    const word = currentRetryWord || currentWordQueue[currentWordIndex];
    
    if (!currentRetryWord) {
        // 更新状态
        if (word.status === 'new') {
            word.status = 'studying';
        }
        
        // 增加连续正确次数
        word.correct_streak = (word.correct_streak || 0) + 1;
        
        // 检查是否掌握
        if (word.correct_streak >= SETTINGS.masterCount) {
            word.status = 'mastered';
        } else if (word.status === 'studying') {
            word.status = 'learned';
        }

        saveVocabulary();
        saveProgress();
    }

    currentRetryWord = null;
    hasShownCardThisWord = false;
    currentPhase = StudyPhase.EN_CN;
    nextWord();
}

/**
 * 下一个单词
 */
function nextWord() {
    currentWordIndex++;

    if (currentWordIndex >= currentWordQueue.length) {
        // 检查是否有错题需要补做
        if (wrongWordsInRound.length > 0) {
            currentRetryWord = wrongWordsInRound.shift();
            currentPhase = currentRetryWord.retryPhase || StudyPhase.EN_CN;
            hasShownCardThisWord = currentMode === 'review'; // 复习不弹卡片
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

/**
 * 更新进度显示
 */
function updateProgress() {
    const total = currentWordQueue.length;
    const current = currentWordIndex + 1;
    const percent = Math.round((currentWordIndex / total) * 100);

    if (elements.progressText) {
        elements.progressText.textContent = `${current} / ${total}`;
    }
    if (elements.progressFill) {
        elements.progressFill.style.width = `${percent}%`;
    }
}

/**
 * 更新阶段徽章 - 6种题型
 */
function updatePhaseBadge() {
    const phaseNames = {
        [StudyPhase.EN_CN]: '英选中',
        [StudyPhase.CN_EN]: '中选英',
        [StudyPhase.EN_DEF]: currentMode === 'review' ? '英选义(英)' : '英选义(中)',
        [StudyPhase.DEF_EN]: currentMode === 'review' ? '义选英(英)' : '义选英(中)',
        [StudyPhase.SENT_EN]: '句选中',
        [StudyPhase.SENT_CN]: '句选义'
    };

    if (elements.phaseBadge) {
        elements.phaseBadge.textContent = phaseNames[currentPhase] || '';
    }
}

/**
 * 完成学习
 */
function finishStudy() {
    elements.studyArea.innerHTML = `
        <div class="study-complete">
            <div class="complete-icon">🎉</div>
            <h3>${currentMode === 'new' ? '学习' : '复习'}完成！</h3>
            <p>已完成 ${currentWordQueue.length} 个词汇</p>
            ${wrongWordsInRound.length > 0 ? `<p class="text-muted">错题已加入复习队列</p>` : ''}
            <div class="complete-actions">
                <button class="btn btn-outline" onclick="quitStudy()">返回</button>
                <button class="btn btn-primary" onclick="continueStudy()">继续${currentMode === 'new' ? '学习' : '复习'}</button>
            </div>
        </div>
    `;

    updateStats();
}

function continueStudy() {
    startStudy(currentMode);
}

function quitStudy() {
    currentMode = null;
    currentWordQueue = [];
    currentWordIndex = 0;
    currentPhase = StudyPhase.EN_CN;
    wrongWordsInRound = [];
    currentRetryWord = null;

    document.getElementById('studyMode').classList.remove('active');
    document.getElementById('allMode').classList.add('active');
    document.querySelector('.tab-btn[data-tab="all"]').classList.add('active');

    updateStats();
    renderAllWords();
}

function backToStudy() {
    if (currentWordQueue.length > 0) {
        renderCurrentQuestion();
    } else {
        quitStudy();
    }
}

/**
 * 渲染所有词汇
 */
function renderAllWords() {
    const container = elements.allWordList;
    if (!container) return;

    const categoryFilter = document.getElementById('allCategoryFilter')?.value || '';
    const statusFilter = document.getElementById('allStatusFilter')?.value || '';
    const searchTerm = document.getElementById('allSearchInput')?.value?.toLowerCase() || '';

    let filtered = vocabulary.filter(word => {
        if (categoryFilter && word.category !== categoryFilter) return false;
        if (statusFilter && word.status !== statusFilter) return false;
        if (searchTerm) {
            const searchFields = [word.en || word.word, word.cn || word.word_cn, word.defCn || word.definition_cn, word.defEn || word.definition_en].join(' ').toLowerCase();
            if (!searchFields.includes(searchTerm)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无词汇</p></div>';
        return;
    }

    container.innerHTML = filtered.map(word => `
        <div class="word-item" data-id="${word.id}">
            <div class="word-main">
                <span class="word-text">${escapeHtml(word.en || word.word)}</span>
                <span class="word-cn">${escapeHtml(word.cn || word.word_cn)}</span>
                <span class="word-status status-${word.status}">${getStatusName(word.status)}</span>
            </div>
            <div class="word-actions">
                <button class="btn btn-sm btn-outline" onclick="editWord('${word.id}')">编辑</button>
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

/**
 * 渲染错词本
 */
function renderWrongWords() {
    const container = elements.wrongWordList;
    if (!container) return;

    const wrongWords = vocabulary.filter(v => (v.error_count || 0) >= CONFIG.ERROR_THRESHOLD);

    if (wrongWords.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无错词</p></div>';
        return;
    }

    container.innerHTML = wrongWords.map(word => `
        <div class="word-item" data-id="${word.id}">
            <div class="word-main">
                <span class="word-text">${escapeHtml(word.en || word.word)}</span>
                <span class="word-cn">${escapeHtml(word.cn || word.word_cn)}</span>
                <span class="error-count">错${word.error_count}次</span>
            </div>
        </div>
    `).join('');
}

function reviewWrong() {
    const wrongWords = vocabulary.filter(v => (v.error_count || 0) >= CONFIG.ERROR_THRESHOLD);
    if (wrongWords.length === 0) {
        alert('没有错词需要复习');
        return;
    }
    
    // 临时将错词作为学习队列
    currentMode = 'review';
    currentWordQueue = wrongWords.map(w => ({ ...w }));
    currentWordIndex = 0;
    currentPhase = StudyPhase.EN_CN;
    wrongWordsInRound = [];
    
    document.getElementById('studyMode').classList.add('active');
    document.getElementById('allMode').classList.remove('active');
    document.getElementById('wrongMode').classList.remove('active');
    
    renderCurrentQuestion();
}

function clearWrongWords() {
    if (!confirm('确定要清空错词本吗？')) return;
    
    vocabulary.forEach(word => {
        if ((word.error_count || 0) >= CONFIG.ERROR_THRESHOLD) {
            word.error_count = 0;
        }
    });
    
    saveVocabulary();
    renderWrongWords();
    updateStats();
    alert('错词本已清空');
}

// ============ 设置面板 ============

function openSettings() {
    document.getElementById('settingsModal').classList.remove('hidden');
    
    // 加载当前设置
    document.getElementById('settingSpeak').checked = SETTINGS.speakEnabled;
    document.getElementById('settingCut').checked = SETTINGS.cutEnabled;
    document.getElementById('settingMasterCount').value = SETTINGS.masterCount;
    
    // 6种题型开关
    document.getElementById('settingEnCn').checked = SETTINGS.phaseEnCn;
    document.getElementById('settingCnEn').checked = SETTINGS.phaseCnEn;
    document.getElementById('settingEnDef').checked = SETTINGS.phaseEnDef;
    document.getElementById('settingDefEn').checked = SETTINGS.phaseDefEn;
    document.getElementById('settingSentEn').checked = SETTINGS.phaseSentEn;
    document.getElementById('settingSentCn').checked = SETTINGS.phaseSentCn;
}

function closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
}

function saveSettings() {
    SETTINGS.speakEnabled = document.getElementById('settingSpeak').checked;
    SETTINGS.cutEnabled = document.getElementById('settingCut').checked;
    SETTINGS.masterCount = parseInt(document.getElementById('settingMasterCount').value);
    
    // 6种题型开关
    SETTINGS.phaseEnCn = document.getElementById('settingEnCn').checked;
    SETTINGS.phaseCnEn = document.getElementById('settingCnEn').checked;
    SETTINGS.phaseEnDef = document.getElementById('settingEnDef').checked;
    SETTINGS.phaseDefEn = document.getElementById('settingDefEn').checked;
    SETTINGS.phaseSentEn = document.getElementById('settingSentEn').checked;
    SETTINGS.phaseSentCn = document.getElementById('settingSentCn').checked;
    
    localStorage.setItem('vocabularySettings', JSON.stringify(SETTINGS));
    closeSettings();
    alert('设置已保存');
}

// ============ 添加单词 ============

function openAddWord() {
    document.getElementById('addWordModal').classList.remove('hidden');
    document.getElementById('addWordForm').reset();
}

function closeAddWord() {
    document.getElementById('addWordModal').classList.add('hidden');
}

function handleAddWord(e) {
    e.preventDefault();
    
    const word = {
        id: generateId(),
        en: document.getElementById('wordEn').value.trim(),
        cn: document.getElementById('wordCn').value.trim(),
        defCn: document.getElementById('wordDef').value.trim(),
        ex: document.getElementById('wordExample').value.trim(),
        category: document.getElementById('wordCat').value,
        status: 'new',
        correct_count: 0,
        error_count: 0,
        correct_streak: 0
    };
    
    // 兼容旧字段
    word.word = word.en;
    word.word_cn = word.cn;
    word.definition_cn = word.defCn;
    word.example = word.ex;
    
    vocabulary.push(word);
    saveVocabulary();
    updateStats();
    renderAllWords();
    closeAddWord();
    
    alert(`单词 "${word.en}" 已添加`);
}

function editWord(wordId) {
    const word = vocabulary.find(v => v.id === wordId);
    if (!word) return;
    
    prompt('编辑功能开发中，请手动删除后重新添加');
}

function deleteWord(wordId) {
    if (!confirm('确定要删除这个单词吗？')) return;
    
    vocabulary = vocabulary.filter(v => v.id !== wordId);
    saveVocabulary();
    updateStats();
    renderAllWords();
}

// ============ 已掌握库 ============

function openMastered() {
    document.getElementById('masteredModal').classList.remove('hidden');
    renderMasteredList();
}

function closeMastered() {
    document.getElementById('masteredModal').classList.add('hidden');
}

function renderMasteredList() {
    const container = document.getElementById('masteredList');
    const searchTerm = document.getElementById('masteredSearchInput')?.value?.toLowerCase() || '';
    
    const mastered = vocabulary
        .filter(v => v.status === 'mastered')
        .filter(v => {
            if (!searchTerm) return true;
            const text = [v.en, v.cn, v.defCn].join(' ').toLowerCase();
            return text.includes(searchTerm);
        })
        .sort((a, b) => (a.en || a.word).localeCompare(b.en || b.word));
    
    if (mastered.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>暂无已掌握的单词</p></div>';
        return;
    }
    
    container.innerHTML = mastered.map(word => `
        <div class="word-item">
            <span class="word-text">${escapeHtml(word.en || word.word)}</span>
            <span class="word-cn">${escapeHtml(word.cn || word.word_cn)}</span>
        </div>
    `).join('');
}

// ============ 工具函数 ============

function generateId() {
    return 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

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

function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function getSampleVocabulary() {
    return [
        {
            id: 'sample-1',
            word: 'perovskite',
            en: 'perovskite',
            word_cn: '钙钛矿',
            cn: '钙钛矿',
            definition_cn: '一类具有ABX3晶体结构的材料，广泛应用于太阳能电池',
            defCn: '一类具有ABX3晶体结构的材料，广泛应用于太阳能电池',
            definition_en: 'A class of materials with ABX3 crystal structure, widely used in solar cells',
            defEn: 'A class of materials with ABX3 crystal structure, widely used in solar cells',
            example: 'The **perovskite** solar cell has achieved over 25% efficiency.',
            ex: 'The **perovskite** solar cell has achieved over 25% efficiency.',
            category: 'synthesis',
            status: 'new',
            correct_count: 0,
            error_count: 0
        },
        {
            id: 'sample-2',
            word: 'passivation',
            en: 'passivation',
            word_cn: '钝化',
            cn: '钝化',
            definition_cn: '减少材料表面缺陷态密度的技术',
            defCn: '减少材料表面缺陷态密度的技术',
            definition_en: 'Technique to reduce surface defect density',
            defEn: 'Technique to reduce surface defect density',
            example: 'Surface **passivation** significantly reduces non-radiative recombination.',
            ex: 'Surface **passivation** significantly reduces non-radiative recombination.',
            category: 'mechanism',
            status: 'new',
            correct_count: 0,
            error_count: 0
        }
    ];
}
