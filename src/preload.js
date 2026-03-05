const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Window controls
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    setBlocking: (blocking) => ipcRenderer.invoke('window:setBlocking', blocking),

    // Users
    users: {
        getAll: () => ipcRenderer.invoke('users:getAll'),
        getCurrent: () => ipcRenderer.invoke('users:getCurrent'),
        login: (credentials) => ipcRenderer.invoke('users:login', credentials),
        register: (userData) => ipcRenderer.invoke('users:register', userData),
        logout: () => ipcRenderer.invoke('users:logout'),
        update: (userData) => ipcRenderer.invoke('users:update', userData),
        updateTime: (remainingTime) => ipcRenderer.invoke('users:updateTime', remainingTime),
        addCoins: (amount) => ipcRenderer.invoke('users:addCoins', amount)
    },

    // Time management
    time: {
        purchase: (data) => ipcRenderer.invoke('time:purchase', data),
        getPrice: () => ipcRenderer.invoke('time:getPrice')
    },

    // Screen lock
    lock: {
        show: () => ipcRenderer.invoke('lock:show'),
        dismiss: (data) => ipcRenderer.invoke('lock:dismiss', data),
        buyTime: (data) => ipcRenderer.invoke('lock:buyTime', data),
        getUserInfo: () => ipcRenderer.invoke('lock:getUserInfo'),
        onDismissed: (callback) => ipcRenderer.on('lock:dismissed', (event, user) => callback(user))
    },

    // Tasks / Missions
    tasks: {
        getAll: () => ipcRenderer.invoke('tasks:getAll'),
        getForUser: (username) => ipcRenderer.invoke('tasks:getForUser', username),
        create: (data) => ipcRenderer.invoke('tasks:create', data),
        requestComplete: (taskId) => ipcRenderer.invoke('tasks:requestComplete', taskId),
        approve: (data) => ipcRenderer.invoke('tasks:approve', data),
        approveAdmin: (data) => ipcRenderer.invoke('tasks:approveAdmin', data),
        rejectAdmin: (data) => ipcRenderer.invoke('tasks:rejectAdmin', data),
        delete: (taskId) => ipcRenderer.invoke('tasks:delete', taskId),
        edit: (data) => ipcRenderer.invoke('tasks:edit', data)
    },

    // Custom Games (parent-managed)
    customGames: {
        getAll: () => ipcRenderer.invoke('customGames:getAll'),
        add: (data) => ipcRenderer.invoke('customGames:add', data),
        edit: (data) => ipcRenderer.invoke('customGames:edit', data),
        delete: (gameId) => ipcRenderer.invoke('customGames:delete', gameId),
        purchase: (gameId) => ipcRenderer.invoke('customGames:purchase', gameId),
        launch: (gameId) => ipcRenderer.invoke('customGames:launch', gameId),
        endSession: () => ipcRenderer.invoke('customGames:endSession'),
        toggleFavorite: (gameId) => ipcRenderer.invoke('customGames:toggleFavorite', gameId),
        getStats: (username) => ipcRenderer.invoke('customGames:getStats', username)
    },

    // Shop (world items)
    shop: {
        getItems: () => ipcRenderer.invoke('shop:getItems'),
        purchase: (itemData) => ipcRenderer.invoke('shop:purchase', itemData),
        getPurchaseHistory: () => ipcRenderer.invoke('shop:getPurchaseHistory'),
        getSiblings: () => ipcRenderer.invoke('shop:getSiblings'),
        giftCoins: (data) => ipcRenderer.invoke('shop:giftCoins', data)
    },

    // Questions
    questions: {
        getAll: () => ipcRenderer.invoke('questions:getAll'),
        getCustom: () => ipcRenderer.invoke('questions:getCustom'),
        addCustom: (data) => ipcRenderer.invoke('questions:addCustom', data),
        editCustom: (id, data) => ipcRenderer.invoke('questions:editCustom', { id, data }),
        deleteCustom: (id) => ipcRenderer.invoke('questions:deleteCustom', id),
        submitAnswer: (data) => ipcRenderer.invoke('questions:submitAnswer', data)
    },

    // Challenges
    challenges: {
        getAll: () => ipcRenderer.invoke('challenges:getAll'),
        create: (data) => ipcRenderer.invoke('challenges:create', data),
        update: (data) => ipcRenderer.invoke('challenges:update', data),
        delete: (challengeId) => ipcRenderer.invoke('challenges:delete', challengeId),
        checkProgress: (challengeId) => ipcRenderer.invoke('challenges:checkProgress', challengeId),
        claim: (challengeId) => ipcRenderer.invoke('challenges:claim', challengeId)
    },

    // Games
    games: {
        launch: (gameId) => ipcRenderer.invoke('games:launch', gameId),
        launchWorld: (username) => ipcRenderer.invoke('games:launchWorld', username),
        stop: (processName) => ipcRenderer.invoke('games:stop', processName)
    },

    // World Items  
    world: {
        getItems: () => ipcRenderer.invoke('world:getItems'),
        addItem: (itemId) => ipcRenderer.invoke('world:addItem', itemId),
        removeItem: (index) => ipcRenderer.invoke('world:removeItem', index),
        clearItems: () => ipcRenderer.invoke('world:clearItems'),
        reorderItems: (newOrder) => ipcRenderer.invoke('world:reorderItems', newOrder),
        sync: () => ipcRenderer.invoke('world:sync')
    },

    // Dialogs
    dialog: {
        selectShortcut: () => ipcRenderer.invoke('dialog:selectShortcut')
    },

    // Settings
    settings: {
        get: () => ipcRenderer.invoke('settings:get'),
        set: (settings) => ipcRenderer.invoke('settings:set', settings),
        verifyPin: (pin) => ipcRenderer.invoke('settings:verifyPin', pin)
    },

    // Admin / Parent
    admin: {
        isAdmin: () => ipcRenderer.invoke('admin:isAdmin'),
        getAllUsersOverview: () => ipcRenderer.invoke('admin:getAllUsersOverview'),
        giveCoins: (username, amount) => ipcRenderer.invoke('admin:giveCoins', { username, amount }),
        setCoins: (username, amount) => ipcRenderer.invoke('admin:setCoins', { username, amount }),
        giveTime: (username, minutes) => ipcRenderer.invoke('admin:giveTime', { username, minutes }),
        setDailyTime: (username, minutes) => ipcRenderer.invoke('admin:setDailyTime', { username, minutes }),
        resetUserProgress: (username, what) => ipcRenderer.invoke('admin:resetUserProgress', { username, what }),
        deleteUser: (username) => ipcRenderer.invoke('admin:deleteUser', username),
        setUserTheme: (username, themeId) => ipcRenderer.invoke('admin:setUserTheme', { username, themeId }),
        createChild: (data) => ipcRenderer.invoke('admin:createChild', data),
        setChildPassword: (data) => ipcRenderer.invoke('admin:setChildPassword', data)
    },

    // Gamification
    gamification: {
        getLevels: () => ipcRenderer.invoke('gamification:getLevels'),
        getAchievementsDefs: () => ipcRenderer.invoke('gamification:getAchievementsDefs'),
        getUserStats: (username) => ipcRenderer.invoke('gamification:getUserStats', username),
        getLeaderboard: () => ipcRenderer.invoke('gamification:getLeaderboard')
    },

    // Custom Parent Achievements & Prizes
    customAchievements: {
        getAll: () => ipcRenderer.invoke('customAchievements:getAll'),
        create: (data) => ipcRenderer.invoke('customAchievements:create', data),
        delete: (id) => ipcRenderer.invoke('customAchievements:delete', id),
        toggle: (id) => ipcRenderer.invoke('customAchievements:toggle', id),
        getProgress: () => ipcRenderer.invoke('customAchievements:getProgress')
    },

    // Game Guard
    gameguard: {
        setGameGuarded: (gameId, guarded) => ipcRenderer.invoke('gameguard:setGameGuarded', { gameId, guarded }),
        setEnabled: (enabled) => ipcRenderer.invoke('gameguard:setEnabled', enabled),
        onBlocked: (callback) => ipcRenderer.on('gameguard:blocked', (event, data) => callback(data))
    },

    // Customization (avatars, themes, animations)
    customization: {
        getAvatars: () => ipcRenderer.invoke('customization:getAvatars'),
        getThemes: () => ipcRenderer.invoke('customization:getThemes'),
        purchaseAvatar: (avatarId) => ipcRenderer.invoke('customization:purchaseAvatar', avatarId),
        purchaseTheme: (themeId) => ipcRenderer.invoke('customization:purchaseTheme', themeId),
        equipAvatar: (avatarId) => ipcRenderer.invoke('customization:equipAvatar', avatarId),
        equipTheme: (themeId) => ipcRenderer.invoke('customization:equipTheme', themeId),
        toggleAnimations: (enabled) => ipcRenderer.invoke('customization:toggleAnimations', enabled),
        toggleSound: (enabled) => ipcRenderer.invoke('customization:toggleSound', enabled),
        setVolume: (volume) => ipcRenderer.invoke('customization:setVolume', volume),
        generateSvg: (style, seed, bg) => ipcRenderer.invoke('customization:generateSvg', { style, seed, bg })
    },
    // Stats & Activity Log
    stats: {
        getActivityLog: (opts) => ipcRenderer.invoke('stats:getActivityLog', opts || {}),
        getDailyHistory: (username, days) => ipcRenderer.invoke('stats:getDailyHistory', { username, days: days || 7 }),
        getWeeklyReport: () => ipcRenderer.invoke('stats:getWeeklyReport')
    },

    // Notifications
    notifications: {
        get: () => ipcRenderer.invoke('notifications:get'),
        markRead: (id) => ipcRenderer.invoke('notifications:markRead', id),
        clear: () => ipcRenderer.invoke('notifications:clear')
    },

    // Birthday
    birthday: {
        setDate: (data) => ipcRenderer.invoke('birthday:setDate', data),
        check: () => ipcRenderer.invoke('birthday:check')
    },

    // Messages
    messages: {
        getForUser: () => ipcRenderer.invoke('messages:getForUser'),
        getLockScreen: () => ipcRenderer.invoke('messages:getLockScreen'),
        create: (data) => ipcRenderer.invoke('messages:create', data),
        delete: (id) => ipcRenderer.invoke('messages:delete', id),
        getAll: () => ipcRenderer.invoke('messages:getAll'),
        dismiss: (id) => ipcRenderer.invoke('messages:dismiss', id)
    },

    // Online Sync
    sync: {
        getStatus: () => ipcRenderer.invoke('sync:getStatus'),
        setupFamily: () => ipcRenderer.invoke('sync:setupFamily'),
        connectFamily: (familyId) => ipcRenderer.invoke('sync:connectFamily', familyId),
        disconnect: () => ipcRenderer.invoke('sync:disconnect'),
        pullNow: () => ipcRenderer.invoke('sync:pullNow'),
        pushNow: () => ipcRenderer.invoke('sync:pushNow'),
        getOnlineStatuses: () => ipcRenderer.invoke('sync:getOnlineStatuses')
    },

    // Onboarding / Initial Setup
    setup: {
        isFirstRun: () => ipcRenderer.invoke('setup:isFirstRun'),
        initialSetup: (data) => ipcRenderer.invoke('setup:initialSetup', data),
        registerAdmin: (data) => ipcRenderer.invoke('setup:registerAdmin', data),
        recoverWithPin: (pin) => ipcRenderer.invoke('setup:recoverWithPin', pin),
        recoverWithFamilyId: (id) => ipcRenderer.invoke('setup:recoverWithFamilyId', id),
        startUninstall: () => ipcRenderer.invoke('setup:startUninstall')
    }
});
