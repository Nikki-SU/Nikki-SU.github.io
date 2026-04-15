/**
 * vocabulary.js - 生词本学习脚本（重构版 v3）
 * 
 * 学习流程：
 * - 新学：词1卡片→词1英选中→词2卡片→词2英选中→...→所有词中选英→英选义→义选英
 * - 复习（已学）：英选中→中选英→英选义→义选英（不展示卡片）
 * 
 * 单词状态：
 * - new: 新词（从未展示过卡片）
 * - studying: 正在学（展示了卡片但未完成4个题型各一遍）
 * - learned: 已学（完成4个题型但未掌握，correct_count < 12）
 * - mastered: 已掌握（连续正确12次）
 */

// 学习阶段枚举
const StudyPhase = {
    SHOW_CARD: 0,           // 展示单词卡片
    EN_SELECT_CN: 1,        // 英文 -> 选中文
    CN_SELECT_EN: 2,        // 中文 -> 选英文
    EN_SELECT_DEF: 3,       // 英文 -> 选释义
    DEF_SELECT_EN: 4        // 释义 -> 选英文
};

// 阶段顺序（不含卡片展示）
const PHASE_SEQUENCE = [
    StudyPhase.EN_SELECT_CN,
    StudyPhase.CN_SELECT_EN,
    StudyPhase.EN_SELECT_DEF,
    StudyPhase.DEF_SELECT_EN
];

// 配置
const CONFIG = {
    CORRECT_TO_MASTER: 12,
    ERROR_THRESHOLD: 3,
    DEFAULT_STUDY_COUNT: 50,
    vocabularyUrl: 'data/vocabulary.json',
    wrongWordsUrl: 'data/wrong-words.json',
    STORAGE_KEYS: {
        VOCABULARY: 'vocabularyData',
        WRONG_WORDS: 'wrongWords',
        STUDY_COUNT: 'studyCount',
        PRACTICE_DATE: 'practiceDate',
        TODAY_COMPLETED: 'todayCompleted'
    }
};

// 单词状态常量
const WordStatus = {
    NEW: 'new',
    STUDYING: 'studying',
    LEARNED: 'learned',
    MASTERED: 'mastered'
};

// 全局状态
let vocabularyData = {};
let wrongWords = [];
let masteredWords = [];
let studyCount = CONFIG.DEFAULT_STUDY_COUNT;

// 学习状态
let currentMode = null;      // 'new' | 'review'
let currentPhase = StudyPhase.SHOW_CARD;
let isWaiting = false;

// 批量学习队列
let currentWordQueue = [];
let currentWordIndex = 0;
let wrongWordsInPhase = [];

// 新学模式下的阶段：0=卡片+英选中阶段, 1=中选英阶段, 2=英选义阶段, 3=义选英阶段
let newStudyStage = 0;

// DOM元素
const elements = {};

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initEventListeners();
    loadAllData();
});

function initElements() {
    elements.studyArea = document.getElementById('studyArea');
    elements.studyHint = document.getElementById('studyHint');
    elements.progressText = document.getElementById('progressText');
    elements.progressFill = document.getElementById('progressFill');
    elements.currentStreak = document.getElementById('currentStreak');
    elements.todayCount = document.getElementById('todayCount');
    elements.masteredList = document.getElementById('masteredList');
    elements.wrongList = document.getElementById('wrongList');
    elements.wordList = document.getElementById('wordList');
    elements.addWordForm = document.getElementById('addWordForm');
    elements.categoryFilter = document.getElementById('categoryFilter');
    elements.searchWords = document.getElementById('searchWords');
    elements.studyButtons = document.getElementById('studyButtons');
    elements.queueInfo = document.getElementById('queueInfo');
    elements.studyCountInput = document.getElementById('studyCountInput');
    elements.learnedList = document.getElementById('learnedList');
    elements.studyingList = document.getElementById('studyingList');
}

function initEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    if (elements.addWordForm) {
        elements.addWordForm.addEventListener('submit', handleAddWord);
    }
    
    if (elements.categoryFilter) {
        elements.categoryFilter.addEventListener('change', renderWordList);
    }
    if (elements.searchWords) {
        elements.searchWords.addEventListener('input', debounce(renderWordList, 300));
    }
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    document.querySelectorAll('.vocab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${tab}Mode`).classList.remove('hidden');
    
    if (tab === 'mastered') renderMasteredList();
    else if (tab === 'wrong') renderWrongList();
    else if (tab === 'all') renderWordList();
    else if (tab === 'learned') renderLearnedList();
    else if (tab === 'studying') renderStudyingList();
}

function getAllVocabulary() {
    return Object.values(vocabularyData);
}

function getWordsByStatus(status) {
    return getAllVocabulary().filter(w => w.status === status);
}

function getNewWords() {
    return getWordsByStatus(WordStatus.NEW);
}

function getStudyingWords() {
    return getWordsByStatus(WordStatus.STUDYING);
}

function getLearnedWords() {
    return getWordsByStatus(WordStatus.LEARNED);
}

function getMasteredWords() {
    return getWordsByStatus(WordStatus.MASTERED);
}

function getWrongWords() {
    return wrongWords;
}

function loadAllData() {
    loadVocabularyData();
    loadWrongWords();
    loadMasteredWords();
    updateStats();
    updateStudyButtons();
}

function loadVocabularyData() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.VOCABULARY);
    if (stored) {
        vocabularyData = JSON.parse(stored);
    } else {
        fetch(CONFIG.vocabularyUrl)
            .then(res => res.json())
            .then(data => {
                data.forEach(word => {
                    vocabularyData[word.id] = {
                        ...word,
                        status: word.status || WordStatus.NEW,
                        correct_count: word.correct_count || 0,
                        error_count: word.error_count || 0,
                        phase_en_cn: word.phase_en_cn || false,
                        phase_cn_en: word.phase_cn_en || false,
                        phase_en_def: word.phase_en_def || false,
                        phase_def_en: word.phase_def_en || false,
                        current_phase: word.current_phase || StudyPhase.SHOW_CARD,
                        last_practice_date: word.last_practice_date || ''
                    };
                });
                saveVocabularyData();
            })
            .catch(err => console.error('加载词汇失败:', err));
    }
}

function saveVocabularyData() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.VOCABULARY, JSON.stringify(vocabularyData));
}

function loadWrongWords() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.WRONG_WORDS);
    if (stored) {
        wrongWords = JSON.parse(stored);
    }
}

function loadMasteredWords() {
    const stored = localStorage.getItem('masteredWords');
    if (stored) {
        masteredWords = JSON.parse(stored);
    }
}

function updateStats() {
    const newWords = getNewWords().length;
    const studyingWords = getStudyingWords().length;
    const learnedWords = getLearnedWords().length;
    const masteredWordsCount = getMasteredWords().length;
    const wrongWordsCount = wrongWords.length;
    
    if (elements.progressText) {
        elements.progressText.textContent = `新词:${newWords} 正在学:${studyingWords} 已学:${learnedWords}`;
    }
    
    // 更新各列表
    renderNewWordsCount(newWords);
    renderStudyingCount(studyingWords);
    renderLearnedCount(learnedWords);
    renderMasteredCount(masteredWordsCount);
    renderWrongCount(wrongWordsCount);
}

function renderNewWordsCount(count) {
    const el = document.getElementById('newWordsCount');
    if (el) el.textContent = count;
}

function renderStudyingCount(count) {
    const el = document.getElementById('studyingCount');
    if (el) el.textContent = count;
}

function renderLearnedCount(count) {
    const el = document.getElementById('learnedCount');
    if (el) el.textContent = count;
}

function renderMasteredCount(count) {
    const el = document.getElementById('masteredCount');
    if (el) el.textContent = count;
}

function renderWrongCount(count) {
    const el = document.getElementById('wrongCount');
    if (el) el.textContent = count;
}

