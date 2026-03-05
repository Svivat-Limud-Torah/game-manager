// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', async () => {
    setupAuthForms();
    setupNavigation();
    setupTimePurchase();
    setupTaskActions();
    setupGameActions();
    setupAdminTabs();
    setupQuestionModes();
    setupShopTabs();
    setupSettingsActions();
    setupLeaderboardTabs();
    setupCustomizationTabs();
    setupStatsTabs();
    setupGameFilters();
    loadLockScreenMessages();
    startClock();
    setupTooltips();
    
    // Pre-load achievements definitions  
    window.api.gamification.getAchievementsDefs().then(defs => { achievementsDefs = defs; });

    // Game Guard — listen for blocked events from main process
    window.api.gameguard.onBlocked((data) => {
        showToast(`🚫 המשחק "${data.gameName}" נחסם — צריך לקנות אותו כדי לשחק!`, 'error', 5000);
    });
    
    // Hide "Register" link if an admin already exists on this machine
    window.api.setup.isFirstRun().then(isFirst => {
        if (!isFirst) document.getElementById('show-register')?.parentElement?.classList.add('hidden');
    });

    // Check if already logged in
    const username = await window.api.users.getCurrent();
    if (username) {
        const users = await window.api.users.getAll();
        if (users[username]) {
            currentUser = users[username];
            showMainScreen();
        }
    }
});
