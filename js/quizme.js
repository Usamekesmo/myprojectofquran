
// =============================================================
// ==      وحدة الاختبار (quiz.js) - النسخة النهائية والنظيفة
// =============================================================

import * as ui from './ui.js';
import * as api from './api.js';
import * as player from './player.js';
import * as progression from './progression.js';
import * as achievements from './achievements.js';
import * as quests from './quests.js';
import { allQuestionGenerators } from './questions.js';

// الحالة الأولية الأصلية
let state = {
    pageAyahs: [],
    intruderAyahs: [],
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
    testMode: 'normal_test',
    liveEvent: null,
};

let allQuestionTypes = [];
const shuffleArray = array => [...array].sort(() => 0.5 - Math.random());

export async function initializeQuiz() {
    const config = await api.fetchQuestionsConfig();
    if (config && config.length > 0) {
        allQuestionTypes = config;
    } else {
        console.error("فشل تحميل إعدادات الأسئلة من قاعدة البيانات.");
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

    if (!state.intruderAyahs || state.intruderAyahs.length < 5) {
        const currentPageNumber = state.pageNumber || state.pageAyahs[0]?.pageNumber;
        const randomIntruderPage = Math.floor(Math.random() * 604) + 1;
        if (randomIntruderPage !== currentPageNumber) {
            const intruders = await api.fetchPageData(randomIntruderPage);
            if (intruders && intruders.length > 0) {
                state.intruderAyahs = intruders;
            }
        }
    }

    const levelInfo = progression.getLevelInfo(player.playerData.xp);
    const availablePaths = progression.getAvailablePaths(levelInfo.level);
    
    const availableGenerators = allQuestionTypes
        .filter(q => 
            parseInt(levelInfo.level, 10) >= parseInt(q.required_level, 10) && 
            availablePaths.includes(q.required_path)
        )
        .map(q => allQuestionGenerators[q.id])
        .filter(Boolean);

    if (availableGenerators.length === 0) {
        ui.questionArea.innerHTML = `<p style="color: red;">خطأ: لا توجد أنواع أسئلة متاحة لمستواك (${levelInfo.level}) ومساراتك الحالية (${availablePaths.join(', ')}).</p>`;
        return;
    }

    let questionObject = null;
    let attempts = 0;
    let shuffledGenerators = shuffleArray(availableGenerators);

    while (!questionObject && attempts < shuffledGenerators.length) {
        const generator = shuffledGenerators[attempts];
        try {
            questionObject = await Promise.resolve(generator(state.pageAyahs, state.intruderAyahs, state.selectedQari, handleResult));
        } catch (error) {
            console.error(`حدث خطأ أثناء محاولة المولد ${generator ? generator.name : 'مولد غير معروف'}:`, error);
        }
        attempts++;
    }

    if (questionObject) {
        state.currentQuestionHTML = questionObject.questionHTML;
        ui.questionArea.innerHTML = questionObject.questionHTML;
        await Promise.resolve(questionObject.setupListeners(ui.questionArea));
    } else {
        ui.questionArea.innerHTML = '<p style="color: red;">عذرًا، حدث خطأ غير متوقع أثناء تحضير السؤال. قد تكون هذه الصفحة قصيرة جدًا. يرجى محاولة العودة والبدء من جديد.</p>';
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
    } else {
        state.errorLog.push({
            questionHTML: state.currentQuestionHTML,
            correctAnswer: correctAnswerText,
            question_id: questionType
        });
    }

    state.currentQuestionIndex++;
    setTimeout(displayNextQuestion, 2500);
}

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
        if (state.liveEvent) {
            player.playerData.diamonds += state.liveEvent.reward_diamonds || 0;
        }
        if (state.pageNumber) {
            api.updateMasteryRecord(state.pageNumber, durationInSeconds);
        }
        quests.updateQuestsProgress('mastery_check');
    }

    const oldXp = player.playerData.xp;
    player.playerData.xp += state.xpEarned;
    player.playerData.seasonal_xp = (player.playerData.seasonal_xp || 0) + state.xpEarned;

    const levelUpInfo = progression.checkForLevelUp(oldXp, player.playerData.xp);
    if (levelUpInfo) {
        player.playerData.diamonds += levelUpInfo.reward;
    }

    quests.updateQuestsProgress('quiz_completed');
    achievements.checkAchievements('quiz_completed', {
        isPerfect: isPerfect,
        pageNumber: state.pageNumber
    });

    const resultToSave = {
        pageNumber: state.pageNumber,
        score: state.score,
        totalQuestions: state.totalQuestions,
        xpEarned: state.xpEarned,
        errorLog: state.errorLog
    };
    
    await player.savePlayer();
    if (resultToSave.pageNumber) {
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

export function getCurrentState() {
    return state;
}
 
