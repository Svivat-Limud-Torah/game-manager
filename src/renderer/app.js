// ==================== ZmanKef App ====================
// Frontend logic for the ZmanKef parental platform

let currentUser = null;
let currentSection = 'dashboard';
let timerInterval = null;
let timeWindowGuardInterval = null;
let isRestrictedMode = false;
let _timeWindows = [];
let editingQuestionId = null;
let questionsData = [];
let currentQuestionIndex = 0;
let isReviewMode = false;
let shopItems = null;
let customGames = [];
let gameStats = {};
let myGamesFilter = 'all';
let editingTaskId = null;
let editingGameId = null;
let pinResolve = null;
let achievementsDefs = null;
let currentLeaderboardTab = 'xp';
let soundEnabled = true;
let soundVolume = 0.8;
const soundCache = {};

const STICKER_FOLDERS = { space: 'Space', pink: 'Girl', fire: 'Fire' };
let stickerDragMode = false;

const CATEGORY_LABELS = {
    educational: '📚 חינוכי',
    adventure: '⚔️ הרפתקאות',
    sports: '⚽ ספורט',
    puzzles: '🧩 פאזלים',
    other: '🎲 אחר'
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    setupAuthForms();
    setupNavigation();
    setupTimePurchase();
    setupTaskActions();
    setupGameActions();
    setupAdminTabs();
    setupQuestionModes();
    setupShopTabs();
    setupSettingsActions();
    setupLeaderboardTabs();
    setupCustomizationTabs();
    setupStatsTabs();
    setupGameFilters();
    loadLockScreenMessages();
    startClock();
    setupTooltips();
    
    // Pre-load achievements definitions  
    window.api.gamification.getAchievementsDefs().then(defs => { achievementsDefs = defs; });

    // Game Guard — listen for blocked events from main process
    window.api.gameguard.onBlocked((data) => {
        showToast(`🚫 המשחק "${data.gameName}" נחסם — צריך לקנות אותו כדי לשחק!`, 'error', 5000);
    });
    
    // Check if already logged in
    const username = await window.api.users.getCurrent();
    if (username) {
        const users = await window.api.users.getAll();
        if (users[username]) {
            currentUser = users[username];
            showMainScreen();
        }
    }


});

// ==================== AUTH ====================
function setupAuthForms() {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        if (!username || !password) return;
        
        const result = await window.api.users.login({ username, password });
        if (result.success) {
            currentUser = result.user;
            showMainScreen();
        } else {
            showAuthError(result.error);
        }
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const displayName = document.getElementById('register-displayname').value.trim();
        const parentUsername = document.getElementById('register-parent-username').value.trim();
        const parentPassword = document.getElementById('register-parent-password').value;
        if (!username || !password || !parentUsername || !parentPassword) return;
        
        const result = await window.api.users.register({ username, password, displayName, parentUsername, parentPassword });
        if (result.success) {
            // Don't auto-login — go back to login screen so child logs in normally
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
            document.querySelector('.auth-switch').classList.remove('hidden');
            document.getElementById('show-login-text').classList.add('hidden');
            document.getElementById('register-parent-username').value = '';
            document.getElementById('register-parent-password').value = '';
            showLoginNotice('✅ חשבון נוצר בהצלחה! כעת התחבר עם המשתמש החדש.');
        } else {
            showAuthError(result.error);
        }
    });

    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
        document.querySelector('.auth-switch').classList.add('hidden');
        document.getElementById('show-login-text').classList.remove('hidden');
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
        document.querySelector('.auth-switch').classList.remove('hidden');
        document.getElementById('show-login-text').classList.add('hidden');
        document.getElementById('register-parent-username').value = '';
        document.getElementById('register-parent-password').value = '';
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await window.api.users.logout();
        stopTimer();
        stopTimeWindowGuard();
        if (notifPollInterval) { clearInterval(notifPollInterval); notifPollInterval = null; }
        currentUser = null;
        // Re-enable blocking for login screen
        await window.api.setBlocking(true);
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('main-screen').classList.remove('active');
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('notif-dropdown')?.classList.add('hidden');
        document.getElementById('msg-banner-container').innerHTML = '';
        loadLockScreenMessages();
    });
}

function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

// ==================== MAIN SCREEN ====================
async function showMainScreen() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    document.getElementById('login-notice')?.classList.add('hidden');
    
    // Admin nav
    const isAdmin = await window.api.admin.isAdmin();
    document.getElementById('admin-nav').classList.toggle('hidden', !isAdmin);
    
    // Restricted mode: child with 0 time
    isRestrictedMode = !currentUser.isParent && !currentUser.isAdmin && (currentUser.remainingTime || 0) <= 0;
    applyRestrictedMode();
    
    // If user has time (or is parent), release blocking so they can use other apps
    if (!isRestrictedMode || currentUser.isParent || currentUser.isAdmin) {
        await window.api.setBlocking(false);
    }
    
    refreshUI();
    applyUserTheme();
    applyAnimationPref();
    soundEnabled = currentUser?.soundEnabled !== false;
    soundVolume = currentUser?.soundVolume !== undefined ? currentUser.soundVolume : 0.8;
    updateVolumeIcon();
    playSound('bling');
    if (!isRestrictedMode) startTimer();
    if (!currentUser.isParent && !currentUser.isAdmin) startTimeWindowGuard();
    navigateTo('dashboard');
    // Notifications, birthday, messages
    refreshNotificationBell();
    if (notifPollInterval) clearInterval(notifPollInterval);
    notifPollInterval = setInterval(refreshNotificationBell, 30000);
    checkBirthday();
    loadUserMessages();
}

function applyRestrictedMode() {
    const banner = document.getElementById('restricted-banner');
    if (banner) banner.classList.toggle('hidden', !isRestrictedMode);
}

function refreshUI() {
    if (!currentUser) return;
    document.getElementById('display-name').textContent = currentUser.displayName || currentUser.username;
    document.getElementById('user-coins').textContent = currentUser.coins || 0;
    document.getElementById('welcome-name').textContent = currentUser.displayName || currentUser.username;
    document.getElementById('stat-coins').textContent = currentUser.coins || 0;
    document.getElementById('stat-correct').textContent = currentUser.correctAnswers || 0;
    document.getElementById('stat-games').textContent = (currentUser.ownedGames || []).length;
    updateTimerDisplay();
    refreshGamificationUI();
    refreshAvatarDisplay();
}

// ==================== NAVIGATION ====================
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.section));
    });

    document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.action));
    });
}

function navigateTo(section) {
    // Block games in restricted mode
    if (isRestrictedMode && section === 'games') {
        showToast('אין לך זמן מחשב — קנה זמן תחילה! 🛒', 'warning');
        section = 'shop';
    }

    playSound('click');
    currentSection = section;
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });
    
    // Update sections
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.toggle('active', sec.id === `${section}-section`);
    });
    
    // Load section data
    switch (section) {
        case 'dashboard': loadDashboard(); break;
        case 'tasks': loadTasks(); break;
        case 'questions': loadQuestions(); break;
        case 'shop': loadShop(); break;
        case 'games': loadMyGames(); break;
        case 'leaderboard': loadLeaderboard(); break;
        case 'stats': loadStats(); break;
        case 'customize': loadCustomization(); break;
        case 'admin': loadAdmin(); break;
    }
}

