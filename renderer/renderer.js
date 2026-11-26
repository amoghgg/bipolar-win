/* global Terminal, FitAddon, WebLinksAddon, WebglAddon, Unicode11Addon, SearchAddon, ClipboardAddon */
'use strict';

// `sb` is the bridge exposed by preload.js (window.sb).
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const SECTIONS = ['office', 'personal'];
const LABEL = { office: 'Office', personal: 'Personal' };

const ICON = {
  spark: '<svg viewBox="0 0 20 20"><path d="M10 2.5 11.6 8.4 17.5 10l-5.9 1.6L10 17.5l-1.6-5.9L2.5 10l5.9-1.6z"/></svg>',
  prompt: '<svg viewBox="0 0 20 20"><path d="m4.5 6 4 4-4 4M10.5 14.5h5"/></svg>',
  x: '<svg viewBox="0 0 20 20"><path d="m5.5 5.5 9 9M14.5 5.5l-9 9"/></svg>',
  up: '<svg viewBox="0 0 20 20"><path d="m5 12.5 5-5 5 5"/></svg>',
  down: '<svg viewBox="0 0 20 20"><path d="m5 7.5 5 5 5-5"/></svg>',
  folder: '<svg viewBox="0 0 20 20"><path d="M2.5 6.2c0-1 .8-1.7 1.7-1.7h3.3l1.8 1.9h6.5c1 0 1.7.7 1.7 1.7v6.5c0 1-.8 1.7-1.7 1.7H4.2c-1 0-1.7-.8-1.7-1.7z"/></svg>',
  split: '<svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="2.5"/><path d="M10 4v12"/></svg>',
  splitd: '<svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="2.5"/><path d="M3 10h14"/></svg>',
  swap: '<svg viewBox="0 0 20 20"><path d="M4 7h11l-3-3M16 13H5l3 3"/></svg>',
  gear: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7"/></svg>',
  plus: '<svg viewBox="0 0 20 20"><path d="M10 4.5v11M4.5 10h11"/></svg>',
  side: '<svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="2.5"/><path d="M8 4v12"/></svg>',
  power: '<svg viewBox="0 0 20 20"><path d="M10 3v6M6 5.6a6 6 0 1 0 8 0"/></svg>',
};

// Avatar tints: cool family for Office, warm family for Personal.
const TINTS = {
  office: ['#0866ff', '#1b74e4', '#00a3c4', '#3b5bdb', '#0f8a7e', '#5b6bf5', '#1877f2', '#2a9d8f'],
  personal: ['#8f4bff', '#d6378c', '#f05a28', '#b23cd9', '#e0486b', '#7b5cff', '#f2994a', '#c2410c'],
};


// The light behind each section: three soft lights per pole, picked in Settings → Light.
const LIGHTS = [
  { id: 'glacier', name: 'Glacier', c: ['147,228,246', '198,182,255', '185,243,211'] },
  { id: 'lagoon', name: 'Lagoon', c: ['94,234,212', '103,200,255', '167,243,208'] },
  { id: 'ocean', name: 'Ocean', c: ['96,165,250', '125,211,252', '165,180,252'] },
  { id: 'aurora', name: 'Aurora', c: ['134,239,172', '94,234,212', '192,132,252'] },
  { id: 'mint', name: 'Mint', c: ['170,240,206', '147,228,246', '232,226,160'] },
  { id: 'moss', name: 'Moss', c: ['190,242,100', '110,231,183', '253,230,138'] },
  { id: 'citrus', name: 'Citrus', c: ['253,230,138', '190,242,100', '253,186,116'] },
  { id: 'dusk', name: 'Dusk', c: ['255,186,165', '246,168,217', '243,196,111'] },
  { id: 'ember', name: 'Ember', c: ['251,146,60', '248,113,113', '252,211,77'] },
  { id: 'rose', name: 'Rose gold', c: ['253,164,175', '254,215,170', '244,114,182'] },
  { id: 'sakura', name: 'Sakura', c: ['251,182,206', '216,180,254', '253,214,222'] },
  { id: 'violet', name: 'Violet', c: ['167,139,250', '232,121,249', '129,140,248'] },
  { id: 'moon', name: 'Moonlight', c: ['203,213,225', '186,198,255', '226,232,240'] },
];
const LIGHT_DEFAULT = { office: 'glacier', personal: 'dusk' };
const LIGHT_VAR = { office: 'o', personal: 'p' };
const lightOf = (section) => LIGHTS.find((l) => l.id === (cfg.ui.light || {})[section]) || LIGHTS.find((l) => l.id === LIGHT_DEFAULT[section]);
function applyLights() {
  let css = ':root {';
  for (const sec of Object.keys(LIGHT_VAR)) lightOf(sec).c.forEach((c, i) => { css += ` --${LIGHT_VAR[sec]}${i + 1}: ${c};`; });
  css += ' }';
  // the section's accent (underlines, focus rings) follows its light
  for (const sec of Object.keys(LIGHT_VAR)) { const [a, b] = lightOf(sec).c; css += ` body[data-section='${sec}'] { --a1: rgb(${a}); --a2: rgb(${b}); }`; }
  let el = document.getElementById('light-css');
  if (!el) { el = document.createElement('style'); el.id = 'light-css'; document.head.appendChild(el); }
  el.textContent = css;
}
function renderLights() {
  $('#set-light').innerHTML = Object.keys(LIGHT_VAR).map((sec) => `<div class="lt-row"><span>${LABEL[sec]}</span><div class="lt-sws">${LIGHTS.map((l) =>
    `<button class="lt-sw ${lightOf(sec).id === l.id ? 'on' : ''}" data-light="${l.id}" data-sec="${sec}" title="${esc(l.name)}" style="--l1:rgb(${l.c[0]});--l2:rgb(${l.c[1]});--l3:rgb(${l.c[2]})"></button>`).join('')}</div></div>`).join('');
}

// ------------------------------------------------------------------ state
let cfg;
let env;
let active = 'office';
let windowFocused = true;
const tabs = [];            // {id, section, name, path, root, focus}
const panes = new Map();    // id -> pane
const current = { office: null, personal: null }; // tab id per section
const git = {};             // path -> {branch, dirty, ahead, behind}

const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const IS_WIN = navigator.userAgent.includes('Windows');
const SHELL_RE = /^-?(zsh|bash|fish|sh|login|pwsh|powershell|cmd)$/i;
const isShellProc = (p) => !p || SHELL_RE.test(p);
const modKey = (e) => (IS_WIN ? e.ctrlKey : e.metaKey); // ⌘ on the Mac, Ctrl on Windows
// Shortcut labels are written Mac-style; on Windows show what the Windows menu actually binds.
const WIN_LABELS = { '⇧⌘C': 'Ctrl+Shift+G', '⇧⌘D': 'Alt+Shift+-', '⇧⌘W': 'Ctrl+Shift+W', '⇧⌘T': 'Ctrl+Shift+A', '⌥⌘Q': '',
  '⌘N': 'Ctrl+Shift+N', '⌘P': 'Ctrl+Shift+P', '⌘1': 'Ctrl+1', '⌘2': 'Ctrl+2', '⌘,': 'Ctrl+,', '⌘E': 'Ctrl+Shift+E',
  '⌘T': 'Ctrl+Shift+T', '⌘O': 'Ctrl+Shift+O', '⌘D': 'Alt+Shift+=', '⌘B': 'Ctrl+Shift+B', '⌘↵': 'Ctrl+Enter', '⌥↵': 'Alt+Enter', '⌘Q': 'closing the window', '⌘-click': 'Ctrl+click' };
const keyLabel = (s) => (IS_WIN ? String(s).replace(/⌘-click|[⇧⌥]*⌘[^\s)·]|⌥↵/g, (k) => WIN_LABELS[k] ?? k) : s);
const isClaudeProc = (p) => p === 'claude' || /^\d+\.\d+\.\d+/.test(p || '');
const tabOf = (paneId) => tabs.find((t) => leaves(t.root).includes(paneId));
const currentTab = () => tabs.find((t) => t.id === current[active]);
const focusedPane = () => { const t = currentTab(); return t && panes.get(t.focus); };

function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
function tint(section, name) { const l = TINTS[section] || TINTS.office; return l[hash(name) % l.length]; }
function initial(name) { return (name.replace(/^[^a-z0-9]+/i, '')[0] || '~').toUpperCase(); }
function ago(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

// ------------------------------------------------------------------ persistence
const persist = debounce(() => {
  const ser = (n) => (n.k === 'pane'
    ? { k: 'pane', id: n.id, ...paneRecord(panes.get(n.id)) }
    : { k: 'split', dir: n.dir, r: n.r, a: ser(n.a), b: ser(n.b) });
  cfg.session = {
    active,
    current: { ...current },
    tabs: tabs.map((t) => ({ id: t.id, section: t.section, name: t.name, path: t.path, focus: t.focus, createdAt: t.createdAt, theme: t.theme, named: t.named || undefined, root: ser(t.root) })),
  };
  sb.saveConfig(cfg);
}, 300);

function paneRecord(p) {
  if (!p) return {};
  const r = { path: p.path, name: p.name, claudeSession: p.claudeSession || null, wasClaude: !!p.claudeRunning };
  if (p.waitPid) Object.assign(r, { prefill: true, waitPid: p.waitPid });
  return r;
}

// ------------------------------------------------------------------ layout tree helpers
function leaves(n) { return !n ? [] : n.k === 'pane' ? [n.id] : [...leaves(n.a), ...leaves(n.b)]; }
function replaceNode(root, id, fn) {
  if (root.k === 'pane') return root.id === id ? fn(root) : root;
  return { ...root, a: replaceNode(root.a, id, fn), b: replaceNode(root.b, id, fn) };
}
function removeLeaf(root, id) {
  if (root.k === 'pane') return root.id === id ? null : root;
  const a = removeLeaf(root.a, id);
  const b = removeLeaf(root.b, id);
  if (!a) return b;
  if (!b) return a;
  return { ...root, a, b };
}

// ------------------------------------------------------------------ panes (terminals)
function makePane({ id, section, name, path }) {
  const host = document.createElement('div');
  host.className = 'term-host';
  const el = document.createElement('div');
  el.className = 'pane';
  el.dataset.pane = id;
  el.appendChild(host);

  const term = new Terminal({
    fontFamily: fontCss(),
    fontSize: cfg.ui.fontSize,
    lineHeight: 1.18,
    letterSpacing: 0,
    cursorBlink: true,
    cursorStyle: 'bar',
    cursorWidth: 2,
    allowProposedApi: true,
    macOptionIsMeta: cfg.ui.optionIsMeta,
    macOptionClickForcesSelection: true,
    rightClickSelectsWord: false,
    scrollback: 10000,
    smoothScrollDuration: 0,
    minimumContrastRatio: 1,
    drawBoldTextInBrightColors: false,
    theme: THEMES.get('night').colors,
    // Real links (OSC 8), e.g. Claude's artifact and docs links: a click opens them in the browser.
    linkHandler: {
      activate: (e, uri) => sb.openExternal(uri),
      hover: (e, uri) => { host.title = `Click to open ${uri}`; },
      leave: () => { host.title = ''; },
    },
  });
  const fit = new FitAddon.FitAddon();
  const search = new SearchAddon.SearchAddon();
  term.loadAddon(fit);
  term.loadAddon(search);
  const u11 = new Unicode11Addon.Unicode11Addon();
  term.loadAddon(u11);
  term.unicode.activeVersion = '11';
  term.loadAddon(new ClipboardAddon.ClipboardAddon()); // OSC 52 copy, as in iTerm2
  term.loadAddon(new WebLinksAddon.WebLinksAddon((e, uri) => sb.openExternal(uri), {
    hover: (e, uri) => { host.title = `Click to open ${uri}`; },
    leave: () => { host.title = ''; },
  }));
  term.open(host);

  const p = {
    id, section, name, path, term, fit, search, el, host,
    restoring: false, exited: false,
    proc: null, claudeRunning: false, claudeSession: null, title: '',
    state: 'shell', unread: null, hook: null, message: '',
    lastOut: 0, lastIn: 0, claudeSince: 0, workStart: 0, webgl: null, visible: false,
  };
  panes.set(id, p);

  term.onData((d) => {
    // Automatic terminal replies (focus, device-attribute queries) start with ESC; only real typing counts.
    if (!/^\x1b\[(?:[IO]|\?[\d;]*c|>[\d;]*c|\d+;\d+R)$/.test(d)) p.lastIn = Date.now();
    sb.write(id, d);
  });
  term.onBinary((d) => sb.write(id, d));
  term.onResize(({ cols, rows }) => { if (!p.restoring) sb.resize(id, cols, rows); });
  term.onTitleChange((t) => { p.title = cleanTitle(t); renderTabs(); renderStatus(); });


  term.attachCustomKeyEventHandler((e) => keyHandler(p, e));
  el.addEventListener('mousedown', () => focusPane(id), true);

  el.addEventListener('contextmenu', (e) => { e.preventDefault(); paneMenu(p); });
  return p;
}

const shq = (s) => (IS_WIN ? psq(s) : /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`);
// PowerShell quoting. The shell runs with legacy native-argument passing, so double quotes
// inside are backslash-escaped for the program's own (MSVCRT) argument parser.
function psq(s) {
  if (/^[\w./:\\-]+$/.test(s)) return s;
  const native = s.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1');
  return `'${native.replace(/'/g, "''")}'`;
}
// Run b only if a fails (PowerShell 5 has no ||).
const orElse = (a, b) => (IS_WIN ? `${a}; if (-not $?) { ${b} }` : `${a} || ${b}`);
const cleanTitle = (t) => (t || '').replace(/^[\s⠀-⣿✳✢✶✻✽·*⠀-⣿]+/, '').trim();

