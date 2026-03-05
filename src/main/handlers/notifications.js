const { store } = require('../store');
const { requireAdmin, pushNotification, logActivity } = require('../helpers');
const { createLockScreen, closeLockScreen } = require('../lock-screen');
const state = require('../app-state');

module.exports = function registerNotificationHandlers(ipcMain) {
    // Notifications
    ipcMain.handle('notifications:get', () => {
        const currentUser = store.get('currentUser');
        if (!currentUser) return [];
        return store.get(`notifications.${currentUser}`) || [];
    });

    ipcMain.handle('notifications:markRead', (event, id) => {
        const currentUser = store.get('currentUser');
        if (!currentUser) return;
        const notifs = store.get(`notifications.${currentUser}`) || [];
        if (id === 'all') { notifs.forEach(n => n.read = true); }
        else { const n = notifs.find(x => x.id === id); if (n) n.read = true; }
        store.set(`notifications.${currentUser}`, notifs);
        return true;
    });

    ipcMain.handle('notifications:clear', () => {
        const currentUser = store.get('currentUser');
        if (!currentUser) return;
        store.set(`notifications.${currentUser}`, []);
    });

    // Birthday
    ipcMain.handle('birthday:setDate', (event, { username, date }) => {
        const auth = requireAdmin();
        if (!auth.authorized) return auth.result;
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

    // Messages
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
        const auth = requireAdmin();
        if (!auth.authorized) return auth.result;
        const messages = store.get('messages') || [];
        const msg = {
            id: `msg_${Date.now()}`,
            text: data.text?.trim(),
            target: data.target || 'all',
            showOnLock: data.showOnLock || false,
            createdAt: new Date().toISOString(),
            expiresAt: data.expiryHours > 0
                ? new Date(Date.now() + data.expiryHours * 3600000).toISOString()
                : null,
            createdBy: auth.currentUser
        };
        if (!msg.text) return { success: false, error: 'הודעה ריקה' };
        messages.push(msg);
        store.set('messages', messages);
        const users = store.get('users');
        Object.keys(users).forEach(uname => {
            if (users[uname].isParent || users[uname].isAdmin) return;
            if (msg.target !== 'all' && msg.target !== uname) return;
            pushNotification(uname, { type: 'message', title: '📢 הודעה חדשה מההורה', body: msg.text, icon: '📢' });
        });
        return { success: true, message: msg };
    });

    ipcMain.handle('messages:delete', (event, id) => {
        const auth = requireAdmin();
        if (!auth.authorized) return auth.result;
        store.set('messages', (store.get('messages') || []).filter(m => m.id !== id));
        return { success: true };
    });

    ipcMain.handle('messages:getAll', () => {
        const auth = requireAdmin();
        if (!auth.authorized) return [];
        return store.get('messages') || [];
    });

    ipcMain.handle('messages:dismiss', (event, id) => {
        const currentUser = store.get('currentUser');
        if (!currentUser) return;
        const dismissed = store.get(`dismissedMessages.${currentUser}`) || [];
        if (!dismissed.includes(id)) { dismissed.push(id); store.set(`dismissedMessages.${currentUser}`, dismissed); }
        return true;
    });

    // Lock screen
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
        if (state.mainWindow) state.mainWindow.webContents.send('lock:dismissed', user);
        return { success: true, user };
    });

    ipcMain.handle('lock:getUserInfo', () => {
        const currentUser = store.get('currentUser');
        if (!currentUser) return null;
        const user = store.get(`users.${currentUser}`);
        return { coins: user.coins, coinsPerMinute: store.get('settings.coinsPerMinute'), displayName: user.displayName };
    });
};