// ==================== TIMER ====================
function startTimer() {
    stopTimer();
    if (!currentUser || currentUser.isParent) return;
    
    timerInterval = setInterval(async () => {
        if (!currentUser || currentUser.isParent) return;
        
        currentUser.remainingTime = Math.max(0, (currentUser.remainingTime || 0) - 1);
        await window.api.users.updateTime(currentUser.remainingTime);
        updateTimerDisplay();
        
        if (currentUser.remainingTime <= 0) {
            stopTimer();
            await doLogoutDueToTimeExpiry();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

async function doLogoutDueToTimeExpiry() {
    playSound('timeover');
    // Block the screen FIRST — takes over even if app was in background
    await window.api.setBlocking(true);
    await window.api.users.logout();
    currentUser = null;
    isRestrictedMode = false;
    document.getElementById('main-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    showLoginNotice('⏱️ נגמר הזמן שלך להיום! כנס שוב כדי לענות שאלות ולרכוש זמן נוסף.');
}

function showLoginNotice(msg) {
    const el = document.getElementById('login-notice');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
}

function updateTimerDisplay() {
    const seconds = currentUser?.remainingTime || 0;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('timer-time').textContent = timeStr;
    document.getElementById('stat-time').textContent = timeStr;
    
    const timerDisplay = document.getElementById('timer-display');
    if (seconds <= 300 && seconds > 0) {
        timerDisplay.classList.add('timer-warning');
    } else {
        timerDisplay.classList.remove('timer-warning');
    }
}

// ==================== DASHBOARD ====================
async function loadDashboard() {
    refreshUI();
    try {
        const priceInfo = await window.api.time.getPrice();
        document.getElementById('coins-per-minute').textContent = priceInfo.coinsPerMinute;
        // Update buy time button prices
        document.querySelectorAll('.time-option').forEach(btn => {
            const mins = parseInt(btn.dataset.minutes);
            const cost = mins * priceInfo.coinsPerMinute;
            btn.querySelector('small').textContent = `${cost} 💰`;
        });
    } catch (e) { /* ignore */ }
    
    // Update tasks badge
    if (currentUser && !currentUser.isParent) {
        const tasks = await window.api.tasks.getForUser(currentUser.username);
        const pending = tasks.filter(t => t.status === 'pending').length;
        const badge = document.getElementById('tasks-badge');
        badge.textContent = pending;
        badge.classList.toggle('hidden', pending === 0);
    } else if (currentUser && currentUser.isParent) {
        const tasks = await window.api.tasks.getAll();
        const awaiting = tasks.filter(t => t.status === 'awaiting_approval').length;
        const badge = document.getElementById('tasks-badge');
        badge.textContent = awaiting;
        badge.classList.toggle('hidden', awaiting === 0);
    }
    loadDashboardCharts();
}

async function loadDashboardCharts() {
    const chartsRow = document.getElementById('dashboard-charts-row');
    if (!chartsRow) return;
    if (currentUser?.isParent) {
        chartsRow.classList.add('hidden');
        return;
    }
    chartsRow.classList.remove('hidden');
    const username = currentUser?.username;
    if (!username) return;

    const TOOLTIP_STYLE = {
        backgroundColor: '#1a1a2e',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        titleColor: '#eee',
        bodyColor: '#aaa',
        padding: 10
    };

    // --- Weekly Bar Chart ---
    try {
        const histData = await window.api.stats.getDailyHistory(username, 7);
        const weekLabels = histData.map(d => d.label);
        const weekValues = histData.map(d => d.questions || 0);
        const ctxWeekly = document.getElementById('dash-weekly-chart')?.getContext('2d');
        if (ctxWeekly) {
            if (dashWeeklyChart) { dashWeeklyChart.destroy(); dashWeeklyChart = null; }
            dashWeeklyChart = new Chart(ctxWeekly, {
                type: 'bar',
                data: {
                    labels: weekLabels,
                    datasets: [{
                        data: weekValues,
                        backgroundColor: weekValues.map((_, i) =>
                            i === weekValues.length - 1
                                ? 'rgba(108,92,231,0.9)'
                                : 'rgba(108,92,231,0.35)'
                        ),
                        borderRadius: 6,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 700 },
                    plugins: {
                        legend: { display: false },
                        tooltip: { ...TOOLTIP_STYLE, callbacks: { label: ctx => `${ctx.raw} שאלות` } }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#888', font: { size: 11 } } },
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', precision: 0 } }
                    }
                }
            });
        }
    } catch (e) { /* ignore */ }

    // --- Tasks Doughnut ---
    try {
        const tasks = await window.api.tasks.getForUser(username);
        const completedCount  = tasks.filter(t => t.status === 'completed').length;
        const pendingCount    = tasks.filter(t => t.status === 'pending').length;
        const awaitingCount   = tasks.filter(t => t.status === 'awaiting_approval').length;
        const rejectedCount   = tasks.filter(t => t.status === 'rejected').length;
        const totalTasks = completedCount + pendingCount + awaitingCount + rejectedCount;
        const ctxTasks = document.getElementById('dash-tasks-chart')?.getContext('2d');
        const tasksCenter = document.getElementById('dash-tasks-center');
        const tasksLegend = document.getElementById('dash-tasks-legend');
        if (ctxTasks) {
            if (dashTasksChart) { dashTasksChart.destroy(); dashTasksChart = null; }
            if (totalTasks === 0) {
                dashTasksChart = new Chart(ctxTasks, {
                    type: 'doughnut',
                    data: { datasets: [{ data: [1], backgroundColor: ['rgba(255,255,255,0.06)'], borderWidth: 0 }] },
                    options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { tooltip: { enabled: false }, legend: { display: false } } }
                });
                if (tasksCenter) tasksCenter.innerHTML = '<span class="dash-donut-num">0</span><span class="dash-donut-sub">משימות</span>';
                if (tasksLegend) tasksLegend.innerHTML = '';
            } else {
                const TASK_COLORS = ['#00b894', '#6c5ce7', '#ffd700', '#e17055'];
                const TASK_LABELS = ['הושלמו', 'ממתינות', 'לאישור', 'נדחו'];
                const TASK_DATA   = [completedCount, pendingCount, awaitingCount, rejectedCount];
                dashTasksChart = new Chart(ctxTasks, {
                    type: 'doughnut',
                    data: {
                        labels: TASK_LABELS,
                        datasets: [{ data: TASK_DATA, backgroundColor: TASK_COLORS, borderWidth: 0, hoverOffset: 4 }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '72%',
                        plugins: { legend: { display: false }, tooltip: { ...TOOLTIP_STYLE } }
                    }
                });
                if (tasksCenter) tasksCenter.innerHTML = `<span class="dash-donut-num">${completedCount}</span><span class="dash-donut-sub">/ ${totalTasks}</span>`;
                if (tasksLegend) {
                    tasksLegend.innerHTML = TASK_LABELS.map((lbl, i) =>
                        TASK_DATA[i] > 0
                            ? `<span class="dash-legend-dot" style="background:${TASK_COLORS[i]}"></span><span class="dash-legend-lbl">${lbl} (${TASK_DATA[i]})</span>`
                            : ''
                    ).join('');
                }
            }
        }
    } catch (e) { /* ignore */ }

    // --- Accuracy Doughnut ---
    try {
        const correct  = currentUser.correctAnswers || 0;
        const total    = currentUser.questionsAnswered || 0;
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
        const accColor = accuracy >= 80 ? '#00b894' : accuracy >= 60 ? '#ffd700' : '#e17055';
        const ctxAcc = document.getElementById('dash-accuracy-chart')?.getContext('2d');
        const accCenter = document.getElementById('dash-accuracy-center');
        if (ctxAcc) {
            if (dashAccuracyChart) { dashAccuracyChart.destroy(); dashAccuracyChart = null; }
            dashAccuracyChart = new Chart(ctxAcc, {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: total > 0 ? [accuracy, 100 - accuracy] : [0, 100],
                        backgroundColor: [
                            total > 0 ? accColor : 'rgba(255,255,255,0.06)',
                            'rgba(255,255,255,0.06)'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '72%',
                    plugins: { legend: { display: false }, tooltip: { enabled: false } }
                }
            });
            if (accCenter) accCenter.innerHTML = `<span class="dash-donut-num" style="color:${total > 0 ? accColor : '#555'}">${accuracy}%</span><span class="dash-donut-sub">מתוך ${total}</span>`;
        }
    } catch (e) { /* ignore */ }
}

// ==================== TIME PURCHASE ====================
function setupTimePurchase() {
    document.querySelectorAll('.time-option').forEach(btn => {
        btn.addEventListener('click', async () => {
            const minutes = parseInt(btn.dataset.minutes);
            const result = await window.api.time.purchase({ minutes });
            if (result.success) {
                currentUser = result.user;
                if (isRestrictedMode) {
                    isRestrictedMode = false;
                    applyRestrictedMode();
                    startTimer();
                }
                refreshUI();
                playSound('buytime');
                showToast(`נוספו ${minutes} דקות! 🎉`, 'success');
            } else {
                showToast(result.error || 'שגיאה ברכישת זמן', 'error');
            }
        });
    });

    document.getElementById('buy-time-sidebar-btn').addEventListener('click', () => {
        navigateTo('dashboard');
        document.getElementById('buy-time-card').scrollIntoView({ behavior: 'smooth' });
    });
}

// ==================== TASKS ====================
function setupTaskActions() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadTasks(btn.dataset.filter);
        });
    });
}

async function loadTasks(filter = 'pending') {
    const username = currentUser?.username;
    if (!username) return;
    showSkeleton('tasks-grid', 4, 'list');
    
    // Clear badge when parent views awaiting_approval
    if (currentUser.isParent && filter === 'awaiting_approval') {
        const badge = document.getElementById('tasks-badge');
        badge.classList.add('hidden');
    }
    
    let tasks;
    if (currentUser.isParent) {
        tasks = await window.api.tasks.getAll();
    } else {
        tasks = await window.api.tasks.getForUser(username);
    }
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const filtered = tasks.filter(t => {
        if (filter === 'pending') return t.status === 'pending';
        if (filter === 'awaiting_approval') return t.status === 'awaiting_approval';
        if (filter === 'completed') return t.status === 'completed';
        if (filter === 'rejected') return t.status === 'rejected';
        return true;
    });
    
    const grid = document.getElementById('tasks-grid');
    const noTasks = document.getElementById('no-tasks');
    
    if (filtered.length === 0) {
        grid.innerHTML = '';
        if (noTasks) noTasks.classList.remove('hidden');
        return;
    }
    
    if (noTasks) noTasks.classList.add('hidden');
    
    grid.innerHTML = filtered.map(task => {
        const isExpired = task.deadline && task.deadline < todayStr && task.status === 'pending';
        const priorityClass = task.priority && task.priority !== 'normal' ? ` task-priority-${task.priority}` : '';
        const expiredClass = isExpired ? ' task-expired' : '';
        const priorityLabel = task.priority === 'urgent' ? '⭐⭐⭐ דחוף' : task.priority === 'important' ? '⭐⭐ חשוב' : '';
        const recurringLabel = task.recurring === 'daily' ? '🔄 יומית' : task.recurring === 'weekly' ? '🔄 שבועית' : '';
        return `
        <div class="task-card task-${task.status}${priorityClass}${expiredClass}">
            <div class="task-header">
                <span class="task-reward">💰 ${task.reward}</span>
                <span class="task-status-badge">${isExpired ? '⌛ פג תוקף' : getTaskStatusText(task.status)}</span>
            </div>
            <h4 class="task-title">${escapeHtml(task.title)}</h4>
            ${priorityLabel ? `<span class="task-priority-label">${priorityLabel}</span>` : ''}
            ${recurringLabel ? `<span class="task-recurring-label">${recurringLabel}</span>` : ''}
            ${task.deadline ? `<span class="task-deadline-label${isExpired ? ' expired' : ''}">📅 עד: ${task.deadline}</span>` : ''}
            ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
            ${task.completedBy && currentUser.isParent ? `<p class="task-completed-by">👦 הושלם ע"י: <strong>${escapeHtml(task.completedBy)}</strong></p>` : ''}
            ${task.parentNote ? `<p class="task-parent-note">📝 הערת הורה: ${escapeHtml(task.parentNote)}</p>` : ''}
            <div class="task-footer">
                ${task.status === 'pending' && !currentUser.isParent && !isExpired ? 
                    `<button class="btn btn-primary btn-small" onclick="completeTask('${task.id}')">✅ סיימתי!</button>` : ''}
                ${task.status === 'awaiting_approval' && !currentUser.isParent ? 
                    `<button class="btn btn-primary btn-small" onclick="approveTaskWithPin('${task.id}')">🔑 אישור הורה</button>` : ''}
                ${task.status === 'awaiting_approval' && currentUser.isParent ? 
                    `<button class="btn btn-primary btn-small" onclick="approveTaskDirect('${task.id}')">✅ אשר</button>
                     <button class="btn btn-danger btn-small" onclick="rejectTaskDirect('${task.id}')">❌ דחה</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

function getTaskStatusText(status) {
    switch (status) {
        case 'pending': return '⏳ ממתין';
        case 'awaiting_approval': return '🔍 ממתין לאישור';
        case 'completed': return '✅ הושלם';
        case 'rejected': return '❌ נדחה';
        default: return status;
    }
}

async function completeTask(taskId) {
    const result = await window.api.tasks.requestComplete(taskId);
    if (result.success) {
        playSound('task');
        showToast('המשימה סומנה כהושלמה! בקש מההורה לאשר 🔑', 'success');
        loadTasks('awaiting_approval');
        // Switch to awaiting filter
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.filter-btn[data-filter="awaiting_approval"]').classList.add('active');
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function approveTaskWithPin(taskId) {
    const pin = await showPinModal('הזן את קוד ה-PIN של ההורה כדי לאשר את המשימה');
    if (!pin) return;
    
    const result = await window.api.tasks.approve({ taskId, pin });
    if (result.success) {
        currentUser.coins = result.newBalance || currentUser.coins;
        refreshUI();
        playSound('coins');
        showToast(`משימה אושרה! קיבלת ${result.task.reward} מטבעות 🎉`, 'success');
        loadTasks('completed');
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.filter-btn[data-filter="completed"]').classList.add('active');
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function approveTaskDirect(taskId) {
    const note = prompt('הערה (אופציונלי):');
    const result = await window.api.tasks.approveAdmin({ taskId, note: note || null });
    if (result.success) {
        showToast('משימה אושרה! ✅', 'success');
        loadAdminOverview();
        loadTasks('completed');
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function rejectTaskDirect(taskId) {
    const note = prompt('סיבה לדחייה:');
    if (note === null) return;
    const result = await window.api.tasks.rejectAdmin({ taskId, note: note || null });
    if (result.success) {
        showToast('משימה נדחתה ❌', 'success');
        loadAdminOverview();
        loadTasks('rejected');
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

// ==================== QUESTIONS ====================
function setupQuestionModes() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            isReviewMode = btn.dataset.mode === 'review';
            loadQuestions();
        });
    });
}

async function loadQuestions() {
    if (questionsData.length === 0) {
        questionsData = await window.api.questions.getAll();
    }
    
    if (questionsData.length === 0) {
        document.getElementById('question-text').textContent = 'אין שאלות זמינות';
        return;
    }
    
    // Shuffle if needed
    if (currentQuestionIndex >= questionsData.length) currentQuestionIndex = 0;
    
    document.getElementById('total-questions').textContent = questionsData.length;
    showQuestion(currentQuestionIndex);
}

function showQuestion(index) {
    const q = questionsData[index];
    if (!q) return;
    
    document.getElementById('current-question-num').textContent = index + 1;
    document.getElementById('question-text').textContent = q.question;
    document.getElementById('question-explanation').classList.add('hidden');
    
    const grid = document.getElementById('answers-grid');
    grid.innerHTML = q.options.map((opt, i) => `
        <button class="answer-btn" data-index="${i}" onclick="submitAnswer(${q.id}, ${i})">
            ${escapeHtml(opt)}
        </button>
    `).join('');
}

async function submitAnswer(questionId, answerIndex) {
    const result = await window.api.questions.submitAnswer({
        questionId, answer: answerIndex, isReview: isReviewMode
    });
    
    if (!result.success) return;
    
    // Highlight answers
    const buttons = document.querySelectorAll('.answer-btn');
    buttons.forEach(btn => {
        btn.disabled = true;
        const idx = parseInt(btn.dataset.index);
        if (idx === result.correctAnswer) btn.classList.add('correct');
        if (idx === answerIndex && !result.isCorrect) btn.classList.add('wrong');
    });
    
    // Show explanation
    const q = questionsData.find(q => q.id === questionId);
    if (q?.explanation) {
        document.getElementById('explanation-content').textContent = q.explanation;
        document.getElementById('question-explanation').classList.remove('hidden');
    }
    
    // Update user data
    if (result.user) {
        currentUser = result.user;
        refreshUI();
    }
    
    if (result.isCorrect) {
        const reward = isReviewMode ? 15 : 10;
        playSound('correct');
        showToast(`תשובה נכונה! +${reward} 💰  +${result.xpGained || 0} XP`, 'success');
        // Handle level up
        if (result.xpResult?.leveledUp) {
            showLevelUp(result.xpResult.levelData);
        }
        // Handle new achievements
        if (result.newAchievements?.length) {
            result.newAchievements.forEach((ach, i) => {
                setTimeout(() => showAchievementToast(ach), (i + 1) * 1500);
            });
        }
        // Handle new custom (parent) achievements
        if (result.newCustomAchievements?.length) {
            const offset = (result.newAchievements?.length || 0);
            result.newCustomAchievements.forEach((ach, i) => {
                setTimeout(() => showAchievementToast(ach, true), (offset + i + 1) * 1500);
            });
        }
        // Correct: advance immediately
        currentQuestionIndex++;
        if (currentQuestionIndex >= questionsData.length) currentQuestionIndex = 0;
        showQuestion(currentQuestionIndex);
    } else {
        playSound('wrong');
        showToast('תשובה שגויה 😓', 'error');
        // New achievements can unlock even on wrong answers (e.g. question milestones)
        if (result.newAchievements?.length) {
            result.newAchievements.forEach((ach, i) => {
                setTimeout(() => showAchievementToast(ach), (i + 1) * 1500);
            });
        }
        if (result.newCustomAchievements?.length) {
            const offset = (result.newAchievements?.length || 0);
            result.newCustomAchievements.forEach((ach, i) => {
                setTimeout(() => showAchievementToast(ach, true), (offset + i + 1) * 1500);
            });
        }
        // Wrong: show explanation, wait for spacebar
        const advanceHandler = (e) => {
            if (e.code === 'Space') {
                document.removeEventListener('keydown', advanceHandler);
                currentQuestionIndex++;
                if (currentQuestionIndex >= questionsData.length) currentQuestionIndex = 0;
                showQuestion(currentQuestionIndex);
            }
        };
        document.addEventListener('keydown', advanceHandler);
    }
}

// ==================== SHOP ====================
function setupShopTabs() {
    document.querySelectorAll('.shop-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadShop(tab.dataset.tab);
        });
    });
}

async function loadShop(tab = 'customGames') {
    document.getElementById('shop-balance').textContent = currentUser?.coins || 0;
    document.getElementById('shop-grid').className = 'shop-grid'; // reset class
    
    switch (tab) {
        case 'customGames': loadShopGames(); break;
        case 'time': loadShopTime(); break;
        case 'avatars': loadShopAvatars(); break;
        case 'themes': loadShopThemes(); break;
        case 'items': loadShopWorldItems(); break;
        case 'history': loadShopHistory(); break;
    }
}

async function loadShopGames() {
    showSkeleton('shop-grid', 4);
    customGames = await window.api.customGames.getAll();
    // Filter out expired games
    const now = Date.now();
    const available = customGames.filter(g => !g.expiresAt || new Date(g.expiresAt).getTime() > now);
    const grid = document.getElementById('shop-grid');

    if (available.length === 0) {
        document.getElementById('shop-categories').innerHTML = '';
        grid.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🎮</span>
                <p>אין משחקים בחנות</p>
                <p class="text-secondary">ההורה יוסיף משחקים בקרוב!</p>
            </div>`;
        return;
    }

    // Build category filter bar
    const cats = [...new Set(available.map(g => g.category || 'other'))];
    const catContainer = document.getElementById('shop-categories');
    catContainer.innerHTML = '';
    if (cats.length > 1) {
        const allBtn = document.createElement('button');
        allBtn.className = 'game-filter-btn active';
        allBtn.textContent = 'כל הקטגוריות';
        allBtn.addEventListener('click', () => renderShopGames(available, 'all', catContainer));
        catContainer.appendChild(allBtn);
        cats.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'game-filter-btn';
            btn.textContent = CATEGORY_LABELS[cat] || cat;
            btn.dataset.cat = cat;
            btn.addEventListener('click', () => renderShopGames(available, cat, catContainer));
            catContainer.appendChild(btn);
        });
    }

    renderShopGames(available, 'all', catContainer);
}

function renderShopGames(games, filterCat, catContainer) {
    if (catContainer) {
        catContainer.querySelectorAll('.game-filter-btn').forEach(b => {
            const isAll = !b.dataset.cat && filterCat === 'all';
            const isCat = b.dataset.cat === filterCat;
            b.classList.toggle('active', isAll || isCat);
        });
    }
    const filtered = filterCat === 'all' ? games : games.filter(g => (g.category || 'other') === filterCat);
    const grid = document.getElementById('shop-grid');
    const now = Date.now();
    grid.innerHTML = filtered.map(game => {
        const owned = currentUser?.ownedGames?.includes(game.id);
        let expiryNote = '';
        if (game.expiresAt) {
            const daysLeft = Math.ceil((new Date(game.expiresAt) - now) / 86400000);
            expiryNote = `<div class="shop-item-expiry">⏳ נותרו ${daysLeft} ימים</div>`;
        }
        const catLabel = CATEGORY_LABELS[game.category || 'other'] || '';
        return `
            <div class="shop-item-card ${owned ? 'owned' : ''}">
                <div class="shop-item-icon">${game.icon || '🎮'}</div>
                <div class="shop-item-name">${escapeHtml(game.name)}</div>
                <span class="game-cat-badge cat-${game.category || 'other'}" style="margin-bottom:6px">${catLabel}</span>
                ${expiryNote}
                <div class="shop-item-price">
                    ${owned ? '✅ בבעלותך' : `💰 ${game.price}`}
                </div>
                ${!owned ? `<button class="btn btn-primary btn-small" onclick="purchaseGame('${game.id}')">קנה</button>` : ''}
            </div>`;
    }).join('');
}

function loadShopTime() {
    const grid = document.getElementById('shop-grid');
    document.getElementById('shop-categories').innerHTML = '';
    const rate = 5; // Will be updated
    grid.innerHTML = `
        <div class="time-shop-container">
            <h3>⏱️ קנה זמן מחשב</h3>
            <div class="time-shop-grid">
                <div class="time-shop-option" onclick="buyTimeFromShop(5)">
                    <span class="time-amount">5 דקות</span>
                    <span class="time-cost">💰 ${5 * rate}</span>
                </div>
                <div class="time-shop-option" onclick="buyTimeFromShop(15)">
                    <span class="time-amount">15 דקות</span>
                    <span class="time-cost">💰 ${15 * rate}</span>
                </div>
                <div class="time-shop-option" onclick="buyTimeFromShop(30)">
                    <span class="time-amount">30 דקות</span>
                    <span class="time-cost">💰 ${30 * rate}</span>
                </div>
                <div class="time-shop-option" onclick="buyTimeFromShop(60)">
                    <span class="time-amount">שעה</span>
                    <span class="time-cost">💰 ${60 * rate}</span>
                </div>
            </div>
        </div>`;
}

async function purchaseGame(gameId) {
    const result = await window.api.customGames.purchase(gameId);
    if (result.success) {
        currentUser = result.user;
        refreshUI();
        playSound('buy');
        showToast('משחק נקנה בהצלחה! 🎮', 'success');
        launchConfetti('purchase');
        loadShopGames();
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function buyTimeFromShop(minutes) {
    const result = await window.api.time.purchase({ minutes });
    if (result.success) {
        currentUser = result.user;
        if (isRestrictedMode) {
            isRestrictedMode = false;
            applyRestrictedMode();
            startTimer();
        }
        refreshUI();
        playSound('buytime');
        showToast(`נוספו ${minutes} דקות! ⏱️`, 'success');
        loadShopTime();
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

// ---- Shop: Avatars tab ----
async function loadShopAvatars() {
    document.getElementById('shop-categories').innerHTML = '';
    if (!avatarDefs) avatarDefs = await window.api.customization.getAvatars();
    if (!avatarDefs) return;
    const grid = document.getElementById('shop-grid');
    grid.className = 'shop-grid avatars-grid';
    const ownedAvatars = currentUser?.ownedAvatars || [];
    const userAvatar = currentUser?.avatar || 'cat_1';
    const RARITY_LABELS = { common: 'חינם', rare: 'נדיר', epic: 'אפי', legendary: 'אגדי' };
    const RARITY_COLORS = { common: '#b2bec3', rare: '#74b9ff', epic: '#a29bfe', legendary: '#ffd700' };
    const isAdminUser = currentUser?.isParent || currentUser?.isAdmin;
    grid.innerHTML = avatarDefs.map(av => {
        const isOwned = isAdminUser || av.price === 0 || ownedAvatars.includes(av.id);
        const isEquipped = userAvatar === av.id;
        const canAfford = (currentUser?.coins || 0) >= av.price;
        const glowClass = av.rarity === 'legendary' ? 'glow-legendary' : av.rarity === 'epic' ? 'glow-epic' : '';
        return `
        <div class="avatar-card rarity-${av.rarity} ${isEquipped ? 'equipped' : ''}" style="--av-glow:${av.colors.glow};--av-border:${av.colors.border}">
            <div class="avatar-card-preview ${glowClass}" style="background:${av.colors.bg}"><img class="avatar-profile-img" src="../../${av.image}" alt="${av.name}"></div>
            <div class="avatar-card-info">
                <span class="avatar-card-name">${av.name}</span>
                <span class="avatar-rarity-tag" style="color:${RARITY_COLORS[av.rarity]}">${RARITY_LABELS[av.rarity]}</span>
            </div>
            <div class="avatar-card-actions">
                ${isEquipped ? '<span class="avatar-equipped-label">✅ פעיל</span>' :
                  isOwned ? `<button class="btn btn-small btn-primary" onclick="equipAvatarFromShop('${av.id}')">הפעל</button>` :
                  `<button class="btn btn-small ${canAfford ? 'btn-primary' : 'btn-outline'}" ${!canAfford ? 'disabled' : `onclick="buyAvatarFromShop('${av.id}')"`}>💰 ${av.price}</button>`}
            </div>
        </div>`;
    }).join('');
}

async function equipAvatarFromShop(avatarId) {
    const result = await window.api.customization.equipAvatar(avatarId);
    if (result.success) { currentUser = result.user; refreshUI(); loadShopAvatars(); }
}

async function buyAvatarFromShop(avatarId) {
    const result = await window.api.customization.purchaseAvatar(avatarId);
    if (result.success) { currentUser = result.user; refreshUI(); showToast('אווטאר חדש! 🎭', 'success'); loadShopAvatars(); }
    else showToast(result.error || 'שגיאה', 'error');
}

// ---- Shop: Themes tab ----
async function loadShopThemes() {
    document.getElementById('shop-categories').innerHTML = '';
    if (!themeDefs) themeDefs = await window.api.customization.getThemes();
    if (!themeDefs) return;
    const grid = document.getElementById('shop-grid');
    grid.className = 'shop-grid themes-grid';
    const ownedThemes = currentUser?.ownedThemes || [];
    const userTheme = currentUser?.theme || 'dark';
    const isAdminUser = currentUser?.isParent || currentUser?.isAdmin;
    grid.innerHTML = themeDefs.map(th => {
        const isPremium = th.stickers && th.stickers.length > 0;
        const isOwned = isAdminUser || th.price === 0 || ownedThemes.includes(th.id);
        const isEquipped = userTheme === th.id;
        const canAfford = (currentUser?.coins || 0) >= th.price;
        const previewBg = th.vars['--bg-primary'] || '#0a0a0a';
        const previewAccent = th.vars['--accent'] || '#6c5ce7';
        const folder = STICKER_FOLDERS[th.id] || '';
        const stickerPreviewHtml = isPremium && folder
            ? `<div class="theme-sticker-previews">${th.stickers.slice(0, 3).map(s =>
                `<img src="../../Theme Elements/${encodeURIComponent(folder)}/${encodeURIComponent(s.img)}" alt="" class="theme-sticker-preview-img">`
              ).join('')}</div>`
            : '';
        return `
        <div class="theme-card ${isEquipped ? 'equipped' : ''} ${isPremium ? 'theme-premium' : ''}">
            ${isPremium ? '<span class="theme-premium-badge">✨ פרימיום</span>' : ''}
            <div class="theme-preview" style="background:${previewBg}">
                <div class="theme-preview-bar" style="background:${th.vars['--bg-sidebar'] || '#0d0d1a'}"></div>
                <div class="theme-preview-content">
                    <div class="theme-preview-accent" style="background:${previewAccent}"></div>
                    <div class="theme-preview-lines">
                        <div style="background:${th.vars['--text-primary'] || '#eee'};opacity:0.3"></div>
                        <div style="background:${th.vars['--text-primary'] || '#eee'};opacity:0.2"></div>
                    </div>
                </div>
                ${stickerPreviewHtml}
            </div>
            <div class="theme-card-info"><span class="theme-emoji">${th.emoji}</span><span class="theme-card-name">${th.name}</span></div>
            <div class="theme-card-actions">
                ${isEquipped ? '<span class="avatar-equipped-label">✅ פעיל</span>' :
                  isOwned ? `<button class="btn btn-small btn-primary" onclick="equipThemeFromShop('${th.id}')">הפעל</button>` :
                  `<button class="btn btn-small ${canAfford ? 'btn-primary' : 'btn-outline'}" ${!canAfford ? 'disabled' : `onclick="buyThemeFromShop('${th.id}')"`}>💰 ${th.price}</button>`}
            </div>
        </div>`;
    }).join('');
}

async function equipThemeFromShop(themeId) {
    const result = await window.api.customization.equipTheme(themeId);
    if (result.success) { currentUser = result.user; refreshUI(); applyUserTheme(); loadShopThemes(); }
}

async function buyThemeFromShop(themeId) {
    const result = await window.api.customization.purchaseTheme(themeId);
    if (result.success) { currentUser = result.user; refreshUI(); applyUserTheme(); showToast('ערכת נושא חדשה! 🎨', 'success'); loadShopThemes(); }
    else showToast(result.error || 'שגיאה', 'error');
}

// ---- Shop: World Items tab ----
let currentItemCategory = 'all';
async function loadShopWorldItems(categoryFilter) {
    if (categoryFilter !== undefined) currentItemCategory = categoryFilter;
    if (!shopItems) shopItems = await window.api.shop.getItems();
    const allItems = shopItems?.items || [];
    const owned = currentUser?.ownedItems || [];
    const categories = ['all', ...new Set(allItems.map(i => i.category))];
    const catLabels = { all: 'הכל', buildings: '🏠 בניינים', nature: '🌳 טבע', decorations: '💡 קישוטים' };

    document.getElementById('shop-categories').innerHTML = `
        <div class="shop-cat-filters">
            ${categories.map(c => `<button class="shop-cat-btn ${currentItemCategory === c ? 'active' : ''}" onclick="loadShopWorldItems('${c}')">${catLabels[c] || c}</button>`).join('')}
        </div>`;

    const filtered = currentItemCategory === 'all' ? allItems : allItems.filter(i => i.category === currentItemCategory);
    const grid = document.getElementById('shop-grid');
    grid.className = 'shop-grid items-grid';

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><span class="empty-icon">📦</span><p>אין פריטים</p></div>';
        return;
    }
    grid.innerHTML = filtered.map(item => {
        const isOwned = owned.includes(item.id);
        const canAfford = (currentUser?.coins || 0) >= item.price;
        return `
        <div class="world-item-card ${isOwned ? 'owned' : ''}">
            <div class="world-item-img"><img src="assets/items/${item.image}" alt="${escapeHtml(item.name)}" onerror="this.style.display='none'"></div>
            <div class="world-item-name">${escapeHtml(item.name)}</div>
            <div class="world-item-price">${isOwned ? '✅ בבעלותך' : `💰 ${item.price}`}</div>
            ${!isOwned ? `<button class="btn btn-small ${canAfford ? 'btn-primary' : 'btn-outline'}" ${!canAfford ? 'disabled' : `onclick="purchaseWorldItem('${item.id}')"`}>קנה</button>` : ''}
        </div>`;
    }).join('');
}

async function purchaseWorldItem(itemId) {
    const result = await window.api.shop.purchase({ itemId, itemType: 'items' });
    if (result.success) {
        currentUser = result.user;
        refreshUI();
        showToast('פריט נרכש! 📦', 'success');
        loadShopWorldItems();
    } else showToast(result.error || 'שגיאה', 'error');
}

// ---- Shop: History tab ----
async function loadShopHistory() {
    document.getElementById('shop-categories').innerHTML = '';
    const grid = document.getElementById('shop-grid');
    grid.className = 'history-container'; // changed to avoid shop-grid squishing
    const history = await window.api.shop.getPurchaseHistory();
    if (!history || history.length === 0) {
        grid.innerHTML = '<div class="empty-state"><span class="empty-icon">📜</span><p>עדיין אין רכישות</p></div>';
        return;
    }
    const TYPE_LABELS = { game: '🎮 משחק', time: '⏱️ זמן', avatar: '🎭 אווטאר', theme: '🎨 ערכת נושא', item: '📦 פריט' };
    grid.innerHTML = `
        <div class="purchase-history-list">
            ${history.map(h => {
                const d = new Date(h.date);
                const dateStr = d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                return `
                <div class="history-row">
                    <span class="history-icon">${h.icon || TYPE_LABELS[h.type]?.split(' ')[0] || '🛒'}</span>
                    <div class="history-info">
                        <span class="history-name">${escapeHtml(h.name)}</span>
                        <span class="history-type">${TYPE_LABELS[h.type] || h.type}</span>
                    </div>
                    <div class="history-meta">
                        <span class="history-price">💰 ${h.price}</span>
                        <span class="history-date">${dateStr}</span>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
}

// ---- Gift Modal ----
function openGiftModal() {
    window.api.shop.getSiblings().then(siblings => {
        const sel = document.getElementById('gift-to-user');
        if (!siblings || siblings.length === 0) {
            showToast('אין ילדים אחרים לשלוח אליהם', 'error');
            return;
        }
        sel.innerHTML = siblings.map(s => `<option value="${s.username}">${escapeHtml(s.displayName)} (${s.coins} 💰)</option>`).join('');
        document.getElementById('gift-amount').value = 10;
        document.getElementById('gift-error').classList.add('hidden');
        document.getElementById('gift-modal').classList.remove('hidden');
    });
}

function closeGiftModal() {
    document.getElementById('gift-modal').classList.add('hidden');
}

async function sendGift() {
    const toUsername = document.getElementById('gift-to-user').value;
    const amount = parseInt(document.getElementById('gift-amount').value);
    const errEl = document.getElementById('gift-error');
    errEl.classList.add('hidden');
    if (!toUsername || !amount || amount < 1) {
        errEl.textContent = 'בחר נמען וסכום תקין';
        errEl.classList.remove('hidden');
        return;
    }
    const result = await window.api.shop.giftCoins({ toUsername, amount });
    if (result.success) {
        currentUser = result.user;
        closeGiftModal();
        refreshUI();
        document.getElementById('shop-balance').textContent = currentUser?.coins || 0;
        showToast(`שלחת ${amount} 💰 מתנה! 🎁`, 'success');
    } else {
        errEl.textContent = result.error || 'שגיאה';
        errEl.classList.remove('hidden');
    }
}

// ==================== MY GAMES ====================
async function loadMyGames() {
    showSkeleton('my-games-grid', 4);
    customGames = await window.api.customGames.getAll();
    gameStats = await window.api.customGames.getStats();
    const owned = currentUser?.ownedGames || [];
    const favs = currentUser?.favoriteGames || [];
    let myGames = customGames.filter(g => owned.includes(g.id));

    // Sort: favorites first, then by last played descending
    myGames.sort((a, b) => {
        const aFav = favs.includes(a.id) ? 1 : 0;
        const bFav = favs.includes(b.id) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        const aLast = gameStats[a.id]?.lastPlayed || '';
        const bLast = gameStats[b.id]?.lastPlayed || '';
        return bLast.localeCompare(aLast);
    });

    // Apply category filter
    if (myGamesFilter !== 'all') {
        myGames = myGames.filter(g => (g.category || 'other') === myGamesFilter);
    }

    // Sync filter button states
    document.querySelectorAll('.game-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === myGamesFilter);
    });

    const grid = document.getElementById('my-games-grid');
    const noGames = document.getElementById('no-games');

    if (myGames.length === 0) {
        grid.innerHTML = '';
        noGames.classList.remove('hidden');
        return;
    }
    noGames.classList.add('hidden');

    grid.innerHTML = myGames.map(game => {
        const isFav = favs.includes(game.id);
        const stats = gameStats[game.id] || {};
        const lastPlayed = stats.lastPlayed ? formatRelativeTime(new Date(stats.lastPlayed)) : null;
        const totalTime = stats.totalMinutes > 0 ? formatPlayTime(stats.totalMinutes) : null;
        const launches = stats.launchCount || 0;
        const catLabel = CATEGORY_LABELS[game.category || 'other'] || '';
        return `
        <div class="game-card">
            <button class="fav-btn ${isFav ? 'fav-active' : ''}" onclick="toggleFavorite('${game.id}')" title="${isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}">⭐</button>
            <div class="game-icon">${game.icon || '🎮'}</div>
            <div class="game-name">${escapeHtml(game.name)}</div>
            <span class="game-cat-badge cat-${game.category || 'other'}">${catLabel}</span>
            <div class="game-stats-row">
                ${lastPlayed ? `<span title="שוחק לאחרונה">🕐 ${lastPlayed}</span>` : '<span class="text-secondary">לא שוחק עדיין</span>'}
                ${totalTime ? `<span title="סה&quot;כ זמן">⏱️ ${totalTime}</span>` : ''}
                ${launches > 0 ? `<span title="הפעלות">▶ ${launches}×</span>` : ''}
            </div>
            <button class="btn btn-primary" onclick="launchGame('${game.id}')">▶ שחק</button>
        </div>`;
    }).join('');
}

async function toggleFavorite(gameId) {
    const result = await window.api.customGames.toggleFavorite(gameId);
    if (result.success) {
        currentUser.favoriteGames = result.favoriteGames;
        loadMyGames();
    }
}

async function launchGame(gameId) {
    // Flush previous session before starting a new one
    await window.api.customGames.endSession();
    const result = await window.api.customGames.launch(gameId);
    if (!result.success) {
        showToast(result.error || 'לא ניתן להפעיל את המשחק', 'error');
    } else {
        // Refresh stats momentarily
        setTimeout(async () => {
            gameStats = await window.api.customGames.getStats();
            if (currentSection === 'games') loadMyGames();
        }, 800);
    }
}

function setupGameFilters() {
    document.querySelectorAll('.game-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            myGamesFilter = btn.dataset.cat;
            loadMyGames();
        });
    });
}

