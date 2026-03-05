// ==================== KidScreen Web Panel ====================
// Connects directly to Firebase RTDB — same data the Electron app syncs with

const firebaseConfig = {
    apiKey: "AIzaSyAIjg-t81oRig1tNI6TcKsh4IVoo--U19k",
    authDomain: "kidscreen-102f1.firebaseapp.com",
    databaseURL: "https://kidscreen-102f1-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "kidscreen-102f1",
    storageBucket: "kidscreen-102f1.firebasestorage.app",
    messagingSenderId: "875721099337",
    appId: "1:875721099337:web:33cd57a4decbf9c5fe5798"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==================== STATE ====================
let familyId = null;
let parentUsername = null;
let familyData = {
    users: {},
    tasks: [],
    settings: {},
    messages: [],
    online: {},
    customGames: [],
    customAchievements: [],
    challenges: []
};
let listeners = [];

// ==================== LOGIN ====================

async function handleLogin() {
    const famId = document.getElementById('login-family-id').value.trim();
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('hidden');

    if (!famId) {
        showLoginError('נא להזין קוד משפחה');
        return;
    }

    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = '⏳ מתחבר...';

    try {
        // Check family exists
        const infoSnap = await db.ref(`families/${famId}/info`).once('value');
        if (!infoSnap.exists()) {
            showLoginError('קוד משפחה לא נמצא');
            resetLoginBtn();
            return;
        }

        // Find the parent user automatically
        const usersSnap = await db.ref(`families/${famId}/users`).once('value');
        if (!usersSnap.exists()) {
            showLoginError('לא נמצאו משתמשים במשפחה');
            resetLoginBtn();
            return;
        }

        const users = usersSnap.val();
        const parentEntry = Object.values(users).find(u => u.isParent || u.isAdmin);
        if (!parentEntry) {
            showLoginError('לא נמצא הורה במשפחה זו');
            resetLoginBtn();
            return;
        }

        // Success — log in as the parent
        familyId = famId;
        parentUsername = parentEntry.username;
        sessionStorage.setItem('kidsscreen_familyId', famId);
        sessionStorage.setItem('kidsscreen_username', parentEntry.username);
        enterApp();
    } catch (err) {
        showLoginError('שגיאה: ' + err.message);
        resetLoginBtn();
    }
}

function resetLoginBtn() {
    const btn = document.getElementById('login-btn');
    btn.disabled = false;
    btn.textContent = '🚀 התחבר';
}

function showLoginError(msg) {
    const el = document.getElementById('login-error');
    el.textContent = msg;
    el.classList.remove('hidden');
}

function handleLogout() {
    stopListeners();
    familyId = null;
    parentUsername = null;
    sessionStorage.removeItem('kidsscreen_familyId');
    sessionStorage.removeItem('kidsscreen_username');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
}

// ==================== APP ENTRY ====================

function enterApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    startListeners();
    startConnectionMonitor();
}

// ==================== REAL-TIME LISTENERS ====================

function startListeners() {
    stopListeners();
    if (!familyId) return;

    const paths = ['users', 'tasks', 'settings', 'messages', 'online', 'customGames', 'customAchievements', 'challenges'];
    
    paths.forEach(path => {
        const ref = db.ref(`families/${familyId}/${path}`);
        ref.on('value', snap => {
            const val = snap.val();
            if (path === 'tasks' || path === 'messages' || path === 'customGames' || path === 'customAchievements' || path === 'challenges') {
                // Arrays stored as objects in Firebase — convert
                familyData[path] = val ? (Array.isArray(val) ? val : Object.values(val)) : [];
            } else {
                familyData[path] = val || {};
            }
            onDataUpdated(path);
        });
        listeners.push(ref);
    });
}

function stopListeners() {
    listeners.forEach(ref => ref.off());
    listeners = [];
}

function startConnectionMonitor() {
    const connRef = db.ref('.info/connected');
    connRef.on('value', snap => {
        const badge = document.getElementById('connection-badge');
        if (snap.val() === true) {
            badge.textContent = '🟢 מחובר';
            badge.className = 'conn-badge online';
        } else {
            badge.textContent = '🔴 אופליין';
            badge.className = 'conn-badge offline';
        }
    });
    listeners.push(connRef);
}

// ==================== DATA UPDATED HANDLER ====================