function updateStudyButtons() {
    const newWords = getNewWords();
    const studyingWords = getStudyingWords();
    const learnedWords = getLearnedWords();
    
    const newAndStudying = [...newWords, ...studyingWords];
    
    if (elements.studyButtons) {
        elements.studyButtons.innerHTML = `
            <div class="study-count-setting">
                <label>每次学习词数：</label>
                <input type="number" id="studyCountInput" value="${studyCount}" min="1" max="100">
            </div>
            <div class="study-btn-group">
                <button class="btn btn-primary start-study-btn" id="startNewStudyBtn" ${newAndStudying.length === 0 ? 'disabled' : ''}>
                    📖 学习 (${newAndStudying.length}个词)
                </button>
                <button class="btn btn-secondary start-review-btn" id="startReviewBtn" ${learnedWords.length === 0 ? 'disabled' : ''}>
                    🔄 复习 (${learnedWords.length}个词)
                </button>
            </div>
        `;
        
        document.getElementById('startNewStudyBtn')?.addEventListener('click', () => {
            const input = document.getElementById('studyCountInput');
            studyCount = parseInt(input?.value) || CONFIG.DEFAULT_STUDY_COUNT;
            startStudyMode('new');
        });
        
        document.getElementById('startReviewBtn')?.addEventListener('click', () => {
            const input = document.getElementById('studyCountInput');
            studyCount = parseInt(input?.value) || CONFIG.DEFAULT_STUDY_COUNT;
            startStudyMode('review');
        });
    }
}

/**
 * 开始学习模式
 */
function startStudyMode(mode) {
    currentMode = mode;
    currentWordIndex = 0;
    wrongWordsInPhase = [];
    newStudyStage = 0;
    
    if (mode === 'new') {
        // 新学：新词 + 正在学
        const newWords = getNewWords();
        const studyingWords = getStudyingWords();
        currentWordQueue = [...newWords, ...studyingWords].slice(0, studyCount);
        currentPhase = StudyPhase.SHOW_CARD;
    } else {
        // 复习：已学
        currentWordQueue = getLearnedWords().slice(0, studyCount);
        currentPhase = StudyPhase.EN_SELECT_CN;
        newStudyStage = 1;
    }
    
    if (currentWordQueue.length === 0) {
        showMessage('没有可学习的词！', 'info');
        return;
    }
    
    if (elements.studyButtons) {
        elements.studyButtons.classList.add('hidden');
    }
    if (elements.queueInfo) {
        elements.queueInfo.classList.remove('hidden');
    }
    
    updateQueueInfo();
    renderCurrentQuestion();
}

function isWordComplete(word) {
    return word.phase_en_cn && word.phase_cn_en && word.phase_en_def && word.phase_def_en;
}

function updateQueueInfo() {
    if (elements.queueInfo) {
        const totalWords = currentWordQueue.length;
        const currentIdx = Math.min(currentWordIndex + 1, totalWords);
        
        let stageText = '';
        if (currentMode === 'new') {
            if (newStudyStage === 0) stageText = '卡片+英选中';
            else if (newStudyStage === 1) stageText = '中选英';
            else if (newStudyStage === 2) stageText = '英选义';
            else if (newStudyStage === 3) stageText = '义选英';
        } else {
            if (currentPhase === StudyPhase.EN_SELECT_CN) stageText = '英选中';
            else if (currentPhase === StudyPhase.CN_SELECT_EN) stageText = '中选英';
            else if (currentPhase === StudyPhase.EN_SELECT_DEF) stageText = '英选义';
            else if (currentPhase === StudyPhase.DEF_SELECT_EN) stageText = '义选英';
        }
        
        elements.queueInfo.innerHTML = `
            <span class="queue-badge">${currentMode === 'new' ? '学习' : '复习'}</span>
            <span class="phase-badge">${stageText}</span>
            <span class="word-progress">第 ${currentIdx} / ${totalWords} 个词</span>
        `;
    }
}

/**
 * 渲染当前题目
 */