function keyHandler(p, e) {
  const down = e.type === 'keydown';
  if (IS_WIN) {
    const k = e.key.toLowerCase();
    // Windows Terminal habits: Ctrl+C copies when text is selected (else interrupts), Ctrl+V pastes.
    if (e.ctrlKey && !e.shiftKey && !e.altKey && k === 'c' && p.term.hasSelection()) {
      if (down) { navigator.clipboard.writeText(p.term.getSelection()); p.term.clearSelection(); }
      return false;
    }
    if (e.ctrlKey && e.shiftKey && !e.altKey && k === 'c') {
      if (down && p.term.hasSelection()) navigator.clipboard.writeText(p.term.getSelection());
      return false;
    }
    if (e.ctrlKey && !e.altKey && k === 'v') return false; // browser fires a paste event
    if (e.ctrlKey && e.shiftKey && /^[a-z]$/.test(k)) return false; // app shortcuts (Ctrl+Shift+…)
    if (e.altKey && e.shiftKey && (k === '=' || k === '+' || k === '-' || k === '_')) return false; // splits
    if (e.ctrlKey && !e.shiftKey && !e.altKey && /^[0-9=,-]$/.test(k)) return false;
  }
  if (e.metaKey && !IS_WIN) {
    // Natural text editing, like iTerm2's preset.
    if (down && e.key === 'ArrowLeft') sb.write(p.id, '\x01');
    else if (down && e.key === 'ArrowRight') sb.write(p.id, '\x05');
    else if (down && e.key === 'Backspace') sb.write(p.id, '\x15');
    return false; // every other ⌘ shortcut belongs to the app menu
  }
  if (e.key === 'Enter' && e.shiftKey && !e.altKey && !e.ctrlKey) {
    if (down) sb.write(p.id, '\x1b\r'); // Claude Code: Shift+Enter inserts a newline
    return false;
  }
  if (e.altKey && !e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    if (down) sb.write(p.id, e.key === 'ArrowLeft' ? '\x1bb' : '\x1bf');
    return false;
  }
  return true;
}

function setRenderer(p, visible) {
  // GPU renderer only for panes on screen; browsers cap WebGL contexts at ~16.
  p.visible = visible;
  if (visible && !p.webgl) {
    try {
      const gl = new WebglAddon.WebglAddon();
      gl.onContextLoss(() => { gl.dispose(); p.webgl = null; });
      p.term.loadAddon(gl);
      p.webgl = gl;
    } catch { p.webgl = null; }
  } else if (!visible && p.webgl) {
    try { p.webgl.dispose(); } catch {}
    p.webgl = null;
  }
}

function fitPane(p) {
  if (!p || p.exited || !p.el.isConnected || !p.el.offsetParent) return;
  try {
    const before = `${p.term.cols}x${p.term.rows}`;
    p.fit.fit();
    if (`${p.term.cols}x${p.term.rows}` !== before) sb.resize(p.id, p.term.cols, p.term.rows);
  } catch {}
}

async function spawnPane(p, command) {
  // Size the terminal to its real slot before the shell starts so the first prompt draws correctly.
  fitPane(p);
  const r = await sb.spawn({ id: p.id, cwd: p.path, cols: p.term.cols || 100, rows: p.term.rows || 30, section: p.section, command });
  if (r?.error) toast(`Couldn't start the shell: ${r.error}`);
}

async function attachPane(p) {
  p.restoring = true;
  const snap = await sb.snapshot(p.id);
  if (snap?.data != null) {
    p.term.reset();
    if (snap.cols && snap.rows) p.term.resize(snap.cols, snap.rows);
    p.term.write(snap.data);
  }
  p.restoring = false;
  requestAnimationFrame(() => fitPane(p));
  return snap?.data != null;
}

function disposePane(id, { kill = true } = {}) {
  const p = panes.get(id);
  if (!p) return;
  if (kill) sb.kill(id);
  setRenderer(p, false);
  p.term.dispose();
  p.el.remove();
  panes.delete(id);
}

// ------------------------------------------------------------------ claude status
function isSeen(p) {
  const t = tabOf(p.id);
  return windowFocused && t && t.section === active && current[active] === t.id && t.focus === p.id;
}

function setUnread(p, kind, message) {
  const was = p.unread;
  p.unread = kind;
  if (message) p.message = message;
  if (was !== kind && cfg.ui.notify) {
    const t = tabOf(p.id);
    const where = t ? `${p.name} · ${LABEL[t.section]}` : p.name;
    sb.notify({
      title: kind === 'waiting' ? `${p.name} needs you` : `${p.name} is done`,
      body: p.message || p.title || where,
      paneId: p.id,
    });
  }
  renderAttention();
}

function setState(p, state, message = '') {
  if (p.state === state && p.message === message) return;
  const prev = p.state;
  if (prev !== state) p.stateSince = Date.now();
  p.state = state;
  p.message = message;
  if (state === 'waiting' && prev !== 'waiting' && !isSeen(p) && cfg.ui.notify) {
    const t = tabOf(p.id);
    sb.notify({ title: `${t ? t.name : p.name} needs you`, body: message, paneId: p.id });
  }
  if (state === 'idle' && prev === 'working' && !isSeen(p)) p.unread = 'done';
  if (state === 'working' || state === 'waiting') p.unread = null;
  renderAttention();
  renderStatus();
}

// Hook events (precise) when the user registered Switchboard's hook with Claude Code.
function onClaudeEvent(id, ev) {
  const p = panes.get(id);
  if (!p) return;
  if (ev.session) p.claudeSession = ev.session; // follows /clear and /resume too
  p.hook = { ...ev, seen: Date.now() };
  if (ev.event === 'SessionStart' || ev.event === 'UserPromptSubmit') p.claudeRunning = true;
  if (ev.event === 'SessionEnd') { p.hook = null; }
  scanScreens();
  persist();
}

