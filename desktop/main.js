// Blackjack Play — application de bureau (Electron). Sert le site embarqué via le protocole app://
const { app, BrowserWindow, protocol, net, shell, Menu, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

const SITE = app.isPackaged ? path.join(process.resourcesPath, 'site') : path.join(__dirname, '..', 'site');
const STATE_FILE = () => path.join(app.getPath('userData'), 'fenetre.json');

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8')); } catch { return null; }
}
function saveState(win) {
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(STATE_FILE(), JSON.stringify({ ...b, maximized: win.isMaximized(), fullscreen: win.isFullScreen() }));
  } catch { /* ignoré */ }
}

if (!app.requestSingleInstanceLock()) app.quit();

let win;
function createWindow() {
  const st = loadState();
  const area = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: st?.width || Math.min(1600, area.width),
    height: st?.height || Math.min(940, area.height),
    x: st?.x, y: st?.y,
    minWidth: 960, minHeight: 600,
    backgroundColor: '#0b0907',
    title: 'Blackjack Play',
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  if (st?.maximized) win.maximize();
  if (st?.fullscreen) win.setFullScreen(true);
  win.once('ready-to-show', () => win.show());
  win.loadURL('app://sabot/game/index.html');
  win.on('close', () => saveState(win));
  // Liens externes (site, crédits) : navigateur par défaut
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('app://')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('app://sabot/game')) return;
    if (url.startsWith('app://')) {
      // Les pages du site (accueil, guide…) s'ouvrent dans le navigateur si on est en ligne, sinon dans l'appli
      return;
    }
    e.preventDefault();
    shell.openExternal(url);
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.type === 'keyDown' && input.key === 'F12' && !app.isPackaged) win.webContents.toggleDevTools();
  });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(SITE, p));
    if (!file.startsWith(SITE)) return new Response('Interdit', { status: 403 });
    if (!fs.existsSync(file)) {
      const html = path.join(SITE, p + '.html');
      if (fs.existsSync(html)) return net.fetch(pathToFileURL(html).toString());
      return new Response('Introuvable', { status: 404 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
