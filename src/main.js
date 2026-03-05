const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { exec } = require('child_process');
const fs = require('fs');

// ==================== PORTABLE PATHS ====================
function getAppPath() {
    if (app.isPackaged) return path.dirname(app.getPath('exe'));
    return path.join(__dirname, '..');
}

function getUnityDataPath() {
    return path.join(getAppPath(), 'data', 'users');
}

// ==================== UNITY FILE SYNC ====================
function syncToUnity(username, user) {
    try {
        const userPath = path.join(getUnityDataPath(), username);
        if (!fs.existsSync(userPath)) fs.mkdirSync(userPath, { recursive: true });
        fs.writeFileSync(path.join(userPath, 'money.txt'), String(user.coins || 0), 'utf8');
        fs.writeFileSync(path.join(userPath, 'item_spawn_order.txt'), (user.worldItems || []).join('\n'), 'utf8');
        fs.writeFileSync(path.join(userPath, 'purchase_orders.txt'), (user.ownedItems || []).join('\n'), 'utf8');
        return true;
    } catch (error) {
        console.error('Unity sync error:', error);
        return false;
    }
}

// ==================== STORE ====================
const store = new Store({
    name: 'kidscreen-platform-data',
    defaults: {
        users: {
            'admin': {
                username: 'admin',
                password: 'admin123',
                displayName: 'הורה',
                coins: 99999,
                remainingTime: 9999 * 60,
                lastLoginDate: null,
                isAdmin: true,
                isParent: true,
                ownedGames: [],
                ownedItems: [],
                worldItems: [],
                questionsAnswered: 0,
                correctAnswers: 0,
                challengesCompleted: [],
                currentWeek: 1,
                answeredQuestionsInWeek: [],
                completedWeeks: [],
                xp: 0,
                level: 1,
                streak: 0,
                lastStreakDate: null,
                unlockedAchievements: [],
                unlockedCustomAchievements: [],
                tasksCompletedCount: 0,
                consecutiveCorrect: 0,
                totalCoinsEarned: 0,
                weeklyStats: { weekStart: null, questionsAnswered: 0, coinsEarned: 0 }
            },
            'dodo': {
                username: 'dodo',
                password: 'dodohagever',
                displayName: 'דודו',
                coins: 100,
                remainingTime: 35 * 60,
                lastLoginDate: null,
                isAdmin: false,
                isParent: false,
                ownedGames: [],
                ownedItems: [],
                worldItems: [],
                questionsAnswered: 0,
                correctAnswers: 0,
                challengesCompleted: [],
                currentWeek: 1,
                answeredQuestionsInWeek: [],
                completedWeeks: [],
                xp: 0,
                level: 1,
                streak: 0,
                lastStreakDate: null,
                unlockedAchievements: [],
                unlockedCustomAchievements: [],
                tasksCompletedCount: 0,
                consecutiveCorrect: 0,
                totalCoinsEarned: 0,
                weeklyStats: { weekStart: null, questionsAnswered: 0, coinsEarned: 0 }
            },
            'naomi': {
                username: 'naomi',
                password: '123',
                displayName: 'נעמי',
                coins: 100,
                remainingTime: 35 * 60,
                lastLoginDate: null,
                isAdmin: false,
                isParent: false,
                ownedGames: [],
                ownedItems: [],
                worldItems: [],
                questionsAnswered: 0,
                correctAnswers: 0,
                challengesCompleted: [],
                currentWeek: 1,
                answeredQuestionsInWeek: [],
                completedWeeks: [],
                xp: 0,
                level: 1,
                streak: 0,
                lastStreakDate: null,
                unlockedAchievements: [],
                unlockedCustomAchievements: [],
                tasksCompletedCount: 0,
                consecutiveCorrect: 0,
                totalCoinsEarned: 0,
                weeklyStats: { weekStart: null, questionsAnswered: 0, coinsEarned: 0 }
            }
        },
        tasks: [],
        challenges: [],
        currentUser: null,
        settings: {
            dailyFreeTime: 35 * 60,
            coinsPerMinute: 5,
            coinsPerCorrectAnswer: 10,
            coinsPerReviewAnswer: 15,
            parentPin: '1234',
            timePurchaseEnabled: true,
            timeWindows: [],       // [{ from: 'HH:MM', to: 'HH:MM' }] — empty = no restriction
            streakQuotaPerDay: 1,
            streakBonusCoins: 5
        },
        customGames: [],
        customAchievements: []
    }
});

let mainWindow;
let lockWindow = null;
let blurHandler = null;
let gameGuardInterval = null;
const recentlyBlocked = new Set(); // debounce: game names blocked in last tick
let dicebearCache = {};

function generateAvatarDataUri(config) {
    if (!config) return null;
    const { style = 'adventurer', seed = 'default', bg } = config;
    const cacheKey = `${style}||${seed}`;
    if (dicebearCache[cacheKey]) return dicebearCache[cacheKey];
    try {
        const { createAvatar } = require('@dicebear/core');
        const collection = require('@dicebear/collection');
        const styleFunc = collection[style];
        if (!styleFunc) return null;
        const opts = { seed };
        if (bg) opts.backgroundColor = [bg];
        opts.backgroundType = ['solid'];
        const svgStr = createAvatar(styleFunc, opts).toString();
        const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
        dicebearCache[cacheKey] = dataUri;
        return dataUri;
    } catch (e) {
        console.error('DiceBear error:', style, seed, e.message);
        return null;
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        fullscreen: true,
        frame: false,
        skipTaskbar: false,
        backgroundColor: '#0a0a0a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../assets/icon.png')
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
    if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools();
    // Start in blocking mode (login screen)
    setBlockingMode(true);
}

function setBlockingMode(blocking) {
    if (!mainWindow) return;
    if (blocking) {
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        mainWindow.setSkipTaskbar(false);
        mainWindow.setMinimizable(false);
        if (!blurHandler) {
            blurHandler = () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus(); };
            mainWindow.on('blur', blurHandler);
        }
        // Remove close listener, re-add
        mainWindow.removeAllListeners('close');
        mainWindow.on('close', (e) => e.preventDefault());
        // Bring to front
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.setFullScreen(true);
    } else {
        mainWindow.setAlwaysOnTop(false);
        mainWindow.setMinimizable(true);
        if (blurHandler) {
            mainWindow.removeListener('blur', blurHandler);
            blurHandler = null;
        }
        // Still prevent close for non-parents
        mainWindow.removeAllListeners('close');
        mainWindow.on('close', (e) => e.preventDefault());
    }
}

// ==================== GAME GUARD ====================
function startGameGuard() {
    stopGameGuard();
    runGameGuardTick(); // immediate first tick — no 4s delay
    gameGuardInterval = setInterval(runGameGuardTick, 2000); // tighter poll
}

function stopGameGuard() {
    if (gameGuardInterval) { clearInterval(gameGuardInterval); gameGuardInterval = null; }
    recentlyBlocked.clear();
}

function runGameGuardTick() {
    const username = store.get('currentUser');
    if (!username) return stopGameGuard();
    const user = store.get(`users.${username}`);
    if (!user || user.isParent || user.isAdmin) return stopGameGuard();

    const settings = store.get('settings') || {};
    if (settings.gameGuardEnabled === false) return; // feature off

    const games = store.get('customGames') || [];
    // Only guard games that have a valid EXE path and are marked for guarding
    const guardedGames = games.filter(g => g.exePath && g.guarded !== false);
    if (guardedGames.length === 0) return;

    const ownedIds = user.ownedGames || [];
    const unauthorizedGames = guardedGames.filter(g => !ownedIds.includes(g.id));
    if (unauthorizedGames.length === 0) return;

    // Build map: lowercase process name → game object
    const watchMap = {};
    for (const g of unauthorizedGames) {
        const procName = path.basename(g.exePath).toLowerCase();
        watchMap[procName] = g;
    }

    exec('powershell -NoProfile -Command "Get-Process | Select-Object -Property Name,Id | ConvertTo-Csv -NoTypeInformation"',
        { timeout: 3000 },
        (err, stdout) => {
            if (err || !stdout) return;
            const lines = stdout.trim().split('\n').slice(1); // skip header
            for (const line of lines) {
                const parts = line.replace(/"/g, '').split(',');
                const procName = (parts[0] || '').trim().toLowerCase();
                const pid = parseInt((parts[1] || '').trim());
                const match = watchMap[procName + '.exe'] || watchMap[procName];
                if (!match || !pid) continue;
                if (recentlyBlocked.has(pid)) continue; // debounce by PID, not name
                recentlyBlocked.add(pid);
                setTimeout(() => recentlyBlocked.delete(pid), 3000);
                exec(`taskkill /F /PID ${pid}`, () => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('gameguard:blocked', {
                            gameName: match.name,
                            icon: match.icon || '🎮'
                        });
                        mainWindow.focus();
                    }
                });
            }
        }
    );
}

// ==================== SCREEN LOCK ====================
function createLockScreen() {
    if (lockWindow) return;
    lockWindow = new BrowserWindow({
        fullscreen: true,
        alwaysOnTop: true,
        frame: false,
        skipTaskbar: true,
        minimizable: false,
        maximizable: false,
        resizable: false,
        movable: false,
        focusable: true,
        backgroundColor: '#0a0a0a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    lockWindow.loadFile(path.join(__dirname, 'renderer/lock.html'));
    lockWindow.setAlwaysOnTop(true, 'screen-saver');
    lockWindow.on('close', (e) => e.preventDefault());
    lockWindow.on('blur', () => {
        if (lockWindow) {
            lockWindow.focus();
            lockWindow.setAlwaysOnTop(true, 'screen-saver');
        }
    });
}

function closeLockScreen() {
    if (lockWindow) {
        lockWindow.removeAllListeners('close');
        lockWindow.close();
        lockWindow = null;
    }
}

// ==================== APP LIFECYCLE ====================
app.whenReady().then(() => {
    createWindow();
    app.on('browser-window-focus', () => {
        if (lockWindow) lockWindow.focus();
    });
    // Emergency exit shortcut — force-quits the app unconditionally
    globalShortcut.register('Ctrl+Shift+Q', () => {
        if (lockWindow) lockWindow.removeAllListeners('close');
        if (mainWindow) mainWindow.removeAllListeners('close');
        app.exit(0);
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ==================== WINDOW CONTROLS ====================
ipcMain.handle('window:minimize', () => mainWindow.minimize());
ipcMain.handle('window:maximize', () => {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.handle('window:close', () => {
    const currentUser = store.get('currentUser');
    const user = currentUser ? store.get(`users.${currentUser}`) : null;
    if (user?.isParent || user?.isAdmin) {
        mainWindow.removeAllListeners('close');
        app.quit();
    }
    // Non-parents cannot close the app
});

ipcMain.handle('window:setBlocking', (event, blocking) => {
    setBlockingMode(blocking);
    return { success: true };
});

// ==================== TIME WINDOW HELPER ====================
function isTimeAllowed(settings) {
    const windows = settings.timeWindows;
    // New multi-window system
    if (windows && windows.length > 0) {
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        for (const w of windows) {
            const [fh, fm] = w.from.split(':').map(Number);
            const [th, tm] = w.to.split(':').map(Number);
            const from = fh * 60 + fm;
            const to   = th * 60 + tm;
            // Support overnight windows (e.g. 22:00–06:00)
            if (from < to ? (nowMins >= from && nowMins < to) : (nowMins >= from || nowMins < to)) return true;
        }
        return false;
    }
    // Legacy backward compat (allowedHoursStart/End)
    const start = settings.allowedHoursStart ?? 0;
    const end   = settings.allowedHoursEnd   ?? 24;
    if (end < 24 && start < end) {
        const nowH = new Date().getHours() + new Date().getMinutes() / 60;
        return nowH >= start && nowH < end;
    }
    return true; // no restriction
}

// ==================== USER MANAGEMENT ====================
ipcMain.handle('users:getAll', () => store.get('users'));
ipcMain.handle('users:getCurrent', () => store.get('currentUser'));

ipcMain.handle('users:login', (event, { username, password }) => {
    const users = store.get('users');
    if (users[username] && users[username].password === password) {
        const user = users[username];
        // Hours-block check for child accounts
        if (!user.isParent && !user.isAdmin) {
            const settings = store.get('settings');
            if (!isTimeAllowed(settings)) {
                const windows = settings.timeWindows;
                let msg = 'כניסה חסומה בשעה זו';
                if (windows && windows.length > 0) {
                    const parts = windows.map(w => `${w.from}–${w.to}`).join(', ');
                    msg = `כניסה מותרת רק בין: ${parts}`;
                }
                return { success: false, blocked: true, error: msg };
            }
        }
        const today = new Date().toDateString();
        if (user.lastLoginDate !== today && !user.isParent) {
            user.remainingTime = store.get('settings.dailyFreeTime');
            user.lastLoginDate = today;
            store.set(`users.${username}`, user);
        }
        store.set('currentUser', username);
        if (!user.isParent && !user.isAdmin) {
            startGameGuard();
        } else {
            stopGameGuard();
        }
        if (!user.isParent) logActivity(username, 'login', 'התחבר למערכת', '🔑');
        return { success: true, user };
    }
    return { success: false, error: 'שם משתמש או סיסמה שגויים' };
});

ipcMain.handle('users:register', (event, { username, password, displayName, parentUsername, parentPassword }) => {
    const users = store.get('users');
    if (users[username]) return { success: false, error: 'שם משתמש כבר קיים' };
    const parentUser = users[parentUsername];
    if (!parentUser || parentUser.password !== parentPassword || (!parentUser.isParent && !parentUser.isAdmin)) {
        return { success: false, error: 'פרטי ההורה שגויים או שאין הרשאת הורה' };
    }

    const newUser = {
        username, password,
        displayName: displayName || username,
        coins: 0,
        remainingTime: store.get('settings.dailyFreeTime'),
        lastLoginDate: new Date().toDateString(),
        isAdmin: false, isParent: false,
        ownedGames: [], ownedItems: [], worldItems: [],
        questionsAnswered: 0, correctAnswers: 0,
        challengesCompleted: [],
        currentWeek: 1, answeredQuestionsInWeek: [], completedWeeks: [],
        xp: 0, level: 1, streak: 0, lastStreakDate: null,
        unlockedAchievements: [], unlockedCustomAchievements: [], tasksCompletedCount: 0,
        consecutiveCorrect: 0, totalCoinsEarned: 0,
        weeklyStats: { weekStart: null, questionsAnswered: 0, coinsEarned: 0 }
    };
    store.set(`users.${username}`, newUser);
    store.set('currentUser', username);
    return { success: true, user: newUser };
});

ipcMain.handle('users:logout', () => {
    store.set('currentUser', null);
    stopGameGuard();
    return { success: true };
});

ipcMain.handle('users:update', (event, userData) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false };
    const user = store.get(`users.${currentUser}`);
    Object.assign(user, userData);
    store.set(`users.${currentUser}`, user);
    return { success: true, user };
});

ipcMain.handle('users:updateTime', (event, remainingTime) => {
    const currentUser = store.get('currentUser');
    if (currentUser) {
        store.set(`users.${currentUser}.remainingTime`, remainingTime);
        return { success: true };
    }
    return { success: false };
});

ipcMain.handle('users:addCoins', (event, amount) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false };
    const currentCoins = store.get(`users.${currentUser}.coins`) || 0;
    store.set(`users.${currentUser}.coins`, currentCoins + amount);
    return { success: true, newBalance: currentCoins + amount };
});

// ==================== TIME PURCHASE ====================
ipcMain.handle('time:purchase', (event, { minutes }) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false, error: 'לא מחובר' };
    const settings = store.get('settings');
    if (!settings.timePurchaseEnabled) return { success: false, error: 'רכישת זמן לא זמינה' };
    const user = store.get(`users.${currentUser}`);
    const cost = minutes * settings.coinsPerMinute;
    if (user.coins < cost) return { success: false, error: 'אין מספיק מטבעות', needed: cost, have: user.coins };
    user.coins -= cost;
    user.remainingTime = (user.remainingTime || 0) + minutes * 60;
    store.set(`users.${currentUser}`, user);
    logActivity(currentUser, 'time', `קנה ${minutes} דקות זמן מחשב`, '⏱️');
    addPurchaseHistory(currentUser, { type: 'time', name: `${minutes} דקות זמן מחשב`, price: cost, icon: '⏱️' });
    recordDailyStats(currentUser, { timeMinutes: minutes });
    return { success: true, user, addedSeconds: minutes * 60, cost };
});

ipcMain.handle('time:getPrice', () => {
    return { coinsPerMinute: store.get('settings.coinsPerMinute') };
});

// ==================== LOCK SCREEN IPC ====================
ipcMain.handle('lock:show', () => { createLockScreen(); return { success: true }; });

ipcMain.handle('lock:dismiss', (event, { pin }) => {
    if (pin === store.get('settings.parentPin')) { closeLockScreen(); return { success: true }; }
    return { success: false, error: 'קוד PIN שגוי' };
});

ipcMain.handle('lock:buyTime', (event, { minutes }) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false, error: 'לא מחובר' };
    const settings = store.get('settings');
    const user = store.get(`users.${currentUser}`);
    const cost = minutes * settings.coinsPerMinute;
    if (user.coins < cost) return { success: false, error: 'אין מספיק מטבעות' };
    user.coins -= cost;
    user.remainingTime += minutes * 60;
    store.set(`users.${currentUser}`, user);
    closeLockScreen();
    // Notify main window to resume timer
    if (mainWindow) mainWindow.webContents.send('lock:dismissed', user);
    return { success: true, user };
});

