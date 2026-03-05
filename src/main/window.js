const { BrowserWindow } = require('electron');
const path = require('path');
const state = require('./app-state');

function createWindow() {
    state.mainWindow = new BrowserWindow({
        fullscreen: true,
        frame: false,
        skipTaskbar: false,
        backgroundColor: '#0a0a0a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '..', 'preload.js')
        },
        icon: path.join(__dirname, '..', '..', 'ICON.png')
    });

    state.mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    if (process.argv.includes('--dev')) state.mainWindow.webContents.openDevTools();
    setBlockingMode(true);
}

function setBlockingMode(blocking) {
    const win = state.mainWindow;
    if (!win) return;
    if (blocking) {
        win.setAlwaysOnTop(true, 'screen-saver');
        win.setSkipTaskbar(false);
        win.setMinimizable(false);
        if (!state.blurHandler) {
            state.blurHandler = () => { if (win && !win.isDestroyed()) win.focus(); };
            win.on('blur', state.blurHandler);
        }
        win.removeAllListeners('close');
        win.on('close', (e) => e.preventDefault());
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
        win.setFullScreen(true);
    } else {
        win.setAlwaysOnTop(false);
        win.setMinimizable(true);
        if (state.blurHandler) {
            win.removeListener('blur', state.blurHandler);
            state.blurHandler = null;
        }
        win.removeAllListeners('close');
        win.on('close', (e) => e.preventDefault());
    }
}

module.exports = { createWindow, setBlockingMode };
