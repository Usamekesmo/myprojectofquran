// =============================================================
// ==      وحدة التقدم (progression.js) - نسخة مُحسّنة وآمنة
// =============================================================

import * as api from './api.js';

let config = {
    levels: [],
    xp_per_correct_answer: 5,
    xp_bonus_all_correct: 50,
};

let isInitialized = false;

export async function initializeProgression() {
    if (isInitialized) return;

    try {
        const levelsData = await api.fetchLevelsConfig(); 
        
        if (levelsData && levelsData.length > 0) {
            config.levels = levelsData
                .map(level => ({
                    ...level,
                    level: parseInt(level.level, 10),
                    xp_required: parseInt(level.xp_required, 10),
                    questions_per_test: parseInt(level.questions_per_test, 10),
                    diamonds_reward: parseInt(level.diamonds_reward, 10)
                }))
                .sort((a, b) => a.level - b.level);

            if (config.levels.length === 0) {
                throw new Error("بيانات المستويات غير صالحة بعد المعالجة.");
            }
            
            isInitialized = true;
            console.log(`تم تحميل ${config.levels.length} مستوى بنجاح من جدول "levels".`);
        } else {
            throw new Error("لم يتم العثور على بيانات المستويات في جدول 'levels'.");
        }
    } catch (error) {
        console.error("خطأ فادح أثناء تهيئة إعدادات التقدم:", error.message);
        isInitialized = false;
        // ▼▼▼ هذا هو التعديل المهم ▼▼▼
        // أعد إلقاء الخطأ لإعلام الدالة المستدعية بأن التهيئة فشلت.
        throw error; 
    }
}

export function getGameRules() {
    return {
        xp_per_correct_answer: config.xp_per_correct_answer,
        xp_bonus_all_correct: config.xp_bonus_all_correct,
    };
}

export function getLevelInfo(currentXp) {
    const playerXp = parseInt(currentXp, 10) || 0;
    // التحقق من التهيئة قبل الاستخدام
    if (!isInitialized || config.levels.length === 0) {
        console.error("محاولة استخدام getLevelInfo قبل تهيئة وحدة التقدم بنجاح.");
        // إرجاع قيم افتراضية آمنة
        return { level: 1, title: 'مبتدئ', progress: 0, nextLevelXp: 100, currentLevelXp: 0 };
    }
    
    let currentLevelData = config.levels[0];
    for (let i = config.levels.length - 1; i >= 0; i--) {
        if (playerXp >= config.levels[i].xp_required) {
            currentLevelData = config.levels[i];
            break;
        }
    }

    const { level: currentLevel, title: currentTitle, xp_required: currentLevelXp } = currentLevelData;
    const nextLevelData = config.levels.find(l => l.level === currentLevel + 1);
    const nextLevelXp = nextLevelData ? nextLevelData.xp_required : currentLevelXp;
    
    let progress = 100;
    if (nextLevelData && nextLevelXp > currentLevelXp) {
        progress = ((playerXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
    }

    return {
        level: currentLevel,
        title: currentTitle,
        progress: Math.min(100, Math.max(0, progress)),
        nextLevelXp,
        currentLevelXp,
    };
}

export function getAvailablePaths(playerLevel) {
    const numericLevel = parseInt(playerLevel, 10);
    const paths = ['basic'];
    if (numericLevel >= 21) paths.push('hafez');
    if (numericLevel >= 41) paths.push('mutqen');
    if (numericLevel >= 61) paths.push('mujaz');
    return paths;
}

export function checkForLevelUp(oldXp, newXp) {
    const oldLevelInfo = getLevelInfo(oldXp);
    const newLevelInfo = getLevelInfo(newXp);
    if (newLevelInfo.level > oldLevelInfo.level) {
        const newLevelData = config.levels.find(l => l.level === newLevelInfo.level);
        return { ...newLevelInfo, reward: newLevelData?.diamonds_reward || 0 };
    }
    return null;
}

export function getMaxQuestionsForLevel(playerLevel) {
    if (!isInitialized || config.levels.length === 0) return 5;
    const levelData = config.levels.find(l => l.level === playerLevel);
    return levelData ? levelData.questions_per_test : 5;
}