function renderCurrentQuestion() {
    // 检查是否有需要重做的词
    if (wrongWordsInPhase.length > 0 && currentWordIndex >= currentWordQueue.length) {
        handleRetryWords();
        return;
    }
    
    if (currentWordIndex >= currentWordQueue.length) {
        // 当前阶段完成
        moveToNextStage();
        return;
    }
    
    const currentWord = currentWordQueue[currentWordIndex];
    updateQueueInfo();
    
    if (currentPhase === StudyPhase.SHOW_CARD) {
        renderWordCard(currentWord);
    } else {
        renderQuizCard(currentWord);
    }
}

/**
 * 处理需要重做的词
 */
function handleRetryWords() {
    const wordToRetry = wrongWordsInPhase.shift();
    const wordInQueue = currentWordQueue.find(w => w.word === wordToRetry.word);
    
    if (wordInQueue) {
        vocabularyData[wordInQueue.id].correct_count = 0;
        vocabularyData[wordInQueue.id].last_practice_date = new Date().toISOString();
        saveVocabularyData();
        
        elements.studyHint.innerHTML = `<p class="retry-hint">🔄 重做...</p>`;
        renderQuizCard(wordInQueue);
    } else {
        renderCurrentQuestion();
    }
}

/**
 * 进入下一阶段
 */
function moveToNextStage() {
    wrongWordsInPhase = [];
    
    // 标记当前阶段完成
    if (currentMode === 'new' && newStudyStage === 0) {
        // 卡片+英选中阶段完成，标记所有词的英选中完成
        currentWordQueue.forEach(word => {
            vocabularyData[word.id].phase_en_cn = true;
            if (vocabularyData[word.id].status === WordStatus.NEW) {
                vocabularyData[word.id].status = WordStatus.STUDYING;
            }
        });
        saveVocabularyData();
    } else {
        // 标记当前题型完成
        currentWordQueue.forEach(word => {
            markPhaseComplete(word, currentPhase);
        });
    }
    
    // 进入下一阶段
    if (currentMode === 'new') {
        newStudyStage++;
        if (newStudyStage === 1) {
            currentPhase = StudyPhase.CN_SELECT_EN;
            elements.studyHint.innerHTML = `<p class="phase-change-hint">📝 进入中文选英文！</p>`;
        } else if (newStudyStage === 2) {
            currentPhase = StudyPhase.EN_SELECT_DEF;
            elements.studyHint.innerHTML = `<p class="phase-change-hint">📝 进入英文选释义！</p>`;
        } else if (newStudyStage === 3) {
            currentPhase = StudyPhase.DEF_SELECT_EN;
            elements.studyHint.innerHTML = `<p class="phase-change-hint">📝 进入释义选英文！</p>`;
        } else {
            // 所有阶段完成
            completeStudy();
            return;
        }
    } else {
        // 复习模式
        const phaseIdx = PHASE_SEQUENCE.indexOf(currentPhase);
        if (phaseIdx < PHASE_SEQUENCE.length - 1) {
            currentPhase = PHASE_SEQUENCE[phaseIdx + 1];
            const phaseNames = {
                [StudyPhase.CN_SELECT_EN]: '中文选英文',
                [StudyPhase.EN_SELECT_DEF]: '英文选释义',
                [StudyPhase.DEF_SELECT_EN]: '释义选英文'
            };
            elements.studyHint.innerHTML = `<p class="phase-change-hint">📝 进入${phaseNames[currentPhase]}！</p>`;
        } else {
            completeStudy();
            return;
        }
    }
    
    currentWordIndex = 0;
    
    setTimeout(() => {
        renderCurrentQuestion();
    }, 1500);
}

function markPhaseComplete(word, phase) {
    switch (phase) {
        case StudyPhase.EN_SELECT_CN:
            vocabularyData[word.id].phase_en_cn = true;
            break;
        case StudyPhase.CN_SELECT_EN:
            vocabularyData[word.id].phase_cn_en = true;
            break;
        case StudyPhase.EN_SELECT_DEF:
            vocabularyData[word.id].phase_en_def = true;
            break;
        case StudyPhase.DEF_SELECT_EN:
            vocabularyData[word.id].phase_def_en = true;
            break;
    }
    vocabularyData[word.id].last_practice_date = new Date().toISOString();
    saveVocabularyData();
}

