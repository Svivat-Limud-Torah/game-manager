const { dialog } = require('electron');
const { store } = require('../store');
const state = require('../app-state');

module.exports = function registerSettingsHandlers(ipcMain) {
    ipcMain.handle('settings:get', () => store.get('settings'));

    ipcMain.handle('settings:set', (event, newSettings) => {
        store.set('settings', { ...store.get('settings'), ...newSettings });
        return { success: true };
    });

    ipcMain.handle('settings:verifyPin', (event, pin) => {
        return { success: pin === store.get('settings.parentPin') };
    });

    ipcMain.handle('dialog:selectShortcut', async () => {
        const result = await dialog.showOpenDialog(state.mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Programs', extensions: ['exe', 'lnk', 'url', 'bat'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        return result.canceled ? null : result.filePaths[0];
    });
};
