// ==================== Navigation & Core UI ====================

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.section));
    });
    document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.action));
    });
}

function navigateTo(section) {
    // Exit ZEN mode when navigating away from questions
    if (document.body.classList.contains('zen-mode')) {
        document.body.classList.remove('zen-mode');
        const exitBtn = document.getElementById('zen-exit-btn');
        if (exitBtn) exitBtn.classList.add('hidden');
    }
    if (isRestrictedMode && section === 'games') {
        showToast('אין לך זמן מחשב — קנה זמן תחילה! 🛒', 'warning');
        section = 'shop';
    }
    playSound('click');
    currentSection = section;
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });
    document.querySelectorAll('.content-section').forEach(sec => {
        sec.classList.toggle('active', sec.id === `${section}-section`);
    });
    switch (section) {
        case 'dashboard': loadDashboard(); break;
        case 'tasks': loadTasks(); break;
        case 'questions': loadQuestions(); break;
        case 'shop': loadShop(); break;
        case 'games': loadMyGames(); break;
        case 'leaderboard': loadLeaderboard(); break;
        case 'stats': loadStats(); break;
        case 'customize': loadCustomization(); break;
        case 'search': loadSearch(); break;
        case 'help': /* static page, no loader needed */ break;
        case 'admin': loadAdmin(); break;
    }
}

function refreshUI() {
    if (!currentUser) return;
    document.getElementById('display-name').textContent = currentUser.displayName || currentUser.username;
    document.getElementById('user-coins').textContent = currentUser.coins || 0;
    document.getElementById('welcome-name').textContent = currentUser.displayName || currentUser.username;
    document.getElementById('stat-coins').textContent = currentUser.coins || 0;
    document.getElementById('stat-correct').textContent = currentUser.correctAnswers || 0;
    document.getElementById('stat-games').textContent = (currentUser.ownedGames || []).length;
    updateTimerDisplay();
    refreshGamificationUI();
    refreshAvatarDisplay();
}

// ==================== Timer ====================

