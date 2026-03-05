const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const state = require('./app-state');
const { store } = require('./store');
const { migratePasswords } = require('./helpers');
const { createWindow, setBlockingMode } = require('./window');
const { createLockScreen, closeLockScreen } = require('./lock-screen');
const { stopGameGuard } = require('./game-guard');

// Register all IPC handler modules
const registerUserHandlers = require('./handlers/users');
const registerTaskHandlers = require('./handlers/tasks');
const registerNotificationHandlers = require('./handlers/notifications');
const registerQuestionHandlers = require('./handlers/questions');
const registerShopHandlers = require('./handlers/shop');
const registerGameHandlers = require('./handlers/games');
const registerAdminHandlers = require('./handlers/admin');
const registerGamificationHandlers = require('./handlers/gamification-ipc');
const registerCustomizationHandlers = require('./handlers/customization');
const registerSettingsHandlers = require('./handlers/settings');
const registerStatsHandlers = require('./handlers/stats');
const registerSyncHandlers = require('./handlers/sync');
const registerSetupHandlers = require('./handlers/setup');
const firebaseSync = require('./firebase-sync');

// ==================== APP LIFECYCLE ====================
app.whenReady().then(() => {
    // Migrate plaintext passwords to hashed on first run
    migratePasswords();

    createWindow();

    app.on('browser-window-focus', () => {
        if (state.lockWindow) state.lockWindow.focus();
    });

    // Emergency exit shortcut
    globalShortcut.register('Ctrl+Shift+Q', () => {
        if (state.lockWindow) state.lockWindow.removeAllListeners('close');
        if (state.mainWindow) state.mainWindow.removeAllListeners('close');
        app.exit(0);
    });
});

app.on('will-quit', () => {
    firebaseSync.clearPresence();
    globalShortcut.unregisterAll();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ==================== WINDOW CONTROLS ====================
ipcMain.handle('window:minimize', () => state.mainWindow.minimize());
ipcMain.handle('window:maximize', () => {
    state.mainWindow.isMaximized() ? state.mainWindow.unmaximize() : state.mainWindow.maximize();
});
ipcMain.handle('window:close', () => {
    const currentUser = store.get('currentUser');
    const user = currentUser ? store.get(`users.${currentUser}`) : null;
    if (user?.isParent || user?.isAdmin) {
        state.mainWindow.removeAllListeners('close');
        app.quit();
    }
});
ipcMain.handle('window:setBlocking', (event, blocking) => {
    setBlockingMode(blocking);
    return { success: true };
});

// ==================== REGISTER ALL HANDLERS ====================
registerUserHandlers(ipcMain);
registerTaskHandlers(ipcMain);
registerNotificationHandlers(ipcMain);
registerQuestionHandlers(ipcMain);
registerShopHandlers(ipcMain);
registerGameHandlers(ipcMain);
registerAdminHandlers(ipcMain);
registerGamificationHandlers(ipcMain);
registerCustomizationHandlers(ipcMain);
registerSettingsHandlers(ipcMain);
registerStatsHandlers(ipcMain);
registerSyncHandlers(ipcMain);
registerSetupHandlers(ipcMain);

// Uninstall handler — point of no return, runs NSIS uninstaller then quits
ipcMain.handle('setup:startUninstall', () => {
    const path = require('path');
    const fs = require('fs');
    const { spawn } = require('child_process');

    // Release all window locks so the process can exit cleanly
    setBlockingMode(false);
    if (state.mainWindow) state.mainWindow.removeAllListeners('close');

    const exeDir = path.dirname(process.execPath);
    const uninstallerPath = path.join(exeDir, `Uninstall ${app.getName()}.exe`);

    if (fs.existsSync(uninstallerPath)) {
        spawn(uninstallerPath, [], { detached: true, stdio: 'ignore' }).unref();
    }
    // Quit immediately — uninstaller runs as separate process
    setTimeout(() => app.quit(), 500);
    return { success: true };
});

// Start Firebase sync if previously configured
firebaseSync.startSync();
