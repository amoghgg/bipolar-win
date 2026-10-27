/* Terminal colour themes for Bipolar.
   - Apple: the macOS Terminal.app profiles, with Terminal's own ANSI palette.
   - Pastels: soft paper backgrounds with ink text, drawn for Bipolar; new tasks can
     get one each automatically so every task has its own colour, like separate
     Terminal windows used to.
   - Loved: Catppuccin and Rosé Pine, the community's favourite pastel palettes. */
'use strict';

const THEMES = (() => {
  const appleAnsi = {
    black: '#000000', red: '#990000', green: '#00a600', yellow: '#999900', blue: '#0000b2', magenta: '#b200b2', cyan: '#00a6b2', white: '#bfbfbf',
    brightBlack: '#666666', brightRed: '#e50000', brightGreen: '#00d900', brightYellow: '#e5e500', brightBlue: '#0000ff', brightMagenta: '#e500e5', brightCyan: '#00e5e5', brightWhite: '#e5e5e5',
  };
  // Ink-on-paper ANSI tuned for legibility on light pastel backgrounds.
  const inkAnsi = {
    black: '#2b2b33', red: '#c2415d', green: '#2f8a5b', yellow: '#a8741a', blue: '#3768c4', magenta: '#9a4fb5', cyan: '#1f8a99', white: '#7d7d8a',
    brightBlack: '#55555f', brightRed: '#d6506e', brightGreen: '#3aa36d', brightYellow: '#c48a22', brightBlue: '#4a7fe0', brightMagenta: '#b061cc', brightCyan: '#2aa3b3', brightWhite: '#3a3a44',
  };
  // Soft ANSI colours that read well on dark backgrounds.
  const nightAnsi = {
    black: '#1a1a22', red: '#ff8c9b', green: '#8de6b8', yellow: '#f3c46f', blue: '#93b8ff', magenta: '#d4b0ff', cyan: '#93e4f6', white: '#d6d2e0',
    brightBlack: '#5f5b70', brightRed: '#ffa8b4', brightGreen: '#aef0cd', brightYellow: '#f8d591', brightBlue: '#b3ceff', brightMagenta: '#e3c9ff', brightCyan: '#b5eefa', brightWhite: '#ffffff',
  };
  const t = (id, name, group, light, base, ansi) => ({ id, name, group, light, colors: { ...ansi, ...base } });
  const pastel = (id, name, bg, fg, accent) => t(id, name, 'Pastels', true, {
    background: bg, foreground: fg, cursor: accent, cursorAccent: bg,
    selectionBackground: accent + '38', selectionInactiveBackground: accent + '22',
  }, inkAnsi);
  const apple = (id, name, bg, fg, cursor, light) => t(id, name, 'Apple Terminal', light, {
    background: bg, foreground: fg, cursor: cursor || fg, cursorAccent: bg,
    selectionBackground: light ? '#b4d5fe' : 'rgba(255,255,255,0.25)',
  }, appleAnsi);

  const list = [
    t('night', 'Bipolar Night', 'Bipolar', false, {
      background: '#0b0b0f', foreground: '#e6e2ee', cursor: '#eeeaf4', cursorAccent: '#0b0b0f',
      selectionBackground: 'rgba(198, 182, 255, 0.28)', selectionInactiveBackground: 'rgba(236,232,255,0.1)',
    }, nightAnsi),

    pastel('glacier', 'Glacier', '#dcf0f6', '#1d2b33', '#2f7ea0'),
    pastel('peach', 'Peach', '#fbe3d8', '#3a2219', '#c25a3a'),
    pastel('lilac', 'Lilac', '#e7e0f8', '#29203d', '#7a5cc4'),
    pastel('mint', 'Mint', '#dcf2e4', '#1b3325', '#3a9466'),
    pastel('butter', 'Butter', '#f8efcc', '#3a3014', '#b08a1e'),
    pastel('rose', 'Rose', '#f6dbe5', '#3b1e2a', '#c2457a'),
    pastel('sky', 'Sky', '#dde6fb', '#1c2541', '#4a6fd0'),
    pastel('sand', 'Sand', '#ece4d6', '#33291c', '#9a7244'),

    apple('basic', 'Basic', '#ffffff', '#000000', '#7f7f7f', true),
    apple('pro', 'Pro', '#000000', '#f1f1f1', '#4d4d4d', false),
    apple('homebrew', 'Homebrew', '#000000', '#28fe14', '#38fe27', false),
    apple('ocean', 'Ocean', '#214ebc', '#ffffff', '#ffffff', false),
    apple('grass', 'Grass', '#13773d', '#fff0a5', '#8e2800', false),
    apple('redsands', 'Red Sands', '#79251d', '#d7c9a7', '#ffffff', false),
    apple('novel', 'Novel', '#dfdac3', '#3b2221', '#3a2322', true),
    apple('manpage', 'Man Page', '#fef49c', '#000000', '#7f7f7f', true),
    apple('aerogel', 'Silver Aerogel', '#9a9a9a', '#000000', '#d8d8d8', true),
    apple('cleardark', 'Clear Dark', '#191d26', '#dfdfdf', '#dfdfdf', false),

    t('latte', 'Catppuccin Latte', 'Loved', true, { background: '#eff1f5', foreground: '#4c4f69', cursor: '#dc8a78', cursorAccent: '#eff1f5', selectionBackground: '#acb0be80' },
      { black: '#5c5f77', red: '#d20f39', green: '#40a02b', yellow: '#df8e1d', blue: '#1e66f5', magenta: '#ea76cb', cyan: '#179299', white: '#acb0be', brightBlack: '#6c6f85', brightRed: '#d20f39', brightGreen: '#40a02b', brightYellow: '#df8e1d', brightBlue: '#1e66f5', brightMagenta: '#ea76cb', brightCyan: '#179299', brightWhite: '#bcc0cc' }),
    t('frappe', 'Catppuccin Frappé', 'Loved', false, { background: '#303446', foreground: '#c6d0f5', cursor: '#f2d5cf', cursorAccent: '#303446', selectionBackground: '#626880aa' },
      { black: '#51576d', red: '#e78284', green: '#a6d189', yellow: '#e5c890', blue: '#8caaee', magenta: '#f4b8e4', cyan: '#81c8be', white: '#b5bfe2', brightBlack: '#626880', brightRed: '#e78284', brightGreen: '#a6d189', brightYellow: '#e5c890', brightBlue: '#8caaee', brightMagenta: '#f4b8e4', brightCyan: '#81c8be', brightWhite: '#a5adce' }),
    t('macchiato', 'Catppuccin Macchiato', 'Loved', false, { background: '#24273a', foreground: '#cad3f5', cursor: '#f4dbd6', cursorAccent: '#24273a', selectionBackground: '#5b6078aa' },
      { black: '#494d64', red: '#ed8796', green: '#a6da95', yellow: '#eed49f', blue: '#8aadf4', magenta: '#f5bde6', cyan: '#8bd5ca', white: '#b8c0e0', brightBlack: '#5b6078', brightRed: '#ed8796', brightGreen: '#a6da95', brightYellow: '#eed49f', brightBlue: '#8aadf4', brightMagenta: '#f5bde6', brightCyan: '#8bd5ca', brightWhite: '#a5adcb' }),
    t('mocha', 'Catppuccin Mocha', 'Loved', false, { background: '#1e1e2e', foreground: '#cdd6f4', cursor: '#f5e0dc', cursorAccent: '#1e1e2e', selectionBackground: '#585b70aa' },
      { black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af', blue: '#89b4fa', magenta: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de', brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1', brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#f5c2e7', brightCyan: '#94e2d5', brightWhite: '#a6adc8' }),
    t('rosepine', 'Rosé Pine', 'Loved', false, { background: '#191724', foreground: '#e0def4', cursor: '#524f67', cursorAccent: '#e0def4', selectionBackground: '#403d52' },
      { black: '#26233a', red: '#eb6f92', green: '#31748f', yellow: '#f6c177', blue: '#9ccfd8', magenta: '#c4a7e7', cyan: '#ebbcba', white: '#e0def4', brightBlack: '#6e6a86', brightRed: '#eb6f92', brightGreen: '#31748f', brightYellow: '#f6c177', brightBlue: '#9ccfd8', brightMagenta: '#c4a7e7', brightCyan: '#ebbcba', brightWhite: '#e0def4' }),
    t('dawn', 'Rosé Pine Dawn', 'Loved', true, { background: '#faf4ed', foreground: '#575279', cursor: '#9893a5', cursorAccent: '#faf4ed', selectionBackground: '#dfdad9' },
      { black: '#9893a5', red: '#b4637a', green: '#286983', yellow: '#ea9d34', blue: '#56949f', magenta: '#907aa9', cyan: '#d7827e', white: '#575279', brightBlack: '#797593', brightRed: '#b4637a', brightGreen: '#286983', brightYellow: '#ea9d34', brightBlue: '#56949f', brightMagenta: '#907aa9', brightCyan: '#d7827e', brightWhite: '#575279' }),
  ];
  const byId = Object.fromEntries(list.map((x) => [x.id, x]));
  const PASTELS = list.filter((x) => x.group === 'Pastels').map((x) => x.id);
  const FONTS = navigator.userAgent.includes('Windows') ? [
    { id: 'cascadia', name: 'Cascadia Mono', css: "'Cascadia Mono', 'Cascadia Code', Consolas, monospace", note: 'Windows Terminal' },
    { id: 'consolas', name: 'Consolas', css: "Consolas, monospace", note: 'classic Windows' },
    { id: 'jetbrains', name: 'JetBrains Mono', css: "'JetBrains Mono', Consolas, monospace", note: 'for code' },
    { id: 'geist', name: 'Geist Mono', css: "'Geist Mono', Consolas, monospace", note: 'Bipolar' },
  ] : [
    { id: 'sfmono', name: 'SF Mono', css: "'SF Mono Terminal', 'SF Mono', Menlo, monospace", note: 'Terminal.app' },
    { id: 'menlo', name: 'Menlo', css: "Menlo, monospace", note: 'classic macOS' },
    { id: 'monaco', name: 'Monaco', css: "Monaco, monospace", note: 'vintage macOS' },
    { id: 'jetbrains', name: 'JetBrains Mono', css: "'JetBrains Mono', Menlo, monospace", note: 'for code' },
    { id: 'geist', name: 'Geist Mono', css: "'Geist Mono', Menlo, monospace", note: 'Bipolar' },
  ];
  // A colour picked on the wheels is stored on the task as "custom:<bg>:<fg>".
  const luminance = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  const custom = (bg, fg) => {
    const light = luminance(bg) > 0.5;
    return t(`custom:${bg}:${fg}`, 'Custom', 'Custom', light, {
      background: bg, foreground: fg, cursor: fg, cursorAccent: bg,
      selectionBackground: fg + '40', selectionInactiveBackground: fg + '22',
    }, light ? inkAnsi : nightAnsi);
  };
  const get = (id) => {
    const m = /^custom:(#[0-9a-f]{6}):(#[0-9a-f]{6})$/i.exec(id || '');
    return m ? custom(m[1].toLowerCase(), m[2].toLowerCase()) : byId[id] || byId.night;
  };
  return { list, byId, PASTELS, FONTS, get, luminance };
})();