function completeStudy() {
    currentWordQueue.forEach(word => {
        const wordData = vocabularyData[word.id];
        
        if (wordData.correct_count >= CONFIG.CORRECT_TO_MASTER) {
            vocabularyData[word.id].status = WordStatus.MASTERED;
            if (!masteredWords.some(m => m.id === word.id)) {
                masteredWords.push({ ...wordData });
            }
        } else if (wordData.status === WordStatus.STUDYING && isWordComplete(wordData)) {
            vocabularyData[word.id].status = WordStatus.LEARNED;
        }
        
        vocabularyData[word.id].last_practice_date = new Date().toISOString();
    });
    
    saveVocabularyData();
    localStorage.setItem('masteredWords', JSON.stringify(masteredWords));
    
    elements.studyArea.innerHTML = `
        <div class="completion-message">
            <div class="completion-icon">🎉</div>
            <h3>${currentMode === 'new' ? '学习' : '复习'}完成！</h3>
            <p>${currentMode === 'new' ? '学习' : '复习'}了 ${currentWordQueue.length} 个单词</p>
            <button class="btn btn-primary" id="backToListBtn">返回单词本</button>
        </div>
    `;
    
    document.getElementById('backToListBtn').addEventListener('click', () => {
        if (elements.studyButtons) {
            elements.studyButtons.classList.remove('hidden');
        }
        if (elements.queueInfo) {
            elements.queueInfo.classList.add('hidden');
        }
        elements.studyArea.innerHTML = '<p class="empty-message">选择上方按钮开始学习</p>';
        elements.studyHint.innerHTML = '<p>🎯 点击按钮开始学习！</p>';
        updateStats();
        updateStudyButtons();
    });
}

/**
 * 渲染单词卡片
 */
function renderWordCard(word) {
    // 初始化词的学习进度
    if (!vocabularyData[word.id]) {
        vocabularyData[word.id] = {
            ...word,
            status: WordStatus.NEW,
            correct_count: 0,
            error_count: 0,
            phase_en_cn: false,
            phase_cn_en: false,
            phase_en_def: false,
            phase_def_en: false,
            current_phase: StudyPhase.SHOW_CARD,
            last_practice_date: ''
        };
    }
    
    // 标记该词状态为正在学
    if (vocabularyData[word.id].status === WordStatus.NEW) {
        vocabularyData[word.id].status = WordStatus.STUDYING;
    }
    saveVocabularyData();
    
    elements.studyArea.innerHTML = `
        <div class="word-card-display">
            <div class="word-main-display">
                <div class="word-en">${escapeHtml(word.word)}</div>
                <div class="word-cn">${escapeHtml(word.word_cn)}</div>
            </div>
            <div class="word-definition-section">
                <div class="section-label">释义</div>
                <div class="word-definition">${escapeHtml(word.definition || '暂无')}</div>
            </div>
            <div class="word-example-section">
                <div class="section-label">例句</div>
                <div class="word-example">${escapeHtml(word.example || '暂无')}</div>
                ${word.example_cn ? `<div class="word-example-cn">${escapeHtml(word.example_cn)}</div>` : ''}
            </div>
            <button class="continue-btn" id="continueBtn">记住了，继续 →</button>
        </div>
    `;
    
    document.getElementById('continueBtn').addEventListener('click', () => {
        // 点击继续后，进入该词的英选中
        currentPhase = StudyPhase.EN_SELECT_CN;
        renderQuizCard(word);
    });
}

/**
 * 生成选项
 */