function onDataUpdated(path) {
    if (path === 'users' || path === 'online') renderDashboard();
    if (path === 'tasks') { renderDashboard(); renderTasks(); }
    if (path === 'messages') renderMessages();
    if (path === 'settings') renderSettings();
}

// ==================== TABS ====================

function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabId}"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // Populate dropdowns on tab switch
    if (tabId === 'tasks') populateChildDropdown('task-assign');
    if (tabId === 'messages') populateChildDropdown('msg-target');
}

function populateChildDropdown(selectId) {
    const select = document.getElementById(selectId);
    const children = getChildren();
    const current = select.value;
    select.innerHTML = '<option value="all">כל הילדים</option>' +
        children.map(c => `<option value="${c.username}">${esc(c.displayName)}</option>`).join('');
    if (current) select.value = current;
}

// ==================== HELPERS ====================

function getChildren() {
    return Object.values(familyData.users).filter(u => !u.isParent && !u.isAdmin);
}

function formatTime(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}h` : `${m} דק׳`;
}

function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'עכשיו';
    if (mins < 60) return `לפני ${mins} דק׳`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `לפני ${hrs} שע׳`;
    return `לפני ${Math.floor(hrs / 24)} ימים`;
}

// ==================== DASHBOARD ====================

function renderDashboard() {
    const children = getChildren();
    const container = document.getElementById('children-cards');

    container.innerHTML = children.map(child => {
        const online = familyData.online[child.username];
        const isOnline = online && online.online === true;
        const lastSeen = online?.lastSeen ? new Date(online.lastSeen).toLocaleString('he-IL') : '';
        const accuracy = child.questionsAnswered > 0 
            ? Math.round((child.correctAnswers / child.questionsAnswered) * 100) : 0;

        return `
        <div class="child-card ${isOnline ? 'online' : 'offline'}" onclick="openChildModal('${child.username}')">
            <div class="child-card-header">
                <span class="child-name">${esc(child.displayName)}</span>
                <span class="child-status-dot ${isOnline ? 'on' : 'off'}" title="${isOnline ? 'מחובר' : 'לא מחובר'}"></span>
            </div>
            <div class="child-card-body">
                <div class="child-stat">
                    <span class="stat-icon">⏱️</span>
                    <span class="stat-val">${formatTime(child.remainingTime)}</span>
                </div>
                <div class="child-stat">
                    <span class="stat-icon">💰</span>
                    <span class="stat-val">${child.coins || 0}</span>
                </div>
                <div class="child-stat">
                    <span class="stat-icon">⭐</span>
                    <span class="stat-val">רמה ${child.level || 1}</span>
                </div>
                <div class="child-stat">
                    <span class="stat-icon">🎯</span>
                    <span class="stat-val">${accuracy}%</span>
                </div>
            </div>
            <div class="child-card-footer">
                ${isOnline 
                    ? '<span class="status-text online-text">🟢 מחובר עכשיו</span>'
                    : `<span class="status-text offline-text">🔴 ${lastSeen ? 'נראה: ' + lastSeen : 'לא מחובר'}</span>`
                }
            </div>
        </div>`;
    }).join('');

    if (children.length === 0) {
        container.innerHTML = '<p class="empty-state">אין ילדים רשומים עדיין</p>';
    }

    // Pending approvals
    renderPendingApprovals();
}

function renderPendingApprovals() {
    const tasks = familyData.tasks || [];
    const pending = tasks.filter(t => t.status === 'awaiting_approval');
    const section = document.getElementById('pending-section');
    const list = document.getElementById('pending-list');

    if (pending.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    list.innerHTML = pending.map(t => {
        const child = familyData.users[t.completedBy];
        return `
        <div class="pending-card">
            <div class="pending-info">
                <strong>${esc(t.title)}</strong>
                <span>ע"י: ${esc(child?.displayName || t.completedBy)} | פרס: 💰 ${t.reward}</span>
            </div>
            <div class="pending-actions">
                <button class="btn btn-primary btn-small" onclick="approveTask('${t.id}')">✅</button>
                <button class="btn btn-danger btn-small" onclick="rejectTask('${t.id}')">❌</button>
            </div>
        </div>`;
    }).join('');
}

// ==================== CHILD MODAL ====================

let currentChildUsername = null;

function openChildModal(username) {
    currentChildUsername = username;
    const child = familyData.users[username];
    if (!child) return;

    const online = familyData.online[username];
    const isOnline = online && online.online === true;

    document.getElementById('child-modal-name').textContent = `${child.displayName} ${isOnline ? '🟢' : '🔴'}`;
    
    const stats = document.getElementById('child-modal-stats');
    stats.innerHTML = `
        <div class="stat-box"><span class="stat-icon-big">⏱️</span><span class="stat-value">${formatTime(child.remainingTime)}</span><span class="stat-label">זמן נותר</span></div>
        <div class="stat-box"><span class="stat-icon-big">💰</span><span class="stat-value">${child.coins || 0}</span><span class="stat-label">מטבעות</span></div>
        <div class="stat-box"><span class="stat-icon-big">⭐</span><span class="stat-value">${child.level || 1}</span><span class="stat-label">רמה</span></div>
        <div class="stat-box"><span class="stat-icon-big">🔥</span><span class="stat-value">${child.streak || 0}</span><span class="stat-label">ימי רצף</span></div>
        <div class="stat-box"><span class="stat-icon-big">❓</span><span class="stat-value">${child.questionsAnswered || 0}</span><span class="stat-label">שאלות</span></div>
        <div class="stat-box"><span class="stat-icon-big">✅</span><span class="stat-value">${child.correctAnswers || 0}</span><span class="stat-label">נכונות</span></div>
        <div class="stat-box"><span class="stat-icon-big">📋</span><span class="stat-value">${child.tasksCompletedCount || 0}</span><span class="stat-label">משימות</span></div>
        <div class="stat-box"><span class="stat-icon-big">🎮</span><span class="stat-value">${(child.ownedGames || []).length}</span><span class="stat-label">משחקים</span></div>
    `;

    document.getElementById('child-modal').classList.remove('hidden');
}

function closeChildModal() {
    document.getElementById('child-modal').classList.add('hidden');
    currentChildUsername = null;
}

async function childAddTime() {
    if (!currentChildUsername) return;
    const minutes = parseInt(document.getElementById('child-time-input').value) || 0;
    if (minutes <= 0) return;
    const child = familyData.users[currentChildUsername];
    const newTime = (child.remainingTime || 0) + (minutes * 60);
    await db.ref(`families/${familyId}/users/${currentChildUsername}/remainingTime`).set(newTime);
    showToast(`⏱️ נוספו ${minutes} דקות`, 'success');
}

async function childSetTime() {
    if (!currentChildUsername) return;
    const minutes = parseInt(document.getElementById('child-time-input').value) || 0;
    await db.ref(`families/${familyId}/users/${currentChildUsername}/remainingTime`).set(minutes * 60);
    showToast(`⏱️ הזמן נקבע ל-${minutes} דקות`, 'success');
}

async function childAddCoins() {
    if (!currentChildUsername) return;
    const amount = parseInt(document.getElementById('child-coins-input').value) || 0;
    if (amount <= 0) return;
    const child = familyData.users[currentChildUsername];
    const newCoins = (child.coins || 0) + amount;
    await db.ref(`families/${familyId}/users/${currentChildUsername}/coins`).set(newCoins);
    showToast(`💰 נוספו ${amount} מטבעות`, 'success');
}

async function childSetCoins() {
    if (!currentChildUsername) return;
    const amount = parseInt(document.getElementById('child-coins-input').value) || 0;
    await db.ref(`families/${familyId}/users/${currentChildUsername}/coins`).set(Math.max(0, amount));
    showToast(`💰 מטבעות נקבעו ל-${amount}`, 'success');
}

// ==================== TASKS ====================

function renderTasks() {
    const tasks = familyData.tasks || [];
    const list = document.getElementById('tasks-list');

    if (tasks.length === 0) {
        list.innerHTML = '<p class="empty-state">אין משימות עדיין</p>';
        return;
    }

    const statusIcons = {
        'pending': '⏳',
        'awaiting_approval': '🔔',
        'completed': '✅',
        'rejected': '❌'
    };
    const statusLabels = {
        'pending': 'ממתינה',
        'awaiting_approval': 'ממתינה לאישור',
        'completed': 'הושלמה',
        'rejected': 'נדחתה'
    };

    list.innerHTML = tasks.map(t => `
        <div class="task-card ${t.status}">
            <div class="task-card-header">
                <span class="task-status">${statusIcons[t.status] || '❓'} ${statusLabels[t.status] || t.status}</span>
                ${t.recurring && t.recurring !== 'none' ? `<span class="task-recurring">🔁 ${t.recurring === 'daily' ? 'יומי' : 'שבועי'}</span>` : ''}
            </div>
            <div class="task-card-body">
                <strong>${esc(t.title)}</strong>
                ${t.description ? `<p class="task-desc">${esc(t.description)}</p>` : ''}
                <div class="task-meta">
                    <span>💰 ${t.reward}</span>
                    <span>👤 ${t.assignedTo === 'all' ? 'כולם' : esc(familyData.users[t.assignedTo]?.displayName || t.assignedTo)}</span>
                    ${t.completedBy ? `<span>✔️ ${esc(familyData.users[t.completedBy]?.displayName || t.completedBy)}</span>` : ''}
                </div>
            </div>
            <div class="task-card-actions">
                ${t.status === 'awaiting_approval' ? `
                    <button class="btn btn-primary btn-small" onclick="approveTask('${t.id}')">✅ אשר</button>
                    <button class="btn btn-danger btn-small" onclick="rejectTask('${t.id}')">❌ דחה</button>
                ` : ''}
                <button class="btn btn-outline btn-small" onclick="deleteTask('${t.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function approveTask(taskId) {
    const tasks = familyData.tasks || [];
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return;
    const task = tasks[index];
    
    // Give reward to child
    if (task.completedBy) {
        const child = familyData.users[task.completedBy];
        if (child) {
            const newCoins = (child.coins || 0) + task.reward;
            const newTotalCoins = (child.totalCoinsEarned || 0) + task.reward;
            const newTasksCount = (child.tasksCompletedCount || 0) + 1;
            await db.ref(`families/${familyId}/users/${task.completedBy}`).update({
                coins: newCoins,
                totalCoinsEarned: newTotalCoins,
                tasksCompletedCount: newTasksCount
            });
        }
    }

    task.status = 'completed';
    task.approvedAt = new Date().toISOString();
    await db.ref(`families/${familyId}/tasks/${index}`).set(task);
    showToast('✅ משימה אושרה!', 'success');
}

