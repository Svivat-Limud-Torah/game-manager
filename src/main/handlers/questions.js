const path = require('path');
const fs = require('fs');
const { store } = require('../store');
const { requireAdmin, requireLogin, logActivity, recordDailyStats, pushNotification } = require('../helpers');
const { addXP, updateStreak, checkAchievements, checkCustomAchievements, resetWeeklyStatsIfNeeded } = require('../gamification');

function getDefaultQuestions() {
    try {
        const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'questions-data.json'), 'utf8');
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

module.exports = function registerQuestionHandlers(ipcMain) {
    ipcMain.handle('questions:getAll', () => {
        const defaults = getDefaultQuestions();
        const custom = store.get('customQuestions') || [];
        return [...defaults, ...custom];
    });

    ipcMain.handle('questions:getCustom', () => store.get('customQuestions') || []);

    ipcMain.handle('questions:addCustom', (event, data) => {
        const auth = requireAdmin('אין הרשאת הורה');
        if (!auth.authorized) return auth.result;
        if (!data.question?.trim()) return { success: false, error: 'חסר טקסט לשאלה' };
        if (!Array.isArray(data.options) || data.options.length < 2) return { success: false, error: 'נדרשות לפחות 2 תשובות' };
        if (typeof data.correctAnswer !== 'number') return { success: false, error: 'חסרה תשובה נכונה' };
        const custom = store.get('customQuestions') || [];
        const newQ = {
            id: `cq_${Date.now()}`, question: data.question.trim(),
            options: data.options.map(o => String(o).trim()), correctAnswer: data.correctAnswer,
            explanation: data.explanation?.trim() || null, subject: data.subject?.trim() || null,
            createdAt: new Date().toISOString(), createdBy: auth.currentUser, isCustom: true
        };
        custom.push(newQ);
        store.set('customQuestions', custom);
        return { success: true, question: newQ };
    });

    ipcMain.handle('questions:editCustom', (event, { id, data }) => {
        const auth = requireAdmin('אין הרשאת הורה');
        if (!auth.authorized) return auth.result;
        const custom = store.get('customQuestions') || [];
        const index = custom.findIndex(q => q.id === id);
        if (index === -1) return { success: false, error: 'שאלה לא נמצאה' };
        custom[index] = { ...custom[index], ...data, id: custom[index].id, isCustom: true };
        store.set('customQuestions', custom);
        return { success: true, question: custom[index] };
    });

    ipcMain.handle('questions:deleteCustom', (event, id) => {
        const auth = requireAdmin('אין הרשאת הורה');
        if (!auth.authorized) return auth.result;
        store.set('customQuestions', (store.get('customQuestions') || []).filter(q => q.id !== id));
        return { success: true };
    });

    ipcMain.handle('questions:submitAnswer', (event, { questionId, answer, isReview }) => {
        const { loggedIn, currentUser, result } = requireLogin();
        if (!loggedIn) return result;
        const questions = [...getDefaultQuestions(), ...(store.get('customQuestions') || [])];
        const question = questions.find(q => q.id === questionId);
        if (!question) return { success: false, error: 'שאלה לא נמצאה' };

        const isCorrect = question.correctAnswer === answer;
        const user = store.get(`users.${currentUser}`);
        user.questionsAnswered = (user.questionsAnswered || 0) + 1;

        // Review mode: each question can only award coins/XP once per calendar day
        let alreadyReviewedToday = false;
        if (isReview) {
            const today = new Date().toDateString();
            let rt = user.reviewedToday || {};
            if (rt.date !== today) rt = { date: today, ids: [] };
            const qIdStr = String(questionId);
            alreadyReviewedToday = rt.ids.includes(qIdStr);
            if (!alreadyReviewedToday) rt.ids.push(qIdStr);
            user.reviewedToday = rt;
        }

        const settings = store.get('settings');
        const baseCoins = isReview
            ? (settings.coinsPerReviewAnswer || 3)
            : (settings.coinsPerCorrectAnswer || 2);
        const baseXP = isReview
            ? (settings.xpPerReviewQuestion || 6)
            : (settings.xpPerQuestion || 4);

        const coinsReward = (isReview && alreadyReviewedToday) ? 0 : baseCoins;
        let xpGained = 0;

        if (isCorrect) {
            user.correctAnswers = (user.correctAnswers || 0) + 1;
            user.coins += coinsReward;
            user.totalCoinsEarned = (user.totalCoinsEarned || 0) + coinsReward;
            user.consecutiveCorrect = (user.consecutiveCorrect || 0) + 1;
            xpGained = (isReview && alreadyReviewedToday) ? 0 : baseXP;
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
            xpGained, xpResult, newAchievements, newCustomAchievements, alreadyReviewedToday
        };
    });

    // Challenges
    ipcMain.handle('challenges:getAll', () => store.get('challenges') || []);

    ipcMain.handle('challenges:create', (event, challengeData) => {
        const auth = requireAdmin('אין הרשאת הורה');
        if (!auth.authorized) return auth.result;
        const challenges = store.get('challenges') || [];
        challenges.push({ id: `challenge_${Date.now()}`, ...challengeData, createdAt: new Date().toISOString() });
        store.set('challenges', challenges);
        return { success: true };
    });

    ipcMain.handle('challenges:update', (event, { id, data }) => {
        const auth = requireAdmin('אין הרשאת הורה');
        if (!auth.authorized) return auth.result;
        const challenges = store.get('challenges') || [];
        const index = challenges.findIndex(c => c.id === id);
        if (index === -1) return { success: false, error: 'אתגר לא נמצא' };
        challenges[index] = { ...challenges[index], ...data };
        store.set('challenges', challenges);
        return { success: true };
    });

    ipcMain.handle('challenges:delete', (event, challengeId) => {
        const auth = requireAdmin('אין הרשאת הורה');
        if (!auth.authorized) return auth.result;
        store.set('challenges', (store.get('challenges') || []).filter(c => c.id !== challengeId));
        return { success: true };
    });

    ipcMain.handle('challenges:checkProgress', (event, challengeId) => {
        const { loggedIn, currentUser, result } = requireLogin();
        if (!loggedIn) return result;
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
        const { loggedIn, currentUser, result } = requireLogin();
        if (!loggedIn) return result;
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
};
