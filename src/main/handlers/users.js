const { store } = require('../store');
const { verifyPassword, hashPassword, isTimeAllowed, logActivity, requireLogin } = require('../helpers');
const { createDefaultUser } = require('../store');
const { startGameGuard, stopGameGuard } = require('../game-guard');
const firebaseSync = require('../firebase-sync');

module.exports = function registerUserHandlers(ipcMain) {
    ipcMain.handle('users:getAll', () => store.get('users'));
    ipcMain.handle('users:getCurrent', () => store.get('currentUser'));

    ipcMain.handle('users:login', (event, { username, password }) => {
        const users = store.get('users');
        if (!users[username]) return { success: false, error: 'שם משתמש או סיסמה שגויים' };
        if (!verifyPassword(password, users[username].password)) {
            return { success: false, error: 'שם משתמש או סיסמה שגויים' };
        }
        const user = users[username];
        // Migrate plaintext password to hash on successful login
        if (!user.password.includes(':')) {
            user.password = hashPassword(password);
            store.set(`users.${username}`, user);
        }
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
        firebaseSync.updatePresence();
        return { success: true, user };
    });

    ipcMain.handle('users:register', (event, { username, password, displayName, parentUsername, parentPassword }) => {
        const users = store.get('users');
        if (users[username]) return { success: false, error: 'שם משתמש כבר קיים' };
        const parentUser = users[parentUsername];
        if (!parentUser || !verifyPassword(parentPassword, parentUser.password) || (!parentUser.isParent && !parentUser.isAdmin)) {
            return { success: false, error: 'פרטי ההורה שגויים או שאין הרשאת הורה' };
        }

        const newUser = createDefaultUser(username, hashPassword(password), displayName || username, {
            remainingTime: store.get('settings.dailyFreeTime'),
            lastLoginDate: new Date().toDateString()
        });
        store.set(`users.${username}`, newUser);
        store.set('currentUser', username);
        return { success: true, user: newUser };
    });

    ipcMain.handle('users:logout', () => {
        firebaseSync.clearPresence();
        store.set('currentUser', null);
        stopGameGuard();
        return { success: true };
    });

    ipcMain.handle('users:update', (event, userData) => {
        const { loggedIn, currentUser, result } = requireLogin();
        if (!loggedIn) return result;
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
        const { loggedIn, currentUser, result } = requireLogin();
        if (!loggedIn) return result;
        const currentCoins = store.get(`users.${currentUser}.coins`) || 0;
        store.set(`users.${currentUser}.coins`, currentCoins + amount);
        return { success: true, newBalance: currentCoins + amount };
    });

    // Time purchase
    ipcMain.handle('time:purchase', (event, { minutes }) => {
        const { loggedIn, currentUser, result } = requireLogin();
        if (!loggedIn) return result;
        const settings = store.get('settings');
        if (!settings.timePurchaseEnabled) return { success: false, error: 'רכישת זמן לא זמינה' };
        const user = store.get(`users.${currentUser}`);
        const cost = minutes * settings.coinsPerMinute;
        if (user.coins < cost) return { success: false, error: 'אין מספיק מטבעות', needed: cost, have: user.coins };
        user.coins -= cost;
        user.remainingTime = (user.remainingTime || 0) + minutes * 60;
        store.set(`users.${currentUser}`, user);
        const { addPurchaseHistory, recordDailyStats } = require('../helpers');
        logActivity(currentUser, 'time', `קנה ${minutes} דקות זמן מחשב`, '⏱️');
        addPurchaseHistory(currentUser, { type: 'time', name: `${minutes} דקות זמן מחשב`, price: cost, icon: '⏱️' });
        recordDailyStats(currentUser, { timeMinutes: minutes });
        return { success: true, user, addedSeconds: minutes * 60, cost };
    });

    ipcMain.handle('time:getPrice', () => {
        return { coinsPerMinute: store.get('settings.coinsPerMinute') };
    });
};
