// =============================================================
// ==      وحدة الاتصالات (api.js) - نسخة كاملة ومُحصّنة
// =============================================================

import { supabase } from './config.js';

// --- 1. دوال المصادقة (Authentication) ---

export async function loginUser(email, password) {
    return await supabase.auth.signInWithPassword({ email, password });
}

export async function signUpUser(email, password, username) {
    return await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username: username,
            }
        }
    });
}

export async function getEmailForUsername(username) {
    const { data, error } = await supabase
        .from('players')
        .select('email')
        .eq('username', username)
        .single();

    if (error) {
        console.error(`خطأ أثناء البحث عن بريد للمستخدم "${username}":`, error.message);
        return null;
    }
    return data ? data.email : null;
}


// --- 2. دوال جلب البيانات العامة (Data Fetching) ---

// ▼▼▼ هذه هي الدالة التي تم تحصينها بشكل كامل ▼▼▼
export async function fetchPlayer() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        // هذا يجب ألا يحدث إذا كانت المصادقة ناجحة، ولكنه فحص أمان جيد
        throw new Error("جلسة المستخدم غير صالحة أو منتهية الصلاحية.");
    }

    const { data, error } = await supabase.from('players').select('*').eq('id', user.id).single();
    
    if (error) {
        // إذا كان هناك خطأ في الشبكة أو قاعدة البيانات
        console.error("خطأ في جلب بيانات اللاعب من Supabase:", error);
        throw new Error(`خطأ في قاعدة البيانات: ${error.message}`);
    }

    if (!data) {
        // هذا هو السيناريو الأخطر: المصادقة نجحت لكن لا توجد بيانات للاعب
        // السبب الأكثر شيوعًا هو مشكلة في سياسة RLS (Row Level Security)
        console.error("لم يتم العثور على بيانات للاعب على الرغم من نجاح المصادقة. تحقق من سياسات RLS على جدول 'players'.");
        throw new Error("فشل العثور على ملف تعريف اللاعب. قد تكون هناك مشكلة في إعدادات الحساب أو أذونات قاعدة البيانات (RLS).");
    }

    return data;
}

export async function fetchProgressionConfig() {
    const { data, error } = await supabase.from('progression_config').select('settings').eq('id', 1).single();
    if (error) {
        console.error("خطأ في جلب إعدادات التقدم:", error);
        return null;
    }
    return data ? data.settings : null;
}

export async function fetchQuestionsConfig() {
    const { data, error } = await supabase.from('questions_config').select('*');
    if (error) console.error("خطأ في جلب إعدادات الأسئلة:", error);
    return data || [];
}

export async function fetchLevelsConfig() {
    const { data, error } = await supabase.from('levels').select('*').order('level', { ascending: true });
    if (error) {
        console.error("خطأ في جلب إعدادات المستويات من جدول 'levels':", error);
        return null;
    }
    return data;
}

export async function fetchStoreConfig() {
    const { data, error } = await supabase.from('store_config').select('*').order('sort_order', { ascending: true });
    if (error) console.error("خطأ في جلب إعدادات المتجر:", error);
    return data || [];
}

export async function fetchPageData(pageNumber) {
    try {
        const response = await fetch(`https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthmani`);
        if (!response.ok) throw new Error('فشل استجابة الشبكة.');
        const data = await response.json();
        return data.data.ayahs;
    } catch (error) {
        console.error("Error fetching page data:", error);
        return null;
    }
}

export async function fetchLeaderboard() {
    const { data, error } = await supabase.from('players').select('username, xp').order('xp', { ascending: false }).limit(10);
    if (error) console.error("خطأ في جلب لوحة الصدارة الدائمة:", error);
    return data || [];
}

export async function fetchSeasonalLeaderboard() {
    const { data, error } = await supabase
        .from('players')
        .select('username, seasonal_xp')
        .order('seasonal_xp', { ascending: false })
        .limit(10);
        
    if (error) console.error("خطأ في جلب لوحة الصدارة الموسمية:", error);
    return data || [];
}


// --- 3. دوال المهام والتحديات والأحداث ---

export async function fetchOrAssignDailyQuests() {
    const { data, error } = await supabase
        .rpc('get_or_assign_daily_quests')
        .select('*, quests_config(*)');

    if (error) {
        console.error("خطأ في جلب أو تعيين المهام اليومية:", error);
        return [];
    }
    return data || [];
}

export async function fetchActiveChallenges() {
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from('special_challenges')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now);
    
    if (error) console.error("خطأ في جلب التحديات النشطة:", error);
    return data || [];
}

export async function fetchPlayerChallengeProgress(userId) {
    const { data, error } = await supabase
        .from('player_challenge_progress')
        .select('*')
        .eq('player_id', userId);

    if (error) console.error("خطأ في جلب تقدم اللاعب في التحديات:", error);
    return data || [];
}

export async function fetchActiveLiveEvents() {
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from('live_events')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now);

    if (error) {
        console.error("خطأ في جلب الأحداث المباشرة:", error);
        return [];
    }
    return data || [];
}


// --- 4. دوال حفظ البيانات (Data Saving) ---

export async function savePlayer(playerData) {
    const { id, ...updatableData } = playerData;
    const { error } = await supabase.from('players').update(updatableData).eq('id', id);
    if (error) console.error("خطأ في حفظ بيانات اللاعب:", error);
}

export async function saveResult(resultData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const dataToSave = {
        user_id: user.id,
        page_number: resultData.pageNumber,
        score: resultData.score,
        total_questions: resultData.totalQuestions,
        xp_earned: resultData.xpEarned,
        errors: resultData.errorLog
    };
    const { error } = await supabase.from('quiz_results').insert([dataToSave]);
    if (error) console.error("خطأ في حفظ نتيجة الاختبار:", error);
}

