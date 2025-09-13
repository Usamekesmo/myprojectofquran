// =================================================================
// ==      الملف الرئيسي (main.js) - نسخة كاملة ومُهيأة للتشخيص
// =================================================================

import * as ui from './ui.js';
import * as api from './api.js';
import * as quiz from './quiz.js';
import * as player from './player.js';
import * as progression from './progression.js';
import * as store from './store.js';
import * as achievements from './achievements.js';
import * as quests from './quests.js';
import { surahMetadata } from './quran-metadata.js';
import { supabase } from './config.js';

let messageSubscription = null;
let presenceChannel = null;

// --- 1. التهيئة عند تحميل الصفحة ---
async function initializeApp() {
    ui.toggleLoader(true);
    try {
        // تهيئة الوحدات التي لا تعتمد على بيانات اللاعب أولاً
        await achievements.initializeAchievements();
        setupEventListeners();
        ui.showScreen(ui.startScreen);
    } catch (error) {
        console.error("فشل تهيئة التطبيق:", error);
        document.body.innerHTML = '<p style="text-align: center; color: red;">حدث خطأ فادح أثناء التهيئة الأولية. يرجى تحديث الصفحة.</p>';
    } finally {
        ui.toggleLoader(false);
    }
}

// --- 2. إعداد مستمعي الأحداث (Event Listeners) ---
function setupEventListeners() {
    document.getElementById('loginButton')?.addEventListener('click', handleLogin);
    document.getElementById('signUpButton')?.addEventListener('click', handleSignUp);
    document.getElementById('reloadButton')?.addEventListener('click', returnToMainMenu);
    document.getElementById('show-final-result-button')?.addEventListener('click', showFinalResultScreen);
    document.getElementById('startTestButton')?.addEventListener('click', onStartPageTestClick);
// في ملف main.js، داخل دالة setupEventListeners()

document.body.addEventListener('change', async (e) => {
    if (e.target.matches('#title-select')) {
        const selectedTitle = e.target.value;
        player.playerData.equipped_title = selectedTitle || null; // احفظ null إذا اختار "بدون لقب"
        await player.savePlayer();
        ui.showToast("تم تحديث لقبك بنجاح!", "success");
        updateUIWithPlayerData(); // تحديث رأس الصفحة فوراً
    }
});

    document.body.addEventListener('click', (e) => {
        const target = e.target;

        const friendItem = target.closest('.friend-item[data-friend-id]');
        if (friendItem && !target.closest('button')) {
            const friendId = friendItem.dataset.friendId;
            const friendUsername = friendItem.dataset.friendUsername;
            openChatWindow({ id: friendId, username: friendUsername });
            return;
        }

        const button = target.closest('button');
        if (!button) return;

        const actions = {
            '.tab-button': () => handleMainUITabClick(button),
            '.filter-button': () => handleStoreFilterClick(button),
            '.sub-tab-button': () => handleLeaderboardSubTabClick(button.dataset.leaderboard),
            '.details-button': () => store.handleDetailsClick(button.dataset.itemId),
            '#modal-buy-button': () => store.purchaseItem(button.dataset.itemId),
            '#modal-close-btn': () => ui.showModal(false),
            '.claim-button:not([disabled])': () => quests.handleClaimReward(e),
            '.claim-challenge-button:not([disabled])': () => handleClaimChallengeReward(button.dataset.challengeId),
            '.join-event-btn': () => handleJoinLiveEvent(button.dataset.eventId),
            '#friend-search-button': handleSearchFriends,
            '.add-friend-btn': () => sendFriendRequest(button.dataset.userId),
            '.accept-friend-btn': () => handleFriendRequest(button.dataset.friendshipId, 'accepted'),
            '.reject-friend-btn': () => handleFriendRequest(button.dataset.friendshipId, 'rejected'),
            '.remove-friend-btn': () => handleFriendRequest(button.dataset.friendshipId, 'removed'),
            '#create-clan-btn': handleCreateClan,
            '#leave-clan-btn': handleLeaveClan,
            '#delete-clan-btn': handleDeleteClan,
            '.join-clan-btn': () => handleJoinClan(button.dataset.clanId),
            '#send-chat-message-btn': () => handleSendMessage(button.dataset.receiverId),
            '#show-clans-leaderboard-btn': handleShowClansLeaderboard,
            '#generic-modal-close-btn': () => ui.toggleGenericModal(false),
        };

        for (const selector in actions) {
            if (button.matches(selector)) {
                actions[selector]();
                return;
            }
        }
    });

    document.body.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches('#chat-message-input')) {
            e.preventDefault();
            const sendButton = document.getElementById('send-chat-message-btn');
            if (sendButton) handleSendMessage(sendButton.dataset.receiverId);
        }
    });
}