// Auto-end session when window regains focus (user came back from game)
window.addEventListener('focus', async () => {
    if (currentUser && !currentUser.isParent && !currentUser.isAdmin) {
        await window.api.customGames.endSession();
        if (currentSection === 'games') {
            gameStats = await window.api.customGames.getStats();
            loadMyGames();
        }
    }
});



// ==================== ADMIN PANEL ====================
// ==================== ADMIN QUESTIONS ====================
let questionOptions = [];

async function loadAdminQuestions() {
    const questions = await window.api.questions.getCustom();
    const list = document.getElementById('admin-questions-list');
    document.getElementById('create-question-btn').onclick = () => openQuestionModal();

    if (questions.length === 0) {
        list.innerHTML = '<div class="empty-state"><span class="empty-icon">❓</span><p>אין שאלות מותאמות עדיין</p></div>';
        return;
    }

    list.innerHTML = questions.map(q => `
        <div class="admin-item-card">
            <div class="admin-item-info">
                <strong>${escapeHtml(q.question)}</strong>
                <span>${q.subject ? '📚 ' + escapeHtml(q.subject) + ' | ' : ''}תשובות: ${q.options.length} | נכונה: ${escapeHtml(q.options[q.correctAnswer] || '')}</span>
            </div>
            <div class="admin-item-actions">
                <button class="btn btn-small btn-outline" onclick="openQuestionModal('${q.id}')">✏️</button>
                <button class="btn btn-small btn-danger" onclick="deleteCustomQuestion('${q.id}')">🗑️</button>
            </div>
        </div>`).join('');
}

function openQuestionModal(qId = null) {
    editingQuestionId = qId;
    document.getElementById('question-modal-title').textContent = qId ? '✏️ ערוך שאלה' : '➕ שאלה חדשה';

    if (qId) {
        window.api.questions.getCustom().then(questions => {
            const q = questions.find(x => x.id === qId);
            if (!q) return;
            document.getElementById('q-text').value = q.question;
            document.getElementById('q-subject').value = q.subject || '';
            document.getElementById('q-explanation').value = q.explanation || '';
            questionOptions = q.options.map((opt, i) => ({ text: opt, isCorrect: i === q.correctAnswer }));
            renderQuestionOptions();
        });
    } else {
        document.getElementById('q-text').value = '';
        document.getElementById('q-subject').value = '';
        document.getElementById('q-explanation').value = '';
        questionOptions = [
            { text: '', isCorrect: true },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false }
        ];
        renderQuestionOptions();
    }

    document.getElementById('question-modal').classList.remove('hidden');
    document.getElementById('save-question-btn').onclick = saveCustomQuestion;
}

function renderQuestionOptions() {
    const container = document.getElementById('q-options-list');
    container.innerHTML = questionOptions.map((opt, i) => `
        <div class="q-option-row">
            <button class="q-correct-btn${opt.isCorrect ? ' active' : ''}" onclick="setCorrectOption(${i})" title="סמן כנכונה">✔️</button>
            <input type="text" class="q-option-input" value="${escapeHtml(opt.text)}" placeholder="תשובה ${i + 1}..." oninput="questionOptions[${i}].text = this.value">
            ${questionOptions.length > 2 ? `<button class="q-remove-btn" onclick="removeQuestionOption(${i})">✕</button>` : ''}
        </div>`).join('');
}

function setCorrectOption(index) {
    questionOptions.forEach((o, i) => o.isCorrect = i === index);
    renderQuestionOptions();
}

function addQuestionOption() {
    if (questionOptions.length >= 6) return;
    questionOptions.push({ text: '', isCorrect: false });
    renderQuestionOptions();
}

function removeQuestionOption(index) {
    if (questionOptions.length <= 2) return;
    const wasCorrect = questionOptions[index].isCorrect;
    questionOptions.splice(index, 1);
    if (wasCorrect && questionOptions.length > 0) questionOptions[0].isCorrect = true;
    renderQuestionOptions();
}

async function saveCustomQuestion() {
    const questionText = document.getElementById('q-text').value.trim();
    const subject = document.getElementById('q-subject').value.trim();
    const explanation = document.getElementById('q-explanation').value.trim();

    if (!questionText) { showToast('יש להזין טקסט לשאלה', 'error'); return; }

    document.querySelectorAll('.q-option-input').forEach((inp, i) => {
        if (questionOptions[i]) questionOptions[i].text = inp.value.trim();
    });

    const filledOptions = questionOptions.filter(o => o.text);
    if (filledOptions.length < 2) { showToast('יש להזין לפחות 2 תשובות', 'error'); return; }

    const options = questionOptions.map(o => o.text);
    const correctAnswer = questionOptions.findIndex(o => o.isCorrect);
    if (correctAnswer === -1) { showToast('יש לסמן תשובה נכונה', 'error'); return; }

    const data = { question: questionText, options, correctAnswer, subject: subject || null, explanation: explanation || null };
    let result;
    if (editingQuestionId) {
        result = await window.api.questions.editCustom(editingQuestionId, data);
    } else {
        result = await window.api.questions.addCustom(data);
    }

    if (result.success) {
        closeQuestionModal();
        showToast(editingQuestionId ? 'שאלה עודכנה! ✏️' : 'שאלה נוספה! ✅', 'success');
        questionsData = [];
        loadAdminQuestions();
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

function closeQuestionModal() {
    document.getElementById('question-modal').classList.add('hidden');
    editingQuestionId = null;
    questionOptions = [];
}

async function deleteCustomQuestion(id) {
    if (!await showConfirm('למחוק שאלה זו?', { title: '🗑️ מחיקת שאלה' })) return;
    const result = await window.api.questions.deleteCustom(id);
    if (result.success) {
        showToast('שאלה נמחקה 🗑️', 'success');
        questionsData = [];
        loadAdminQuestions();
    }
}

// ==================== ADMIN TABS ====================
function setupAdminTabs() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`admin-${tab.dataset.adminTab}`).classList.add('active');
            
            if (tab.dataset.adminTab === 'overview') loadAdminOverview();
            if (tab.dataset.adminTab === 'tasks-manage') loadAdminTasks();
            if (tab.dataset.adminTab === 'questions-manage') loadAdminQuestions();
            if (tab.dataset.adminTab === 'messages-manage') loadAdminMessages();
            if (tab.dataset.adminTab === 'games-manage') loadAdminGames();
            if (tab.dataset.adminTab === 'rewards-manage') loadAdminCustomAchievements();
            if (tab.dataset.adminTab === 'settings-manage') loadAdminSettings();
        });
    });
}

async function loadAdmin() {
    loadAdminOverview();
}

async function loadAdminOverview() {
    const result = await window.api.admin.getAllUsersOverview();
    if (!result.success) return;
    
    document.getElementById('admin-total-users').textContent = result.users.length;
    
    const totalQuestions = result.users.reduce((s, u) => s + u.totalQuestionsAnswered, 0);
    const totalTasks = result.users.reduce((s, u) => s + u.tasksCompleted, 0);
    document.getElementById('admin-total-questions').textContent = totalQuestions;
    document.getElementById('admin-total-tasks').textContent = totalTasks;
    
    const tbody = document.getElementById('users-table-body');
    // Fetch gamification stats for each child
    const statsMap = {};
    for (const u of result.users) {
        const s = await window.api.gamification.getUserStats(u.username);
        if (s.success) statsMap[u.username] = s;
    }
    
    tbody.innerHTML = result.users.map(u => {
        const s = statsMap[u.username];
        return `
        <tr>
            <td><strong>${escapeHtml(u.displayName)}</strong><br><small>${escapeHtml(u.username)}</small></td>
            <td>💰 ${u.coins}</td>
            <td>${formatTime(u.remainingTime)}</td>
            <td>${u.totalCorrect}/${u.totalQuestionsAnswered}</td>
            <td>${u.tasksCompleted}/${u.totalTasks}</td>
            <td>${u.ownedGames} 🎮</td>
            <td>${s ? `${s.levelBadge} <strong>${s.level}</strong> <small>${s.levelTitle}</small><br><span class="xp-inline">${s.xp} XP · 🔥${s.streak}</span>` : '—'}</td>
            <td>
                <button class="btn btn-small btn-outline" onclick="openCoinsModal('${u.username}', '${escapeHtml(u.displayName)}', ${u.coins})">💰 מטבעות</button>
                <button class="btn btn-small btn-primary" onclick="openTimeModal('${u.username}', '${escapeHtml(u.displayName)}', ${u.remainingTime})">⏱️ זמן</button>
                <button class="btn btn-small btn-warning" onclick="openResetModal('${u.username}', '${escapeHtml(u.displayName)}')">🔄 אפס</button>
                <button class="btn btn-small btn-danger" onclick="confirmDeleteUser('${u.username}', '${escapeHtml(u.displayName)}')">🗑️ מחק</button>
            </td>
        </tr>
    `}).join('');
    
    // Pending approvals
    const tasks = await window.api.tasks.getAll();
    const pending = tasks.filter(t => t.status === 'awaiting_approval');
    const approvalsList = document.getElementById('approvals-list');
    
    if (pending.length === 0) {
        approvalsList.innerHTML = '<p class="text-secondary">אין משימות ממתינות לאישור</p>';
    } else {
        approvalsList.innerHTML = pending.map(t => `
            <div class="approval-card">
                <div class="approval-info">
                    <strong>${escapeHtml(t.title)}</strong>
                    <span>הושלם ע"י: ${escapeHtml(t.completedBy)} | פרס: 💰 ${t.reward}</span>
                </div>
                <div style="display:flex;gap:6px">
                    <button class="btn btn-primary btn-small" onclick="approveTaskDirect('${t.id}')">✅ אשר</button>
                    <button class="btn btn-danger btn-small" onclick="rejectTaskDirect('${t.id}')">❌ דחה</button>
                </div>
            </div>
        `).join('');
    }
}

