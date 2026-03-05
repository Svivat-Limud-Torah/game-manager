const { store } = require('./store');
const { LEVELS, ACHIEVEMENTS } = require('./data/levels');
const { pushNotification } = require('./helpers');

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
        pushNotification(username, {
            type: 'levelup', title: '⭐ עלית דרגה!',
            body: `דרגה ${newLevelData.level} — ${newLevelData.title}`,
            icon: newLevelData.badge || '⭐'
        });
    }
    return { xp: user.xp, level: user.level, leveledUp, levelData: newLevelData };
}

function updateStreak(username) {
    const user = store.get(`users.${username}`);
    if (!user) return;
    const settings = store.get('settings');
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (user.lastStreakDate === today) return;
    if (user.lastStreakDate === yesterday) {
        user.streak = (user.streak || 0) + 1;
    } else if (user.lastStreakDate !== today) {
        user.streak = 1;
    }
    user.lastStreakDate = today;
    const bonusCoins = settings.streakBonusCoins || 0;
    if (bonusCoins > 0 && user.streak > 1) {
        user.coins = (user.coins || 0) + bonusCoins;
        user.totalCoinsEarned = (user.totalCoinsEarned || 0) + bonusCoins;
        const { logActivity } = require('./helpers');
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
        newAchievements.forEach(a => pushNotification(username, {
            type: 'achievement', title: '🏅 הישג חדש!',
            body: `${a.icon} ${a.title} — ${a.desc}`, icon: a.icon
        }));
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
        newlyUnlocked.forEach(a => pushNotification(username, {
            type: 'achievement', title: '🎯 פרס חדש!',
            body: `${a.icon} ${a.title}${a.coinReward ? ' +' + a.coinReward + ' 💰' : ''}`, icon: a.icon
        }));
    }
    return newlyUnlocked;
}

function resetWeeklyStatsIfNeeded(username) {
    const user = store.get(`users.${username}`);
    if (!user) return;
    const now = new Date();
    const day = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - day);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toDateString();
    if (!user.weeklyStats || user.weeklyStats.weekStart !== weekStartStr) {
        user.weeklyStats = { weekStart: weekStartStr, questionsAnswered: 0, coinsEarned: 0 };
        store.set(`users.${username}`, user);
    }
}

module.exports = {
    LEVELS, ACHIEVEMENTS,
    getLevelForXP, getNextLevel, addXP, updateStreak,
    checkAchievements, checkCustomAchievements, resetWeeklyStatsIfNeeded
};
