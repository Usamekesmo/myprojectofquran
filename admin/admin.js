// =======================================================================
// ==      ملف لوحة تحكم المدير (admin.js) - نسخة نهائية كاملة ومتكاملة      ==
// =======================================================================

// --- 1. الإعدادات وعناصر الواجهة ---
const SUPABASE_URL = 'https://bxxxvbaacdbkbxxrswed.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4eHh2YmFhY2Ria2J4eHJzd2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NzQxNzYsImV4cCI6MjA3MjE1MDE3Nn0.ScFx8SxlP0TqyBpJQQbDp-xJke2OC2V5FjjuyjY-dcM';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginScreen = document.getElementById('login-screen');
const adminPanel = document.getElementById('admin-panel');
const adminUserEmail = document.getElementById('admin-user-email');

let diamondSourcesChart = null;
let diamondSinksChart = null;

// --- 2. إدارة الجلسة والتبويبات ---

async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user.app_metadata.role === 'admin') {
        loginScreen.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        adminUserEmail.textContent = session.user.email;
        const activeTab = document.querySelector('.tab-button.active');
        if (activeTab) {
            loadTabData(activeTab.dataset.tab);
        }
    } else {
        loginScreen.classList.remove('hidden');
        adminPanel.classList.add('hidden');
    }
}

function handleTabClick(e) {
    if (!e.target.matches('.tab-button')) return;

    document.querySelectorAll('.tab-button').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

    const tabButton = e.target;
    const tabId = tabButton.dataset.tab;
    const tabContent = document.getElementById(tabId);

    tabButton.classList.add('active');
    if (tabContent) {
        tabContent.classList.remove('hidden');
        loadTabData(tabId);
    }
}

function loadTabData(tabId) {
    switch (tabId) {
        case 'dashboard-tab': fetchAndRenderDashboard(); break;
        case 'players-tab': fetchAndRenderPlayers(); break;
        case 'questions-tab': fetchAndRenderQuestions(); break;
        case 'store-tab': fetchAndRenderStoreItems(); break;
        case 'content-tab': fetchAndRenderLiveEvents(); fetchAndRenderProgression(); break;
        case 'moderation-tab': fetchAndRenderLogs(); break;
        case 'analytics-tab': fetchAndRenderAnalytics(); break;
    }
}

// --- 3. دوال العرض والجلب المساعدة ---

function showLoading(tableBody, colSpan) {
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;">جاري تحميل البيانات...</td></tr>`;
}

function renderTable(tableBody, data, error, colSpan, rowRenderer) {
    if (!tableBody) return;
    if (error) {
        tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="error-message">خطأ في جلب البيانات: ${error.message}</td></tr>`;
        return;
    }
    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;">لا توجد بيانات لعرضها.</td></tr>`;
        return;
    }
    tableBody.innerHTML = data.map(rowRenderer).join('');
}

// --- 4. دوال جلب وعرض البيانات للأقسام المختلفة ---

async function fetchAndRenderDashboard() {
    const { count: playersCount } = await supabase.from('players').select('*', { count: 'exact', head: true });
    const { count: quizzesCount } = await supabase.from('quiz_results').select('*', { count: 'exact', head: true });
    const { count: winnersCount } = await supabase.from('season_winners').select('*', { count: 'exact', head: true });

    document.getElementById('total-players').textContent = playersCount || 0;
    document.getElementById('total-quizzes').textContent = quizzesCount || 0;
    document.getElementById('total-season-winners').textContent = winnersCount || 0;
}

