const { store } = require('../store');
const { hashPassword } = require('../helpers');
const { createDefaultUser } = require('../store');

module.exports = function registerSetupHandlers(ipcMain) {

    ipcMain.handle('setup:isFirstRun', () => {
        const users = store.get('users') || {};
        return !Object.values(users).some(u => u.isAdmin || u.isParent);
    });

    ipcMain.handle('setup:registerAdmin', (event, { username, password, parentPin }) => {
        const users = store.get('users') || {};
        const adminExists = Object.values(users).some(u => u.isAdmin || u.isParent);
        if (adminExists) return { success: false, error: 'כבר קיים חשבון מנהל במחשב זה' };
        if (!username || /\s/.test(username)) return { success: false, error: 'שם משתמש לא יכול להכיל רווחים' };
        if (users[username]) return { success: false, error: 'שם משתמש כבר קיים' };
        if (!password || password.length < 3) return { success: false, error: 'סיסמה חייבת להיות לפחות 3 תווים' };
        if (!parentPin || !/^\d{4}$/.test(parentPin)) return { success: false, error: 'קוד הורים חייב להיות 4 ספרות בדיוק' };
        const adminUser = createDefaultUser(username, hashPassword(password), username, {
            coins: 99999, remainingTime: 9999 * 60, isAdmin: true, isParent: true
        });
        store.set(`users.${username}`, adminUser);
        store.set('settings.parentPin', parentPin);
        store.set('settings.onboardingCompleted', false);
        store.set('currentUser', username);
        return { success: true, user: store.get(`users.${username}`) };
    });

    // Recovery: login as admin using PIN
    ipcMain.handle('setup:recoverWithPin', (event, pin) => {
        const storedPin = store.get('settings.parentPin');
        if (!pin || pin !== storedPin) return { success: false, error: 'קוד PIN שגוי' };
        const users = store.get('users') || {};
        const adminUser = Object.values(users).find(u => u.isAdmin || u.isParent);
        if (!adminUser) return { success: false, error: 'לא נמצא חשבון מנהל' };
        store.set('currentUser', adminUser.username);
        return { success: true, user: adminUser };
    });

    // Recovery: login as admin using family sync code
    ipcMain.handle('setup:recoverWithFamilyId', (event, familyId) => {
        const storedFamilyId = store.get('familyId');
        if (!familyId || !storedFamilyId) return { success: false, error: 'אין קוד משפחה שמור במכשיר זה' };
        if (familyId.trim() !== storedFamilyId.trim()) return { success: false, error: 'קוד משפחה שגוי' };
        const users = store.get('users') || {};
        const adminUser = Object.values(users).find(u => u.isAdmin || u.isParent);
        if (!adminUser) return { success: false, error: 'לא נמצא חשבון מנהל' };
        store.set('currentUser', adminUser.username);
        return { success: true, user: adminUser };
    });

};
