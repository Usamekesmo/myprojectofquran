// =============================================================
// ==      وحدة الاختبار (quiz.js) - محدثة لاستخدام ناقل الأحداث
// =============================================================

import * as ui from './ui.js';
import * as api from './api.js';
import * as player from './player.js';
import * as progression from './progression.js';
// ▼▼▼ تم استيراد ناقل الأحداث ▼▼▼
import { dispatch } from './eventBus.js';
import { allQuestionGenerators } from './questions.js';

let state = {
    pageAyahs: [],
    currentQuestionIndex: 0,
    score: 0,
    totalQuestions: 10,
    selectedQari: 'ar.alafasy',
    errorLog: [],
    userName: '',
    pageNumber: 0,
    xpEarned: 0,
    startTime: 0,
    currentQuestionHTML: '',
    testMode: { type: 'normal_test' },
};

let allQuestionTypes = [];
const shuffleArray = array => [...array].sort(() => 0.5 - Math.random());

export async function initializeQuiz() {
    try {
        const config = await api.fetchQuestionsConfig();
        if (config && config.length > 0) {
            allQuestionTypes = config;
            console.log(`تم تحميل ${allQuestionTypes.length} نوع سؤال من قاعدة البيانات.`);
        } else {
            console.error("فشل تحميل إعدادات الأسئلة من قاعدة البيانات (مصفوفة فارغة).");
        }
    } catch (error) {
        console.error("خطأ فادح أثناء تهيئة وحدة الأسئلة:", error);
    } finally {
        return Promise.resolve();
    }
}

export function start(context) {
    state = {
        ...state,
        ...context,
        score: 0,
        currentQuestionIndex: 0,
        errorLog: [],
        xpEarned: 0,
        startTime: Date.now()
    };
    ui.showScreen(ui.quizScreen);
    displayNextQuestion();
}

async function displayNextQuestion() {
    if (state.currentQuestionIndex >= state.totalQuestions) {
        endQuiz();
        return;
    }

    ui.updateProgress(state.currentQuestionIndex + 1, state.totalQuestions);
    ui.questionArea.innerHTML = '<p>جاري تحضير السؤال...</p>';
    ui.feedbackArea.classList.add('hidden');

    const levelInfo = progression.getLevelInfo(player.playerData.xp);
    const availablePaths = progression.getAvailablePaths(levelInfo.level);

    const availableGenerators = allQuestionTypes
        .filter(q => q.required_level <= levelInfo.level && availablePaths.includes(q.required_path))
        .map(q => allQuestionGenerators[q.id])
        .filter(g => typeof g === 'function');

    if (availableGenerators.length === 0) {
        ui.questionArea.innerHTML = '<p style="color: red;">عذرًا، لا توجد أنواع أسئلة متاحة لمستواك ومسارك الحالي.</p>';
        return;
    }

    const shuffledGenerators = shuffleArray(availableGenerators);
    let intruderAyahsForThisQuestion = [];
    const needsIntruders = shuffledGenerators.some(g => g.name.includes('Intruder'));

    if (needsIntruders) {
        const currentPageNumbers = [...new Set(state.pageAyahs.map(a => a.page))];
        let randomIntruderPage;
        do {
            randomIntruderPage = Math.floor(Math.random() * 604) + 1;
        } while (currentPageNumbers.includes(randomIntruderPage));

        const intruders = await api.fetchPageData(randomIntruderPage);
        if (intruders && intruders.length > 0) {
            intruderAyahsForThisQuestion = intruders;
        }
    }

    let questionObject = null;
    let attempts = 0;

    while (!questionObject && attempts < shuffledGenerators.length) {
        const generator = shuffledGenerators[attempts];
        try {
            questionObject = await Promise.resolve(generator(state.pageAyahs, intruderAyahsForThisQuestion, state.selectedQari, handleResult));
        } catch (error) {
            console.error(`فشل المولد في المحاولة ${attempts + 1}:`, error);
        }
        if (!questionObject) {
            console.warn(`فشل المولد ${generator.name || 'غير معروف'} في توليد سؤال، سيتم تجربة مولد آخر.`);
        }
        attempts++;
    }

    if (questionObject) {
        state.currentQuestionHTML = questionObject.questionHTML;
        ui.questionArea.innerHTML = questionObject.questionHTML;
        await Promise.resolve(questionObject.setupListeners(ui.questionArea));
    } else {
        ui.questionArea.innerHTML = '<p style="color: red;">عذرًا، حدث خطأ غير متوقع أثناء تحضير السؤال. قد تكون هذه الصفحة قصيرة جدًا. يرجى محاولة العودة والبدء من جديد.</p>';
        console.error("فشل كارثي: لم يتم العثور على أي مولد أسئلة مناسب للبيانات الحالية.");
    }
}