function startTimer() {
    stopTimer();
    if (!currentUser || currentUser.isParent) return;
    timerInterval = setInterval(async () => {
        if (!currentUser || currentUser.isParent) return;
        currentUser.remainingTime = Math.max(0, (currentUser.remainingTime || 0) - 1);
        await window.api.users.updateTime(currentUser.remainingTime);
        updateTimerDisplay();
        if (currentUser.remainingTime <= 0) {
            stopTimer();
            await doLogoutDueToTimeExpiry();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function updateTimerDisplay() {
    const seconds = currentUser?.remainingTime || 0;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('timer-time').textContent = timeStr;
    document.getElementById('stat-time').textContent = timeStr;
    const timerDisplay = document.getElementById('timer-display');
    if (seconds <= 300 && seconds > 0) {
        timerDisplay.classList.add('timer-warning');
    } else {
        timerDisplay.classList.remove('timer-warning');
    }
}

// ==================== Time Purchase ====================

function setupTimePurchase() {
    document.querySelectorAll('.time-option').forEach(btn => {
        btn.addEventListener('click', async () => {
            const minutes = parseInt(btn.dataset.minutes);
            const result = await window.api.time.purchase({ minutes });
            if (result.success) {
                currentUser = result.user;
                if (isRestrictedMode) {
                    isRestrictedMode = false;
                    applyRestrictedMode();
                    startTimer();
                }
                refreshUI();
                playSound('buytime');
                showToast(`נוספו ${minutes} דקות! 🎉`, 'success');
            } else {
                showToast(result.error || 'שגיאה ברכישת זמן', 'error');
            }
        });
    });
    document.getElementById('buy-time-sidebar-btn').addEventListener('click', () => {
        navigateTo('dashboard');
        document.getElementById('buy-time-card').scrollIntoView({ behavior: 'smooth' });
    });
}

// ==================== Time Window Guard ====================

function isTimeAllowedNow(windows) {
    if (!windows || windows.length === 0) return true;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    for (const w of windows) {
        const [fh, fm] = w.from.split(':').map(Number);
        const [th, tm] = w.to.split(':').map(Number);
        const from = fh * 60 + fm;
        const to   = th * 60 + tm;
        if (from < to ? (nowMins >= from && nowMins < to) : (nowMins >= from || nowMins < to)) return true;
    }
    return false;
}

function startTimeWindowGuard() {
    stopTimeWindowGuard();
    timeWindowGuardInterval = setInterval(async () => {
        if (!currentUser || currentUser.isParent || currentUser.isAdmin) return;
        const settings = await window.api.settings.get();
        const windows = settings.timeWindows;
        if (!windows || windows.length === 0) return;
        if (!isTimeAllowedNow(windows)) {
            stopTimeWindowGuard();
            stopTimer();
            showToast('🕐 השעה נחסמה — מנותק אוטומטית', 'error', 3000);
            await doLogoutDueToTimeExpiry();
        }
    }, 60000);
}

function stopTimeWindowGuard() {
    if (timeWindowGuardInterval) {
        clearInterval(timeWindowGuardInterval);
        timeWindowGuardInterval = null;
    }
}

// ==================== Gamification UI ====================

async function refreshGamificationUI() {
    if (!currentUser || currentUser.isParent) {
        document.getElementById('xp-bar-container').classList.add('hidden');
        document.getElementById('streak-display').classList.add('hidden');
        document.getElementById('dashboard-level-card')?.closest('.stat-card')?.classList.add('hidden');
        return;
    }
    document.getElementById('xp-bar-container').classList.remove('hidden');
    document.getElementById('streak-display').classList.remove('hidden');

    const stats = await window.api.gamification.getUserStats();
    if (!stats.success) return;

    const badge = document.getElementById('user-level-badge');
    badge.textContent = stats.levelBadge;
    badge.title = `דרגה ${stats.level} — ${stats.levelTitle}`;

    document.getElementById('xp-level-label').textContent = `דרגה ${stats.level} — ${stats.levelTitle}`;
    document.getElementById('xp-value').textContent = `${stats.xp} XP`;

    const levels = await window.api.gamification.getLevels();
    const currentLevelData = levels.find(l => l.level === stats.level);
    const nextLevelData = levels.find(l => l.level === stats.level + 1);
    if (nextLevelData && currentLevelData) {
        const xpInLevel = stats.xp - currentLevelData.xpRequired;
        const xpNeeded = nextLevelData.xpRequired - currentLevelData.xpRequired;
        const pct = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));
        document.getElementById('xp-bar-fill').style.width = pct + '%';
        document.getElementById('xp-next-label').textContent = `הבא: ${nextLevelData.xpRequired} XP`;
    } else {
        document.getElementById('xp-bar-fill').style.width = '100%';
        document.getElementById('xp-next-label').textContent = 'דרגה מקסימלית! 👑';
    }

    const streakCount = document.getElementById('streak-count');
    const streakFire = document.getElementById('streak-fire');
    streakCount.textContent = stats.streak;
    if (stats.streak > 0) {
        streakFire.classList.remove('inactive');
    } else {
        streakFire.classList.add('inactive');
    }

    const levelCard = document.getElementById('dashboard-level-card');
    if (levelCard) {
        document.getElementById('stat-level-badge').textContent = stats.levelBadge;
        document.getElementById('stat-level').textContent = stats.level;
        document.getElementById('stat-level-title').textContent = stats.levelTitle;
    }
    document.getElementById('stat-streak').textContent = stats.streak;
}

// ==================== Avatar Display ====================

async function refreshAvatarDisplay() {
    if (!avatarDefs) avatarDefs = await window.api.customization.getAvatars();
    const avatarId = currentUser?.avatar || 'cat_1';
    const av = avatarDefs.find(a => a.id === avatarId) || avatarDefs[0];
    const el = document.querySelector('.user-avatar');
    if (el && av) {
        el.innerHTML = `<img src="../../${av.image}" alt="${av.name}" class="sidebar-avatar-img">`;
        el.style.background = av.colors.bg;
        el.style.borderColor = av.colors.border;
        el.style.boxShadow = `0 0 12px ${av.colors.glow}`;
    }
}

// ==================== Theme System ====================

async function applyUserTheme() {
    if (!themeDefs) themeDefs = await window.api.customization.getThemes();
    const themeId = currentUser?.theme || 'dark';
    const theme = themeDefs.find(t => t.id === themeId);
    const root = document.documentElement;
    const defaults = { '--bg-primary':'#0a0a0a','--bg-secondary':'#111','--bg-card':'#1a1a2e','--bg-card-hover':'#222244','--bg-sidebar':'#0d0d1a','--text-primary':'#eee','--text-secondary':'#888','--accent':'#6c5ce7','--accent-light':'#a29bfe','--accent-gradient':'linear-gradient(135deg,#6c5ce7,#a29bfe)','--success':'#00b894','--error':'#ff6b6b','--warning':'#fdcb6e','--gold':'#ffd700','--border':'rgba(255,255,255,0.08)','--shadow':'0 4px 15px rgba(0,0,0,0.3)' };
    for (const [k, v] of Object.entries(defaults)) root.style.setProperty(k, v);
    if (theme && theme.vars) {
        for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);
    }
    document.body.dataset.theme = themeId;
    renderThemeStickers(theme);
}

function renderThemeStickers(theme) {
    document.querySelectorAll('.theme-sticker').forEach(el => el.remove());
    if (!theme || !theme.stickers || !theme.stickers.length) return;
    const folder = STICKER_FOLDERS[theme.id];
    if (!folder) return;

    const glowMap = {
        space: 'rgba(124,108,246,0.9)',
        pink:  'rgba(255,105,180,0.9)',
        fire:  'rgba(255,99,72,0.95)'
    };
    const glowColor = glowMap[theme.id] || 'rgba(255,255,255,0.4)';

    theme.stickers.forEach(s => {
        const zone = STICKER_ZONE_MAP[s.zone];
        if (!zone) return;
        const parent = document.querySelector(zone.parent);
        if (!parent) return;

        const img = document.createElement('img');
        img.className = 'theme-sticker';
        img.src = `../../Theme Elements/${encodeURIComponent(folder)}/${encodeURIComponent(s.img)}`;
        img.alt = '';
        img.draggable = false;
        img.dataset.opacity = s.opacity;
        img.dataset.zoneId = s.zone;
        img.style.cssText = zone.css +
            `width:${s.size}px;height:${s.size}px;object-fit:contain;opacity:${s.opacity};` +
            `z-index:5;cursor:pointer;pointer-events:auto;` +
            `filter:drop-shadow(0 0 12px ${glowColor}) drop-shadow(0 0 5px ${glowColor}) brightness(1.2);`;

        img.addEventListener('click', function () {
            if (stickerDragMode) return;
            if (this.dataset.blasting) return;
            this.dataset.blasting = '1';
            playSound('coins');
            spawnStickerParticles(this, theme.id);
            this.classList.add('sticker-exploding');
            setTimeout(() => {
                this.classList.remove('sticker-exploding');
                this.style.animationPlayState = 'paused';
                this.style.opacity = '0';
                const finalOpacity = parseFloat(this.dataset.opacity);
                const prefs = getStickerPrefs(theme.id);
                const mult = Math.min(prefs.opacity ?? 100, 100) / 100;
                setTimeout(() => {
                    delete this.dataset.blasting;
                    this.style.animationPlayState = '';
                    this.style.transition = 'opacity 0.4s ease, transform 0.65s cubic-bezier(0.34,1.56,0.64,1)';
                    this.style.transform = 'scale(0.25) rotate(-18deg)';
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        this.style.opacity = String(finalOpacity * mult);
                        this.style.transform = 'scale(1) rotate(0deg)';
                        setTimeout(() => {
                            this.style.transition = '';
                            this.style.transform = '';
                        }, 700);
                    }));
                }, 7000);
            }, 480);
        });

        makeStickerDraggable(img);
        parent.appendChild(img);
    });

    applyStickerPrefs(theme.id);
}

