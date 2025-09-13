// =============================================================
// ==      وحدة نظام الإنجازات (Achievements) - محدثة لاستخدام ناقل الأحداث
// =============================================================

import * as player from './player.js';
import * as ui from './ui.js';
import * as progression from './progression.js';
// ▼▼▼ تم استيراد ناقل الأحداث ▼▼▼
import { subscribe } from './eventBus.js';

// ▼▼▼ تم تعديل trigger_event لإنجازات المستويات ▼▼▼
const achievementsConfig = [
    // --- إنجازات المستويات ---
    { id: 1, name: "الوصول للمستوى 5",    trigger_event: "level_up", target_property: "newLevel", comparison: ">=", target_value: 5,  xp_reward: 50,  diamonds_reward: 25 },
    { id: 2, name: "الوصول للمستوى 10",   trigger_event: "level_up", target_property: "newLevel", comparison: ">=", target_value: 10, xp_reward: 100, diamonds_reward: 50 },
    { id: 3, name: "الوصول للمستوى 20",   trigger_event: "level_up", target_property: "newLevel", comparison: ">=", target_value: 20, xp_reward: 200, diamonds_reward: 100 },

    // --- إنجازات الاختبارات ---
    { id: 4, name: "أول اختبار ناجح",     trigger_event: "quiz_completed", target_property: "totalQuizzes", comparison: "===", target_value: 1, xp_reward: 20, diamonds_reward: 10 },
    { id: 5, name: "أداء مثالي!",         trigger_event: "perfect_quiz", target_property: "isPerfect",    comparison: "===", target_value: true, xp_reward: 30, diamonds_reward: 15 },
    { id: 6, name: "خبير الاختبارات",     trigger_event: "quiz_completed", target_property: "totalQuizzes", comparison: "===", target_value: 50, xp_reward: 150, diamonds_reward: 75 },

    // --- إنجازات المتجر ---
    { id: 7, name: "المشتري الأول",       trigger_event: "item_purchased", target_property: "inventorySize", comparison: "===", target_value: 1, xp_reward: 10, diamonds_reward: 5 },
    { id: 8, name: "جامع القراء",         trigger_event: "item_purchased", target_property: "qariCount",     comparison: "===", target_value: 3, xp_reward: 40, diamonds_reward: 20 }
];


/**
 * دالة التهيئة، تقوم الآن بالاشتراك في الأحداث ذات الصلة.
 */
export function initializeAchievements() {
    console.log(`تم تحميل ${achievementsConfig.length} إنجاز من الإعدادات المحلية.`);
    
    // استخراج جميع أنواع الأحداث الفريدة من إعدادات الإنجازات
    const eventTypes = [...new Set(achievementsConfig.map(ach => ach.trigger_event))];
    
    // الاشتراك في كل حدث مرة واحدة فقط
    eventTypes.forEach(eventName => {
        subscribe(eventName, (data) => checkAchievements(eventName, data));
    });

    return Promise.resolve();
}

/**
 * الدالة الرئيسية التي يتم استدعاؤها للتحقق من الإنجازات بعد وقوع حدث معين.
 * @param {string} eventName - اسم الحدث الذي وقع.
 * @param {object} eventData - بيانات إضافية متعلقة بالحدث.
 */
function checkAchievements(eventName, eventData = {}) {
    const relevantAchievements = achievementsConfig.filter(ach => ach.trigger_event === eventName);

    for (const achievement of relevantAchievements) {
        if (player.playerData.achievements.includes(achievement.id)) {
            continue;
        }
        if (isConditionMet(achievement, eventData)) {
            grantAchievement(achievement);
        }
    }
}

/**
 * يتحقق مما إذا كان شرط إنجاز معين قد تحقق.
 */
function isConditionMet(achievement, eventData) {
    const dataContext = {
        ...eventData,
        xp: player.playerData.xp,
        diamonds: player.playerData.diamonds,
        level: progression.getLevelInfo(player.playerData.xp).level,
        inventorySize: player.playerData.inventory.length,
        totalQuizzes: player.playerData.total_quizzes_completed,
        qariCount: player.playerData.inventory.filter(item => item.startsWith('qari_')).length,
        // التأكد من وجود قيم افتراضية لتجنب الأخطاء
        isPerfect: eventData.isPerfect ?? false,
        newLevel: eventData.newLevel ?? 0
    };

    const propertyValue = dataContext[achievement.target_property];
    const targetValue = achievement.target_value;

    if (propertyValue === undefined) return false;

    switch (achievement.comparison) {
        case '===': return propertyValue === targetValue;
        case '>=':  return propertyValue >= targetValue;
        case '<=':  return propertyValue <= targetValue;
        default:    return false;
    }
}

/**
 * يمنح اللاعب إنجازًا ومكافآته.
 */
function grantAchievement(achievement) {
    console.log(`تهانينا! تم تحقيق الإنجاز: ${achievement.name}`);
    player.playerData.achievements.push(achievement.id);
    player.playerData.xp += achievement.xp_reward;
    player.playerData.diamonds += achievement.diamonds_reward;
    ui.showAchievementToast(achievement);
}