function generateOptions(word, phase) {
    const allWords = Object.values(vocabularyData);
    const otherWords = allWords.filter(w => w.id !== word.id && w.word_cn);
    const shuffled = shuffleArray([...otherWords]).slice(0, 3);
    
    // 如果选项不够，用当前词补充
    while (shuffled.length < 3) {
        shuffled.push({ word_cn: word.word_cn, word: word.word, definition: word.definition });
    }
    
    switch (phase) {
        case StudyPhase.EN_SELECT_CN:
            return shuffleArray([word.word_cn, ...shuffled.map(w => w.word_cn)]);
        case StudyPhase.CN_SELECT_EN:
            return shuffleArray([word.word, ...shuffled.map(w => w.word)]);
        case StudyPhase.EN_SELECT_DEF:
            return shuffleArray([word.definition || word.word_cn, ...shuffled.map(w => w.definition || w.word_cn)]);
        case StudyPhase.DEF_SELECT_EN:
            return shuffleArray([word.word, ...shuffled.map(w => w.word)]);
        default:
            return [];
    }
}

/**
 * 渲染选择题
 */
function renderQuizCard(word) {
    const phaseInfo = {
        [StudyPhase.EN_SELECT_CN]: { prompt: '选择中文释义', main: word.word, type: 'word-en' },
        [StudyPhase.CN_SELECT_EN]: { prompt: '选择英文单词', main: word.word_cn, type: 'word-cn' },
        [StudyPhase.EN_SELECT_DEF]: { prompt: '选择正确释义', main: word.word, type: 'word-en' },
        [StudyPhase.DEF_SELECT_EN]: { prompt: '选择对应单词', main: word.definition || word.word_cn, type: 'definition' }
    };
    
    const info = phaseInfo[currentPhase];
    const options = generateOptions(word, currentPhase);
    
    elements.studyArea.innerHTML = `
        <div class="quiz-card-display">
            <div class="word-display ${info.type}">${escapeHtml(info.main)}</div>
            <div class="options-grid">
                ${options.map((opt, idx) => `
                    <button class="option-btn" data-index="${idx}" data-value="${escapeHtml(opt)}">
                        ${escapeHtml(opt)}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    
    elements.studyArea.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => handleOptionClick(btn, word));
    });
}

/**
 * 处理选项点击
 */
function handleOptionClick(btn, word) {
    if (isWaiting) return;
    
    const selectedValue = btn.dataset.value;
    let correctAnswer;
    
    switch (currentPhase) {
        case StudyPhase.EN_SELECT_CN:
            correctAnswer = word.word_cn;
            break;
        case StudyPhase.CN_SELECT_EN:
        case StudyPhase.DEF_SELECT_EN:
            correctAnswer = word.word;
            break;
        case StudyPhase.EN_SELECT_DEF:
            correctAnswer = word.definition || word.word_cn;
            break;
    }
    
    const isCorrect = selectedValue === correctAnswer;
    
    btn.classList.add(isCorrect ? 'correct' : 'wrong');
    
    if (!isCorrect) {
        elements.studyArea.querySelectorAll('.option-btn').forEach(b => {
            if (b.dataset.value === correctAnswer) {
                b.classList.add('correct');
            }
        });
        handleWrongAnswer(word);
        return;
    }
    
    handleCorrectAnswer(word);
}

/**
 * 处理答错
 */
function handleWrongAnswer(word) {
    isWaiting = true;
    
    const wordData = vocabularyData[word.id];
    wordData.correct_count = 0;
    wordData.error_count = (wordData.error_count || 0) + 1;
    wordData.last_practice_date = new Date().toISOString();
    saveVocabularyData();
    
    const totalErrors = wordData.error_count;
    
    if (totalErrors >= CONFIG.ERROR_THRESHOLD) {
        if (!wrongWords.some(w => w.word === word.word)) {
            wrongWords.push({
                ...wordData,
                added_to_wrong_at: new Date().toISOString()
            });
        }
        localStorage.setItem(CONFIG.STORAGE_KEYS.WRONG_WORDS, JSON.stringify(wrongWords));
        elements.studyHint.innerHTML = `<p class="error-hint">❌ 累计错误${totalErrors}次</p>`;
    } else {
        elements.studyHint.innerHTML = `<p class="error-hint">❌ 累计错误${totalErrors}次</p>`;
    }
    elements.studyHint.classList.add('error');
    
    if (!wrongWordsInPhase.some(w => w.word === word.word)) {
        wrongWordsInPhase.push(word);
    }
    
    updateStats();
    
    setTimeout(() => {
        isWaiting = false;
        elements.studyHint.classList.remove('error');
        currentWordIndex++;
        
        // 如果是新学模式的英选中阶段，下一个词要从卡片开始
        if (currentMode === 'new' && newStudyStage === 0) {
            currentPhase = StudyPhase.SHOW_CARD;
        }
        
        renderCurrentQuestion();
    }, 1500);
}

