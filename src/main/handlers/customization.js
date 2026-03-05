const { store } = require('../store');
const { logActivity, addPurchaseHistory, generateAvatarDataUri } = require('../helpers');
const { getAvatarDefinitions } = require('../data/avatars');
const { getThemeDefinitions } = require('../data/themes');

module.exports = function registerCustomizationHandlers(ipcMain) {
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
        if (!isAdmin && avatar.price > 0) {
            logActivity(username, 'customize', `קנה אווטאר "${avatar.name}"`, '🎭');
            addPurchaseHistory(username, { type: 'avatar', name: avatar.name, price: avatar.price, icon: '🎭' });
        }
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
        if (!isAdmin && theme.price > 0) {
            logActivity(username, 'customize', `קנה ערכת נושא "${theme.name}"`, '🎨');
            addPurchaseHistory(username, { type: 'theme', name: theme.name, price: theme.price, icon: '🎨' });
        }
        return { success: true, user };
    });

    ipcMain.handle('customization:equipAvatar', (event, avatarId) => {
        const username = store.get('currentUser');
        if (!username) return { success: false };
        const user = store.get(`users.${username}`);
        const isAdmin = user?.isParent || user?.isAdmin;
        const avatar = getAvatarDefinitions().find(a => a.id === avatarId);
        if (!avatar) return { success: false };
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
};
