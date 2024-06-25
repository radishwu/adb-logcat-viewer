const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const adb = require('adbkit');
const client = adb.createClient({ host: '127.0.0.1', port: 5037 });

let logcatReader = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
  win.webContents.openDevTools();
}

function startAdbLogcat() {
  client.listDevices()
    .then(devices => {
      if (devices.length > 0) {
        const device = devices[0];

        if (logcatReader) {
          logcatReader.end();
        }

        client.openLogcat(device.id)
          .then(reader => {
            logcatReader = reader;
            reader.on('entry', entry => {
              const log = `${entry.date} [${entry.pid}] ${entry.tag}: ${entry.message}`;
              BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('adb-log', log);
              });
            });
          });
      }
    })
    .catch(err => console.error('ADB Error:', err));
}

function monitorDevices() {
  setInterval(startAdbLogcat, 2000); // Check every 2 seconds
}

app.whenReady().then(() => {
  createWindow();
  monitorDevices();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