// Claude's own screen says what it's doing: "esc to interrupt" while working, and a
// question with choices (permission, trust, menus) when it needs you.
function screenText(p, lines = 24) {
  const b = p.term.buffer.active;
  const cursor = b.baseY + b.cursorY; // Claude draws its prompt/spinner around the cursor
  const last = Math.min(b.length - 1, cursor + 6);
  const out = [];
  for (let y = Math.max(0, cursor - lines); y <= last; y++) out.push(b.getLine(y)?.translateToString(true) || '');
  return out.join('\n');
}
// The spinner line, e.g. "✻ Prestidigitating… (3s · thinking)" or "… (esc to interrupt)".
const WORK_RE = /esc to interrupt|^\s*[✻✶✳✢✽*·⏺]\s+\S[^\n]*…\s*\(\d+[smh]/m;
const WAIT_RE = /Do you want to|Would you like to|Enter to confirm|❯\s*1\.\s*Yes|\(esc\)\s*$/m;
function waitReason(txt) {
  if (/trust this folder/i.test(txt)) return 'Asks you to trust this folder';
  const q = txt.split('\n').map((l) => l.trim()).find((l) => /^Do you want to|^Would you like to/.test(l));
  return q ? q.replace(/\s+/g, ' ').slice(0, 90) : 'Waiting for your answer';
}
function scanScreens() {
  if (window.__freezeStatus) return; // test hook for mock screenshots
  for (const p of panes.values()) {
    if (!p.claudeRunning) { if (p.state !== 'shell') setState(p, 'shell'); continue; }
    const txt = screenText(p);
    const onScreenQuestion = WAIT_RE.test(txt) && !WORK_RE.test(txt);
    const h = env.hooks && p.hook; // exact lifecycle events from Claude Code's hook
    if (onScreenQuestion) setState(p, 'waiting', h?.event === 'Notification' && h.message ? h.message : waitReason(txt));
    else if (h) {
      const ev = h.event;
      if (ev === 'UserPromptSubmit' || ev === 'PostToolUse') setState(p, 'working');
      else if (ev === 'Notification' && /permission|approve|allow/i.test(h.message || '')) setState(p, 'waiting', h.message);
      else setState(p, 'idle');
    } else {
      const now = Date.now();
      const streaming = now - p.lastOut < 1500 && p.lastOut - (p.burstStart || 0) > 700 && p.lastOut - p.lastIn > 300;
      setState(p, WORK_RE.test(txt) || streaming ? 'working' : 'idle');
    }
  }
}

// A Claude that was killed or crashed can leave focus/mouse reporting on, and the shell then
// receives stray "[I"/"[O" on every window focus change. Switch those modes off once it's gone
// (in this window and in the daemon's mirror, so a reopened window doesn't bring them back).
const RESET_MODES = '\x1b[?1004l\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1015l\x1b[?25h';
function resetModes(p) {
  p.term.write(RESET_MODES);
  sb.mirror(p.id, RESET_MODES);
}

function onProcs(procs) {
  if (window.__freezeStatus) return;
  for (const [id, proc] of Object.entries(procs)) {
    const p = panes.get(id);
    if (!p) continue;
    p.proc = proc;
    const running = isClaudeProc(proc);
    if (running !== p.claudeRunning) {
      p.claudeRunning = running;
      if (running) p.claudeSince = Date.now();
      if (!running) { p.title = ''; setState(p, 'shell'); resetModes(p); }
      else if (p.state === 'shell') setState(p, 'idle');
      persist();
    }
  }
  renderTabs();
  renderProjects();
  renderStatus();
}

// ------------------------------------------------------------------ tabs
async function openTab(section, proj, { claude = false, focus = true, prompt = null, resume = null, cwd = null, theme = null } = {}) {
  const id = await sb.uuid();
  const tab = { id: 't' + id.slice(0, 8), section, name: proj.name, path: proj.path, root: { k: 'pane', id }, focus: id, createdAt: Date.now(),
    theme: theme || ((claude || resume) && cfg.ui.autoPastel !== false ? nextPastel() : 'night') };
  tabs.push(tab);
  const p = makePane({ id, section, name: proj.name, path: cwd || proj.path });
  let command = null;
  if (resume) {
    p.claudeSession = resume;
    command = claudeCmd(tab, `--resume ${resume}`);
  } else if (claude) {
    p.claudeSession = await sb.uuid();
    command = claudeCmd(tab, `--session-id ${p.claudeSession}${prompt ? ' ' + shq(prompt) : ''}`);
  }
  if (focus) {
    if (section !== active) setSection(section, { quiet: true });
    current[section] = tab.id;
  }
  renderView(tab);
  applyTheme(tab);
  showTab(focus ? tab.id : current[active]);
  await spawnPane(p, command);
  persist();
  return tab;
}

async function confirmCloseClaude(ids) {
  const live = ids.map((id) => panes.get(id)).filter((p) => p && (p.claudeRunning || p.waitPid));
  if (!live.length) return true;
  return confirmBox({
    title: live.length > 1 ? `Close ${live.length} Claude sessions?` : `Close this Claude session?`,
    body: 'Claude stops in this tab. The conversation stays saved and can be resumed later with claude --resume.',
    yes: 'Close',
  });
}
async function requestCloseTab(tabId) {
  const t = tabs.find((x) => x.id === tabId);
  if (t && (await confirmCloseClaude(leaves(t.root)))) closeTab(tabId);
}
async function requestClosePane(paneId) {
  if (await confirmCloseClaude([paneId])) closePane(paneId);
}

function closeTab(tabId) {
  const i = tabs.findIndex((t) => t.id === tabId);
  if (i < 0) return;
  const tab = tabs[i];
  for (const id of leaves(tab.root)) disposePane(id);
  $(`.view[data-tab="${tab.id}"]`)?.remove();
  tabs.splice(i, 1);
  if (current[tab.section] === tab.id) {
    const same = tabs.filter((t) => t.section === tab.section);
    current[tab.section] = (same[Math.min(i, same.length - 1)] || same[same.length - 1])?.id || null;
  }
  showTab(current[active]);
  persist();
}

function closePane(paneId) {
  const tab = tabOf(paneId);
  if (!tab) return disposePane(paneId);
  const root = removeLeaf(tab.root, paneId);
  if (!root) return closeTab(tab.id);
  disposePane(paneId);
  tab.root = root;
  if (tab.focus === paneId) tab.focus = leaves(root)[0];
  renderView(tab);
  showTab(tab.id);
  persist();
}

async function splitPane(dir) {
  const tab = currentTab();
  if (!tab) return;
  const from = panes.get(tab.focus);
  const cwd = (await sb.cwd(from.id).catch(() => null)) || from.path;
  const id = await sb.uuid();
  tab.root = replaceNode(tab.root, from.id, (n) => ({ k: 'split', dir, r: 0.5, a: n, b: { k: 'pane', id } }));
  tab.focus = id;
  const p = makePane({ id, section: tab.section, name: from.name, path: cwd });
  renderView(tab);
  applyTheme(tab);
  showTab(tab.id);
  await spawnPane(p, null);
  persist();
}

function focusPane(id) {
  const tab = tabOf(id);
  if (!tab) return;
  if (tab.focus !== id) { tab.focus = id; persist(); }
  const p = panes.get(id);
  $$('.pane', $(`.view[data-tab="${tab.id}"]`)).forEach((el) => el.classList.toggle('focused', el.dataset.pane === id));
  if (p) {
    if (!editingName) p.term.focus();
    if (p.unread) { p.unread = null; renderAttention(); }
  }
  renderAttention();
  renderStatus();
}

function focusDir(dir) {
  const tab = currentTab();
  if (!tab) return;
  const cur = panes.get(tab.focus)?.el.getBoundingClientRect();
  if (!cur) return;
  const cx = cur.left + cur.width / 2, cy = cur.top + cur.height / 2;
  let best = null, bestD = Infinity;
  for (const id of leaves(tab.root)) {
    if (id === tab.focus) continue;
    const r = panes.get(id).el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const ok = { left: x < cx - 4, right: x > cx + 4, up: y < cy - 4, down: y > cy + 4 }[dir];
    const d = Math.hypot(x - cx, y - cy);
    if (ok && d < bestD) { best = id; bestD = d; }
  }
  if (best) focusPane(best);
}

// Build (or rebuild) a tab's view, moving existing pane elements into place.
function renderView(tab) {
  let view = $(`.view[data-tab="${tab.id}"]`);
  if (!view) {
    view = document.createElement('div');
    view.className = 'view';
    view.dataset.tab = tab.id;
    view.hidden = true;
    $('#views').appendChild(view);
  }
  const build = (n) => {
    if (n.k === 'pane') return panes.get(n.id).el;
    const box = document.createElement('div');
    box.className = `split ${n.dir}`;
    const a = document.createElement('div');
    const b = document.createElement('div');
    a.className = b.className = 'slot';
    a.style.flex = `${n.r} 1 0`;
    b.style.flex = `${1 - n.r} 1 0`;
    a.appendChild(build(n.a));
    b.appendChild(build(n.b));
    const d = document.createElement('div');
    d.className = 'divider';
    d.addEventListener('mousedown', (e) => dragDivider(e, n, box, a, b, d, tab));
    d.addEventListener('dblclick', () => { n.r = 0.5; a.style.flex = '0.5 1 0'; b.style.flex = '0.5 1 0'; refit(tab); persist(); });
    box.append(a, d, b);
    return box;
  };
  const tree = build(tab.root);
  view.replaceChildren(tree);
  view.classList.toggle('multi', leaves(tab.root).length > 1);
  if (tree.classList.contains('pane')) tree.style.flex = '1';
}

function dragDivider(e, node, box, a, b, d, tab) {
  e.preventDefault();
  d.classList.add('active');
  const rect = box.getBoundingClientRect();
  const move = (ev) => {
    const r = node.dir === 'row' ? (ev.clientX - rect.left) / rect.width : (ev.clientY - rect.top) / rect.height;
    node.r = Math.min(0.85, Math.max(0.15, r));
    a.style.flex = `${node.r} 1 0`;
    b.style.flex = `${1 - node.r} 1 0`;
    refit(tab);
  };
  const up = () => {
    d.classList.remove('active');
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    persist();
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

function refit(tab) { for (const id of leaves(tab.root)) fitPane(panes.get(id)); }

function showTab(tabId) {
  const tab = tabs.find((t) => t.id === tabId && t.section === active);
  current[active] = tab ? tab.id : null;
  for (const t of tabs) {
    const v = $(`.view[data-tab="${t.id}"]`);
    if (!v) continue;
    const on = t === tab;
    if (on && v.hidden) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); }
    v.hidden = !on;
    for (const id of leaves(t.root)) { const p = panes.get(id); if (p) setRenderer(p, on); }
  }
  $('#empty').hidden = !!tab;
  $('#empty-title').textContent = `${LABEL[active]} is quiet`;
  if (tab) {
    requestAnimationFrame(() => { refit(tab); focusPane(tab.focus); });
  }
  renderTabs();
  renderProjects();
  renderStatus();
  persist();
}

function cycleTab(dir) {
  const list = tabs.filter((t) => t.section === active);
  if (!list.length) return;
  const i = list.findIndex((t) => t.id === current[active]);
  showTab(list[(i + dir + list.length) % list.length].id);
}

function tabGlyph(p) {
  if (!p) return `<span class="glyph">${ICON.prompt}</span>`;
  if (!p.claudeRunning) return `<span class="glyph">${ICON.prompt}</span>`;
  return `<span class="glyph claude ${p.state}">${ICON.spark}</span>`;
}

function tabSubtitle(tab) {
  const p = panes.get(tab.focus);
  if (!p) return '';
  if (p.waitPid) return 'Waiting for its Terminal window to close';
  if (p.claudeRunning) {
    if (p.state === 'waiting') return p.message || 'Needs your answer';
    if (p.state === 'working') return p.title ? `Working · ${p.title}` : 'Working…';
    return p.title && p.title !== tab.name ? p.title : 'Ready';
  }
  if (p.proc && !isShellProc(p.proc)) return p.proc;
  return p.path;
}

function renderTabs() {
  renderCrumb();
  renderSidebar();
}

function renderCrumb() {
  if (editingName && document.activeElement?.closest?.('#crumb')) return;
  const t = currentTab();
  const th = THEMES.get(t?.theme);
  $('#card').style.setProperty('--term-bg', th.colors.background);
  $('#card').style.setProperty('--term-fg', th.colors.foreground);
  $('#card').classList.toggle('light', !!th.light);
  $('#theme-btn').style.setProperty('--sw', th.colors.background);
  $('#theme-btn').style.setProperty('--sw2', th.colors.foreground);
  $('#theme-btn').hidden = !t;
  $('#files-btn').hidden = !t;
  const p = t && panes.get(t.focus);
  const c = t && changes[t.path];
  const cb = $('#changes-btn');
  cb.hidden = !(c && c.files);
  if (c && c.files) cb.innerHTML = `<b>${c.files}</b> file${c.files > 1 ? 's' : ''} <span class="a">+${c.add}</span> <span class="d">−${c.del}</span>`;
  $('#crumb-glyph').innerHTML = t ? `<i class="st ${sessState(p)}"></i>` : '';
  $('#crumb-title').textContent = t ? sessLabel(t) : '';
  const sub = $('#crumb-sub');
  sub.textContent = t ? `${projectOf(t)} · ${taskLine(t)}` : '';
  sub.className = p && p.claudeRunning ? p.state : '';
  $('#tabbar .tab-actions').style.visibility = t ? 'visible' : 'hidden';
}

// While a name is being edited, nothing may redraw the row or pull focus to a terminal.
let editingName = false;
function editInline(el, value, save, { onDone } = {}) {
  if (!el || editingName) return;
  editingName = true;
  const input = document.createElement('input');
  input.className = 'name-edit';
  input.value = value;
  input.spellcheck = false;
  el.replaceWith(input);
  const started = Date.now();
  const grab = () => { input.focus(); input.select(); };
  grab();
  requestAnimationFrame(grab); // win against the terminal focusing itself on the same click
  let done = false;
  const finish = (ok) => {
    if (done) return;
    done = true;
    editingName = false;
    if (input.isConnected) input.replaceWith(el); // header title is restored in place; sidebar rows are redrawn
    if (ok && input.value.trim()) save(input.value.trim());
    $('#tree').dataset.html = '';
    renderSidebar();
    renderCrumb();
    onDone?.();
    focusedPane()?.term.focus();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => {
    if (Date.now() - started < 500) return setTimeout(grab, 0); // stolen focus right after opening: take it back
    finish(true);
  });
  for (const ev of ['click', 'mousedown', 'dblclick']) input.addEventListener(ev, (e) => e.stopPropagation());
}

async function tabMenu(t) {
  const other = t.section === 'office' ? 'personal' : 'office';
  const r = await sb.popup([
    { id: 'rename', label: 'Rename' },
    { id: 'colour', label: 'Colour & Font…' },
    { id: 'move', label: `Move to ${LABEL[other]}` },
    '-',
    { id: 'reveal', label: IS_WIN ? 'Show in Explorer' : 'Reveal in Finder' },
    { id: 'code', label: 'Open in VS Code' },
    '-',
    { id: 'close', label: 'Close Tab' },
  ]);
  if (r === 'colour') { showTab(t.id); openThemes(); }
  else if (r === 'rename') renameTab(t);
  else if (r === 'move') {
    t.section = other;
    for (const id of leaves(t.root)) panes.get(id).section = other;
    if (current[active] === t.id) current[active] = null;
    current[other] = t.id;
    showTab(current[active] || tabs.find((x) => x.section === active)?.id);
    toast(`Moved to ${LABEL[other]}`);
  } else if (r === 'reveal') sb.reveal(t.path);
  else if (r === 'code') sb.openEditor(t.path);
  else if (r === 'close') requestCloseTab(t.id);
}

async function paneMenu(p) {
  const hasSel = p.term.hasSelection();
  const r = await sb.popup([
    { id: 'copy', label: 'Copy', enabled: hasSel },
    { id: 'paste', label: 'Paste' },
    '-',
    { id: 'split-r', label: 'Split Right' },
    { id: 'split-d', label: 'Split Down' },
    '-',
    { id: 'find', label: 'Find…' },
    { id: 'clear', label: 'Clear Screen' },
    '-',
    { id: 'close', label: 'Close Pane' },
  ]);
  if (r === 'copy') document.execCommand('copy');
  else if (r === 'paste') { p.term.focus(); document.execCommand('paste'); }
  else if (r === 'split-r') splitPane('row');
  else if (r === 'split-d') splitPane('col');
  else if (r === 'find') openFind(p);
  else if (r === 'clear') p.term.clear();
  else if (r === 'close') requestClosePane(p.id);
}

// ------------------------------------------------------------------ find
function openFind(p) {
  if (!p) return;
  let bar = $('.findbar', p.el);
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'findbar';
    bar.innerHTML = `<input placeholder="Find" spellcheck="false"><span class="count"></span>
      <button class="icon-btn" data-d="prev" title="Previous (⇧↵)">${ICON.up}</button>
      <button class="icon-btn" data-d="next" title="Next (↵)">${ICON.down}</button>
      <button class="icon-btn" data-d="close" title="Close (esc)">${ICON.x}</button>`;
    p.el.appendChild(bar);
    const input = $('input', bar);
    const opts = { decorations: { matchOverviewRuler: '#f7b928', activeMatchColorOverviewRuler: '#4599ff', matchBackground: '#5c4a12', activeMatchBackground: '#1b4fa8' } };
    const go = (back) => (back ? p.search.findPrevious(input.value, opts) : p.search.findNext(input.value, opts));
    p.search.onDidChangeResults?.(({ resultIndex, resultCount }) => {
      $('.count', bar).textContent = input.value ? (resultCount ? `${resultIndex + 1} of ${resultCount}` : 'No results') : '';
    });
    const close = () => { p.search.clearDecorations(); bar.remove(); p.term.focus(); };
    input.addEventListener('input', () => go(false));
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') go(e.shiftKey);
      if (e.key === 'Escape') close();
    });
    bar.addEventListener('click', (e) => {
      const d = e.target.closest('button')?.dataset.d;
      if (d === 'close') close(); else if (d) go(d === 'prev');
    });
  }
  const input = $('input', bar);
  const sel = p.term.getSelection();
  if (sel && !sel.includes('\n')) input.value = sel;
  input.focus();
  input.select();
}

