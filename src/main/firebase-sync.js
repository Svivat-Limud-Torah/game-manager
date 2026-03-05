// ==================== Firebase Real-time Sync ====================
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get, update, onValue, onDisconnect, serverTimestamp, off } = require('firebase/database');
const { store } = require('./store');

const firebaseConfig = {
    apiKey: "AIzaSyAIjg-t81oRig1tNI6TcKsh4IVoo--U19k",
    authDomain: "kidscreen-102f1.firebaseapp.com",
    databaseURL: "https://kidscreen-102f1-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "kidscreen-102f1",
    storageBucket: "kidscreen-102f1.firebasestorage.app",
    messagingSenderId: "875721099337",
    appId: "1:875721099337:web:33cd57a4decbf9c5fe5798"
};

let firebaseApp = null;
let db = null;
let listeners = [];
let isOnline = false;
let familyId = null;
let syncPaused = false;  // Prevents feedback loops when applying remote changes

// ==================== Initialization ====================

function initFirebase() {
    try {
        firebaseApp = initializeApp(firebaseConfig, 'kidscreen-sync');
        db = getDatabase(firebaseApp);
        familyId = store.get('familyId') || null;
        console.log('[Firebase] Initialized', familyId ? `familyId=${familyId}` : '(no family yet)');
        return true;
    } catch (err) {
        console.error('[Firebase] Init failed:', err.message);
        return false;
    }
}

function getDb() { return db; }
function getFamilyId() { return familyId || store.get('familyId'); }
function getIsOnline() { return isOnline; }

// ==================== Family Management ====================

/**
 * Create a new family in Firebase. Called when a parent sets up online sync.
 */
async function createFamily(parentUsername) {
    if (!db) return null;
    const id = `family_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const familyRef = ref(db, `families/${id}`);
    const localData = buildFamilySnapshot();
    await set(familyRef, {
        info: { parentUsername, createdAt: new Date().toISOString() },
        ...localData
    });
    familyId = id;
    store.set('familyId', id);
    store.set('syncEnabled', true);
    console.log('[Firebase] Family created:', id);
    return id;
}

/**
 * Join an existing family. Called when a second machine connects.
 */
async function joinFamily(id) {
    if (!db) return { success: false, error: 'Firebase לא מאותחל' };
    const snapshot = await get(ref(db, `families/${id}/info`));
    if (!snapshot.exists()) return { success: false, error: 'משפחה לא נמצאה' };
    familyId = id;
    store.set('familyId', id);
    store.set('syncEnabled', true);
    // Pull all data from Firebase to local
    await pullFullSync();
    console.log('[Firebase] Joined family:', id);
    return { success: true, info: snapshot.val() };
}

// ==================== Data Snapshot Helpers ====================

/**
 * Build a complete data snapshot from local store for upload.
 */
function buildFamilySnapshot() {
    return {
        users: sanitizeUsersForSync(store.get('users') || {}),
        tasks: store.get('tasks') || [],
        settings: store.get('settings') || {},
        customQuestions: store.get('customQuestions') || [],
        customGames: store.get('customGames') || [],
        customAchievements: store.get('customAchievements') || [],
        challenges: store.get('challenges') || [],
        messages: store.get('messages') || [],
        notifications: store.get('notifications') || {}
    };
}

/**
 * Remove sensitive local-only data that shouldn't sync (e.g. nothing for now).
 * Passwords are already hashed so they're safe to sync.
 */
function sanitizeUsersForSync(users) {
    const result = {};
    for (const [username, user] of Object.entries(users)) {
        result[username] = { ...user };
    }
    return result;
}

// ==================== Push (Local → Firebase) ====================

/**
 * Push a specific store path to Firebase.
 * @param {string} storePath e.g. 'users.dodo' or 'tasks' or 'settings'
 */
async function pushToFirebase(storePath) {
    const fid = getFamilyId();
    if (!db || !fid || syncPaused) return;
    try {
        const firebasePath = `families/${fid}/${storePath.replace(/\./g, '/')}`;
        const value = store.get(storePath);
        await set(ref(db, firebasePath), value !== undefined ? value : null);
    } catch (err) {
        console.error('[Firebase] Push failed:', storePath, err.message);
    }
}

/**
 * Push ALL family data to Firebase (full overwrite).
 */
async function pushFullSync() {
    const fid = getFamilyId();
    if (!db || !fid) return;
    try {
        const data = buildFamilySnapshot();
        await update(ref(db, `families/${fid}`), data);
        console.log('[Firebase] Full push done');
    } catch (err) {
        console.error('[Firebase] Full push failed:', err.message);
    }
}

// ==================== Pull (Firebase → Local) ====================

/**
 * Pull ALL data from Firebase and overwrite local store.
 */
async function pullFullSync() {
    const fid = getFamilyId();
    if (!db || !fid) return;
    try {
        const snapshot = await get(ref(db, `families/${fid}`));
        if (!snapshot.exists()) return;
        const data = snapshot.val();
        syncPaused = true;
        if (data.users) store.set('users', data.users);
        if (data.tasks) store.set('tasks', data.tasks);
        if (data.settings) store.set('settings', data.settings);
        if (data.customQuestions) store.set('customQuestions', data.customQuestions);
        if (data.customGames) store.set('customGames', data.customGames);
        if (data.customAchievements) store.set('customAchievements', data.customAchievements);
        if (data.challenges) store.set('challenges', data.challenges);
        if (data.messages) store.set('messages', data.messages);
        if (data.notifications) store.set('notifications', data.notifications);
        syncPaused = false;
        console.log('[Firebase] Full pull done');
    } catch (err) {
        syncPaused = false;
        console.error('[Firebase] Full pull failed:', err.message);
    }
}

// ==================== Real-time Listeners ====================

/**
 * Start listening to Firebase changes and apply them locally.
 */
function startListeners() {
    const fid = getFamilyId();
    if (!db || !fid) return;

    stopListeners(); // Clear existing

    const SYNC_PATHS = ['users', 'tasks', 'settings', 'customQuestions', 'customGames', 'customAchievements', 'challenges', 'messages', 'notifications'];

    SYNC_PATHS.forEach(path => {
        const dbRef = ref(db, `families/${fid}/${path}`);
        const unsub = onValue(dbRef, (snapshot) => {
            if (syncPaused) return;
            const val = snapshot.val();
            if (val === null || val === undefined) return;
            syncPaused = true;
            store.set(path, val);
            syncPaused = false;
        }, (err) => {
            console.error(`[Firebase] Listener error on ${path}:`, err.message);
        });
        listeners.push({ ref: dbRef, unsub });
    });

    // Connection status
    const connRef = ref(db, '.info/connected');
    const connUnsub = onValue(connRef, (snap) => {
        isOnline = snap.val() === true;
        console.log('[Firebase] Connection:', isOnline ? 'ONLINE' : 'OFFLINE');
        if (isOnline) updatePresence();
    });
    listeners.push({ ref: connRef, unsub: connUnsub });

    console.log('[Firebase] Listeners started for', SYNC_PATHS.length, 'paths');
}

function stopListeners() {
    listeners.forEach(l => {
        try { off(l.ref); } catch (e) { /* ignore */ }
    });
    listeners = [];
}

// ==================== Presence (Online/Offline) ====================

function updatePresence() {
    const fid = getFamilyId();
    const currentUser = store.get('currentUser');
    if (!db || !fid || !currentUser) return;

    const presRef = ref(db, `families/${fid}/online/${currentUser}`);
    set(presRef, { online: true, lastSeen: Date.now(), machine: getMachineId() });

    // When this client disconnects, mark offline
    onDisconnect(presRef).set({ online: false, lastSeen: Date.now(), machine: getMachineId() });
}

function clearPresence() {
    const fid = getFamilyId();
    const currentUser = store.get('currentUser');
    if (!db || !fid || !currentUser) return;
    const presRef = ref(db, `families/${fid}/online/${currentUser}`);
    set(presRef, { online: false, lastSeen: Date.now(), machine: getMachineId() });
}

/**
 * Get all online statuses for the family.
 */
async function getOnlineStatuses() {
    const fid = getFamilyId();
    if (!db || !fid) return {};
    try {
        const snap = await get(ref(db, `families/${fid}/online`));
        return snap.exists() ? snap.val() : {};
    } catch (err) {
        return {};
    }
}

function getMachineId() {
    let id = store.get('machineId');
    if (!id) {
        id = `machine_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        store.set('machineId', id);
    }
    return id;
}

