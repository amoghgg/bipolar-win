const { app, BrowserWindow, ipcMain, dialog, Menu, shell, Notification, nativeTheme, systemPreferences, session, powerMonitor, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const crypto = require('crypto');
const { spawn: spawnProc, execFile } = require('child_process');

const HOME = os.homedir();
const IS_WIN = process.platform === 'win32';
const CONFIG_DIR = process.env.SWITCHBOARD_CONFIG_DIR || path.join(HOME, '.config', 'switchboard');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const STATE_DIR = path.join(CONFIG_DIR, 'state'); // Claude hook events land here, one file per pane
// Windows has no unix sockets in the usual sense: the daemon listens on a per-user named pipe.
const SOCK = IS_WIN
  ? `\\\\.\\pipe\\bipolar-ptyd-${(os.userInfo().username || 'user').replace(/[^\w.-]/g, '_')}${process.env.SWITCHBOARD_CONFIG_DIR ? '-' + crypto.createHash('sha1').update(CONFIG_DIR).digest('hex').slice(0, 8) : ''}`
  : path.join(CONFIG_DIR, 'ptyd.sock');
const HOOK_BIN = path.join(HOME, '.config', 'switchboard', 'bin', IS_WIN ? 'sb-hook.ps1' : 'sb-hook');
const DAEMON_VERSION = 4;

const expand = (p) => (p && p.startsWith('~') ? path.join(HOME, p.slice(1)) : p);
// Paths are shown and stored with forward slashes everywhere; Node on Windows accepts them.
const slash = (p) => (IS_WIN && p ? p.replace(/\\/g, '/') : p);
const tildify = (p) => {
  if (!p) return p;
  const s = slash(p), h = slash(HOME);
  return (IS_WIN ? s.toLowerCase().startsWith(h.toLowerCase()) : s.startsWith(h)) ? '~' + s.slice(h.length) : s;
};

// ---------------------------------------------------------------- config
const DEFAULT_PROJECTS = {
  office: [
    ['seqrview', '~/Projects/seqrview'],
    ['seqrview-admin', '~/Projects/seqrview-admin'],
    ['seqr-admin-new', '~/Projects/seqr-admin-new'],
    ['seqrguard', '~/Projects/seqrguard'],
    ['GuardView', '~/Projects/GuardView'],
    ['guardview-qc', '~/Projects/guardview-qc'],
    ['shufflelab', '~/Projects/shufflelab'],
    ['innovatiview-ops-tools', '~/Projects/innovatiview-ops-tools'],
    ['mobile-android', '~/Projects/mobile-android'],
    ['dispatch-comms', '~/Documents/dispatch-comms'],
    ['otr-service-dev', '~/Desktop/otr-service-dev'],
  ],
  personal: [
    ['TouchDesigner', '~/Documents/td-projects'],
    ['touchdesigner-mcp', '~/Documents/touchdesigner-mcp'],
    ['portfolio', '~/Documents/portfolio'],
    ['pixel', '~/Desktop/Work&Misc/lores'],
    ['lights', '~/Desktop/lights-draft'],
    ['face-morph', '~/Documents/face-morph-attack-detection'],
    ['consensus', '~/Projects/consensus'],
    ['kev', '~/Projects/kev'],
    ['liveportrait', '~/Projects/liveportrait'],
    ['quantum2', '~/Projects/quantum2'],
    ['vantage', '~/Projects/vantage'],
    ['switchboard', '~/Projects/switchboard'],
  ],
};

function loadConfig() {
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch {}
  if (!cfg) {
    cfg = { sections: {}, ui: {}, session: { active: 'office', tabs: [] } };
    for (const [key, list] of Object.entries(DEFAULT_PROJECTS)) {
      cfg.sections[key] = {
        label: key === 'office' ? 'Office' : 'Personal',
        projects: list.filter(([, p]) => fs.existsSync(expand(p))).map(([name, p]) => ({ name, path: p })),
      };
    }
    saveConfig(cfg);
  }
  cfg.ui = { fontSize: 13, fontFamily: "'SF Mono', Menlo, monospace", optionIsMeta: true, notify: true, ...(IS_WIN ? { font: 'cascadia' } : {}), ...cfg.ui };
  return cfg;
}
function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const tmp = CONFIG_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, CONFIG_FILE);
}