function handleResult(isCorrect, correctAnswerText, clickedElement, questionType) {
    ui.disableQuestionInteraction();
    ui.markAnswer(clickedElement, isCorrect);
    ui.showFeedback(isCorrect, correctAnswerText);

    if (isCorrect) {
        state.score++;
        const rules = progression.getGameRules();
        state.xpEarned += rules.xp_per_correct_answer || 5;
        // ▼▼▼ إرسال حدث الإجابة الصحيحة ▼▼▼
        dispatch('question_answered_correctly');
    } else {
        state.errorLog.push({
            questionHTML: state.currentQuestionHTML,
            correctAnswer: correctAnswerText,
            question_id: questionType
        });
        // ▼▼▼ إرسال حدث الإجابة الخاطئة ▼▼▼
        dispatch('question_answered_wrongly');
    }

    state.currentQuestionIndex++;
    setTimeout(displayNextQuestion, 2500);
}

// ▼▼▼ هذه هي الدالة التي تم تعديلها بالكامل لاستخدام ناقل الأحداث ▼▼▼
async function endQuiz() {
    const durationInSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    const rules = progression.getGameRules();
    const isPerfect = state.score === state.totalQuestions;

    player.playerData.total_quizzes_completed = (player.playerData.total_quizzes_completed || 0) + 1;
    player.playerData.total_play_time_seconds = (player.playerData.total_play_time_seconds || 0) + durationInSeconds;
    player.playerData.total_correct_answers = (player.playerData.total_correct_answers || 0) + state.score;
    player.playerData.total_questions_answered = (player.playerData.total_questions_answered || 0) + state.totalQuestions;

    if (isPerfect) {
        state.xpEarned += rules.xp_bonus_all_correct || 50;
    }
    const oldXp = player.playerData.xp;
    player.playerData.xp += state.xpEarned;
    player.playerData.seasonal_xp = (player.playerData.seasonal_xp || 0) + state.xpEarned;

    const levelUpInfo = progression.checkForLevelUp(oldXp, player.playerData.xp);
    if (levelUpInfo) {
        player.playerData.diamonds += levelUpInfo.reward;
        // إرسال حدث الارتقاء بالمستوى
        dispatch('level_up', { newLevel: levelUpInfo.level });
    }

    // --- إرسال الإشارات إلى ناقل الأحداث المركزي ---
    dispatch('quiz_completed', { isPerfect, pageNumber: state.pageNumber });
    if (isPerfect) {
        dispatch('perfect_quiz');
    }
    if (state.xpEarned > 0) {
        dispatch('xp_earned', { amount: state.xpEarned });
    }

    if (state.testMode.type === 'special_challenge') {
        dispatch('special_challenge_completed', { challengeId: state.testMode.challengeId });
    }

    const resultToSave = {
        pageNumber: state.pageNumber,
        score: state.score,
        totalQuestions: state.totalQuestions,
        xpEarned: state.xpEarned,
        errorLog: state.errorLog
    };
    
    await player.savePlayer();
    if (resultToSave.pageNumber > 0) {
        await api.saveResult(resultToSave);
    }
    
    ui.updateSaveMessage(true);

    if (state.errorLog.length > 0) {
        ui.displayErrorReview(state.errorLog);
    } else {
        const finalLevelUpInfo = progression.checkForLevelUp(player.playerData.xp - state.xpEarned, player.playerData.xp);
        ui.displayFinalResult(state, finalLevelUpInfo);
    }
}
// ▲▲▲ نهاية الدالة المعدلة ▲▲▲

export function getCurrentState() {
    return state;
}
