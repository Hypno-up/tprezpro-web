const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let displayWindow = null;

// Room code from command line args or default
const args = process.argv.slice(2);
let roomCode = args[0] || '';

function createDisplayWindow() {
  displayWindow = new BrowserWindow({
    width: 800,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load display page with room code
  const displayURL = `file://${path.join(__dirname, 'display.html')}?room=${roomCode}`;
  displayWindow.loadURL(displayURL);

  if (process.platform === 'darwin') {
    displayWindow.setWindowButtonVisibility(false);
  }

  displayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  displayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  displayWindow.setIgnoreMouseEvents(true);

  // IPC handlers for lock/unlock from Firebase state
  ipcMain.on('set-mouse-events', (event, ignore) => {
    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.setIgnoreMouseEvents(ignore);
    }
  });

  ipcMain.on('set-opacity', (event, opacity) => {
    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.setOpacity(opacity);
    }
  });

  displayWindow.on('closed', () => {
    displayWindow = null;
    app.quit();
  });
}

// Show room code input if not provided
function createRoomInputWindow() {
  const inputWin = new BrowserWindow({
    width: 400,
    height: 250,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  inputWin.loadURL(`file://${path.join(__dirname, 'room-input.html')}`);

  ipcMain.on('set-room-code', (event, code) => {
    roomCode = code;
    inputWin.close();
    createDisplayWindow();
  });

  inputWin.on('closed', () => {
    if (!displayWindow) app.quit();
  });
}

app.whenReady().then(() => {
  if (roomCode) {
    createDisplayWindow();
  } else {
    createRoomInputWindow();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