// ---------------------------------------------------------------- claude hooks (opt-in)
// The app installs only the inert helper script. Registering it with Claude Code is
// the user's choice (see README); the app never edits ~/.claude/settings.json.
const HOOK_SCRIPT = `#!/bin/sh
# Switchboard: records Claude Code lifecycle events for the pane this session runs in.
# No-op outside Switchboard. Never blocks or alters Claude.
[ -n "$SWITCHBOARD_PANE" ] && [ -d "$SWITCHBOARD_STATE_DIR" ] || exit 0
f="$SWITCHBOARD_STATE_DIR/$SWITCHBOARD_PANE"
cat > "$f.tmp" 2>/dev/null && mv -f "$f.tmp" "$f.json" 2>/dev/null
exit 0
`;
// Windows: the same job in PowerShell (always installed). Run by Claude Code directly
// (exec form, async), so it works whether or not Git Bash is installed and never slows Claude.
const HOOK_PS1 = `# Bipolar: records Claude Code lifecycle events for the pane this session runs in.
# No-op outside Bipolar. Never blocks or alters Claude.
$ErrorActionPreference = 'SilentlyContinue'
$pane = $env:SWITCHBOARD_PANE; $dir = $env:SWITCHBOARD_STATE_DIR
if (-not $pane -or -not $dir -or -not (Test-Path -LiteralPath $dir)) { exit 0 }
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false
$data = [Console]::In.ReadToEnd()
$f = Join-Path $dir $pane
[IO.File]::WriteAllText("$f.$PID.tmp", $data, (New-Object System.Text.UTF8Encoding $false))
Move-Item -LiteralPath "$f.$PID.tmp" -Destination "$f.json" -Force
exit 0
`;
function installHookScript() {
  fs.mkdirSync(path.dirname(HOOK_BIN), { recursive: true });
  const body = IS_WIN ? HOOK_PS1 : HOOK_SCRIPT;
  if (!fs.existsSync(HOOK_BIN) || fs.readFileSync(HOOK_BIN, 'utf8') !== body) {
    fs.writeFileSync(HOOK_BIN, body, { mode: 0o755 });
  }
}
const CLAUDE_SETTINGS = path.join(HOME, '.claude', 'settings.json');
const HOOK_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Notification', 'Stop', 'SessionEnd'];
function hooksRegistered() {
  try { return fs.readFileSync(CLAUDE_SETTINGS, 'utf8').includes('sb-hook'); } catch { return false; }
}
// Only ever run from the "Turn on" button in Settings: the user asks for it explicitly.
// Adds Bipolar's hook next to whatever hooks already exist, after backing the file up.
function registerHooks() {
  let text = '';
  try { text = fs.readFileSync(CLAUDE_SETTINGS, 'utf8'); } catch {}
  let st = {};
  if (text.trim()) {
    try { st = JSON.parse(text); } catch { return { ok: false, error: 'Claude’s settings.json isn’t valid JSON, so Bipolar left it alone.' }; }
    if (!fs.existsSync(CLAUDE_SETTINGS + '.bipolar-backup')) fs.writeFileSync(CLAUDE_SETTINGS + '.bipolar-backup', text); // keep the original
  }
  const entry = IS_WIN
    ? { type: 'command', command: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', HOOK_BIN], async: true, timeout: 10 }
    : { type: 'command', command: '"$HOME/.config/switchboard/bin/sb-hook"', timeout: 5 };
  st.hooks = st.hooks || {};
  for (const ev of HOOK_EVENTS) {
    const list = Array.isArray(st.hooks[ev]) ? st.hooks[ev] : [];
    if (JSON.stringify(list).includes('sb-hook')) { st.hooks[ev] = list; continue; }
    list.push({ ...(ev === 'PostToolUse' ? { matcher: '*' } : {}), hooks: [entry] });
    st.hooks[ev] = list;
  }
  fs.mkdirSync(path.dirname(CLAUDE_SETTINGS), { recursive: true });
  fs.writeFileSync(CLAUDE_SETTINGS, JSON.stringify(st, null, 2));
  return { ok: true };
}

// ---------------------------------------------------------------- daemon client
let sock = null;
let rbuf = '';
let rid = 1;
const pending = new Map();

function daemonEnv() {
  // Clean environment for shells: drop anything that would make a nested Claude
  // think it is inside another Claude/IDE session, and pin a UTF-8 locale.
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (/^(CLAUDECODE|CLAUDE_CODE_|ELECTRON_|VSCODE_|ITERM_|TERM_SESSION_ID|__CF|NODE_OPTIONS)/.test(k)) continue;
    env[k] = v;
  }
  env.LANG = env.LANG || 'en_US.UTF-8';
  env.LC_CTYPE = env.LC_CTYPE || 'UTF-8';
  return env;
}

function connectOnce() {
  return new Promise((resolve, reject) => {
    const s = net.createConnection(SOCK);
    s.setEncoding('utf8');
    s.once('connect', () => resolve(s));
    s.once('error', reject);
  });
}

function startDaemon() {
  spawnProc(process.execPath, [path.join(__dirname, 'ptyd.js'), SOCK], {
    detached: true,
    stdio: 'ignore',
    cwd: HOME,
    windowsHide: true,
    env: { ...daemonEnv(), ELECTRON_RUN_AS_NODE: '1' },
  }).unref();
}

function rawSend(msg) { sock?.write(JSON.stringify(msg) + '\n'); }
function request(msg) {
  return new Promise((resolve) => {
    if (!sock) return resolve({ error: 'Session service is not connected.' });
    const id = rid++;
    pending.set(id, resolve);
    rawSend({ ...msg, rid: id });
  });
}

function onDaemonLine(line) {
  let m;
  try { m = JSON.parse(line); } catch { return; }
  if (m.t === 'hello') { pending.get('hello')?.(m); pending.delete('hello'); return; }
  if (m.rid && pending.has(m.rid)) { pending.get(m.rid)(m); pending.delete(m.rid); return; }
  if (!win || win.isDestroyed()) return;
  if (m.t === 'data') win.webContents.send('pty:data', m.id, m.d);
  else if (m.t === 'exit') win.webContents.send('pty:exit', m.id, m.code);
  else if (m.t === 'procs') win.webContents.send('pty:procs', m.procs);
}

function hello(s = sock) {
  return new Promise((resolve) => {
    pending.set('hello', resolve);
    s.write(JSON.stringify({ t: 'hello' }) + '\n');
  });
}