// ==================== COINS MODAL ====================
let coinsModalTarget = null;

function openCoinsModal(username, displayName, currentCoins) {
    coinsModalTarget = username;
    document.getElementById('coins-modal-name').textContent = displayName;
    document.getElementById('coins-modal-current').textContent = currentCoins;
    document.getElementById('coins-modal-amount').value = 50;
    document.getElementById('coins-modal').classList.remove('hidden');
    document.getElementById('coins-modal-amount').focus();
}

function closeCoinsModal() {
    coinsModalTarget = null;
    document.getElementById('coins-modal').classList.add('hidden');
}

async function submitCoinsChange(action) {
    if (!coinsModalTarget) return;
    const input = document.getElementById('coins-modal-amount');
    const amount = parseInt(input.value);
    if (!amount || isNaN(amount) || amount < 1) { input.focus(); return; }

    const name = document.getElementById('coins-modal-name').textContent;
    let result;
    if (action === 'add') {
        result = await window.api.admin.giveCoins(coinsModalTarget, amount);
        if (result.success) showToast(`נוספו ${amount} מטבעות ל${name}! 💰`, 'success');
    } else if (action === 'subtract') {
        result = await window.api.admin.giveCoins(coinsModalTarget, -amount);
        if (result.success) showToast(`הופחתו ${amount} מטבעות מ${name}`, 'success');
    } else if (action === 'set') {
        result = await window.api.admin.setCoins(coinsModalTarget, amount);
        if (result.success) showToast(`יתרת ${name} קובעת ל-${amount} מטבעות`, 'success');
    }

    if (result?.success) {
        closeCoinsModal();
        loadAdminOverview();
    }
}

async function adminGiveTime(username) {
    const minutes = prompt('כמה דקות לתת?', '30');
    if (!minutes || isNaN(minutes)) return;
    const result = await window.api.admin.giveTime(username, parseInt(minutes));
    if (result.success) {
        showToast(`${minutes} דקות ניתנו! ⏱️`, 'success');
        loadAdminOverview();
    }
}

// ==================== TIME MODAL ====================
let timeModalTarget = null;

function openTimeModal(username, displayName, remainingTime) {
    timeModalTarget = username;
    document.getElementById('time-modal-name').textContent = displayName;
    document.getElementById('time-modal-current').textContent = formatTime(remainingTime);
    document.getElementById('time-modal-minutes').value = 30;
    document.getElementById('time-modal').classList.remove('hidden');
    document.getElementById('time-modal-minutes').focus();
}

function closeTimeModal() {
    timeModalTarget = null;
    document.getElementById('time-modal').classList.add('hidden');
}

async function submitTimeChange(action) {
    if (!timeModalTarget) return;
    const minutesInput = document.getElementById('time-modal-minutes');
    const minutes = parseInt(minutesInput.value);
    if (!minutes || isNaN(minutes) || minutes < 1) {
        minutesInput.focus();
        return;
    }

    let result;
    if (action === 'add') {
        result = await window.api.admin.giveTime(timeModalTarget, minutes);
        if (result.success) showToast(`נוספו ${minutes} דקות ל${document.getElementById('time-modal-name').textContent}! ⏱️`, 'success');
    } else if (action === 'subtract') {
        result = await window.api.admin.giveTime(timeModalTarget, -minutes);
        if (result.success) showToast(`הופחתו ${minutes} דקות מ${document.getElementById('time-modal-name').textContent}`, 'success');
    } else if (action === 'set') {
        result = await window.api.admin.setDailyTime(timeModalTarget, minutes);
        if (result.success) showToast(`זמן ${document.getElementById('time-modal-name').textContent} קובע ל-${minutes} דקות`, 'success');
    }

    if (result?.success) {
        closeTimeModal();
        loadAdminOverview();
    }
}

// ==================== RESET / DELETE USER ====================
let resetModalTarget = null;

function openResetModal(username, displayName) {
    resetModalTarget = username;
    document.getElementById('reset-user-modal-name').textContent = `👤 ${displayName}`;
    document.getElementById('reset-user-modal').classList.remove('hidden');
}

function closeResetModal() {
    resetModalTarget = null;
    document.getElementById('reset-user-modal').classList.add('hidden');
}

async function confirmResetUser(what) {
    if (!resetModalTarget) return;
    const username = resetModalTarget;
    closeResetModal();
    const labels = { coins: 'מטבעות', questions: 'שאלות', all: 'הכל' };
    const confirmed = confirm(`לאפס ${labels[what] || what} עבור ${username}?`);
    if (!confirmed) return;
    const result = await window.api.admin.resetUserProgress(username, what);
    if (result.success) {
        showToast(`✅ נתוני ${labels[what]} של ${username} אופסו`, 'success');
        loadAdminOverview();
    } else {
        showToast('שגיאה באיפוס', 'error');
    }
}

async function confirmDeleteUser(username, displayName) {
    const confirmed = await showConfirm(
        `למחוק את חשבון "${displayName}" (${username})?\nפעולה זו בלתי הפיכה!`,
        { title: '🗑️ מחיקת חשבון', confirmText: 'כן, מחק חשבון' }
    );
    if (!confirmed) return;
    const result = await window.api.admin.deleteUser(username);
    if (result.success) {
        showToast(`🗑️ חשבון ${displayName} נמחק`, 'success');
        loadAdminOverview();
    } else {
        showToast(result.error || 'שגיאה במחיקה', 'error');
    }
}

// ==================== ADMIN TASKS ====================
async function loadAdminTasks() {
    const tasks = await window.api.tasks.getAll();
    const list = document.getElementById('admin-tasks-list');
    
    document.getElementById('create-task-btn').onclick = () => openTaskModal();
    
    if (tasks.length === 0) {
        list.innerHTML = '<div class="empty-state"><span class="empty-icon">📋</span><p>אין משימות</p></div>';
        return;
    }
    
    list.innerHTML = tasks.map(t => {
        const priorityBadge = t.priority === 'urgent' ? '⭐⭐⭐' : t.priority === 'important' ? '⭐⭐' : '';
        const recurBadge = t.recurring === 'daily' ? '🔄יומית' : t.recurring === 'weekly' ? '🔄שבועית' : '';
        const deadlineBadge = t.deadline ? `📅${t.deadline}` : '';
        const badges = [priorityBadge, recurBadge, deadlineBadge].filter(Boolean).join(' | ');
        return `
        <div class="admin-item-card">
            <div class="admin-item-info">
                <strong>${escapeHtml(t.title)}${badges ? ' <span style="font-size:0.8em;opacity:0.8">' + badges + '</span>' : ''}</strong>
                <span>פרס: 💰 ${t.reward} | מצב: ${getTaskStatusText(t.status)} | מיועד: ${t.assignedTo === 'all' ? 'כולם' : escapeHtml(t.assignedTo)}</span>
            </div>
            <div class="admin-item-actions">
                <button class="btn btn-small btn-outline" onclick="openTaskModal('${t.id}')">✏️</button>
                <button class="btn btn-small btn-danger" onclick="deleteTask('${t.id}')">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

function openTaskModal(taskId = null) {
    editingTaskId = taskId;
    const modal = document.getElementById('task-modal');
    modal.classList.remove('hidden');
    
    document.getElementById('task-modal-title').textContent = taskId ? '✏️ ערוך משימה' : '➕ צור משימה חדשה';
    
    if (taskId) {
        // Load task data
        window.api.tasks.getAll().then(tasks => {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                document.getElementById('task-title').value = task.title;
                document.getElementById('task-description').value = task.description || '';
                document.getElementById('task-reward').value = task.reward;
                document.getElementById('task-assigned-to').value = task.assignedTo;
                document.getElementById('task-approval-code').value = task.approvalCode || '';
                document.getElementById('task-priority').value = task.priority || 'normal';
                document.getElementById('task-recurring').value = task.recurring || 'none';
                document.getElementById('task-deadline').value = task.deadline || '';
            }
        });
    } else {
        document.getElementById('task-title').value = '';
        document.getElementById('task-description').value = '';
        document.getElementById('task-reward').value = '50';
        document.getElementById('task-assigned-to').value = 'all';
        document.getElementById('task-approval-code').value = '';
        document.getElementById('task-priority').value = 'normal';
        document.getElementById('task-recurring').value = 'none';
        document.getElementById('task-deadline').value = '';
    }
    
    // Populate user list
    window.api.admin.getAllUsersOverview().then(result => {
        if (!result.success) return;
        const select = document.getElementById('task-assigned-to');
        select.innerHTML = '<option value="all">כל הילדים</option>' + 
            result.users.map(u => `<option value="${u.username}">${escapeHtml(u.displayName)}</option>`).join('');
    });
    
    document.getElementById('save-task-btn').onclick = saveTask;
}

function closeTaskModal() {
    document.getElementById('task-modal').classList.add('hidden');
    editingTaskId = null;
}

async function saveTask() {
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-description').value.trim();
    const reward = parseInt(document.getElementById('task-reward').value);
    const assignedTo = document.getElementById('task-assigned-to').value;
    const approvalCode = document.getElementById('task-approval-code').value.trim();
    const priority = document.getElementById('task-priority').value;
    const recurring = document.getElementById('task-recurring').value;
    const deadline = document.getElementById('task-deadline').value || null;
    
    if (!title) {
        showToast('יש להזין שם למשימה', 'error');
        return;
    }
    if (!approvalCode) {
        showToast('יש להזין קוד אישור למשימה', 'error');
        return;
    }
    
    const taskData = { title, description, reward, assignedTo, approvalCode, priority, recurring, deadline };
    let result;
    if (editingTaskId) {
        result = await window.api.tasks.edit({ taskId: editingTaskId, data: taskData });
    } else {
        result = await window.api.tasks.create(taskData);
    }
    
    if (result.success) {
        closeTaskModal();
        showToast(editingTaskId ? 'משימה עודכנה! ✏️' : 'משימה נוצרה! ✅', 'success');
        loadAdminTasks();
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function deleteTask(taskId) {
    if (!await showConfirm('בטוח שאתה רוצה למחוק את המשימה?', { title: '🗑️ מחיקת משימה' })) return;
    const result = await window.api.tasks.delete(taskId);
    if (result.success) {
        showToast('משימה נמחקה! 🗑️', 'success');
        loadAdminTasks();
    }
}

// ==================== ADMIN GAMES ====================
function setupGameActions() {
    document.getElementById('game-icon-selector')?.querySelectorAll('.icon-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        });
    });
}

function toggleExeHelp() {
    const body = document.getElementById('exe-help-body');
    const arrow = document.getElementById('exe-help-arrow');
    const hidden = body.classList.toggle('hidden');
    arrow.textContent = hidden ? '▾' : '▴';
}

function toggleModalExeHelp() {
    document.getElementById('exe-modal-help-body').classList.toggle('hidden');
}

async function loadAdminGames() {
    customGames = await window.api.customGames.getAll();
    const list = document.getElementById('admin-games-list');
    
    document.getElementById('add-game-btn').onclick = () => openGameModal();
    document.getElementById('browse-exe-btn').onclick = browseExe;
    
    if (customGames.length === 0) {
        list.innerHTML = '<div class="empty-state"><span class="empty-icon">🎮</span><p>אין משחקים</p></div>';
        return;
    }
    
    list.innerHTML = customGames.map(g => {
        let expiryLabel = 'בלי הגבלה';
        if (g.expiresAt) {
            const daysLeft = Math.ceil((new Date(g.expiresAt) - Date.now()) / 86400000);
            expiryLabel = daysLeft > 0 ? `נותרו ${daysLeft} ימים` : 'פג';
        }
        const isGuarded = g.guarded !== false;
        const catLabel = CATEGORY_LABELS[g.category || 'other'] || '';
        return `
        <div class="admin-item-card">
            <div class="admin-item-icon">${g.icon || '🎮'}</div>
            <div class="admin-item-info">
                <strong>${escapeHtml(g.name)}</strong>
                <span>מחיר: 💰 ${g.price} | תפוגה: ${expiryLabel} | ${escapeHtml(g.exePath || 'לא הוגדר נתיב')}</span>
                <div style="display:flex;gap:8px;align-items:center;margin-top:4px;flex-wrap:wrap">
                    <span class="game-cat-badge cat-${g.category || 'other'}">${catLabel}</span>
                    <span class="guard-badge ${isGuarded ? 'guard-on' : 'guard-off'}">${isGuarded ? '🔒 מוגן' : '🔓 חופשי'}</span>
                </div>
            </div>
            <div class="admin-item-actions">
                <button class="btn btn-small ${isGuarded ? 'btn-warning' : 'btn-success'}" onclick="toggleGameGuard('${g.id}', ${!isGuarded})" title="${isGuarded ? 'הרשה הפעלה חופשית' : 'חסום ללא רכישה'}">
                    ${isGuarded ? '🔓 חופשי' : '🔒 הגן'}
                </button>
                <button class="btn btn-small btn-outline" onclick="openGameModal('${g.id}')">✏️</button>
                <button class="btn btn-small btn-danger" onclick="deleteGame('${g.id}')">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

function openGameModal(gameId = null) {
    editingGameId = gameId;
    const modal = document.getElementById('game-modal');
    modal.classList.remove('hidden');
    
    document.getElementById('game-modal-title').textContent = gameId ? '✏️ ערוך משחק' : '➕ הוסף משחק';
    
    if (gameId) {
        const game = customGames.find(g => g.id === gameId);
        if (game) {
            document.getElementById('game-name').value = game.name;
            document.getElementById('game-exe-path').value = game.exePath || '';
            document.getElementById('game-price').value = game.price;
            document.getElementById('game-category').value = game.category || 'other';
            // Set expiry radio
            let expiryVal = '0';
            if (game.expiresAt) {
                const daysLeft = Math.round((new Date(game.expiresAt) - Date.now()) / 86400000);
                const standard = ['1','3','7','14','30'];
                expiryVal = standard.includes(String(daysLeft)) ? String(daysLeft) : 'custom';
                if (expiryVal === 'custom') document.getElementById('game-expiry-custom').value = daysLeft;
            }
            document.querySelector(`input[name="game-expiry"][value="${expiryVal}"]`).checked = true;
            // Select icon
            document.querySelectorAll('.icon-option').forEach(o => {
                o.classList.toggle('selected', o.dataset.icon === game.icon);
            });
        }
    } else {
        document.getElementById('game-name').value = '';
        document.getElementById('game-exe-path').value = '';
        document.getElementById('game-price').value = '100';
        document.getElementById('game-category').value = 'other';
        document.querySelector('input[name="game-expiry"][value="0"]').checked = true;
        document.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
        document.querySelector('.icon-option').classList.add('selected');
    }
    
    document.getElementById('save-game-btn').onclick = saveGame;
}

function closeGameModal() {
    document.getElementById('game-modal').classList.add('hidden');
    editingGameId = null;
}

async function browseExe() {
    const path = await window.api.dialog.selectShortcut();
    if (path) document.getElementById('game-exe-path').value = path;
}

async function saveGame() {
    const name = document.getElementById('game-name').value.trim();
    const exePath = document.getElementById('game-exe-path').value.trim();
    const price = parseInt(document.getElementById('game-price').value);
    const icon = document.querySelector('.icon-option.selected')?.dataset.icon || '🎮';
    const category = document.getElementById('game-category').value || 'other';
    
    const expiryRadio = document.querySelector('input[name="game-expiry"]:checked')?.value || '0';
    let expiryDays = 0;
    if (expiryRadio === 'custom') {
        expiryDays = parseInt(document.getElementById('game-expiry-custom').value) || 0;
    } else {
        expiryDays = parseInt(expiryRadio);
    }
    
    if (!name) { showToast('יש להזין שם למשחק', 'error'); return; }
    
    let result;
    if (editingGameId) {
        result = await window.api.customGames.edit({ gameId: editingGameId, data: { name, exePath, price, icon, category, expiryDays } });
    } else {
        result = await window.api.customGames.add({ name, exePath, price, icon, category, expiryDays });
    }
    
    if (result.success) {
        closeGameModal();
        showToast(editingGameId ? 'משחק עודכן! ✏️' : 'משחק נוסף! 🎮', 'success');
        loadAdminGames();
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function deleteGame(gameId) {
    if (!await showConfirm('בטוח שאתה רוצה למחוק את המשחק?', { title: '🗑️ מחיקת משחק' })) return;
    const result = await window.api.customGames.delete(gameId);
    if (result.success) {
        showToast('משחק נמחק! 🗑️', 'success');
        loadAdminGames();
    }
}

async function toggleGameGuard(gameId, guarded) {
    await window.api.gameguard.setGameGuarded(gameId, guarded);
    loadAdminGames();
}

// ==================== ADMIN SETTINGS ====================
function setupSettingsActions() {
    document.getElementById('save-settings-btn')?.addEventListener('click', saveSettings);
}

async function loadAdminSettings() {
    const settings = await window.api.settings.get();
    document.getElementById('setting-daily-time').value = Math.round((settings.dailyFreeTime || 2100) / 60);
    document.getElementById('setting-coins-per-min').value = settings.coinsPerMinute || 5;
    document.getElementById('setting-coins-per-answer').value = settings.coinsPerCorrectAnswer || 10;
    document.getElementById('setting-parent-pin').value = '';
    document.getElementById('setting-parent-pin').placeholder = '••••';
    const guardToggle = document.getElementById('setting-game-guard');
    if (guardToggle) guardToggle.checked = settings.gameGuardEnabled !== false;
    // Allowed hours → time windows
    renderTimeWindows(settings.timeWindows || []);
    // Streak
    const quotaEl = document.getElementById('setting-streak-quota');
    const bonusEl = document.getElementById('setting-streak-bonus');
    if (quotaEl) quotaEl.value = settings.streakQuotaPerDay ?? 1;
    if (bonusEl) bonusEl.value = settings.streakBonusCoins  ?? 5;
    const bdBonusEl = document.getElementById('setting-birthday-bonus');
    if (bdBonusEl) bdBonusEl.value = settings.birthdayBonus ?? 100;
}

async function saveSettings() {
    const dailyTime = parseInt(document.getElementById('setting-daily-time').value) * 60;
    const coinsPerMinute = parseInt(document.getElementById('setting-coins-per-min').value);
    const coinsPerCorrectAnswer = parseInt(document.getElementById('setting-coins-per-answer').value);
    const newPin = document.getElementById('setting-parent-pin').value.trim();
    const gameGuardEnabled = document.getElementById('setting-game-guard')?.checked !== false;
    const timeWindows = collectTimeWindows();
    const streakQuotaPerDay = parseInt(document.getElementById('setting-streak-quota')?.value ?? 1);
    const streakBonusCoins  = parseInt(document.getElementById('setting-streak-bonus')?.value ?? 5);
    
    const newSettings = {
        dailyFreeTime: dailyTime,
        coinsPerMinute,
        coinsPerCorrectAnswer,
        coinsPerReviewAnswer: coinsPerCorrectAnswer + 5,
        gameGuardEnabled,
        timeWindows,
        streakQuotaPerDay,
        streakBonusCoins,
        birthdayBonus: parseInt(document.getElementById('setting-birthday-bonus')?.value ?? 100)
    };
    
    if (newPin) newSettings.parentPin = newPin;
    
    await window.api.settings.set(newSettings);
    await window.api.gameguard.setEnabled(gameGuardEnabled);
    showToast('הגדרות נשמרו! ⚙️', 'success');
}

// ==================== PIN MODAL ====================
function showPinModal(message) {
    return new Promise((resolve) => {
        pinResolve = resolve;
        document.getElementById('pin-modal').classList.remove('hidden');
        document.getElementById('pin-modal-message').textContent = message || 'הזן קוד PIN של ההורה';
        document.getElementById('pin-input').value = '';
        document.getElementById('pin-error').classList.add('hidden');
        document.getElementById('pin-input').focus();
        
        document.getElementById('pin-confirm-btn').onclick = () => {
            const pin = document.getElementById('pin-input').value;
            if (!pin) {
                document.getElementById('pin-error').textContent = 'יש להזין קוד';
                document.getElementById('pin-error').classList.remove('hidden');
                return;
            }
            document.getElementById('pin-modal').classList.add('hidden');
            pinResolve = null;
            resolve(pin);
        };

        document.getElementById('pin-input').onkeydown = (e) => {
            if (e.key === 'Enter') document.getElementById('pin-confirm-btn').click();
        };
    });
}

function closePinModal() {
    document.getElementById('pin-modal').classList.add('hidden');
    if (pinResolve) { pinResolve(null); pinResolve = null; }
}

// ==================== IMAGE MODAL ====================
function showItemImage(src, name) {
    document.getElementById('modal-image').src = src;
    document.getElementById('modal-item-name').textContent = name;
    document.getElementById('image-modal').classList.remove('hidden');
}

function closeImageModal() {
    document.getElementById('image-modal').classList.add('hidden');
}

// ==================== GAMIFICATION ====================

async function refreshGamificationUI() {
    if (!currentUser || currentUser.isParent) {
        // Hide gamification elements for parent
        document.getElementById('xp-bar-container').classList.add('hidden');
        document.getElementById('streak-display').classList.add('hidden');
        document.getElementById('dashboard-level-card')?.closest('.stat-card')?.classList.add('hidden');
        return;
    }
    document.getElementById('xp-bar-container').classList.remove('hidden');
    document.getElementById('streak-display').classList.remove('hidden');
    
    const stats = await window.api.gamification.getUserStats();
    if (!stats.success) return;
    
    // Level badge in sidebar
    const badge = document.getElementById('user-level-badge');
    badge.textContent = stats.levelBadge;
    badge.title = `דרגה ${stats.level} — ${stats.levelTitle}`;
    
    // XP bar
    document.getElementById('xp-level-label').textContent = `דרגה ${stats.level} — ${stats.levelTitle}`;
    document.getElementById('xp-value').textContent = `${stats.xp} XP`;
    
    // Calculate XP bar percentage
    const levels = await window.api.gamification.getLevels();
    const currentLevelData = levels.find(l => l.level === stats.level);
    const nextLevelData = levels.find(l => l.level === stats.level + 1);
    if (nextLevelData && currentLevelData) {
        const xpInLevel = stats.xp - currentLevelData.xpRequired;
        const xpNeeded = nextLevelData.xpRequired - currentLevelData.xpRequired;
        const pct = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));
        document.getElementById('xp-bar-fill').style.width = pct + '%';
        document.getElementById('xp-next-label').textContent = `הבא: ${nextLevelData.xpRequired} XP`;
    } else {
        document.getElementById('xp-bar-fill').style.width = '100%';
        document.getElementById('xp-next-label').textContent = 'דרגה מקסימלית! 👑';
    }
    
    // Streak
    const streakCount = document.getElementById('streak-count');
    const streakFire = document.getElementById('streak-fire');
    streakCount.textContent = stats.streak;
    if (stats.streak > 0) {
        streakFire.classList.remove('inactive');
    } else {
        streakFire.classList.add('inactive');
    }
    
    // Dashboard stat cards
    const levelCard = document.getElementById('dashboard-level-card');
    if (levelCard) {
        document.getElementById('stat-level-badge').textContent = stats.levelBadge;
        document.getElementById('stat-level').textContent = stats.level;
        document.getElementById('stat-level-title').textContent = stats.levelTitle;
    }
    document.getElementById('stat-streak').textContent = stats.streak;
}

// ==================== LEADERBOARD ====================
function setupLeaderboardTabs() {
    document.querySelectorAll('.lb-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentLeaderboardTab = tab.dataset.lb;
            loadLeaderboard();
        });
    });
}

