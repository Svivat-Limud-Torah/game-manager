// ==================== Global State ====================
// Centralized mutable state for the renderer

let currentUser = null;
let currentSection = 'dashboard';
let timerInterval = null;
let timeWindowGuardInterval = null;
let isRestrictedMode = false;
let _timeWindows = [];
let editingQuestionId = null;
let questionsData = [];
let currentQuestionIndex = 0;
let isReviewMode = false;
let shopItems = null;
let customGames = [];
let gameStats = {};
let myGamesFilter = 'all';
let editingTaskId = null;
let editingGameId = null;
let pinResolve = null;
let achievementsDefs = null;
let currentLeaderboardTab = 'xp';
let soundEnabled = true;
let soundVolume = 0.8;
const soundCache = {};
let stickerDragMode = false;
let avatarDefs = null;
let themeDefs = null;
let currentAvatarFilter = 'all';
let notifPollInterval = null;
let historyChart = null;
let dashWeeklyChart = null;
let dashTasksChart = null;
let dashAccuracyChart = null;
let currentHistoryMetric = 'questions';
let statsHistoryData = null;
let coinsModalTarget = null;
let timeModalTarget = null;
let resetModalTarget = null;
let questionOptions = [];
let currentItemCategory = 'all';
let rewardsCurrentView = 'list';
let _confirmResolve = null;

// ==================== Constants ====================

const STICKER_FOLDERS = { space: 'Space', pink: 'Girl', fire: 'Fire' };

const CATEGORY_LABELS = {
    educational: '📚 חינוכי',
    adventure: '⚔️ הרפתקאות',
    sports: '⚽ ספורט',
    puzzles: '🧩 פאזלים',
    other: '🎲 אחר'
};

const GOAL_TYPE_LABELS = {
    questions:    '❓ שאלות שנענו',
    correct:      '✅ תשובות נכונות',
    consecutive:  '🔥 ברצף נכונות',
    tasks:        '📋 משימות הושלמו',
    streak:       '🔥 ימי רצף',
    xp:           '⭐ XP שנצבר',
    level:        '🏆 דרגה שהושגה',
    coins_earned: '💰 מטבעות שנצברו'
};

const SOUND_MAP = {
    correct:     '../../Sound Effects/answer correct.wav',
    wrong:       '../../Sound Effects/mixkit-player-losing-or-failing-2042.wav',
    levelup:     '../../Sound Effects/level up.wav',
    achievement: '../../Sound Effects/mixkit-unlock-new-item-game-notification-254.wav',
    task:        '../../Sound Effects/comple task - better.wav',
    coins:       '../../Sound Effects/mixkit-winning-a-coin-video-game-2069.wav',
    buy:         '../../Sound Effects/buying item.wav',
    buytime:     '../../Sound Effects/spending money on time.wav',
    timeover:    '../../Sound Effects/time is over.wav',
    birthday:    '../../Sound Effects/mixkit-extra-bonus-in-a-video-game-2045.wav',
    click:       '../../Sound Effects/mouse click.wav',
    notification:'../../Sound Effects/mixkit-retro-arcade-casino-notification-211.wav',
    fanfare:     '../../Sound Effects/mixkit-medieval-show-fanfare-announcement-226.wav',
    bling:       '../../Sound Effects/mixkit-arcade-mechanical-bling-210.wav',
};

const STICKER_ZONE_MAP = {
    'bl-1':  { parent: 'body', css: 'position:fixed;bottom:28px;left:20px;'   },
    'bl-2':  { parent: 'body', css: 'position:fixed;bottom:100px;left:48px;'  },
    'bl-3':  { parent: 'body', css: 'position:fixed;bottom:172px;left:16px;'  },
    'bl-4':  { parent: 'body', css: 'position:fixed;bottom:54px;left:98px;'   },
    'bl-5':  { parent: 'body', css: 'position:fixed;bottom:138px;left:84px;'  },
    'bl-6':  { parent: 'body', css: 'position:fixed;bottom:212px;left:55px;'  },
    'bl-7':  { parent: 'body', css: 'position:fixed;bottom:82px;left:145px;'  },
    'bl-8':  { parent: 'body', css: 'position:fixed;bottom:188px;left:118px;' },
    'bl-9':  { parent: 'body', css: 'position:fixed;bottom:262px;left:30px;'  },
    'bl-10': { parent: 'body', css: 'position:fixed;bottom:244px;left:100px;' },
};
