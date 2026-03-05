const { store } = require('../store');

module.exports = function registerStatsHandlers(ipcMain) {
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
                username, displayName: user.displayName || username,
                weekQuestions: ws.questionsAnswered || 0, weekCoins: ws.coinsEarned || 0,
                totalCoins: user.coins || 0, totalQuestions: user.questionsAnswered || 0,
                correctAnswers: user.correctAnswers || 0, accuracy,
                tasksCompleted: user.tasksCompletedCount || 0, streak: user.streak || 0,
                level: user.level || 1, xp: user.xp || 0
            });
        }
        return report;
    });
};