export async function updatePlayerQuests(updates) {
    const { error } = await supabase.from('player_quests').upsert(updates, { onConflict: 'id' });
    if (error) console.error("Error updating player quests:", error);
}

export async function savePlayerChallengeProgress(progressData) {
    const { error } = await supabase
        .from('player_challenge_progress')
        .upsert(progressData, { onConflict: 'player_id, challenge_id' });

    if (error) console.error("خطأ في حفظ تقدم التحدي:", error);
}


// --- 5. دوال الأصدقاء (Friends) ---

export async function searchPlayers(searchText, currentUserId) {
    const { data, error } = await supabase
        .from('players')
        .select('id, username, xp')
        .ilike('username', `%${searchText}%`)
        .not('id', 'eq', currentUserId)
        .limit(10);
    if (error) throw new Error(error.message);
    return data;
}

export async function fetchFriendships(userId) {
    const { data, error } = await supabase
        .from('friendships')
        .select('*, user1:user1_id(id, username), user2:user2_id(id, username)')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
        
    if (error) {
        console.error("خطأ في جلب الصداقات:", error);
        throw new Error(error.message);
    }
    return data;
}

export async function sendFriendRequest(fromUserId, toUserId) {
    const { error } = await supabase.from('friendships').insert({
        user1_id: fromUserId,
        user2_id: toUserId,
        status: 'pending'
    });
    if (error) throw new Error(error.message);
}

export async function updateFriendshipStatus(friendshipId, status) {
    const { error } = await supabase.from('friendships').update({ status }).eq('id', friendshipId);
    if (error) throw new Error(error.message);
}

export async function removeFriendship(friendshipId) {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (error) throw new Error(error.message);
}


// --- 6. دوال القبائل (Clans) ---

export async function fetchAllClans() {
    const { data, error } = await supabase
        .from('clans_with_stats') 
        .select('id, name, emblem, total_xp, member_count') 
        .order('total_xp', { ascending: false }); 
    if (error) throw new Error(error.message);
    return data;
}

export async function fetchClanDetails(clanId) {
    const { data, error } = await supabase
        .from('clans')
        .select('*, members:clan_members(*, player:players(username, xp))')
        .eq('id', clanId)
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function createClan(name, description, emblem) {
    const { data, error } = await supabase.rpc('create_clan_and_join', {
        clan_name: name,
        clan_description: description,
        clan_emblem: emblem
    });
    if (error) {
        if (error.message.includes('duplicate key value violates unique constraint "clans_name_key"')) {
            throw new Error('اسم القبيلة هذا مستخدم بالفعل. يرجى اختيار اسم آخر.');
        }
        throw new Error(error.message);
    }
    return data;
}

export async function leaveCurrentClan() {
    const { error } = await supabase.rpc('leave_clan');
    if (error) throw new Error(error.message);
}

export async function deleteClan(clanId) {
    const { error } = await supabase.from('clans').delete().eq('id', clanId);
    if (error) throw new Error(error.message);
}

export async function joinClan(clanId) {
    const { error } = await supabase.rpc('join_clan', {
        target_clan_id: clanId
    });
    if (error) throw new Error(error.message);
}

export async function fetchClansLeaderboard() {
    const { data, error } = await supabase
        .from('clans')
        .select('id, name, emblem, season_quest_points')
        .order('season_quest_points', { ascending: false })
        .limit(20);

    if (error) throw new Error(error.message);
    return data;
}

export async function fetchActiveClanQuest(clanId) {
    if (!clanId) {
        return null;
    }
    const { data, error } = await supabase
        .from('active_clan_quests')
        .select('*, quest:clan_quests_config(*)')
        .eq('clan_id', clanId)
        .single();
    if (error && error.code !== 'PGRST116') {
        console.error("Error fetching active clan quest:", error);
    }
    return data;
}

export async function incrementClanQuestProgress(clanId, questType, incrementValue) {
    const { error: rpcError } = await supabase.rpc('increment_clan_quest_progress', {
        c_id: clanId,
        q_type: questType,
        inc_val: incrementValue
    });
    if (rpcError) console.error("Failed to increment clan quest progress:", rpcError);

    const { error: completeError } = await supabase.rpc('complete_clan_quest_if_done', {
        c_id: clanId
    });
    if (completeError) console.error("Failed to check for clan quest completion:", completeError);
}


// --- 7. دوال المواسم (Seasons) ---

export async function fetchActiveSeason() {
    const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('is_active', true)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error("خطأ في جلب الموسم النشط:", error);
    }
    return data;
}

// في ملف api.js

export async function fetchSeasonRewards(seasonId) {
    const { data, error } = await supabase
        .from('season_rewards')
        .select('*')
        .eq('season_id', seasonId)
        .order('rank', { ascending: true });

    if (error) {
        console.error("خطأ في جلب جوائز الموسم:", error);
        return [];
    }
    return data;
}

// --- 8. دوال المحادثة اللحظية (Realtime Chat) ---

export async function fetchChatHistory(userId1, userId2) {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
            `and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),` +
            `and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`
        )
        .order('created_at', { ascending: true });

    if (error) {
        console.error("خطأ أثناء جلب سجل المحادثة من Supabase:", error);
        throw new Error(error.message);
    }
    return data;
}

export async function sendMessage(senderId, receiverId, content) {
    const { error } = await supabase
        .from('messages')
        .insert({ sender_id: senderId, receiver_id: receiverId, content: content });

    if (error) throw new Error(error.message);
}

export function subscribeToNewMessages(onNewMessage) {
    return supabase
        .channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            onNewMessage(payload.new);
        })
        .subscribe();
}
