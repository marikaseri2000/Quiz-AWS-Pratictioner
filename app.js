import { modules } from './modules.js';

// --- Debug Utility ---
function debugLog(msg, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${msg}`);
}

// --- State Management ---
const state = {
    currentModuleId: null,
    questions: [],
    currentIndex: 0,
    answers: {},
    score: 0,
    timer: null,
    endTime: null,
    locked: false,
    quizMode: 'standard',
    errors: JSON.parse(localStorage.getItem('awsQuizWrongBank') || '[]'),
};

// --- DOM Elements ---
const views = {
    home: document.getElementById('home-view'),
    quiz: document.getElementById('quiz-view'),
    results: document.getElementById('results-view'),
};

const els = {
    moduleList: document.getElementById('module-list'),
    quizHeader: document.getElementById('quiz-header-info'),
    timer: document.getElementById('timer'),
    progress: document.getElementById('progress'),
    exitBtn: document.getElementById('exit-btn'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    explanationContainer: document.getElementById('explanation-container'),
    explanationText: document.getElementById('explanation-text'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    confirmBtn: document.getElementById('confirm-btn'),
    emaOverlay: document.getElementById('ema-overlay'),
    emaImage: document.getElementById('ema-image'),
    totalErrors: document.getElementById('total-errors'),
    retryErrorsBtn: document.getElementById('retry-errors-btn'),
    clearErrorsBtn: document.getElementById('clear-errors-btn'),
    scoreText: document.getElementById('score-text'),
    scorePerc: document.getElementById('score-percentage'),
    timeTaken: document.getElementById('time-taken'),
    homeBtn: document.getElementById('home-btn'),
    retryBtn: document.getElementById('retry-btn'),
    resultsList: document.getElementById('results-list'),
};

// --- Initialization ---
function init() {
    try {
        debugLog('App initializing...');
        if (!els.moduleList) throw new Error('Elemento module-list non trovato!');

        renderModuleList();
        updateErrorStats();
        setupEventListeners();
        debugLog('App initialized successfully.');
    } catch (e) {
        alert('Errore inizializzazione: ' + e.message);
        console.error(e);
    }
}

function setupEventListeners() {
    // Header click to go home
    const header = document.querySelector('header');
    if (header) header.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') switchView('home');
    });

    if (els.exitBtn) els.exitBtn.addEventListener('click', () => switchView('home'));
    if (els.prevBtn) els.prevBtn.addEventListener('click', () => navigateQuestion(-1));
    if (els.nextBtn) els.nextBtn.addEventListener('click', () => navigateQuestion(1));
    if (els.confirmBtn) els.confirmBtn.addEventListener('click', submitAnswer);
    if (els.homeBtn) els.homeBtn.addEventListener('click', () => switchView('home'));
    if (els.retryBtn) els.retryBtn.addEventListener('click', restartQuiz);
    if (els.retryErrorsBtn) els.retryErrorsBtn.addEventListener('click', startErrorQuiz);
    if (els.clearErrorsBtn) els.clearErrorsBtn.addEventListener('click', clearErrors);
}

// --- View Navigation ---
function switchView(viewName) {
    debugLog(`Switching to view: ${viewName}`);
    console.log(`🔄 switchView("${viewName}") called`);

    // Hide all views EXCEPT the target
    Object.entries(views).forEach(([name, el]) => {
        if (el && name !== viewName) {  // ← Escludi il view target!
            el.classList.remove('active');
            setTimeout(() => el.classList.add('hidden'), 300);
        }
    });

    // Stop timer if leaving quiz
    if (viewName !== 'quiz') {
        clearInterval(state.timer);
        if (els.quizHeader) els.quizHeader.classList.add('hidden');
    }

    // Show target view
    const target = views[viewName];
    console.log(`Target view element:`, target);
    if (target) {
        console.log(`✅ Showing ${viewName}`);
        target.classList.remove('hidden');
        target.classList.remove('active');  // Reset first
        // Force reflow
        void target.offsetWidth;
        target.classList.add('active');
        console.log(`✅ Classes applied to ${viewName}:`, target.className);
    } else {
        console.error(`❌ View ${viewName} not found`);
    }

    if (viewName === 'home') {
        updateErrorStats();
        resetQuizState();
    }
}

// --- Module Handling ---
function renderModuleList() {
    if (!els.moduleList) return;

    // Use click listener to avoid global scope issues
    els.moduleList.innerHTML = modules.map(mod => `
        <div class="card module-card">
            <h3>${mod.title}</h3>
            <p>Simulazione esame • 90 minuti</p>
            <button class="primary-btn start-module-btn" data-id="${mod.id}">Avvia Modulo</button>
        </div>
    `).join('');

    // Attach listeners
    document.querySelectorAll('.start-module-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            startModule(id);
        });
    });
}

async function startModule(moduleId) {
    debugLog(`Starting module: ${moduleId}`);
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) {
        alert('Modulo non trovato!');
        return;
    }

    try {
        debugLog(`Fetching file: ${mod.file}`);
        const response = await fetch(mod.file);

        if (!response.ok) {
            if (response.status === 404) throw new Error('File JSON non trovato. Controlla che i file siano nella cartella corretta.');
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        debugLog(`Data loaded. RAW Data keys: ${Object.keys(data)}`);
        console.log('✅ File caricato:', mod.file, data);

        // Debug first item
        if (data.results && data.results.length > 0) {
            debugLog(`First item sample: ${JSON.stringify(data.results[0].prompt ? data.results[0].prompt.question : 'no-prompt')}`);
        }

        state.quizMode = 'standard';
        state.currentModuleId = moduleId;
        state.questions = normalizeQuestions(data, moduleId);

        debugLog(`Normalized ${state.questions.length} questions.`);
        console.log('✅ Domande normalizzate:', state.questions.length, state.questions);

        if (state.questions.length === 0) {
            throw new Error('Nessuna domanda trovata nel file JSON. Struttura non riconosciuta.');
        }

        startQuizSession();
    } catch (err) {
        let msg = 'Errore caricamento modulo:\n' + err.message;
        if (window.location.protocol === 'file:') {
            msg += '\n\nNOTA: Stai aprendo il file direttamente (file://). Devi usare un server locale (python -m http.server).';
        }
        alert(msg);
        console.error('❌ ERRORE:', err);
    }
}

// --- Question Normalization ---
function normalizeQuestions(data, moduleId) {
    let rawList = Array.isArray(data) ? data : (data.results || []);
    debugLog(`Total items in data: ${rawList.length}`);

    // FILTRO: Prendi solo gli assessment
    rawList = rawList.filter(item => {
        const isAssessment = item._class === 'assessment';
        if (!isAssessment) {
            console.log(`⏭️ Saltando item con _class="${item._class}" (non è assessment)`);
        }
        return isAssessment;
    });

    debugLog(`After filtering assessments: ${rawList.length} items...`);

    const normalized = rawList.map((item, index) => {
        // Handle different structures
        // Prioritize 'prompt' object if exists, otherwise assume item is the question root
        const q = item.prompt || item;
        const id = item.id || `${moduleId}-${index}`;

        // Map correct_response ["a"] -> 0
        const letterToIndex = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4 };
        let correctIndices = [];

        if (Array.isArray(item.correct_response)) {
            correctIndices = item.correct_response.map(l => letterToIndex[l.toLowerCase()]).filter(i => i !== undefined);
        } else if (typeof item.correct_response === 'string') {
            const idx = letterToIndex[item.correct_response.toLowerCase()];
            if (idx !== undefined) correctIndices.push(idx);
        }

        // Validate content
        // IMPORTANT: Check various fields for question text
        const text = q.question || q.question_plain || item.question || "Testo domanda mancante";
        const options = Array.isArray(q.answers) ? q.answers : (item.answers || []);
        const explanation = q.explanation || item.explanation || "Nessuna spiegazione disponibile.";

        if (options.length === 0) {
            console.log(`❌ Item ${index}: NO OPTIONS! q.answers=${q.answers}, item.answers=${item.answers}`);
        } else {
            console.log(`📋 Item ${index}: text="${text.substring(0, 50)}...", options.length=${options.length}`);
        }

        return {
            id: id,
            moduleId: moduleId,
            text: text,
            options: options,
            correctIndices: correctIndices,
            explanation: explanation
        };
    });

    console.log(`✅ Normalized: ${normalized.length} domande valide`);
    return normalized.filter(q => q.options.length > 0);
}

// --- Quiz Logic ---
function startQuizSession() {
    state.currentIndex = 0;
    state.answers = {};
    state.locked = false;

    // Timer setup (90 mins = 5400s)
    let duration = state.quizMode === 'standard' ? 5400 : (state.questions.length * 60);
    state.endTime = Date.now() + duration * 1000;

    startTimer();
    switchView('quiz');
    if (els.quizHeader) els.quizHeader.classList.remove('hidden');
    renderQuestion();
}

function startTimer() {
    clearInterval(state.timer);
    updateTimerDisplay();
    state.timer = setInterval(() => {
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const remaining = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    if (els.timer) els.timer.textContent = `${m}:${s.toString().padStart(2, '0')}`;

    if (remaining <= 0) {
        finishQuiz();
    }
}

function renderQuestion() {
    console.log('🔄 renderQuestion() START');
    if (!state.questions || state.questions.length === 0) {
        if (els.questionText) els.questionText.innerHTML = "Errore: Nessuna domanda caricata.";
        return;
    }

    const q = state.questions[state.currentIndex];
    console.log('📌 Domanda caricata:', q);
    if (!q) {
        debugLog(`Question at index ${state.currentIndex} is undefined`);
        return;
    }

    const isAnswered = state.answers[q.id] !== undefined;

    // Reset UI
    state.locked = isAnswered;
    console.log('✍️ Impostando testo della domanda');
    if (els.questionText) els.questionText.innerHTML = q.text;
    if (els.explanationContainer) els.explanationContainer.classList.add('hidden');
    if (els.confirmBtn) els.confirmBtn.style.display = isAnswered ? 'none' : 'inline-block';

    // Progress
    if (els.progress) els.progress.textContent = `Domanda ${state.currentIndex + 1}/${state.questions.length}`;

    // Options
    console.log('🔘 Rendering options, container:', els.optionsContainer);
    if (els.optionsContainer) {
        els.optionsContainer.innerHTML = '';
        console.log('✅ Container svuotato');

        if (q.options && q.options.length > 0) {
            console.log(`📊 Creando ${q.options.length} opzioni`);
            q.options.forEach((opt, idx) => {
                console.log(`🔍 Opzione ${idx} valore:`, JSON.stringify(opt));

                const isSelected = state.answers[q.id] === idx;
                let classes = 'option-btn';

                if (isAnswered) {
                    if (q.correctIndices.includes(idx)) classes += ' correct';
                    else if (isSelected) classes += ' wrong';
                } else if (isSelected) {
                    classes += ' selected';
                }

                const btn = document.createElement('button');
                btn.className = classes;
                btn.onclick = () => selectOption(idx);
                btn.disabled = isAnswered;
                btn.innerHTML = opt;
                console.log(`✔️ Button ${idx} creato con innerHTML="${btn.innerHTML.substring(0, 30)}..."`);
                els.optionsContainer.appendChild(btn);
            });
            console.log('✅ Tutti i button aggiunti');
        } else {
            console.log('❌ Nessuna opzione trovata!', q.options);
            els.optionsContainer.innerHTML = '<p>Errore: Opzioni non disponibili per questa domanda.</p>';
        }
    } else {
        console.error('❌ optionsContainer è NULL!');
    }

    // Explanation
    if (isAnswered && els.explanationText && els.explanationContainer) {
        els.explanationText.innerHTML = q.explanation;
        els.explanationContainer.classList.remove('hidden');
    }

    // Nav buttons
    if (els.prevBtn) els.prevBtn.disabled = state.currentIndex === 0;
    if (els.nextBtn) els.nextBtn.textContent = state.currentIndex === state.questions.length - 1 ? 'Termina' : 'Successiva';
}

window.selectOption = function (idx) {
    if (state.locked) return;

    if (els.optionsContainer) {
        const buttons = els.optionsContainer.querySelectorAll('.option-btn');
        buttons.forEach(b => b.classList.remove('selected'));
        if (buttons[idx]) buttons[idx].classList.add('selected');
    }

    state.tempSelection = idx;
};

// --- Action Handlers ---
function submitAnswer() {
    if (state.tempSelection === undefined && state.answers[state.questions[state.currentIndex].id] === undefined) return;

    const q = state.questions[state.currentIndex];
    const selectedIdx = state.tempSelection;

    state.answers[q.id] = selectedIdx;
    state.tempSelection = undefined;

    const isCorrect = q.correctIndices.includes(selectedIdx);

    if (isCorrect) {
        showBuenoEffect();
    } else {
        showEmaAnimation(isCorrect);
    }

    if (!isCorrect) {
        saveError(q);
    }

    renderQuestion();
}

function showBuenoEffect() {
    const buenoOverlay = document.getElementById('bueno-overlay');
    if (buenoOverlay) {
        buenoOverlay.classList.remove('hidden');
        void buenoOverlay.offsetWidth;

        setTimeout(() => {
            buenoOverlay.classList.add('hidden');
            showEmaAnimation(true);  // Mostra Ema contento dopo Bueno
        }, 2200);
    }
}

function showEmaAnimation(isCorrect) {
    const imgName = isCorrect ? 'Ema_contento.jpeg' : 'Ema_deluso.jpeg';
    if (els.emaImage) els.emaImage.src = `assets/${imgName}`;

    if (els.emaOverlay) {
        els.emaOverlay.classList.remove('hidden');
        // Trigger reflow
        void els.emaOverlay.offsetWidth;
        els.emaOverlay.style.opacity = '1';

        setTimeout(() => {
            els.emaOverlay.style.opacity = '0';
            setTimeout(() => {
                els.emaOverlay.classList.add('hidden');
            }, 300);
        }, 1900);
    }
}

function navigateQuestion(delta) {
    const newIndex = state.currentIndex + delta;
    if (newIndex >= 0 && newIndex < state.questions.length) {
        state.currentIndex = newIndex;
        state.tempSelection = undefined;
        renderQuestion();
    } else if (newIndex >= state.questions.length) {
        finishQuiz();
    }
}

function finishQuiz() {
    clearInterval(state.timer);

    let correctCount = 0;
    state.questions.forEach(q => {
        if (state.answers[q.id] !== undefined && q.correctIndices.includes(state.answers[q.id])) {
            correctCount++;
        }
    });

    const percentage = state.questions.length > 0 ? Math.round((correctCount / state.questions.length) * 100) : 0;

    if (els.scoreText) els.scoreText.textContent = `${correctCount}/${state.questions.length}`;
    if (els.scorePerc) els.scorePerc.textContent = `${percentage}%`;

    const remainingSeconds = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
    const totalDuration = (state.quizMode === 'standard' ? 5400 : state.questions.length * 60);
    const totalSeconds = totalDuration - remainingSeconds;
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (els.timeTaken) els.timeTaken.textContent = `${m}m ${s}s`;

    if (els.resultsList) {
        els.resultsList.innerHTML = state.questions.map((q, idx) => {
            const userIdx = state.answers[q.id];
            const isCorrect = userIdx !== undefined && q.correctIndices.includes(userIdx);
            const skipped = userIdx === undefined;
            const statusClass = skipped ? 'skipped' : (isCorrect ? 'correct' : 'wrong');
            const statusText = skipped ? 'Saltata' : (isCorrect ? 'Corretta' : 'Errata');

            return `
                <div class="card result-item ${statusClass}" style="margin-bottom:1rem; border-left: 5px solid ${isCorrect ? 'green' : (skipped ? 'gray' : 'red')}">
                    <p><strong>Domanda ${idx + 1}:</strong> ${statusText}</p>
                    <div class="result-details">
                        ${q.text} <br>
                        <small>Risposta corretta: Opzione ${q.correctIndices.map(i => getOptionLetter(i)).join(', ')}</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    switchView('results');
}

