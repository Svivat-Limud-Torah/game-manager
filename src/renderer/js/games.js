// ==================== My Games ====================

async function loadMyGames() {
    showSkeleton('my-games-grid', 4);
    customGames = await window.api.customGames.getAll();
    gameStats = await window.api.customGames.getStats();
    const owned = currentUser?.ownedGames || [];
    const favs = currentUser?.favoriteGames || [];
    let myGames = customGames.filter(g => owned.includes(g.id));

    // Sort: favorites first, then by last played descending
    myGames.sort((a, b) => {
        const aFav = favs.includes(a.id) ? 1 : 0;
        const bFav = favs.includes(b.id) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        const aLast = gameStats[a.id]?.lastPlayed || '';
        const bLast = gameStats[b.id]?.lastPlayed || '';
        return bLast.localeCompare(aLast);
    });

    // Apply category filter
    if (myGamesFilter !== 'all') {
        myGames = myGames.filter(g => (g.category || 'other') === myGamesFilter);
    }

    // Sync filter button states
    document.querySelectorAll('.game-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === myGamesFilter);
    });

    const grid = document.getElementById('my-games-grid');
    const noGames = document.getElementById('no-games');

    if (myGames.length === 0) {
        grid.innerHTML = '';
        noGames.classList.remove('hidden');
        return;
    }
    noGames.classList.add('hidden');

    grid.innerHTML = myGames.map(game => {
        const isFav = favs.includes(game.id);
        const stats = gameStats[game.id] || {};
        const lastPlayed = stats.lastPlayed ? formatRelativeTime(new Date(stats.lastPlayed)) : null;
        const totalTime = stats.totalMinutes > 0 ? formatPlayTime(stats.totalMinutes) : null;
        const launches = stats.launchCount || 0;
        const catLabel = CATEGORY_LABELS[game.category || 'other'] || '';
        return `
        <div class="game-card">
            <button class="fav-btn ${isFav ? 'fav-active' : ''}" onclick="toggleFavorite('${game.id}')" title="${isFav ? 'הסר ממועדפים' : 'הוסף למועדפים'}">⭐</button>
            <div class="game-icon">${game.icon || '🎮'}</div>
            <div class="game-name">${escapeHtml(game.name)}</div>
            <span class="game-cat-badge cat-${game.category || 'other'}">${catLabel}</span>
            <div class="game-stats-row">
                ${lastPlayed ? `<span title="שוחק לאחרונה">🕐 ${lastPlayed}</span>` : '<span class="text-secondary">לא שוחק עדיין</span>'}
                ${totalTime ? `<span title="סה&quot;כ זמן">⏱️ ${totalTime}</span>` : ''}
                ${launches > 0 ? `<span title="הפעלות">▶ ${launches}×</span>` : ''}
            </div>
            <button class="btn btn-primary" onclick="launchGame('${game.id}')">▶ שחק</button>
        </div>`;
    }).join('');
}

async function toggleFavorite(gameId) {
    const result = await window.api.customGames.toggleFavorite(gameId);
    if (result.success) {
        currentUser.favoriteGames = result.favoriteGames;
        loadMyGames();
    }
}

async function launchGame(gameId) {
    await window.api.customGames.endSession();
    const result = await window.api.customGames.launch(gameId);
    if (!result.success) {
        showToast(result.error || 'לא ניתן להפעיל את המשחק', 'error');
    } else {
        setTimeout(async () => {
            gameStats = await window.api.customGames.getStats();
            if (currentSection === 'games') loadMyGames();
        }, 800);
    }
}

function setupGameFilters() {
    document.querySelectorAll('.game-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            myGamesFilter = btn.dataset.cat;
            loadMyGames();
        });
    });
}

// Auto-end session when window regains focus (user came back from game)
window.addEventListener('focus', async () => {
    if (currentUser && !currentUser.isParent && !currentUser.isAdmin) {
        await window.api.customGames.endSession();
        if (currentSection === 'games') {
            gameStats = await window.api.customGames.getStats();
            loadMyGames();
        }
    }
});
