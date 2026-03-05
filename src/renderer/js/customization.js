// ==================== Customization ====================

function setupCustomizationTabs() {
    document.querySelectorAll('.customize-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.customize-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.customize-tab-content').forEach(c => c.classList.remove('active'));
            const target = tab.dataset.custTab;
            document.getElementById(`cust-${target}`).classList.add('active');
        });
    });

    document.querySelectorAll('.rarity-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rarity-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAvatarFilter = btn.dataset.rarity;
            renderAvatars();
        });
    });

    document.getElementById('pref-animations')?.addEventListener('change', async (e) => {
        await window.api.customization.toggleAnimations(e.target.checked);
        applyAnimationPref(e.target.checked);
    });

    document.getElementById('pref-sound')?.addEventListener('change', async (e) => {
        soundEnabled = e.target.checked;
        await window.api.customization.toggleSound(e.target.checked);
        if (soundEnabled) playSound('click');
    });
}

async function loadCustomization() {
    document.getElementById('customize-balance').textContent = currentUser?.coins || 0;
    if (!avatarDefs) avatarDefs = await window.api.customization.getAvatars();
    if (!themeDefs) themeDefs = await window.api.customization.getThemes();
    renderAvatars();
    renderThemes();
    const animPref = currentUser?.animationsEnabled !== false;
    document.getElementById('pref-animations').checked = animPref;
    const soundPref = currentUser?.soundEnabled !== false;
    document.getElementById('pref-sound').checked = soundPref;
    soundEnabled = soundPref;
    soundVolume = currentUser?.soundVolume !== undefined ? currentUser.soundVolume : 0.8;
    const sliderVal = Math.round(soundVolume * 100);
    const slider = document.getElementById('volume-slider');
    if (slider) { slider.value = sliderVal; updateVolumeTrackFill(sliderVal); }
    const pct = document.getElementById('volume-pct');
    if (pct) pct.textContent = `${sliderVal}%`;
    updateVolumeIcon();

    const activeTheme = themeDefs?.find(t => t.id === currentUser?.theme);
    const isPremium = activeTheme?.stickers?.length > 0;
    const premPanel = document.getElementById('premium-theme-prefs');
    if (premPanel) {
        premPanel.classList.toggle('hidden', !isPremium);
        if (isPremium) {
            const sp = getStickerPrefs(currentUser.theme);
            const opVal = sp.opacity ?? 100;
            const opSlider = document.getElementById('pref-sticker-opacity');
            if (opSlider) opSlider.value = opVal;
            const opLabel = document.getElementById('pref-sticker-opacity-val');
            if (opLabel) opLabel.textContent = opVal + '%';
            const visCheck = document.getElementById('pref-stickers-visible');
            if (visCheck) visCheck.checked = sp.visible !== false;
        }
    }
}

