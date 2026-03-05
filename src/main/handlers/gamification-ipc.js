const { store } = require('../store');
const { requireAdmin } = require('../helpers');
const { getLevelForXP, getNextLevel, checkCustomAchievements } = require('../gamification');
const { LEVELS, ACHIEVEMENTS } = require('../data/levels');
const { startGameGuard, stopGameGuard } = require('../game-guard');

module.exports = function registerGamificationHandlers(ipcMain) {
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
            success: true, username: target,
            displayName: user.displayName || target, avatar: user.avatar || 'cat_1',
            coins: user.coins || 0, correctAnswers: user.correctAnswers || 0,
            questionsAnswered: user.questionsAnswered || 0, xp: user.xp || 0,
            level: levelData.level, levelTitle: levelData.title, levelBadge: levelData.badge,
            nextLevelXP: nextLevel ? nextLevel.xpRequired : null,
            streak: user.streak || 0, lastStreakDate: user.lastStreakDate,
            unlockedAchievements: user.unlockedAchievements || [],
            consecutiveCorrect: user.consecutiveCorrect || 0,
            tasksCompletedCount: user.tasksCompletedCount || 0,
            totalCoinsEarned: user.totalCoinsEarned || 0,
            weeklyStats: user.weeklyStats || { weekStart: null, questionsAnswered: 0, coinsEarned: 0 },
            equippedTheme: user.theme || 'dark'
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
                username: u.username, displayName: u.displayName,
                xp: u.xp || 0, level: levelData.level, levelBadge: levelData.badge, levelTitle: levelData.title,
                coins: u.coins || 0, streak: u.streak || 0,
                correctAnswers: u.correctAnswers || 0, questionsAnswered: u.questionsAnswered || 0,
                tasksCompleted: completedTasks, totalCoinsEarned: u.totalCoinsEarned || 0,
                unlockedAchievements: (u.unlockedAchievements || []).length,
                weeklyStats: u.weeklyStats || { weekStart: null, questionsAnswered: 0, coinsEarned: 0 }
            };
        }).sort((a, b) => b.xp - a.xp);
    });

    // Custom achievements
    ipcMain.handle('customAchievements:getAll', () => store.get('customAchievements') || []);

    ipcMain.handle('customAchievements:create', (event, data) => {
        const auth = requireAdmin('אין הרשאת הורה');
        if (!auth.authorized) return auth.result;
        if (!data.title || !data.goalType || !data.goalValue) return { success: false, error: 'נתונים חסרים' };
        const achs = store.get('customAchievements') || [];
        const newAch = {
            id: `custom_${Date.now()}`, title: data.title, desc: data.desc || '',
            icon: data.icon || '🎯', goalType: data.goalType, goalValue: Number(data.goalValue),
            coinReward: Number(data.coinReward) || 0, assignedTo: data.assignedTo || 'all',
            active: true, createdAt: new Date().toISOString()
        };
        achs.push(newAch);
        store.set('customAchievements', achs);
        return { success: true, achievement: newAch };
    });

    ipcMain.handle('customAchievements:delete', (event, id) => {
        const auth = requireAdmin('אין הרשאת הורה');
        if (!auth.authorized) return auth.result;
        store.set('customAchievements', (store.get('customAchievements') || []).filter(a => a.id !== id));
        return { success: true };
    });

    ipcMain.handle('customAchievements:toggle', (event, id) => {
        const auth = requireAdmin('אין הרשאת הורה');
        if (!auth.authorized) return auth.result;
        const achs = store.get('customAchievements') || [];
        const idx = achs.findIndex(a => a.id === id);
        if (idx < 0) return { success: false };
        achs[idx].active = !achs[idx].active;
        store.set('customAchievements', achs);
        return { success: true, active: achs[idx].active };
    });

    ipcMain.handle('customAchievements:getProgress', () => {
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

    // Game guard settings
    ipcMain.handle('gameguard:setGameGuarded', (event, { gameId, guarded }) => {
        const auth = requireAdmin();
        if (!auth.authorized) return { success: false };
        const games = store.get('customGames') || [];
        const idx = games.findIndex(g => g.id === gameId);
        if (idx < 0) return { success: false };
        games[idx].guarded = guarded;
        store.set('customGames', games);
        return { success: true };
    });

    ipcMain.handle('gameguard:setEnabled', (event, enabled) => {
        const auth = requireAdmin();
        if (!auth.authorized) return { success: false };
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
};
