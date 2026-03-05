// ==================== Shop ====================

function setupShopTabs() {
    document.querySelectorAll('.shop-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadShop(tab.dataset.tab);
        });
    });
}

async function loadShop(tab = 'customGames') {
    document.getElementById('shop-balance').textContent = currentUser?.coins || 0;
    document.getElementById('shop-grid').className = 'shop-grid';
    
    switch (tab) {
        case 'customGames': loadShopGames(); break;
        case 'time': loadShopTime(); break;
        case 'avatars': loadShopAvatars(); break;
        case 'themes': loadShopThemes(); break;
        case 'items': loadShopWorldItems(); break;
        case 'history': loadShopHistory(); break;
    }
}

async function loadShopGames() {
    showSkeleton('shop-grid', 4);
    customGames = await window.api.customGames.getAll();
    const now = Date.now();
    const available = customGames.filter(g => !g.expiresAt || new Date(g.expiresAt).getTime() > now);
    const grid = document.getElementById('shop-grid');

    if (available.length === 0) {
        document.getElementById('shop-categories').innerHTML = '';
        grid.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🎮</span>
                <p>אין משחקים בחנות</p>
                <p class="text-secondary">ההורה יוסיף משחקים בקרוב!</p>
            </div>`;
        return;
    }

    const cats = [...new Set(available.map(g => g.category || 'other'))];
    const catContainer = document.getElementById('shop-categories');
    catContainer.innerHTML = '';
    if (cats.length > 1) {
        const allBtn = document.createElement('button');
        allBtn.className = 'game-filter-btn active';
        allBtn.textContent = 'כל הקטגוריות';
        allBtn.addEventListener('click', () => renderShopGames(available, 'all', catContainer));
        catContainer.appendChild(allBtn);
        cats.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'game-filter-btn';
            btn.textContent = CATEGORY_LABELS[cat] || cat;
            btn.dataset.cat = cat;
            btn.addEventListener('click', () => renderShopGames(available, cat, catContainer));
            catContainer.appendChild(btn);
        });
    }

    renderShopGames(available, 'all', catContainer);
}

function renderShopGames(games, filterCat, catContainer) {
    if (catContainer) {
        catContainer.querySelectorAll('.game-filter-btn').forEach(b => {
            const isAll = !b.dataset.cat && filterCat === 'all';
            const isCat = b.dataset.cat === filterCat;
            b.classList.toggle('active', isAll || isCat);
        });
    }
    const filtered = filterCat === 'all' ? games : games.filter(g => (g.category || 'other') === filterCat);
    const grid = document.getElementById('shop-grid');
    const now = Date.now();
    grid.innerHTML = filtered.map(game => {
        const owned = currentUser?.ownedGames?.includes(game.id);
        let expiryNote = '';
        if (game.expiresAt) {
            const daysLeft = Math.ceil((new Date(game.expiresAt) - now) / 86400000);
            expiryNote = `<div class="shop-item-expiry">⏳ נותרו ${daysLeft} ימים</div>`;
        }
        const catLabel = CATEGORY_LABELS[game.category || 'other'] || '';
        return `
            <div class="shop-item-card ${owned ? 'owned' : ''}">
                <div class="shop-item-icon">${game.icon || '🎮'}</div>
                <div class="shop-item-name">${escapeHtml(game.name)}</div>
                <span class="game-cat-badge cat-${game.category || 'other'}" style="margin-bottom:6px">${catLabel}</span>
                ${expiryNote}
                <div class="shop-item-price">
                    ${owned ? '✅ בבעלותך' : `💰 ${game.price}`}
                </div>
                ${!owned ? `<button class="btn btn-primary btn-small" onclick="purchaseGame('${game.id}')">קנה</button>` : ''}
            </div>`;
    }).join('');
}

function loadShopTime() {
    const grid = document.getElementById('shop-grid');
    document.getElementById('shop-categories').innerHTML = '';
    const rate = 5;
    grid.innerHTML = `
        <div class="time-shop-container">
            <h3>⏱️ קנה זמן מחשב</h3>
            <div class="time-shop-grid">
                <div class="time-shop-option" onclick="buyTimeFromShop(5)">
                    <span class="time-amount">5 דקות</span>
                    <span class="time-cost">💰 ${5 * rate}</span>
                </div>
                <div class="time-shop-option" onclick="buyTimeFromShop(15)">
                    <span class="time-amount">15 דקות</span>
                    <span class="time-cost">💰 ${15 * rate}</span>
                </div>
                <div class="time-shop-option" onclick="buyTimeFromShop(30)">
                    <span class="time-amount">30 דקות</span>
                    <span class="time-cost">💰 ${30 * rate}</span>
                </div>
                <div class="time-shop-option" onclick="buyTimeFromShop(60)">
                    <span class="time-amount">שעה</span>
                    <span class="time-cost">💰 ${60 * rate}</span>
                </div>
            </div>
        </div>`;
}

async function purchaseGame(gameId) {
    const result = await window.api.customGames.purchase(gameId);
    if (result.success) {
        currentUser = result.user;
        refreshUI();
        playSound('buy');
        showToast('משחק נקנה בהצלחה! 🎮', 'success');
        launchConfetti('purchase');
        loadShopGames();
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

async function buyTimeFromShop(minutes) {
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
        showToast(`נוספו ${minutes} דקות! ⏱️`, 'success');
        loadShopTime();
    } else {
        showToast(result.error || 'שגיאה', 'error');
    }
}

// ---- Shop: Avatars tab ----
async function loadShopAvatars() {
    document.getElementById('shop-categories').innerHTML = '';
    if (!avatarDefs) avatarDefs = await window.api.customization.getAvatars();
    if (!avatarDefs) return;
    const grid = document.getElementById('shop-grid');
    grid.className = 'shop-grid avatars-grid';
    const ownedAvatars = currentUser?.ownedAvatars || [];
    const userAvatar = currentUser?.avatar || 'cat_1';
    const RARITY_LABELS = { common: 'חינם', rare: 'נדיר', epic: 'אפי', legendary: 'אגדי' };
    const RARITY_COLORS = { common: '#b2bec3', rare: '#74b9ff', epic: '#a29bfe', legendary: '#ffd700' };
    const isAdminUser = currentUser?.isParent || currentUser?.isAdmin;
    grid.innerHTML = avatarDefs.map(av => {
        const isOwned = isAdminUser || av.price === 0 || ownedAvatars.includes(av.id);
        const isEquipped = userAvatar === av.id;
        const canAfford = (currentUser?.coins || 0) >= av.price;
        const glowClass = av.rarity === 'legendary' ? 'glow-legendary' : av.rarity === 'epic' ? 'glow-epic' : '';
        return `
        <div class="avatar-card rarity-${av.rarity} ${isEquipped ? 'equipped' : ''}" style="--av-glow:${av.colors.glow};--av-border:${av.colors.border}">
            <div class="avatar-card-preview ${glowClass}" style="background:${av.colors.bg}"><img class="avatar-profile-img" src="../../${av.image}" alt="${av.name}"></div>
            <div class="avatar-card-info">
                <span class="avatar-card-name">${av.name}</span>
                <span class="avatar-rarity-tag" style="color:${RARITY_COLORS[av.rarity]}">${RARITY_LABELS[av.rarity]}</span>
            </div>
            <div class="avatar-card-actions">
                ${isEquipped ? '<span class="avatar-equipped-label">✅ פעיל</span>' :
                  isOwned ? `<button class="btn btn-small btn-primary" onclick="equipAvatarFromShop('${av.id}')">הפעל</button>` :
                  `<button class="btn btn-small ${canAfford ? 'btn-primary' : 'btn-outline'}" ${!canAfford ? 'disabled' : `onclick="buyAvatarFromShop('${av.id}')"`}>💰 ${av.price}</button>`}
            </div>
        </div>`;
    }).join('');
}

async function equipAvatarFromShop(avatarId) {
    const result = await window.api.customization.equipAvatar(avatarId);
    if (result.success) { currentUser = result.user; refreshUI(); loadShopAvatars(); }
}

async function buyAvatarFromShop(avatarId) {
    const result = await window.api.customization.purchaseAvatar(avatarId);
    if (result.success) { currentUser = result.user; refreshUI(); showToast('אווטאר חדש! 🎭', 'success'); loadShopAvatars(); }
    else showToast(result.error || 'שגיאה', 'error');
}

// ---- Shop: Themes tab ----
async function loadShopThemes() {
    document.getElementById('shop-categories').innerHTML = '';
    if (!themeDefs) themeDefs = await window.api.customization.getThemes();
    if (!themeDefs) return;
    const grid = document.getElementById('shop-grid');
    grid.className = 'shop-grid themes-grid';
    const ownedThemes = currentUser?.ownedThemes || [];
    const userTheme = currentUser?.theme || 'dark';
    const isAdminUser = currentUser?.isParent || currentUser?.isAdmin;
    grid.innerHTML = themeDefs.map(th => {
        const isPremium = th.stickers && th.stickers.length > 0;
        const isOwned = isAdminUser || th.price === 0 || ownedThemes.includes(th.id);
        const isEquipped = userTheme === th.id;
        const canAfford = (currentUser?.coins || 0) >= th.price;
        const previewBg = th.vars['--bg-primary'] || '#0a0a0a';
        const previewAccent = th.vars['--accent'] || '#6c5ce7';
        const folder = STICKER_FOLDERS[th.id] || '';
        const stickerPreviewHtml = isPremium && folder
            ? `<div class="theme-sticker-previews">${th.stickers.slice(0, 3).map(s =>
                `<img src="../../Theme Elements/${encodeURIComponent(folder)}/${encodeURIComponent(s.img)}" alt="" class="theme-sticker-preview-img">`
              ).join('')}</div>`
            : '';
        return `
        <div class="theme-card ${isEquipped ? 'equipped' : ''} ${isPremium ? 'theme-premium' : ''}">
            ${isPremium ? '<span class="theme-premium-badge">✨ פרימיום</span>' : ''}
            <div class="theme-preview" style="background:${previewBg}">
                <div class="theme-preview-bar" style="background:${th.vars['--bg-sidebar'] || '#0d0d1a'}"></div>
                <div class="theme-preview-content">
                    <div class="theme-preview-accent" style="background:${previewAccent}"></div>
                    <div class="theme-preview-lines">
                        <div style="background:${th.vars['--text-primary'] || '#eee'};opacity:0.3"></div>
                        <div style="background:${th.vars['--text-primary'] || '#eee'};opacity:0.2"></div>
                    </div>
                </div>
                ${stickerPreviewHtml}
            </div>
            <div class="theme-card-info"><span class="theme-emoji">${th.emoji}</span><span class="theme-card-name">${th.name}</span></div>
            <div class="theme-card-actions">
                ${isEquipped ? '<span class="avatar-equipped-label">✅ פעיל</span>' :
                  isOwned ? `<button class="btn btn-small btn-primary" onclick="equipThemeFromShop('${th.id}')">הפעל</button>` :
                  `<button class="btn btn-small ${canAfford ? 'btn-primary' : 'btn-outline'}" ${!canAfford ? 'disabled' : `onclick="buyThemeFromShop('${th.id}')"`}>💰 ${th.price}</button>`}
            </div>
        </div>`;
    }).join('');
}

async function equipThemeFromShop(themeId) {
    const result = await window.api.customization.equipTheme(themeId);
    if (result.success) { currentUser = result.user; refreshUI(); applyUserTheme(); loadShopThemes(); }
}

async function buyThemeFromShop(themeId) {
    const result = await window.api.customization.purchaseTheme(themeId);
    if (result.success) { currentUser = result.user; refreshUI(); applyUserTheme(); showToast('ערכת נושא חדשה! 🎨', 'success'); loadShopThemes(); }
    else showToast(result.error || 'שגיאה', 'error');
}

// ---- Shop: World Items tab ----
async function loadShopWorldItems(categoryFilter) {
    if (categoryFilter !== undefined) currentItemCategory = categoryFilter;
    if (!shopItems) shopItems = await window.api.shop.getItems();
    const allItems = shopItems?.items || [];
    const owned = currentUser?.ownedItems || [];
    const categories = ['all', ...new Set(allItems.map(i => i.category))];
    const catLabels = { all: 'הכל', buildings: '🏠 בניינים', nature: '🌳 טבע', decorations: '💡 קישוטים' };

    document.getElementById('shop-categories').innerHTML = `
        <div class="shop-cat-filters">
            ${categories.map(c => `<button class="shop-cat-btn ${currentItemCategory === c ? 'active' : ''}" onclick="loadShopWorldItems('${c}')">${catLabels[c] || c}</button>`).join('')}
        </div>`;

    const filtered = currentItemCategory === 'all' ? allItems : allItems.filter(i => i.category === currentItemCategory);
    const grid = document.getElementById('shop-grid');
    grid.className = 'shop-grid items-grid';

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><span class="empty-icon">📦</span><p>אין פריטים</p></div>';
        return;
    }
    grid.innerHTML = filtered.map(item => {
        const isOwned = owned.includes(item.id);
        const canAfford = (currentUser?.coins || 0) >= item.price;
        return `
        <div class="world-item-card ${isOwned ? 'owned' : ''}">
            <div class="world-item-img"><img src="assets/items/${item.image}" alt="${escapeHtml(item.name)}" onerror="this.style.display='none'"></div>
            <div class="world-item-name">${escapeHtml(item.name)}</div>
            <div class="world-item-price">${isOwned ? '✅ בבעלותך' : `💰 ${item.price}`}</div>
            ${!isOwned ? `<button class="btn btn-small ${canAfford ? 'btn-primary' : 'btn-outline'}" ${!canAfford ? 'disabled' : `onclick="purchaseWorldItem('${item.id}')"`}>קנה</button>` : ''}
        </div>`;
    }).join('');
}

async function purchaseWorldItem(itemId) {
    const result = await window.api.shop.purchase({ itemId, itemType: 'items' });
    if (result.success) {
        currentUser = result.user;
        refreshUI();
        showToast('פריט נרכש! 📦', 'success');
        loadShopWorldItems();
    } else showToast(result.error || 'שגיאה', 'error');
}

// ---- Shop: History tab ----
async function loadShopHistory() {
    document.getElementById('shop-categories').innerHTML = '';
    const grid = document.getElementById('shop-grid');
    grid.className = 'history-container';
    const history = await window.api.shop.getPurchaseHistory();
    if (!history || history.length === 0) {
        grid.innerHTML = '<div class="empty-state"><span class="empty-icon">📜</span><p>עדיין אין רכישות</p></div>';
        return;
    }
    const TYPE_LABELS = { game: '🎮 משחק', time: '⏱️ זמן', avatar: '🎭 אווטאר', theme: '🎨 ערכת נושא', item: '📦 פריט' };
    grid.innerHTML = `
        <div class="purchase-history-list">
            ${history.map(h => {
                const d = new Date(h.date);
                const dateStr = d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                return `
                <div class="history-row">
                    <span class="history-icon">${h.icon || TYPE_LABELS[h.type]?.split(' ')[0] || '🛒'}</span>
                    <div class="history-info">
                        <span class="history-name">${escapeHtml(h.name)}</span>
                        <span class="history-type">${TYPE_LABELS[h.type] || h.type}</span>
                    </div>
                    <div class="history-meta">
                        <span class="history-price">💰 ${h.price}</span>
                        <span class="history-date">${dateStr}</span>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
}

// ---- Gift Modal ----
function openGiftModal() {
    window.api.shop.getSiblings().then(siblings => {
        const sel = document.getElementById('gift-to-user');
        if (!siblings || siblings.length === 0) {
            showToast('אין ילדים אחרים לשלוח אליהם', 'error');
            return;
        }
        sel.innerHTML = siblings.map(s => `<option value="${s.username}">${escapeHtml(s.displayName)} (${s.coins} 💰)</option>`).join('');
        document.getElementById('gift-amount').value = 10;
        document.getElementById('gift-error').classList.add('hidden');
        document.getElementById('gift-modal').classList.remove('hidden');
    });
}

function closeGiftModal() {
    document.getElementById('gift-modal').classList.add('hidden');
}

async function sendGift() {
    const toUsername = document.getElementById('gift-to-user').value;
    const amount = parseInt(document.getElementById('gift-amount').value);
    const errEl = document.getElementById('gift-error');
    errEl.classList.add('hidden');
    if (!toUsername || !amount || amount < 1) {
        errEl.textContent = 'בחר נמען וסכום תקין';
        errEl.classList.remove('hidden');
        return;
    }
    const result = await window.api.shop.giftCoins({ toUsername, amount });
    if (result.success) {
        currentUser = result.user;
        closeGiftModal();
        refreshUI();
        document.getElementById('shop-balance').textContent = currentUser?.coins || 0;
        showToast(`שלחת ${amount} 💰 מתנה! 🎁`, 'success');
    } else {
        errEl.textContent = result.error || 'שגיאה';
        errEl.classList.remove('hidden');
    }
}
