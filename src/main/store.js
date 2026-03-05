const Store = require('electron-store');

const DEFAULT_USER_TEMPLATE = {
    coins: 0,
    remainingTime: 35 * 60,
    lastLoginDate: null,
    isAdmin: false,
    isParent: false,
    ownedGames: [],
    ownedItems: [],
    worldItems: [],
    questionsAnswered: 0,
    correctAnswers: 0,
    challengesCompleted: [],
    currentWeek: 1,
    answeredQuestionsInWeek: [],
    completedWeeks: [],
    xp: 0,
    level: 1,
    streak: 0,
    lastStreakDate: null,
    unlockedAchievements: [],
    unlockedCustomAchievements: [],
    tasksCompletedCount: 0,
    consecutiveCorrect: 0,
    totalCoinsEarned: 0,
    weeklyStats: { weekStart: null, questionsAnswered: 0, coinsEarned: 0 }
};

function createDefaultUser(username, password, displayName, overrides = {}) {
    return {
        username,
        password,
        displayName,
        ...DEFAULT_USER_TEMPLATE,
        ...overrides
    };
}

const store = new Store({
    name: 'zmankef-data',
    defaults: {
        users: {},
        tasks: [],
        challenges: [],
        currentUser: null,
        settings: {
            difficulty: 'medium',
            dailyFreeTime: 30 * 60,
            coinsPerMinute: 20,
            coinsPerCorrectAnswer: 2,
            coinsPerReviewAnswer: 3,
            xpPerQuestion: 4,
            xpPerReviewQuestion: 6,
            parentPin: '1234',
            timePurchaseEnabled: true,
            timeWindows: [],
            streakQuotaPerDay: 1,
            streakBonusCoins: 15,
            birthdayBonus: 300,
            onboardingCompleted: false
        },
        customGames: [],
        customAchievements: [],
        familyId: null,
        syncEnabled: false,
        machineId: null
    }
});

module.exports = { store, DEFAULT_USER_TEMPLATE, createDefaultUser };