// ------------------------------------------------------------------ sections & sidebar
function setSection(s, { quiet = false } = {}) {
  if (!SECTIONS.includes(s)) return;
  const changed = active !== s;
  active = s;
  document.body.dataset.section = s;
  sideBtnTitle();
  $$('#seg button').forEach((b) => b.classList.toggle('on', b.dataset.section === s));
  if (changed) {
    const ul = $('#tree');
    ul.classList.remove('stagger'); void ul.offsetWidth; ul.classList.add('stagger');
    // Rows slide in once on a section switch, never again on later updates.
    clearTimeout(ul._stagger); ul._stagger = setTimeout(() => ul.classList.remove('stagger'), 900);
  }
  renderProjects();
  if (!quiet) showTab(current[s] || tabs.find((t) => t.section === s)?.id);
  refreshGit();
  persist();
}

// ------------------------------------------------------------------ sidebar: the attention list
// Tasks, not tabs (cmux / Conductor): a vertical list grouped by what needs you.
// Each task shows its live line, its project, and how long it has been in that state.
const ICON_FOLDER = '<svg viewBox="0 0 20 20"><path d="M2.8 6.3c0-.9.7-1.6 1.6-1.6h3.1l1.7 1.8h6.4c.9 0 1.6.7 1.6 1.6v6.6c0 .9-.7 1.6-1.6 1.6H4.4c-.9 0-1.6-.7-1.6-1.6z"/></svg>';
const ICON_CHEV = '<svg class="chev" viewBox="0 0 10 10"><path d="M3.5 2 6.5 5l-3 3" stroke-width="1.4"/></svg>';
const changes = {}; // project path -> {files, add, del, list}

function sessState(p) {
  if (!p) return 'shell';
  if (p.waitPid) return 'moving';
  if (!p.claudeRunning) return 'shell';
  if (p.state === 'idle' && p.unread === 'done') return 'done';
  return p.state || 'idle';
}
const norm = (x) => (x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function projectOf(t) {
  for (const s of SECTIONS) {
    const pr = cfg.sections[s].projects.find((x) => x.path === t.path);
    if (pr) return pr.name;
  }
  return t.path === '~' ? 'home' : t.path.split('/').filter(Boolean).pop();
}
function sessLabel(t) {
  if (t.named && t.name) return t.name; // a name you chose always wins
  const p = panes.get(t.focus);
  const proj = projectOf(t);
  if (t.name && norm(t.name) !== norm(proj) && t.name !== 'Home') return t.name;
  if (p?.title && norm(p.title) !== norm(proj)) return p.title;
  if (p && (p.claudeRunning || p.claudeSession)) return 'New conversation';
  if (p?.proc && !isShellProc(p.proc)) return p.proc;
  return 'Shell';
}
function dur(ms) {
  const m = Math.floor(ms / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 1440)}d`;
}
function taskLine(t) {
  const p = panes.get(t.focus);
  const st = sessState(p);
  const c = changes[t.path];
  const ch = c && c.files ? ` · ${c.files} file${c.files > 1 ? 's' : ''} changed` : '';
  switch (st) {
    case 'moving': return 'moving over from Terminal';
    case 'waiting': return p.message || 'needs your answer';
    case 'working': return `working${p.workStart ? ` · ${dur(Date.now() - p.workStart)}` : ''}`;
    case 'done': return `finished${ch}`;
    case 'idle': return `ready${ch}`;
    default: return p?.proc && !isShellProc(p.proc) ? `running ${p.proc}` : 'shell';
  }
}
function taskRow(t, { showSection = false } = {}) {
  const p = panes.get(t.focus);
  const st = sessState(p);
  const since = p?.stateSince || t.createdAt;
  return `<li class="task ${st} ${t.id === current[active] && t.section === active ? 'on' : ''}" data-tab="${t.id}" title="${esc(p?.path || t.path)}">
    <i class="st ${st === 'moving' ? 'idle' : st}"></i>
    <div class="t-main">
      <div class="t-top"><span class="t-name">${esc(sessLabel(t))}</span>${since ? `<time>${esc(ago(since))}</time>` : ''}</div>
      <div class="t-sub"><i class="sw" style="--sw:${THEMES.get(t.theme).colors.background};--sw2:${THEMES.get(t.theme).colors.foreground}"></i>${showSection ? `<span class="tag sec ${t.section}">${LABEL[t.section]}</span>` : ''}<span class="tag">${esc(projectOf(t))}</span>${st === 'waiting' ? '' : `<span class="t-line">${esc(taskLine(t))}</span>`}</div>${st === 'waiting' ? `<div class="t-ask">${esc(taskLine(t))}</div>` : ''}
    </div>
    <button class="x" data-act="close" title="Close">${ICON.x}</button></li>`;
}

function renderSidebar() {
  if (!cfg || editingName) return;
  const ul = $('#tree');
  const all = tabs;
  const mine = all.filter((t) => t.section === active);
  const stOf = (t) => sessState(panes.get(t.focus));
  const needs = all.filter((t) => stOf(t) === 'waiting'); // from both sections: what needs you comes first
  const working = mine.filter((t) => stOf(t) === 'working');
  const ready = mine.filter((t) => ['done', 'idle', 'moving'].includes(stOf(t)))
    .sort((a, b) => (stOf(a) === 'done' ? 0 : 1) - (stOf(b) === 'done' ? 0 : 1));
  const shells = mine.filter((t) => stOf(t) === 'shell');
  const archived = (cfg.archive || []).filter((x) => x.section === active);
  const group = (key, title, list, opts = {}) => {
    if (!list.length) return '';
    const folded = opts.foldable && (cfg.ui.fold || {})[key];
    return `<li class="grp ${key} ${opts.foldable ? 'fold' : ''} ${folded ? '' : 'open'}" data-fold="${opts.foldable ? key : ''}">${opts.foldable ? ICON_CHEV : ''}<span>${title}</span><span class="n">${list.length}</span></li>`
      + (folded ? '' : list.map((t) => (opts.archive ? archRow(t) : taskRow(t, { showSection: opts.showSection && t.section !== active }))).join(''));
  };
  let html = group('needs', 'Needs you', needs, { showSection: true })
    + group('working', 'Working', working)
    + group('ready', 'Ready', ready)
    + group('shells', 'Shells', shells, { foldable: true })
    + group('archive', 'Archive', archived, { foldable: true, archive: true });
  if (!mine.length && !needs.length) html = `<li class="hint-row">No tasks in ${LABEL[active]} yet. Start one with ${keyLabel('⌘N')}.</li>` + html;
  if (ul.dataset.html !== html) { patchList(ul, html); ul.dataset.html = html; }
  for (const s of SECTIONS) {
    $(`#seg button[data-section="${s}"]`).classList.toggle('alert', s !== active && needs.some((t) => t.section === s));
  }
}
// Update the list in place: rows are matched by task / agent / watcher, and only the text and
// attributes that changed are touched. Rebuilding it whole every few seconds (a timer ticking,
// a status line changing) restarted every spinner and dropped the hover.
const rowKey = (n) => n.dataset.tab ? 't' + n.dataset.tab : n.dataset.agent ? 'a' + n.dataset.agent
  : n.dataset.watch ? 'w' + n.dataset.watch : n.classList.contains('grp') ? 'g' + n.classList[1] : 'h' + n.outerHTML;
function morph(from, to) {
  if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) return from.replaceWith(to);
  if (from.nodeType !== 1) { if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue; return; }
  for (const a of [...from.attributes]) if (!to.hasAttribute(a.name)) from.removeAttribute(a.name);
  for (const a of to.attributes) if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
  const was = [...from.childNodes], now = [...to.childNodes];
  now.forEach((n, i) => (was[i] ? morph(was[i], n) : from.appendChild(n)));
  for (const n of was.slice(now.length)) n.remove();
}
function patchList(ul, html) {
  const next = document.createElement('ul');
  next.innerHTML = html;
  const old = new Map([...ul.children].map((n) => [rowKey(n), n]));
  let at = ul.firstElementChild;
  for (const n of [...next.children]) {
    const k = rowKey(n), keep = old.get(k);
    old.delete(k);
    if (keep) { morph(keep, n); if (keep !== at) ul.insertBefore(keep, at); else at = at.nextElementSibling; }
    else ul.insertBefore(n, at);
  }
  for (const n of old.values()) n.remove();
}
function archRow(a) {
  return `<li class="task archived" data-arch="${esc(a.id)}" title="Click to resume this conversation">
    <i class="st idle"></i>
    <div class="t-main"><div class="t-top"><span class="t-name">${esc(a.name)}</span><time>${esc(ago(a.archivedAt))}</time></div>
    <div class="t-sub"><span class="tag">${esc(a.project || '')}</span><span class="t-line">${a.claudeSession ? 'archived · click to resume' : 'archived shell'}</span></div></div>
    <button class="x" data-act="forget" title="Remove from archive">${ICON.x}</button></li>`;
}
const renderProjects = renderSidebar;

$('#tree').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  const fold = e.target.closest('[data-fold]')?.dataset.fold;
  if (fold) { cfg.ui.fold = { ...(cfg.ui.fold || {}), [fold]: !(cfg.ui.fold || {})[fold] }; persist(); return renderSidebar(); }
  const arch = e.target.closest('[data-arch]');
  if (arch) return act === 'forget' ? forgetArchived(arch.dataset.arch) : resumeArchived(arch.dataset.arch);
  const row = e.target.closest('[data-tab]');
  if (!row) return;
  if (act === 'close') return requestCloseTab(row.dataset.tab);
  const t = tabs.find((x) => x.id === row.dataset.tab);
  if (t) revealPane(t.focus);
});
$('#tree').addEventListener('dblclick', (e) => {
  const row = e.target.closest('[data-tab]');
  if (!row) return;
  const t = tabs.find((x) => x.id === row.dataset.tab);
  if (t) renameTab(t);
});
$('#crumb').addEventListener('dblclick', () => { const t = currentTab(); if (t) renameTab(t, { inHeader: true }); });
$('#tree').addEventListener('contextmenu', (e) => {
  const row = e.target.closest('[data-tab]');
  if (!row) return;
  e.preventDefault();
  tabMenu(tabs.find((t) => t.id === row.dataset.tab));
});
function renameTab(t, { inHeader = false } = {}) {
  const save = (v) => { t.name = v; t.named = true; persist(); toast(`Renamed to “${v}”`); };
  const label = inHeader ? $('#crumb-title') : $(`#tree [data-tab="${t.id}"] .t-name`);
  if (label) editInline(label, sessLabel(t), save);
}