function renderAvatars() {
    if (!avatarDefs) return;
    const grid = document.getElementById('avatars-grid');
    const userAvatar = currentUser?.avatar || 'cat_1';
    const ownedAvatars = currentUser?.ownedAvatars || [];
    const filtered = currentAvatarFilter === 'all' ? avatarDefs : avatarDefs.filter(a => a.rarity === currentAvatarFilter);

    const RARITY_LABELS = { common: 'חינם', rare: 'נדיר', epic: 'אפי', legendary: 'אגדי' };
    const RARITY_COLORS = { common: '#b2bec3', rare: '#74b9ff', epic: '#a29bfe', legendary: '#ffd700' };
    const isAdminUser = currentUser?.isParent || currentUser?.isAdmin;

    grid.innerHTML = filtered.map(av => {
        const isOwned = isAdminUser || av.price === 0 || ownedAvatars.includes(av.id);
        const isEquipped = userAvatar === av.id;
        const canAfford = (currentUser?.coins || 0) >= av.price;
        const glowClass = av.rarity === 'legendary' ? 'glow-legendary' : av.rarity === 'epic' ? 'glow-epic' : '';
        return `
        <div class="avatar-card rarity-${av.rarity} ${isEquipped ? 'equipped' : ''}" style="--av-glow:${av.colors.glow};--av-border:${av.colors.border}">
            <div class="avatar-card-preview ${glowClass}" style="background:${av.colors.bg}">
                <img class="avatar-profile-img" src="../../${av.image}" alt="${av.name}">
            </div>
            <div class="avatar-card-info">
                <span class="avatar-card-name">${av.name}</span>
                <span class="avatar-rarity-tag" style="color:${RARITY_COLORS[av.rarity]}">${RARITY_LABELS[av.rarity]}</span>
            </div>
            <div class="avatar-card-actions">
                ${isEquipped ? '<span class="avatar-equipped-label">✅ פעיל</span>' :
                  isOwned ? `<button class="btn btn-small btn-primary" onclick="equipAvatar('${av.id}')">הפעל</button>` :
                  `<button class="btn btn-small ${canAfford ? 'btn-primary' : 'btn-outline disabled'}" ${canAfford ? `onclick="buyAvatar('${av.id}')"` : 'disabled'}>💰 ${av.price}</button>`
                }
            </div>
        </div>`;
    }).join('');
}

function renderThemes() {
    if (!themeDefs) return;
    const grid = document.getElementById('themes-grid');
    const userTheme = currentUser?.theme || 'dark';
    const ownedThemes = currentUser?.ownedThemes || [];
    const isAdminUser = currentUser?.isParent || currentUser?.isAdmin;

    grid.innerHTML = themeDefs.map(th => {
        const isPremium = th.stickers && th.stickers.length > 0;
        const isOwned = isAdminUser || th.price === 0 || ownedThemes.includes(th.id);
        const isEquipped = userTheme === th.id;
        const canAfford = (currentUser?.coins || 0) >= th.price;
        const previewBg = th.vars['--bg-primary'] || '#0a0a0a';
        const previewAccent = th.vars['--accent'] || '#6c5ce7';
        const previewText = th.vars['--text-primary'] || '#eee';
        const folder = STICKER_FOLDERS[th.id] || '';
        const stickerPreviewHtml = isPremium && folder
            ? `<div class="theme-sticker-previews">${th.stickers.slice(0, 3).map(s =>
                `<img src="../../Theme Elements/${encodeURIComponent(folder)}/${encodeURIComponent(s.img)}" alt="" class="theme-sticker-preview-img">`
              ).join('')}</div>`
            : '';
        return `
        <div class="theme-card ${isEquipped ? 'equipped' : ''} ${isPremium ? 'theme-premium' : ''}">
            ${isPremium ? '<span class="theme-premium-badge">✨ פרימיום</span>' : ''}
            <div class="theme-preview" style="background:${previewBg};color:${previewText}">
                <div class="theme-preview-bar" style="background:${th.vars['--bg-sidebar'] || '#0d0d1a'}"></div>
                <div class="theme-preview-content">
                    <div class="theme-preview-accent" style="background:${previewAccent}"></div>
                    <div class="theme-preview-lines">
                        <div style="background:${previewText};opacity:0.3"></div>
                        <div style="background:${previewText};opacity:0.2"></div>
                    </div>
                </div>
                ${stickerPreviewHtml}
            </div>
            <div class="theme-card-info">
                <span class="theme-emoji">${th.emoji}</span>
                <span class="theme-card-name">${th.name}</span>
            </div>
            <div class="theme-card-actions">
                ${isEquipped ? '<span class="avatar-equipped-label">✅ פעיל</span>' :
                  isOwned ? `<button class="btn btn-small btn-primary" onclick="equipTheme('${th.id}')">הפעל</button>` :
                  `<button class="btn btn-small ${canAfford ? 'btn-primary' : 'btn-outline disabled'}" ${canAfford ? `onclick="buyTheme('${th.id}')"` : 'disabled'}>💰 ${th.price}</button>`
                }
            </div>
        </div>`;
    }).join('');
}

