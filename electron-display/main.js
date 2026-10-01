const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const os = require('os');
const fs = require('fs');

// Windows transparency fix
// v1.8.1: replaced `disable-gpu` (breaks Firebase WebSocket in some Chromium configs)
// with `--use-gl=swiftshader` — software GL keeps transparency working while
// leaving the network stack untouched.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('enable-transparent-visuals');
  app.commandLine.appendSwitch('use-gl', 'swiftshader');
  app.commandLine.appendSwitch('disable-gpu-compositing');
}

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
    ...(process.platform === 'win32' ? { backgroundColor: '#00000000' } : {}),
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

  if (process.env.TPREZ_DEBUG_DIR) attachDebugDump(displayWindow, process.env.TPREZ_DEBUG_DIR);

  // Debug: log any load errors
  displayWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Display load failed:', errorCode, errorDescription);
  });

  if (process.platform === 'darwin') {
    displayWindow.setWindowButtonVisibility(false);
  }

  displayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  displayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  // Ignore mouse events but forward them so CSS :hover works on close button
  displayWindow.setIgnoreMouseEvents(true, { forward: true });

  ipcMain.on('set-mouse-events', (event, ignore) => {
    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.setIgnoreMouseEvents(ignore, ignore ? { forward: true } : {});
    }
  });

  ipcMain.on('set-opacity', (event, opacity) => {
    // Never on Windows: setOpacity() on the transparent overlay freezes its painting.
    // The renderer applies opacity in CSS there (see display.html).
    if (process.platform === 'win32') return;
    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.setOpacity(opacity);
    }
  });

  displayWindow.on('closed', () => {
    displayWindow = null;
    app.quit();
  });
}

// Debug harness (CI only, enabled by TPREZ_DEBUG_DIR): after a few seconds, dump what the
// renderer thinks it shows (DOM + diagnostics), what it rendered (capturePage) and what is
// really on screen (desktop capture), then quit. Lets us debug Windows without a Windows PC.
function attachDebugDump(win, dir) {
  const { desktopCapturer, screen } = require('electron');
  fs.mkdirSync(dir, { recursive: true });
  const logFile = path.join(dir, 'console.log');
  const log = (line) => fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
  win.webContents.on('console-message', (e, level, message, line, source) => log(`[console:${level}] ${message} (${source}:${line})`));
  win.webContents.on('render-process-gone', (e, details) => log(`[render-process-gone] ${JSON.stringify(details)}`));
  app.on('child-process-gone', (e, details) => log(`[child-process-gone] ${JSON.stringify(details)}`));
  win.webContents.on('did-finish-load', () => log('[did-finish-load]'));

  const dump = async (label) => {
    try {
      const dom = await win.webContents.executeJavaScript(`JSON.stringify({
        text: document.getElementById('timer-text').innerText,
        connected: typeof connected !== 'undefined' ? connected : 'n/a',
        diag: typeof diag !== 'undefined' ? diag : 'n/a',
        sdkError: typeof sdkError !== 'undefined' ? sdkError : 'n/a',
        fallbackActive: typeof fallback !== 'undefined' ? fallback.active : 'n/a',
        hidden: document.hidden, visibility: document.visibilityState
      })`);
      fs.writeFileSync(path.join(dir, `dom-${label}.json`), dom);
      log(`[dom-${label}] ${dom}`);
    } catch (err) { log(`[dom-${label}] ERROR ${err.message}`); }
    try {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(dir, `page-${label}.png`), img.toPNG());
    } catch (err) { log(`[page-${label}] ERROR ${err.message}`); }
    try {
      const size = screen.getPrimaryDisplay().size;
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size });
      if (sources[0]) fs.writeFileSync(path.join(dir, `screen-${label}.png`), sources[0].thumbnail.toPNG());
    } catch (err) { log(`[screen-${label}] ERROR ${err.message}`); }
  };

  log(`[start] platform=${process.platform} electron=${process.versions.electron} bounds=${JSON.stringify(win.getBounds())}`);
  setTimeout(() => dump('02s'), 2000);
  setTimeout(() => dump('12s'), 12000);
  setTimeout(async () => {
    await dump('20s');
    try { log(`[gpu] ${JSON.stringify(app.getGPUFeatureStatus())}`); } catch (err) { log(`[gpu] ERROR ${err.message}`); }
    app.quit();
  }, 20000);
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

  // Load connection page from Netlify (avoids file:// / asar issues)
  inputWin.loadURL('https://tprezpro-web.netlify.app/electron-connect.html');

  // Fallback: if remote fails, try local
  inputWin.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Remote load failed, trying local:', errorCode, errorDescription);
    inputWin.loadFile(path.join(__dirname, 'room-input.html'));
  });

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