// --- 3. معالجات الأحداث (Event Handlers) ---
async function handleLogin() {
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) return ui.showToast("يرجى إدخال اسم المستخدم وكلمة المرور.", "error");
    ui.toggleLoader(true);
    try {
        const email = await api.getEmailForUsername(username);
        if (!email) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
        const { error } = await api.loginUser(email, password);
        if (error) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة.");
        await onSuccessfulAuth();
    } catch (error) {
        ui.showToast(error.message, "error");
        ui.toggleLoader(false);
    }
}

async function handleSignUp() {
    const usernameInput = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('password').value;
    if (!usernameInput || !password) return ui.showToast("يرجى إدخال اسم مستخدم وكلمة مرور.", "error");
    ui.toggleLoader(true);
    try {
        const randomString = Math.random().toString(36).substring(2, 15);
        const dummyEmail = `${usernameInput.replace(/\s/g, '_')}_${randomString}@quran-app.local`;
        const { error } = await api.signUpUser(dummyEmail, password, usernameInput);
        if (error) throw new Error(error.message);
        ui.showToast("تم إنشاء حسابك بنجاح! جاري تسجيل الدخول...", "info");
        await onSuccessfulAuth();
    } catch (error) {
        ui.showToast(`فشل إنشاء الحساب: ${error.message}`, "error");
        ui.toggleLoader(false);
    }
}

async function onSuccessfulAuth() {
    ui.toggleLoader(true);
    try {
        // الخطوة 1: تهيئة الوحدات الأساسية التي تعتمد على قاعدة البيانات
        await Promise.all([
            progression.initializeProgression(),
            quiz.initializeQuiz()
        ]);

        // الخطوة 2: تحميل بيانات اللاعب (هنا سيتم التقاط الخطأ المفصل من api.js)
        const playerLoaded = await player.loadPlayer();
        if (!playerLoaded) {
            // هذا السطر لن يتم الوصول إليه إذا ألقى api.js خطأ، ولكن كإجراء احترازي
            throw new Error("فشل تحميل بيانات اللاعب لسبب غير معروف.");
        }

        // الخطوة 3: منطق إعادة التعيين اليومي
        const now = new Date();
        const lastReset = player.playerData.last_daily_reset ? new Date(player.playerData.last_daily_reset) : null;
        let needsSave = false;
        if (!lastReset || (now.getTime() - lastReset.getTime()) > 24 * 60 * 60 * 1000) {
            player.playerData.test_attempts = 3;
            player.playerData.last_daily_reset = now.toISOString();
            needsSave = true;
            ui.showToast("تم تجديد محاولاتك اليومية!", "success");
        }
        
        // الخطوة 4: جلب البيانات المتبقية
        const [storeConfig, dailyQuests, activeSeason] = await Promise.all([
            api.fetchStoreConfig(),
            api.fetchOrAssignDailyQuests(),
            api.fetchActiveSeason(),
        ]);

        store.processStoreData(storeConfig, []);
        quests.initialize(dailyQuests);
        if (activeSeason) ui.displaySeasonInfo(activeSeason);

        if (needsSave) {
            await player.savePlayer();
        }

        // الخطوة 5: إعداد قنوات Supabase Realtime
        if (presenceChannel) supabase.removeChannel(presenceChannel);
        presenceChannel = supabase.channel('online-users', { config: { presence: { key: player.playerData.id } } });
        presenceChannel.on('presence', { event: 'sync' }, () => {
            if (document.getElementById('friends-tab')?.classList.contains('active')) renderFriendsTab();
        }).subscribe(async (status) => {
            if (status === 'SUBSCRIBED') await presenceChannel.track({ online_at: new Date().toISOString() });
        });
        
        if (messageSubscription) messageSubscription.unsubscribe();
        messageSubscription = api.subscribeToNewMessages((newMessage) => {
            if (newMessage.receiver_id === player.playerData.id) {
                ui.showToast(`رسالة جديدة من صديق!`, 'info');
                if (document.querySelector('.chat-header')) ui.appendMessageToChat(newMessage, player.playerData.id);
            }
        });

        // الخطوة 6: تحديث الواجهة وعرض الشاشة الرئيسية
        updateUIWithPlayerData();
        ui.showScreen(ui.mainInterface);

    } catch (error) {
        // ▼▼▼ هذا الجزء سيلتقط الآن الخطأ المفصل من api.js ويعرضه ▼▼▼
        console.error("خطأ حاسم بعد المصادقة:", error);
        ui.showToast(error.message, "error");
        if (supabase) await supabase.auth.signOut();
        ui.showScreen(ui.startScreen);
    } finally {
        ui.toggleLoader(false);
    }
}