async function connectDaemon() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  let s;
  try { s = await connectOnce(); } catch {
    startDaemon();
    for (let i = 0; i < 60 && !s; i++) {
      await new Promise((r) => setTimeout(r, 100));
      try { s = await connectOnce(); } catch {}
    }
  }
  if (!s) throw new Error('Could not start the session service.');
  sock = s;
  rbuf = '';
  s.on('data', (chunk) => {
    rbuf += chunk;
    let i;
    while ((i = rbuf.indexOf('\n')) >= 0) {
      const line = rbuf.slice(0, i);
      rbuf = rbuf.slice(i + 1);
      if (line) onDaemonLine(line);
    }
  });
  s.on('close', () => {
    if (sock === s) sock = null;
    if (!app.isQuitting) setTimeout(() => connectDaemon().then(() => win?.webContents.send('daemon:reconnected')).catch(() => {}), 500);
  });
  const h = await hello(s);
  // A daemon from an older build with nothing running gets replaced; one with live
  // sessions is kept so nothing is ever killed by an update.
  if (h.version !== DAEMON_VERSION && h.panes.length === 0) {
    s.removeAllListeners('close');
    s.write(JSON.stringify({ t: 'shutdown' }) + '\n');
    await new Promise((r) => setTimeout(r, 600));
    s.destroy();
    sock = null;
    if (!IS_WIN) try { fs.unlinkSync(SOCK); } catch {}
    return connectDaemon();
  }
  return h;
}

// ---------------------------------------------------------------- window
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 820,
    minHeight: 520,
    title: 'Bipolar',
    ...(IS_WIN
      // Frameless look with Windows' own minimise/maximise/close drawn top-right.
      ? { titleBarStyle: 'hidden', titleBarOverlay: { color: '#00000000', symbolColor: '#cfc8e8', height: 44 }, icon: path.join(__dirname, 'build', 'icon.png') }
      : { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 19 } }),
    backgroundColor: '#07070a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  if (IS_WIN) win.setMenuBarVisibility(false); // shortcuts still work; Alt stays free for the terminal
  if (process.env.SWITCHBOARD_UA) win.webContents.setUserAgent(process.env.SWITCHBOARD_UA); // dev aid: preview the Windows UI
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // Automated test runs render off-screen and never take focus.
  // (SWITCHBOARD_ONSCREEN: unattended CI machines, where Windows won't paint an off-screen window.)
  if (process.env.SWITCHBOARD_SNAPSHOT) { if (!process.env.SWITCHBOARD_ONSCREEN) win.setPosition(-6000, 0); win.once('ready-to-show', () => win.showInactive()); }
  else win.once('ready-to-show', () => win.show());
  win.on('focus', () => { win.webContents.send('window:focus', true); if (IS_WIN) win.flashFrame(false); });
  win.on('blur', () => win.webContents.send('window:focus', false));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  // Dev aid: SWITCHBOARD_SNAPSHOT=/path/prefix runs SWITCHBOARD_STEPS (JS snippets), screenshots each, then quits.
  const snap = process.env.SWITCHBOARD_SNAPSHOT;
  if (snap) {
    win.webContents.on('console-message', (e) => console.log('[renderer]', e.level, e.message, e.lineNumber ?? ''));
    win.webContents.once('did-finish-load', async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      await wait(2000);
      const steps = JSON.parse(process.env.SWITCHBOARD_STEPS || '[]');
      for (let i = 0; i < steps.length; i++) {
        const [js, ms] = Array.isArray(steps[i]) ? steps[i] : [steps[i], 1500];
        // Results also go to <prefix>-log.txt: a packaged Windows app has no console to print to.
        const log = (line) => { console.log(line); try { fs.appendFileSync(`${snap}-log.txt`, line + '\n'); } catch {} };
        try { const r = await win.webContents.executeJavaScript(js); if (r !== undefined) log(`step ${i}: ${JSON.stringify(r)}`); } catch (e) { log(`step ${i} ERROR ${e.message}`); }
        await wait(ms);
        fs.writeFileSync(`${snap}-${i}.png`, (await win.webContents.capturePage()).toPNG());
      }
      app.isQuitting = true;
      app.quit();
    });
  }
}

// On Windows plain Ctrl+letter belongs to the terminal (Ctrl+C, Ctrl+D, Ctrl+R, …), so app
// shortcuts move to Ctrl+Shift like Windows Terminal. null = no shortcut on Windows.
const WIN_KEYS = {
  'Lock Bipolar': null, 'Quit (Sessions Keep Running)': null, 'Quit and End All Sessions…': null,
  'New Task…': 'Ctrl+Shift+N', 'New Shell Here': 'Ctrl+Shift+T', 'New Claude Here': 'Ctrl+Shift+A',
  'Archive Task': 'Ctrl+Shift+E', 'Show Changes': 'Ctrl+Shift+G',
  'Split Right': 'Alt+Shift+=', 'Split Down': 'Alt+Shift+-',
  'Close Pane': 'Ctrl+Shift+W', 'Close Tab': null, 'Clear Screen': 'Ctrl+Shift+K',
  'Select All': null, 'Find…': 'Ctrl+Shift+F',
  'Jump to Anything…': 'Ctrl+Shift+P', 'Next Task Waiting on You': 'Ctrl+Shift+J',
  'Toggle Sidebar': 'Ctrl+Shift+B', 'Add Files…': 'Ctrl+Shift+O',
};
function forWindows(items) {
  return items.filter((it) => !['hide', 'hideOthers', 'unhide', 'about'].includes(it.role) && !(IS_WIN && it.label === 'Lock Bipolar')).map((it) => {
    const o = { ...it };
    if (o.submenu) o.submenu = forWindows(o.submenu);
    if (o.label in WIN_KEYS) { if (WIN_KEYS[o.label]) o.accelerator = WIN_KEYS[o.label]; else delete o.accelerator; }
    if (o.role === 'copy') o.accelerator = 'Ctrl+Shift+C';
    if (o.role === 'paste') o.accelerator = 'Ctrl+Shift+V';
    if (o.role === 'cut' || o.role === 'undo' || o.role === 'redo') o.registerAccelerator = false;
    return o;
  }).filter((it, i, a) => !(it.type === 'separator' && (i === 0 || a[i - 1].type === 'separator')));
}

