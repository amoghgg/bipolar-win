# Bipolar for Windows

A terminal workstation with separate **Office** and **Personal** sections, for people who run
Claude Code in the Windows terminal. No lock screen; it opens straight into work.

- Every tab is a real PowerShell (PowerShell 7 if installed, else Windows PowerShell) on ConPTY.
- Sessions live in a background service (`ptyd.js`, named pipe `\\.\pipe\bipolar-ptyd-<user>`):
  closing the window keeps every shell and Claude session running; reopening reconnects with the
  screen intact. After a restart, Claude tabs resume their own conversation (`claude --resume`).
- "Needs you / working / ready" list, toasts and taskbar flash when Claude finishes or needs you.
- Precise Claude status: on first launch Bipolar offers to add its hook (`sb-hook.ps1`, run by
  Claude Code via `powershell.exe`, async) to `~/.claude/settings.json`, after backing it up.

## Keys

Plain Ctrl+letter belongs to the terminal (Ctrl+C copies when text is selected, otherwise
interrupts; Ctrl+V pastes; Alt+V pastes an image into Claude). Bipolar uses Ctrl+Shift:

| | |
|---|---|
| New task | Ctrl+Shift+N |
| Search / jump | Ctrl+Shift+P |
| New shell · new Claude | Ctrl+Shift+T · Ctrl+Shift+A |
| Split right · down | Alt+Shift+= · Alt+Shift+- |
| Next task waiting on you | Ctrl+Shift+J |
| Archive · changes | Ctrl+Shift+E · Ctrl+Shift+G |
| Office · Personal | Ctrl+1 · Ctrl+2 |

## Build and test

- `npm run package` (on a Mac) → `dist/Bipolar-Windows-x64.zip`.
- Every push runs `.github/workflows/windows.yml` on a real Windows machine: builds the app,
  installs Claude Code, and runs `test/e2e-win.js` (22 end-to-end checks, including sessions
  surviving the app quitting). The tested build is attached to the run as `Bipolar-Windows-x64`.

Config: `%USERPROFILE%\.config\switchboard\config.json`. The Mac version is `amoghgg/bipolar-mac`.