function returnToMainMenu() {
    updateUIWithPlayerData();
    ui.showScreen(ui.mainInterface);
    ui.showTab('test-tab');
}

function showFinalResultScreen() {
    const quizState = quiz.getCurrentState();
    const oldXp = player.playerData.xp - quizState.xpEarned;
    const levelUpInfo = progression.checkForLevelUp(oldXp, player.playerData.xp);
    ui.displayFinalResult(quizState, levelUpInfo);
}

function handleMainUITabClick(button) {
    const tabId = button.dataset.tab;
    ui.showTab(tabId);
    
    const actions = {
        'store-tab': () => handleStoreFilterClick(document.querySelector('.filter-button.active')),
        // استبدله بهذا الكود المحدث:
'leaderboard-tab': async () => {
    const activeSeason = await api.fetchActiveSeason();
    if (activeSeason) {
        const rewards = await api.fetchSeasonRewards(activeSeason.id);
        ui.displaySeasonInfo(activeSeason, rewards); // <--- السطر الجديد
    }
    handleLeaderboardSubTabClick('seasonal');
},
        'profile-tab': () => ui.renderPlayerStats(player.playerData),
        'quests-tab': () => quests.renderQuests(),
        'challenges-tab': renderChallengesTab,
        'friends-tab': renderFriendsTab,
        'clans-tab': renderClansTab,
    };
    if (actions[tabId]) actions[tabId]();
}

function handleStoreFilterClick(button) {
    if (!button) return;
    document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    store.renderStoreTabs(button.dataset.filter);
}

async function handleLeaderboardSubTabClick(leaderboardType) {
    document.querySelectorAll('.sub-tab-button').forEach(btn => btn.classList.remove('active'));
    const activeButton = document.querySelector(`.sub-tab-button[data-leaderboard="${leaderboardType}"]`);
    if (activeButton) activeButton.classList.add('active');
    if (ui.leaderboardList) ui.leaderboardList.innerHTML = '<p>جاري تحميل لوحة الصدارة...</p>';
    const data = leaderboardType === 'seasonal' ? await api.fetchSeasonalLeaderboard() : await api.fetchLeaderboard();
    const key = leaderboardType === 'seasonal' ? 'seasonal_xp' : 'xp';
    ui.displayLeaderboard(data, key);
}

async function onStartPageTestClick() {
    const hasEnergyStars = (player.playerData.energy_stars || 0) > 0;
    const hasTestAttempts = (player.playerData.test_attempts || 0) > 0;
    if (!hasEnergyStars && !hasTestAttempts) return ui.showToast("ليس لديك محاولات اختبار متبقية.", "error");

    const page = ui.pageSelect.value;
    if (!page) return ui.showToast("يرجى اختيار صفحة لبدء الاختبار.", "error");
    const selection = { type: 'single', pages: [parseInt(page)] };

    if (hasEnergyStars) player.playerData.energy_stars--; else player.playerData.test_attempts--;
    updateUIWithPlayerData();

    ui.toggleLoader(true);
    try {
        const pageAyahs = await api.fetchPageData(selection.pages[0]);
        if (!pageAyahs || pageAyahs.length === 0) throw new Error(`فشل تحميل بيانات الصفحة رقم ${selection.pages[0]}.`);

        quiz.start({
            pageAyahs: pageAyahs,
            totalQuestions: parseInt(ui.questionsCountSelect.value, 10),
            selectedQari: ui.qariSelect.value,
            userName: player.playerData.username,
            pageNumber: selection.pages[0],
            testMode: { type: 'normal_test' }
        });
    } catch (error) {
        ui.showToast(error.message, "error");
    } finally {
        ui.toggleLoader(false);
    }
}

