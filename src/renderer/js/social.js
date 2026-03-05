// ==================== Social (Leaderboard, Profile, Notifications, Messages) ====================

// ---- Leaderboard ----
function setupLeaderboardTabs() {
    document.querySelectorAll('.lb-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentLeaderboardTab = tab.dataset.lb;
            loadLeaderboard();
        });
    });
}

async function loadLeaderboard() {
    const data = await window.api.gamification.getLeaderboard();
    const container = document.getElementById('leaderboard-container');
    
    if (!data || data.length === 0) {
        container.innerHTML = `<div class="lb-empty"><span class="lb-empty-icon">🏆</span><p>אין משתמשים להשוואה</p></div>`;
        return;
    }
    
    let sorted;
    switch (currentLeaderboardTab) {
        case 'xp':
            sorted = [...data].sort((a, b) => b.xp - a.xp);
            container.innerHTML = sorted.map((u, i) => `
                <div class="lb-card lb-rank-${i + 1} lb-clickable" onclick="showProfileModal('${u.username}')">
                    <div class="lb-rank">${getRankEmoji(i)}</div>
                    <div class="lb-name-area">
                        <div class="lb-username">${u.levelBadge} ${escapeHtml(u.displayName)} <span class="lb-level-tag">דרגה ${u.level}</span></div>
                        <div class="lb-subtitle">${u.levelTitle}</div>
                    </div>
                    <div class="lb-stat">
                        <div class="lb-stat-value">${u.xp}</div>
                        <div class="lb-stat-label">XP</div>
                    </div>
                    <div class="lb-stat">
                        <div class="lb-stat-value">${u.correctAnswers}</div>
                        <div class="lb-stat-label">תשובות נכונות</div>
                    </div>
                </div>
            `).join('');
            break;
            
        case 'weekly':
            sorted = [...data].sort((a, b) => (b.weeklyStats?.questionsAnswered || 0) - (a.weeklyStats?.questionsAnswered || 0));
            container.innerHTML = sorted.map((u, i) => `
                <div class="lb-card lb-rank-${i + 1} lb-clickable" onclick="showProfileModal('${u.username}')">
                    <div class="lb-rank">${getRankEmoji(i)}</div>
                    <div class="lb-name-area">
                        <div class="lb-username">${u.levelBadge} ${escapeHtml(u.displayName)}</div>
                        <div class="lb-subtitle">שאלות השבוע</div>
                    </div>
                    <div class="lb-stat">
                        <div class="lb-stat-value">${u.weeklyStats?.questionsAnswered || 0}</div>
                        <div class="lb-stat-label">שאלות</div>
                    </div>
                    <div class="lb-stat">
                        <div class="lb-stat-value">${u.weeklyStats?.coinsEarned || 0}</div>
                        <div class="lb-stat-label">💰 הרוויח</div>
                    </div>
                </div>
            `).join('');
            break;
            
        case 'streak':
            sorted = [...data].sort((a, b) => b.streak - a.streak);
            container.innerHTML = sorted.map((u, i) => `
                <div class="lb-card lb-rank-${i + 1} lb-clickable" onclick="showProfileModal('${u.username}')">
                    <div class="lb-rank">${getRankEmoji(i)}</div>
                    <div class="lb-name-area">
                        <div class="lb-username">${u.levelBadge} ${escapeHtml(u.displayName)}</div>
                        <div class="lb-subtitle">${u.streak > 0 ? '🔥 פעיל' : '⬜ לא פעיל'}</div>
                    </div>
                    <div class="lb-stat">
                        <div class="lb-stat-value">${u.streak}</div>
                        <div class="lb-stat-label">ימים ברצף</div>
                    </div>
                </div>
            `).join('');
            break;
            
        case 'achievements':
            sorted = [...data].sort((a, b) => b.unlockedAchievements - a.unlockedAchievements);
            const totalAch = achievementsDefs?.length || 0;
            container.innerHTML = sorted.map((u, i) => `
                <div class="lb-card lb-rank-${i + 1} lb-clickable" onclick="showProfileModal('${u.username}')">
                    <div class="lb-rank">${getRankEmoji(i)}</div>
                    <div class="lb-name-area">
                        <div class="lb-username">${u.levelBadge} ${escapeHtml(u.displayName)}</div>
                        <div class="lb-subtitle">${u.unlockedAchievements}/${totalAch} הישגים</div>
                    </div>
                    <div class="lb-stat">
                        <div class="lb-stat-value">${u.unlockedAchievements}</div>
                        <div class="lb-stat-label">🏅 הישגים</div>
                    </div>
                </div>
            `).join('');
            break;
    }
}

