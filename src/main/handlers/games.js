const path = require('path');
const fs = require('fs');
const { shell } = require('electron');
const { store } = require('../store');
const { requireAdmin, requireLogin, logActivity, addPurchaseHistory, getAppPath, syncToUnity } = require('../helpers');

module.exports = function registerGameHandlers(ipcMain) {
    // Custom Games CRUD
    ipcMain.handle('customGames:getAll', () => {
        const games = store.get('customGames') || [];
        const now = Date.now();
        const valid = games.filter(g => !g.expiresAt || new Date(g.expiresAt).getTime() > now);
        if (valid.length !== games.length) store.set('customGames', valid);
        return valid;
    });

    ipcMain.handle('customGames:add', (event, gameData) => {
        const auth = requireAdmin('רק הורה יכול להוסיף משחקים');
        if (!auth.authorized) return auth.result;
        const games = store.get('customGames') || [];
        const newGame = {
            id: `game_${Date.now()}`, name: gameData.name, exePath: gameData.exePath,
            price: gameData.price || 100, icon: gameData.icon || '🎮',
            description: gameData.description || '', category: gameData.category || 'other',
            addedAt: new Date().toISOString(),
            expiresAt: gameData.expiryDays > 0 ? new Date(Date.now() + gameData.expiryDays * 86400000).toISOString() : null
        };
        games.push(newGame);
        store.set('customGames', games);
        return { success: true, game: newGame };
    });

    ipcMain.handle('customGames:edit', (event, { gameId, data }) => {
        const auth = requireAdmin('רק הורה יכול לערוך משחקים');
        if (!auth.authorized) return auth.result;
        const games = store.get('customGames') || [];
        const index = games.findIndex(g => g.id === gameId);
        if (index === -1) return { success: false, error: 'משחק לא נמצא' };
        const expiresAt = data.expiryDays > 0 ? new Date(Date.now() + data.expiryDays * 86400000).toISOString() : null;
        games[index] = { ...games[index], ...data, expiresAt };
        store.set('customGames', games);
        return { success: true, game: games[index] };
    });

    ipcMain.handle('customGames:delete', (event, gameId) => {
        const auth = requireAdmin('רק הורה יכול למחוק משחקים');
        if (!auth.authorized) return auth.result;
        store.set('customGames', (store.get('customGames') || []).filter(g => g.id !== gameId));
        return { success: true };
    });

    ipcMain.handle('customGames:purchase', (event, gameId) => {
        const { loggedIn, currentUser, result } = requireLogin();
        if (!loggedIn) return result;
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
            // Flush existing session
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
            store.set(`gameSessions.${currentUser}`, { gameId, startTime: Date.now() });
            const stats = store.get(`gameStats.${currentUser}`) || {};
            if (!stats[gameId]) stats[gameId] = { totalMinutes: 0, launchCount: 0 };
            stats[gameId].lastPlayed = new Date().toISOString();
            stats[gameId].launchCount = (stats[gameId].launchCount || 0) + 1;
            store.set(`gameStats.${currentUser}`, stats);
        }

        try { await shell.openPath(game.exePath); return { success: true }; }
        catch (error) { return { success: false, error: error.message }; }
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
        const { loggedIn, currentUser, result } = requireLogin();
        if (!loggedIn) return result;
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

    // Game launch
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
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            exec(`taskkill /F /IM "${processName}"`, (error) => resolve({ success: !error }));
        });
    });

    // World items
    ipcMain.handle('world:getItems', () => {
        const currentUser = store.get('currentUser');
        if (!currentUser) return { success: false };
        const user = store.get(`users.${currentUser}`);
        return { success: true, worldItems: user.worldItems || [], ownedItems: user.ownedItems || [] };
    });

    ipcMain.handle('world:addItem', (event, itemId) => {
        const { loggedIn, currentUser, result } = requireLogin();
        if (!loggedIn) return result;
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
};