/**
 * 处理答对
 */
function handleCorrectAnswer(word) {
    isWaiting = true;
    
    const wordData = vocabularyData[word.id];
    wordData.correct_count = (wordData.correct_count || 0) + 1;
    wordData.last_practice_date = new Date().toISOString();
    saveVocabularyData();
    
    const correctCount = wordData.correct_count;
    
    // 从错词本移除
    wrongWords = wrongWords.filter(w => w.word !== word.word);
    localStorage.setItem(CONFIG.STORAGE_KEYS.WRONG_WORDS, JSON.stringify(wrongWords));
    
    updateProgressDisplay(correctCount);
    elements.studyHint.innerHTML = `<p class="correct-hint">✅ 正确！</p>`;
    elements.studyHint.classList.add('correct');
    
    if (correctCount >= CONFIG.CORRECT_TO_MASTER) {
        setTimeout(() => masteredWord(word), 1000);
        return;
    }
    
    setTimeout(() => {
        isWaiting = false;
        elements.studyHint.classList.remove('correct');
        currentWordIndex++;
        
        // 如果是新学模式的英选中阶段，下一个词要从卡片开始
        if (currentMode === 'new' && newStudyStage === 0) {
            currentPhase = StudyPhase.SHOW_CARD;
        }
        
        renderCurrentQuestion();
    }, 800);
}

function masteredWord(word) {
    const wordData = vocabularyData[word.id];
    wordData.status = WordStatus.MASTERED;
    wordData.masteredAt = new Date().toISOString();
    saveVocabularyData();
    
    if (!masteredWords.some(m => m.id === word.id)) {
        masteredWords.push({ ...wordData });
    }
    localStorage.setItem('masteredWords', JSON.stringify(masteredWords));
    
    elements.studyHint.innerHTML = `<p class="master-hint">🎉 已掌握！</p>`;
    updateStats();
    
    setTimeout(() => {
        isWaiting = false;
        elements.studyHint.classList.remove('correct');
        currentWordIndex++;
        
        if (currentMode === 'new' && newStudyStage === 0) {
            currentPhase = StudyPhase.SHOW_CARD;
        }
        
        renderCurrentQuestion();
    }, 1500);
}

function updateProgressDisplay(correctCount) {
    if (elements.progressFill) {
        const percent = Math.min((correctCount / CONFIG.CORRECT_TO_MASTER) * 100, 100);
        elements.progressFill.style.width = `${percent}%`;
    }
    if (elements.currentStreak) {
        elements.currentStreak.textContent = correctCount;
    }
}

// 工具函数
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showMessage(msg, type) {
    elements.studyHint.innerHTML = `<p class="${type}-hint">${msg}</p>`;
}

// 标签页渲染函数
function renderMasteredList() {
    const words = getMasteredWords();
    if (!elements.masteredList) return;
    
    if (words.length === 0) {
        elements.masteredList.innerHTML = '<p class="empty-message">暂无已掌握的单词</p>';
        return;
    }
    
    elements.masteredList.innerHTML = words.map(w => `
        <div class="word-item">
            <div class="word-main">
                <span class="word-text">${escapeHtml(w.word)}</span>
                <span class="word-cn">${escapeHtml(w.word_cn)}</span>
            </div>
            <div class="word-meta">掌握于 ${w.masteredAt ? new Date(w.masteredAt).toLocaleDateString() : '未知'}</div>
        </div>
    `).join('');
}