async function fetchAndRenderPlayers() {
    const tableBody = document.getElementById('players-table-body');
    showLoading(tableBody, 7);
    const { data, error } = await supabase.from('players').select('*').order('created_at', { ascending: false });
    renderTable(tableBody, data, error, 7, player => `
        <tr>
            <td data-label="ID">${player.id}</td>
            <td data-label="الاسم">${player.username}</td>
            <td data-label="البريد">${player.email || 'N/A'}</td>
            <td data-label="الخبرة">${player.xp}</td>
            <td data-label="الألماس">${player.diamonds}</td>
            <td data-label="خبرة الموسم">${player.seasonal_xp || 0}</td>
            <td data-label="إجراءات">
                <button class="edit-player-btn" data-id="${player.id}" data-username="${player.username}" data-xp="${player.xp}" data-diamonds="${player.diamonds}" data-seasonal-xp="${player.seasonal_xp || 0}">تعديل</button>
                <button class="view-logs-btn" data-id="${player.id}" data-username="${player.username}">عرض السجل</button>
            </td>
        </tr>
    `);
}

async function fetchAndRenderQuestions() {
    const tableBody = document.getElementById('questions-table-body');
    showLoading(tableBody, 4);
    const { data, error } = await supabase.from('questions_config').select('*').order('id');
    renderTable(tableBody, data, error, 4, q => `
        <tr>
            <td data-label="ID">${q.id}</td>
            <td data-label="المستوى الأدنى">${q.required_level}</td>
            <td data-label="عدد الخيارات">${q.options_count || q.sequence_length || 'N/A'}</td>
            <td data-label="إجراءات">
                <button class="edit-question-btn" data-id="${q.id}" data-required-level="${q.required_level}">تعديل</button>
            </td>
        </tr>
    `);
}

async function fetchAndRenderStoreItems() {
    const tableBody = document.getElementById('store-table-body');
    showLoading(tableBody, 5);
    const { data, error } = await supabase.from('store_config').select('*').order('sort_order');
    renderTable(tableBody, data, error, 5, item => `
        <tr>
            <td data-label="ID">${item.id}</td>
            <td data-label="الاسم">${item.name}</td>
            <td data-label="السعر">${item.price}</td>
            <td data-label="النوع">${item.type}</td>
            <td data-label="إجراءات">
                <button class="edit-store-item-btn" data-id="${item.id}" data-name="${item.name}" data-description="${item.description || ''}" data-price="${item.price}" data-type="${item.type}" data-sort-order="${item.sort_order || 0}">تعديل</button>
            </td>
        </tr>
    `);
}

async function fetchAndRenderLiveEvents() {
    const tableBody = document.getElementById('events-table-body');
    showLoading(tableBody, 5);
    const { data, error } = await supabase.from('live_events').select('*');
    renderTable(tableBody, data, error, 5, event => `
        <tr>
            <td data-label="ID">${event.id}</td>
            <td data-label="العنوان">${event.title}</td>
            <td data-label="الوصف">${event.description}</td>
            <td data-label="المكافأة">${event.reward_diamonds}</td>
            <td data-label="إجراءات">
                <button class="edit-event-btn" data-id="${event.id}" data-title="${event.title}" data-description="${event.description}" data-reward="${event.reward_diamonds}">تعديل</button>
                <button class="delete-event-btn" data-id="${event.id}">حذف</button>
            </td>
        </tr>
    `);
}

async function fetchAndRenderProgression() {
    const container = document.getElementById('progression-container');
    if(container) container.innerHTML = '<p>جاري تحميل إعدادات التقدم...</p><p><i>(التعديل على هذا القسم غير متاح حاليًا عبر الواجهة)</i></p>';
}

async function fetchAndRenderLogs() {
    const tableBody = document.getElementById('logs-table-body');
    showLoading(tableBody, 5);
    const { data, error } = await supabase.from('player_logs').select('*, players(username)').order('created_at', { ascending: false }).limit(50);
    renderTable(tableBody, data, error, 5, log => `
        <tr>
            <td data-label="ID">${log.id}</td>
            <td data-label="الوقت">${new Date(log.created_at).toLocaleString()}</td>
            <td data-label="اللاعب">${log.players ? log.players.username : 'لاعب محذوف'}</td>
            <td data-label="النشاط">${log.action_type}</td>
            <td data-label="التفاصيل"><pre>${JSON.stringify(log.details, null, 2)}</pre></td>
        </tr>
    `);
}