async function loadLeaderboard() {
    const data = await window.api.gamification.getLeaderboard();
    const container = document.getElementById('leaderboard-container');
    
    if (!data || data.length === 0) {
        container.innerHTML = `<div class="lb-empty"><span class="lb-empty-icon">🏆</span><p>אין משתמשים להשוואה</p></div>`;
        return;
    }
    
    let sorted;
    switch (currentLeaderboardTab) {
        case 'xp':
            sorted = [...data].sort((a, b) => b.xp - a.xp);
            container.innerHTML = sorted.map((u, i) => `
                <div class="lb-card lb-rank-${i + 1} lb-clickable" onclick="showProfileModal('${u.username}')">
                    <div class="lb-rank">${getRankEmoji(i)}</div>
                    <div class="lb-name-area">
                        <div class="lb-username">${u.levelBadge} ${escapeHtml(u.displayName)} <span class="lb-level-tag">דרגה ${u.level}</span></div>
                        <div class="lb-subtitle">${u.levelTitle}</div>
                    </div>
                    <div class="lb-stat">
                        <div class="lb-stat-value">${u.xp}</div>
                        <div class="lb-stat-label">XP</div>
                    </div>
                    <div class="lb-stat">
                        <div class="lb-stat-value">${u.correctAnswers}</div>
                        <div class="lb-stat-label">תשובות נכונות</div>
                    </div>
                </div>
            `).join('');
            break;
            
        case 'weekly':
            sorted = [...data].sort((a, b) => (b.weeklyStats?.questionsAnswered || 0) - (a.weeklyStats?.questionsAnswered || 0));
            container.innerHTML = sorted.map((u, i) => `
                <div class="lb-card lb-rank-${i + 1} lb-clickable" onclick="showProfileModal('${u.username}')">
                    <div class="lb-rank">${getRankEmoji(i)}</div>
                    <div class="lb-name-area">
                        <div class="lb-username">${u.levelBadge} ${escapeHtml(u.displayName)}</div>
                        <div class="lb-subtitle">שאלות השבוע</div>
                    </div>
                    <div class="lb-stat">
                        <div class="lb-stat-value">${u.weeklyStats?.questionsAnswered || 0}</div>
                        <div class="lb-stat-label">שאלות</div>
                    </div>
                    <div class="lb-stat">
                        <div class="lb-stat-value">${u.weeklyStats?.coinsEarned || 0}</div>
                        <div class="lb-stat-label">💰 הרוויח</div>
                    </div>
                </div>
            `).join('');
            break;
            
        case 'streak':
            sorted = [...data].sort((a, b) => b.streak - a.streak);
            container.innerHTML = sorted.map((u, i) => `
                <div class="lb-card lb-rank-${i + 1} lb-clickable" onclick="showProfileModal('${u.username}')">
                    <div class="lb-rank">${getRankEmoji(i)}</div>
                    <div class="lb-name-area">
                        <div class="lb-username">${u.levelBadge} ${escapeHtml(u.displayName)}</div>
                        <div class="lb-subtitle">${u.streak > 0 ? '🔥 פעיל' : '⬜ לא פעיל'}</div>
                    </div>
                    <div class="lb-stat">
                        <div class="lb-stat-value">${u.streak}</div>
                        <div class="lb-stat-label">ימים ברצף</div>
                    </div>
                </div>
            `).join('');
            break;
            
        case 'achievements':
            sorted = [...data].sort((a, b) => b.unlockedAchievements - a.unlockedAchievements);
            const totalAch = achievementsDefs?.length || 0;
            container.innerHTML = sorted.map((u, i) => `
                <div class="lb-card lb-rank-${i + 1} lb-clickable" onclick="showProfileModal('${u.username}')">
                    <div class="lb-rank">${getRankEmoji(i)}</div>
                    <div class="lb-name-area">
                        <div class="lb-username">${u.levelBadge} ${escapeHtml(u.displayName)}</div>
                        <div class="lb-subtitle">${u.unlockedAchievements}/${totalAch} הישגים</div>
                    </div>
                    <div class="lb-stat">
                        <div class="lb-stat-value">${u.unlockedAchievements}</div>
                        <div class="lb-stat-label">🏅 הישגים</div>
                    </div>
                </div>
            `).join('');
            break;
    }
}

function getRankEmoji(index) {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return index + 1;
}

// ==================== ACHIEVEMENTS MODAL ====================
async function showAchievementsModal() {
    if (!achievementsDefs) {
        achievementsDefs = await window.api.gamification.getAchievementsDefs();
    }
    const stats = await window.api.gamification.getUserStats();
    if (!stats.success) return;
    
    const unlocked = stats.unlockedAchievements || [];
    const total = achievementsDefs.length;
    const unlockedCount = unlocked.length;
    
    // Summary
    document.getElementById('achievements-summary').innerHTML = `
        <div class="ach-summary-item">
            <span class="ach-summary-value">${unlockedCount}/${total}</span>
            <span class="ach-summary-label">הישגים פתוחים</span>
        </div>
        <div class="ach-summary-item">
            <span class="ach-summary-value">${stats.levelBadge} ${stats.level}</span>
            <span class="ach-summary-label">${stats.levelTitle}</span>
        </div>
        <div class="ach-summary-item">
            <span class="ach-summary-value">🔥 ${stats.streak}</span>
            <span class="ach-summary-label">ימים ברצף</span>
        </div>
        <div class="ach-summary-item">
            <span class="ach-summary-value">${stats.xp}</span>
            <span class="ach-summary-label">XP</span>
        </div>
    `;
    
    // Grid
    document.getElementById('achievements-grid').innerHTML = achievementsDefs.map(ach => {
        const isUnlocked = unlocked.includes(ach.id);
        return `
            <div class="ach-card ${isUnlocked ? 'unlocked' : 'locked'}">
                ${isUnlocked ? '<span class="ach-unlocked-badge">✅</span>' : ''}
                <span class="ach-icon">${ach.icon}</span>
                <div class="ach-title">${escapeHtml(ach.title)}</div>
                <div class="ach-desc">${escapeHtml(ach.desc)}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('achievements-modal').classList.remove('hidden');
}

function closeAchievementsModal() {
    document.getElementById('achievements-modal').classList.add('hidden');
}

// ==================== PROFILE MODAL ====================
async function showProfileModal(username) {
    const target = username || currentUser?.username;
    if (!target) return;

    // Show modal immediately with skeleton state
    const modal = document.getElementById('profile-modal');
    modal.classList.remove('hidden');
    document.getElementById('profile-display-name').textContent = '...';
    document.getElementById('profile-achievements').innerHTML = '<div class="profile-ach-loading">טוען...</div>';

    // Fetch data in parallel
    if (!achievementsDefs) achievementsDefs = await window.api.gamification.getAchievementsDefs();
    if (!avatarDefs) avatarDefs = await window.api.customization.getAvatars();
    const stats = await window.api.gamification.getUserStats(target);
    if (!stats.success) { modal.classList.add('hidden'); return; }

    // Avatar
    const av = avatarDefs.find(a => a.id === stats.avatar) || avatarDefs[0];
    const avatarWrap = document.getElementById('profile-avatar-wrap');
    const avatarEl   = document.getElementById('profile-avatar-img-el');
    if (av) {
        avatarEl.innerHTML = `<img src="../../${av.image}" alt="${av.name}" class="profile-avatar-img">`;
        avatarWrap.style.background    = av.colors.bg;
        avatarWrap.style.borderColor   = av.colors.border;
        avatarWrap.style.boxShadow     = `0 0 22px ${av.colors.glow}, 0 0 60px ${av.colors.glow}40`;
        avatarWrap.dataset.rarity = av.rarity || 'common';
    }

    // Name / level
    document.getElementById('profile-display-name').textContent = stats.displayName;
    document.getElementById('profile-username').textContent = `@${stats.username}`;
    document.getElementById('profile-badge').textContent = stats.levelBadge;
    document.getElementById('profile-level-title').textContent = `דרגה ${stats.level} — ${stats.levelTitle}`;

    // XP bar
    const currentLvlXp = stats.xp;
    const nextLvlXp    = stats.nextLevelXP;
    document.getElementById('profile-xp-label').textContent = `${currentLvlXp} XP`;
    if (nextLvlXp) {
        document.getElementById('profile-xp-next').textContent = `יעד: ${nextLvlXp} XP`;
        const pct = Math.min(100, Math.round((currentLvlXp / nextLvlXp) * 100));
        document.getElementById('profile-xp-fill').style.width = `${pct}%`;
    } else {
        document.getElementById('profile-xp-next').textContent = 'מקסימום! 🏆';
        document.getElementById('profile-xp-fill').style.width = '100%';
    }

    // Stats
    const accuracy = stats.questionsAnswered > 0
        ? Math.round((stats.correctAnswers / stats.questionsAnswered) * 100) + '%'
        : '—';
    document.getElementById('pstat-coins').textContent    = stats.coins;
    document.getElementById('pstat-streak').textContent   = stats.streak;
    document.getElementById('pstat-correct').textContent  = stats.correctAnswers;
    document.getElementById('pstat-total').textContent    = stats.questionsAnswered;
    document.getElementById('pstat-accuracy').textContent = accuracy;
    document.getElementById('pstat-tasks').textContent    = stats.tasksCompletedCount;
    document.getElementById('pstat-earned').textContent   = stats.totalCoinsEarned;
    document.getElementById('pstat-xp').textContent       = stats.xp;

    // Weekly
    const weekly = stats.weeklyStats || {};
    document.getElementById('pweek-q').textContent     = weekly.questionsAnswered || 0;
    document.getElementById('pweek-coins').textContent = weekly.coinsEarned || 0;

    // Achievements
    const unlocked = stats.unlockedAchievements || [];
    const unlockedCount = unlocked.length;
    const total = achievementsDefs.length;
    document.getElementById('profile-ach-title').textContent = `🏅 הישגים (${unlockedCount}/${total})`;
    if (unlockedCount === 0) {
        document.getElementById('profile-achievements').innerHTML = '<div class="profile-ach-empty">אין הישגים עדיין</div>';
    } else {
        document.getElementById('profile-achievements').innerHTML = achievementsDefs
            .filter(a => unlocked.includes(a.id))
            .map(a => `<div class="profile-ach-badge" title="${escapeHtml(a.title)}: ${escapeHtml(a.desc)}">${a.icon}<span class="profile-ach-name">${escapeHtml(a.title)}</span></div>`)
            .join('');
    }
}

function closeProfileModal() {
    document.getElementById('profile-modal').classList.add('hidden');
}

// ==================== LEVEL UP OVERLAY ====================
function showLevelUp(levelData) {
    document.getElementById('levelup-badge').textContent = levelData.badge;
    document.getElementById('levelup-detail').textContent = `דרגה ${levelData.level} — ${levelData.title}`;
    document.getElementById('levelup-overlay').classList.remove('hidden');
    playSound('levelup');
    launchConfetti('levelup');
}

function closeLevelUp() {
    document.getElementById('levelup-overlay').classList.add('hidden');
}

// ==================== ACHIEVEMENT TOAST ====================
function showAchievementToast(ach, isCustom = false) {
    const toast = document.getElementById('achievement-toast');
    document.getElementById('ach-toast-icon').textContent = ach.icon;
    const label = isCustom && ach.coinReward
        ? `${ach.title} — ${ach.desc} (+${ach.coinReward} 💰)`
        : `${ach.title} — ${ach.desc}`;
    document.getElementById('ach-toast-name').textContent = label;
    if (isCustom) toast.classList.add('custom-toast'); else toast.classList.remove('custom-toast');
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('show'), 10);
    playSound('achievement');
    launchConfetti('achievement');
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 500);
    }, 3500);
}

// ==================== CUSTOM REWARDS (PARENT) ====================

const GOAL_TYPE_LABELS = {
    questions:    '❓ שאלות שנענו',
    correct:      '✅ תשובות נכונות',
    consecutive:  '🔥 ברצף נכונות',
    tasks:        '📋 משימות הושלמו',
    streak:       '🔥 ימי רצף',
    xp:           '⭐ XP שנצבר',
    level:        '🏆 דרגה שהושגה',
    coins_earned: '💰 מטבעות שנצברו'
};

let rewardsCurrentView = 'list';

function showRewardsView(view) {
    rewardsCurrentView = view;
    document.getElementById('rewards-view-list').classList.toggle('hidden', view !== 'list');
    document.getElementById('rewards-view-progress').classList.toggle('hidden', view !== 'progress');
    document.getElementById('rewards-view-list-btn').classList.toggle('active', view === 'list');
    document.getElementById('rewards-view-progress-btn').classList.toggle('active', view === 'progress');
    if (view === 'list') loadAdminCustomAchievements();
    else loadRewardsProgress();
}

async function loadAdminCustomAchievements() {
    const list = document.getElementById('custom-achievements-list');
    const achs = await window.api.customAchievements.getAll();

    if (achs.length === 0) {
        list.innerHTML = `
            <div class="custom-ach-empty">
                <div class="custom-ach-empty-icon">🎯</div>
                <p>עדיין אין פרסים מיוחדים</p>
                <p class="text-secondary">לחץ על "➕ פרס חדש" כדי ליצור יעד מותאם אישית</p>
            </div>`;
        return;
    }

    list.innerHTML = achs.map(ach => `
        <div class="custom-ach-card ${ach.active ? '' : 'ach-inactive'}">
            <div class="custom-ach-icon">${ach.icon}</div>
            <div class="custom-ach-info">
                <div class="custom-ach-title">${escapeHtml(ach.title)}</div>
                ${ach.desc ? `<div class="custom-ach-desc">${escapeHtml(ach.desc)}</div>` : ''}
                <div class="custom-ach-meta">
                    <span class="meta-tag goal-tag">${GOAL_TYPE_LABELS[ach.goalType] || ach.goalType}: <strong>${ach.goalValue}</strong></span>
                    <span class="meta-tag reward-tag">💰 פרס: <strong>${ach.coinReward}</strong></span>
                    <span class="meta-tag assign-tag">${ach.assignedTo === 'all' ? '👥 כולם' : '👤 ' + escapeHtml(ach.assignedTo)}</span>
                    ${!ach.active ? '<span class="meta-tag inactive-tag">⏸️ מושהה</span>' : ''}
                </div>
            </div>
            <div class="custom-ach-actions">
                <button class="btn btn-small ${ach.active ? 'btn-outline' : 'btn-primary'}" onclick="toggleCustomReward('${ach.id}')">
                    ${ach.active ? '⏸️ השהה' : '▶️ הפעל'}
                </button>
                <button class="btn btn-small btn-danger" onclick="deleteCustomReward('${ach.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function loadRewardsProgress() {
    const container = document.getElementById('custom-achievements-progress');
    const progress = await window.api.customAchievements.getProgress();

    if (progress.length === 0) {
        container.innerHTML = `<p class="text-secondary">אין פרסים מיוחדים עדיין</p>`;
        return;
    }

    container.innerHTML = progress.map(ach => {
        const unlockedNames = ach.unlockedBy.map(u => `<span class="progress-badge unlocked">${ach.icon} ${escapeHtml(u.displayName)}</span>`).join('');
        return `
            <div class="reward-progress-card">
                <div class="reward-progress-header">
                    <span class="custom-ach-icon">${ach.icon}</span>
                    <div>
                        <div class="custom-ach-title">${escapeHtml(ach.title)}</div>
                        <div class="custom-ach-meta">
                            <span class="meta-tag goal-tag">${GOAL_TYPE_LABELS[ach.goalType] || ach.goalType}: ${ach.goalValue}</span>
                            <span class="meta-tag reward-tag">💰 ${ach.coinReward}</span>
                        </div>
                    </div>
                    <div class="reward-progress-count">${ach.unlockedBy.length} / ?</div>
                </div>
                <div class="reward-progress-badges">
                    ${unlockedNames || '<span class="progress-badge locked">עדיין לא הושג</span>'}
                </div>
            </div>
        `;
    }).join('');
}

async function openCreateRewardModal() {
    const result = await window.api.admin.getAllUsersOverview();
    const select = document.getElementById('reward-assigned-to');
    select.innerHTML = '<option value="all">👥 כל הילדים</option>' +
        result.users.map(u => `<option value="${u.username}">${escapeHtml(u.displayName)}</option>`).join('');

    // Reset icon picker
    document.getElementById('reward-icon').value = '🎯';
    document.getElementById('reward-icon-preview').textContent = '🎯';
    document.querySelectorAll('.reward-icon-btn').forEach(b => b.classList.remove('active'));
    const firstBtn = document.querySelector('.reward-icon-btn');
    if (firstBtn) firstBtn.classList.add('active');

    document.getElementById('reward-title').value = '';
    document.getElementById('reward-desc').value = '';
    document.getElementById('reward-goal-type').value = 'questions';
    document.getElementById('reward-goal-value').value = '10';
    document.getElementById('reward-coins').value = '50';
    select.value = 'all';

    document.getElementById('create-reward-modal').classList.remove('hidden');
    document.getElementById('reward-title').focus();
}

function selectRewardIcon(btn, icon) {
    document.querySelectorAll('.reward-icon-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('reward-icon').value = icon;
    document.getElementById('reward-icon-preview').textContent = icon;
}

function closeCreateRewardModal() {
    document.getElementById('create-reward-modal').classList.add('hidden');
}

async function saveCustomReward() {
    const icon     = document.getElementById('reward-icon').value.trim() || '🎯';
    const title    = document.getElementById('reward-title').value.trim();
    const desc     = document.getElementById('reward-desc').value.trim();
    const goalType = document.getElementById('reward-goal-type').value;
    const goalValue   = parseInt(document.getElementById('reward-goal-value').value);
    const coinReward  = parseInt(document.getElementById('reward-coins').value) || 0;
    const assignedTo  = document.getElementById('reward-assigned-to').value;

    if (!title) { showToast('הכנס שם לפרס', 'error'); document.getElementById('reward-title').focus(); return; }
    if (!goalValue || goalValue < 1) { showToast('הכנס ערך יעד תקין', 'error'); document.getElementById('reward-goal-value').focus(); return; }

    const result = await window.api.customAchievements.create({ icon, title, desc, goalType, goalValue, coinReward, assignedTo });
    if (result.success) {
        closeCreateRewardModal();
        loadAdminCustomAchievements();
        showToast(`הפרס "${title}" נוצר! 🎯`, 'success');
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function toggleCustomReward(id) {
    await window.api.customAchievements.toggle(id);
    loadAdminCustomAchievements();
}

async function deleteCustomReward(id) {
    if (!confirm('למחוק את הפרס הזה?')) return;
    await window.api.customAchievements.delete(id);
    loadAdminCustomAchievements();
    showToast('פרס נמחק', 'info');
}

// ==================== CUSTOMIZATION ====================
let avatarDefs = null;
let themeDefs = null;
let currentAvatarFilter = 'all';

function setupCustomizationTabs() {
    document.querySelectorAll('.customize-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.customize-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.customize-tab-content').forEach(c => c.classList.remove('active'));
            const target = tab.dataset.custTab;
            document.getElementById(`cust-${target}`).classList.add('active');
        });
    });

    document.querySelectorAll('.rarity-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rarity-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAvatarFilter = btn.dataset.rarity;
            renderAvatars();
        });
    });

    document.getElementById('pref-animations')?.addEventListener('change', async (e) => {
        await window.api.customization.toggleAnimations(e.target.checked);
        applyAnimationPref(e.target.checked);
    });

    document.getElementById('pref-sound')?.addEventListener('change', async (e) => {
        soundEnabled = e.target.checked;
        await window.api.customization.toggleSound(e.target.checked);
        if (soundEnabled) playSound('click');
    });
}