ipcMain.handle('lock:getUserInfo', () => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return null;
    const user = store.get(`users.${currentUser}`);
    return { coins: user.coins, coinsPerMinute: store.get('settings.coinsPerMinute'), displayName: user.displayName };
});

// ==================== TASKS SYSTEM ====================
function processRecurringTasks() {
    const tasks = store.get('tasks') || [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    let changed = false;
    for (const task of tasks) {
        if (!task.recurring || task.recurring === 'none') continue;
        if (task.status !== 'completed' && task.status !== 'rejected') continue;
        const doneDate = task.approvedAt || task.rejectedAt || task.completedAt;
        if (!doneDate) continue;
        const done = new Date(doneDate);
        let shouldRecreate = false;
        if (task.recurring === 'daily') {
            shouldRecreate = done.toISOString().split('T')[0] < today;
        } else if (task.recurring === 'weekly') {
            const msPerDay = 86400000;
            const daysSinceDone = Math.floor((now - done) / msPerDay);
            shouldRecreate = daysSinceDone >= 7;
        }
        if (shouldRecreate && !task._recreated) {
            const newTask = {
                id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                title: task.title,
                description: task.description,
                reward: task.reward,
                assignedTo: task.assignedTo,
                approvalCode: task.approvalCode,
                priority: task.priority || 'normal',
                recurring: task.recurring,
                deadline: null,
                parentNote: null,
                status: 'pending',
                createdAt: new Date().toISOString(),
                completedBy: null,
                completedAt: null,
                approvedAt: null,
                rejectedAt: null
            };
            tasks.push(newTask);
            task._recreated = true;
            changed = true;
        }
    }
    if (changed) store.set('tasks', tasks);
}

ipcMain.handle('tasks:getAll', () => {
    processRecurringTasks();
    return store.get('tasks') || [];
});

ipcMain.handle('tasks:getForUser', (event, username) => {
    processRecurringTasks();
    const tasks = store.get('tasks') || [];
    return tasks.filter(t => t.assignedTo === username || t.assignedTo === 'all');
});

ipcMain.handle('tasks:create', (event, taskData) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent) return { success: false, error: 'רק הורה יכול ליצור משימות' };
    const tasks = store.get('tasks') || [];
    const newTask = {
        id: `task_${Date.now()}`,
        title: taskData.title,
        description: taskData.description || '',
        reward: taskData.reward || 50,
        assignedTo: taskData.assignedTo || 'all',
        approvalCode: taskData.approvalCode || '',
        priority: taskData.priority || 'normal',
        recurring: taskData.recurring || 'none',
        deadline: taskData.deadline || null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: currentUser,
        completedAt: null, completedBy: null, approvedAt: null,
        parentNote: null
    };
    tasks.push(newTask);
    store.set('tasks', tasks);
    // Notify assigned user(s)
    const users = store.get('users');
    Object.keys(users).forEach(uname => {
        if (users[uname].isParent || users[uname].isAdmin) return;
        if (newTask.assignedTo !== 'all' && newTask.assignedTo !== uname) return;
        pushNotification(uname, { type: 'task_new', title: '📋 משימה חדשה!', body: `"${newTask.title}" — ${newTask.reward} 💰`, icon: '📋' });
    });
    return { success: true, task: newTask };
});

ipcMain.handle('tasks:requestComplete', (event, taskId) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false, error: 'לא מחובר' };
    const tasks = store.get('tasks') || [];
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return { success: false, error: 'משימה לא נמצאה' };
    if (tasks[index].status !== 'pending') return { success: false, error: 'המשימה כבר הושלמה או ממתינה לאישור' };
    tasks[index].status = 'awaiting_approval';
    tasks[index].completedBy = currentUser;
    tasks[index].completedAt = new Date().toISOString();
    store.set('tasks', tasks);
    return { success: true, task: tasks[index] };
});

ipcMain.handle('tasks:approve', (event, { taskId, pin }) => {
    const tasks = store.get('tasks') || [];
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return { success: false, error: 'משימה לא נמצאה' };
    if (tasks[index].status !== 'awaiting_approval') return { success: false, error: 'המשימה לא ממתינה לאישור' };
    if (pin !== tasks[index].approvalCode) return { success: false, error: 'קוד אישור שגוי' };
    const childUser = store.get(`users.${tasks[index].completedBy}`);
    if (childUser) {
        childUser.coins = (childUser.coins || 0) + tasks[index].reward;
        childUser.totalCoinsEarned = (childUser.totalCoinsEarned || 0) + tasks[index].reward;
        childUser.tasksCompletedCount = (childUser.tasksCompletedCount || 0) + 1;
        store.set(`users.${tasks[index].completedBy}`, childUser);
        addXP(tasks[index].completedBy, 25);
        checkAchievements(tasks[index].completedBy);
        checkCustomAchievements(tasks[index].completedBy);
    }
    tasks[index].status = 'completed';
    tasks[index].approvedAt = new Date().toISOString();
    store.set('tasks', tasks);
    if (childUser) {
        logActivity(tasks[index].completedBy, 'task', `השלים משימה: "${tasks[index].title}" (+${tasks[index].reward} 💰)`, '📋');
        recordDailyStats(tasks[index].completedBy, { coins: tasks[index].reward });
        pushNotification(tasks[index].completedBy, { type: 'task_approved', title: '✅ משימה אושרה!', body: `"${tasks[index].title}" — +${tasks[index].reward} 💰`, icon: '✅' });
    }
    return { success: true, task: tasks[index], newBalance: childUser?.coins };
});

ipcMain.handle('tasks:approveAdmin', (event, { taskId, note }) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false, error: 'אין הרשאת הורה' };
    const tasks = store.get('tasks') || [];
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return { success: false, error: 'משימה לא נמצאה' };
    if (tasks[index].status !== 'awaiting_approval') return { success: false, error: 'המשימה לא ממתינה לאישור' };
    const childUser = store.get(`users.${tasks[index].completedBy}`);
    if (childUser) {
        childUser.coins = (childUser.coins || 0) + tasks[index].reward;
        childUser.totalCoinsEarned = (childUser.totalCoinsEarned || 0) + tasks[index].reward;
        childUser.tasksCompletedCount = (childUser.tasksCompletedCount || 0) + 1;
        store.set(`users.${tasks[index].completedBy}`, childUser);
        addXP(tasks[index].completedBy, 25);
        checkAchievements(tasks[index].completedBy);
        checkCustomAchievements(tasks[index].completedBy);
    }
    tasks[index].status = 'completed';
    tasks[index].approvedAt = new Date().toISOString();
    if (note) tasks[index].parentNote = note;
    store.set('tasks', tasks);
    if (childUser) {
        logActivity(tasks[index].completedBy, 'task', `השלים משימה: "${tasks[index].title}" (+${tasks[index].reward} 💰)`, '📋');
        recordDailyStats(tasks[index].completedBy, { coins: tasks[index].reward });
        pushNotification(tasks[index].completedBy, { type: 'task_approved', title: '✅ משימה אושרה!', body: `"${tasks[index].title}" — +${tasks[index].reward} 💰${note ? ' — ' + note : ''}`, icon: '✅' });
    }
    return { success: true, task: tasks[index], newBalance: childUser?.coins };
});

ipcMain.handle('tasks:rejectAdmin', (event, { taskId, note }) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false, error: 'אין הרשאת הורה' };
    const tasks = store.get('tasks') || [];
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return { success: false, error: 'משימה לא נמצאה' };
    if (tasks[index].status !== 'awaiting_approval') return { success: false, error: 'המשימה לא ממתינה לאישור' };
    tasks[index].status = 'rejected';
    tasks[index].rejectedAt = new Date().toISOString();
    if (note) tasks[index].parentNote = note;
    store.set('tasks', tasks);
    logActivity(tasks[index].completedBy, 'task', `משימה "${tasks[index].title}" נדחתה${note ? ': ' + note : ''}`, '❌');
    pushNotification(tasks[index].completedBy, { type: 'task_rejected', title: '❌ משימה נדחתה', body: `"${tasks[index].title}"${note ? ' — ' + note : ''}`, icon: '❌' });
    return { success: true, task: tasks[index] };
});

ipcMain.handle('tasks:delete', (event, taskId) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent) return { success: false, error: 'רק הורה יכול למחוק משימות' };
    store.set('tasks', (store.get('tasks') || []).filter(t => t.id !== taskId));
    return { success: true };
});

ipcMain.handle('tasks:edit', (event, { taskId, data }) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent) return { success: false, error: 'רק הורה יכול לערוך משימות' };
    const tasks = store.get('tasks') || [];
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return { success: false, error: 'משימה לא נמצאה' };
    tasks[index] = { ...tasks[index], ...data };
    store.set('tasks', tasks);
    return { success: true, task: tasks[index] };
});