async function buyAvatar(avatarId) {
    const result = await window.api.customization.purchaseAvatar(avatarId);
    if (result.success) {
        currentUser = result.user;
        refreshUI();
        showToast('אווטאר חדש! 🎭', 'success');
        loadCustomization();
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function equipAvatar(avatarId) {
    const result = await window.api.customization.equipAvatar(avatarId);
    if (result.success) {
        currentUser = result.user;
        refreshUI();
        renderAvatars();
    }
}

async function buyTheme(themeId) {
    const result = await window.api.customization.purchaseTheme(themeId);
    if (result.success) {
        currentUser = result.user;
        refreshUI();
        applyUserTheme();
        showToast('ערכת נושא חדשה! 🎨', 'success');
        loadCustomization();
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function equipTheme(themeId) {
    const result = await window.api.customization.equipTheme(themeId);
    if (result.success) {
        currentUser = result.user;
        refreshUI();
        applyUserTheme();
        renderThemes();
    }
}

// ==================== Custom Rewards (Parent) ====================

function showRewardsView(view) {
    rewardsCurrentView = view;
    document.getElementById('rewards-view-list').classList.toggle('hidden', view !== 'list');
    document.getElementById('rewards-view-progress').classList.toggle('hidden', view !== 'progress');
    document.getElementById('rewards-view-list-btn').classList.toggle('active', view === 'list');
    document.getElementById('rewards-view-progress-btn').classList.toggle('active', view === 'progress');
    if (view === 'list') loadAdminCustomAchievements();
    else loadRewardsProgress();
}

async function loadAdminCustomAchievements() {
    const list = document.getElementById('custom-achievements-list');
    const achs = await window.api.customAchievements.getAll();

    if (achs.length === 0) {
        list.innerHTML = `
            <div class="custom-ach-empty">
                <div class="custom-ach-empty-icon">🎯</div>
                <p>עדיין אין פרסים מיוחדים</p>
                <p class="text-secondary">לחץ על "➕ פרס חדש" כדי ליצור יעד מותאם אישית</p>
            </div>`;
        return;
    }

    list.innerHTML = achs.map(ach => `
        <div class="custom-ach-card ${ach.active ? '' : 'ach-inactive'}">
            <div class="custom-ach-icon">${ach.icon}</div>
            <div class="custom-ach-info">
                <div class="custom-ach-title">${escapeHtml(ach.title)}</div>
                ${ach.desc ? `<div class="custom-ach-desc">${escapeHtml(ach.desc)}</div>` : ''}
                <div class="custom-ach-meta">
                    <span class="meta-tag goal-tag">${GOAL_TYPE_LABELS[ach.goalType] || ach.goalType}: <strong>${ach.goalValue}</strong></span>
                    <span class="meta-tag reward-tag">💰 פרס: <strong>${ach.coinReward}</strong></span>
                    <span class="meta-tag assign-tag">${ach.assignedTo === 'all' ? '👥 כולם' : '👤 ' + escapeHtml(ach.assignedTo)}</span>
                    ${!ach.active ? '<span class="meta-tag inactive-tag">⏸️ מושהה</span>' : ''}
                </div>
            </div>
            <div class="custom-ach-actions">
                <button class="btn btn-small ${ach.active ? 'btn-outline' : 'btn-primary'}" onclick="toggleCustomReward('${ach.id}')">
                    ${ach.active ? '⏸️ השהה' : '▶️ הפעל'}
                </button>
                <button class="btn btn-small btn-danger" onclick="deleteCustomReward('${ach.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function loadRewardsProgress() {
    const container = document.getElementById('custom-achievements-progress');
    const progress = await window.api.customAchievements.getProgress();

    if (progress.length === 0) {
        container.innerHTML = `<p class="text-secondary">אין פרסים מיוחדים עדיין</p>`;
        return;
    }

    container.innerHTML = progress.map(ach => {
        const unlockedNames = ach.unlockedBy.map(u => `<span class="progress-badge unlocked">${ach.icon} ${escapeHtml(u.displayName)}</span>`).join('');
        return `
            <div class="reward-progress-card">
                <div class="reward-progress-header">
                    <span class="custom-ach-icon">${ach.icon}</span>
                    <div>
                        <div class="custom-ach-title">${escapeHtml(ach.title)}</div>
                        <div class="custom-ach-meta">
                            <span class="meta-tag goal-tag">${GOAL_TYPE_LABELS[ach.goalType] || ach.goalType}: ${ach.goalValue}</span>
                            <span class="meta-tag reward-tag">💰 ${ach.coinReward}</span>
                        </div>
                    </div>
                    <div class="reward-progress-count">${ach.unlockedBy.length} / ?</div>
                </div>
                <div class="reward-progress-badges">
                    ${unlockedNames || '<span class="progress-badge locked">עדיין לא הושג</span>'}
                </div>
            </div>
        `;
    }).join('');
}

async function openCreateRewardModal() {
    const result = await window.api.admin.getAllUsersOverview();
    const select = document.getElementById('reward-assigned-to');
    select.innerHTML = '<option value="all">👥 כל הילדים</option>' +
        result.users.map(u => `<option value="${u.username}">${escapeHtml(u.displayName)}</option>`).join('');

    document.getElementById('reward-icon').value = '🎯';
    document.getElementById('reward-icon-preview').textContent = '🎯';
    document.querySelectorAll('.reward-icon-btn').forEach(b => b.classList.remove('active'));
    const firstBtn = document.querySelector('.reward-icon-btn');
    if (firstBtn) firstBtn.classList.add('active');

    document.getElementById('reward-title').value = '';
    document.getElementById('reward-desc').value = '';
    document.getElementById('reward-goal-type').value = 'questions';
    document.getElementById('reward-goal-value').value = '10';
    document.getElementById('reward-coins').value = '50';
    select.value = 'all';

    document.getElementById('create-reward-modal').classList.remove('hidden');
    document.getElementById('reward-title').focus();
}

function selectRewardIcon(btn, icon) {
    document.querySelectorAll('.reward-icon-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('reward-icon').value = icon;
    document.getElementById('reward-icon-preview').textContent = icon;
}

function closeCreateRewardModal() {
    document.getElementById('create-reward-modal').classList.add('hidden');
}

async function saveCustomReward() {
    const icon     = document.getElementById('reward-icon').value.trim() || '🎯';
    const title    = document.getElementById('reward-title').value.trim();
    const desc     = document.getElementById('reward-desc').value.trim();
    const goalType = document.getElementById('reward-goal-type').value;
    const goalValue   = parseInt(document.getElementById('reward-goal-value').value);
    const coinReward  = parseInt(document.getElementById('reward-coins').value) || 0;
    const assignedTo  = document.getElementById('reward-assigned-to').value;

    if (!title) { showToast('הכנס שם לפרס', 'error'); document.getElementById('reward-title').focus(); return; }
    if (!goalValue || goalValue < 1) { showToast('הכנס ערך יעד תקין', 'error'); document.getElementById('reward-goal-value').focus(); return; }

    const result = await window.api.customAchievements.create({ icon, title, desc, goalType, goalValue, coinReward, assignedTo });
    if (result.success) {
        closeCreateRewardModal();
        loadAdminCustomAchievements();
        showToast(`הפרס "${title}" נוצר! 🎯`, 'success');
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function toggleCustomReward(id) {
    await window.api.customAchievements.toggle(id);
    loadAdminCustomAchievements();
}

async function deleteCustomReward(id) {
    if (!confirm('למחוק את הפרס הזה?')) return;
    await window.api.customAchievements.delete(id);
    loadAdminCustomAchievements();
    showToast('פרס נמחק', 'info');
}