// ------------------------------------------------------------------ themes & fonts
const fontCss = () => (THEMES.FONTS.find((f) => f.id === cfg.ui.font) || THEMES.FONTS[0]).css;
function nextPastel() {
  const used = tabs.map((t) => t.theme);
  const free = THEMES.PASTELS.filter((x) => !used.includes(x));
  const pool = free.length ? free : THEMES.PASTELS;
  return pool[Math.floor(Math.random() * pool.length)];
}
// Pastel paper needs Claude's light theme so its own greys stay readable.
function claudeCmd(tab, args) {
  const light = THEMES.get(tab?.theme).light;
  return `claude${light ? (IS_WIN ? ` --settings ${shq(env.lightSettings)}` : ` --settings '{"theme":"light"}'`) : ''} ${args}`;
}
function applyTheme(tab) {
  const th = THEMES.get(tab.theme);
  for (const id of leaves(tab.root)) {
    const p = panes.get(id);
    if (!p) continue;
    p.term.options.theme = th.colors;
    p.el.style.background = th.colors.background;
  }
  const v = $(`.view[data-tab="${tab.id}"]`);
  if (v) v.style.background = th.colors.background;
  if (tab.id === current[active]) renderCrumb();
}
function setTabTheme(tab, id) {
  const before = THEMES.get(tab.theme);
  tab.theme = id;
  applyTheme(tab);
  persist();
  $('#tree').dataset.html = ''; renderSidebar();
  const p = panes.get(tab.focus);
  if (p?.claudeRunning && !!before.light !== !!THEMES.get(id).light) {
    toast(THEMES.get(id).light ? 'Light paper: Claude switches to its light theme the next time this task starts' : 'Dark theme: Claude switches back to dark on its next start');
  }
}
// Colour wheels: hue around the disc, saturation outwards, brightness on the slider.
const wheel = { bg: null, fg: null }; // {h, s, v} being edited, for the current task
const hsvHex = ({ h, s, v }) => {
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return '#' + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
};
const hexHsv = (hex) => {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const v = Math.max(r, g, b), d = v - Math.min(r, g, b);
  const h = d === 0 ? 0 : v === r ? 60 * (((g - b) / d) % 6) : v === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s: v ? d / v : 0, v };
};
const contrast = (a, b) => {
  const lin = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0); };
  const [x, y] = [lin(a), lin(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
function drawWheel(el, c) {
  const cv = el.querySelector('canvas'), ctx = cv.getContext('2d'), R = cv.width / 2;
  const img = ctx.createImageData(cv.width, cv.height);
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
    const dx = x - R, dy = y - R, r = Math.hypot(dx, dy);
    if (r > R) continue;
    const hex = hsvHex({ h: (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, s: r / R, v: c.v });
    const n = parseInt(hex.slice(1), 16), o = (y * cv.width + x) * 4;
    img.data[o] = n >> 16; img.data[o + 1] = (n >> 8) & 255; img.data[o + 2] = n & 255; img.data[o + 3] = r > R - 1 ? 255 * (R - r) : 255;
  }
  ctx.putImageData(img, 0, 0);
}
function paintWheels(redraw) {
  for (const which of ['bg', 'fg']) {
    const el = $(`.cw[data-which="${which}"]`), c = wheel[which], hex = hsvHex(c);
    if (redraw === true || redraw === which) drawWheel(el, c);
    const a = c.h * Math.PI / 180;
    el.querySelector('.cw-dot').style.cssText = `left:${50 + 50 * c.s * Math.cos(a)}%;top:${50 + 50 * c.s * Math.sin(a)}%;background:${hex}`;
    el.querySelector('.cw-v').value = Math.round(c.v * 100);
    el.querySelector('.cw-v').style.setProperty('--cw-full', hsvHex({ ...c, v: 1 }));
    if (document.activeElement !== el.querySelector('.cw-hex')) el.querySelector('.cw-hex').value = hex;
  }
  const th = THEMES.get(`custom:${hsvHex(wheel.bg)}:${hsvHex(wheel.fg)}`), k = th.colors;
  const pv = $('#cw-prev');
  pv.style.cssText = `--bg:${k.background};--fg:${k.foreground}`;
  pv.innerHTML = `<b>~ %</b> claude<br><i style="color:${k.green}">✓</i> tests passed<br><i style="color:${k.yellow}">●</i> <i style="color:${k.blue}">2 files</i> <i style="color:${k.red}">−3</i>`;
  const r = contrast(k.background, k.foreground);
  $('#cw-contrast').textContent = r < 3 ? `Hard to read (contrast ${r.toFixed(1)}:1)` : r < 4.5 ? `Readable, a bit soft (${r.toFixed(1)}:1)` : `Easy to read (${r.toFixed(1)}:1)`;
  $('#cw-contrast').classList.toggle('warn', r < 3);
}
// Live while dragging; saved (and Claude's light/dark checked) when you let go.
function wheelApply(save) {
  const t = currentTab(); if (!t) return;
  const id = `custom:${hsvHex(wheel.bg)}:${hsvHex(wheel.fg)}`;
  if (save) setTabTheme(t, id); else { t.theme = id; applyTheme(t); }
}
function openThemes() {
  const t = currentTab();
  const c = THEMES.get(t?.theme).colors;
  wheel.bg = hexHsv(c.background); wheel.fg = hexHsv(c.foreground);
  paintWheels(true);
  $('#th-fonts').innerHTML = THEMES.FONTS.map((f) => `<button class="fnt ${cfg.ui.font === f.id ? 'on' : ''}" data-font="${f.id}" style="font-family:${f.css}">${esc(f.name)}<small>${esc(f.note)}</small></button>`).join('');
  $('#th-auto').checked = cfg.ui.autoPastel !== false;
  $('#th-sub').textContent = t ? `for “${sessLabel(t)}”` : 'pick a task first';
  const el = $('#themes');
  el.hidden = false;
  el.classList.remove('closing');
}
let themeBefore = null; // the task's theme when a drag started, so the light/dark toast compares against it
for (const el of $$('.cw')) {
  const which = el.dataset.which, disc = el.querySelector('.cw-disc');
  const pick = (e) => {
    const r = disc.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
    wheel[which] = { ...wheel[which], h: (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, s: Math.min(1, Math.hypot(dx, dy) / (r.width / 2)) };
    paintWheels(); wheelApply(false);
  };
  let dragging = false;
  disc.addEventListener('pointerdown', (e) => { try { disc.setPointerCapture(e.pointerId); } catch {} dragging = true; themeBefore = currentTab()?.theme; pick(e); });
  disc.addEventListener('pointermove', (e) => { if (dragging) pick(e); });
  disc.addEventListener('pointerup', () => { if (!dragging) return; dragging = false; const t = currentTab(); if (t && themeBefore) t.theme = themeBefore; wheelApply(true); });
  const v = el.querySelector('.cw-v');
  v.addEventListener('pointerdown', () => { themeBefore = currentTab()?.theme; });
  v.addEventListener('input', () => { wheel[which] = { ...wheel[which], v: v.value / 100 }; paintWheels(which); wheelApply(false); });
  v.addEventListener('change', () => { const t = currentTab(); if (t && themeBefore) t.theme = themeBefore; wheelApply(true); });
  el.querySelector('.cw-hex').addEventListener('input', (e) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(e.target.value.trim());
    if (!m) return;
    wheel[which] = hexHsv('#' + m[1].toLowerCase()); paintWheels(which); wheelApply(true);
  });
}
$('#cw-reset').addEventListener('click', () => { const t = currentTab(); if (t) setTabTheme(t, 'night'); openThemes(); });
$('#themes').addEventListener('click', (e) => {
  if (e.target.id === 'themes' || e.target.closest('[data-close]')) return closeOverlay($('#themes'));
  const f = e.target.closest('[data-font]')?.dataset.font;
  if (f) {
    cfg.ui.font = f;
    for (const p of panes.values()) p.term.options.fontFamily = fontCss();
    const t = currentTab(); if (t) refit(t);
    persist();
    return openThemes();
  }
});
$('#th-auto').addEventListener('change', (e) => { cfg.ui.autoPastel = e.target.checked; persist(); });
$('#theme-btn').addEventListener('click', openThemes);

// ------------------------------------------------------------------ archive
async function archiveTask(t) {
  if (!t) return;
  const p = panes.get(t.focus);
  if (p?.claudeRunning && p.state === 'working') {
    const ok = await confirmBox({ title: 'Archive while Claude is working?', body: 'Claude stops here. The conversation is kept and resumes from the Archive with one click.', yes: 'Archive' });
    if (!ok) return;
  }
  cfg.archive = cfg.archive || [];
  if (p?.claudeSession || p?.claudeRunning) {
    cfg.archive.unshift({ id: t.id, name: sessLabel(t), section: t.section, path: t.path, cwd: p?.path || t.path, project: projectOf(t), claudeSession: p?.claudeSession || null, theme: t.theme, archivedAt: Date.now() });
    cfg.archive = cfg.archive.slice(0, 60);
  }
  closeTab(t.id);
  toast('Archived. Resume it any time from the Archive.');
}
async function resumeArchived(id) {
  const i = (cfg.archive || []).findIndex((x) => x.id === id);
  if (i < 0) return;
  const a = cfg.archive[i];
  cfg.archive.splice(i, 1);
  const tab = await openTab(a.section, { name: a.name, path: a.path }, { cwd: a.cwd, resume: a.claudeSession, theme: a.theme });
  tab.name = a.name;
  persist();
}
function forgetArchived(id) { cfg.archive = (cfg.archive || []).filter((x) => x.id !== id); persist(); renderSidebar(); }

// ------------------------------------------------------------------ composer: new task
let composeSel = 0;
function composeProjects() { return [...cfg.sections[active].projects, { name: 'Home', path: '~' }]; }
function openComposer(preset) {
  const el = $('#composer');
  const list = composeProjects();
  const cur = currentTab();
  composeSel = Math.max(0, list.findIndex((x) => x.path === (preset?.path || cur?.path)));
  $('#c-sec').textContent = LABEL[active];
  $('#c-brief').value = '';
  renderComposeProjects();
  el.hidden = false;
  el.classList.remove('closing');
  setTimeout(() => $('#c-brief').focus(), 30);
}
function renderComposeProjects() {
  $('#c-projects').innerHTML = composeProjects().map((pr, i) => {
    const c = changes[pr.path];
    return `<button class="c-proj ${i === composeSel ? 'on' : ''}" data-i="${i}">${ICON_FOLDER}<span>${esc(pr.name)}</span>${c?.files ? `<small>${c.files}△</small>` : ''}</button>`;
  }).join('');
}
$('#c-projects').addEventListener('click', (e) => {
  const b = e.target.closest('.c-proj');
  if (!b) return;
  composeSel = +b.dataset.i;
  renderComposeProjects();
  if (e.detail === 2) startComposed();
});
async function startComposed() {
  const pr = composeProjects()[composeSel];
  if (!pr) return;
  const brief = $('#c-brief').value.trim();
  closeOverlay($('#composer'));
  const name = brief ? brief.replace(/\s+/g, ' ').split(' ').slice(0, 7).join(' ') + (brief.split(/\s+/).length > 7 ? '…' : '') : pr.name;
  const tab = await openTab(active, pr, { claude: true, prompt: brief || null });
  tab.name = brief ? name : pr.name;
  persist();
  renderSidebar();
}
$('#c-start').addEventListener('click', startComposed);
$('#c-cancel').addEventListener('click', () => closeOverlay($('#composer')));
$('#c-add').addEventListener('click', () => {
  closeOverlay($('#composer'));
  setTimeout(() => addProject({ onDone: (proj) => openComposer(proj) }), 140);
});
$('#composer').addEventListener('mousedown', (e) => { if (e.target.id === 'composer') closeOverlay($('#composer')); });
$('#c-brief').addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter' && modKey(e)) { e.preventDefault(); startComposed(); }
  if (e.key === 'Escape') closeOverlay($('#composer'));
  if (e.key === 'Tab') { e.preventDefault(); composeSel = (composeSel + (e.shiftKey ? -1 : 1) + composeProjects().length) % composeProjects().length; renderComposeProjects(); }
});

