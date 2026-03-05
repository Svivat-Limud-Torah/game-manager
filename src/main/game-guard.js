const path = require('path');
const { exec } = require('child_process');
const { store } = require('./store');
const state = require('./app-state');

function startGameGuard() {
    stopGameGuard();
    runGameGuardTick();
    state.gameGuardInterval = setInterval(runGameGuardTick, 2000);
}

function stopGameGuard() {
    if (state.gameGuardInterval) {
        clearInterval(state.gameGuardInterval);
        state.gameGuardInterval = null;
    }
    state.recentlyBlocked.clear();
}

function runGameGuardTick() {
    const username = store.get('currentUser');
    if (!username) return stopGameGuard();
    const user = store.get(`users.${username}`);
    if (!user || user.isParent || user.isAdmin) return stopGameGuard();

    const settings = store.get('settings') || {};
    if (settings.gameGuardEnabled === false) return;

    const games = store.get('customGames') || [];
    const guardedGames = games.filter(g => g.exePath && g.guarded !== false);
    if (guardedGames.length === 0) return;

    const ownedIds = user.ownedGames || [];
    const unauthorizedGames = guardedGames.filter(g => !ownedIds.includes(g.id));
    if (unauthorizedGames.length === 0) return;

    const watchMap = {};
    for (const g of unauthorizedGames) {
        const procName = path.basename(g.exePath).toLowerCase();
        watchMap[procName] = g;
    }

    exec('powershell -NoProfile -Command "Get-Process | Select-Object -Property Name,Id | ConvertTo-Csv -NoTypeInformation"',
        { timeout: 3000 },
        (err, stdout) => {
            if (err || !stdout) return;
            const lines = stdout.trim().split('\n').slice(1);
            for (const line of lines) {
                const parts = line.replace(/"/g, '').split(',');
                const procName = (parts[0] || '').trim().toLowerCase();
                const pid = parseInt((parts[1] || '').trim());
                const match = watchMap[procName + '.exe'] || watchMap[procName];
                if (!match || !pid) continue;
                if (state.recentlyBlocked.has(pid)) continue;
                state.recentlyBlocked.add(pid);
                setTimeout(() => state.recentlyBlocked.delete(pid), 3000);
                exec(`taskkill /F /PID ${pid}`, () => {
                    const win = state.mainWindow;
                    if (win && !win.isDestroyed()) {
                        win.webContents.send('gameguard:blocked', {
                            gameName: match.name,
                            icon: match.icon || '🎮'
                        });
                        win.focus();
                    }
                });
            }
        }
    );
}

module.exports = { startGameGuard, stopGameGuard };