async function fetchAndRenderAnalytics() {
    const diamondSourcesCtx = document.getElementById('diamond-sources-chart')?.getContext('2d');
    const diamondSinksCtx = document.getElementById('diamond-sinks-chart')?.getContext('2d');
    
    if (diamondSourcesCtx) {
        const { data: sourcesData } = await supabase.rpc('get_diamond_sources');
        if (sourcesData) {
            if (diamondSourcesChart) diamondSourcesChart.destroy();
            diamondSourcesChart = new Chart(diamondSourcesCtx, { type: 'pie', data: { labels: sourcesData.map(d => d.source), datasets: [{ label: 'مصادر الألماس', data: sourcesData.map(d => d.total_diamonds), backgroundColor: ['#4CAF50', '#FFC107', '#2196F3', '#9C27B0'] }] } });
        }
    }

    if (diamondSinksCtx) {
        const { data: sinksData } = await supabase.rpc('get_diamond_sinks');
        if (sinksData) {
            if (diamondSinksChart) diamondSinksChart.destroy();
            diamondSinksChart = new Chart(diamondSinksCtx, { type: 'pie', data: { labels: sinksData.map(d => d.sink), datasets: [{ label: 'مصارف الألماس', data: sinksData.map(d => d.total_diamonds), backgroundColor: ['#F44336', '#E91E63', '#3F51B5', '#009688'] }] } });
        }
    }

    const difficultyTableBody = document.querySelector('#difficulty-table-body');
    showLoading(difficultyTableBody, 2);
    const { data: difficultyData, error: difficultyError } = await supabase.rpc('get_question_difficulty_analysis');
    renderTable(difficultyTableBody, difficultyData, difficultyError, 2, item => `<tr><td data-label="معرف السؤال">${item.question_id}</td><td data-label="عدد الأخطاء">${item.total_errors}</td></tr>`);
}

// --- 5. دوال النوافذ المنبثقة والنماذج ---

function openModal(modalId, dataset) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    const form = modal.querySelector('form');
    if (form) form.reset();

    for (const key in dataset) {
        const input = modal.querySelector(`[data-form-field="${key}"]`);
        if (input) {
            input.value = dataset[key];
        }
    }
    modal.classList.remove('hidden');
}

async function viewPlayerLogs(playerId, username) {
    const modal = document.getElementById('log-modal');
    const title = document.getElementById('log-modal-title');
    const body = document.getElementById('log-modal-body');
    if (!modal || !title || !body) return;

    title.textContent = `سجل نشاط اللاعب: ${username}`;
    body.innerHTML = '<p>جاري تحميل السجل...</p>';
    modal.classList.remove('hidden');

    const { data, error } = await supabase.from('player_logs').select('*').eq('user_id', playerId).order('created_at', { ascending: false }).limit(20);
    
    if (error || !data || data.length === 0) {
        body.innerHTML = '<p>لا يوجد سجل لعرضه.</p>';
        return;
    }

    body.innerHTML = `
        <div class="table-container">
            <table>
                <thead><tr><th>الوقت</th><th>النشاط</th><th>التفاصيل</th></tr></thead>
                <tbody>
                    ${data.map(log => `<tr><td data-label="الوقت">${new Date(log.created_at).toLocaleString()}</td><td data-label="النشاط">${log.action_type}</td><td data-label="التفاصيل"><pre>${JSON.stringify(log.details, null, 2)}</pre></td></tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// --- 6. دوال مساعدة عامة للتحديث والحذف ---

async function updateRow(tableName, id, updates, callback, modalId) {
    const { error } = await supabase.from(tableName).update(updates).eq('id', id);
    if (error) {
        alert(`فشل التحديث: ${error.message}`);
    } else {
        alert('تم الحفظ بنجاح!');
        document.getElementById(modalId).classList.add('hidden');
        if (callback) callback();
    }
}

async function deleteRow(tableName, id, callback) {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) {
        alert(`فشل الحذف: ${error.message}`);
    } else {
        alert('تم الحذف بنجاح.');
        if (callback) callback();
    }
}

