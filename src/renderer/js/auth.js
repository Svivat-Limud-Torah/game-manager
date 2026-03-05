// ==================== Authentication ====================

function setupAuthForms() {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        if (!username || !password) return;

        const result = await window.api.users.login({ username, password });
        if (result.success) {
            currentUser = result.user;
            showMainScreen();
        } else {
            showAuthError(result.error);
        }
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const parentPin = document.getElementById('register-pin').value.trim();
        if (!username || !password || !parentPin) return;

        const result = await window.api.setup.registerAdmin({ username, password, parentPin });
        if (result.success) {
            currentUser = result.user;
            _hideRegisterForm();
            showMainScreen();
        } else {
            showAuthError(result.error);
        }
    });

    document.getElementById('show-register').addEventListener('click', async (e) => {
        e.preventDefault();
        const isFirst = await window.api.setup.isFirstRun();
        if (!isFirst) {
            showAuthError('כבר קיים חשבון מנהל. אנא התחבר עם הפרטים שלך.');
            return;
        }
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
        document.querySelector('.auth-switch').classList.add('hidden');
        document.getElementById('show-login-text').classList.remove('hidden');
    });

    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        _hideRegisterForm();
    });

    document.getElementById('show-forgot').addEventListener('click', (e) => {
        e.preventDefault();
        _showRecoveryPanel();
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await window.api.users.logout();
        stopTimer();
        stopTimeWindowGuard();
        if (notifPollInterval) { clearInterval(notifPollInterval); notifPollInterval = null; }
        currentUser = null;
        await window.api.setBlocking(true);
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('main-screen').classList.remove('active');
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('notif-dropdown')?.classList.add('hidden');
        document.getElementById('msg-banner-container').innerHTML = '';
        loadLockScreenMessages();
    });
}

function _hideRegisterForm() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.querySelector('.auth-switch').classList.remove('hidden');
    document.getElementById('show-login-text').classList.add('hidden');
    document.getElementById('register-pin').value = '';
    document.getElementById('register-username').value = '';
    document.getElementById('register-password').value = '';
}

// ==================== Password Recovery ====================

function _showRecoveryPanel() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('recovery-panel').classList.remove('hidden');
    document.getElementById('forgot-link-row').classList.add('hidden');
    document.querySelector('.auth-switch').classList.add('hidden');
    document.getElementById('show-login-text').classList.add('hidden');
    // Reset to stage 1
    document.getElementById('recovery-stage-pin').classList.remove('hidden');
    document.getElementById('recovery-stage-family').classList.add('hidden');
    document.getElementById('recovery-stage-reinstall').classList.add('hidden');
    document.getElementById('recovery-pin').value = '';
    document.getElementById('recovery-family-id').value = '';
    document.getElementById('recovery-error').classList.add('hidden');
}

function cancelRecovery() {
    document.getElementById('recovery-panel').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('forgot-link-row').classList.remove('hidden');
    document.querySelector('.auth-switch').classList.remove('hidden');
}

async function submitRecoveryPin() {
    const pin = document.getElementById('recovery-pin').value.trim();
    if (!pin) return;
    const result = await window.api.setup.recoverWithPin(pin);
    if (result.success) {
        currentUser = result.user;
        document.getElementById('recovery-panel').classList.add('hidden');
        showMainScreen();
    } else {
        // Move to stage 2
        document.getElementById('recovery-stage-pin').classList.add('hidden');
        document.getElementById('recovery-stage-family').classList.remove('hidden');
        document.getElementById('recovery-error').textContent = result.error || 'קוד PIN שגוי';
        document.getElementById('recovery-error').classList.remove('hidden');
    }
}

async function submitRecoveryFamily() {
    const familyId = document.getElementById('recovery-family-id').value.trim();
    if (!familyId) return;
    const result = await window.api.setup.recoverWithFamilyId(familyId);
    if (result.success) {
        currentUser = result.user;
        document.getElementById('recovery-panel').classList.add('hidden');
        showMainScreen();
    } else {
        // Move to stage 3 (uninstall option)
        document.getElementById('recovery-stage-family').classList.add('hidden');
        document.getElementById('recovery-stage-reinstall').classList.remove('hidden');
        document.getElementById('recovery-error').textContent = result.error || 'קוד משפחה שגוי';
        document.getElementById('recovery-error').classList.remove('hidden');
    }
}

// ==================== Uninstall (point of no return) ====================

function startUninstallCountdown() {
    // Hide the recovery panel completely — no cancel from this point
    document.getElementById('recovery-panel').classList.add('hidden');
    const overlay = document.getElementById('uninstall-overlay');
    overlay.style.display = 'flex';
    overlay.classList.remove('hidden');

    let count = 5;
    const el = document.getElementById('uninstall-countdown');
    el.textContent = count;

    const interval = setInterval(() => {
        count--;
        el.textContent = count > 0 ? count : '...';
        if (count <= 0) {
            clearInterval(interval);
            window.api.setup.startUninstall();
        }
    }, 1000);
}

function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

function showLoginNotice(msg) {
    const el = document.getElementById('login-notice');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
}

// ==================== Main Screen ====================

async function showMainScreen() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    document.getElementById('login-notice')?.classList.add('hidden');

    const isAdmin = await window.api.admin.isAdmin();
    document.getElementById('admin-nav').classList.toggle('hidden', !isAdmin);

    isRestrictedMode = !currentUser.isParent && !currentUser.isAdmin && (currentUser.remainingTime || 0) <= 0;
    applyRestrictedMode();

    if (!isRestrictedMode || currentUser.isParent || currentUser.isAdmin) {
        await window.api.setBlocking(false);
    }

    refreshUI();
    applyUserTheme();
    applyAnimationPref();
    soundEnabled = currentUser?.soundEnabled !== false;
    soundVolume = currentUser?.soundVolume !== undefined ? currentUser.soundVolume : 0.8;
    updateVolumeIcon();
    playSound('bling');
    if (!isRestrictedMode) startTimer();
    if (!currentUser.isParent && !currentUser.isAdmin) startTimeWindowGuard();
    navigateTo('dashboard');
    refreshNotificationBell();
    if (notifPollInterval) clearInterval(notifPollInterval);
    notifPollInterval = setInterval(refreshNotificationBell, 30000);
    checkBirthday();
    loadUserMessages();

    // Show informational onboarding for first-time admin
    if (currentUser.isAdmin || currentUser.isParent) {
        window.api.settings.get().then(settings => {
            if (settings && settings.onboardingCompleted === false) {
                showOnboarding();
            }
        });
    }
}

function applyRestrictedMode() {
    const banner = document.getElementById('restricted-banner');
    if (banner) banner.classList.toggle('hidden', !isRestrictedMode);
}

async function doLogoutDueToTimeExpiry() {
    playSound('timeover');
    await window.api.setBlocking(true);
    await window.api.users.logout();
    currentUser = null;
    isRestrictedMode = false;
    document.getElementById('main-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    showLoginNotice('⏱️ נגמר הזמן שלך להיום! כנס שוב כדי לענות שאלות ולרכוש זמן נוסף.');
}