function updateUIWithPlayerData() {
    const levelInfo = progression.getLevelInfo(player.playerData.xp);
    ui.updatePlayerHeader(player.playerData, levelInfo);
    updateAvailablePages();
    ui.populateQariSelect(ui.qariSelect, player.playerData.inventory);
    const maxQuestions = progression.getMaxQuestionsForLevel(levelInfo.level);
    ui.updateQuestionsCountOptions(maxQuestions);
}

function updateAvailablePages() {
    const ownedPages = player.playerData.inventory.filter(id => id.startsWith('page_')).map(id => parseInt(id.replace('page_', ''), 10));
    const availablePages = [...new Set([...player.FREE_PAGES, ...ownedPages])].sort((a, b) => a - b);
    if (ui.pageSelect) {
        ui.pageSelect.innerHTML = '';
        availablePages.forEach(pageNumber => {
            const option = document.createElement('option');
            option.value = pageNumber;
            option.textContent = `صفحة ${pageNumber} (${getSurahInfoForPage(pageNumber)})`;
            ui.pageSelect.appendChild(option);
        });
    }
}

function getSurahInfoForPage(pageNumber) {
    for (const surahNum in surahMetadata) {
        const meta = surahMetadata[surahNum];
        if (pageNumber >= meta.startPage && pageNumber <= meta.endPage) {
            return meta.name;
        }
    }
    return 'غير معروف';
}

async function renderChallengesTab() {
    if (ui.specialChallengesContainer) {
        ui.specialChallengesContainer.innerHTML = '<p>جاري تحميل التحديات والأحداث...</p>';
    }

    const [challenges, playerProgress, liveEvents] = await Promise.all([
        api.fetchActiveChallenges(),
        api.fetchPlayerChallengeProgress(player.playerData.id),
        api.fetchActiveLiveEvents()
    ]);

    ui.renderSpecialChallenges(challenges, playerProgress);
    ui.renderLiveEvents(liveEvents);
}

async function handleClaimChallengeReward(challengeId) {
    const challenges = await api.fetchActiveChallenges();
    const challenge = challenges.find(c => c.id.toString() === challengeId);
    if (!challenge) return ui.showToast("هذا التحدي لم يعد متاحًا.", "error");
    
    const playerProgressList = await api.fetchPlayerChallengeProgress(player.playerData.id);
    const progress = playerProgressList.find(p => p.challenge_id.toString() === challengeId);
    if (!progress || !progress.is_completed || progress.is_claimed) return ui.showToast("لا يمكنك المطالبة بهذه الجائزة.", "error");

    player.playerData.xp += challenge.reward_xp;
    player.playerData.seasonal_xp = (player.playerData.seasonal_xp || 0) + challenge.reward_xp;
    player.playerData.diamonds += challenge.reward_diamonds;
    progress.is_claimed = true;
    
    await api.savePlayerChallengeProgress(progress);
    await player.savePlayer();
    
    ui.showToast(`تهانينا! لقد حصلت على مكافأة تحدي "${challenge.title}"!`, "success");
    updateUIWithPlayerData();
    renderChallengesTab();
}