// ------------------------------------------------------------------ changes drawer
async function refreshChanges() {
  const paths = [...new Set(tabs.map((t) => t.path).filter((x) => x && x !== '~'))];
  if (!paths.length) return;
  Object.assign(changes, await sb.changes(paths));
  renderSidebar();
  renderCrumb();
}
async function openDrawer() {
  const t = currentTab();
  if (!t) return;
  const d = $('#drawer');
  const c = changes[t.path];
  $('#drawer-sub').textContent = `${projectOf(t)} · ${c?.files || 0} files · +${c?.add || 0} −${c?.del || 0}`;
  $('#drawer-files').innerHTML = (c?.list || []).map((f) => `<li data-file="${esc(f.file)}"><span class="f">${esc(f.file)}</span>${f.untracked ? '<span class="new">new</span>' : `<span class="a">+${f.add}</span><span class="d">−${f.del}</span>`}</li>`).join('') || '<li class="none">No changes since the last commit.</li>';
  $('#drawer-diff').innerHTML = '<span class="dim">Loading diff…</span>';
  d.hidden = false;
  const { patch } = await sb.diff(t.path);
  $('#drawer-diff').innerHTML = patch ? patch.split('\n').map((l) => {
    const cls = l.startsWith('diff --git') ? 'fh' : l.startsWith('@@') ? 'hk' : l.startsWith('+') && !l.startsWith('+++') ? 'ad' : l.startsWith('-') && !l.startsWith('---') ? 'dl' : /^(index|---|\+\+\+)/.test(l) ? 'mt' : '';
    return `<span class="${cls}">${esc(l) || ' '}</span>`;
  }).join('') : '<span class="dim">Nothing to show.</span>';
}
$('#drawer-close').addEventListener('click', () => { $('#drawer').hidden = true; focusedPane()?.term.focus(); });
$('#drawer-files').addEventListener('click', (e) => {
  const f = e.target.closest('[data-file]')?.dataset.file;
  if (!f) return;
  const target = [...$$('#drawer-diff .fh')].find((x) => x.textContent.includes(` b/${f}`));
  target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
});

// One tab per thing: reuse the project's existing Claude (or shell) tab instead of stacking duplicates.
function isClaudeTab(t) {
  return leaves(t.root).some((id) => { const p = panes.get(id); return p && (p.claudeRunning || p.waitPid || p.claudeSession); });
}
function openOnce(section, proj, kind) {
  const match = tabs.find((t) => t.section === section && t.path === proj.path && (kind === 'claude' ? isClaudeTab(t) : !isClaudeTab(t)));
  if (match) {
    if (section !== active) setSection(section, { quiet: true });
    return showTab(match.id);
  }
  return openTab(section, proj, { claude: kind === 'claude' });
}

function focusOrOpen(proj) {
  const mine = tabs.filter((t) => t.section === active && t.path === proj.path);
  if (!mine.length) return openTab(active, proj);
  const i = mine.findIndex((t) => t.id === current[active]);
  showTab(mine[(i + 1) % mine.length].id);
}

// Add project: ask only for a name; Bipolar makes the folder (and a git repo) and opens Claude in it.
let npOnDone = null;
function npParent() { return cfg.ui.projectsDir || '~/Projects'; }
function npRender() {
  const name = $('#np-name').value.trim();
  $('#np-path').textContent = `${npParent().replace(/\/$/, '')}/${name || '…'}`;
  $('#np-error').hidden = true;
}
function addProject({ onDone } = {}) {
  npOnDone = onDone || null;
  $('#np-sec').textContent = LABEL[active];
  $('#np-name').value = '';
  npRender();
  const el = $('#newproj');
  el.hidden = false;
  el.classList.remove('closing');
  setTimeout(() => $('#np-name').focus(), 30);
}
function registerProject(name, path) {
  const list = cfg.sections[active].projects;
  let proj = list.find((x) => x.path === path);
  if (!proj) { proj = { name, path }; list.push(proj); }
  persist(); renderProjects(); refreshGit();
  return proj;
}
async function npCreate() {
  const name = $('#np-name').value.trim();
  const r = await sb.createProject({ parent: npParent(), name, git: $('#np-git').checked });
  if (!r.ok) {
    $('#np-error').innerHTML = esc(r.error) + (r.exists ? ' <button class="ghost-link" id="np-use">Use that folder</button>' : '');
    $('#np-error').hidden = false;
    $('#np-use')?.addEventListener('click', () => npFinish(registerProject(name, r.path), false));
    return;
  }
  npFinish(registerProject(name, r.path), true);
}
function npFinish(proj, created) {
  closeOverlay($('#newproj'));
  toast(created ? `Created ${proj.path}` : `${proj.name} added to ${LABEL[active]}`);
  if (npOnDone) return npOnDone(proj);
  openOnce(active, proj, 'claude'); // straight into work
}
$('#np-name').addEventListener('input', npRender);
$('#np-name').addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') { e.preventDefault(); npCreate(); }
  if (e.key === 'Escape') closeOverlay($('#newproj'));
});
$('#np-create').addEventListener('click', npCreate);
$('#np-cancel').addEventListener('click', () => closeOverlay($('#newproj')));
$('#newproj').addEventListener('mousedown', (e) => { if (e.target.id === 'newproj') closeOverlay($('#newproj')); });
$('#np-change').addEventListener('click', async () => {
  const dir = await sb.pickParent(npParent());
  if (dir) { cfg.ui.projectsDir = dir; persist(); npRender(); }
  $('#np-name').focus();
});
$('#np-existing').addEventListener('click', async () => {
  const path = await sb.pickFolder();
  if (!path) return;
  npFinish(registerProject(path.split('/').filter(Boolean).pop() || path, path), false);
});

function attentionList() {
  return [...panes.values()]
    .filter((p) => p.state === 'waiting' && !isSeen(p))
    .map((p) => ({ p, tab: tabOf(p.id), kind: 'waiting' }))
    .filter((x) => x.tab);
}

function renderAttention() {
  sb.badge(attentionList().length);
  renderSidebar();
}

function revealPane(paneId) {
  const tab = tabOf(paneId);
  if (!tab) return;
  if (tab.section !== active) setSection(tab.section, { quiet: true });
  tab.focus = paneId;
  showTab(tab.id);
}

function latestUnread() {
  const list = [...panes.values()].filter((p) => (p.state === 'waiting' || p.unread) && !isSeen(p) && tabOf(p.id))
    .sort((a, b) => (b.stateSince || 0) - (a.stateSince || 0));
  if (!list.length) return toast('All caught up');
  revealPane(list[0].id);
}

function nextAttention() {
  const list = attentionList();
  if (!list.length) return toast('Nothing is waiting on you');
  revealPane(list[0].p.id);
}

// ------------------------------------------------------------------ status bar & git
function renderStatus() {
  const p = focusedPane();
  const t = currentTab();
  $('#sb-path').textContent = p ? p.path : '';
  const g = t && git[t.path];
  $('#sb-branch').textContent = g?.branch ? `⎇ ${g.branch}${g.dirty ? ` · ${g.dirty} changed` : ''}${g.ahead ? ` · ↑${g.ahead}` : ''}${g.behind ? ` · ↓${g.behind}` : ''}` : '';
  const c = $('#sb-claude');
  c.className = p?.claudeRunning ? `chip ${p.state}` : 'chip';
  c.innerHTML = p?.claudeRunning
    ? `<i></i>${{ working: 'Claude is working', waiting: 'Claude needs your permission', done: 'Claude finished', idle: 'Claude is ready' }[p.state] || 'Claude'}`
    : '';
  const n = panes.size;
  const running = [...panes.values()].filter((x) => x.claudeRunning).length;
  $('#sb-sessions').innerHTML = n
    ? `<span class="chip"><span class="live"></span>${n} session${n > 1 ? 's' : ''}${running ? ` · ${running} Claude` : ''} · keep running after you quit</span>`
    : '';
}

async function refreshGit() {
  const paths = [...new Set([...cfg.sections[active].projects.map((p) => p.path), ...tabs.map((t) => t.path)])];
  Object.assign(git, await sb.git(paths));
  renderProjects();
  renderStatus();
}

// ------------------------------------------------------------------ palette
const palette = { items: [], sel: 0 };

function fuzzy(q, s) {
  if (!q) return { score: 0, html: esc(s) };
  const lower = s.toLowerCase();
  let qi = 0, score = 0, last = -2, out = '';
  for (let i = 0; i < s.length; i++) {
    if (qi < q.length && lower[i] === q[qi]) {
      score += i === last + 1 ? 3 : 1;
      if (i === 0 || /[\s\-_/.]/.test(s[i - 1])) score += 2;
      last = i; qi++;
      out += `<mark>${esc(s[i])}</mark>`;
    } else out += esc(s[i]);
  }
  return qi === q.length ? { score: score - s.length * 0.01, html: out } : null;
}

function paletteSource() {
  const items = [];
  for (const t of tabs) {
    for (const id of leaves(t.root)) {
      const p = panes.get(id);
      if (!p) continue;
      items.push({
        group: 'Open sessions', key: `${t.name} ${p.title}`, title: t.name,
        sub: p.claudeRunning ? (p.title || 'Claude') : p.path, section: t.section,
        icon: `<span class="ic">${p.claudeRunning ? ICON.spark : ICON.prompt}</span>`,
        run: () => revealPane(id),
      });
    }
  }
  for (const s of [active, ...SECTIONS.filter((x) => x !== active)]) {
    for (const proj of cfg.sections[s].projects) {
      items.push({
        group: 'Projects', key: proj.name, title: proj.name, sub: proj.path, section: s,
        icon: `<span class="ic">${ICON_FOLDER}</span>`,
        run: () => { if (s !== active) setSection(s, { quiet: true }); openComposer(proj); },
        alt: () => openOnce(s, proj, 'claude'),
      });
    }
  }
  const cmd = (title, icon, run, sub = '') => items.push({ group: 'Commands', key: title, title, sub: keyLabel(sub), icon: `<span class="ic">${icon}</span>`, run });
  cmd('New Claude session here', ICON.spark, () => menuAction('new-claude'), '⇧⌘T');
  cmd('New shell here', ICON.prompt, () => menuAction('new-tab'), '⌘T');
  cmd('Add files…', ICON.plus, () => menuAction('add-files'), '⌘O');
  cmd('Split right', ICON.split, () => splitPane('row'), '⌘D');
  cmd('Split down', ICON.splitd, () => splitPane('col'), '⇧⌘D');
  cmd(`Switch to ${LABEL[active === 'office' ? 'personal' : 'office']}`, ICON.swap, () => setSection(active === 'office' ? 'personal' : 'office'), active === 'office' ? '⌘2' : '⌘1');
  cmd('New project', ICON.folder, () => addProject());
  cmd('Toggle sidebar', ICON.side, () => menuAction('toggle-sidebar'), '⌘B');
  cmd('Settings', ICON.gear, openSettings, '⌘,');
  cmd('Quit and end all sessions', ICON.power, confirmQuitAll, '⌥⌘Q');
  return items;
}

