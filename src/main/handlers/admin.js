const { store } = require('../store');
const { requireAdmin, logActivity } = require('../helpers');

module.exports = function registerAdminHandlers(ipcMain) {
    ipcMain.handle('admin:isAdmin', () => {
        const currentUser = store.get('currentUser');
        if (!currentUser) return false;
        const user = store.get(`users.${currentUser}`);
        return user?.isParent === true || user?.isAdmin === true;
    });

    ipcMain.handle('admin:getAllUsersOverview', () => {
        const auth = requireAdmin();
        if (!auth.authorized) return { success: false };
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
        const auth = requireAdmin();
        if (!auth.authorized) return { success: false };
        const target = store.get(`users.${username}`);
        if (!target) return { success: false, error: 'משתמש לא נמצא' };
        const newCoins = Math.max(0, (target.coins || 0) + amount);
        store.set(`users.${username}.coins`, newCoins);
        return { success: true, newBalance: newCoins };
    });

    ipcMain.handle('admin:setCoins', (event, { username, amount }) => {
        const auth = requireAdmin();
        if (!auth.authorized) return { success: false };
        const target = store.get(`users.${username}`);
        if (!target) return { success: false, error: 'משתמש לא נמצא' };
        const newCoins = Math.max(0, amount);
        store.set(`users.${username}.coins`, newCoins);
        return { success: true, newBalance: newCoins };
    });

    ipcMain.handle('admin:giveTime', (event, { username, minutes }) => {
        const auth = requireAdmin();
        if (!auth.authorized) return { success: false };
        const target = store.get(`users.${username}`);
        if (!target) return { success: false };
        const newTime = Math.max(0, (target.remainingTime || 0) + (minutes * 60));
        store.set(`users.${username}.remainingTime`, newTime);
        return { success: true, newTime };
    });

    ipcMain.handle('admin:setDailyTime', (event, { username, minutes }) => {
        const auth = requireAdmin();
        if (!auth.authorized) return { success: false };
        store.set(`users.${username}.remainingTime`, minutes * 60);
        return { success: true };
    });

    ipcMain.handle('admin:resetUserProgress', (event, { username, what } = {}) => {
        const auth = requireAdmin();
        if (!auth.authorized) return { success: false };
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

    ipcMain.handle('admin:createChild', (event, { username, password, displayName }) => {
        const auth = requireAdmin();
        if (!auth.authorized) return { success: false, error: 'אין הרשאה' };
        const { hashPassword } = require('../helpers');
        const { createDefaultUser } = require('../store');
        const users = store.get('users') || {};
        if (!username || /\s/.test(username)) return { success: false, error: 'שם משתמש לא יכול להכיל רווחים' };
        if (users[username]) return { success: false, error: 'שם משתמש כבר קיים' };
        if (!password || password.length < 1) return { success: false, error: 'נא להזין סיסמה' };
        const dailyFree = store.get('settings.dailyFreeTime') || 30 * 60;
        const newUser = createDefaultUser(username, hashPassword(password), displayName || username, { remainingTime: dailyFree });
        store.set(`users.${username}`, newUser);
        return { success: true, user: newUser };
    });

    ipcMain.handle('admin:setChildPassword', (event, { username, newPassword }) => {
        const auth = requireAdmin();
        if (!auth.authorized) return { success: false, error: 'אין הרשאה' };
        const { hashPassword } = require('../helpers');
        const users = store.get('users') || {};
        if (!users[username]) return { success: false, error: 'משתמש לא נמצא' };
        if (users[username].isAdmin || users[username].isParent) return { success: false, error: 'לא ניתן לשנות סיסמת מנהל כך' };
        if (!newPassword || newPassword.length < 1) return { success: false, error: 'סיסמה ריקה' };
        store.set(`users.${username}.password`, hashPassword(newPassword));
        return { success: true };
    });

    ipcMain.handle('admin:deleteUser', (event, username) => {
        const auth = requireAdmin();
        if (!auth.authorized) return { success: false };
        if (username === 'admin') return { success: false, error: 'לא ניתן למחוק את ההורה' };
        const users = store.get('users') || {};
        delete users[username];
        store.set('users', users);
        return { success: true };
    });

    ipcMain.handle('admin:setUserTheme', (event, { username, themeId }) => {
        const auth = requireAdmin();
        if (!auth.authorized) return { success: false };
        const user = store.get(`users.${username}`);
        if (!user) return { success: false, error: 'משתמש לא נמצא' };
        if (!user.ownedThemes) user.ownedThemes = [];
        if (!user.ownedThemes.includes(themeId)) user.ownedThemes.push(themeId);
        user.theme = themeId;
        store.set(`users.${username}`, user);
        return { success: true };
    });
};
