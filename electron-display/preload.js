const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setMouseEvents: (ignore) => ipcRenderer.send('set-mouse-events', ignore),
  setOpacity: (opacity) => ipcRenderer.send('set-opacity', opacity),
  setRoomCode: (code) => ipcRenderer.send('set-room-code', code)
});