async function loadCustomization() {
    document.getElementById('customize-balance').textContent = currentUser?.coins || 0;
    if (!avatarDefs) avatarDefs = await window.api.customization.getAvatars();
    if (!themeDefs) themeDefs = await window.api.customization.getThemes();
    renderAvatars();
    renderThemes();
    const animPref = currentUser?.animationsEnabled !== false;
    document.getElementById('pref-animations').checked = animPref;
    const soundPref = currentUser?.soundEnabled !== false;
    document.getElementById('pref-sound').checked = soundPref;
    soundEnabled = soundPref;
    soundVolume = currentUser?.soundVolume !== undefined ? currentUser.soundVolume : 0.8;
    const sliderVal = Math.round(soundVolume * 100);
    const slider = document.getElementById('volume-slider');
    if (slider) { slider.value = sliderVal; updateVolumeTrackFill(sliderVal); }
    const pct = document.getElementById('volume-pct');
    if (pct) pct.textContent = `${sliderVal}%`;
    updateVolumeIcon();

    // Show premium sticker prefs if active theme is premium
    const activeTheme = themeDefs?.find(t => t.id === currentUser?.theme);
    const isPremium = activeTheme?.stickers?.length > 0;
    const premPanel = document.getElementById('premium-theme-prefs');
    if (premPanel) {
        premPanel.classList.toggle('hidden', !isPremium);
        if (isPremium) {
            const sp = getStickerPrefs(currentUser.theme);
            const opVal = sp.opacity ?? 100;
            const opSlider = document.getElementById('pref-sticker-opacity');
            if (opSlider) opSlider.value = opVal;
            const opLabel = document.getElementById('pref-sticker-opacity-val');
            if (opLabel) opLabel.textContent = opVal + '%';
            const visCheck = document.getElementById('pref-stickers-visible');
            if (visCheck) visCheck.checked = sp.visible !== false;
        }
    }
}

function renderAvatars() {
    if (!avatarDefs) return;
    const grid = document.getElementById('avatars-grid');
    const userAvatar = currentUser?.avatar || 'cat_1';
    const ownedAvatars = currentUser?.ownedAvatars || [];
    const filtered = currentAvatarFilter === 'all' ? avatarDefs : avatarDefs.filter(a => a.rarity === currentAvatarFilter);

    const RARITY_LABELS = { common: 'חינם', rare: 'נדיר', epic: 'אפי', legendary: 'אגדי' };
    const RARITY_COLORS = { common: '#b2bec3', rare: '#74b9ff', epic: '#a29bfe', legendary: '#ffd700' };
    const isAdminUser = currentUser?.isParent || currentUser?.isAdmin;

    grid.innerHTML = filtered.map(av => {
        const isOwned = isAdminUser || av.price === 0 || ownedAvatars.includes(av.id);
        const isEquipped = userAvatar === av.id;
        const canAfford = (currentUser?.coins || 0) >= av.price;
        const glowClass = av.rarity === 'legendary' ? 'glow-legendary' : av.rarity === 'epic' ? 'glow-epic' : '';
        return `
        <div class="avatar-card rarity-${av.rarity} ${isEquipped ? 'equipped' : ''}" style="--av-glow:${av.colors.glow};--av-border:${av.colors.border}">
            <div class="avatar-card-preview ${glowClass}" style="background:${av.colors.bg}">
                <img class="avatar-profile-img" src="../../${av.image}" alt="${av.name}">
            </div>
            <div class="avatar-card-info">
                <span class="avatar-card-name">${av.name}</span>
                <span class="avatar-rarity-tag" style="color:${RARITY_COLORS[av.rarity]}">${RARITY_LABELS[av.rarity]}</span>
            </div>
            <div class="avatar-card-actions">
                ${isEquipped ? '<span class="avatar-equipped-label">✅ פעיל</span>' :
                  isOwned ? `<button class="btn btn-small btn-primary" onclick="equipAvatar('${av.id}')">הפעל</button>` :
                  `<button class="btn btn-small ${canAfford ? 'btn-primary' : 'btn-outline disabled'}" ${canAfford ? `onclick="buyAvatar('${av.id}')"` : 'disabled'}>💰 ${av.price}</button>`
                }
            </div>
        </div>`;
    }).join('');
}

function renderThemes() {
    if (!themeDefs) return;
    const grid = document.getElementById('themes-grid');
    const userTheme = currentUser?.theme || 'dark';
    const ownedThemes = currentUser?.ownedThemes || [];
    const isAdminUser = currentUser?.isParent || currentUser?.isAdmin;

    grid.innerHTML = themeDefs.map(th => {
        const isPremium = th.stickers && th.stickers.length > 0;
        const isOwned = isAdminUser || th.price === 0 || ownedThemes.includes(th.id);
        const isEquipped = userTheme === th.id;
        const canAfford = (currentUser?.coins || 0) >= th.price;
        const previewBg = th.vars['--bg-primary'] || '#0a0a0a';
        const previewAccent = th.vars['--accent'] || '#6c5ce7';
        const previewText = th.vars['--text-primary'] || '#eee';
        const folder = STICKER_FOLDERS[th.id] || '';
        // Show 3 small sticker previews for premium themes
        const stickerPreviewHtml = isPremium && folder
            ? `<div class="theme-sticker-previews">${th.stickers.slice(0, 3).map(s =>
                `<img src="../../Theme Elements/${encodeURIComponent(folder)}/${encodeURIComponent(s.img)}" alt="" class="theme-sticker-preview-img">`
              ).join('')}</div>`
            : '';
        return `
        <div class="theme-card ${isEquipped ? 'equipped' : ''} ${isPremium ? 'theme-premium' : ''}">
            ${isPremium ? '<span class="theme-premium-badge">✨ פרימיום</span>' : ''}
            <div class="theme-preview" style="background:${previewBg};color:${previewText}">
                <div class="theme-preview-bar" style="background:${th.vars['--bg-sidebar'] || '#0d0d1a'}"></div>
                <div class="theme-preview-content">
                    <div class="theme-preview-accent" style="background:${previewAccent}"></div>
                    <div class="theme-preview-lines">
                        <div style="background:${previewText};opacity:0.3"></div>
                        <div style="background:${previewText};opacity:0.2"></div>
                    </div>
                </div>
                ${stickerPreviewHtml}
            </div>
            <div class="theme-card-info">
                <span class="theme-emoji">${th.emoji}</span>
                <span class="theme-card-name">${th.name}</span>
            </div>
            <div class="theme-card-actions">
                ${isEquipped ? '<span class="avatar-equipped-label">✅ פעיל</span>' :
                  isOwned ? `<button class="btn btn-small btn-primary" onclick="equipTheme('${th.id}')">הפעל</button>` :
                  `<button class="btn btn-small ${canAfford ? 'btn-primary' : 'btn-outline disabled'}" ${canAfford ? `onclick="buyTheme('${th.id}')"` : 'disabled'}>💰 ${th.price}</button>`
                }
            </div>
        </div>`;
    }).join('');
}

async function buyAvatar(avatarId) {
    const result = await window.api.customization.purchaseAvatar(avatarId);
    if (result.success) {
        currentUser = result.user;
        refreshUI();
        showToast('אווטאר חדש! 🎭', 'success');
        loadCustomization();
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function equipAvatar(avatarId) {
    const result = await window.api.customization.equipAvatar(avatarId);
    if (result.success) {
        currentUser = result.user;
        refreshUI();
        renderAvatars();
    }
}

async function buyTheme(themeId) {
    const result = await window.api.customization.purchaseTheme(themeId);
    if (result.success) {
        currentUser = result.user;
        refreshUI();
        applyUserTheme();
        showToast('ערכת נושא חדשה! 🎨', 'success');
        loadCustomization();
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function equipTheme(themeId) {
    const result = await window.api.customization.equipTheme(themeId);
    if (result.success) {
        currentUser = result.user;
        refreshUI();
        applyUserTheme();
        renderThemes();
    }
}

async function refreshAvatarDisplay() {
    if (!avatarDefs) avatarDefs = await window.api.customization.getAvatars();
    const avatarId = currentUser?.avatar || 'cat_1';
    const av = avatarDefs.find(a => a.id === avatarId) || avatarDefs[0];
    const el = document.querySelector('.user-avatar');
    if (el && av) {
        el.innerHTML = `<img src="../../${av.image}" alt="${av.name}" class="sidebar-avatar-img">`;
        el.style.background = av.colors.bg;
        el.style.borderColor = av.colors.border;
        el.style.boxShadow = `0 0 12px ${av.colors.glow}`;
    }
}

async function applyUserTheme() {
    if (!themeDefs) themeDefs = await window.api.customization.getThemes();
    const themeId = currentUser?.theme || 'dark';
    const theme = themeDefs.find(t => t.id === themeId);
    const root = document.documentElement;
    // Reset to default first
    const defaults = { '--bg-primary':'#0a0a0a','--bg-secondary':'#111','--bg-card':'#1a1a2e','--bg-card-hover':'#222244','--bg-sidebar':'#0d0d1a','--text-primary':'#eee','--text-secondary':'#888','--accent':'#6c5ce7','--accent-light':'#a29bfe','--accent-gradient':'linear-gradient(135deg,#6c5ce7,#a29bfe)','--success':'#00b894','--error':'#ff6b6b','--warning':'#fdcb6e','--gold':'#ffd700','--border':'rgba(255,255,255,0.08)','--shadow':'0 4px 15px rgba(0,0,0,0.3)' };
    for (const [k, v] of Object.entries(defaults)) root.style.setProperty(k, v);
    if (theme && theme.vars) {
        for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
    }
    document.body.dataset.theme = themeId;
    renderThemeStickers(theme);
}

/* ---- Theme sticker rendering ---- */
// Stickers cluster in the bottom-left corner (consistently empty screen area)
const STICKER_ZONE_MAP = {
    'bl-1':  { parent: 'body', css: 'position:fixed;bottom:28px;left:20px;'   },
    'bl-2':  { parent: 'body', css: 'position:fixed;bottom:100px;left:48px;'  },
    'bl-3':  { parent: 'body', css: 'position:fixed;bottom:172px;left:16px;'  },
    'bl-4':  { parent: 'body', css: 'position:fixed;bottom:54px;left:98px;'   },
    'bl-5':  { parent: 'body', css: 'position:fixed;bottom:138px;left:84px;'  },
    'bl-6':  { parent: 'body', css: 'position:fixed;bottom:212px;left:55px;'  },
    'bl-7':  { parent: 'body', css: 'position:fixed;bottom:82px;left:145px;'  },
    'bl-8':  { parent: 'body', css: 'position:fixed;bottom:188px;left:118px;' },
    'bl-9':  { parent: 'body', css: 'position:fixed;bottom:262px;left:30px;'  },
    'bl-10': { parent: 'body', css: 'position:fixed;bottom:244px;left:100px;' },
};

function renderThemeStickers(theme) {
    document.querySelectorAll('.theme-sticker').forEach(el => el.remove());
    if (!theme || !theme.stickers || !theme.stickers.length) return;
    const folder = STICKER_FOLDERS[theme.id];
    if (!folder) return;

    const glowMap = {
        space: 'rgba(124,108,246,0.9)',
        pink:  'rgba(255,105,180,0.9)',
        fire:  'rgba(255,99,72,0.95)'
    };
    const glowColor = glowMap[theme.id] || 'rgba(255,255,255,0.4)';

    theme.stickers.forEach(s => {
        const zone = STICKER_ZONE_MAP[s.zone];
        if (!zone) return;
        const parent = document.querySelector(zone.parent);
        if (!parent) return;

        const img = document.createElement('img');
        img.className = 'theme-sticker';
        img.src = `../../Theme Elements/${encodeURIComponent(folder)}/${encodeURIComponent(s.img)}`;
        img.alt = '';
        img.draggable = false;
        img.dataset.opacity = s.opacity;
        img.dataset.zoneId = s.zone;
        img.style.cssText = zone.css +
            `width:${s.size}px;height:${s.size}px;object-fit:contain;opacity:${s.opacity};` +
            `z-index:5;cursor:pointer;pointer-events:auto;` +
            `filter:drop-shadow(0 0 12px ${glowColor}) drop-shadow(0 0 5px ${glowColor}) brightness(1.2);`;

        img.addEventListener('click', function () {
            if (stickerDragMode) return;
            if (this.dataset.blasting) return;
            this.dataset.blasting = '1';
            playSound('coins');
            spawnStickerParticles(this, theme.id);
            this.classList.add('sticker-exploding');
            setTimeout(() => {
                this.classList.remove('sticker-exploding');
                this.style.animationPlayState = 'paused';
                this.style.opacity = '0';
                const finalOpacity = parseFloat(this.dataset.opacity);
                const prefs = getStickerPrefs(theme.id);
                const mult = Math.min(prefs.opacity ?? 100, 100) / 100;
                setTimeout(() => {
                    delete this.dataset.blasting;
                    this.style.animationPlayState = '';
                    this.style.transition = 'opacity 0.4s ease, transform 0.65s cubic-bezier(0.34,1.56,0.64,1)';
                    this.style.transform = 'scale(0.25) rotate(-18deg)';
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        this.style.opacity = String(finalOpacity * mult);
                        this.style.transform = 'scale(1) rotate(0deg)';
                        setTimeout(() => {
                            this.style.transition = '';
                            this.style.transform = '';
                        }, 700);
                    }));
                }, 7000);
            }, 480);
        });

        makeStickerDraggable(img);
        parent.appendChild(img);
    });

    applyStickerPrefs(theme.id);
}

function spawnStickerParticles(el, themeId) {    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const palettes = {
        space: ['#7c6cf6','#00d4ff','#b8b0ff','#ffd700','#e8eaff'],
        pink:  ['#ff69b4','#ffb6d9','#ff45a0','#fce4ec','#ff85c8'],
        fire:  ['#ff6348','#ff4500','#ffaa00','#ff9f43','#fff0a0']
    };
    const colors = palettes[themeId] || palettes.space;
    for (let i = 0; i < 12; i++) {
        const p = document.createElement('div');
        p.className = 'sticker-particle';
        const angle = (i / 12) * 360 + (Math.random() - 0.5) * 25;
        const dist = 55 + Math.random() * 55;
        const tx = Math.cos(angle * Math.PI / 180) * dist;
        const ty = Math.sin(angle * Math.PI / 180) * dist;
        const size = 5 + Math.random() * 9;
        const color = colors[i % colors.length];
        p.style.cssText =
            `position:fixed;left:${cx - size/2}px;top:${cy - size/2}px;` +
            `width:${size}px;height:${size}px;border-radius:50%;z-index:9999;pointer-events:none;` +
            `background:${color};box-shadow:0 0 8px ${color};` +
            `--tx:${tx}px;--ty:${ty}px;animation:particleBurst 0.55s ease-out forwards;`;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 700);
    }
}