function openPalette() {
  const el = $('#palette');
  el.hidden = false;
  el.classList.remove('closing');
  const input = $('#palette-q');
  input.value = '';
  palette.sel = 0;
  renderPalette();
  input.focus();
}
function closeOverlay(el) {
  if (el.hidden) return;
  el.classList.add('closing');
  setTimeout(() => { el.hidden = true; el.classList.remove('closing'); focusedPane()?.term.focus(); }, 130);
}
function renderPalette() {
  const q = $('#palette-q').value.trim().toLowerCase();
  const scored = paletteSource()
    .map((it) => { const m = fuzzy(q, it.key); return m && { ...it, score: m.score, html: q ? fuzzy(q, it.title)?.html || esc(it.title) : esc(it.title) }; })
    .filter(Boolean);
  if (q) scored.sort((a, b) => b.score - a.score);
  palette.items = q ? scored.slice(0, 40) : scored.filter((x) => x.group !== 'Projects' || x.section === active).slice(0, 40);
  palette.sel = Math.min(palette.sel, Math.max(0, palette.items.length - 1));
  let lastGroup = null;
  const html = palette.items.map((it, i) => {
    const head = !q && it.group !== lastGroup ? `<li class="grp">${it.group}</li>` : '';
    lastGroup = it.group;
    const tag = it.section ? `<span class="tag ${it.section}">${LABEL[it.section]}</span>` : it.sub && it.group === 'Commands' ? (it.sub ? `<kbd>${esc(it.sub)}</kbd>` : '') : '';
    return `${head}<li class="it ${i === palette.sel ? 'sel' : ''}" data-i="${i}">${it.icon}<span><b>${it.html}</b>${it.group !== 'Commands' ? `<small>${esc(it.sub)}</small>` : ''}</span>${tag}</li>`;
  }).join('') || `<li class="none">Nothing matches “${esc(q)}”.</li>`;
  $('#palette-list').innerHTML = html;
  $('#palette-list .sel')?.scrollIntoView({ block: 'nearest' });
}
function runPalette(i, alt) {
  const it = palette.items[i];
  if (!it) return;
  closeOverlay($('#palette'));
  setTimeout(() => (alt && it.alt ? it.alt() : it.run()), 10);
}
$('#palette-q').addEventListener('input', () => { palette.sel = 0; renderPalette(); });
$('#palette-q').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { palette.sel = (palette.sel + 1) % Math.max(1, palette.items.length); renderPalette(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { palette.sel = (palette.sel - 1 + palette.items.length) % Math.max(1, palette.items.length); renderPalette(); e.preventDefault(); }
  else if (e.key === 'Enter') runPalette(palette.sel, e.altKey);
  else if (e.key === 'Escape') closeOverlay($('#palette'));
});
$('#palette-list').addEventListener('mousemove', (e) => {
  const li = e.target.closest('.it');
  if (li && +li.dataset.i !== palette.sel) { palette.sel = +li.dataset.i; $$('#palette-list .it').forEach((x) => x.classList.toggle('sel', x === li)); }
});
$('#palette-list').addEventListener('click', (e) => { const li = e.target.closest('.it'); if (li) runPalette(+li.dataset.i, e.altKey); });
$('#palette').addEventListener('mousedown', (e) => { if (e.target.id === 'palette') closeOverlay($('#palette')); });

// ------------------------------------------------------------------ settings, confirm, toast
function openSettings() {
  const el = $('#settings');
  $('#set-font').textContent = cfg.ui.fontSize;
  $('#set-meta').checked = cfg.ui.optionIsMeta;
  $('#set-notify').checked = cfg.ui.notify;
  $('#set-name').value = cfg.ui.name || '';
  renderLights();
  $('#hooks-state').innerHTML = env.hooks
    ? 'On. Claude reports exactly when it is working, waiting for permission, or done.'
    : 'Estimated from terminal activity. For exact status, let Bipolar add its hook to Claude Code’s settings (your current settings are backed up first). <button id="hooks-on" class="pill-btn">Turn on</button>';
  el.hidden = false;
}
async function turnOnHooks() {
  const r = await sb.registerHooks();
  if (!r.ok) return toast(r.error || 'Couldn’t turn on precise status');
  env = await sb.env();
  toast('Precise status is on. Claude sessions you start from now report it exactly.');
  if (!$('#settings').hidden) openSettings();
}
document.addEventListener('click', (e) => { if (e.target.closest('#hooks-on')) { e.stopPropagation(); turnOnHooks(); } }, true);
// Windows: ask once on first launch, because nobody goes looking in Settings.
async function offerHooks() {
  if (!IS_WIN || env.hooks || cfg.ui.hooksOffered) return;
  cfg.ui.hooksOffered = true;
  persist();
  const ok = await confirmBox({
    title: 'Let Bipolar see what Claude is doing?',
    body: 'Bipolar adds a small hook to Claude Code’s settings so it knows exactly when Claude is working, done, or waiting for you. Your current settings are backed up first. You can do this later from Settings.',
    yes: 'Turn it on',
  });
  if (ok) turnOnHooks();
}
$('#settings').addEventListener('click', (e) => {
  if (e.target.id === 'settings' || e.target.closest('[data-close]')) return closeOverlay($('#settings'));
  const f = e.target.closest('[data-font]');
  if (f) { setFont(+f.dataset.font); $('#set-font').textContent = cfg.ui.fontSize; }
  const l = e.target.closest('[data-light]');
  if (l) {
    cfg.ui.light = { ...(cfg.ui.light || {}), [l.dataset.sec]: l.dataset.light };
    persist(); applyLights(); renderLights();
    if (l.dataset.sec !== active) setSection(l.dataset.sec); // show the light you just picked
  }
});
$('#set-meta').addEventListener('change', (e) => {
  cfg.ui.optionIsMeta = e.target.checked;
  for (const p of panes.values()) p.term.options.macOptionIsMeta = cfg.ui.optionIsMeta;
  persist();
});
$('#set-notify').addEventListener('change', (e) => { cfg.ui.notify = e.target.checked; persist(); });
$('#set-name').addEventListener('change', (e) => {
  const n = e.target.value.trim();
  if (!n) { e.target.value = cfg.ui.name || ''; return; }
  cfg.ui.name = n; Portal.rename(n); persist();
});

function setFont(delta) {
  cfg.ui.fontSize = delta === 0 ? 13 : Math.max(9, Math.min(26, cfg.ui.fontSize + delta));
  for (const p of panes.values()) p.term.options.fontSize = cfg.ui.fontSize;
  const t = currentTab();
  if (t) refit(t);
  persist();
}

function confirmBox({ title, body, yes }) {
  return new Promise((resolve) => {
    const el = $('#confirm');
    $('#confirm-title').textContent = title;
    $('#confirm-body').textContent = body;
    $('[data-yes]', el).textContent = yes;
    el.hidden = false;
    $('[data-no]', el).focus();
    const done = (v) => { closeOverlay(el); el.onclick = null; resolve(v); };
    el.onclick = (e) => {
      if (e.target.closest('[data-yes]')) done(true);
      else if (e.target.closest('[data-no]') || e.target.id === 'confirm') done(false);
    };
  });
}