async function rejectTask(taskId) {
    const tasks = familyData.tasks || [];
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return;
    
    tasks[index].status = 'rejected';
    tasks[index].rejectedAt = new Date().toISOString();
    await db.ref(`families/${familyId}/tasks/${index}`).set(tasks[index]);
    showToast('❌ משימה נדחתה', 'info');
}

async function deleteTask(taskId) {
    if (!confirm('למחוק את המשימה?')) return;
    const tasks = (familyData.tasks || []).filter(t => t.id !== taskId);
    await db.ref(`families/${familyId}/tasks`).set(tasks.length > 0 ? tasks : null);
    showToast('🗑️ משימה נמחקה', 'info');
}

function openNewTaskModal() {
    populateChildDropdown('task-assign');
    document.getElementById('new-task-modal').classList.remove('hidden');
}
function closeNewTaskModal() {
    document.getElementById('new-task-modal').classList.add('hidden');
}

async function createTask() {
    const title = document.getElementById('task-title').value.trim();
    if (!title) return showToast('נא להזין כותרת', 'error');

    const task = {
        id: `task_${Date.now()}`,
        title,
        description: document.getElementById('task-desc').value.trim(),
        reward: parseInt(document.getElementById('task-reward').value) || 50,
        assignedTo: document.getElementById('task-assign').value,
        recurring: document.getElementById('task-recurring').value,
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: parentUsername,
        completedAt: null,
        completedBy: null,
        approvedAt: null,
        parentNote: null
    };

    const tasks = familyData.tasks || [];
    tasks.push(task);
    await db.ref(`families/${familyId}/tasks`).set(tasks);
    
    closeNewTaskModal();
    document.getElementById('task-title').value = '';
    document.getElementById('task-desc').value = '';
    showToast('📋 משימה נוצרה!', 'success');
}