function applyAnimationPref(enabled) {
    const val = enabled !== undefined ? enabled : (currentUser?.animationsEnabled !== false);
    document.body.classList.toggle('no-animations', !val);
}

// ==================== STICKER PREFS ====================
function getStickerPrefs(themeId) {
    try { return JSON.parse(localStorage.getItem(`sp_${currentUser?.username}_${themeId}`)) || {}; }
    catch { return {}; }
}
function saveStickerPrefs(themeId, prefs) {
    localStorage.setItem(`sp_${currentUser?.username}_${themeId}`, JSON.stringify(prefs));
}
function applyStickerPrefs(themeId) {
    const id = themeId || currentUser?.theme;
    if (!id) return;
    const prefs = getStickerPrefs(id);
    document.querySelectorAll('.theme-sticker').forEach(s => {
        const base = parseFloat(s.dataset.opacity);
        const mult = Math.min(prefs.opacity ?? 100, 100) / 100;
        s.style.opacity = prefs.visible === false ? '0' : String(base * mult);
        const saved = prefs.positions?.[s.dataset.zoneId];
        if (saved) { s.style.bottom = saved.bottom + 'px'; s.style.left = saved.left + 'px'; }
    });
}
function onStickerVisibleChange(checked) {
    const themeId = currentUser?.theme;
    if (!themeId) return;
    const prefs = getStickerPrefs(themeId);
    prefs.visible = checked;
    saveStickerPrefs(themeId, prefs);
    applyStickerPrefs(themeId);
}
function onStickerOpacityInput(val) {
    const pct = document.getElementById('pref-sticker-opacity-val');
    if (pct) pct.textContent = val + '%';
    const themeId = currentUser?.theme;
    if (!themeId) return;
    const prefs = getStickerPrefs(themeId);
    prefs.opacity = Number(val);
    saveStickerPrefs(themeId, prefs);
    applyStickerPrefs(themeId);
}
function resetStickerPositions() {
    const themeId = currentUser?.theme;
    if (!themeId) return;
    const prefs = getStickerPrefs(themeId);
    delete prefs.positions;
    saveStickerPrefs(themeId, prefs);
    // Re-render stickers to restore original positions
    if (themeDefs) {
        const theme = themeDefs.find(t => t.id === themeId);
        renderThemeStickers(theme);
    }
    showToast('מיקומי מדבקות אופסו', 'success');
}
function toggleStickerDragMode() {
    stickerDragMode = !stickerDragMode;
    const stickers = document.querySelectorAll('.theme-sticker');
    stickers.forEach(s => s.classList.toggle('sticker-draggable', stickerDragMode));
    const btn = document.getElementById('pref-sticker-drag-btn');
    if (btn) {
        btn.textContent = stickerDragMode ? '✅ סיים עריכה' : '✏️ ערוך מיקומים';
        btn.classList.toggle('active', stickerDragMode);
    }
    if (!stickerDragMode) {
        // Save current positions
        const themeId = currentUser?.theme;
        if (themeId) {
            const prefs = getStickerPrefs(themeId);
            prefs.positions = prefs.positions || {};
            stickers.forEach(s => {
                const bottom = parseInt(s.style.bottom) || 0;
                const left   = parseInt(s.style.left)   || 0;
                prefs.positions[s.dataset.zoneId] = { bottom, left };
            });
            saveStickerPrefs(themeId, prefs);
            showToast('מיקומים נשמרו! 📌', 'success');
        }
    }
}
function makeStickerDraggable(el) {
    el.addEventListener('mousedown', function (e) {
        if (!stickerDragMode) return;
        e.preventDefault();
        e.stopPropagation();
        const startX   = e.clientX;
        const startY   = e.clientY;
        const startBottom = parseInt(el.style.bottom) || 0;
        const startLeft   = parseInt(el.style.left)   || 0;
        el.style.cursor = 'grabbing';
        el.style.zIndex = '9998';
        el.style.animationPlayState = 'paused';
        function onMove(e) {
            el.style.left   = (startLeft   + (e.clientX - startX)) + 'px';
            el.style.bottom = (startBottom - (e.clientY - startY)) + 'px';
        }
        function onUp() {
            el.style.cursor = 'grab';
            el.style.zIndex = '5';
            el.style.animationPlayState = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// ==================== STATS ====================

let historyChart = null;
let dashWeeklyChart = null;
let dashTasksChart = null;
let dashAccuracyChart = null;
let currentHistoryMetric = 'questions';
let statsHistoryData = null;

function setupStatsTabs() {
    document.querySelectorAll('.stats-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.stats-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`stats-${tab.dataset.stab}-tab`)?.classList.add('active');
            if (tab.dataset.stab === 'history') renderHistoryChart();
            if (tab.dataset.stab === 'activity') loadActivityLog();
            if (tab.dataset.stab === 'weekly') loadWeeklyReport();
        });
    });
    document.querySelectorAll('.metric-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.metric-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentHistoryMetric = btn.dataset.metric;
            statsHistoryData = null;
            renderHistoryChart();
        });
    });
}

async function loadStats() {
    statsHistoryData = null;
    if (historyChart) { historyChart.destroy(); historyChart = null; }
    const isParent = currentUser?.isParent || currentUser?.isAdmin;
    document.querySelectorAll('.stats-parent-only').forEach(el => {
        el.style.display = isParent ? '' : 'none';
    });
    // Reset to profile tab
    document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.stats-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.stats-tab[data-stab="profile"]')?.classList.add('active');
    document.getElementById('stats-profile-tab')?.classList.add('active');
    await loadProfileStats();
}

async function loadProfileStats() {
    const u = currentUser;
    if (!u) return;
    if (u.isParent) {
        // Parent sees a prompt to check weekly report
        document.getElementById('accuracy-pct').textContent = '--';
        document.getElementById('accuracy-detail-text').textContent = 'צפה בדוח השבועי לסטטיסטיקות ילדים';
        ['stat-q-total','stat-q-correct','stat-coins-earned','stat-tasks-done','stat-streak-val','stat-level-val'].forEach(id => {
            const el = document.getElementById(id); if (el) el.textContent = '--';
        });
        return;
    }
    const total = u.questionsAnswered || 0;
    const correct = u.correctAnswers || 0;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    // Animate ring: r=50, C=2*PI*50≈314.16
    const C = 314.16;
    const circle = document.getElementById('accuracy-circle');
    if (circle) {
        circle.style.strokeDasharray = C;
        circle.style.strokeDashoffset = C;
        requestAnimationFrame(() => setTimeout(() => {
            circle.style.strokeDashoffset = C * (1 - accuracy / 100);
        }, 80));
    }
    document.getElementById('accuracy-pct').textContent = `${accuracy}%`;
    document.getElementById('accuracy-detail-text').textContent = `${correct} נכון מתוך ${total}`;
    document.getElementById('stat-q-total').textContent = total;
    document.getElementById('stat-q-correct').textContent = correct;
    document.getElementById('stat-coins-earned').textContent = u.totalCoinsEarned || 0;
    document.getElementById('stat-tasks-done').textContent = u.tasksCompletedCount || 0;
    document.getElementById('stat-streak-val').textContent = u.streak || 0;
    document.getElementById('stat-level-val').textContent = u.level || 1;
    const ws = u.weeklyStats || {};
    document.getElementById('week-q').textContent = ws.questionsAnswered || 0;
    document.getElementById('week-c').textContent = ws.coinsEarned || 0;
    const achieved = u.unlockedAchievements || [];
    document.getElementById('achieve-count').textContent = achieved.length;
    const grid = document.getElementById('stats-achieve-grid');
    if (grid) {
        if (!achievementsDefs) achievementsDefs = await window.api.gamification.getAchievementsDefs();
        const earned = (achievementsDefs || []).filter(a => achieved.includes(a.id));
        grid.innerHTML = earned.length
            ? earned.map(a => `<div class="achieve-badge" title="${a.description || ''}"><span class="achieve-icon">${a.icon}</span><span class="achieve-name">${a.name}</span></div>`).join('')
            : '<p class="no-data">עדיין אין הישגים — דף לענות שאלות! 💪</p>';
    }
}

async function renderHistoryChart() {
    const username = currentUser?.username;
    if (!username || currentUser?.isParent) return;
    if (!statsHistoryData) {
        statsHistoryData = await window.api.stats.getDailyHistory(username, 7);
    }
    const labels = statsHistoryData.map(d => d.label);
    const values = statsHistoryData.map(d => d[currentHistoryMetric] || 0);
    const COLORS = {
        questions: { border: '#6c5ce7', bg: 'rgba(108,92,231,0.2)' },
        correct:   { border: '#00b894', bg: 'rgba(0,184,148,0.2)' },
        coins:     { border: '#ffd700', bg: 'rgba(255,215,0,0.2)' }
    };
    const col = COLORS[currentHistoryMetric];
    const ctx = document.getElementById('history-chart')?.getContext('2d');
    if (!ctx) return;
    if (historyChart) {
        historyChart.data.labels = labels;
        historyChart.data.datasets[0].data = values;
        historyChart.data.datasets[0].borderColor = col.border;
        historyChart.data.datasets[0].backgroundColor = col.bg;
        historyChart.data.datasets[0].pointBackgroundColor = col.border;
        historyChart.update('active');
        return;
    }
    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: values,
                borderColor: col.border,
                backgroundColor: col.bg,
                borderWidth: 3,
                pointBackgroundColor: col.border,
                pointRadius: 6,
                pointHoverRadius: 8,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 800 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a2e',
                    borderColor: col.border,
                    borderWidth: 1,
                    titleColor: '#eee',
                    bodyColor: '#aaa',
                    padding: 12
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#aaa' } },
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#aaa', precision: 0 } }
            }
        }
    });
}

async function loadActivityLog() {
    if (!currentUser?.isParent && !currentUser?.isAdmin) return;
    const users = await window.api.users.getAll();
    const select = document.getElementById('activity-filter');
    if (select && select.children.length === 1) {
        Object.values(users).filter(u => !u.isParent).forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.username;
            opt.textContent = u.displayName || u.username;
            select.appendChild(opt);
        });
        select.onchange = () => renderActivityLog(select.value || undefined);
    }
    await renderActivityLog();
}

async function renderActivityLog(username) {
    const log = await window.api.stats.getActivityLog({ limit: 200, username });
    const list = document.getElementById('activity-list');
    if (!list) return;
    if (!log.length) {
        list.innerHTML = '<p class="no-data">אין פעילות עדיין — הפעולות יירשמו מכאן והלאה</p>';
        return;
    }
    list.innerHTML = log.map(entry => {
        const t = new Date(entry.timestamp);
        const timeStr = t.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        const dateStr = t.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
        return `<div class="log-entry log-${entry.type}">
            <span class="log-icon">${entry.icon}</span>
            <div class="log-body">
                <strong>${entry.displayName}</strong>
                <span>${entry.message}</span>
            </div>
            <span class="log-time">${dateStr} ${timeStr}</span>
        </div>`;
    }).join('');
}

async function loadWeeklyReport() {
    if (!currentUser?.isParent && !currentUser?.isAdmin) return;
    const report = await window.api.stats.getWeeklyReport();
    const container = document.getElementById('weekly-cards');
    const periodEl = document.getElementById('weekly-period-text');
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    if (periodEl) periodEl.textContent = `מ-${weekStart.toLocaleDateString('he-IL')} עד ${now.toLocaleDateString('he-IL')}`;
    if (!container) return;
    if (!report.length) {
        container.innerHTML = '<p class="no-data">אין ילדים רשומים</p>';
        return;
    }
    container.innerHTML = report.map(r => {
        const ac = r.accuracy >= 80 ? '#00b894' : r.accuracy >= 50 ? '#fdcb6e' : '#ff6b6b';
        return `<div class="weekly-card">
            <div class="weekly-card-top">
                <span class="weekly-avatar">${(r.displayName || '?').charAt(0)}</span>
                <div>
                    <div class="weekly-name">${r.displayName}</div>
                    <div class="weekly-meta">רמה ${r.level} · ${r.streak} 🔥</div>
                </div>
            </div>
            <div class="weekly-kpis">
                <div class="weekly-kpi"><span class="wkpi-val">${r.weekQuestions}</span><span>שאלות השבוע</span></div>
                <div class="weekly-kpi"><span class="wkpi-val">${r.weekCoins}</span><span>מטבעות השבוע</span></div>
                <div class="weekly-kpi"><span class="wkpi-val" style="color:${ac}">${r.accuracy}%</span><span>דיוק כולל</span></div>
                <div class="weekly-kpi"><span class="wkpi-val">${r.tasksCompleted}</span><span>משימות</span></div>
            </div>
            <div class="weekly-acc-bar-wrap"><div class="weekly-acc-bar" style="width:${r.accuracy}%;background:${ac}"></div></div>
        </div>`;
    }).join('');
}

// ==================== UTILITIES ====================

const SOUND_MAP = {
    correct:     '../../Sound Effects/answer correct.wav',
    wrong:       '../../Sound Effects/mixkit-player-losing-or-failing-2042.wav',
    levelup:     '../../Sound Effects/level up.wav',
    achievement: '../../Sound Effects/mixkit-unlock-new-item-game-notification-254.wav',
    task:        '../../Sound Effects/comple task - better.wav',
    coins:       '../../Sound Effects/mixkit-winning-a-coin-video-game-2069.wav',
    buy:         '../../Sound Effects/buying item.wav',
    buytime:     '../../Sound Effects/spending money on time.wav',
    timeover:    '../../Sound Effects/time is over.wav',
    birthday:    '../../Sound Effects/mixkit-extra-bonus-in-a-video-game-2045.wav',
    click:       '../../Sound Effects/mouse click.wav',
    notification:'../../Sound Effects/mixkit-retro-arcade-casino-notification-211.wav',
    fanfare:     '../../Sound Effects/mixkit-medieval-show-fanfare-announcement-226.wav',
    bling:       '../../Sound Effects/mixkit-arcade-mechanical-bling-210.wav',
};

function playSound(name) {
    if (!soundEnabled) return;
    const src = SOUND_MAP[name];
    if (!src) return;
    if (!soundCache[name]) {
        soundCache[name] = new Audio(src);
    }
    const audio = soundCache[name];
    audio.volume = soundVolume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
}

function toggleVolumePopup() {
    const popup = document.getElementById('volume-popup');
    if (!popup) return;
    popup.classList.toggle('hidden');
}

function toggleVolumeMute() {
    soundEnabled = !soundEnabled;
    updateVolumeIcon();
    // Sync with preferences checkbox
    const cb = document.getElementById('pref-sound');
    if (cb) cb.checked = soundEnabled;
    window.api.customization.toggleSound(soundEnabled);
    playSound('click');
}

