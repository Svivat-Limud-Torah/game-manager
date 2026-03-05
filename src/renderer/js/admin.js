// ==================== Admin Panel ====================

// ---- Economy difficulty presets ----
const DIFFICULTY_PRESETS = {
    easy:   { coinsPerCorrectAnswer: 4, coinsPerReviewAnswer: 6,  xpPerQuestion: 6, xpPerReviewQuestion: 8,  dailyFreeTime: 45, coinsPerMinute: 10, streakBonusCoins: 25 },
    medium: { coinsPerCorrectAnswer: 2, coinsPerReviewAnswer: 3,  xpPerQuestion: 4, xpPerReviewQuestion: 6,  dailyFreeTime: 30, coinsPerMinute: 20, streakBonusCoins: 15 },
    hard:   { coinsPerCorrectAnswer: 1, coinsPerReviewAnswer: 2,  xpPerQuestion: 3, xpPerReviewQuestion: 5,  dailyFreeTime: 20, coinsPerMinute: 40, streakBonusCoins: 8  },
};
let _activeDifficulty = 'medium';

function applyDifficultyPreset(difficulty) {
    const preset = DIFFICULTY_PRESETS[difficulty];
    if (!preset) return;
    _activeDifficulty = difficulty;
    document.getElementById('setting-daily-time').value       = preset.dailyFreeTime;
    document.getElementById('setting-coins-per-min').value    = preset.coinsPerMinute;
    document.getElementById('setting-coins-per-answer').value = preset.coinsPerCorrectAnswer;
    const streakEl = document.getElementById('setting-streak-bonus');
    if (streakEl) streakEl.value = preset.streakBonusCoins;
    ['easy', 'medium', 'hard'].forEach(d => {
        const btn = document.getElementById(`preset-${d}`);
        if (btn) btn.classList.toggle('difficulty-btn-active', d === difficulty);
    });
    const labels = { easy: 'קל 😊', medium: 'בינוני ⚖️', hard: 'קשה 💪' };
    showToast(`רמת קושי "${labels[difficulty]}" הוחלה — לחץ "שמור הגדרות" לאישור`, 'info');
}

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
            if (tab.dataset.adminTab === 'sync-manage') loadSyncPanel();
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
    const statsMap = {};
    for (const u of result.users) {
        const s = await window.api.gamification.getUserStats(u.username);
        if (s.success) statsMap[u.username] = s;
    }

    // Get online statuses if sync is enabled
    let onlineStatuses = {};
    try {
        const syncStatus = await window.api.sync.getStatus();
        if (syncStatus.syncEnabled) onlineStatuses = await window.api.sync.getOnlineStatuses();
    } catch (e) { /* sync not available */ }
    
    tbody.innerHTML = result.users.map(u => {
        const s = statsMap[u.username];
        const onlineInfo = onlineStatuses[u.username];
        const onlineDot = onlineInfo ? (onlineInfo.online ? '<span class="sync-dot-inline online" title="מחובר">🟢</span>' : '<span class="sync-dot-inline offline" title="לא מחובר">🔴</span>') : '';
        return `
        <tr>
            <td>${onlineDot}<strong>${escapeHtml(u.displayName)}</strong><br><small>${escapeHtml(u.username)}</small></td>
            <td>💰 ${u.coins}</td>
            <td>${formatTime(u.remainingTime)}</td>
            <td>${u.totalCorrect}/${u.totalQuestionsAnswered}</td>
            <td>${u.tasksCompleted}/${u.totalTasks}</td>
            <td>${u.ownedGames} 🎮</td>
            <td>${s ? `${s.levelBadge} <strong>${s.level}</strong> <small>${s.levelTitle}</small><br><span class="xp-inline">${s.xp} XP · 🔥${s.streak}</span>` : '—'}</td>
            <td>
                <button class="btn btn-small btn-secondary" onclick="showProfileModal('${u.username}')">👤 פרופיל</button>
                <button class="btn btn-small btn-outline" onclick="openUserThemeModal('${u.username}', '${escapeHtml(u.displayName)}')" title="הגדר ערכת נושא">🎨</button>
                <button class="btn btn-small btn-outline" onclick="openCoinsModal('${u.username}', '${escapeHtml(u.displayName)}', ${u.coins})">💰 מטבעות</button>
                <button class="btn btn-small btn-primary" onclick="openTimeModal('${u.username}', '${escapeHtml(u.displayName)}', ${u.remainingTime})">⏱️ זמן</button>
                <button class="btn btn-small btn-outline" onclick="openChangePasswordModal('${u.username}', '${escapeHtml(u.displayName)}')">🔑 סיסמה</button>
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

// ==================== User Theme Modal ====================
let userThemeTarget = null;

async function openUserThemeModal(username, displayName) {
    userThemeTarget = username;
    document.getElementById('user-theme-modal-name').textContent = displayName;

    const themes = await window.api.customization.getThemes();
    const userStats = await window.api.gamification.getUserStats(username);
    const currentTheme = userStats?.equippedTheme || 'dark';

    const PREMIUM_IDS = ['space', 'pink', 'fire'];
    const grid = document.getElementById('user-theme-grid');
    grid.innerHTML = themes.map(th => {
        const isPremium = PREMIUM_IDS.includes(th.id);
        const isActive = th.id === currentTheme;
        return `
        <button class="user-theme-option ${isActive ? 'active' : ''} ${isPremium ? 'premium' : ''}"
                onclick="selectUserTheme('${th.id}')"
                data-theme-id="${th.id}">
            <span class="user-theme-emoji">${th.emoji}</span>
            <span class="user-theme-name">${escapeHtml(th.name)}</span>
            ${isPremium ? '<span class="user-theme-premium-star">✦</span>' : ''}
        </button>`;
    }).join('');

    document.getElementById('user-theme-modal').classList.remove('hidden');
}

function selectUserTheme(themeId) {
    document.querySelectorAll('.user-theme-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeId === themeId);
    });
}

async function applyUserThemeModal() {
    const activeBtn = document.querySelector('.user-theme-option.active');
    if (!activeBtn || !userThemeTarget) return;
    const themeId = activeBtn.dataset.themeId;
    const result = await window.api.admin.setUserTheme(userThemeTarget, themeId);
    if (result.success) {
        showToast('ערכת נושא הוגדרה! 🎨', 'success');
        closeUserThemeModal();
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

function closeUserThemeModal() {
    userThemeTarget = null;
    document.getElementById('user-theme-modal').classList.add('hidden');
}

// ==================== Coins Modal ====================
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

// ==================== Time Modal ====================
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

// ==================== Reset / Delete User ====================
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

// ==================== Change Child Password ====================

let _changePwdUsername = null;

function openChangePasswordModal(username, displayName) {
    _changePwdUsername = username;
    document.getElementById('change-password-subtext').textContent = `שנה סיסמה ל: ${displayName}`;
    document.getElementById('change-password-new').value = '';
    document.getElementById('change-password-error').classList.add('hidden');
    document.getElementById('change-password-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('change-password-new').focus(), 100);
}

function closeChangePasswordModal() {
    document.getElementById('change-password-modal').classList.add('hidden');
    _changePwdUsername = null;
}

async function submitChangePassword() {
    const newPassword = document.getElementById('change-password-new').value;
    const errEl = document.getElementById('change-password-error');
    if (!newPassword) {
        errEl.textContent = 'נא להזין סיסמה חדשה';
        errEl.classList.remove('hidden');
        return;
    }
    const result = await window.api.admin.setChildPassword({ username: _changePwdUsername, newPassword });
    if (result.success) {
        closeChangePasswordModal();
        showToast('✅ סיסמה עודכנה בהצלחה', 'success');
    } else {
        errEl.textContent = result.error || 'שגיאה בעדכון הסיסמה';
        errEl.classList.remove('hidden');
    }
}

// ==================== Add Child ====================
function openAddChildModal() {
    document.getElementById('add-child-displayname').value = '';
    document.getElementById('add-child-username').value = '';
    document.getElementById('add-child-password').value = '';
    document.getElementById('add-child-error').classList.add('hidden');
    document.getElementById('add-child-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('add-child-displayname').focus(), 100);
}

function closeAddChildModal() {
    document.getElementById('add-child-modal').classList.add('hidden');
}

async function submitAddChild() {
    const displayName = document.getElementById('add-child-displayname').value.trim();
    const username = document.getElementById('add-child-username').value.trim();
    const password = document.getElementById('add-child-password').value;
    const errEl = document.getElementById('add-child-error');

    if (!displayName || !username || !password) {
        errEl.textContent = 'נא למלא את כל השדות';
        errEl.classList.remove('hidden');
        return;
    }

    const result = await window.api.admin.createChild({ username, password, displayName });
    if (result.success) {
        closeAddChildModal();
        showToast(`✅ חשבון "${displayName}" נוצר בהצלחה!`, 'success');
        loadAdminOverview();
    } else {
        errEl.textContent = result.error || 'שגיאה ביצירת החשבון';
        errEl.classList.remove('hidden');
    }
}

// ==================== Delete User ====================
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

// ==================== Admin Tasks ====================
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
    
    if (!title) { showToast('יש להזין שם למשימה', 'error'); return; }
    if (!approvalCode) { showToast('יש להזין קוד אישור למשימה', 'error'); return; }
    
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

// ==================== Admin Games ====================
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
            let expiryVal = '0';
            if (game.expiresAt) {
                const daysLeft = Math.round((new Date(game.expiresAt) - Date.now()) / 86400000);
                const standard = ['1','3','7','14','30'];
                expiryVal = standard.includes(String(daysLeft)) ? String(daysLeft) : 'custom';
                if (expiryVal === 'custom') document.getElementById('game-expiry-custom').value = daysLeft;
            }
            document.querySelector(`input[name="game-expiry"][value="${expiryVal}"]`).checked = true;
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

// ==================== Admin Questions ====================
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

// ==================== Admin Settings ====================
function setupSettingsActions() {
    document.getElementById('save-settings-btn')?.addEventListener('click', saveSettings);
}

async function loadAdminSettings() {
    const settings = await window.api.settings.get();
    document.getElementById('setting-daily-time').value = Math.round((settings.dailyFreeTime || 1800) / 60);
    document.getElementById('setting-coins-per-min').value = settings.coinsPerMinute || 20;
    document.getElementById('setting-coins-per-answer').value = settings.coinsPerCorrectAnswer || 2;
    document.getElementById('setting-parent-pin').value = '';
    document.getElementById('setting-parent-pin').placeholder = '••••';
    const guardToggle = document.getElementById('setting-game-guard');
    if (guardToggle) guardToggle.checked = settings.gameGuardEnabled !== false;
    renderTimeWindows(settings.timeWindows || []);
    const quotaEl = document.getElementById('setting-streak-quota');
    const bonusEl = document.getElementById('setting-streak-bonus');
    if (quotaEl) quotaEl.value = settings.streakQuotaPerDay ?? 1;
    if (bonusEl) bonusEl.value = settings.streakBonusCoins  ?? 15;
    const bdBonusEl = document.getElementById('setting-birthday-bonus');
    if (bdBonusEl) bdBonusEl.value = settings.birthdayBonus ?? 300;

    // Highlight active difficulty preset
    _activeDifficulty = settings.difficulty || 'medium';
    ['easy', 'medium', 'hard'].forEach(d => {
        const btn = document.getElementById(`preset-${d}`);
        if (btn) btn.classList.toggle('difficulty-btn-active', d === _activeDifficulty);
    });
}

async function saveSettings() {
    const dailyTime = parseInt(document.getElementById('setting-daily-time').value) * 60;
    const coinsPerMinute = parseInt(document.getElementById('setting-coins-per-min').value);
    const coinsPerCorrectAnswer = parseInt(document.getElementById('setting-coins-per-answer').value);
    const newPin = document.getElementById('setting-parent-pin').value.trim();
    const gameGuardEnabled = document.getElementById('setting-game-guard')?.checked !== false;
    const timeWindows = collectTimeWindows();
    const streakQuotaPerDay = parseInt(document.getElementById('setting-streak-quota')?.value ?? 1);
    const streakBonusCoins  = parseInt(document.getElementById('setting-streak-bonus')?.value ?? 15);
    
    // Derive XP from active difficulty preset (or scale from coins)
    const xpPreset = DIFFICULTY_PRESETS[_activeDifficulty] || DIFFICULTY_PRESETS.medium;
    
    const newSettings = {
        difficulty: _activeDifficulty,
        dailyFreeTime: dailyTime,
        coinsPerMinute,
        coinsPerCorrectAnswer,
        coinsPerReviewAnswer: coinsPerCorrectAnswer + 1,
        xpPerQuestion: xpPreset.xpPerQuestion,
        xpPerReviewQuestion: xpPreset.xpPerReviewQuestion,
        gameGuardEnabled,
        timeWindows,
        streakQuotaPerDay,
        streakBonusCoins,
        birthdayBonus: parseInt(document.getElementById('setting-birthday-bonus')?.value ?? 300)
    };
    
    if (newPin) newSettings.parentPin = newPin;
    
    await window.api.settings.set(newSettings);
    await window.api.gameguard.setEnabled(gameGuardEnabled);
    showToast('הגדרות נשמרו! ⚙️', 'success');
}

// ==================== Time Windows Editor ====================
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

// ==================== Online Sync Panel ====================

async function loadSyncPanel() {
    const status = await window.api.sync.getStatus();
    const setupPanel = document.getElementById('sync-setup-panel');
    const connPanel = document.getElementById('sync-connected-panel');
    const badge = document.getElementById('sync-status-badge');
    const familyRow = document.getElementById('sync-family-id-row');

    if (status.syncEnabled && status.familyId) {
        setupPanel.style.display = 'none';
        connPanel.style.display = '';
        badge.textContent = status.isOnline ? '🟢 מחובר' : '🟡 מחובר (אופליין)';
        badge.className = 'sync-badge ' + (status.isOnline ? 'sync-on' : 'sync-warn');
        familyRow.style.display = '';
        document.getElementById('sync-family-id-display').textContent = status.familyId;
        loadOnlineStatuses();
    } else {
        setupPanel.style.display = '';
        connPanel.style.display = 'none';
        badge.textContent = 'לא מחובר';
        badge.className = 'sync-badge sync-off';
        familyRow.style.display = 'none';
    }
}

async function syncCreateFamily() {
    const btn = document.getElementById('sync-create-family-btn');
    btn.disabled = true;
    btn.textContent = '⏳ יוצר...';
    const result = await window.api.sync.setupFamily();
    if (result.success) {
        showToast('משפחה נוצרה! קוד המשפחה הועתק 🎉', 'success');
        loadSyncPanel();
    } else {
        showToast(result.error || 'שגיאה ביצירה', 'error');
    }
    btn.disabled = false;
    btn.textContent = '🚀 צור משפחה';
}

async function syncJoinFamily() {
    const input = document.getElementById('sync-join-family-input');
    const familyId = input.value.trim();
    if (!familyId) return showToast('הזן קוד משפחה', 'error');
    const result = await window.api.sync.connectFamily(familyId);
    if (result.success) {
        showToast('חובר בהצלחה! נתונים סונכרנו 🎉', 'success');
        loadSyncPanel();
    } else {
        showToast(result.error || 'שגיאה בהתחברות', 'error');
    }
}

function copySyncFamilyId() {
    const code = document.getElementById('sync-family-id-display').textContent;
    navigator.clipboard.writeText(code).then(() => showToast('קוד הועתק! 📋', 'success'));
}

async function syncPullNow() {
    await window.api.sync.pullNow();
    showToast('נתונים עודכנו מהענן ⬇️', 'success');
}

async function syncPushNow() {
    await window.api.sync.pushNow();
    showToast('נתונים נדחפו לענן ⬆️', 'success');
}

async function syncDisconnect() {
    if (!confirm('בטוח לנתק את הסנכרון?')) return;
    await window.api.sync.disconnect();
    showToast('סנכרון נותק', 'info');
    loadSyncPanel();
}

async function loadOnlineStatuses() {
    const list = document.getElementById('sync-online-list');
    if (!list) return;
    const statuses = await window.api.sync.getOnlineStatuses();
    const users = await window.api.users.getAll();

    if (!statuses || Object.keys(statuses).length === 0) {
        list.innerHTML = '<p class="text-secondary">אין מידע על מכשירים</p>';
        return;
    }

    list.innerHTML = Object.entries(statuses).map(([username, info]) => {
        const user = users[username];
        const displayName = user?.displayName || username;
        const online = info.online === true;
        const lastSeen = info.lastSeen ? new Date(info.lastSeen).toLocaleString('he-IL') : '—';
        return `
            <div class="sync-online-item">
                <span class="sync-online-dot ${online ? 'online' : 'offline'}"></span>
                <span class="sync-online-name">${escapeHtml(displayName)} (${escapeHtml(username)})</span>
                <span class="sync-online-status">${online ? '🟢 מחובר' : '🔴 לא מחובר'}</span>
                <small class="sync-online-lastseen">${online ? '' : 'נראה לאחרונה: ' + lastSeen}</small>
            </div>
        `;
    }).join('');
}
