const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onAdbLog: (callback) => ipcRenderer.on('adb-log', callback),
  filterMessage: (filterValue) => ipcRenderer.invoke('filterMessage', filterValue)
});
