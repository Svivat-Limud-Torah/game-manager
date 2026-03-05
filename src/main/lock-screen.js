const { BrowserWindow } = require('electron');
const path = require('path');
const state = require('./app-state');

function createLockScreen() {
    if (state.lockWindow) return;
    state.lockWindow = new BrowserWindow({
        fullscreen: true,
        alwaysOnTop: true,
        frame: false,
        skipTaskbar: true,
        minimizable: false,
        maximizable: false,
        resizable: false,
        movable: false,
        focusable: true,
        backgroundColor: '#0a0a0a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '..', 'preload.js')
        }
    });

    state.lockWindow.loadFile(path.join(__dirname, '..', 'renderer', 'lock.html'));
    state.lockWindow.setAlwaysOnTop(true, 'screen-saver');
    state.lockWindow.on('close', (e) => e.preventDefault());
    state.lockWindow.on('blur', () => {
        if (state.lockWindow) {
            state.lockWindow.focus();
            state.lockWindow.setAlwaysOnTop(true, 'screen-saver');
        }
    });
}

function closeLockScreen() {
    if (state.lockWindow) {
        state.lockWindow.removeAllListeners('close');
        state.lockWindow.close();
        state.lockWindow = null;
    }
}

module.exports = { createLockScreen, closeLockScreen };
