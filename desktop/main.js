// Sword's Pass desktop app: a game window onto the live site, so every update you push
// is in the app the next time it opens (or on Ctrl+R). Offline, it shows a retry screen.
const {app, BrowserWindow, shell, Menu} = require('electron');
const path = require('node:path');
const SITE = process.env.SWORDS_PASS_URL || require('./package.json').site;

if (!app.requestSingleInstanceLock()) app.quit();
let win;
function create() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 960, minHeight: 600, backgroundColor: '#0f0a08', show: false,
    title: "Sword's Pass", icon: path.join(__dirname, 'build', 'icon.png'), autoHideMenuBar: true,
    webPreferences: {contextIsolation: true, sandbox: true, backgroundThrottling: false},
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  // links to other sites open in the normal browser
  win.webContents.setWindowOpenHandler(({url}) => { if (!url.startsWith(SITE)) shell.openExternal(url); return {action: 'deny'}; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(SITE) && !url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => { if (isMain && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'), {query: {site: SITE}}); });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') { win.webContents.reloadIgnoringCache(); e.preventDefault(); }
  });
  win.loadURL(SITE);
}
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
