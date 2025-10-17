const { app, BrowserWindow, globalShortcut, ipcMain, dialog } = require('electron');
const fs = require("fs");

// disable lcd antialiasing, it stinks
app.commandLine.appendSwitch("--disable-lcd-text");

// (probably) set a soft limit to how many models can be loaded
app.commandLine.appendSwitch("--max-active-webgl-contexts", "24");

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
            // devTools: false
        },
        fullscreenable: true,
        fullscreen: true
    });

    require('@electron/remote/main').initialize();
    require("@electron/remote/main").enable(mainWindow.webContents);

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
        curLoadedFilePath = null;
    });

    mainWindow.emit("resize");
}

let curLoadedFilePath = null;
let savingAs = false;

app.whenReady().then(() => {
    ipcMain.on('save-file', (event, scn) => {
        var newFilePath = curLoadedFilePath;
        if (curLoadedFilePath === null || savingAs) {
            newFilePath = dialog.showSaveDialogSync({
                filters: [
                    { name: "Scenario File", extensions: ["scn"] }
                ],
                properties: ["dontAddToRecent"],
            });

            savingAs = false;
        }

        if (newFilePath === undefined) {
            console.log("File saving cancelled");
            return;
        }

        curLoadedFilePath = newFilePath;

        fs.writeFileSync(curLoadedFilePath, JSON.stringify(scn, null, "\t"));

        mainWindow.webContents.send("popUpError", "File saved.");

        console.log("File saved to", curLoadedFilePath);
    });

    ipcMain.on('save-as-file', (event, scn) => {
        savingAs = true;

        console.log("File path reset to null because of Save As.");
    });

    ipcMain.on('load-file', (event, path) => {
        curLoadedFilePath = path;

        console.log("File at", curLoadedFilePath, "loaded");
    });

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

process.on('warning', e => console.warn(e.stack));