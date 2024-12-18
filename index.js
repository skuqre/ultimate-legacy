const { app, BrowserWindow, globalShortcut } = require('electron');

// disable lcd antialiasing, it stinks
app.commandLine.appendSwitch("--disable-lcd-text");

let mainWindow;
const WINDOWSIZE = [1920, 1080]

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: WINDOWSIZE[0],
        height: WINDOWSIZE[1],
        minWidth: 512,
        minHeight: 288,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            zoomFactor: 1
        },
        fullscreenable: true,
        // fullscreen: true
    });

    mainWindow.webContents.openDevTools();
    mainWindow.loadFile('src/index.html');

    let prevW = WINDOWSIZE[0];
    let prevH = WINDOWSIZE[1];
    mainWindow.on("resize", (e) => {
        mainWindow.webContents.setZoomFactor(1);
        if (mainWindow.isMinimized()) return;
        
        let newSize = mainWindow.getContentSize();
        let newW = newSize[0];
        let newH = newSize[1];

        if (prevW != newW) {
            newH = WINDOWSIZE[1] * (newW / WINDOWSIZE[0]);
        }
        if (prevH != newH) {
            newW = WINDOWSIZE[0] * (newH / WINDOWSIZE[1]);
        }

        prevW = newW;
        prevH = newH;

        mainWindow.setContentSize(Math.round(newW), Math.round(newH));
        mainWindow.webContents.setZoomFactor(newH / 1080);
    });

    mainWindow.setMenu(null);
    mainWindow.setContentSize(1280, 720, true);
    mainWindow.center();
    
    mainWindow.webContents.once("did-finish-load", () => {
        mainWindow.emit("resize");
    });

    globalShortcut.register('CommandOrControl+Alt+R', () => {
        mainWindow.reload();
        mainWindow.emit("resize");
    });
    globalShortcut.register('CommandOrControl+Alt+Shift+I', () => {
        mainWindow.webContents.openDevTools();
    });
    globalShortcut.register('CommandOrControl+Alt+Enter', () => {
        mainWindow.setFullScreen(!mainWindow.fullScreen);
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