function onVolumeSliderInput(val) {
    soundVolume = val / 100;
    document.getElementById('volume-pct').textContent = `${val}%`;
    updateVolumeTrackFill(val);
    window.api.customization.setVolume(soundVolume);
}

function updateVolumeIcon() {
    const icon = document.getElementById('volume-icon');
    const muteBtn = document.getElementById('volume-mute-btn');
    if (!icon) return;
    if (!soundEnabled) {
        icon.textContent = '🔇';
        if (muteBtn) { muteBtn.textContent = '🔊 בטל השתקה'; muteBtn.classList.add('muted'); }
    } else if (soundVolume === 0) {
        icon.textContent = '🔇';
        if (muteBtn) { muteBtn.textContent = '🔇 השתק'; muteBtn.classList.remove('muted'); }
    } else if (soundVolume < 0.4) {
        icon.textContent = '🔈';
        if (muteBtn) { muteBtn.textContent = '🔇 השתק'; muteBtn.classList.remove('muted'); }
    } else {
        icon.textContent = '🔊';
        if (muteBtn) { muteBtn.textContent = '🔇 השתק'; muteBtn.classList.remove('muted'); }
    }
}

function updateVolumeTrackFill(pct) {
    const slider = document.getElementById('volume-slider');
    if (slider) slider.style.setProperty('--fill', `${pct}%`);
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// ==================== LIVE CLOCK ====================
function startClock() {
    function tick() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        const el = document.getElementById('clock-time');
        if (el) el.textContent = `${h}:${m}:${s}`;
    }
    tick();
    setInterval(tick, 1000);
}

// ==================== TOOLTIPS ====================
function setupTooltips() {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;
    document.addEventListener('mouseover', e => {
        const el = e.target.closest('[data-tooltip]');
        if (!el) return;
        const text = el.dataset.tooltip;
        if (!text) return;
        tooltip.textContent = text;
        tooltip.classList.add('visible');
    });
    document.addEventListener('mouseout', e => {
        if (e.target.closest('[data-tooltip]')) tooltip.classList.remove('visible');
    });
    document.addEventListener('mousemove', e => {
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top  = (e.clientY - 10) + 'px';
    });
}

// ==================== CONFIRM MODAL ====================
let _confirmResolve = null;

function showConfirm(message, { title = '⚠️ אישור', confirmText = 'כן, אני בטוח', cancelText = 'ביטול', danger = true } = {}) {
    return new Promise(resolve => {
        _confirmResolve = resolve;
        document.getElementById('confirm-modal-title').textContent = title;
        document.getElementById('confirm-modal-message').textContent = message;
        const okBtn = document.getElementById('confirm-ok-btn');
        okBtn.textContent = confirmText;
        okBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
        okBtn.onclick = () => closeConfirm(true);
        document.getElementById('confirm-cancel-btn').textContent = cancelText;
        document.getElementById('confirm-cancel-btn').onclick = () => closeConfirm(false);
        document.getElementById('confirm-modal').classList.remove('hidden');
    });
}

function closeConfirm(value) {
    document.getElementById('confirm-modal').classList.add('hidden');
    if (_confirmResolve) {
        const cb = _confirmResolve;
        _confirmResolve = null;
        cb(value);
    }
}

// ==================== LOADING SKELETON ====================
function showSkeleton(containerId, count = 4, type = 'card') {
    const el = document.getElementById(containerId);
    if (!el) return;
    const tmpl = type === 'list'
        ? `<div class="skeleton-row"><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text-sm"></div></div>`
        : `<div class="skeleton-card"><div class="skeleton skeleton-icon"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text-sm"></div></div>`;
    el.innerHTML = Array(count).fill(tmpl).join('');
}

// ==================== TIME WINDOW GUARD ====================
function isTimeAllowedNow(windows) {
    if (!windows || windows.length === 0) return true;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    for (const w of windows) {
        const [fh, fm] = w.from.split(':').map(Number);
        const [th, tm] = w.to.split(':').map(Number);
        const from = fh * 60 + fm;
        const to   = th * 60 + tm;
        if (from < to ? (nowMins >= from && nowMins < to) : (nowMins >= from || nowMins < to)) return true;
    }
    return false;
}

function startTimeWindowGuard() {
    stopTimeWindowGuard();
    timeWindowGuardInterval = setInterval(async () => {
        if (!currentUser || currentUser.isParent || currentUser.isAdmin) return;
        const settings = await window.api.settings.get();
        const windows = settings.timeWindows;
        if (!windows || windows.length === 0) return;
        if (!isTimeAllowedNow(windows)) {
            stopTimeWindowGuard();
            stopTimer();
            showToast('🕐 השעה נחסמה — מנותק אוטומטית', 'error', 3000);
            await doLogoutDueToTimeExpiry();
        }
    }, 60000); // check every minute
}

function stopTimeWindowGuard() {
    if (timeWindowGuardInterval) {
        clearInterval(timeWindowGuardInterval);
        timeWindowGuardInterval = null;
    }
}

// ==================== TIME WINDOWS EDITOR ====================
function renderTimeWindows(windows) {
    _timeWindows = windows.map(w => ({ ...w }));
    const list = document.getElementById('time-windows-list');
    if (!list) return;
    if (_timeWindows.length === 0) {
        list.innerHTML = '<div class="tw-empty">אין הגבלת שעות — ילדים יכולים להתחבר בכל שעה</div>';
        return;
    }
    list.innerHTML = _timeWindows.map((w, i) => `
        <div class="tw-row" data-idx="${i}">
            <span class="tw-label">חלון ${i + 1}</span>
            <div class="tw-inputs">
                <label>מ-</label>
                <input type="time" class="tw-from" value="${w.from}" oninput="_timeWindows[${i}].from=this.value">
                <label>עד</label>
                <input type="time" class="tw-to"   value="${w.to}"   oninput="_timeWindows[${i}].to=this.value">
            </div>
            <button class="btn btn-small btn-danger tw-remove-btn" onclick="removeTimeWindow(${i})" data-tooltip="הסר חלון">🗑️</button>
        </div>`).join('');
}

function addTimeWindow() {
    _timeWindows.push({ from: '15:00', to: '18:00' });
    renderTimeWindows(_timeWindows);
}

function removeTimeWindow(index) {
    _timeWindows.splice(index, 1);
    renderTimeWindows(_timeWindows);
}

function collectTimeWindows() {
    const rows = document.querySelectorAll('.tw-row');
    const result = [];
    rows.forEach(row => {
        const from = row.querySelector('.tw-from')?.value;
        const to   = row.querySelector('.tw-to')?.value;
        if (from && to) result.push({ from, to });
    });
    return result;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatRelativeTime(date) {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'עכשיו';
    if (minutes < 60) return `לפני ${minutes} דק'`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `לפני ${hours} שע'`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'אתמול';
    return `לפני ${days} ימים`;
}

function formatPlayTime(minutes) {
    if (!minutes || minutes < 1) return null;
    if (minutes < 60) return `${minutes} דק'`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}ש' ${m}ד'` : `${h} שע'`;
}

// ==================== NOTIFICATIONS ====================
let notifPollInterval = null;

async function refreshNotificationBell() {
    if (!currentUser || currentUser.isParent || currentUser.isAdmin) return;
    try {
        const notifs = await window.api.notifications.get();
        const unread = notifs.filter(n => !n.read).length;
        const badge = document.getElementById('notif-badge');
        if (badge) {
            badge.textContent = unread;
            badge.classList.toggle('hidden', unread === 0);
        }
        renderNotificationList(notifs);
    } catch (e) { /* ignore */ }
}

function renderNotificationList(notifs) {
    const list = document.getElementById('notif-list');
    if (!list) return;
    if (!notifs || notifs.length === 0) {
        list.innerHTML = '<p class="notif-empty">אין התראות חדשות</p>';
        return;
    }
    list.innerHTML = notifs.slice(0, 30).map(n => {
        const t = n.createdAt ? new Date(n.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';
        return `<div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotificationRead('${n.id}')">
            <span class="notif-icon">${escapeHtml(n.icon || '🔔')}</span>
            <div class="notif-body">
                <div class="notif-title">${escapeHtml(n.title)}</div>
                ${n.body ? `<div class="notif-text">${escapeHtml(n.body)}</div>` : ''}
            </div>
            <span class="notif-time">${t}</span>
        </div>`;
    }).join('');
}

function toggleNotifDropdown() {
    const dd = document.getElementById('notif-dropdown');
    if (!dd) return;
    dd.classList.toggle('hidden');
    if (!dd.classList.contains('hidden')) refreshNotificationBell();
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    const dd = document.getElementById('notif-dropdown');
    const btn = document.getElementById('notif-btn');
    if (dd && !dd.contains(e.target) && btn && !btn.contains(e.target)) {
        dd.classList.add('hidden');
    }
    const vp = document.getElementById('volume-popup');
    const vb = document.getElementById('volume-btn');
    if (vp && !vp.contains(e.target) && vb && !vb.contains(e.target)) {
        vp.classList.add('hidden');
    }
});

async function markNotificationRead(id) {
    await window.api.notifications.markRead(id);
    refreshNotificationBell();
}

async function clearAllNotifications() {
    await window.api.notifications.clear();
    refreshNotificationBell();
    document.getElementById('notif-dropdown')?.classList.add('hidden');
}

// ==================== BIRTHDAY ====================
async function checkBirthday() {
    if (!currentUser || currentUser.isParent || currentUser.isAdmin) return;
    try {
        const result = await window.api.birthday.check();
        if (result && result.isBirthday && result.bonusGranted) {
            currentUser = result.user || currentUser;
            const bonus = result.bonus || 0;
            document.getElementById('birthday-bonus-text').textContent = `קיבלת ${bonus} מטבעות בונוס! 🎉`;
            document.getElementById('birthday-overlay').classList.remove('hidden');
            playSound('birthday');
            launchConfetti('birthday');
            refreshUI();
        }
    } catch (e) { /* ignore */ }
}

function closeBirthdayOverlay() {
    document.getElementById('birthday-overlay').classList.add('hidden');
}

// ==================== USER MESSAGES ====================
async function loadUserMessages() {
    if (!currentUser || currentUser.isParent || currentUser.isAdmin) return;
    try {
        const msgs = await window.api.messages.getForUser();
        const container = document.getElementById('msg-banner-container');
        if (!container) return;
        container.innerHTML = '';
        if (!msgs || msgs.length === 0) return;
        msgs.forEach(msg => {
            const div = document.createElement('div');
            div.className = 'msg-banner';
            div.innerHTML = `
                <span class="msg-banner-icon">📢</span>
                <span class="msg-banner-text">${escapeHtml(msg.text)}</span>
                <button class="msg-banner-close" onclick="dismissUserMsg('${msg.id}')">×</button>`;
            container.appendChild(div);
        });
    } catch (e) { /* ignore */ }
}

async function dismissUserMsg(id) {
    await window.api.messages.dismiss(id);
    loadUserMessages();
}

async function loadLockScreenMessages() {
    try {
        const msgs = await window.api.messages.getLockScreen();
        const container = document.getElementById('lock-messages');
        if (!container) return;
        if (!msgs || msgs.length === 0) { container.classList.add('hidden'); return; }
        container.classList.remove('hidden');
        container.innerHTML = msgs.map(m =>
            `<div class="lock-msg-item">📢 ${escapeHtml(m.text)}</div>`
        ).join('');
    } catch (e) { /* ignore */ }
}

// ==================== ADMIN MESSAGES ====================
async function loadAdminMessages() {
    // Populate target dropdown with child users
    try {
        const overview = await window.api.admin.getAllUsersOverview();
        const sel = document.getElementById('msg-target');
        if (sel && overview.users) {
            sel.innerHTML = '<option value="all">כל הילדים</option>';
            overview.users.forEach(u => {
                if (!u.isParent && !u.isAdmin) {
                    const opt = document.createElement('option');
                    opt.value = u.username;
                    opt.textContent = u.displayName || u.username;
                    sel.appendChild(opt);
                }
            });
        }

        // Birthday list
        const bdList = document.getElementById('birthday-list');
        if (bdList && overview.users) {
            bdList.innerHTML = overview.users.filter(u => !u.isParent && !u.isAdmin).map(u => {
                const bd = u.birthday || '';
                return `<div class="admin-task-card" style="display:flex;justify-content:space-between;align-items:center">
                    <span>${escapeHtml(u.displayName || u.username)}</span>
                    <span style="display:flex;gap:8px;align-items:center">
                        <input type="date" value="${bd}" style="background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border);border-radius:8px;padding:4px 8px"
                            onchange="saveBirthday('${u.username}', this.value)">
                    </span>
                </div>`;
            }).join('') || '<p class="no-data">אין ילדים רשומים</p>';
        }
    } catch (e) { /* ignore */ }

    // Active messages
    try {
        const msgs = await window.api.messages.getAll();
        const list = document.getElementById('admin-messages-list');
        if (!list) return;
        if (!msgs || msgs.length === 0) {
            list.innerHTML = '<p class="no-data">אין הודעות פעילות</p>';
            return;
        }
        list.innerHTML = msgs.map(m => {
            const target = m.target === 'all' ? 'כולם' : m.target;
            const lockTag = m.showOnLock ? '🔒' : '';
            const exp = m.expiresAt ? `פג: ${new Date(m.expiresAt).toLocaleString('he-IL')}` : 'ללא תפוגה';
            return `<div class="admin-task-card" style="display:flex;justify-content:space-between;align-items:center;gap:10px">
                <div>
                    <div class="task-title">${lockTag} ${escapeHtml(m.text)}</div>
                    <div class="task-meta">→ ${target} | ${exp}</div>
                </div>
                <button class="btn btn-danger btn-small" onclick="deleteAdminMessage('${m.id}')">🗑️</button>
            </div>`;
        }).join('');
    } catch (e) { /* ignore */ }
}

function openMessageComposer() {
    document.getElementById('message-composer').classList.remove('hidden');
}
function closeMessageComposer() {
    document.getElementById('message-composer').classList.add('hidden');
    document.getElementById('msg-text').value = '';
}

async function sendAdminMessage() {
    const text = document.getElementById('msg-text').value.trim();
    if (!text) { showToast('הכנס טקסט להודעה', 'error'); return; }
    const target  = document.getElementById('msg-target').value;
    const showOnLock = document.getElementById('msg-show-lock').checked;
    const expiryHours = parseInt(document.getElementById('msg-expiry').value) || 0;
    const result = await window.api.messages.create({ text, target, showOnLock, expiryHours });
    if (result.success) {
        showToast('📢 הודעה נשלחה!', 'success');
        closeMessageComposer();
        loadAdminMessages();
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function deleteAdminMessage(id) {
    await window.api.messages.delete(id);
    loadAdminMessages();
}

async function saveBirthday(username, date) {
    const result = await window.api.birthday.setDate({ username, date });
    if (result && result.success) showToast('🎂 יום הולדת נשמר!', 'success');
    else showToast('שגיאה בשמירה', 'error');
}

// ==================== CONFETTI ====================
(function initConfettiCanvas() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animId = null;

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function randBetween(a, b) { return a + Math.random() * (b - a); }

    function makeParticle(x, y, vx, vy, color, shape) {
        return { x, y, vx, vy, color, shape: shape || 'rect',
                 size: randBetween(6, 14), rotation: randBetween(0, Math.PI * 2),
                 rotSpeed: randBetween(-0.12, 0.12), alpha: 1, gravity: 0.35 };
    }

    const PALETTES = {
        levelup:     ['#6c5ce7','#a29bfe','#ffd700','#fdcb6e','#fff'],
        achievement: ['#f39c12','#ffd700','#fdcb6e','#e17055','#fff'],
        purchase:    ['#00cec9','#55efc4','#6c5ce7','#a29bfe','#ffeaa7'],
        birthday:    ['#fd79a8','#e17055','#74b9ff','#55efc4','#ffd700','#a29bfe','#fff'],
    };

    function burst(type) {
        resize();
        const W = canvas.width, H = canvas.height;
        const palette = PALETTES[type] || PALETTES.birthday;
        particles = [];

        if (type === 'levelup') {
            // burst from center
            for (let i = 0; i < 120; i++) {
                const angle = (i / 120) * Math.PI * 2;
                const speed = randBetween(4, 14);
                particles.push(makeParticle(W/2, H/2, Math.cos(angle)*speed, Math.sin(angle)*speed - 3, palette[i % palette.length]));
            }
        } else if (type === 'achievement') {
            // golden rain from top
            for (let i = 0; i < 100; i++) {
                particles.push(makeParticle(randBetween(0, W), randBetween(-50, -5), randBetween(-2, 2), randBetween(3, 9), palette[i % palette.length]));
            }
        } else if (type === 'purchase') {
            // shower of coins from top center
            for (let i = 0; i < 80; i++) {
                particles.push(makeParticle(randBetween(W*0.3, W*0.7), randBetween(-40, 0), randBetween(-3, 3), randBetween(4, 10), palette[i % palette.length], 'circle'));
            }
        } else {
            // birthday: full screen rainbow from all edges
            for (let i = 0; i < 200; i++) {
                const edge = Math.floor(Math.random() * 4);
                let x, y, vx, vy;
                if (edge === 0) { x = randBetween(0, W); y = -10; vx = randBetween(-3, 3); vy = randBetween(4, 12); }
                else if (edge === 1) { x = W+10; y = randBetween(0, H); vx = randBetween(-12, -4); vy = randBetween(-3, 3); }
                else if (edge === 2) { x = randBetween(0, W); y = H+10; vx = randBetween(-3, 3); vy = randBetween(-12, -4); }
                else { x = -10; y = randBetween(0, H); vx = randBetween(4, 12); vy = randBetween(-3, 3); }
                particles.push(makeParticle(x, y, vx, vy, palette[i % palette.length], i%3===0?'circle':'rect'));
            }
        }

        if (animId) cancelAnimationFrame(animId);
        animate();
    }

    function drawParticle(p) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.size/2, 0, Math.PI*2);
            ctx.fill();
        } else {
            ctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
        }
        ctx.restore();
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles = particles.filter(p => p.alpha > 0.02);
        if (particles.length === 0) { animId = null; return; }
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.99;
            p.rotation += p.rotSpeed;
            p.alpha -= 0.012;
            drawParticle(p);
        }
        animId = requestAnimationFrame(animate);
    }

    window.launchConfetti = burst;
})();
