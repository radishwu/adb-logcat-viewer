const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const adb = require('adbkit');
const client = adb.createClient({ host: '127.0.0.1', port: 5037 });

let messageFilterKey = null; // message日志过滤key

function createWindow() {
  currentWin = new BrowserWindow({
    width: 1200,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false
    }
  });

  currentWin.loadFile('index.html');
  currentWin.webContents.openDevTools();

  ipcMain.handle('filterMessage', async (event, filterValue) => {
    messageFilterKey = filterValue;
  });
}

let logcatStream = null; // 用于存储 logcat 流
let monitoredDeviceId = null; // 用于存储当前监听的设备ID
let currentWin = null;

function monitorDevices() {
  // setInterval(startAdbLogcat, 2000); // Check every 2 seconds
  client.trackDevices()
    .then(tracker => {
      tracker.on('add', device => {
        console.log(`Device ${device.id} was added`);
      });

      tracker.on('remove', device => {
        console.log(`Device ${device.id} was removed`);
        if (device.id === monitoredDeviceId) {
          stopLogcat();
        }
      });

      tracker.on('change', device => {
        console.log(`Device ${device.id} state changed to ${device.type}`);
        if (device.type === "device") {
          if (!logcatStream) {
            // 如果还没有监听任何设备，开始监听这个设备的 logcat
            monitoredDeviceId = device.id;
            startLogcat(device.id);
          }
        }
      });

      tracker.on('end', () => {
        console.log('Tracking devices stopped');
      });

      tracker.on('error', err => {
        console.error('Tracking devices encountered an error:', err.stack);
      });
    })
    .catch(err => {
      console.error('Something went wrong:', err.stack);
    });

  client.listDevices()
    .then(devices => {
      if (devices.length > 0) {
        const device = devices[0];
        if (!logcatStream) {
          // 如果还没有监听任何设备，开始监听这个设备的 logcat
          monitoredDeviceId = device.id;
          startLogcat(device.id);
        }
      }
    })
    .catch(err => console.error('ADB Error:', err));
}

function startLogcat(deviceId) {
  client.openLogcat(deviceId, { clear: true })
    .then(logcat => {
      logcatStream = logcat;
      logcat.on('entry', entry => {

        if (messageFilterKey) {
          if (entry.message.toLowerCase().includes(messageFilterKey)) {
            const log = `${entry.date} ${entry.pid}-${entry.tid} ${entry.tag} ${entry.message}`;
            try {
              currentWin.webContents.send('adb-log', log);
            } catch (e) {

            }
          }
        } else {
          const log = `${entry.date} ${entry.pid}-${entry.tid} ${entry.tag} ${entry.message}`;
          try {
            currentWin.webContents.send('adb-log', log);
          } catch (e) {

          }
        }
      });

      logcat.on('error', err => {
        console.error(`Logcat encountered an error on device ${deviceId}:`, err.stack);
        stopLogcat(); // 关闭 logcat 流
      });
    })
    .catch(err => {
      console.error(`Failed to open logcat on device ${deviceId}:`, err.stack);
    });
}

function stopLogcat() {
  if (logcatStream) {
    logcatStream.end(); // 关闭 logcat 流
    logcatStream = null;
    console.log(`Logcat stream for device ${monitoredDeviceId} closed`);
    monitoredDeviceId = null;
  }
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
