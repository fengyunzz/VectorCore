const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');

let mainWindow;

function isMainWindow(webContents) {
    return mainWindow && webContents && webContents.id === mainWindow.webContents.id;
}

function configureCameraPermission() {
    session.defaultSession.setPermissionCheckHandler((webContents, permission, _origin, details) => {
        return isMainWindow(webContents)
            && permission === 'media'
            && details.mediaType === 'video';
    });

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
        const mediaTypes = details.mediaTypes || [];
        const allowCamera = isMainWindow(webContents)
            && permission === 'media'
            && mediaTypes.includes('video')
            && !mediaTypes.includes('audio');

        callback(allowCamera);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 640,
        show: false,
        autoHideMenuBar: true,
        backgroundColor: '#000000',
        icon: path.join(__dirname, 'ico.png'),
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
    configureCameraPermission();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
