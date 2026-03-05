const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app } = require('electron');
const { store } = require('./store');

// ==================== PATHS ====================
function getAppPath() {
    if (app.isPackaged) return path.dirname(app.getPath('exe'));
    return path.join(__dirname, '..', '..');
}

function getUnityDataPath() {
    return path.join(getAppPath(), 'data', 'users');
}

// ==================== UNITY SYNC ====================
function syncToUnity(username, user) {
    try {
        const userPath = path.join(getUnityDataPath(), username);
        if (!fs.existsSync(userPath)) fs.mkdirSync(userPath, { recursive: true });
        fs.writeFileSync(path.join(userPath, 'money.txt'), String(user.coins || 0), 'utf8');
        fs.writeFileSync(path.join(userPath, 'item_spawn_order.txt'), (user.worldItems || []).join('\n'), 'utf8');
        fs.writeFileSync(path.join(userPath, 'purchase_orders.txt'), (user.ownedItems || []).join('\n'), 'utf8');
        return true;
    } catch (error) {
        console.error('Unity sync error:', error);
        return false;
    }
}

// ==================== PASSWORD HASHING ====================
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    if (!stored || !stored.includes(':')) {
        // Legacy plaintext — migrate on successful match
        return password === stored;
    }
    const [salt, hash] = stored.split(':');
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
}

function migratePasswords() {
    const users = store.get('users') || {};
    let changed = false;
    for (const [username, user] of Object.entries(users)) {
        if (user.password && !user.password.includes(':')) {
            users[username].password = hashPassword(user.password);
            changed = true;
        }
    }
    if (changed) store.set('users', users);
}

// ==================== AUTH HELPERS ====================
function requireAdmin(errorMsg = 'אין הרשאת הורה') {
    const currentUser = store.get('currentUser');
    const user = currentUser ? store.get(`users.${currentUser}`) : null;
    if (!user?.isParent && !user?.isAdmin) {
        return { authorized: false, result: { success: false, error: errorMsg } };
    }
    return { authorized: true, user, currentUser };
}

function requireLogin() {
    const currentUser = store.get('currentUser');
    if (!currentUser) return { loggedIn: false, result: { success: false, error: 'לא מחובר' } };
    const user = store.get(`users.${currentUser}`);
    return { loggedIn: true, user, currentUser };
}

// ==================== TIME WINDOW ====================
function isTimeAllowed(settings) {
    const windows = settings.timeWindows;
    if (windows && windows.length > 0) {
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        for (const w of windows) {
            const [fh, fm] = w.from.split(':').map(Number);
            const [th, tm] = w.to.split(':').map(Number);
            const from = fh * 60 + fm;
            const to = th * 60 + tm;
            if (from < to ? (nowMins >= from && nowMins < to) : (nowMins >= from || nowMins < to)) return true;
        }
        return false;
    }
    const start = settings.allowedHoursStart ?? 0;
    const end = settings.allowedHoursEnd ?? 24;
    if (end < 24 && start < end) {
        const nowH = new Date().getHours() + new Date().getMinutes() / 60;
        return nowH >= start && nowH < end;
    }
    return true;
}

// ==================== NOTIFICATIONS ====================
function pushNotification(username, { type, title, body, icon }) {
    const notifs = store.get(`notifications.${username}`) || [];
    notifs.unshift({
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type, title, body, icon: icon || '🔔', read: false,
        createdAt: new Date().toISOString()
    });
    if (notifs.length > 50) notifs.length = 50;
    store.set(`notifications.${username}`, notifs);
}

// ==================== ACTIVITY & STATS ====================
function addPurchaseHistory(username, entry) {
    try {
        const history = store.get(`users.${username}.purchaseHistory`) || [];
        history.unshift({ ...entry, date: new Date().toISOString() });
        if (history.length > 200) history.length = 200;
        store.set(`users.${username}.purchaseHistory`, history);
    } catch (e) { /* non-critical */ }
}

function logActivity(username, type, message, icon) {
    try {
        const log = store.get('activityLog') || [];
        log.unshift({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            username,
            displayName: store.get(`users.${username}.displayName`) || username,
            type, message, icon: icon || '📌'
        });
        if (log.length > 500) log.length = 500;
        store.set('activityLog', log);
    } catch (e) { /* non-critical */ }
}

function recordDailyStats(username, delta) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const key = `users.${username}.dailyHistory.${today}`;
        const ex = store.get(key) || { questions: 0, correct: 0, coins: 0, timeMinutes: 0 };
        store.set(key, {
            questions: (ex.questions || 0) + (delta.questions || 0),
            correct: (ex.correct || 0) + (delta.correct || 0),
            coins: (ex.coins || 0) + (delta.coins || 0),
            timeMinutes: (ex.timeMinutes || 0) + (delta.timeMinutes || 0)
        });
    } catch (e) { /* non-critical */ }
}

function resetWeeklyStatsIfNeeded(username) {
    const user = store.get(`users.${username}`);
    if (!user) return;
    const now = new Date();
    const day = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - day);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toDateString();
    if (!user.weeklyStats || user.weeklyStats.weekStart !== weekStartStr) {
        user.weeklyStats = { weekStart: weekStartStr, questionsAnswered: 0, coinsEarned: 0 };
        store.set(`users.${username}`, user);
    }
}

// ==================== AVATAR GENERATION ====================
function generateAvatarDataUri(config) {
    const state = require('./app-state');
    if (!config) return null;
    const { style = 'adventurer', seed = 'default', bg } = config;
    const cacheKey = `${style}||${seed}`;
    if (state.dicebearCache[cacheKey]) return state.dicebearCache[cacheKey];
    try {
        const { createAvatar } = require('@dicebear/core');
        const collection = require('@dicebear/collection');
        const styleFunc = collection[style];
        if (!styleFunc) return null;
        const opts = { seed };
        if (bg) opts.backgroundColor = [bg];
        opts.backgroundType = ['solid'];
        const svgStr = createAvatar(styleFunc, opts).toString();
        const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
        state.dicebearCache[cacheKey] = dataUri;
        return dataUri;
    } catch (e) {
        console.error('DiceBear error:', style, seed, e.message);
        return null;
    }
}

module.exports = {
    getAppPath, getUnityDataPath, syncToUnity,
    hashPassword, verifyPassword, migratePasswords,
    requireAdmin, requireLogin, isTimeAllowed,
    pushNotification, addPurchaseHistory, logActivity, recordDailyStats,
    generateAvatarDataUri
};