// ==================== Store Watcher (auto-push on change) ====================

let storeWatcherActive = false;

function startStoreWatcher() {
    if (storeWatcherActive) return;
    storeWatcherActive = true;

    // electron-store emits 'change' on every .set()
    store.onDidAnyChange((newVal, oldVal) => {
        if (syncPaused || !getFamilyId()) return;
        // Debounced push of all data
        schedulePush();
    });
}

let pushTimer = null;
function schedulePush() {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
        pushFullSync();
    }, 500); // Debounce 500ms
}

// ==================== High-level API ====================

/**
 * Initialize Firebase and start syncing if a family is already configured.
 */
function startSync() {
    if (!initFirebase()) return;
    const syncEnabled = store.get('syncEnabled');
    const fid = store.get('familyId');
    if (syncEnabled && fid) {
        familyId = fid;
        startListeners();
        startStoreWatcher();
        console.log('[Firebase] Sync auto-started for family', fid);
    }
}

/**
 * Setup a new family (parent action) — push local data, start syncing.
 */
async function setupFamily(parentUsername) {
    if (!db) initFirebase();
    const id = await createFamily(parentUsername);
    if (!id) return { success: false, error: 'יצירת משפחה נכשלה' };
    startListeners();
    startStoreWatcher();
    updatePresence();
    return { success: true, familyId: id };
}

/**
 * Connect to existing family (second machine / parent remote).
 */
async function connectToFamily(familyIdToJoin) {
    if (!db) initFirebase();
    const result = await joinFamily(familyIdToJoin);
    if (result.success) {
        startListeners();
        startStoreWatcher();
        updatePresence();
    }
    return result;
}

/**
 * Disconnect sync entirely.
 */
function disconnectSync() {
    clearPresence();
    stopListeners();
    storeWatcherActive = false;
    store.set('syncEnabled', false);
    store.delete('familyId');
    familyId = null;
    console.log('[Firebase] Sync disconnected');
}

module.exports = {
    startSync,
    setupFamily,
    connectToFamily,
    disconnectSync,
    pushToFirebase,
    pushFullSync,
    pullFullSync,
    getIsOnline,
    getOnlineStatuses,
    updatePresence,
    clearPresence,
    getFamilyId
};