// ==================== NOTIFICATIONS ====================
function pushNotification(username, { type, title, body, icon }) {
    const notifs = store.get(`notifications.${username}`) || [];
    notifs.unshift({ id: `n_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, type, title, body, icon: icon || '🔔', read: false, createdAt: new Date().toISOString() });
    // keep max 50
    if (notifs.length > 50) notifs.length = 50;
    store.set(`notifications.${username}`, notifs);
}

ipcMain.handle('notifications:get', () => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return [];
    return store.get(`notifications.${currentUser}`) || [];
});

ipcMain.handle('notifications:markRead', (event, id) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return;
    const notifs = store.get(`notifications.${currentUser}`) || [];
    if (id === 'all') {
        notifs.forEach(n => n.read = true);
    } else {
        const n = notifs.find(x => x.id === id);
        if (n) n.read = true;
    }
    store.set(`notifications.${currentUser}`, notifs);
    return true;
});

ipcMain.handle('notifications:clear', () => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return;
    store.set(`notifications.${currentUser}`, []);
});

// ==================== BIRTHDAY ====================
ipcMain.handle('birthday:setDate', (event, { username, date }) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false, error: 'אין הרשאת הורה' };
    store.set(`users.${username}.birthday`, date || null);
    return { success: true };
});

ipcMain.handle('birthday:check', () => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { isBirthday: false };
    const user = store.get(`users.${currentUser}`);
    if (!user || user.isParent || !user.birthday) return { isBirthday: false };
    const today = new Date();
    const bday = new Date(user.birthday);
    const isBirthday = bday.getMonth() === today.getMonth() && bday.getDate() === today.getDate();
    if (!isBirthday) return { isBirthday: false };
    // Grant bonus once per year
    const lastBdayYear = user.lastBirthdayBonus;
    const thisYear = today.getFullYear().toString();
    if (lastBdayYear === thisYear) return { isBirthday: true, alreadyClaimed: true };
    const bonus = store.get('settings.birthdayBonus') || 100;
    user.coins = (user.coins || 0) + bonus;
    user.totalCoinsEarned = (user.totalCoinsEarned || 0) + bonus;
    user.lastBirthdayBonus = thisYear;
    store.set(`users.${currentUser}`, user);
    pushNotification(currentUser, { type: 'birthday', title: '🎂 יום הולדת שמח!', body: `קיבלת ${bonus} מטבעות בונוס!`, icon: '🎂' });
    logActivity(currentUser, 'birthday', `יום הולדת! קיבל ${bonus} מטבעות בונוס 🎂`, '🎂');
    return { isBirthday: true, bonusGranted: true, alreadyClaimed: false, bonus, user };
});

// ==================== MESSAGES ====================
ipcMain.handle('messages:getForUser', () => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return [];
    const dismissed = store.get(`dismissedMessages.${currentUser}`) || [];
    const all = store.get('messages') || [];
    const now = Date.now();
    return all.filter(m => {
        if (m.expiresAt && new Date(m.expiresAt).getTime() < now) return false;
        if (dismissed.includes(m.id)) return false;
        return m.target === 'all' || m.target === currentUser;
    });
});

ipcMain.handle('messages:getLockScreen', () => {
    const all = store.get('messages') || [];
    const now = Date.now();
    return all.filter(m => m.showOnLock && (!m.expiresAt || new Date(m.expiresAt).getTime() >= now));
});

ipcMain.handle('messages:create', (event, data) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false, error: 'אין הרשאת הורה' };
    const messages = store.get('messages') || [];
    const msg = {
        id: `msg_${Date.now()}`,
        text: data.text?.trim(),
        target: data.target || 'all',    // 'all' or username
        showOnLock: data.showOnLock || false,
        createdAt: new Date().toISOString(),
        expiresAt: data.expiryHours > 0
            ? new Date(Date.now() + data.expiryHours * 3600000).toISOString()
            : null,
        createdBy: currentUser
    };
    if (!msg.text) return { success: false, error: 'הודעה ריקה' };
    messages.push(msg);
    store.set('messages', messages);
    // Push notification to target users
    const users = store.get('users');
    Object.keys(users).forEach(uname => {
        if (users[uname].isParent || users[uname].isAdmin) return;
        if (msg.target !== 'all' && msg.target !== uname) return;
        pushNotification(uname, { type: 'message', title: '📢 הודעה חדשה מההורה', body: msg.text, icon: '📢' });
    });
    return { success: true, message: msg };
});

ipcMain.handle('messages:delete', (event, id) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false, error: 'אין הרשאת הורה' };
    store.set('messages', (store.get('messages') || []).filter(m => m.id !== id));
    return { success: true };
});

ipcMain.handle('messages:getAll', () => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return [];
    return store.get('messages') || [];
});

ipcMain.handle('messages:dismiss', (event, id) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return;
    const dismissed = store.get(`dismissedMessages.${currentUser}`) || [];
    if (!dismissed.includes(id)) { dismissed.push(id); store.set(`dismissedMessages.${currentUser}`, dismissed); }
    return true;
});

// ==================== CUSTOM GAMES ====================
ipcMain.handle('customGames:getAll', () => {
    const games = store.get('customGames') || [];
    const now = Date.now();
    // Auto-remove expired games
    const valid = games.filter(g => !g.expiresAt || new Date(g.expiresAt).getTime() > now);
    if (valid.length !== games.length) store.set('customGames', valid);
    return valid;
});

ipcMain.handle('customGames:add', (event, gameData) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent) return { success: false, error: 'רק הורה יכול להוסיף משחקים' };
    const games = store.get('customGames') || [];
    const newGame = {
        id: `game_${Date.now()}`,
        name: gameData.name, exePath: gameData.exePath,
        price: gameData.price || 100, icon: gameData.icon || '🎮',
        description: gameData.description || '',
        category: gameData.category || 'other',
        addedAt: new Date().toISOString(),
        expiresAt: gameData.expiryDays > 0
            ? new Date(Date.now() + gameData.expiryDays * 86400000).toISOString()
            : null
    };
    games.push(newGame);
    store.set('customGames', games);
    return { success: true, game: newGame };
});

ipcMain.handle('customGames:edit', (event, { gameId, data }) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent) return { success: false, error: 'רק הורה יכול לערוך משחקים' };
    const games = store.get('customGames') || [];
    const index = games.findIndex(g => g.id === gameId);
    if (index === -1) return { success: false, error: 'משחק לא נמצא' };
    const expiresAt = data.expiryDays > 0
        ? new Date(Date.now() + data.expiryDays * 86400000).toISOString()
        : null;
    games[index] = { ...games[index], ...data, expiresAt };
    store.set('customGames', games);
    return { success: true, game: games[index] };
});

ipcMain.handle('customGames:delete', (event, gameId) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent) return { success: false, error: 'רק הורה יכול למחוק משחקים' };
    store.set('customGames', (store.get('customGames') || []).filter(g => g.id !== gameId));
    return { success: true };
});

ipcMain.handle('customGames:purchase', (event, gameId) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false, error: 'לא מחובר' };
    const user = store.get(`users.${currentUser}`);
    const games = store.get('customGames') || [];
    const game = games.find(g => g.id === gameId);
    if (!game) return { success: false, error: 'משחק לא נמצא' };
    if (user.ownedGames?.includes(gameId)) return { success: false, error: 'המשחק כבר בבעלותך' };
    if (user.coins < game.price) return { success: false, error: 'אין מספיק מטבעות' };
    user.coins -= game.price;
    user.ownedGames = user.ownedGames || [];
    user.ownedGames.push(gameId);
    store.set(`users.${currentUser}`, user);
    logActivity(currentUser, 'shop', `קנה משחק "${game.name}"`, '🎮');
    addPurchaseHistory(currentUser, { type: 'game', name: game.name, price: game.price, icon: game.icon || '🎮' });
    return { success: true, user };
});

ipcMain.handle('customGames:launch', async (event, gameId) => {
    const currentUser = store.get('currentUser');
    const games = store.get('customGames') || [];
    const game = games.find(g => g.id === gameId);
    if (!game) return { success: false, error: 'משחק לא נמצא' };
    if (!game.exePath || !fs.existsSync(game.exePath)) return { success: false, error: 'קובץ המשחק לא נמצא' };

    if (currentUser) {
        // Flush any open session first
        const existing = store.get(`gameSessions.${currentUser}`);
        if (existing) {
            const elapsed = Math.floor((Date.now() - existing.startTime) / 60000);
            if (elapsed > 0) {
                const prevStats = store.get(`gameStats.${currentUser}`) || {};
                if (!prevStats[existing.gameId]) prevStats[existing.gameId] = { totalMinutes: 0, launchCount: 0 };
                prevStats[existing.gameId].totalMinutes = (prevStats[existing.gameId].totalMinutes || 0) + elapsed;
                store.set(`gameStats.${currentUser}`, prevStats);
            }
        }
        // Record new session
        store.set(`gameSessions.${currentUser}`, { gameId, startTime: Date.now() });
        // Update stats: lastPlayed + launchCount
        const stats = store.get(`gameStats.${currentUser}`) || {};
        if (!stats[gameId]) stats[gameId] = { totalMinutes: 0, launchCount: 0 };
        stats[gameId].lastPlayed = new Date().toISOString();
        stats[gameId].launchCount = (stats[gameId].launchCount || 0) + 1;
        store.set(`gameStats.${currentUser}`, stats);
    }

    try {
        await shell.openPath(game.exePath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('customGames:endSession', () => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { elapsed: 0 };
    const session = store.get(`gameSessions.${currentUser}`);
    if (!session) return { elapsed: 0 };
    const elapsed = Math.floor((Date.now() - session.startTime) / 60000);
    if (elapsed > 0) {
        const stats = store.get(`gameStats.${currentUser}`) || {};
        if (!stats[session.gameId]) stats[session.gameId] = { totalMinutes: 0, launchCount: 0 };
        stats[session.gameId].totalMinutes = (stats[session.gameId].totalMinutes || 0) + elapsed;
        store.set(`gameStats.${currentUser}`, stats);
    }
    store.delete(`gameSessions.${currentUser}`);
    return { elapsed };
});

ipcMain.handle('customGames:toggleFavorite', (event, gameId) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false };
    const user = store.get(`users.${currentUser}`);
    const favs = user?.favoriteGames || [];
    const idx = favs.indexOf(gameId);
    if (idx === -1) favs.push(gameId); else favs.splice(idx, 1);
    store.set(`users.${currentUser}.favoriteGames`, favs);
    return { success: true, favoriteGames: favs };
});

ipcMain.handle('customGames:getStats', (event, username) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    const target = (user?.isParent || user?.isAdmin) && username ? username : currentUser;
    if (!target) return {};
    return store.get(`gameStats.${target}`) || {};
});

// ==================== SHOP (WORLD ITEMS) ====================
ipcMain.handle('shop:getItems', () => getDefaultShopItems());

ipcMain.handle('shop:purchase', (event, { itemId, itemType }) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false, error: 'לא מחובר' };
    const user = store.get(`users.${currentUser}`);
    const items = getDefaultShopItems();
    const item = items[itemType]?.find(i => i.id === itemId);
    if (!item) return { success: false, error: 'פריט לא נמצא' };
    if (user.coins < item.price) return { success: false, error: 'אין מספיק מטבעות' };
    user.coins -= item.price;
    if (itemType === 'games') {
        if (!user.ownedGames.includes(itemId)) user.ownedGames.push(itemId);
    } else {
        if (!user.ownedItems.includes(itemId)) user.ownedItems.push(itemId);
    }
    store.set(`users.${currentUser}`, user);
    logActivity(currentUser, 'shop', `קנה "${item.name}" מהחנות`, '🛒');
    addPurchaseHistory(currentUser, { type: 'item', name: item.name, price: item.price, icon: '📦' });
    return { success: true, user };
});

ipcMain.handle('shop:getPurchaseHistory', () => {
    const username = store.get('currentUser');
    if (!username) return [];
    return (store.get(`users.${username}.purchaseHistory`) || []).slice(0, 200);
});

ipcMain.handle('shop:getSiblings', () => {
    const currentUser = store.get('currentUser');
    const users = store.get('users') || {};
    return Object.values(users)
        .filter(u => u.username !== currentUser && !u.isParent && !u.isAdmin)
        .map(u => ({ username: u.username, displayName: u.displayName, coins: u.coins || 0 }));
});

ipcMain.handle('shop:giftCoins', (event, { toUsername, amount }) => {
    const fromUsername = store.get('currentUser');
    if (!fromUsername) return { success: false, error: 'לא מחובר' };
    if (fromUsername === toUsername) return { success: false, error: 'לא ניתן לשלוח לעצמך' };
    const fromUser = store.get(`users.${fromUsername}`);
    const toUser = store.get(`users.${toUsername}`);
    if (!toUser) return { success: false, error: 'משתמש לא נמצא' };
    if (toUser.isParent || toUser.isAdmin) return { success: false, error: 'לא ניתן לשלוח להורה' };
    const amt = parseInt(amount);
    if (!amt || amt < 1) return { success: false, error: 'סכום לא תקין' };
    if ((fromUser.coins || 0) < amt) return { success: false, error: `אין מספיק מטבעות (יש לך ${fromUser.coins || 0})` };
    fromUser.coins -= amt;
    store.set(`users.${fromUsername}`, fromUser);
    toUser.coins = (toUser.coins || 0) + amt;
    toUser.totalCoinsEarned = (toUser.totalCoinsEarned || 0) + amt;
    store.set(`users.${toUsername}`, toUser);
    logActivity(fromUsername, 'shop', `שלח מתנה ${amt}💰 ל${toUser.displayName}`, '🎁');
    logActivity(toUsername, 'shop', `קיבל מתנה ${amt}💰 מ${fromUser.displayName}`, '🎁');
    return { success: true, user: store.get(`users.${fromUsername}`) };
});

// ==================== QUESTIONS ====================
ipcMain.handle('questions:getAll', () => {
    const defaults = getDefaultQuestions();
    const custom = store.get('customQuestions') || [];
    return [...defaults, ...custom];
});

ipcMain.handle('questions:getCustom', () => store.get('customQuestions') || []);

ipcMain.handle('questions:addCustom', (event, data) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false, error: 'אין הרשאת הורה' };
    if (!data.question?.trim()) return { success: false, error: 'חסר טקסט לשאלה' };
    if (!Array.isArray(data.options) || data.options.length < 2) return { success: false, error: 'נדרשות לפחות 2 תשובות' };
    if (typeof data.correctAnswer !== 'number') return { success: false, error: 'חסרה תשובה נכונה' };
    const custom = store.get('customQuestions') || [];
    const newQ = {
        id: `cq_${Date.now()}`,
        question: data.question.trim(),
        options: data.options.map(o => String(o).trim()),
        correctAnswer: data.correctAnswer,
        explanation: data.explanation?.trim() || null,
        subject: data.subject?.trim() || null,
        createdAt: new Date().toISOString(),
        createdBy: currentUser,
        isCustom: true
    };
    custom.push(newQ);
    store.set('customQuestions', custom);
    return { success: true, question: newQ };
});

ipcMain.handle('questions:editCustom', (event, { id, data }) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false, error: 'אין הרשאת הורה' };
    const custom = store.get('customQuestions') || [];
    const index = custom.findIndex(q => q.id === id);
    if (index === -1) return { success: false, error: 'שאלה לא נמצאה' };
    custom[index] = { ...custom[index], ...data, id: custom[index].id, isCustom: true };
    store.set('customQuestions', custom);
    return { success: true, question: custom[index] };
});

ipcMain.handle('questions:deleteCustom', (event, id) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false, error: 'אין הרשאת הורה' };
    store.set('customQuestions', (store.get('customQuestions') || []).filter(q => q.id !== id));
    return { success: true };
});

ipcMain.handle('questions:submitAnswer', (event, { questionId, answer, isReview }) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false };
    const questions = [...getDefaultQuestions(), ...(store.get('customQuestions') || [])];
    const question = questions.find(q => q.id === questionId);
    if (!question) return { success: false, error: 'שאלה לא נמצאה' };
    const isCorrect = question.correctAnswer === answer;
    const user = store.get(`users.${currentUser}`);
    user.questionsAnswered = (user.questionsAnswered || 0) + 1;
    const coinsReward = isReview ? 15 : 10;
    let xpGained = 0;
    if (isCorrect) {
        user.correctAnswers = (user.correctAnswers || 0) + 1;
        user.coins += coinsReward;
        user.totalCoinsEarned = (user.totalCoinsEarned || 0) + coinsReward;
        user.consecutiveCorrect = (user.consecutiveCorrect || 0) + 1;
        xpGained = isReview ? 15 : 10;
    } else {
        user.consecutiveCorrect = 0;
    }
    // Weekly stats
    resetWeeklyStatsIfNeeded(currentUser);
    const freshUser = store.get(`users.${currentUser}`);
    user.weeklyStats = freshUser.weeklyStats || { weekStart: null, questionsAnswered: 0, coinsEarned: 0 };
    user.weeklyStats.questionsAnswered = (user.weeklyStats.questionsAnswered || 0) + 1;
    if (isCorrect) user.weeklyStats.coinsEarned = (user.weeklyStats.coinsEarned || 0) + coinsReward;
    store.set(`users.${currentUser}`, user);
    recordDailyStats(currentUser, { questions: 1, correct: isCorrect ? 1 : 0, coins: isCorrect ? coinsReward : 0 });
    logActivity(currentUser, 'question', isCorrect ? `ענה נכון על שאלה (+${coinsReward} 💰)` : 'ענה לא נכון על שאלה', isCorrect ? '✅' : '❌');
    // Gamification: XP, Streak, Achievements
    let xpResult = null;
    if (isCorrect) {
        xpResult = addXP(currentUser, xpGained);
        updateStreak(currentUser);
    }
    const newAchievements = checkAchievements(currentUser);
    const newCustomAchievements = checkCustomAchievements(currentUser);
    const updatedUser = store.get(`users.${currentUser}`);
    return { 
        success: true, isCorrect, correctAnswer: question.correctAnswer, user: updatedUser,
        xpGained, xpResult, newAchievements, newCustomAchievements
    };
});

// ==================== CHALLENGES ====================
ipcMain.handle('challenges:getAll', () => store.get('challenges') || []);

ipcMain.handle('challenges:create', (event, challengeData) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent) return { success: false, error: 'אין הרשאת הורה' };
    const challenges = store.get('challenges') || [];
    challenges.push({ id: `challenge_${Date.now()}`, ...challengeData, createdAt: new Date().toISOString() });
    store.set('challenges', challenges);
    return { success: true };
});

ipcMain.handle('challenges:update', (event, { id, data }) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent) return { success: false, error: 'אין הרשאת הורה' };
    const challenges = store.get('challenges') || [];
    const index = challenges.findIndex(c => c.id === id);
    if (index === -1) return { success: false, error: 'אתגר לא נמצא' };
    challenges[index] = { ...challenges[index], ...data };
    store.set('challenges', challenges);
    return { success: true };
});

ipcMain.handle('challenges:delete', (event, challengeId) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent) return { success: false, error: 'אין הרשאת הורה' };
    store.set('challenges', (store.get('challenges') || []).filter(c => c.id !== challengeId));
    return { success: true };
});

ipcMain.handle('challenges:checkProgress', (event, challengeId) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false };
    const user = store.get(`users.${currentUser}`);
    const challenge = (store.get('challenges') || []).find(c => c.id === challengeId);
    if (!challenge) return { success: false };
    let progress = 0, target = challenge.target || 10;
    switch (challenge.type) {
        case 'quiz': progress = user.correctAnswers || 0; break;
        case 'earning': progress = user.coins || 0; break;
        default: progress = 0;
    }
    return { success: true, progress, target, completed: progress >= target };
});

ipcMain.handle('challenges:claim', (event, challengeId) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false };
    const user = store.get(`users.${currentUser}`);
    const challenge = (store.get('challenges') || []).find(c => c.id === challengeId);
    if (!challenge) return { success: false };
    if (user.challengesCompleted?.includes(challengeId)) return { success: false, error: 'כבר קיבלת' };
    user.coins = (user.coins || 0) + (challenge.reward || 0);
    user.challengesCompleted = user.challengesCompleted || [];
    user.challengesCompleted.push(challengeId);
    store.set(`users.${currentUser}`, user);
    return { success: true, user, reward: challenge.reward };
});

// ==================== GAMES ====================
ipcMain.handle('games:launch', async (event, gameId) => {
    const customGames = store.get('customGames') || [];
    const game = customGames.find(g => g.id === gameId);
    if (game?.exePath && fs.existsSync(game.exePath)) {
        try { await shell.openPath(game.exePath); return { success: true }; }
        catch (e) { return { success: false, error: e.message }; }
    }
    return { success: false, error: 'משחק לא נמצא' };
});

ipcMain.handle('games:launchWorld', async (event, username) => {
    const unityPath = path.join(getAppPath(), 'unity');
    const worldPaths = {
        'dodo': path.join(unityPath, 'dodo_world', 'user1', 'ילש םלועה.exe'),
        'naomi': path.join(unityPath, 'naomi_world', 'user2', 'ילש םלועה.exe')
    };
    const worldPath = worldPaths[username];
    if (!worldPath || !fs.existsSync(worldPath)) return { success: false, error: 'העולם לא נמצא' };
    try {
        const user = store.get(`users.${username}`);
        if (user) syncToUnity(username, user);
        await shell.openPath(worldPath);
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('games:stop', (event, processName) => {
    return new Promise((resolve) => {
        exec(`taskkill /F /IM "${processName}"`, (error) => resolve({ success: !error }));
    });
});

// ==================== WORLD ITEMS ====================
ipcMain.handle('world:getItems', () => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false };
    const user = store.get(`users.${currentUser}`);
    return { success: true, worldItems: user.worldItems || [], ownedItems: user.ownedItems || [] };
});

ipcMain.handle('world:addItem', (event, itemId) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false };
    const user = store.get(`users.${currentUser}`);
    if (!user.ownedItems?.includes(itemId)) return { success: false, error: 'אין לך את הפריט' };
    user.worldItems = user.worldItems || [];
    user.worldItems.push(itemId);
    store.set(`users.${currentUser}`, user);
    syncToUnity(currentUser, user);
    return { success: true, worldItems: user.worldItems };
});

ipcMain.handle('world:removeItem', (event, index) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false };
    const user = store.get(`users.${currentUser}`);
    if (!user.worldItems || index < 0 || index >= user.worldItems.length) return { success: false };
    user.worldItems.splice(index, 1);
    store.set(`users.${currentUser}`, user);
    syncToUnity(currentUser, user);
    return { success: true, worldItems: user.worldItems };
});

ipcMain.handle('world:clearItems', () => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false };
    const user = store.get(`users.${currentUser}`);
    user.worldItems = [];
    store.set(`users.${currentUser}`, user);
    syncToUnity(currentUser, user);
    return { success: true, worldItems: [] };
});

ipcMain.handle('world:reorderItems', (event, newOrder) => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false };
    const user = store.get(`users.${currentUser}`);
    user.worldItems = newOrder;
    store.set(`users.${currentUser}`, user);
    syncToUnity(currentUser, user);
    return { success: true, worldItems: user.worldItems };
});

ipcMain.handle('world:sync', () => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { success: false };
    const user = store.get(`users.${currentUser}`);
    return { success: syncToUnity(currentUser, user) };
});

// ==================== DIALOGS ====================
ipcMain.handle('dialog:selectShortcut', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Programs', extensions: ['exe', 'lnk', 'url', 'bat'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    return result.canceled ? null : result.filePaths[0];
});

// ==================== SETTINGS ====================
ipcMain.handle('settings:get', () => store.get('settings'));
ipcMain.handle('settings:set', (event, newSettings) => {
    store.set('settings', { ...store.get('settings'), ...newSettings });
    return { success: true };
});
ipcMain.handle('settings:verifyPin', (event, pin) => {
    return { success: pin === store.get('settings.parentPin') };
});

// ==================== INITIAL SETUP (Onboarding) ====================
ipcMain.handle('setup:initialSetup', (event, data) => {
    const { parentDisplayName, parentUsername, parentPassword, children, difficulty, parentPin, dailyFreeTime } = data;
    const { hashPassword } = require('./main/helpers');
    const { createDefaultUser } = require('./main/store');

    // Create parent account
    const parentUser = createDefaultUser(
        parentUsername,
        hashPassword(parentPassword),
        parentDisplayName,
        { coins: 99999, remainingTime: 9999 * 60, isAdmin: true, isParent: true }
    );
    const users = { [parentUsername]: parentUser };

    // Create child accounts
    const settingsDailyFree = (dailyFreeTime || 30) * 60;
    for (const child of (children || [])) {
        if (!child.username || !child.password) continue;
        users[child.username] = createDefaultUser(
            child.username,
            hashPassword(child.password),
            child.displayName || child.username,
            { remainingTime: settingsDailyFree }
        );
    }

    store.set('users', users);

    // Apply settings
    const DIFFICULTY_PRESETS = {
        easy: { coinsPerCorrectAnswer: 4, coinsPerReviewAnswer: 6, xpPerQuestion: 6, xpPerReviewQuestion: 8, dailyFreeTime: 45 * 60, coinsPerMinute: 10, streakBonusCoins: 25 },
        medium: { coinsPerCorrectAnswer: 2, coinsPerReviewAnswer: 3, xpPerQuestion: 4, xpPerReviewQuestion: 6, dailyFreeTime: 30 * 60, coinsPerMinute: 20, streakBonusCoins: 15 },
        hard: { coinsPerCorrectAnswer: 1, coinsPerReviewAnswer: 2, xpPerQuestion: 3, xpPerReviewQuestion: 5, dailyFreeTime: 20 * 60, coinsPerMinute: 40, streakBonusCoins: 8 }
    };
    const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.medium;
    const currentSettings = store.get('settings');
    store.set('settings', {
        ...currentSettings,
        ...preset,
        difficulty: difficulty || 'medium',
        parentPin: parentPin || '1234',
        dailyFreeTime: settingsDailyFree,
        onboardingCompleted: true
    });

    // Update children remaining time with final dailyFreeTime
    const finalDailyFree = store.get('settings.dailyFreeTime');
    for (const child of (children || [])) {
        if (!child.username) continue;
        store.set(`users.${child.username}.remainingTime`, finalDailyFree);
    }

    // Auto-login as parent
    store.set('currentUser', parentUsername);
    return { success: true, user: store.get(`users.${parentUsername}`) };
});

ipcMain.handle('setup:isFirstRun', () => {
    const users = store.get('users') || {};
    return !Object.values(users).some(u => u.isAdmin || u.isParent);
});

ipcMain.handle('setup:registerAdmin', (event, { username, password, parentPin }) => {
    const { hashPassword } = require('./main/helpers');
    const { createDefaultUser } = require('./main/store');
    const users = store.get('users') || {};

    // Only one admin per machine
    const adminExists = Object.values(users).some(u => u.isAdmin || u.isParent);
    if (adminExists) return { success: false, error: 'כבר קיים חשבון מנהל במחשב זה' };

    if (users[username]) return { success: false, error: 'שם משתמש כבר קיים' };
    if (!username || /\s/.test(username)) return { success: false, error: 'שם משתמש לא יכול להכיל רווחים' };
    if (!password || password.length < 3) return { success: false, error: 'סיסמה חייבת להיות לפחות 3 תווים' };
    if (!parentPin || !/^\d{4}$/.test(parentPin)) return { success: false, error: 'קוד הורים חייב להיות 4 ספרות בדיוק' };

    const adminUser = createDefaultUser(username, hashPassword(password), username, {
        coins: 99999, remainingTime: 9999 * 60, isAdmin: true, isParent: true
    });
    store.set(`users.${username}`, adminUser);
    store.set('settings.parentPin', parentPin);
    store.set('settings.onboardingCompleted', false);
    store.set('currentUser', username);
    return { success: true, user: adminUser };
});

// ==================== ADMIN / PARENT ====================
ipcMain.handle('admin:isAdmin', () => {
    const currentUser = store.get('currentUser');
    if (!currentUser) return false;
    const user = store.get(`users.${currentUser}`);
    return user?.isParent === true || user?.isAdmin === true;
});

ipcMain.handle('admin:getAllUsersOverview', () => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false };
    const users = store.get('users') || {};
    const tasks = store.get('tasks') || [];
    const overview = Object.values(users).filter(u => !u.isParent && !u.isAdmin).map(u => {
        const userTasks = tasks.filter(t => t.assignedTo === u.username || t.assignedTo === 'all');
        const completedTasks = userTasks.filter(t => t.status === 'completed' && t.completedBy === u.username);
        return {
            username: u.username, displayName: u.displayName,
            coins: u.coins || 0, remainingTime: u.remainingTime || 0,
            totalQuestionsAnswered: u.questionsAnswered || 0,
            totalCorrect: u.correctAnswers || 0,
            totalWrong: (u.questionsAnswered || 0) - (u.correctAnswers || 0),
            ownedGames: (u.ownedGames || []).length, ownedItems: (u.ownedItems || []).length,
            tasksCompleted: completedTasks.length, totalTasks: userTasks.length,
            lastLoginDate: u.lastLoginDate || 'אף פעם'
        };
    });
    return { success: true, users: overview };
});

ipcMain.handle('admin:giveCoins', (event, { username, amount }) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false };
    const target = store.get(`users.${username}`);
    if (!target) return { success: false, error: 'משתמש לא נמצא' };
    const newCoins = Math.max(0, (target.coins || 0) + amount);
    store.set(`users.${username}.coins`, newCoins);
    return { success: true, newBalance: newCoins };
});

ipcMain.handle('admin:setCoins', (event, { username, amount }) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false };
    const target = store.get(`users.${username}`);
    if (!target) return { success: false, error: 'משתמש לא נמצא' };
    const newCoins = Math.max(0, amount);
    store.set(`users.${username}.coins`, newCoins);
    return { success: true, newBalance: newCoins };
});

ipcMain.handle('admin:giveTime', (event, { username, minutes }) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false };
    const target = store.get(`users.${username}`);
    if (!target) return { success: false };
    const newTime = Math.max(0, (target.remainingTime || 0) + (minutes * 60));
    store.set(`users.${username}.remainingTime`, newTime);
    return { success: true, newTime };
});

ipcMain.handle('admin:setDailyTime', (event, { username, minutes }) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false };
    store.set(`users.${username}.remainingTime`, minutes * 60);
    return { success: true };
});

ipcMain.handle('admin:resetUserProgress', (event, { username, what } = {}) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false };
    if (what === 'coins' || what === 'all') {
        store.set(`users.${username}.coins`, 0);
        store.set(`users.${username}.totalCoinsEarned`, 0);
    }
    if (what === 'questions' || what === 'all') {
        store.set(`users.${username}.questionsAnswered`, 0);
        store.set(`users.${username}.correctAnswers`, 0);
        store.set(`users.${username}.consecutiveCorrect`, 0);
        store.set(`users.${username}.weeklyStats`, { weekStart: null, questionsAnswered: 0, coinsEarned: 0 });
    }
    if (what === 'all') {
        store.set(`users.${username}.xp`, 0);
        store.set(`users.${username}.level`, 1);
        store.set(`users.${username}.streak`, 0);
        store.set(`users.${username}.lastStreakDate`, null);
        store.set(`users.${username}.tasksCompletedCount`, 0);
        store.set(`users.${username}.unlockedAchievements`, []);
        store.set(`users.${username}.unlockedCustomAchievements`, []);
        store.set(`users.${username}.dailyHistory`, {});
    }
    logActivity(username, 'login', `אדמין איפס נתוני "${what}"`, '🔄');
    return { success: true };
});

ipcMain.handle('admin:deleteUser', (event, username) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false };
    if (username === 'admin') return { success: false, error: 'לא ניתן למחוק את ההורה' };
    const users = store.get('users') || {};
    delete users[username];
    store.set('users', users);
    return { success: true };
});

// ==================== GAMIFICATION SYSTEM ====================

// XP & Levels configuration
const LEVELS = [
    { level: 1, xpRequired: 0, title: 'מתחיל', badge: '🌱' },
    { level: 2, xpRequired: 100, title: 'לומד', badge: '📗' },
    { level: 3, xpRequired: 250, title: 'חרוץ', badge: '⭐' },
    { level: 4, xpRequired: 500, title: 'מצטיין', badge: '🌟' },
    { level: 5, xpRequired: 800, title: 'חכם', badge: '🧠' },
    { level: 6, xpRequired: 1200, title: 'מומחה', badge: '💎' },
    { level: 7, xpRequired: 1800, title: 'אלוף', badge: '🏆' },
    { level: 8, xpRequired: 2500, title: 'אגדה', badge: '👑' },
    { level: 9, xpRequired: 3500, title: 'שליט', badge: '🔱' },
    { level: 10, xpRequired: 5000, title: 'אלוף העולם', badge: '🌍' },
];

// Achievements definitions
const ACHIEVEMENTS = [
    // Questions milestones
    { id: 'q_10', title: 'סקרן', desc: 'ענה על 10 שאלות', icon: '❓', check: u => (u.questionsAnswered || 0) >= 10 },
    { id: 'q_50', title: 'בקיא', desc: 'ענה על 50 שאלות', icon: '📚', check: u => (u.questionsAnswered || 0) >= 50 },
    { id: 'q_100', title: 'תלמיד חכם', desc: 'ענה על 100 שאלות', icon: '🎓', check: u => (u.questionsAnswered || 0) >= 100 },
    { id: 'q_250', title: 'חכם בינה', desc: 'ענה על 250 שאלות', icon: '🧠', check: u => (u.questionsAnswered || 0) >= 250 },
    { id: 'q_500', title: 'גאון', desc: 'ענה על 500 שאלות', icon: '🌟', check: u => (u.questionsAnswered || 0) >= 500 },
    // Correct answers
    { id: 'c_10', title: 'מדויק', desc: '10 תשובות נכונות', icon: '✅', check: u => (u.correctAnswers || 0) >= 10 },
    { id: 'c_50', title: 'דייקן', desc: '50 תשובות נכונות', icon: '🎯', check: u => (u.correctAnswers || 0) >= 50 },
    { id: 'c_100', title: 'אלוף הדיוק', desc: '100 תשובות נכונות', icon: '💯', check: u => (u.correctAnswers || 0) >= 100 },
    // Consecutive correct answers
    { id: 'cc_5', title: 'רצף חם', desc: '5 תשובות נכונות ברצף', icon: '🔥', check: u => (u.consecutiveCorrect || 0) >= 5 },
    { id: 'cc_10', title: 'בלתי ניתן לעצירה', desc: '10 תשובות נכונות ברצף', icon: '⚡', check: u => (u.consecutiveCorrect || 0) >= 10 },
    { id: 'cc_20', title: 'מושלם', desc: '20 תשובות נכונות ברצף', icon: '💫', check: u => (u.consecutiveCorrect || 0) >= 20 },
    // Tasks milestones
    { id: 't_5', title: 'עוזר', desc: 'השלם 5 משימות', icon: '📋', check: u => (u.tasksCompletedCount || 0) >= 5 },
    { id: 't_15', title: 'חרוץ', desc: 'השלם 15 משימות', icon: '💪', check: u => (u.tasksCompletedCount || 0) >= 15 },
    { id: 't_30', title: 'עובד כפיים', desc: 'השלם 30 משימות', icon: '🏅', check: u => (u.tasksCompletedCount || 0) >= 30 },
    // Streak milestones
    { id: 's_3', title: 'עקבי', desc: '3 ימי רצף ברצף', icon: '🔥', check: u => (u.streak || 0) >= 3 },
    { id: 's_7', title: 'שבוע חם', desc: 'שבוע רצף יומי ברצף', icon: '🔥', check: u => (u.streak || 0) >= 7 },
    { id: 's_14', title: 'להבה', desc: '14 ימי רצף ברצף', icon: '🔥', check: u => (u.streak || 0) >= 14 },
    { id: 's_30', title: 'אש בלתי כבה', desc: '30 ימים Streak ברצף', icon: '🔥', check: u => (u.streak || 0) >= 30 },
    // Coins earned
    { id: 'e_500', title: 'חוסך קטן', desc: 'צבר 500 מטבעות סה"כ', icon: '💰', check: u => (u.totalCoinsEarned || 0) >= 500 },
    { id: 'e_2000', title: 'עשיר', desc: 'צבר 2000 מטבעות סה"כ', icon: '💎', check: u => (u.totalCoinsEarned || 0) >= 2000 },
    { id: 'e_5000', title: 'מיליונר', desc: 'צבר 5000 מטבעות סה"כ', icon: '👑', check: u => (u.totalCoinsEarned || 0) >= 5000 },
    // Level milestones
    { id: 'l_3', title: 'מתקדם', desc: 'הגע לדרגה 3', icon: '⭐', check: u => (u.level || 1) >= 3 },
    { id: 'l_5', title: 'מקצוען', desc: 'הגע לדרגה 5', icon: '🏆', check: u => (u.level || 1) >= 5 },
    { id: 'l_8', title: 'אגדה חיה', desc: 'הגע לדרגה 8', icon: '👑', check: u => (u.level || 1) >= 8 },
    { id: 'l_10', title: 'שליט עליון', desc: 'הגע לדרגה 10', icon: '🌍', check: u => (u.level || 1) >= 10 },
    // Games purchased
    { id: 'g_1', title: 'גיימר', desc: 'קנה משחק ראשון', icon: '🎮', check: u => (u.ownedGames || []).length >= 1 },
    { id: 'g_5', title: 'גיימר מושבע', desc: 'קנה 5 משחקים', icon: '🕹️', check: u => (u.ownedGames || []).length >= 5 },
];

function getLevelForXP(xp) {
    let result = LEVELS[0];
    for (const lvl of LEVELS) {
        if (xp >= lvl.xpRequired) result = lvl;
        else break;
    }
    return result;
}

function getNextLevel(currentLevel) {
    return LEVELS.find(l => l.level === currentLevel + 1) || null;
}

function addXP(username, amount) {
    const user = store.get(`users.${username}`);
    if (!user) return null;
    const oldLevel = user.level || 1;
    user.xp = (user.xp || 0) + amount;
    const newLevelData = getLevelForXP(user.xp);
    user.level = newLevelData.level;
    store.set(`users.${username}`, user);
    const leveledUp = newLevelData.level > oldLevel;
    if (leveledUp) {
        pushNotification(username, { type: 'levelup', title: '⭐ עלית דרגה!', body: `דרגה ${newLevelData.level} — ${newLevelData.title}`, icon: newLevelData.badge || '⭐' });
    }
    return { xp: user.xp, level: user.level, leveledUp, levelData: newLevelData };
}

function updateStreak(username) {
    const user = store.get(`users.${username}`);
    if (!user) return;
    const settings = store.get('settings');
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (user.lastStreakDate === today) return; // Already counted today
    if (user.lastStreakDate === yesterday) {
        user.streak = (user.streak || 0) + 1;
    } else if (user.lastStreakDate !== today) {
        user.streak = 1; // Reset streak
    }
    user.lastStreakDate = today;
    // Award streak bonus coins
    const bonusCoins = settings.streakBonusCoins || 0;
    if (bonusCoins > 0 && user.streak > 1) {
        user.coins = (user.coins || 0) + bonusCoins;
        user.totalCoinsEarned = (user.totalCoinsEarned || 0) + bonusCoins;
        logActivity(username, 'login', `בונוס רצף יום ${user.streak} (+${bonusCoins} 💰)`, '🔥');
    }
    store.set(`users.${username}`, user);
}

function checkAchievements(username) {
    const user = store.get(`users.${username}`);
    if (!user) return [];
    const unlocked = user.unlockedAchievements || [];
    const newAchievements = [];
    for (const ach of ACHIEVEMENTS) {
        if (!unlocked.includes(ach.id) && ach.check(user)) {
            unlocked.push(ach.id);
            newAchievements.push({ id: ach.id, title: ach.title, desc: ach.desc, icon: ach.icon });
        }
    }
    if (newAchievements.length > 0) {
        user.unlockedAchievements = unlocked;
        store.set(`users.${username}`, user);
        newAchievements.forEach(a => pushNotification(username, { type: 'achievement', title: '🏅 הישג חדש!', body: `${a.icon} ${a.title} — ${a.desc}`, icon: a.icon }));
    }
    return newAchievements;
}

function checkCustomAchievements(username) {
    const user = store.get(`users.${username}`);
    if (!user) return [];
    const customAchs = store.get('customAchievements') || [];
    const unlockedIds = user.unlockedCustomAchievements || [];
    const newlyUnlocked = [];

    for (const ach of customAchs) {
        if (!ach.active) continue;
        if (ach.assignedTo !== 'all' && ach.assignedTo !== username) continue;
        if (unlockedIds.includes(ach.id)) continue;

        let meets = false;
        switch (ach.goalType) {
            case 'questions':    meets = (user.questionsAnswered || 0) >= ach.goalValue; break;
            case 'correct':      meets = (user.correctAnswers || 0) >= ach.goalValue; break;
            case 'consecutive':  meets = (user.consecutiveCorrect || 0) >= ach.goalValue; break;
            case 'tasks':        meets = (user.tasksCompletedCount || 0) >= ach.goalValue; break;
            case 'streak':       meets = (user.streak || 0) >= ach.goalValue; break;
            case 'xp':           meets = (user.xp || 0) >= ach.goalValue; break;
            case 'level':        meets = (user.level || 1) >= ach.goalValue; break;
            case 'coins_earned': meets = (user.totalCoinsEarned || 0) >= ach.goalValue; break;
        }

        if (meets) {
            unlockedIds.push(ach.id);
            user.coins = (user.coins || 0) + (ach.coinReward || 0);
            user.totalCoinsEarned = (user.totalCoinsEarned || 0) + (ach.coinReward || 0);
            newlyUnlocked.push({ id: ach.id, title: ach.title, desc: ach.desc, icon: ach.icon, coinReward: ach.coinReward });
        }
    }

    if (newlyUnlocked.length > 0) {
        user.unlockedCustomAchievements = unlockedIds;
        store.set(`users.${username}`, user);
        newlyUnlocked.forEach(a => pushNotification(username, { type: 'achievement', title: '🎯 פרס חדש!', body: `${a.icon} ${a.title}${a.coinReward ? ' +' + a.coinReward + ' 💰' : ''}`, icon: a.icon }));
    }
    return newlyUnlocked;
}

// Custom Achievements IPC
ipcMain.handle('customAchievements:getAll', () => {
    return store.get('customAchievements') || [];
});

ipcMain.handle('customAchievements:create', (event, data) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false, error: 'אין הרשאת הורה' };
    if (!data.title || !data.goalType || !data.goalValue) return { success: false, error: 'נתונים חסרים' };
    const achs = store.get('customAchievements') || [];
    const newAch = {
        id: `custom_${Date.now()}`,
        title: data.title,
        desc: data.desc || '',
        icon: data.icon || '🎯',
        goalType: data.goalType,
        goalValue: Number(data.goalValue),
        coinReward: Number(data.coinReward) || 0,
        assignedTo: data.assignedTo || 'all',
        active: true,
        createdAt: new Date().toISOString()
    };
    achs.push(newAch);
    store.set('customAchievements', achs);
    return { success: true, achievement: newAch };
});

ipcMain.handle('customAchievements:delete', (event, id) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false, error: 'אין הרשאת הורה' };
    store.set('customAchievements', (store.get('customAchievements') || []).filter(a => a.id !== id));
    return { success: true };
});

ipcMain.handle('customAchievements:toggle', (event, id) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false, error: 'אין הרשאת הורה' };
    const achs = store.get('customAchievements') || [];
    const idx = achs.findIndex(a => a.id === id);
    if (idx < 0) return { success: false };
    achs[idx].active = !achs[idx].active;
    store.set('customAchievements', achs);
    return { success: true, active: achs[idx].active };
});

ipcMain.handle('customAchievements:getProgress', () => {
    // Returns each custom achievement + which users have unlocked it
    const achs = store.get('customAchievements') || [];
    const users = store.get('users') || {};
    const children = Object.values(users).filter(u => !u.isParent && !u.isAdmin);
    return achs.map(ach => ({
        ...ach,
        unlockedBy: children
            .filter(u => (u.unlockedCustomAchievements || []).includes(ach.id))
            .map(u => ({ username: u.username, displayName: u.displayName }))
    }));
});

// Game Guard IPC
ipcMain.handle('gameguard:setGameGuarded', (event, { gameId, guarded }) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false };
    const games = store.get('customGames') || [];
    const idx = games.findIndex(g => g.id === gameId);
    if (idx < 0) return { success: false };
    games[idx].guarded = guarded;
    store.set('customGames', games);
    return { success: true };
});

ipcMain.handle('gameguard:setEnabled', (event, enabled) => {
    const currentUser = store.get('currentUser');
    const user = store.get(`users.${currentUser}`);
    if (!user?.isParent && !user?.isAdmin) return { success: false };
    store.set('settings.gameGuardEnabled', enabled);
    if (enabled) {
        const cu = store.get('currentUser');
        const cu_user = cu ? store.get(`users.${cu}`) : null;
        if (cu_user && !cu_user.isParent && !cu_user.isAdmin) startGameGuard();
    } else {
        stopGameGuard();
    }
    return { success: true };
});

function resetWeeklyStatsIfNeeded(username) {
    const user = store.get(`users.${username}`);
    if (!user) return;
    const now = new Date();
    const day = now.getDay(); // 0=Sunday
    // Week starts on Sunday
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - day);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toDateString();
    if (!user.weeklyStats || user.weeklyStats.weekStart !== weekStartStr) {
        user.weeklyStats = { weekStart: weekStartStr, questionsAnswered: 0, coinsEarned: 0 };
        store.set(`users.${username}`, user);
    }
}

// Gamification IPC handlers
ipcMain.handle('gamification:getLevels', () => LEVELS);

ipcMain.handle('gamification:getAchievementsDefs', () => {
    return ACHIEVEMENTS.map(a => ({ id: a.id, title: a.title, desc: a.desc, icon: a.icon }));
});

ipcMain.handle('gamification:getUserStats', (event, username) => {
    const target = username || store.get('currentUser');
    if (!target) return { success: false };
    const user = store.get(`users.${target}`);
    if (!user) return { success: false };
    const levelData = getLevelForXP(user.xp || 0);
    const nextLevel = getNextLevel(levelData.level);
    return {
        success: true,
        username: target,
        displayName: user.displayName || target,
        avatar: user.avatar || 'cat_1',
        coins: user.coins || 0,
        correctAnswers: user.correctAnswers || 0,
        questionsAnswered: user.questionsAnswered || 0,
        xp: user.xp || 0,
        level: levelData.level,
        levelTitle: levelData.title,
        levelBadge: levelData.badge,
        nextLevelXP: nextLevel ? nextLevel.xpRequired : null,
        streak: user.streak || 0,
        lastStreakDate: user.lastStreakDate,
        unlockedAchievements: user.unlockedAchievements || [],
        consecutiveCorrect: user.consecutiveCorrect || 0,
        tasksCompletedCount: user.tasksCompletedCount || 0,
        totalCoinsEarned: user.totalCoinsEarned || 0,
        weeklyStats: user.weeklyStats || { weekStart: null, questionsAnswered: 0, coinsEarned: 0 }
    };
});

ipcMain.handle('gamification:getLeaderboard', () => {
    const users = store.get('users') || {};
    const tasks = store.get('tasks') || [];
    const children = Object.values(users).filter(u => !u.isParent && !u.isAdmin);
    
    return children.map(u => {
        const completedTasks = tasks.filter(t => t.status === 'completed' && t.completedBy === u.username).length;
        const levelData = getLevelForXP(u.xp || 0);
        return {
            username: u.username,
            displayName: u.displayName,
            xp: u.xp || 0,
            level: levelData.level,
            levelBadge: levelData.badge,
            levelTitle: levelData.title,
            coins: u.coins || 0,
            streak: u.streak || 0,
            correctAnswers: u.correctAnswers || 0,
            questionsAnswered: u.questionsAnswered || 0,
            tasksCompleted: completedTasks,
            totalCoinsEarned: u.totalCoinsEarned || 0,
            unlockedAchievements: (u.unlockedAchievements || []).length,
            weeklyStats: u.weeklyStats || { weekStart: null, questionsAnswered: 0, coinsEarned: 0 }
        };
    }).sort((a, b) => b.xp - a.xp);
});

// ==================== DEFAULT DATA ====================
function getDefaultShopItems() {
    return {
        games: [],
        items: [
            { id: 'byt_1', name: 'בית 1', price: 50, image: 'byt_1.png', category: 'buildings' },
            { id: 'byt_2', name: 'בית 2', price: 60, image: 'byt_2.png', category: 'buildings' },
            { id: 'byt_3', name: 'בית 3', price: 70, image: 'byt_3.png', category: 'buildings' },
            { id: 'byt_4', name: 'בית 4', price: 80, image: 'byt_4.png', category: 'buildings' },
            { id: 'byt_6', name: 'בית 6', price: 90, image: 'byt_6.png', category: 'buildings' },
            { id: 'byt_7', name: 'בית 7', price: 100, image: 'byt_7.png', category: 'buildings' },
            { id: 'byt_8', name: 'בית 8', price: 110, image: 'byt_8.png', category: 'buildings' },
            { id: 'byt_kpry', name: 'בית כפרי', price: 120, image: 'byt_kpry.png', category: 'buildings' },
            { id: 'byt_shvvh', name: 'בית שווה', price: 150, image: 'byt_shvvh.png', category: 'buildings' },
            { id: 'mgdl', name: 'מגדל', price: 200, image: 'mgdl.png', category: 'buildings' },
            { id: 'mgdl_2', name: 'מגדל 2', price: 220, image: 'mgdl_2.png', category: 'buildings' },
            { id: 'mgdl_3', name: 'מגדל 3', price: 250, image: 'mgdl_3.png', category: 'buildings' },
            { id: 'chbyt', name: 'חבית', price: 30, image: 'chbyt.png', category: 'buildings' },
            { id: 'shvk', name: 'שוק', price: 180, image: 'shvk.png', category: 'buildings' },
            { id: 'shvk_2', name: 'שוק 2', price: 200, image: 'shvk_2.png', category: 'buildings' },
            { id: 'shvk_3', name: 'שוק 3', price: 220, image: 'shvk_3.png', category: 'buildings' },
            { id: 'tyrt_krch', name: 'טירת קרח', price: 500, image: 'tyrt_krch.png', category: 'buildings' },
            { id: 'chvmh', name: 'חומה', price: 100, image: 'chvmh.png', category: 'buildings' },
            { id: 'chvmt_tyrh', name: 'חומת טירה', price: 150, image: 'chvmt_tyrh.png', category: 'buildings' },
            { id: 'chvmt_tyrh_2', name: 'חומת טירה 2', price: 180, image: 'chvmt_tyrh_2.png', category: 'buildings' },
            { id: 'mbnh_kpva', name: 'מבנה קפוא', price: 300, image: 'mbnh_kpva.png', category: 'buildings' },
            { id: 'tchnt_chshml', name: 'תחנת חשמל', price: 250, image: 'tchnt_chshml_kpvah.png', category: 'buildings' },
            { id: 'tchnt_rvch', name: 'תחנת רוח', price: 200, image: 'tchnt_rvch.png', category: 'buildings' },
            { id: 'atz', name: 'עץ', price: 20, image: 'atz.png', category: 'nature' },
            { id: 'atz_5', name: 'עץ 5', price: 25, image: 'atz_5.png', category: 'nature' },
            { id: 'atz_6', name: 'עץ 6', price: 25, image: 'atz_6.png', category: 'nature' },
            { id: 'atz_7', name: 'עץ 7', price: 30, image: 'atz_7.png', category: 'nature' },
            { id: 'atz_8', name: 'עץ 8', price: 30, image: 'atz_8.png', category: 'nature' },
            { id: 'atz_9', name: 'עץ 9', price: 35, image: 'atz_9.png', category: 'nature' },
            { id: 'atz_10', name: 'עץ 10', price: 35, image: 'atz_10.png', category: 'nature' },
            { id: 'atz_11', name: 'עץ 11', price: 40, image: 'atz_11.png', category: 'nature' },
            { id: 'atz_12', name: 'עץ 12', price: 40, image: 'atz_12.png', category: 'nature' },
            { id: 'atz_13', name: 'עץ 13', price: 45, image: 'atz_13.png', category: 'nature' },
            { id: 'atz_shlg', name: 'עץ שלג', price: 50, image: 'atz_shlg.png', category: 'nature' },
            { id: 'atz_shlg_2', name: 'עץ שלג 2', price: 55, image: 'atz_shlg_2.png', category: 'nature' },
            { id: 'atz_shlg_3', name: 'עץ שלג 3', price: 60, image: 'atz_shlg_3.png', category: 'nature' },
            { id: 'atz_shkg_4', name: 'עץ שלג 4', price: 65, image: 'atz_shkg_4.png', category: 'nature' },
            { id: 'bvl_atz', name: 'בול עץ', price: 15, image: 'bvl_atz.png', category: 'nature' },
            { id: 'ash', name: 'אש', price: 40, image: 'ash.png', category: 'nature' },
            { id: 'ashn', name: 'עשן', price: 35, image: 'ashn.png', category: 'nature' },
            { id: 'ash_yrvkh', name: 'אש ירוקה', price: 50, image: 'ash_yrvkh.png', category: 'nature' },
            { id: 'abn', name: 'אבן', price: 10, image: 'abn.png', category: 'nature' },
            { id: 'abn_2', name: 'אבן 2', price: 12, image: 'abn_2.png', category: 'nature' },
            { id: 'abnym_3', name: 'אבנים 3', price: 15, image: 'abnym_3.png', category: 'nature' },
            { id: 'krystl', name: 'קריסטל', price: 100, image: 'krystl.png', category: 'nature' },
            { id: 'bar', name: 'באר', price: 80, image: 'bar.png', category: 'nature' },
            { id: 'bar_2', name: 'באר 2', price: 90, image: 'bar_2.png', category: 'nature' },
            { id: 'bar_mym_2', name: 'באר מים 2', price: 100, image: 'bar_mym_2.png', category: 'nature' },
            { id: 'kyishvt_krch', name: 'קישוט קרח', price: 70, image: 'kyshvt_krch.png', category: 'nature' },
            { id: 'shybvr_krch', name: 'שיבור קרח', price: 80, image: 'shybvr_krch.png', category: 'nature' },
            { id: 'aydn_hkrch', name: 'עידן הקרח', price: 150, image: 'aydn_hkrch.png', category: 'nature' },
            { id: 'mzrkh', name: 'מזרקה', price: 120, image: 'mzrkh_kpvah.png', category: 'decorations' },
            { id: 'lpyd', name: 'לפיד', price: 30, image: 'lpyd.png', category: 'decorations' },
            { id: 'lpyd_krch', name: 'לפיד קרח', price: 50, image: 'lpyd_krch.png', category: 'decorations' },
            { id: 'mnvrt_rchvb', name: 'מנורת רחוב', price: 40, image: 'mnvrt_rchvb.png', category: 'decorations' },
            { id: 'mnvrt_rchvb_2', name: 'מנורת רחוב 2', price: 45, image: 'mnvrt_rchvb_2.png', category: 'decorations' },
            { id: 'mnvrt_rchvb_3', name: 'מנורת רחוב 3', price: 50, image: 'mnvrt_rchvb_3.png', category: 'decorations' },
            { id: 'tavrt_rchvb', name: 'תאורת רחוב', price: 60, image: 'tavrt_rchvb_kpvah.png', category: 'decorations' },
            { id: 'tavrt_rchvb_2', name: 'תאורת רחוב 2', price: 65, image: 'tavrt_rchvb_kpvah2.png', category: 'decorations' },
            { id: 'dgl', name: 'דגל', price: 25, image: 'dgl.png', category: 'decorations' },
            { id: 'dgl_2', name: 'דגל 2', price: 30, image: 'dgl_2.png', category: 'decorations' },
            { id: 'dgl_3', name: 'דגל 3', price: 35, image: 'dgl_3.png', category: 'decorations' },
            { id: 'dgl_4', name: 'דגל 4', price: 40, image: 'dgl_4.png', category: 'decorations' },
            { id: 'dgl_5', name: 'דגל 5', price: 45, image: 'dgl_5.png', category: 'decorations' },
            { id: 'dgl_kpva_1', name: 'דגל קפוא 1', price: 50, image: 'dgl_kpva_1.png', category: 'decorations' },
            { id: 'dgl_kpva_2', name: 'דגל קפוא 2', price: 55, image: 'dgl_kpva_2.png', category: 'decorations' },
            { id: 'dgl_kpva_3', name: 'דגל קפוא 3', price: 60, image: 'dgl_kpva_3.png', category: 'decorations' },
            { id: 'spsl', name: 'ספסל', price: 35, image: 'spsl.png', category: 'decorations' },
            { id: 'kysa', name: 'כיסא', price: 25, image: 'kysa.png', category: 'decorations' },
            { id: 'kysa_mlkvty', name: 'כיסא מלכותי', price: 150, image: 'kysa_mlkvty.png', category: 'decorations' },
            { id: 'shvlchn', name: 'שולחן', price: 40, image: 'shvlchn.png', category: 'decorations' },
            { id: 'shvlchn_2', name: 'שולחן 2', price: 45, image: 'shvlchn_2.png', category: 'decorations' },
            { id: 'shvlchn_3', name: 'שולחן 3', price: 50, image: 'shvlchn_3.png', category: 'decorations' },
            { id: 'shvlchn_4', name: 'שולחן 4', price: 55, image: 'shvlchn_4.png', category: 'decorations' },
            { id: 'shvlchnvt', name: 'שולחנות', price: 80, image: 'shvlchnvt.png', category: 'decorations' },
            { id: 'shvlchn_mlchmh', name: 'שולחן מלחמה', price: 200, image: 'shvlchn_mlchmh.png', category: 'decorations' },
            { id: 'mdvrh', name: 'מדורה', price: 60, image: 'mdvrh.png', category: 'decorations' },
            { id: 'tavrh', name: 'תאורה', price: 35, image: 'tavrh.png', category: 'decorations' },
            { id: 'tavrh_ktvmh', name: 'תאורה כתומה', price: 40, image: 'tavrh_ktvmh.png', category: 'decorations' },
            { id: 'tavrh_yrvkh', name: 'תאורה ירוקה', price: 45, image: 'tavrh_yrvkh.png', category: 'decorations' },
            { id: 'krkrh', name: 'כרכרה', price: 180, image: 'krkrh.png', category: 'decorations' },
            { id: 'tybt_dvar', name: 'תיבת דואר', price: 30, image: 'tybt_dvar.png', category: 'decorations' },
            { id: 'shlty_nyvvt', name: 'שלטי ניווט', price: 25, image: 'shlty_nyvvt.png', category: 'decorations' },
            { id: 'kvpsa', name: 'קופסה', price: 20, image: 'kvpsa.png', category: 'decorations' },
            { id: 'avlf', name: 'אולף', price: 250, image: 'avlf.png', category: 'decorations' },
            { id: 'gshr', name: 'גשר', price: 150, image: 'gshr.png', category: 'structures' },
            { id: 'gshr_kpva', name: 'גשר קפוא', price: 200, image: 'gshr_kpva.png', category: 'structures' },
            { id: 'gdr', name: 'גדר', price: 20, image: 'gdr.png', category: 'structures' },
            { id: 'gdr_3', name: 'גדר 3', price: 25, image: 'gdr_3.png', category: 'structures' },
            { id: 'gdr_lbnh', name: 'גדר לבנה', price: 30, image: 'gdr_lbnh.png', category: 'structures' },
            { id: 'gdr_lbnh_pynh', name: 'גדר לבנה פינה', price: 35, image: 'gdr_lbnh_pynh.png', category: 'structures' },
            { id: 'gdr_aykrym', name: 'גדר אייקרים', price: 40, image: 'gdr_aykrym.png', category: 'structures' },
            { id: 'shar', name: 'שער', price: 80, image: 'shar.png', category: 'structures' },
            { id: 'shar_sgvr', name: 'שער סגור', price: 90, image: 'shar_sgvr.png', category: 'structures' },
            { id: 'amvd', name: 'עמוד', price: 30, image: 'amvd.png', category: 'structures' },
            { id: 'amvd_2', name: 'עמוד 2', price: 35, image: 'amvd_2.png', category: 'structures' },
            { id: 'amvd_3', name: 'עמוד 3', price: 40, image: 'amvd_3.png', category: 'structures' },
            { id: 'kyr', name: 'קיר', price: 25, image: 'kyr.png', category: 'structures' },
            { id: 'kyr_agvl', name: 'קיר עגול', price: 30, image: 'kyr_agvl.png', category: 'structures' },
            { id: 'kyr_agvl_2', name: 'קיר עגול 2', price: 35, image: 'kyr_agvl_2.png', category: 'structures' },
            { id: 'kyr_agvl_3', name: 'קיר עגול 3', price: 40, image: 'kyr_agvl_3.png', category: 'structures' },
            { id: 'kyr_pynh', name: 'קיר פינה', price: 35, image: 'kyr_pynh.png', category: 'structures' },
            { id: 'rtzph', name: 'ריצפה', price: 15, image: 'rtzph.png', category: 'structures' },
            { id: 'chnyt_bkrch', name: 'חנייה בקרח', price: 100, image: 'chnyt_bkrch.png', category: 'structures' },
            { id: 'chrb', name: 'חרב', price: 80, image: 'chrb.png', category: 'special' },
            { id: 'mgn', name: 'מגן', price: 70, image: 'mgn.png', category: 'special' },
            { id: 'mgn_2', name: 'מגן 2', price: 85, image: 'mgn_2.png', category: 'special' },
            { id: 'kly_nshk', name: 'כלי נשק', price: 100, image: 'kly_nshk.png', category: 'special' },
            { id: 'avhl', name: 'אוהל', price: 120, image: 'avhl.png', category: 'special' },
            { id: 'avhl_3', name: 'אוהל 3', price: 140, image: 'avhl_3.png', category: 'special' },
            { id: 'avhl_4', name: 'אוהל 4', price: 160, image: 'avhl_4.png', category: 'special' },
            { id: 'avhl_5', name: 'אוהל 5', price: 180, image: 'avhl_5.png', category: 'special' },
            { id: 'avhl_kpvl', name: 'אוהל כפול', price: 200, image: 'avhl_kpvl.png', category: 'special' },
            { id: 'aglh', name: 'עגלה', price: 90, image: 'aglh.png', category: 'special' },
            { id: 'alzh', name: 'אלזה', price: 300, image: 'alzh.png', category: 'special' },
            { id: 'hary_pvtr', name: 'הארי פוטר', price: 350, image: 'hary_pvtr.png', category: 'special' },
            { id: 'hagryd', name: 'האגריד', price: 400, image: 'hagryd.png', category: 'special' },
            { id: 'yvnykvrn', name: 'יוניקורן', price: 500, image: 'yvnykvrn_al_mrytzh.png', category: 'special' },
            { id: 'mahl', name: 'מאהל', price: 150, image: 'mahl.png', category: 'special' },
            { id: 'pvykh', name: 'פויקה', price: 80, image: 'pvykh.png', category: 'special' },
            { id: 'myynkrapt_atz', name: 'עץ מיינקראפט', price: 60, image: 'myynkrapt_atz.png', category: 'minecraft' },
            { id: 'myynkrapt_atz_2', name: 'עץ מיינקראפט 2', price: 70, image: 'myynkrapt_atz_2.png', category: 'minecraft' },
            { id: 'myynkrapt_yhlvm', name: 'יהלום מיינקראפט', price: 200, image: 'myynkrapt_yhlvm.png', category: 'minecraft' },
            { id: 'tzvry_1', name: 'ציור 1', price: 100, image: 'tzvry_1.jpg', category: 'art' },
            { id: 'tzvry_2', name: 'ציור 2', price: 120, image: 'tzvry_2.jpg', category: 'art' },
            { id: 'tzvry_3', name: 'ציור 3', price: 140, image: 'tzvry_3.jpg', category: 'art' },
            { id: 'tzvry_4', name: 'ציור 4', price: 160, image: 'tzvry_4.jpg', category: 'art' },
            { id: 'tzvry_5', name: 'ציור 5', price: 180, image: 'tzvry_5.jpg', category: 'art' },
            { id: 'tzvry_valyh', name: 'ציור ואליה', price: 200, image: 'tzvry_valyh.jpg', category: 'art' },
            { id: 'alyh', name: 'אליה', price: 150, image: 'alyh.jpg', category: 'art' },
            { id: 'alyh_vsba', name: 'אליה וסבא', price: 180, image: 'alyh_vsba.jpg', category: 'art' },
            { id: 'dgl_hary_pvtr', name: 'דגל הארי פוטר', price: 100, image: 'dgl_hary_pvtr.jpg', category: 'art' },
            { id: 'dgl_hvgvvrts', name: 'דגל הוגוורטס', price: 120, image: 'dgl_hvgvvrts.jpg', category: 'art' },
            { id: 'dgl_grypyndvr', name: 'דגל גריפינדור', price: 110, image: 'dgl_shl_grypyndvr.jpg', category: 'art' },
            { id: 'prvzh', name: 'פרוזה', price: 80, image: 'prvzh.jpg', category: 'art' }
        ]
    };
}

// ==================== CUSTOMIZATION: AVATARS & THEMES ====================
function getAvatarDefinitions() {
    return [
        // === LEVEL 1 — FREE (Common) ===
        { id: 'cat_1', name: 'חתול הרחוב', image: 'Charcters/CAT - LEVEL 1.png', rarity: 'common', price: 0,
          colors: { bg: 'linear-gradient(135deg,#2d3436,#636e72)', border: '#b2bec3', glow: 'rgba(178,190,195,0.3)' } },
        { id: 'wolf_1', name: 'גור הזאבים', image: 'Charcters/WOLF - LEVEL 1.png', rarity: 'common', price: 0,
          colors: { bg: 'linear-gradient(135deg,#2c3e50,#34495e)', border: '#74b9ff', glow: 'rgba(116,185,255,0.3)' } },
        { id: 'owl_1', name: 'ינשוף הדמדומים', image: 'Charcters/OWL - LEVEL 1.png', rarity: 'common', price: 0,
          colors: { bg: 'linear-gradient(135deg,#4a3728,#2d1f11)', border: '#c49a6c', glow: 'rgba(196,154,108,0.3)' } },
        { id: 'dino_1', name: 'דינו הקטן', image: 'Charcters/DINOZOUR - LEVEL 1.png', rarity: 'common', price: 0,
          colors: { bg: 'linear-gradient(135deg,#27ae60,#1e8449)', border: '#55efc4', glow: 'rgba(85,239,196,0.3)' } },
        { id: 'chameleon_1', name: 'זיקית הצבעים', image: 'Charcters/Chameleon LEVEL 1.png', rarity: 'common', price: 0,
          colors: { bg: 'linear-gradient(135deg,#00b894,#fdcb6e)', border: '#55efc4', glow: 'rgba(85,239,196,0.3)' } },
        { id: 'horse_1', name: 'סייח הערבות', image: 'Charcters/HOURSE LEVEL 1.png', rarity: 'common', price: 0,
          colors: { bg: 'linear-gradient(135deg,#6c4f37,#3e2c1e)', border: '#d4a574', glow: 'rgba(212,165,116,0.3)' } },

        // === LEVEL 2 — RARE (80-140 coins) ===
        { id: 'bird_2', name: 'ציפור הסערה', image: 'Charcters/bird - level 2.png', rarity: 'rare', price: 80,
          colors: { bg: 'linear-gradient(135deg,#e17055,#d63031)', border: '#ff7675', glow: 'rgba(255,118,117,0.4)' } },
        { id: 'dragon_2a', name: 'דרקון הלהבה', image: 'Charcters/dragon level 2.png', rarity: 'rare', price: 100,
          colors: { bg: 'linear-gradient(135deg,#c0392b,#e74c3c)', border: '#ff6348', glow: 'rgba(255,99,72,0.4)' } },
        { id: 'dragon_2b', name: 'דרקון הקרח', image: 'Charcters/dragon 2 - level 2.png', rarity: 'rare', price: 100,
          colors: { bg: 'linear-gradient(135deg,#0984e3,#74b9ff)', border: '#a0d2ff', glow: 'rgba(116,185,255,0.4)' } },
        { id: 'horse_2', name: 'סוס המלחמה', image: 'Charcters/HOURSE LEVEL 2.png', rarity: 'rare', price: 90,
          colors: { bg: 'linear-gradient(135deg,#6c5ce7,#a29bfe)', border: '#d4cfff', glow: 'rgba(162,155,254,0.4)' } },
        { id: 'wolf_2', name: 'זאב הירח', image: 'Charcters/woldf - level 2.png', rarity: 'rare', price: 110,
          colors: { bg: 'linear-gradient(135deg,#636e72,#2d3436)', border: '#dfe6e9', glow: 'rgba(223,230,233,0.4)' } },
        { id: 'owl_2', name: 'ינשוף הקסם', image: 'Charcters/yanshuf - level 2.png', rarity: 'rare', price: 120,
          colors: { bg: 'linear-gradient(135deg,#6c5ce7,#30336b)', border: '#a29bfe', glow: 'rgba(162,155,254,0.4)' } },

        // === LEVEL 3 — EPIC (200-350 coins) ===
        { id: 'bird_3', name: 'עוף האגדות', image: 'Charcters/BIRD - LEVEL 3.png', rarity: 'epic', price: 200,
          colors: { bg: 'radial-gradient(circle at 50% 60%,#f9ca24 0%,#f0932b 40%,#2d1a00 100%)', border: '#ffd700', glow: 'rgba(255,215,0,0.5)' } },
        { id: 'bug_3', name: 'צרעת הרעל', image: 'Charcters/BUG BZZZ LEVEL 3.png', rarity: 'epic', price: 220,
          colors: { bg: 'radial-gradient(circle at 50% 60%,#00ff88 0%,#00b894 30%,#0a2a1a 100%)', border: '#00ff88', glow: 'rgba(0,255,136,0.5)' } },
        { id: 'bull_3', name: 'שור הברזל', image: 'Charcters/BULL LEVEL 3.png', rarity: 'epic', price: 250,
          colors: { bg: 'radial-gradient(circle at 50% 60%,#e74c3c 0%,#6c0000 50%,#1a0000 100%)', border: '#ff3838', glow: 'rgba(255,56,56,0.5)' } },
        { id: 'deer_3', name: 'אייל הקרניים', image: 'Charcters/DEER LEVEL 3.png', rarity: 'epic', price: 280,
          colors: { bg: 'radial-gradient(circle at 50% 60%,#55efc4 0%,#00b894 40%,#0a1a0a 100%)', border: '#55efc4', glow: 'rgba(85,239,196,0.5)' } },
        { id: 'snake_3', name: 'נחש הצללים', image: 'Charcters/SNAKE LEVEL 3.png', rarity: 'epic', price: 300,
          colors: { bg: 'radial-gradient(circle at 50% 60%,#a29bfe 0%,#6c5ce7 40%,#130f40 100%)', border: '#a29bfe', glow: 'rgba(162,155,254,0.5)' } },
        { id: 'wolf_3', name: 'זאב האלפא', image: 'Charcters/WOLF LEVEL 3.png', rarity: 'epic', price: 350,
          colors: { bg: 'radial-gradient(circle at 50% 60%,#ff6b6b 0%,#c0392b 40%,#2a0000 100%)', border: '#ff6348', glow: 'rgba(255,99,72,0.5)' } },

        // === FINAL BOSS — LEGENDARY (500-900 coins) ===
        { id: 'cat_boss', name: 'חתול האימה', image: 'Charcters/final boss cat.png', rarity: 'legendary', price: 500,
          colors: { bg: 'radial-gradient(circle at 50% 50%,#ff3838 0%,#6c0000 40%,#0a0000 100%)', border: '#ff3838', glow: 'rgba(255,56,56,0.7)' } },
        { id: 'fly_boss', name: 'שליט הנחיל', image: 'Charcters/final boss fly bzzzz.png', rarity: 'legendary', price: 600,
          colors: { bg: 'radial-gradient(circle at 50% 50%,#00ff88 0%,#00b894 30%,#001a0d 100%)', border: '#00ff88', glow: 'rgba(0,255,136,0.7)' } },
        { id: 'lion_boss', name: 'מלך החיות', image: 'Charcters/final boss lion.png', rarity: 'legendary', price: 750,
          colors: { bg: 'radial-gradient(circle at 50% 50%,#ffd700 0%,#f0932b 35%,#2d1a00 100%)', border: '#ffd700', glow: 'rgba(255,215,0,0.8)' } },
        { id: 'snake_boss', name: 'נחשול האופל', image: 'Charcters/final boss snake.png', rarity: 'legendary', price: 650,
          colors: { bg: 'radial-gradient(circle at 50% 50%,#a29bfe 0%,#6c5ce7 30%,#0c0032 100%)', border: '#a29bfe', glow: 'rgba(162,155,254,0.7)' } },
        { id: 'wolf_boss', name: 'זאב הדם', image: 'Charcters/final boss wolf.png', rarity: 'legendary', price: 700,
          colors: { bg: 'radial-gradient(circle at 50% 50%,#e74c3c 0%,#6c0000 35%,#000 100%)', border: '#ff3838', glow: 'rgba(255,56,56,0.7)' } },
        { id: 'bird_boss', name: 'פניקס הכאוס', image: 'Charcters/finall boos - bird.png', rarity: 'legendary', price: 900,
          colors: { bg: 'radial-gradient(circle at 50% 50%,#ffd700 0%,#e74c3c 35%,#2a0000 100%)', border: '#ffd700', glow: 'rgba(255,215,0,0.8)' } }
    ];
}

function getThemeDefinitions() {
    return [
        // --- Free themes ---
        { id: 'dark', name: 'חושך', emoji: '🌙', price: 0, vars: {} },
        { id: 'light', name: 'בהיר', emoji: '☀️', price: 0, vars: { '--bg-primary':'#f0f2f5','--bg-secondary':'#ffffff','--bg-card':'#ffffff','--bg-card-hover':'#f8f9fa','--bg-sidebar':'#eef0f4','--text-primary':'#222','--text-secondary':'#666','--border':'rgba(0,0,0,0.1)','--shadow':'0 4px 15px rgba(0,0,0,0.08)' } },
        { id: 'ocean', name: 'אוקיינוס', emoji: '🌊', price: 0, vars: { '--bg-primary':'#0a192f','--bg-secondary':'#112240','--bg-card':'#112240','--bg-card-hover':'#1d3557','--bg-sidebar':'#0a192f','--accent':'#64ffda','--accent-light':'#a8fff0','--accent-gradient':'linear-gradient(135deg,#64ffda,#48c9b0)','--border':'rgba(100,255,218,0.08)' } },
        { id: 'forest', name: 'יער', emoji: '🌿', price: 0, vars: { '--bg-primary':'#0a1a0a','--bg-secondary':'#112211','--bg-card':'#132613','--bg-card-hover':'#1d3a1d','--bg-sidebar':'#081408','--accent':'#00b894','--accent-light':'#55efc4','--accent-gradient':'linear-gradient(135deg,#00b894,#55efc4)','--border':'rgba(0,184,148,0.1)' } },
        { id: 'sunset', name: 'שקיעה', emoji: '🌅', price: 0, vars: { '--bg-primary':'#1a0f1e','--bg-secondary':'#261528','--bg-card':'#2a1830','--bg-card-hover':'#3d2244','--bg-sidebar':'#150c18','--accent':'#fd79a8','--accent-light':'#ffb3d1','--accent-gradient':'linear-gradient(135deg,#fd79a8,#e056c1)','--border':'rgba(253,121,168,0.1)' } },
        { id: 'galaxy', name: 'גלקסיה', emoji: '🌌', price: 0, vars: { '--bg-primary':'#0c0032','--bg-secondary':'#190061','--bg-card':'#240090','--bg-card-hover':'#3500d3','--bg-sidebar':'#0c0032','--accent':'#a29bfe','--accent-light':'#d4cfff','--accent-gradient':'linear-gradient(135deg,#a29bfe,#6c5ce7)','--border':'rgba(162,155,254,0.12)','--gold':'#ffd700' } },
        { id: 'midnight', name: 'חצות', emoji: '🖤', price: 0, vars: { '--bg-primary':'#000','--bg-secondary':'#0a0a0a','--bg-card':'#111','--bg-card-hover':'#1a1a1a','--bg-sidebar':'#000','--accent':'#dfe6e9','--accent-light':'#fff','--accent-gradient':'linear-gradient(135deg,#dfe6e9,#b2bec3)','--border':'rgba(255,255,255,0.05)' } },

        // --- Premium themes (with stickers + visual enhancements) ---
        {
            id: 'space', name: 'חלל', emoji: '🚀', price: 400,
            vars: {
                '--bg-primary':'#050a18','--bg-secondary':'#0b1528','--bg-card':'#0f1d35','--bg-card-hover':'#162a4a','--bg-sidebar':'#060d1f',
                '--accent':'#7c6cf6','--accent-light':'#b8b0ff','--accent-gradient':'linear-gradient(135deg,#7c6cf6,#00d4ff)',
                '--border':'rgba(124,108,246,0.12)','--gold':'#ffd700',
                '--text-primary':'#e8eaf6','--text-secondary':'#8892b0'
            },
            stickers: [
                { img: 'spaceship.png',    zone: 'bl-1', size: 72, opacity: 0.75 },
                { img: 'meteor.png',       zone: 'bl-2', size: 66, opacity: 0.73 },
                { img: 'coin.png',         zone: 'bl-3', size: 62, opacity: 0.72 },
                { img: 'dimound.png',      zone: 'bl-4', size: 60, opacity: 0.72 },
                { img: 'space shield.png', zone: 'bl-5', size: 66, opacity: 0.72 },
                { img: 'space pistiol.png',zone: 'bl-6', size: 68, opacity: 0.70 },
                { img: 'magic drink.png',  zone: 'bl-7', size: 62, opacity: 0.72 },
                { img: 'space tool.png',   zone: 'bl-8', size: 66, opacity: 0.71 }
            ]
        },
        {
            id: 'pink', name: 'ורוד', emoji: '🎀', price: 400,
            vars: {
                '--bg-primary':'#1a0a14','--bg-secondary':'#22101c','--bg-card':'#2a1424','--bg-card-hover':'#3a1e34','--bg-sidebar':'#160812',
                '--accent':'#ff69b4','--accent-light':'#ffb6d9','--accent-gradient':'linear-gradient(135deg,#ff69b4,#ff85c8)',
                '--border':'rgba(255,105,180,0.12)','--gold':'#ffb7d5',
                '--text-primary':'#fce4ec','--text-secondary':'#c48b9f'
            },
            stickers: [
                { img: 'Gemini_Generated_Image_pqqm8mpqqm8mpqqm.png', zone: 'bl-1',  size: 72, opacity: 0.75 },
                { img: 'DRESS.png',         zone: 'bl-2',  size: 68, opacity: 0.72 },
                { img: 'CUPCAKE.png',       zone: 'bl-3',  size: 60, opacity: 0.78 },
                { img: 'SHOES.png',         zone: 'bl-4',  size: 62, opacity: 0.75 },
                { img: 'MOON.png',          zone: 'bl-5',  size: 70, opacity: 0.70 },
                { img: 'CANDY MACHINE.png', zone: 'bl-6',  size: 65, opacity: 0.73 },
                { img: 'MIROR.png',         zone: 'bl-7',  size: 58, opacity: 0.72 },
                { img: 'קשת.png',           zone: 'bl-8',  size: 72, opacity: 0.70 },
                { img: 'MILK.png',          zone: 'bl-9',  size: 56, opacity: 0.73 },
                { img: 'בושם.png',          zone: 'bl-10', size: 58, opacity: 0.72 }
            ]
        },
        {
            id: 'fire', name: 'אש', emoji: '🔥', price: 400,
            vars: {
                '--bg-primary':'#120600','--bg-secondary':'#1e0c02','--bg-card':'#261005','--bg-card-hover':'#381a0a','--bg-sidebar':'#0e0400',
                '--accent':'#ff6348','--accent-light':'#ff9f7f','--accent-gradient':'linear-gradient(135deg,#ff6348,#ff4500)',
                '--border':'rgba(255,99,72,0.12)','--gold':'#ff9f43',
                '--text-primary':'#ffeedd','--text-secondary':'#b08060'
            },
            stickers: [
                { img: 'FIRE DRAGON.png',          zone: 'bl-1', size: 82, opacity: 0.78 },
                { img: 'FIRE BALL.png',            zone: 'bl-2', size: 68, opacity: 0.75 },
                { img: 'FIRE BALL 2.png',          zone: 'bl-3', size: 65, opacity: 0.72 },
                { img: 'FIRE MOUNTAIN.png',        zone: 'bl-4', size: 78, opacity: 0.72 },
                { img: 'FIRE STONES.png',          zone: 'bl-5', size: 62, opacity: 0.75 },
                { img: 'FIRE TREE.png',            zone: 'bl-6', size: 68, opacity: 0.70 },
                { img: 'A LOT OF FILE FLAMES.png', zone: 'bl-7', size: 72, opacity: 0.72 }
            ]
        }
    ];
}

ipcMain.handle('customization:getAvatars', () => getAvatarDefinitions());
ipcMain.handle('customization:getThemes', () => getThemeDefinitions());

ipcMain.handle('customization:purchaseAvatar', (event, avatarId) => {
    const username = store.get('currentUser');
    if (!username) return { success: false, error: 'לא מחובר' };
    const user = store.get(`users.${username}`);
    const isAdmin = user?.isParent || user?.isAdmin;
    const avatar = getAvatarDefinitions().find(a => a.id === avatarId);
    if (!avatar) return { success: false, error: 'אווטאר לא נמצא' };
    const owned = user.ownedAvatars || [];
    if (owned.includes(avatarId)) return { success: false, error: 'כבר בבעלותך' };
    if (!isAdmin) {
        if (avatar.price > 0 && (user.coins || 0) < avatar.price) return { success: false, error: 'אין מספיק מטבעות' };
        if (avatar.price > 0) user.coins -= avatar.price;
    }
    if (!user.ownedAvatars) user.ownedAvatars = [];
    user.ownedAvatars.push(avatarId);
    user.avatar = avatarId;
    store.set(`users.${username}`, user);
    if (!isAdmin && avatar.price > 0) logActivity(username, 'customize', `קנה אווטאר "${avatar.name}"`, '🎭');
    if (!isAdmin && avatar.price > 0) addPurchaseHistory(username, { type: 'avatar', name: avatar.name, price: avatar.price, icon: '🎭' });
    return { success: true, user };
});

ipcMain.handle('customization:purchaseTheme', (event, themeId) => {
    const username = store.get('currentUser');
    if (!username) return { success: false, error: 'לא מחובר' };
    const user = store.get(`users.${username}`);
    const isAdmin = user?.isParent || user?.isAdmin;
    const theme = getThemeDefinitions().find(t => t.id === themeId);
    if (!theme) return { success: false, error: 'ערכת נושא לא נמצאה' };
    const owned = user.ownedThemes || [];
    if (owned.includes(themeId)) return { success: false, error: 'כבר בבעלותך' };
    if (!isAdmin) {
        if (theme.price > 0 && (user.coins || 0) < theme.price) return { success: false, error: 'אין מספיק מטבעות' };
        if (theme.price > 0) user.coins -= theme.price;
    }
    if (!user.ownedThemes) user.ownedThemes = [];
    user.ownedThemes.push(themeId);
    user.theme = themeId;
    store.set(`users.${username}`, user);
    if (!isAdmin && theme.price > 0) logActivity(username, 'customize', `קנה ערכת נושא "${theme.name}"`, '🎨');
    if (!isAdmin && theme.price > 0) addPurchaseHistory(username, { type: 'theme', name: theme.name, price: theme.price, icon: '🎨' });
    return { success: true, user };
});

ipcMain.handle('customization:equipAvatar', (event, avatarId) => {
    const username = store.get('currentUser');
    if (!username) return { success: false };
    const user = store.get(`users.${username}`);
    const isAdmin = user?.isParent || user?.isAdmin;
    const avatar = getAvatarDefinitions().find(a => a.id === avatarId);
    if (!avatar) return { success: false };
    // Admin bypasses ownership check; others must own it
    if (!isAdmin) {
        const owned = user.ownedAvatars || [];
        if (avatar.price > 0 && !owned.includes(avatarId)) return { success: false, error: 'צריך לקנות קודם' };
    }
    user.avatar = avatarId;
    store.set(`users.${username}`, user);
    return { success: true, user };
});

ipcMain.handle('customization:equipTheme', (event, themeId) => {
    const username = store.get('currentUser');
    if (!username) return { success: false };
    const user = store.get(`users.${username}`);
    const isAdmin = user?.isParent || user?.isAdmin;
    const theme = getThemeDefinitions().find(t => t.id === themeId);
    if (!theme) return { success: false };
    if (!isAdmin) {
        const owned = user.ownedThemes || [];
        if (theme.price > 0 && !owned.includes(themeId)) return { success: false, error: 'צריך לקנות קודם' };
    }
    user.theme = themeId;
    store.set(`users.${username}`, user);
    return { success: true, user };
});

ipcMain.handle('customization:toggleAnimations', (event, enabled) => {
    const username = store.get('currentUser');
    if (!username) return { success: false };
    store.set(`users.${username}.animationsEnabled`, enabled);
    return { success: true };
});

ipcMain.handle('customization:toggleSound', (event, enabled) => {
    const username = store.get('currentUser');
    if (!username) return { success: false };
    store.set(`users.${username}.soundEnabled`, enabled);
    return { success: true };
});

ipcMain.handle('customization:setVolume', (event, volume) => {
    const username = store.get('currentUser');
    if (!username) return { success: false };
    const clamped = Math.min(1, Math.max(0, Number(volume) || 0));
    store.set(`users.${username}.soundVolume`, clamped);
    return { success: true };
});

ipcMain.handle('customization:generateSvg', (event, { style, seed, bg }) => {
    return generateAvatarDataUri({ style, seed, bg });
});

// ==================== STATS & ACTIVITY LOG ====================
function addPurchaseHistory(username, entry) {
    try {
        const history = store.get(`users.${username}.purchaseHistory`) || [];
        history.unshift({ ...entry, date: new Date().toISOString() });
        if (history.length > 200) history.length = 200;
        store.set(`users.${username}.purchaseHistory`, history);
    } catch (e) { /* non-critical */ }
}

function logActivity(username, type, message, icon) {
    try {
        const log = store.get('activityLog') || [];
        log.unshift({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            username,
            displayName: store.get(`users.${username}.displayName`) || username,
            type,
            message,
            icon: icon || '📌'
        });
        if (log.length > 500) log.length = 500;
        store.set('activityLog', log);
    } catch (e) { /* non-critical */ }
}

function recordDailyStats(username, delta) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const key = `users.${username}.dailyHistory.${today}`;
        const ex = store.get(key) || { questions: 0, correct: 0, coins: 0, timeMinutes: 0 };
        store.set(key, {
            questions: (ex.questions || 0) + (delta.questions || 0),
            correct: (ex.correct || 0) + (delta.correct || 0),
            coins: (ex.coins || 0) + (delta.coins || 0),
            timeMinutes: (ex.timeMinutes || 0) + (delta.timeMinutes || 0)
        });
    } catch (e) { /* non-critical */ }
}

ipcMain.handle('stats:getActivityLog', (event, opts = {}) => {
    const { limit = 100, username } = opts;
    const log = store.get('activityLog') || [];
    const filtered = username ? log.filter(e => e.username === username) : log;
    return filtered.slice(0, limit);
});

ipcMain.handle('stats:getDailyHistory', (event, { username, days = 7 } = {}) => {
    if (!username) return [];
    const history = store.get(`users.${username}.dailyHistory`) || {};
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('he-IL', { weekday: 'short' });
        result.push({ date: key, label, ...(history[key] || { questions: 0, correct: 0, coins: 0, timeMinutes: 0 }) });
    }
    return result;
});

ipcMain.handle('stats:getWeeklyReport', () => {
    const users = store.get('users') || {};
    const report = [];
    for (const [username, user] of Object.entries(users)) {
        if (user.isParent) continue;
        const ws = user.weeklyStats || {};
        const accuracy = user.questionsAnswered > 0 ? Math.round((user.correctAnswers / user.questionsAnswered) * 100) : 0;
        report.push({
            username,
            displayName: user.displayName || username,
            weekQuestions: ws.questionsAnswered || 0,
            weekCoins: ws.coinsEarned || 0,
            totalCoins: user.coins || 0,
            totalQuestions: user.questionsAnswered || 0,
            correctAnswers: user.correctAnswers || 0,
            accuracy,
            tasksCompleted: user.tasksCompletedCount || 0,
            streak: user.streak || 0,
            level: user.level || 1,
            xp: user.xp || 0
        });
    }
    return report;
});

function getDefaultQuestions() {
    try {
        const raw = fs.readFileSync(path.join(__dirname, 'questions-data.json'), 'utf8');
        const weeks = JSON.parse(raw);
        const all = [];
        weeks.forEach(w => {
            if (w.data?.questions) w.data.questions.forEach(q => all.push({ ...q, week: w.week }));
        });
        return all;
    } catch (e) {
        return [
            { id: 1, week: 1, question: 'מהי בירת ישראל?', options: ['תל אביב', 'ירושלים', 'חיפה', 'באר שבע'], correctAnswer: 1 }
        ];
    }
}