async function handleJoinLiveEvent(eventId) {
    const hasEnergyStars = (player.playerData.energy_stars || 0) > 0;
    const hasTestAttempts = (player.playerData.test_attempts || 0) > 0;
    if (!hasEnergyStars && !hasTestAttempts) return ui.showToast("ليس لديك محاولات اختبار متبقية للمشاركة في الحدث.", "error");

    ui.toggleLoader(true);
    try {
        const events = await api.fetchActiveLiveEvents();
        const event = events.find(e => e.id.toString() === eventId);
        if (!event) throw new Error("عذرًا، هذا الحدث لم يعد متاحًا.");

        let pagesForTest = [];
        if (event.scope_type === 'page') {
            pagesForTest.push(parseInt(event.scope_value, 10));
        } else if (event.scope_type === 'surah') {
            const surahInfo = surahMetadata[event.scope_value];
            if (!surahInfo) throw new Error(`بيانات السورة رقم ${event.scope_value} غير موجودة.`);
            for (let i = surahInfo.startPage; i <= surahInfo.endPage; i++) pagesForTest.push(i);
        } else if (event.scope_type === 'range') {
            const [start, end] = event.scope_value.split('-').map(Number);
            if (isNaN(start) || isNaN(end) || end < start) throw new Error('نطاق الصفحات المحدد في الحدث غير صالح.');
            for (let i = start; i <= end; i++) pagesForTest.push(i);
        }

        if (pagesForTest.length === 0 || !event.questions_count) {
            return ui.showToast("تفاصيل اختبار هذا الحدث غير مكتملة. يرجى مراجعة الإدارة.", "error");
        }

        if (hasEnergyStars) player.playerData.energy_stars--; else player.playerData.test_attempts--;
        updateUIWithPlayerData();

        const pagePromises = pagesForTest.map(pageNumber => api.fetchPageData(pageNumber));
        const results = await Promise.all(pagePromises);
        
        const allPagesAyahs = results.flat();
        if (allPagesAyahs.length === 0) throw new Error(`فشل تحميل بيانات الصفحات الخاصة بالحدث.`);

        quiz.start({
            pageAyahs: allPagesAyahs,
            totalQuestions: event.questions_count,
            selectedQari: ui.qariSelect.value,
            userName: player.playerData.username,
            pageNumber: 0,
            testMode: { type: 'live_event', eventId: event.id, eventTitle: event.title }
        });

    } catch (error) {
        ui.showToast(error.message, "error");
    } finally {
        ui.toggleLoader(false);
    }
}

async function renderFriendsTab() {
    const userId = player.playerData.id;
    if (!userId) return;
    
    ui.renderFriendsTab({ status: 'loading' });

    const presenceState = presenceChannel ? presenceChannel.presenceState() : {};
    const onlineUsers = Object.keys(presenceState);

    const friendships = await api.fetchFriendships(userId);
    
    ui.renderFriendsTab({ status: 'loaded', friendships, currentUserId: userId, onlineUsers });
}

async function handleSearchFriends() {
    const searchInput = document.getElementById('friend-search-input');
    const searchText = searchInput.value.trim();
    if (searchText.length < 3) return ui.showToast("يرجى إدخال 3 أحرف على الأقل للبحث.", "warning");
    ui.renderFriendSearchResults({ status: 'loading' });
    const [searchResults, friendships] = await Promise.all([
        api.searchPlayers(searchText, player.playerData.id),
        api.fetchFriendships(player.playerData.id)
    ]);
    ui.renderFriendSearchResults({ status: 'loaded', searchResults, friendships, currentUserId: player.playerData.id });
}
async function sendFriendRequest(toUserId) {
    try {
        await api.sendFriendRequest(player.playerData.id, toUserId);
        ui.showToast("تم إرسال طلب الصداقة بنجاح!", "success");
        const button = document.querySelector(`.add-friend-btn[data-user-id="${toUserId}"]`);
        if (button) { button.textContent = 'تم الإرسال'; button.disabled = true; }
    } catch (error) {
        ui.showToast(error.message, "error");
    }
}
async function handleFriendRequest(friendshipId, action) {
    try {
        if (action === 'accepted') {
            await api.updateFriendshipStatus(friendshipId, 'accepted');
            ui.showToast("تم قبول الصداقة!", "success");
        } else {
            await api.removeFriendship(friendshipId);
            ui.showToast(action === 'rejected' ? "تم رفض الطلب." : "تمت إزالة الصديق.", "info");
        }
        renderFriendsTab();
    } catch (error) {
        ui.showToast(error.message, "error");
    }
}