async function confirmQuitAll() {
  const ok = await confirmBox({
    title: `End all ${panes.size} sessions?`,
    body: 'Every shell and Claude session stops. Claude conversations can still be resumed later with /resume. To keep them running, quit with ' + keyLabel('⌘Q') + ' instead.',
    yes: 'End sessions and quit',
  });
  if (ok) sb.quitAll();
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<i></i>${esc(text)}`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 2600);
}

// ------------------------------------------------------------------ menu & keys
function menuAction(action, arg) {
  const t = currentTab();
  const p = focusedPane();
  const proj = t ? { name: t.name, path: p?.path || t.path } : { name: 'Home', path: '~' };
  switch (action) {
    case 'section': setSection(arg); break;
    case 'new-tab': openTab(active, proj); break;
    case 'add-files': addFiles(); break;
    case 'new-claude': openTab(active, proj, { claude: true }); break;
    case 'split': splitPane(arg); break;
    case 'close-pane': if (p) requestClosePane(p.id); break;
    case 'close-tab': if (t) requestCloseTab(t.id); break;
    case 'clear': p?.term.clear(); break;
    case 'select-all': p?.term.selectAll(); break;
    case 'find': openFind(p); break;
    case 'palette': openPalette(); break;
    case 'next-attention': nextAttention(); break;
    case 'cycle-tab': cycleTab(arg); break;
    case 'focus-dir': focusDir(arg); break;
    case 'toggle-sidebar':
      document.body.classList.toggle('no-sidebar');
      cfg.ui.sidebarHidden = document.body.classList.contains('no-sidebar');
      sideBtnTitle();
      setTimeout(() => t && refit(t), 280);
      persist();
      break;
    case 'font': setFont(arg); break;
    case 'settings': openSettings(); break;
    case 'quit-all': confirmQuitAll(); break;
    case 'lock': if (!IS_WIN) Portal.lock(); break;
    case 'compose': openComposer(); break;
    case 'archive': archiveTask(t); break;
    case 'changes': openDrawer(); break;
    case 'latest-unread': latestUnread(); break;
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    for (const id of ['palette', 'settings', 'confirm', 'composer', 'themes']) if (!$('#' + id).hidden) { closeOverlay($('#' + id)); e.preventDefault(); }
    if (!$('#drawer').hidden) { $('#drawer').hidden = true; e.preventDefault(); }
  }
});

// sidebar resize
$('#sash').addEventListener('mousedown', (e) => {
  e.preventDefault();
  const move = (ev) => {
    const w = Math.max(220, Math.min(420, ev.clientX));
    document.documentElement.style.setProperty('--side-w', w + 'px');
    cfg.ui.sideW = w;
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    const t = currentTab();
    if (t) refit(t);
    persist();
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
});

// ------------------------------------------------------------------ drag & drop
// Drop files anywhere: their shell-escaped paths are pasted into the pane under the
// pointer (or the focused one), the way Terminal does it. Claude reads image paths this way.
function droppedPaths(dt) {
  let paths = [...(dt.files || [])].map((f) => { try { return sb.pathForFile(f); } catch { return ''; } }).filter(Boolean);
  if (!paths.length) {
    paths = (dt.getData('text/uri-list') || '').split(/\r?\n/)
      .filter((u) => u.startsWith('file://'))
      .map((u) => decodeURIComponent(new URL(u).pathname));
  }
  return paths;
}
let dropTarget = null;
const paneAt = (e) => panes.get(document.elementFromPoint(e.clientX, e.clientY)?.closest('.pane')?.dataset.pane) || focusedPane();
function markDrop(p) {
  if (dropTarget === p) return;
  dropTarget?.el.classList.remove('drop');
  dropTarget = p;
  p?.el.classList.add('drop');
}
document.addEventListener('dragover', (e) => {
  if (![...e.dataTransfer.types].some((t) => t === 'Files' || t === 'text/uri-list')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  markDrop(paneAt(e));
});
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) markDrop(null); });
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const p = paneAt(e);
  markDrop(null);
  const paths = droppedPaths(e.dataTransfer);
  if (!p || !paths.length) return;
  revealPane(p.id);
  p.term.paste(paths.map(shq).join(' ') + ' ');
  p.term.focus();
});
// The same without Finder: pick files in a dialog, they land in the focused pane.
async function addFiles() {
  const p = focusedPane();
  if (!p) return toast('Open a task first, then add files to it.');
  const paths = await sb.pickFiles();
  if (!paths.length) return p.term.focus();
  revealPane(p.id);
  p.term.paste(paths.map(shq).join(' ') + ' ');
  p.term.focus();
}
$('#files-btn').addEventListener('click', addFiles);

// ------------------------------------------------------------------ paste images
// xterm only pastes text, so an image-only clipboard used to vanish. Do what Terminal does:
// into Claude, send Ctrl+V so Claude reads the clipboard image itself ([Image #1]);
// into a plain shell, save the image and paste its path. Files copied in Finder paste as paths.
document.addEventListener('paste', async (e) => {
  const p = focusedPane();
  if (!p || !p.el.contains(document.activeElement)) return;
  const dt = e.clipboardData;
  const text = dt.getData('text/plain');
  const fileUrls = (dt.getData('text/uri-list') || '').split(/\r?\n/).filter((u) => u.startsWith('file://'));
  const files = [...dt.files];
  const paths = files.map((f) => { try { return sb.pathForFile(f); } catch { return ''; } }).filter(Boolean)
    .concat(fileUrls.map((u) => decodeURIComponent(new URL(u).pathname).replace(/^\/([A-Za-z]:)/, '$1')));
  if (paths.length) {
    e.preventDefault(); e.stopImmediatePropagation();
    p.term.paste([...new Set(paths)].map(shq).join(' ') + ' ');
    return;
  }
  const isImage = files.some((f) => f.type.startsWith('image/')) || [...dt.types].some((t) => t.startsWith('image/'));
  if (!isImage || text) return; // ordinary text paste: let the terminal handle it
  e.preventDefault(); e.stopImmediatePropagation();
  if (p.claudeRunning) { sb.write(p.id, IS_WIN ? '\x1bv' : '\x16'); return; } // Claude's paste-image key
  const file = await sb.clipboardImage();
  if (file) p.term.paste(shq(file) + ' ');
}, true);

// ------------------------------------------------------------------ boot
sb.onData((id, d) => {
  const p = panes.get(id);
  if (!p || p.restoring) return;
  const now = Date.now();
  if (now - p.lastOut > 400) p.burstStart = now; // a new run of output begins
  p.lastOut = now;
  p.term.write(d);
});
sb.onExit((id, code) => {
  const p = panes.get(id);
  if (!p) return;
  p.exited = true;
  if (code === 0) return closePane(id); // `exit` closes the pane, like Terminal
  const pill = document.createElement('div');
  pill.className = 'ended';
  pill.innerHTML = `Session ended (code ${code}) <button>Close pane</button>`;
  $('button', pill).onclick = () => closePane(id);
  p.el.appendChild(pill);
});
sb.onProcs(onProcs);
sb.onClaude(onClaudeEvent);
sb.onMenu(menuAction);
sb.onFocusPane(revealPane);
sb.onWindowFocus((f) => {
  windowFocused = f;
  if (f) { const p = focusedPane(); if (p?.unread) { p.unread = null; renderAttention(); } p?.term.focus(); }
});
sb.onReconnected(async () => {
  for (const p of panes.values()) await attachPane(p);
  sb.procsNow();
});
window.addEventListener('resize', debounce(() => { const t = currentTab(); if (t) refit(t); }, 60));
new ResizeObserver(debounce(() => { const t = currentTab(); if (t) refit(t); }, 30)).observe($('#views'));

$$('#seg button').forEach((b) => b.addEventListener('click', () => setSection(b.dataset.section)));
$('#search').addEventListener('click', openPalette);
$('#empty-palette').addEventListener('click', openPalette);
$('#empty-claude').addEventListener('click', () => openComposer());
$('#new-task').addEventListener('click', () => openComposer());
$('#archive-btn').addEventListener('click', () => archiveTask(currentTab()));
$('#changes-btn').addEventListener('click', openDrawer);
$('#add').addEventListener('click', () => addProject());
$('#home-shell').addEventListener('click', () => openTab(active, { name: 'Home', path: '~' }));
$('#settings-btn').addEventListener('click', openSettings);
function sideBtnTitle() { $('#side-btn').title = `${LABEL[active]} · ` + keyLabel(document.body.classList.contains('no-sidebar') ? 'Show sidebar (⌘B)' : 'Hide sidebar (⌘B)'); $('#sec-l').textContent = LABEL[active][0]; }
$('#side-btn').addEventListener('click', () => menuAction('toggle-sidebar'));
$('#new-tab').addEventListener('click', () => menuAction('new-tab'));
$('#close-btn').addEventListener('click', () => menuAction('close-tab'));
$('#split-btn').addEventListener('click', (e) => splitPane(e.shiftKey ? 'col' : 'row'));

// Windows: label shortcuts the Windows way and leave room for the caption buttons.
if (IS_WIN) {
  document.body.classList.add('win');
  for (const k of $$('kbd')) k.textContent = keyLabel(k.textContent);
  for (const el of $$('[title]')) el.title = keyLabel(el.title);
  const meta = $('#set-meta')?.closest('.set-row');
  if (meta) meta.hidden = true; // Alt already acts as Meta on Windows
  $('#set-name-row').hidden = true; // the name only greets you on the Mac lock screen
}

(async function boot() {
  cfg = await sb.getConfig();
  env = await sb.env();
  Portal.init({
    onOpen: () => { focusedPane()?.term.focus(); const t = currentTab(); if (t) requestAnimationFrame(() => refit(t)); },
    name: cfg.ui.name, suggest: env.accountName,
    onName: (n) => { cfg.ui.name = n; persist(); },
  });
  // Windows build: no lock screen at all, straight into work.
  if (IS_WIN) { $('#portal').hidden = true; document.body.classList.remove('locked'); }
  else Portal.lock({ scanNow: true }); // just opened Bipolar: you're here, look straight away
  cfg.ui.font = cfg.ui.font || (IS_WIN ? 'cascadia' : 'sfmono'); // the system terminal's font by default
  await Promise.all(["13px 'SF Mono Terminal'", "bold 13px 'SF Mono Terminal'", "13px 'JetBrains Mono'", "13px 'Geist Mono'"].map((f) => document.fonts.load(f).catch(() => {})));
  applyLights();
  if (cfg.ui.sideW) document.documentElement.style.setProperty('--side-w', cfg.ui.sideW + 'px');
  if (cfg.ui.sidebarHidden) document.body.classList.add('no-sidebar');
  sideBtnTitle();
  const hello = await sb.hello();
  const alive = new Set(hello.panes.map((x) => x.id));
  const saved = cfg.session || {};

  active = saved.active || 'office';
  document.body.dataset.section = active;
  setSection(active, { quiet: true });

  // Rebuild every saved tab. Live shells are re-attached with their full screen;
  // shells lost to a restart are recreated, and Claude ones resume their own conversation.
  const restored = { live: 0, resumed: 0 };
  for (const st of saved.tabs || []) {
    const ids = leaves(st.root);
    const tab = { id: st.id, section: st.section, name: st.name, path: st.path, root: stripTree(st.root), focus: st.focus, createdAt: st.createdAt || Date.now(), theme: st.theme || 'night' , named: st.named };
    const recs = collect(st.root);
    tabs.push(tab);
    for (const id of ids) {
      const rec = recs[id] || {};
      const p = makePane({ id, section: st.section, name: rec.name || st.name, path: rec.path || st.path });
      p.claudeSession = rec.claudeSession || null;
      if (rec.waitPid) p.waitPid = rec.waitPid;
      p._restore = alive.has(id) ? 'attach'
        : rec.prefill && rec.claudeSession ? 'prefill'
        : rec.wasClaude && rec.claudeSession ? 'resume' : 'shell';
    }
    if (!ids.includes(tab.focus)) tab.focus = ids[0];
    renderView(tab);
    applyTheme(tab);
  }
  // Shells the daemon still runs but the layout lost (e.g. crashed before saving).
  for (const meta of hello.panes) {
    if (panes.has(meta.id)) continue;
    const tab = { id: 't' + meta.id.slice(0, 8), section: active, name: 'Recovered', path: meta.cwd, root: { k: 'pane', id: meta.id }, focus: meta.id };
    tabs.push(tab);
    const p = makePane({ id: meta.id, section: active, name: 'Recovered', path: meta.cwd });
    p._restore = 'attach';
    renderView(tab);
  }

  current.office = saved.current?.office && tabs.some((t) => t.id === saved.current.office) ? saved.current.office : tabs.find((t) => t.section === 'office')?.id || null;
  current.personal = saved.current?.personal && tabs.some((t) => t.id === saved.current.personal) ? saved.current.personal : tabs.find((t) => t.section === 'personal')?.id || null;

  // Make views measurable so restored shells get the right size.
  showTab(current[active]);
  document.body.classList.remove('booting');
  document.body.classList.add('ready');

  for (const p of panes.values()) {
    if (p._restore === 'attach') { await attachPane(p); restored.live++; }
    else if (p._restore === 'resume') {
      const tb = tabOf(p.id);
      await spawnPane(p, orElse(claudeCmd(tb, `--resume ${p.claudeSession}`), claudeCmd(tb, `--session-id ${p.claudeSession}`)));
      restored.resumed++;
    } else if (p._restore === 'prefill') {
      // Typed but not run: the conversation is still open elsewhere; press Enter once it's closed there.
      await spawnPane(p, null);
      typeWhenReady(p, claudeCmd(tabOf(p.id), `--resume ${p.claudeSession}`));
    } else await spawnPane(p, null);
    delete p._restore;
  }
  sb.procsNow();
  sb.claudeStates();
  sb.onImportReady(runImport);
  runImport();
  setInterval(watchHandoffs, 1500);
  renderAttention();
  setTimeout(offerHooks, 1200);
  refreshGit();
  setInterval(scanScreens, 700);
  setInterval(refreshGit, 20000);
  refreshChanges(); setInterval(refreshChanges, 15000);
  setInterval(() => { $('#tree').dataset.html = ''; renderSidebar(); renderCrumb(); }, 30000);
  setInterval(() => renderAttention(), 30000);
  const portalStats = () => {
    const live = panes.size, claude = [...panes.values()].filter((p) => p.claudeRunning).length;
    const waiting = attentionList().length;
    Portal.stats(`${live} sessions alive · ${claude} with claude\n${waiting ? `${waiting} waiting on you` : 'nothing waiting on you'}`);
  };
  portalStats(); setInterval(portalStats, 3000);
  if (restored.resumed) toast(`Resumed ${restored.resumed} Claude conversation${restored.resumed > 1 ? 's' : ''} after restart`);
  else if (restored.live) toast(`Reconnected to ${restored.live} running session${restored.live > 1 ? 's' : ''}`);
})();

// Type text at the shell prompt once the shell has gone quiet (prompt drawn), without pressing Enter.
function typeWhenReady(p, text) {
  const start = Date.now();
  const tick = () => {
    const quiet = p.lastOut && Date.now() - p.lastOut > 500;
    if (quiet || Date.now() - start > 8000) sb.write(p.id, text);
    else setTimeout(tick, 150);
  };
  setTimeout(tick, 300);
}

// ------------------------------------------------------------------ import & handoff
// Tabs waiting for a conversation that is still open elsewhere (e.g. Terminal.app):
// the resume command is typed and waits; when that process exits we press Enter.
async function runImport() {
  const items = await sb.takeImport();
  if (!items.length) return;
  let added = 0;
  for (const it of items) {
    if (!it.session || [...panes.values()].some((p) => p.claudeSession === it.session)) continue;
    const section = SECTIONS.includes(it.section) ? it.section : active;
    const id = await sb.uuid();
    // `project` groups the tab under a sidebar project; `cwd` is where the conversation lives.
    const tab = { id: 't' + id.slice(0, 8), section, name: it.title || 'Claude', path: it.project || it.cwd || '~', root: { k: 'pane', id }, focus: id };
    tabs.push(tab);
    const p = makePane({ id, section, name: tab.name, path: it.cwd || '~' });
    p.claudeSession = it.session;
    renderView(tab);
    const [alive] = it.pid ? await sb.pidAlive([it.pid]) : [false];
    if (alive) {
      p.waitPid = it.pid;
      await spawnPane(p, null);
      typeWhenReady(p, `claude --resume ${it.session}`);
    } else {
      await spawnPane(p, `claude --resume ${it.session}`);
    }
    if (!current[section]) current[section] = tab.id;
    added++;
  }
  showTab(current[active]);
  persist();
  if (added) toast(`${added} conversation${added > 1 ? 's' : ''} imported. Each continues here when you close its Terminal window.`);
}

async function watchHandoffs() {
  const waiting = [...panes.values()].filter((p) => p.waitPid);
  if (!waiting.length) return;
  const alive = await sb.pidAlive(waiting.map((p) => p.waitPid));
  waiting.forEach((p, i) => {
    if (alive[i]) return;
    p.waitPid = null;
    setTimeout(() => {
      sb.write(p.id, '\r');
      const t = tabOf(p.id);
      toast(`${t ? t.name : 'Conversation'} moved over from Terminal`);
      persist();
      renderTabs();
    }, 1200); // let the old process finish writing its transcript
  });
}

function stripTree(n) {
  return n.k === 'pane' ? { k: 'pane', id: n.id } : { k: 'split', dir: n.dir, r: n.r, a: stripTree(n.a), b: stripTree(n.b) };
}
function collect(n, out = {}) {
  if (n.k === 'pane') out[n.id] = n; else { collect(n.a, out); collect(n.b, out); }
  return out;
}