function spawnStickerParticles(el, themeId) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const palettes = {
        space: ['#7c6cf6','#00d4ff','#b8b0ff','#ffd700','#e8eaff'],
        pink:  ['#ff69b4','#ffb6d9','#ff45a0','#fce4ec','#ff85c8'],
        fire:  ['#ff6348','#ff4500','#ffaa00','#ff9f43','#fff0a0']
    };
    const colors = palettes[themeId] || palettes.space;
    for (let i = 0; i < 12; i++) {
        const p = document.createElement('div');
        p.className = 'sticker-particle';
        const angle = (i / 12) * 360 + (Math.random() - 0.5) * 25;
        const dist = 55 + Math.random() * 55;
        const tx = Math.cos(angle * Math.PI / 180) * dist;
        const ty = Math.sin(angle * Math.PI / 180) * dist;
        const size = 5 + Math.random() * 9;
        const color = colors[i % colors.length];
        p.style.cssText =
            `position:fixed;left:${cx - size/2}px;top:${cy - size/2}px;` +
            `width:${size}px;height:${size}px;border-radius:50%;z-index:9999;pointer-events:none;` +
            `background:${color};box-shadow:0 0 8px ${color};` +
            `--tx:${tx}px;--ty:${ty}px;animation:particleBurst 0.55s ease-out forwards;`;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 700);
    }
}