// --- 7. إعداد وربط جميع الأحداث ---

function initializeAdminPanel() {
    adminPanel.addEventListener('click', (e) => {
        const button = e.target.closest('button'); // استهداف الزر حتى لو تم النقر على الأيقونة بداخله
        if (!button) return;

        const dataset = button.dataset;

        if (button.matches('.edit-player-btn')) {
            openModal('edit-player-modal', dataset);
        } else if (button.matches('.view-logs-btn')) {
            viewPlayerLogs(dataset.id, dataset.username);
        } else if (button.matches('.edit-store-item-btn')) {
            openModal('edit-store-item-modal', dataset);
        } else if (button.matches('.edit-question-btn')) {
            openModal('edit-question-modal', dataset);
        } else if (button.matches('.edit-event-btn')) {
            openModal('edit-event-modal', dataset);
        } else if (button.matches('.delete-event-btn')) {
            if (confirm(`هل أنت متأكد من رغبتك في حذف الحدث رقم ${dataset.id}؟`)) {
                deleteRow('live_events', dataset.id, fetchAndRenderLiveEvents);
            }
        } else if (button.matches('.close-button')) {
            button.closest('.modal').classList.add('hidden');
        } else if (button.matches('.tab-button')) {
            handleTabClick(e);
        }
    });

    document.getElementById('edit-player-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('[data-form-field="id"]').value;
        const updates = {
            xp: parseInt(form.querySelector('[data-form-field="xp"]').value),
            diamonds: parseInt(form.querySelector('[data-form-field="diamonds"]').value),
            seasonal_xp: parseInt(form.querySelector('[data-form-field="seasonalXp"]').value)
        };
        updateRow('players', id, updates, fetchAndRenderPlayers, 'edit-player-modal');
    });

    document.getElementById('edit-store-item-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('[data-form-field="id"]').value;
        const updates = {
            name: form.querySelector('[data-form-field="name"]').value,
            description: form.querySelector('[data-form-field="description"]').value,
            price: parseInt(form.querySelector('[data-form-field="price"]').value),
            sort_order: parseInt(form.querySelector('[data-form-field="sortOrder"]').value)
        };
        updateRow('store_config', id, updates, fetchAndRenderStoreItems, 'edit-store-item-modal');
    });

    document.getElementById('edit-question-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('[data-form-field="id"]').value;
        const updates = {
            required_level: parseInt(form.querySelector('[data-form-field="requiredLevel"]').value)
        };
        updateRow('questions_config', id, updates, fetchAndRenderQuestions, 'edit-question-modal');
    });

    document.getElementById('edit-event-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('[data-form-field="id"]').value;
        const updates = {
            title: form.querySelector('[data-form-field="title"]').value,
            description: form.querySelector('[data-form-field="description"]').value,
            reward_diamonds: parseInt(form.querySelector('[data-form-field="reward"]').value)
        };
        updateRow('live_events', id, updates, fetchAndRenderLiveEvents, 'edit-event-modal');
    });

    document.getElementById('admin-login-button')?.addEventListener('click', async (e) => {
        const loginButton = e.target;
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        const errorElement = document.getElementById('login-error');

        loginButton.disabled = true;
        loginButton.textContent = 'جاري التحقق...';
        errorElement.textContent = '';

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                errorElement.textContent = `فشل الدخول: ${error.message}`;
            } else {
                await checkSession();
            }
        } catch (catchedError) {
            errorElement.textContent = `حدث خطأ غير متوقع: ${catchedError.message}`;
        } finally {
            if (!loginScreen.classList.contains('hidden')) {
                loginButton.disabled = false;
                loginButton.textContent = 'دخول';
            }
        }
    });

    document.getElementById('logout-button')?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        const loginButton = document.getElementById('admin-login-button');
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'دخول';
        }
        checkSession();
    });
}

// --- 8. بدء تشغيل التطبيق ---
initializeAdminPanel();
checkSession();