function getOptionLetter(idx) {
    return String.fromCharCode(65 + idx);
}

function restartQuiz() {
    startQuizSession();
}

function resetQuizState() {
    state.questions = [];
    state.currentIndex = 0;
    state.answers = {};
    clearInterval(state.timer);
}

// --- Error Bank Management ---
function saveError(question) {
    const errors = state.errors;
    const existing = errors.find(e => e.id === question.id);

    if (existing) {
        existing.timesWrong++;
        existing.lastWrongAt = new Date().toISOString();
    } else {
        errors.push({
            ...question,
            timesWrong: 1,
            lastWrongAt: new Date().toISOString()
        });
    }

    localStorage.setItem('awsQuizWrongBank', JSON.stringify(errors));
    state.errors = errors;
}

function updateErrorStats() {
    state.errors = JSON.parse(localStorage.getItem('awsQuizWrongBank') || '[]');
    const count = state.errors.length;
    if (els.totalErrors) els.totalErrors.textContent = count;

    if (els.retryErrorsBtn) els.retryErrorsBtn.disabled = count === 0;
    if (els.clearErrorsBtn) els.clearErrorsBtn.disabled = count === 0;
}

function startErrorQuiz() {
    if (state.errors.length === 0) return;

    state.quizMode = 'errors';
    state.currentModuleId = 'errors';
    state.questions = [...state.errors].sort(() => 0.5 - Math.random());

    startQuizSession();
}

function clearErrors() {
    if (confirm('Sei sicuro di voler cancellare tutti gli errori salvati?')) {
        localStorage.removeItem('awsQuizWrongBank');
        state.errors = [];
        updateErrorStats();
    }
}

// Start
init();