// ==================== Sticker Preferences ====================

function getStickerPrefs(themeId) {
    try { return JSON.parse(localStorage.getItem(`sp_${currentUser?.username}_${themeId}`)) || {}; }
    catch { return {}; }
}

function saveStickerPrefs(themeId, prefs) {
    localStorage.setItem(`sp_${currentUser?.username}_${themeId}`, JSON.stringify(prefs));
}

function applyStickerPrefs(themeId) {
    const id = themeId || currentUser?.theme;
    if (!id) return;
    const prefs = getStickerPrefs(id);
    document.querySelectorAll('.theme-sticker').forEach(s => {
        const base = parseFloat(s.dataset.opacity);
        const mult = Math.min(prefs.opacity ?? 100, 100) / 100;
        s.style.opacity = prefs.visible === false ? '0' : String(base * mult);
        const saved = prefs.positions?.[s.dataset.zoneId];
        if (saved) { s.style.bottom = saved.bottom + 'px'; s.style.left = saved.left + 'px'; }
    });
}

function onStickerVisibleChange(checked) {
    const themeId = currentUser?.theme;
    if (!themeId) return;
    const prefs = getStickerPrefs(themeId);
    prefs.visible = checked;
    saveStickerPrefs(themeId, prefs);
    applyStickerPrefs(themeId);
}

function onStickerOpacityInput(val) {
    const pct = document.getElementById('pref-sticker-opacity-val');
    if (pct) pct.textContent = val + '%';
    const themeId = currentUser?.theme;
    if (!themeId) return;
    const prefs = getStickerPrefs(themeId);
    prefs.opacity = Number(val);
    saveStickerPrefs(themeId, prefs);
    applyStickerPrefs(themeId);
}

function resetStickerPositions() {
    const themeId = currentUser?.theme;
    if (!themeId) return;
    const prefs = getStickerPrefs(themeId);
    delete prefs.positions;
    saveStickerPrefs(themeId, prefs);
    if (themeDefs) {
        const theme = themeDefs.find(t => t.id === themeId);
        renderThemeStickers(theme);
    }
    showToast('מיקומי מדבקות אופסו', 'success');
}

function toggleStickerDragMode() {
    stickerDragMode = !stickerDragMode;
    const stickers = document.querySelectorAll('.theme-sticker');
    stickers.forEach(s => s.classList.toggle('sticker-draggable', stickerDragMode));
    const btn = document.getElementById('pref-sticker-drag-btn');
    if (btn) {
        btn.textContent = stickerDragMode ? '✅ סיים עריכה' : '✏️ ערוך מיקומים';
        btn.classList.toggle('active', stickerDragMode);
    }
    if (!stickerDragMode) {
        const themeId = currentUser?.theme;
        if (themeId) {
            const prefs = getStickerPrefs(themeId);
            prefs.positions = prefs.positions || {};
            stickers.forEach(s => {
                const bottom = parseInt(s.style.bottom) || 0;
                const left   = parseInt(s.style.left)   || 0;
                prefs.positions[s.dataset.zoneId] = { bottom, left };
            });
            saveStickerPrefs(themeId, prefs);
            showToast('מיקומים נשמרו! 📌', 'success');
        }
    }
}

function makeStickerDraggable(el) {
    el.addEventListener('mousedown', function (e) {
        if (!stickerDragMode) return;
        e.preventDefault();
        e.stopPropagation();
        const startX   = e.clientX;
        const startY   = e.clientY;
        const startBottom = parseInt(el.style.bottom) || 0;
        const startLeft   = parseInt(el.style.left)   || 0;
        el.style.cursor = 'grabbing';
        el.style.zIndex = '9998';
        el.style.animationPlayState = 'paused';
        function onMove(e) {
            el.style.left   = (startLeft   + (e.clientX - startX)) + 'px';
            el.style.bottom = (startBottom - (e.clientY - startY)) + 'px';
        }
        function onUp() {
            el.style.cursor = 'grab';
            el.style.zIndex = '5';
            el.style.animationPlayState = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

function applyAnimationPref(enabled) {
    const val = enabled !== undefined ? enabled : (currentUser?.animationsEnabled !== false);
    document.body.classList.toggle('no-animations', !val);
}