async function renderClansTab() {
    const container = document.getElementById('clans-container');
    if (!container) return;
    container.innerHTML = '<p>جاري تحميل...</p>';
    
    const currentClanId = player.playerData.clan_id;
    try {
        if (currentClanId) {
            const [clanDetails, activeQuest] = await Promise.all([
                api.fetchClanDetails(currentClanId),
                api.fetchActiveClanQuest(currentClanId) 
            ]);
            ui.renderClanDetailsView(container, clanDetails, player.playerData.id, activeQuest);
        } else {
            const allClans = await api.fetchAllClans();
            ui.renderNoClanView(container, allClans);
        }
    } catch (error) {
        console.error("خطأ أثناء عرض تبويب القبيلة:", error);
        container.innerHTML = '<p class="error-message">حدث خطأ أثناء تحميل بيانات القبيلة. يرجى المحاولة مرة أخرى.</p>';
    }
}
async function handleShowClansLeaderboard() {
    try {
        const leaderboardData = await api.fetchClansLeaderboard();
        ui.toggleGenericModal(true, ui.getClansLeaderboardHTML(leaderboardData));
    } catch (error) {
        ui.showToast(error.message, "error");
    }
}
async function handleCreateClan() {
    const name = document.getElementById('new-clan-name').value.trim();
    const emblem = document.getElementById('new-clan-emblem').value.trim();
    const description = document.getElementById('new-clan-description').value.trim();
    if (!name || !emblem) return ui.showToast("اسم القبيلة والشعار مطلوبان.", "error");
    try {
        const newClanId = await api.createClan(name, description, emblem);
        player.playerData.clan_id = newClanId;
        await player.savePlayer();
        ui.showToast("تهانينا! تم تأسيس قبيلتك بنجاح.", "success");
        renderClansTab();
    } catch (error) {
        ui.showToast(error.message, "error");
    }
}
async function handleLeaveClan() {
    if (confirm('هل أنت متأكد من رغبتك في مغادرة القبيلة؟')) {
        try {
            await api.leaveCurrentClan();
            player.playerData.clan_id = null;
            await player.savePlayer();
            renderClansTab();
        } catch (error) {
            ui.showToast(error.message, "error");
        }
    }
}
async function handleDeleteClan() {
    if (confirm('تحذير! سيتم حذف القبيلة نهائيًا لجميع الأعضاء. هل أنت متأكد؟')) {
        try {
            await api.deleteClan(player.playerData.clan_id);
            player.playerData.clan_id = null;
            await player.savePlayer();
            renderClansTab();
        } catch (error) {
            ui.showToast(error.message, "error");
        }
    }
}
async function handleJoinClan(clanId) {
    if (!clanId) return;
    if (confirm('هل أنت متأكد من رغبتك في الانضمام إلى هذه القبيلة؟')) {
        try {
            await api.joinClan(clanId);
            player.playerData.clan_id = clanId;
            await player.savePlayer();
            ui.showToast("لقد انضممت إلى القبيلة بنجاح!", "success");
            renderClansTab();
        } catch (error) {
            ui.showToast(error.message, "error");
        }
    }
}

async function openChatWindow(friend) {
    const currentUserId = player.playerData.id;
    try {
        const history = await api.fetchChatHistory(currentUserId, friend.id);
        ui.showChatModal(friend, history, currentUserId);
    } catch (error) {
        ui.showToast("فشل تحميل سجل المحادثة.", "error");
    }
}
async function handleSendMessage(receiverId) {
    const input = document.getElementById('chat-message-input');
    if (!input) return;
    const content = input.value.trim();
    if (!content) return;
    try {
        input.disabled = true;
        document.getElementById('send-chat-message-btn').disabled = true;
        await api.sendMessage(player.playerData.id, receiverId, content);
        const sentMessage = { sender_id: player.playerData.id, content: content, created_at: new Date().toISOString() };
        ui.appendMessageToChat(sentMessage, player.playerData.id);
        input.value = '';
    } catch (error) {
        ui.showToast(error.message, "error");
    } finally {
        input.disabled = false;
        document.getElementById('send-chat-message-btn').disabled = false;
        input.focus();
    }
}

// --- بدء تشغيل التطبيق ---
document.addEventListener('DOMContentLoaded', initializeApp);