function buildMenu() {
  const send = (action, arg) => () => win && win.webContents.send('menu', action, arg);
  const tpl = [
    {
      label: 'Bipolar',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: send('settings') },
        { label: 'Lock Bipolar', accelerator: 'CmdOrCtrl+L', click: send('lock') },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit (Sessions Keep Running)', accelerator: 'CmdOrCtrl+Q', click: () => { app.isQuitting = true; app.quit(); } },
        { label: 'Quit and End All Sessions…', accelerator: 'CmdOrCtrl+Alt+Q', click: send('quit-all') },
      ],
    },
    {
      label: 'Shell',
      submenu: [
        { label: 'New Task…', accelerator: 'CmdOrCtrl+N', click: send('compose') },
        { label: 'New Shell Here', accelerator: 'CmdOrCtrl+T', click: send('new-tab') },
        { label: 'Add Files…', accelerator: 'CmdOrCtrl+O', click: send('add-files') },
        { label: 'New Claude Here', accelerator: 'CmdOrCtrl+Shift+T', click: send('new-claude') },
        { type: 'separator' },
        { label: 'Archive Task', accelerator: 'CmdOrCtrl+E', click: send('archive') },
        { label: 'Show Changes', accelerator: 'CmdOrCtrl+Shift+C', click: send('changes') },
        { type: 'separator' },
        { label: 'Split Right', accelerator: 'CmdOrCtrl+D', click: send('split', 'row') },
        { label: 'Split Down', accelerator: 'CmdOrCtrl+Shift+D', click: send('split', 'col') },
        { type: 'separator' },
        { label: 'Close Pane', accelerator: 'CmdOrCtrl+W', click: send('close-pane') },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+Shift+W', click: send('close-tab') },
        { type: 'separator' },
        { label: 'Clear Screen', accelerator: 'CmdOrCtrl+K', click: send('clear') },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: send('select-all') },
        { type: 'separator' },
        { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: send('find') },
      ],
    },
    {
      label: 'Go',
      submenu: [
        { label: 'Jump to Anything…', accelerator: 'CmdOrCtrl+P', click: send('palette') },
        { label: 'Next Task Waiting on You', accelerator: 'CmdOrCtrl+J', click: send('next-attention') },
        { label: 'Latest Update', accelerator: 'CmdOrCtrl+Shift+U', click: send('latest-unread') },
        { type: 'separator' },
        { label: 'Office', accelerator: 'CmdOrCtrl+1', click: send('section', 'office') },
        { label: 'Personal', accelerator: 'CmdOrCtrl+2', click: send('section', 'personal') },
        { type: 'separator' },
        { label: 'Next Tab', accelerator: 'Ctrl+Tab', click: send('cycle-tab', 1) },
        { label: 'Previous Tab', accelerator: 'Ctrl+Shift+Tab', click: send('cycle-tab', -1) },
        { label: 'Next Tab', accelerator: 'CmdOrCtrl+Shift+]', click: send('cycle-tab', 1), visible: false },
        { label: 'Previous Tab', accelerator: 'CmdOrCtrl+Shift+[', click: send('cycle-tab', -1), visible: false },
        { type: 'separator' },
        { label: 'Focus Pane Left', accelerator: 'CmdOrCtrl+Alt+Left', click: send('focus-dir', 'left') },
        { label: 'Focus Pane Right', accelerator: 'CmdOrCtrl+Alt+Right', click: send('focus-dir', 'right') },
        { label: 'Focus Pane Up', accelerator: 'CmdOrCtrl+Alt+Up', click: send('focus-dir', 'up') },
        { label: 'Focus Pane Down', accelerator: 'CmdOrCtrl+Alt+Down', click: send('focus-dir', 'down') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', click: send('toggle-sidebar') },
        { type: 'separator' },
        { label: 'Bigger Text', accelerator: 'CmdOrCtrl+=', click: send('font', 1) },
        { label: 'Smaller Text', accelerator: 'CmdOrCtrl+-', click: send('font', -1) },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: send('font', 0) },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(IS_WIN ? forWindows(tpl) : tpl));
}

// ---------------------------------------------------------------- hook state watcher
const hookSeen = new Map();
function readHookFile(file) {
  const paneId = path.basename(file, '.json');
  try {
    const st = fs.statSync(file);
    if (hookSeen.get(paneId) === st.mtimeMs) return;
    hookSeen.set(paneId, st.mtimeMs);
    const ev = JSON.parse(fs.readFileSync(file, 'utf8'));
    win?.webContents.send('claude:event', paneId, {
      event: ev.hook_event_name, session: ev.session_id, cwd: ev.cwd,
      message: ev.message, source: ev.source, at: st.mtimeMs,
    });
  } catch {}
}
function watchHooks() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.watch(STATE_DIR, (_t, name) => { if (name && name.endsWith('.json')) readHookFile(path.join(STATE_DIR, name)); });
}

