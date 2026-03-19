const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const os = require('os');
const fs = require('fs');

let displayWindow = null;
const args = process.argv.slice(2);
let roomCode = args[0] || '';

// === Machine ID ===
function getMachineId() {
  const appDataPath = app.getPath('userData');
  const idFile = path.join(appDataPath, '.machine-id');

  if (fs.existsSync(idFile)) {
    return fs.readFileSync(idFile, 'utf8').trim();
  }

  const raw = `${os.hostname()}-${os.userInfo().username}-${appDataPath}-${Date.now()}`;
  const id = crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
  fs.writeFileSync(idFile, id, 'utf8');
  return id;
}

// === License storage ===
function getLicensePath() {
  return path.join(app.getPath('userData'), 'license.json');
}

function getStoredLicense() {
  try {
    const data = fs.readFileSync(getLicensePath(), 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function storeLicense(key, data) {
  fs.writeFileSync(getLicensePath(), JSON.stringify({ key, ...data }), 'utf8');
}

// === Validate with server ===
function validateLicenseOnServer(licenseKey, machineId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ licenseKey, machineId });
    const req = https.request({
      hostname: 'tprezpro-web.netlify.app',
      path: '/.netlify/functions/validate-license',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error('Invalid response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// === Windows ===

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

  // Use loadFile instead of loadURL for reliable local file loading
  displayWindow.loadFile(path.join(__dirname, 'display.html'), {
    query: { room: roomCode }
  });

  // Debug: log any load errors
  displayWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Display load failed:', errorCode, errorDescription);
  });

  if (process.platform === 'darwin') {
    displayWindow.setWindowButtonVisibility(false);
  }

  displayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  displayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  displayWindow.setIgnoreMouseEvents(true);

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

function createRoomInputWindow() {
  const inputWin = new BrowserWindow({
    width: 450,
    height: 500,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Use loadFile instead of loadURL
  inputWin.loadFile(path.join(__dirname, 'room-input.html'));

  // Debug: open devtools in dev mode, log errors in production
  inputWin.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Room input load failed:', errorCode, errorDescription);
  });

  // Show devtools if env is set (for debugging)
  if (process.env.DEBUG_ELECTRON) {
    inputWin.webContents.openDevTools({ mode: 'detach' });
  }

  ipcMain.on('set-room-code', (event, code) => {
    roomCode = code;
    inputWin.close();
    createDisplayWindow();
  });

  inputWin.on('closed', () => {
    if (!displayWindow) app.quit();
  });
}

// === IPC Handlers ===

ipcMain.handle('get-machine-id', () => {
  return getMachineId();
});

ipcMain.handle('get-license-status', () => {
  const stored = getStoredLicense();
  if (!stored) return { valid: false };

  if (stored.expiresAt && new Date(stored.expiresAt) < new Date()) {
    return { valid: false, error: 'Cle expiree' };
  }

  return { valid: true, ...stored };
});

ipcMain.handle('validate-license', async (event, key) => {
  try {
    const machineId = getMachineId();
    const result = await validateLicenseOnServer(key, machineId);

    if (result.valid) {
      storeLicense(key, result.data);
    }
    return result;
  } catch (err) {
    return { valid: false, error: 'Erreur reseau: ' + err.message };
  }
});

// === App Start ===

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