// ---- Achievements Modal ----
async function showAchievementsModal() {
    if (!achievementsDefs) {
        achievementsDefs = await window.api.gamification.getAchievementsDefs();
    }
    const stats = await window.api.gamification.getUserStats();
    if (!stats.success) return;
    
    const unlocked = stats.unlockedAchievements || [];
    const total = achievementsDefs.length;
    const unlockedCount = unlocked.length;
    
    document.getElementById('achievements-summary').innerHTML = `
        <div class="ach-summary-item">
            <span class="ach-summary-value">${unlockedCount}/${total}</span>
            <span class="ach-summary-label">הישגים פתוחים</span>
        </div>
        <div class="ach-summary-item">
            <span class="ach-summary-value">${stats.levelBadge} ${stats.level}</span>
            <span class="ach-summary-label">${stats.levelTitle}</span>
        </div>
        <div class="ach-summary-item">
            <span class="ach-summary-value">🔥 ${stats.streak}</span>
            <span class="ach-summary-label">ימים ברצף</span>
        </div>
        <div class="ach-summary-item">
            <span class="ach-summary-value">${stats.xp}</span>
            <span class="ach-summary-label">XP</span>
        </div>
    `;
    
    document.getElementById('achievements-grid').innerHTML = achievementsDefs.map(ach => {
        const isUnlocked = unlocked.includes(ach.id);
        return `
            <div class="ach-card ${isUnlocked ? 'unlocked' : 'locked'}">
                ${isUnlocked ? '<span class="ach-unlocked-badge">✅</span>' : ''}
                <span class="ach-icon">${ach.icon}</span>
                <div class="ach-title">${escapeHtml(ach.title)}</div>
                <div class="ach-desc">${escapeHtml(ach.desc)}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('achievements-modal').classList.remove('hidden');
}

function closeAchievementsModal() {
    document.getElementById('achievements-modal').classList.add('hidden');
}

// ---- Profile Modal ----
async function showProfileModal(username) {
    const target = username || currentUser?.username;
    if (!target) return;

    const modal = document.getElementById('profile-modal');
    modal.classList.remove('hidden');
    document.getElementById('profile-display-name').textContent = '...';
    document.getElementById('profile-achievements').innerHTML = '<div class="profile-ach-loading">טוען...</div>';

    if (!achievementsDefs) achievementsDefs = await window.api.gamification.getAchievementsDefs();
    if (!avatarDefs) avatarDefs = await window.api.customization.getAvatars();
    const themeDefs = await window.api.customization.getThemes();
    const stats = await window.api.gamification.getUserStats(target);
    if (!stats.success) { modal.classList.add('hidden'); return; }

    // ── Theme styling ──────────────────────────────
    const modalContent = modal.querySelector('.profile-modal-content');
    const activeThemeId = stats.equippedTheme || 'dark';
    modalContent.dataset.theme = activeThemeId;

    const PREMIUM_THEME_IDS = ['space', 'pink', 'fire'];
    const isPremium = PREMIUM_THEME_IDS.includes(activeThemeId);

    // Remove any previous premium state
    modalContent.classList.remove('profile-premium');
    delete modalContent.dataset.premiumTheme;
    modal.querySelector('.profile-premium-badge')?.remove();
    modal.querySelectorAll('.profile-hero-sticker').forEach(el => el.remove());

    if (isPremium) {
        const PREMIUM_LABELS = { space: '🚀 SPACE', pink: '🎀 PINK', fire: '🔥 FIRE' };
        const STICKER_PICKS = {
            space: ['spaceship.png', 'meteor.png', 'dimound.png'],
            pink:  ['CUPCAKE.png', 'קשת.png', 'DRESS.png'],
            fire:  ['FIRE DRAGON.png', 'FIRE BALL.png', 'FIRE TREE.png']
        };
        const STICKER_POSITIONS = [
            { right: '14px', top: '50px',  width: '52px' },
            { right: '72px', top: '10px',  width: '44px' },
            { right: '18px', bottom: '8px', width: '40px' }
        ];

        modalContent.classList.add('profile-premium');
        modalContent.dataset.premiumTheme = activeThemeId;

        // Badge
        const badge = document.createElement('div');
        badge.className = 'profile-premium-badge';
        badge.innerHTML = `✦ ${PREMIUM_LABELS[activeThemeId] || 'PREMIUM'}`;
        document.getElementById('profile-hero').appendChild(badge);

        // Sticker decorations
        const folder = { space: 'Space', pink: 'Girl', fire: 'Fire' }[activeThemeId];
        STICKER_PICKS[activeThemeId].forEach((img, i) => {
            const el = document.createElement('img');
            el.className = 'profile-hero-sticker';
            el.src = `../../Theme Elements/${encodeURIComponent(folder)}/${encodeURIComponent(img)}`;
            el.alt = '';
            Object.assign(el.style, { position: 'absolute', ...STICKER_POSITIONS[i] });
            document.getElementById('profile-hero').appendChild(el);
        });
    }

    // Avatar
    const av = avatarDefs.find(a => a.id === stats.avatar) || avatarDefs[0];
    const avatarWrap = document.getElementById('profile-avatar-wrap');
    const avatarEl   = document.getElementById('profile-avatar-img-el');
    if (av) {
        avatarEl.innerHTML = `<img src="../../${av.image}" alt="${av.name}" class="profile-avatar-img">`;
        avatarWrap.style.background    = av.colors.bg;
        avatarWrap.style.borderColor   = av.colors.border;
        avatarWrap.style.boxShadow     = `0 0 22px ${av.colors.glow}, 0 0 60px ${av.colors.glow}40`;
        avatarWrap.dataset.rarity = av.rarity || 'common';
    }

    document.getElementById('profile-display-name').textContent = stats.displayName;
    document.getElementById('profile-username').textContent = `@${stats.username}`;
    document.getElementById('profile-badge').textContent = stats.levelBadge;
    document.getElementById('profile-level-title').textContent = `דרגה ${stats.level} — ${stats.levelTitle}`;

    const currentLvlXp = stats.xp;
    const nextLvlXp    = stats.nextLevelXP;
    document.getElementById('profile-xp-label').textContent = `${currentLvlXp} XP`;
    if (nextLvlXp) {
        document.getElementById('profile-xp-next').textContent = `יעד: ${nextLvlXp} XP`;
        const pct = Math.min(100, Math.round((currentLvlXp / nextLvlXp) * 100));
        document.getElementById('profile-xp-fill').style.width = `${pct}%`;
    } else {
        document.getElementById('profile-xp-next').textContent = 'מקסימום! 🏆';
        document.getElementById('profile-xp-fill').style.width = '100%';
    }

    const accuracy = stats.questionsAnswered > 0
        ? Math.round((stats.correctAnswers / stats.questionsAnswered) * 100) + '%'
        : '—';
    document.getElementById('pstat-coins').textContent    = stats.coins;
    document.getElementById('pstat-streak').textContent   = stats.streak;
    document.getElementById('pstat-correct').textContent  = stats.correctAnswers;
    document.getElementById('pstat-total').textContent    = stats.questionsAnswered;
    document.getElementById('pstat-accuracy').textContent = accuracy;
    document.getElementById('pstat-tasks').textContent    = stats.tasksCompletedCount;
    document.getElementById('pstat-earned').textContent   = stats.totalCoinsEarned;
    document.getElementById('pstat-xp').textContent       = stats.xp;

    const weekly = stats.weeklyStats || {};
    document.getElementById('pweek-q').textContent     = weekly.questionsAnswered || 0;
    document.getElementById('pweek-coins').textContent = weekly.coinsEarned || 0;

    const unlocked = stats.unlockedAchievements || [];
    const unlockedCount = unlocked.length;
    const total = achievementsDefs.length;
    document.getElementById('profile-ach-title').textContent = `🏅 הישגים (${unlockedCount}/${total})`;
    if (unlockedCount === 0) {
        document.getElementById('profile-achievements').innerHTML = '<div class="profile-ach-empty">אין הישגים עדיין</div>';
    } else {
        document.getElementById('profile-achievements').innerHTML = achievementsDefs
            .filter(a => unlocked.includes(a.id))
            .map(a => `<div class="profile-ach-badge" title="${escapeHtml(a.title)}: ${escapeHtml(a.desc)}">${a.icon}<span class="profile-ach-name">${escapeHtml(a.title)}</span></div>`)
            .join('');
    }
}

function closeProfileModal() {
    document.getElementById('profile-modal').classList.add('hidden');
}

// ---- Level Up Overlay ----
function showLevelUp(levelData) {
    document.getElementById('levelup-badge').textContent = levelData.badge;
    document.getElementById('levelup-detail').textContent = `דרגה ${levelData.level} — ${levelData.title}`;
    document.getElementById('levelup-overlay').classList.remove('hidden');
    playSound('levelup');
    launchConfetti('levelup');
}

function closeLevelUp() {
    document.getElementById('levelup-overlay').classList.add('hidden');
}

// ---- Achievement Toast ----
function showAchievementToast(ach, isCustom = false) {
    const toast = document.getElementById('achievement-toast');
    document.getElementById('ach-toast-icon').textContent = ach.icon;
    const label = isCustom && ach.coinReward
        ? `${ach.title} — ${ach.desc} (+${ach.coinReward} 💰)`
        : `${ach.title} — ${ach.desc}`;
    document.getElementById('ach-toast-name').textContent = label;
    if (isCustom) toast.classList.add('custom-toast'); else toast.classList.remove('custom-toast');
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('show'), 10);
    playSound('achievement');
    launchConfetti('achievement');
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 500);
    }, 3500);
}

// ---- Notifications ----
async function refreshNotificationBell() {
    if (!currentUser || currentUser.isParent || currentUser.isAdmin) return;
    try {
        const notifs = await window.api.notifications.get();
        const unread = notifs.filter(n => !n.read).length;
        const badge = document.getElementById('notif-badge');
        if (badge) {
            badge.textContent = unread;
            badge.classList.toggle('hidden', unread === 0);
        }
        renderNotificationList(notifs);
    } catch (e) { /* ignore */ }
}

function renderNotificationList(notifs) {
    const list = document.getElementById('notif-list');
    if (!list) return;
    if (!notifs || notifs.length === 0) {
        list.innerHTML = '<p class="notif-empty">אין התראות חדשות</p>';
        return;
    }
    list.innerHTML = notifs.slice(0, 30).map(n => {
        const t = n.createdAt ? new Date(n.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';
        return `<div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotificationRead('${n.id}')">
            <span class="notif-icon">${escapeHtml(n.icon || '🔔')}</span>
            <div class="notif-body">
                <div class="notif-title">${escapeHtml(n.title)}</div>
                ${n.body ? `<div class="notif-text">${escapeHtml(n.body)}</div>` : ''}
            </div>
            <span class="notif-time">${t}</span>
        </div>`;
    }).join('');
}

function toggleNotifDropdown() {
    const dd = document.getElementById('notif-dropdown');
    if (!dd) return;
    dd.classList.toggle('hidden');
    if (!dd.classList.contains('hidden')) refreshNotificationBell();
}

async function markNotificationRead(id) {
    await window.api.notifications.markRead(id);
    refreshNotificationBell();
}

async function clearAllNotifications() {
    await window.api.notifications.clear();
    refreshNotificationBell();
    document.getElementById('notif-dropdown')?.classList.add('hidden');
}

// ---- Birthday ----
async function checkBirthday() {
    if (!currentUser || currentUser.isParent || currentUser.isAdmin) return;
    try {
        const result = await window.api.birthday.check();
        if (result && result.isBirthday && result.bonusGranted) {
            currentUser = result.user || currentUser;
            const bonus = result.bonus || 0;
            document.getElementById('birthday-bonus-text').textContent = `קיבלת ${bonus} מטבעות בונוס! 🎉`;
            document.getElementById('birthday-overlay').classList.remove('hidden');
            playSound('birthday');
            launchConfetti('birthday');
            refreshUI();
        }
    } catch (e) { /* ignore */ }
}

function closeBirthdayOverlay() {
    document.getElementById('birthday-overlay').classList.add('hidden');
}

// ---- User Messages ----
async function loadUserMessages() {
    if (!currentUser || currentUser.isParent || currentUser.isAdmin) return;
    try {
        const msgs = await window.api.messages.getForUser();
        const container = document.getElementById('msg-banner-container');
        if (!container) return;
        container.innerHTML = '';
        if (!msgs || msgs.length === 0) return;
        msgs.forEach(msg => {
            const div = document.createElement('div');
            div.className = 'msg-banner';
            div.innerHTML = `
                <span class="msg-banner-icon">📢</span>
                <span class="msg-banner-text">${escapeHtml(msg.text)}</span>
                <button class="msg-banner-close" onclick="dismissUserMsg('${msg.id}')">×</button>`;
            container.appendChild(div);
        });
    } catch (e) { /* ignore */ }
}

async function dismissUserMsg(id) {
    await window.api.messages.dismiss(id);
    loadUserMessages();
}

async function loadLockScreenMessages() {
    try {
        const msgs = await window.api.messages.getLockScreen();
        const container = document.getElementById('lock-messages');
        if (!container) return;
        if (!msgs || msgs.length === 0) { container.classList.add('hidden'); return; }
        container.classList.remove('hidden');
        container.innerHTML = msgs.map(m =>
            `<div class="lock-msg-item">📢 ${escapeHtml(m.text)}</div>`
        ).join('');
    } catch (e) { /* ignore */ }
}

// ---- Admin Messages ----
async function loadAdminMessages() {
    try {
        const overview = await window.api.admin.getAllUsersOverview();
        const sel = document.getElementById('msg-target');
        if (sel && overview.users) {
            sel.innerHTML = '<option value="all">כל הילדים</option>';
            overview.users.forEach(u => {
                if (!u.isParent && !u.isAdmin) {
                    const opt = document.createElement('option');
                    opt.value = u.username;
                    opt.textContent = u.displayName || u.username;
                    sel.appendChild(opt);
                }
            });
        }

        const bdList = document.getElementById('birthday-list');
        if (bdList && overview.users) {
            bdList.innerHTML = overview.users.filter(u => !u.isParent && !u.isAdmin).map(u => {
                const bd = u.birthday || '';
                return `<div class="admin-task-card" style="display:flex;justify-content:space-between;align-items:center">
                    <span>${escapeHtml(u.displayName || u.username)}</span>
                    <span style="display:flex;gap:8px;align-items:center">
                        <input type="date" value="${bd}" style="background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border);border-radius:8px;padding:4px 8px"
                            onchange="saveBirthday('${u.username}', this.value)">
                    </span>
                </div>`;
            }).join('') || '<p class="no-data">אין ילדים רשומים</p>';
        }
    } catch (e) { /* ignore */ }

    try {
        const msgs = await window.api.messages.getAll();
        const list = document.getElementById('admin-messages-list');
        if (!list) return;
        if (!msgs || msgs.length === 0) {
            list.innerHTML = '<p class="no-data">אין הודעות פעילות</p>';
            return;
        }
        list.innerHTML = msgs.map(m => {
            const target = m.target === 'all' ? 'כולם' : m.target;
            const lockTag = m.showOnLock ? '🔒' : '';
            const exp = m.expiresAt ? `פג: ${new Date(m.expiresAt).toLocaleString('he-IL')}` : 'ללא תפוגה';
            return `<div class="admin-task-card" style="display:flex;justify-content:space-between;align-items:center;gap:10px">
                <div>
                    <div class="task-title">${lockTag} ${escapeHtml(m.text)}</div>
                    <div class="task-meta">→ ${target} | ${exp}</div>
                </div>
                <button class="btn btn-danger btn-small" onclick="deleteAdminMessage('${m.id}')">🗑️</button>
            </div>`;
        }).join('');
    } catch (e) { /* ignore */ }
}

function openMessageComposer() {
    document.getElementById('message-composer').classList.remove('hidden');
}

function closeMessageComposer() {
    document.getElementById('message-composer').classList.add('hidden');
    document.getElementById('msg-text').value = '';
}

async function sendAdminMessage() {
    const text = document.getElementById('msg-text').value.trim();
    if (!text) { showToast('הכנס טקסט להודעה', 'error'); return; }
    const target  = document.getElementById('msg-target').value;
    const showOnLock = document.getElementById('msg-show-lock').checked;
    const expiryHours = parseInt(document.getElementById('msg-expiry').value) || 0;
    const result = await window.api.messages.create({ text, target, showOnLock, expiryHours });
    if (result.success) {
        showToast('📢 הודעה נשלחה!', 'success');
        closeMessageComposer();
        loadAdminMessages();
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function deleteAdminMessage(id) {
    await window.api.messages.delete(id);
    loadAdminMessages();
}

async function saveBirthday(username, date) {
    const result = await window.api.birthday.setDate({ username, date });
    if (result && result.success) showToast('🎂 יום הולדת נשמר!', 'success');
    else showToast('שגיאה בשמירה', 'error');
}

// ---- Close dropdowns on outside click ----
document.addEventListener('click', (e) => {
    const dd = document.getElementById('notif-dropdown');
    const btn = document.getElementById('notif-btn');
    if (dd && !dd.contains(e.target) && btn && !btn.contains(e.target)) {
        dd.classList.add('hidden');
    }
    const vp = document.getElementById('volume-popup');
    const vb = document.getElementById('volume-btn');
    if (vp && !vp.contains(e.target) && vb && !vb.contains(e.target)) {
        vp.classList.add('hidden');
    }
});