// ---------------------------------------------------------------- IPC
ipcMain.handle('config:get', () => loadConfig());
ipcMain.on('config:save', (_e, cfg) => saveConfig(cfg));
// Light Claude theme for pastel tasks, as a settings file (PowerShell mangles inline JSON).
const LIGHT_SETTINGS = path.join(CONFIG_DIR, 'claude-light.json');
// First name of the Mac's account ("Nitya Sharma" → "Nitya"), offered when Bipolar first asks for a name.
function accountName() {
  let n = '';
  if (!IS_WIN) try { n = require('child_process').execFileSync('id', ['-F'], { encoding: 'utf8', timeout: 2000 }).trim(); } catch {}
  n = (n || os.userInfo().username || '').split(/[\s._-]+/)[0];
  return n.charAt(0).toUpperCase() + n.slice(1);
}
ipcMain.handle('env', () => {
  if (IS_WIN) try { if (!fs.existsSync(LIGHT_SETTINGS)) fs.writeFileSync(LIGHT_SETTINGS, '{"theme":"light"}'); } catch {}
  return { home: HOME, version: app.getVersion(), hooks: hooksRegistered(), platform: process.platform, lightSettings: slash(LIGHT_SETTINGS), lock: !IS_WIN, accountName: accountName() };
});
ipcMain.handle('hooks:register', () => { try { return registerHooks(); } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('daemon:hello', async () => { if (!sock) await connectDaemon(); return hello(); });
ipcMain.handle('uuid', () => crypto.randomUUID());

ipcMain.handle('pty:spawn', (_e, { id, cwd, cols, rows, section, command }) => {
  let dir = expand(cwd);
  if (!dir || !fs.existsSync(dir)) dir = HOME;
  const env = {
    ...daemonEnv(),
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    TERM_PROGRAM: 'Bipolar',
    TERM_PROGRAM_VERSION: app.getVersion(),
    SWITCHBOARD_PANE: id,
    SWITCHBOARD_SECTION: section,
    SWITCHBOARD_STATE_DIR: STATE_DIR,
  };
  return request({ t: 'spawn', id, cwd: dir, cols, rows, env, command, ...(IS_WIN ? winShell() : { shell: process.env.SHELL || '/bin/zsh', args: ['-l'] }) });
});
// Windows: PowerShell 7 when installed, else the built-in Windows PowerShell. The prompt is
// wrapped to report its folder (OSC 9;9, as Windows Terminal does) so splits open in the same place.
let pwshPath;
function findOnPath(exe) {
  for (const d of (process.env.PATH || process.env.Path || '').split(';')) {
    if (d && fs.existsSync(path.join(d, exe))) return path.join(d, exe);
  }
  const pf = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PowerShell', '7', exe);
  return fs.existsSync(pf) ? pf : null;
}
const PS_INIT = [
  '$PSNativeCommandArgumentPassing = \'Legacy\'',
  '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
  '$global:__bipolarPrompt = $function:prompt',
  'function global:prompt { $e = [char]27; $p = $executionContext.SessionState.Path.CurrentLocation.ProviderPath; "$e]9;9;`"$p`"$([char]7)" + (& $global:__bipolarPrompt) }',
].join('; ');
function winShell() {
  const ui = loadConfig().ui;
  if (pwshPath === undefined) pwshPath = findOnPath('pwsh.exe');
  const shell = ui.shell || pwshPath || 'powershell.exe';
  return { shell, args: /pwsh|powershell/i.test(shell) ? ['-NoLogo', '-NoExit', '-EncodedCommand', Buffer.from(PS_INIT, 'utf16le').toString('base64')] : [] };
}
ipcMain.handle('pty:snapshot', (_e, id) => request({ t: 'snapshot', id }));
ipcMain.handle('pty:cwd', async (_e, id) => tildify((await request({ t: 'cwd', id })).cwd));
ipcMain.on('pty:procs-now', () => rawSend({ t: 'procs-now' }));
ipcMain.on('pty:write', (_e, id, d) => rawSend({ t: 'write', id, d }));
ipcMain.on('pty:mirror', (_e, id, d) => rawSend({ t: 'mirror', id, d }));
ipcMain.on('pty:resize', (_e, id, cols, rows) => rawSend({ t: 'resize', id, cols, rows }));
ipcMain.on('pty:kill', (_e, id) => {
  rawSend({ t: 'kill', id });
  try { fs.unlinkSync(path.join(STATE_DIR, id + '.json')); } catch {}
});
ipcMain.handle('claude:states', () => {
  try {
    for (const f of fs.readdirSync(STATE_DIR)) {
      if (!f.endsWith('.json')) continue;
      hookSeen.delete(path.basename(f, '.json'));
      readHookFile(path.join(STATE_DIR, f));
    }
  } catch {}
});
// Import: drop ~/.config/switchboard/import.json ([{session, section, title, cwd, pid}]) and
// the app turns each entry into a tab that continues that Claude conversation.
const IMPORT_FILE = path.join(CONFIG_DIR, 'import.json');
ipcMain.handle('import:take', () => {
  try {
    const items = JSON.parse(fs.readFileSync(IMPORT_FILE, 'utf8'));
    fs.unlinkSync(IMPORT_FILE);
    return Array.isArray(items) ? items : [];
  } catch { return []; }
});
ipcMain.handle('pid-alive', (_e, pids) => pids.map((pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }));
function watchImports() {
  fs.watch(CONFIG_DIR, (_t, name) => { if (name === 'import.json' && fs.existsSync(IMPORT_FILE)) win?.webContents.send('import:ready'); });
}

ipcMain.handle('quit-all', () => {
  rawSend({ t: 'shutdown' });
  app.isQuitting = true;
  setTimeout(() => app.quit(), 400);
});

ipcMain.handle('git', async (_e, paths) => {
  const out = {};
  await Promise.all(paths.map((p) => new Promise((resolve) => {
    execFile('git', ['-C', expand(p), 'status', '--porcelain=v2', '--branch', '-uno'], { timeout: 4000 }, (err, stdout) => {
      if (err) { out[p] = null; return resolve(); }
      const lines = stdout.split('\n');
      const head = lines.find((l) => l.startsWith('# branch.head '));
      const ab = lines.find((l) => l.startsWith('# branch.ab '));
      const m = ab && ab.match(/\+(\d+) -(\d+)/);
      out[p] = {
        branch: head ? head.slice(14) : null,
        dirty: lines.filter((l) => /^[12u] /.test(l)).length,
        ahead: m ? +m[1] : 0,
        behind: m ? +m[2] : 0,
      };
      resolve();
    });
  })));
  return out;
});

// What changed in a project's working tree (staged + unstaged + untracked), Conductor-style.
const run = (args, cwd) => new Promise((res) => execFile('git', args, { cwd, timeout: 6000, maxBuffer: 8 * 1024 * 1024 }, (e, out) => res(e ? null : out)));
ipcMain.handle('git:changes', async (_e, paths) => {
  const out = {};
  await Promise.all(paths.map(async (p) => {
    const dir = expand(p);
    const num = await run(['diff', '--numstat', 'HEAD'], dir);
    if (num == null) { out[p] = null; return; }
    const untracked = ((await run(['ls-files', '--others', '--exclude-standard'], dir)) || '').split('\n').filter(Boolean);
    let add = 0, del = 0;
    const files = num.split('\n').filter(Boolean).map((l) => {
      const [a, d, f] = l.split('\t');
      add += +a || 0; del += +d || 0;
      return { file: f, add: +a || 0, del: +d || 0 };
    });
    for (const f of untracked) files.push({ file: f, add: 0, del: 0, untracked: true });
    out[p] = { files: files.length, add, del, list: files.slice(0, 200) };
  }));
  return out;
});
ipcMain.handle('git:diff', async (_e, p) => {
  const dir = expand(p);
  const patch = (await run(['diff', 'HEAD', '--no-color', '--no-ext-diff'], dir)) || '';
  return { patch: patch.length > 600000 ? patch.slice(0, 600000) + '\n… (diff truncated)' : patch };
});

// Image on the clipboard (screenshot, copied picture): save it so a shell can be given its path.
ipcMain.handle('clipboard:image', () => {
  const img = clipboard.readImage();
  if (img.isEmpty()) return null;
  const dir = path.join(CONFIG_DIR, 'pastes');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `paste-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
  fs.writeFileSync(file, img.toPNG());
  return file;
});
ipcMain.handle('clipboard:hasImage', () => !clipboard.readImage().isEmpty());

// Add files: pick in a file dialog instead of dragging from Finder. Opens where you last
// picked from (the Desktop the first time); the renderer pastes the paths like a drop.
let lastFileDir = null;
ipcMain.handle('dialog:files', async () => {
  // Test runs answer the dialog themselves (a native dialog can't be driven off-screen).
  if (process.env.SWITCHBOARD_SNAPSHOT && process.env.SWITCHBOARD_PICK) return process.env.SWITCHBOARD_PICK.split('|');
  const r = await dialog.showOpenDialog(win, {
    title: 'Add files',
    buttonLabel: 'Add',
    defaultPath: lastFileDir || path.join(HOME, 'Desktop'),
    // Windows can't offer files and folders in one dialog; files matter more there.
    properties: IS_WIN ? ['openFile', 'multiSelections'] : ['openFile', 'openDirectory', 'multiSelections'],
  });
  if (r.canceled || !r.filePaths.length) return [];
  lastFileDir = path.dirname(r.filePaths[0]);
  return r.filePaths;
});
ipcMain.handle('dialog:folder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], defaultPath: HOME });
  return r.canceled || !r.filePaths[0] ? null : tildify(r.filePaths[0]);
});
// New project: create the folder (and optionally a git repo) so the user only types a name.
ipcMain.handle('project:create', async (_e, { parent, name, git }) => {
  const clean = String(name || '').trim();
  if (!clean) return { ok: false, error: 'Give it a name.' };
  if (IS_WIN ? /[<>:"\/\\|?*]/.test(clean) || /[. ]$/.test(clean) : /[\/:]/.test(clean)) return { ok: false, error: IS_WIN ? 'Names can’t contain < > : " / \\ | ? *' : 'Names can’t contain / or : or start with a dot.' };
  if (clean.startsWith('.')) return { ok: false, error: 'Names can’t start with a dot.' };
  const base = expand(parent || '~/Projects');
  const dir = path.join(base, clean);
  try {
    fs.mkdirSync(base, { recursive: true });
    if (fs.existsSync(dir)) return { ok: false, exists: true, path: tildify(dir), error: 'A folder with that name already exists there.' };
    fs.mkdirSync(dir);
    if (git) await new Promise((r) => execFile('git', ['init', '-q'], { cwd: dir }, () => r()));
    return { ok: true, path: tildify(dir) };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('dialog:parent', async (_e, current) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], defaultPath: expand(current || '~/Projects'), buttonLabel: 'Create projects here' });
  return r.canceled || !r.filePaths[0] ? null : tildify(r.filePaths[0]);
});
ipcMain.handle('menu:popup', (_e, items) => new Promise((resolve) => {
  let done = false;
  const finish = (v) => { if (!done) { done = true; resolve(v); } };
  const tpl = items.map((it) => (it === '-' ? { type: 'separator' } : {
    label: it.label, enabled: it.enabled !== false, click: () => finish(it.id),
  }));
  Menu.buildFromTemplate(tpl).popup({ window: win, callback: () => setTimeout(() => finish(null), 50) });
}));
ipcMain.on('reveal', (_e, p) => shell.openPath(expand(p)));
ipcMain.on('open-editor', (_e, p) => (IS_WIN
  ? spawnProc('cmd.exe', ['/d', '/c', 'code', expand(p)], { windowsHide: true, detached: true, stdio: 'ignore' }).on('error', () => {}).unref()
  : execFile('open', ['-a', 'Visual Studio Code', expand(p)])));
ipcMain.on('open-external', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });
ipcMain.on('badge', (_e, n) => app.dock?.setBadge(n > 0 ? String(n) : ''));
ipcMain.on('notify', (_e, { title, body, paneId }) => {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body });
  n.on('click', () => { win?.show(); win?.focus(); win?.webContents.send('focus-pane', paneId); });
  n.show();
  if (!win?.isFocused()) { app.dock?.bounce('informational'); if (IS_WIN) win?.flashFrame(true); }
});

// ---------------------------------------------------------------- face lock (portal)
// Uses the owner's own face-biometrics API (InsightFace buffalo_l), run locally on a
// private port only while the portal is locked. Frames never leave this machine.
const FACE_FILE = path.join(CONFIG_DIR, 'face.json'); // kept apart from config.json (renderer rewrites that)
const FACE_PORT = 8770;
const FACE_URL = `http://127.0.0.1:${FACE_PORT}`;
let faceProc = null;
const faceCfg = () => {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(FACE_FILE, 'utf8')); } catch {}
  return {
    apiDir: path.join(HOME, 'liveness-detection', 'backend'),
    python: path.join(HOME, 'miniforge3', 'bin', 'python3'),
    ...c,
    threshold: 0.5,
  };
};
const saveFace = (patch) => fs.writeFileSync(FACE_FILE, JSON.stringify({ ...faceCfg(), ...patch }, null, 2));

async function facePing() {
  try { const r = await fetch(`${FACE_URL}/face/list`, { signal: AbortSignal.timeout(1500) }); return r.ok; } catch { return false; }
}
async function faceUp() {
  if (await facePing()) return { ok: true };
  const c = faceCfg();
  if (!fs.existsSync(c.apiDir)) return { ok: false, error: `Face API not found at ${c.apiDir}` };
  if (!faceProc) {
    const log = fs.openSync(path.join(CONFIG_DIR, 'face-api.log'), 'a');
    // Detached: it outlives the window (like the session daemon) so reopening unlocks instantly.
    faceProc = spawnProc(c.python, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(FACE_PORT)], {
      cwd: c.apiDir, stdio: ['ignore', log, log], env: { ...daemonEnv(), FACE_FAST: '1' }, detached: true,
    });
    faceProc.unref();
    faceProc.on('exit', () => { faceProc = null; });
  }
  for (let i = 0; i < 120; i++) {           // buffalo_l takes a few seconds to load
    if (await facePing()) return { ok: true };
    if (!faceProc) return { ok: false, error: 'Face API exited; see ~/.config/switchboard/face-api.log' };
    await new Promise((r) => setTimeout(r, 500));
  }
  return { ok: false, error: 'Face API did not start in time.' };
}
function faceDown() { if (faceProc) { faceProc.kill(); faceProc = null; } }

async function facePost(route, body) {
  const r = await fetch(`${FACE_URL}${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, body: j };
}

// Several reference templates (learned from real unlocks) and one 1:N search per frame.
const faceIds = (c = faceCfg()) => [...new Set([...(c.faceIds || []), ...(c.faceId ? [c.faceId] : [])])];
const MAX_TEMPLATES = 6;
const faceLog = (line) => { try { fs.appendFileSync(path.join(CONFIG_DIR, 'face-unlock.log'), `${new Date().toISOString()} ${line}\n`); } catch {} };

ipcMain.handle('face:state', () => { const c = faceCfg(); return { enrolled: faceIds(c).length > 0, threshold: c.threshold }; });
ipcMain.handle('face:up', () => (process.env.SWITCHBOARD_SNAPSHOT ? { ok: true } : faceUp()));
ipcMain.handle('face:down', () => {}); // kept warm while the app runs so unlocking takes ~1s; stopped on quit
async function register(image) {
  const r = await facePost('/face/register', { name: 'switchboard-owner', image, metadata: { app: 'bipolar' } });
  if (r.status !== 200) return { ok: false, error: r.body.detail || `HTTP ${r.status}` };
  const c = faceCfg();
  saveFace({ faceIds: [...faceIds(c), r.body.face_id].slice(-MAX_TEMPLATES), faceId: null, enrolledAt: c.enrolledAt || new Date().toISOString() });
  return { ok: true };
}
ipcMain.handle('face:enroll', async (_e, image) => { try { return await register(image); } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('face:learn', async (_e, image) => {
  // After a successful but not-so-confident unlock, keep that frame as another reference.
  if (faceIds().length >= MAX_TEMPLATES) return { ok: false, error: 'enough templates' };
  try { const r = await register(image); faceLog(`learned a new reference (${faceIds().length} total)`); return r; } catch (e) { return { ok: false, error: e.message }; }
});
// Keep the model hot: macOS pages out idle processes, which made the first frame take seconds.
const WARM_FILE = path.join(CONFIG_DIR, 'warm.jpg');
async function faceWarm() {
  if (process.env.SWITCHBOARD_SNAPSHOT || !fs.existsSync(WARM_FILE)) return;
  try { await facePost('/face/search', { image: fs.readFileSync(WARM_FILE).toString('base64'), top_k: 1 }); } catch {}
}
setInterval(faceWarm, 60 * 1000);
ipcMain.handle('face:warm', () => faceWarm());
ipcMain.handle('face:remember', (_e, image) => { try { fs.writeFileSync(WARM_FILE, Buffer.from(image, 'base64'), { mode: 0o600 }); } catch {} });

ipcMain.handle('face:verify', async (_e, image) => {
  const c = faceCfg();
  const ids = new Set(faceIds(c));
  if (!ids.size) return { ok: false, error: 'not enrolled' };
  const t0 = Date.now();
  try {
    const r = await facePost('/face/search', { image, top_k: 25 });
    if (r.status !== 200) return { ok: false, error: r.body.detail || `HTTP ${r.status}` };
    if (!r.body.face_detected) { faceLog(`no face (${Date.now() - t0}ms)`); return { ok: true, face: false, similarity: 0 }; }
    const mine = (r.body.matches || []).filter((m) => ids.has(m.face_id));
    if (!mine.length && (r.body.matches || []).length < 25) {
      // none of our templates came back at all: they were removed from the API's gallery
      const listed = await fetch(`${FACE_URL}/face/list`).then((x) => x.json()).catch(() => null);
      if (Array.isArray(listed) && !listed.some((f) => ids.has(f.face_id))) { saveFace({ faceIds: [], faceId: null }); return { ok: false, error: 'enrolment lost' }; }
    }
    const similarity = mine.length ? Math.max(...mine.map((m) => m.similarity)) : 0;
    const match = similarity >= c.threshold;
    faceLog(`sim ${similarity.toFixed(3)} ${match ? 'MATCH' : 'no'} (${Date.now() - t0}ms, ${ids.size} refs)`);
    return { ok: true, face: true, similarity, match };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('face:reset', () => { saveFace({ faceId: null, faceIds: [] }); return true; });
ipcMain.handle('touchid', async () => {
  try {
    if (!systemPreferences.canPromptTouchID()) return { ok: false, error: 'Touch ID is not available' };
    await systemPreferences.promptTouchID('open Bipolar');
    return { ok: true };
  } catch (e) { return { ok: false, error: 'Touch ID was cancelled' }; }
});
ipcMain.handle('camera:access', async () => {
  if (process.env.SWITCHBOARD_SNAPSHOT) return false; // automated test runs never touch the camera
  try { return await systemPreferences.askForMediaAccess('camera'); } catch { return false; }
});

// ---------------------------------------------------------------- windows install
// The Windows build ships as a folder: on first run it puts Bipolar in the Start menu and on
// the desktop. The Start-menu shortcut carries the app id, which Windows needs to show toasts.
const APP_ID = 'com.amoghbajpai.bipolar';
function winShortcuts() {
  if (!app.isPackaged || process.env.SWITCHBOARD_SNAPSHOT) return;
  const icon = path.join(__dirname, 'build', 'icon.ico');
  const link = { target: process.execPath, cwd: path.dirname(process.execPath), appUserModelId: APP_ID, description: 'Bipolar', ...(fs.existsSync(icon) ? { icon, iconIndex: 0 } : {}) };
  const startMenu = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Bipolar.lnk');
  try { shell.writeShortcutLink(startMenu, fs.existsSync(startMenu) ? 'replace' : 'create', link); } catch {}
  const marker = path.join(CONFIG_DIR, '.desktop-shortcut');
  if (!fs.existsSync(marker)) {
    try { shell.writeShortcutLink(path.join(app.getPath('desktop'), 'Bipolar.lnk'), 'create', link); } catch {}
    try { fs.writeFileSync(marker, new Date().toISOString()); } catch {}
  }
}

// ---------------------------------------------------------------- lifecycle
app.setName('Bipolar');
if (IS_WIN) {
  app.setAppUserModelId(APP_ID);
  // One window: opening Bipolar again brings the running one forward.
  if (!process.env.SWITCHBOARD_SNAPSHOT && !app.requestSingleInstanceLock()) app.exit(0);
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
}
app.whenReady().then(async () => {
  nativeTheme.themeSource = 'dark';
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === 'media');
  // Re-lock when the Mac locks or sleeps (the Windows build has no lock).
  if (!IS_WIN) for (const ev of ['lock-screen', 'suspend']) powerMonitor.on(ev, () => win?.webContents.send('portal:lock'));
  // Back at the Mac: let the camera come back, then the portal scans.
  if (!IS_WIN) for (const ev of ['unlock-screen', 'resume']) powerMonitor.on(ev, () => setTimeout(() => win?.webContents.send('portal:wake'), 900));
  try { installHookScript(); } catch {}
  watchHooks();
  watchImports();
  buildMenu();
  if (IS_WIN) winShortcuts();
  else if (!process.env.SWITCHBOARD_SNAPSHOT) faceUp(); // warm the face model in the background
  try { await connectDaemon(); } catch (e) { dialog.showErrorBox('Bipolar', e.message); }
  createWindow();
});
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
app.on('before-quit', () => { app.isQuitting = true; });
app.on('window-all-closed', () => app.quit()); // shells live on in the daemon