function renderWrongList() {
    if (!elements.wrongList) return;
    
    if (wrongWords.length === 0) {
        elements.wrongList.innerHTML = '<p class="empty-message">暂无错词</p>';
        return;
    }
    
    elements.wrongList.innerHTML = wrongWords.map(w => `
        <div class="word-item">
            <div class="word-main">
                <span class="word-text">${escapeHtml(w.word)}</span>
                <span class="word-cn">${escapeHtml(w.word_cn)}</span>
            </div>
            <div class="word-meta">错误 ${w.error_count} 次</div>
        </div>
    `).join('');
}

function renderWordList() {
    const words = getAllVocabulary();
    if (!elements.wordList) return;
    
    if (words.length === 0) {
        elements.wordList.innerHTML = '<p class="empty-message">暂无单词数据</p>';
        return;
    }
    
    elements.wordList.innerHTML = words.map(w => `
        <div class="word-item">
            <div class="word-main">
                <span class="word-text">${escapeHtml(w.word)}</span>
                <span class="word-cn">${escapeHtml(w.word_cn)}</span>
            </div>
            <div class="word-meta">${w.status || '未知'} | 连对${w.correct_count || 0}次</div>
        </div>
    `).join('');
}

function renderLearnedList() {
    const words = getLearnedWords();
    if (!elements.learnedList) return;
    
    if (words.length === 0) {
        elements.learnedList.innerHTML = '<p class="empty-message">暂无已学单词</p>';
        return;
    }
    
    elements.learnedList.innerHTML = words.map(w => `
        <div class="word-item">
            <div class="word-main">
                <span class="word-text">${escapeHtml(w.word)}</span>
                <span class="word-cn">${escapeHtml(w.word_cn)}</span>
            </div>
            <div class="word-meta">连对${w.correct_count || 0}/12次</div>
        </div>
    `).join('');
}

function renderStudyingList() {
    const words = getStudyingWords();
    if (!elements.studyingList) return;
    
    if (words.length === 0) {
        elements.studyingList.innerHTML = '<p class="empty-message">暂无正在学的单词</p>';
        return;
    }
    
    elements.studyingList.innerHTML = words.map(w => `
        <div class="word-item">
            <div class="word-main">
                <span class="word-text">${escapeHtml(w.word)}</span>
                <span class="word-cn">${escapeHtml(w.word_cn)}</span>
            </div>
            <div class="word-meta">进度: ${w.phase_en_cn ? '✓' : '○'}英选中 ${w.phase_cn_en ? '✓' : '○'}中选英 ${w.phase_en_def ? '✓' : '○'}英选义 ${w.phase_def_en ? '✓' : '○'}义选英</div>
        </div>
    `).join('');
}

function handleAddWord(e) {
    e.preventDefault();
    
    const word = document.getElementById('word').value.trim();
    const wordCn = document.getElementById('wordCn').value.trim();
    const definition = document.getElementById('definition').value.trim();
    const category = document.getElementById('category').value;
    const example = document.getElementById('example').value.trim();
    const exampleCn = document.getElementById('exampleCn').value.trim();
    
    if (!word || !wordCn) {
        showMessage('请填写英文和中文', 'error');
        return;
    }
    
    // 检查是否已存在（包括已掌握的）
    const existingWord = Object.values(vocabularyData).find(w => w.word.toLowerCase() === word.toLowerCase());
    if (existingWord) {
        if (existingWord.status === WordStatus.MASTERED) {
            showMessage('该词已掌握，无需重复添加', 'info');
        } else {
            showMessage('该词已存在', 'info');
        }
        return;
    }
    
    const id = 'vocab-' + Date.now();
    const newWord = {
        id,
        word,
        word_cn: wordCn,
        definition,
        example,
        example_cn: exampleCn,
        category,
        status: WordStatus.NEW,
        correct_count: 0,
        error_count: 0,
        phase_en_cn: false,
        phase_cn_en: false,
        phase_en_def: false,
        phase_def_en: false,
        current_phase: StudyPhase.SHOW_CARD,
        last_practice_date: ''
    };
    
    vocabularyData[id] = newWord;
    saveVocabularyData();
    updateStats();
    updateStudyButtons();
    
    e.target.reset();
    showMessage('添加成功！', 'correct');
}