// ==================== MESSAGES ====================

function renderMessages() {
    const messages = familyData.messages || [];
    const list = document.getElementById('messages-list');

    if (messages.length === 0) {
        list.innerHTML = '<p class="empty-state">אין הודעות</p>';
        return;
    }

    list.innerHTML = messages.map(m => {
        const targetName = m.target === 'all' ? 'כולם' : esc(familyData.users[m.target]?.displayName || m.target);
        return `
        <div class="message-card">
            <div class="message-text">${esc(m.text)}</div>
            <div class="message-meta">
                <span>👤 ${targetName}</span>
                ${m.showOnLock ? '<span>🔒 מסך נעילה</span>' : ''}
                <span>${timeAgo(m.createdAt)}</span>
            </div>
            <button class="btn btn-outline btn-small" onclick="deleteMessage('${m.id}')">🗑️ מחק</button>
        </div>`;
    }).join('');
}

function openNewMsgModal() {
    populateChildDropdown('msg-target');
    document.getElementById('new-msg-modal').classList.remove('hidden');
}
function closeNewMsgModal() {
    document.getElementById('new-msg-modal').classList.add('hidden');
}

async function createMessage() {
    const text = document.getElementById('msg-text').value.trim();
    if (!text) return showToast('נא להזין טקסט', 'error');

    const expiryHours = parseInt(document.getElementById('msg-expiry').value) || 0;
    const msg = {
        id: `msg_${Date.now()}`,
        text,
        target: document.getElementById('msg-target').value,
        showOnLock: document.getElementById('msg-lock').checked,
        createdAt: new Date().toISOString(),
        expiresAt: expiryHours > 0 ? new Date(Date.now() + expiryHours * 3600000).toISOString() : null,
        createdBy: parentUsername
    };

    const messages = familyData.messages || [];
    messages.push(msg);
    await db.ref(`families/${familyId}/messages`).set(messages);

    closeNewMsgModal();
    document.getElementById('msg-text').value = '';
    showToast('📢 הודעה נשלחה!', 'success');
}

