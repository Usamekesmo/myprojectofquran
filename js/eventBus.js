// =============================================================
// ==      ناقل الأحداث المركزي (eventBus.js)
// =============================================================

const listeners = {};

/**
 * دالة للاشتراك (الاستماع) لحدث معين.
 * @param {string} eventName - اسم الحدث الذي تريد الاستماع إليه.
 * @param {function} callback - الدالة التي سيتم استدعاؤها عند وقوع الحدث.
 */
export function subscribe(eventName, callback) {
    if (!listeners[eventName]) {
        listeners[eventName] = [];
    }
    listeners[eventName].push(callback);
    console.log(`[EventBus] تم الاشتراك في الحدث: ${eventName}`);
}

/**
 * دالة لإرسال (نشر) حدث معين.
 * @param {string} eventName - اسم الحدث الذي تريد إرساله.
 * @param {object} data - بيانات إضافية اختيارية لإرسالها مع الحدث.
 */
export function dispatch(eventName, data = {}) {
    console.log(`[EventBus] تم إرسال الحدث: ${eventName}`, data);
    if (listeners[eventName]) {
        listeners[eventName].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[EventBus] خطأ في معالجة الحدث "${eventName}":`, error);
            }
        });
    }
}
