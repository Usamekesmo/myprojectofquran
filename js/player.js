// =============================================================
// ==      وحدة اللاعب (player.js) - محدثة لاستخدام ناقل الأحداث
// =============================================================

import * as api from './api.js';
// ▼▼▼ تم استيراد ناقل الأحداث ▼▼▼
import { dispatch } from './eventBus.js'; 

export let playerData = {};
export const FREE_PAGES = [1, 2, 602, 603, 604];

/**
 * تحميل بيانات اللاعب من الواجهة الخلفية.
 * @returns {boolean} - true إذا تم التحميل بنجاح.
 */
export async function loadPlayer() {
    const fetchedData = await api.fetchPlayer();
    if (!fetchedData) {
        console.error("فشل جلب بيانات اللاعب من الواجهة الخلفية. تحقق من سياسات RLS على جدول 'players'.");
        return false;
    }

    playerData = { ...fetchedData };

    playerData.test_attempts = playerData.test_attempts ?? 3; 
    playerData.seasonal_xp = playerData.seasonal_xp ?? 0;
    playerData.inventory = playerData.inventory || [];
    playerData.achievements = playerData.achievements || [];
    playerData.total_quizzes_completed = playerData.total_quizzes_completed || 0;
    playerData.total_play_time_seconds = playerData.total_play_time_seconds || 0;
    playerData.total_correct_answers = playerData.total_correct_answers || 0;
    playerData.total_questions_answered = playerData.total_questions_answered || 0;
    
    console.log(`تم تحميل بيانات اللاعب بنجاح: ${playerData.username}`);
    
    // ▼▼▼ تم استبدال الاستدعاء المباشر بناقل الأحداث ▼▼▼
    // achievements.checkAchievements('login'); // السطر القديم
    dispatch('login'); // السطر الجديد
    // ▲▲▲ نهاية التعديل ▲▲▲
    
    return true;
}

/**
 * حفظ بيانات اللاعب الحالية في الواجهة الخلفية.
 */
export async function savePlayer() {
    const { id, ...updatableData } = playerData;
    await api.savePlayer({ id, ...updatableData });
    console.log("تم إرسال طلب حفظ بيانات اللاعب إلى الواجهة الخلفية.");
}