async function deleteMessage(msgId) {
    const messages = (familyData.messages || []).filter(m => m.id !== msgId);
    await db.ref(`families/${familyId}/messages`).set(messages.length > 0 ? messages : null);
    showToast('🗑️ הודעה נמחקה', 'info');
}

// ==================== SETTINGS ====================

function renderSettings() {
    const s = familyData.settings || {};
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('set-daily-time', Math.round((s.dailyFreeTime || 2100) / 60));
    setVal('set-coins-per-min', s.coinsPerMinute || 5);
    setVal('set-coins-per-answer', s.coinsPerCorrectAnswer || 10);
    setVal('set-streak-bonus', s.streakBonusCoins || 5);

    renderTimeWindows(s.timeWindows || []);

    document.getElementById('settings-family-id').textContent = familyId || '—';
}

async function saveSettings() {
    const settings = {
        ...familyData.settings,
        dailyFreeTime: parseInt(document.getElementById('set-daily-time').value) * 60,
        coinsPerMinute: parseInt(document.getElementById('set-coins-per-min').value),
        coinsPerCorrectAnswer: parseInt(document.getElementById('set-coins-per-answer').value),
        streakBonusCoins: parseInt(document.getElementById('set-streak-bonus').value),
        timeWindows: collectTimeWindows()
    };
    await db.ref(`families/${familyId}/settings`).set(settings);
    showToast('💾 הגדרות נשמרו!', 'success');
}

// Time windows
let _timeWindows = [];

function renderTimeWindows(windows) {
    _timeWindows = windows || [];
    const container = document.getElementById('time-windows-list');
    if (_timeWindows.length === 0) {
        container.innerHTML = '<p class="hint">אין הגבלה — ילדים יכולים להתחבר בכל שעה</p>';
        return;
    }
    container.innerHTML = _timeWindows.map((w, i) => `
        <div class="tw-row">
            <input type="time" class="tw-from" value="${w.from || ''}">
            <span>—</span>
            <input type="time" class="tw-to" value="${w.to || ''}">
            <button class="btn btn-danger btn-small" onclick="removeTimeWindow(${i})">✕</button>
        </div>
    `).join('');
}

function addTimeWindow() {
    _timeWindows.push({ from: '14:00', to: '21:00' });
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
        const to = row.querySelector('.tw-to')?.value;
        if (from && to) result.push({ from, to });
    });
    return result;
}

function copyFamilyId() {
    if (familyId) {
        navigator.clipboard.writeText(familyId).then(() => showToast('📋 קוד הועתק!', 'success'));
    }
}

// ==================== AUTO-LOGIN ON REFRESH ====================

window.addEventListener('DOMContentLoaded', () => {
    const savedFamily = sessionStorage.getItem('kidsscreen_familyId');
    const savedUser = sessionStorage.getItem('kidsscreen_username');
    if (savedFamily && savedUser) {
        familyId = savedFamily;
        parentUsername = savedUser;
        enterApp();
    }
});
