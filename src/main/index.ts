import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SSHManager } from './ssh'
import { SlurmFetcher } from './slurm'
import { loadConfig, saveConfig, type HpcConfig } from './config'
import { IPC_CHANNELS } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let sshManager: SSHManager
let slurmFetcher: SlurmFetcher
let pollInterval: ReturnType<typeof setInterval> | null = null
let sshReady = false
let config: HpcConfig

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 700,
    minHeight: 450,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  // Show window once content is ready (avoids flash)
  mainWindow.on('ready-to-show', () => mainWindow?.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function fetchAndSend(): Promise<void> {
  if (!mainWindow || sshManager.status !== 'connected') return
  try {
    const data = await slurmFetcher.fetchAll()
    mainWindow.webContents.send(IPC_CHANNELS.CLUSTER_DATA, data)
  } catch (err) {
    console.error('Fetch error:', err)
    try {
      await sshManager.connect()
    } catch {
      /* status change handled via callback */
    }
  }
}

function startPolling(): void {
  if (!sshReady) return
  stopPolling()
  fetchAndSend()
  pollInterval = setInterval(fetchAndSend, 30_000)
}

function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

/** Prompt user for connection and display name via a setup window. */
async function promptForConfig(): Promise<HpcConfig | null> {
  const iconFile = is.dev
    ? join(__dirname, '../../build/icon.png')
    : join(process.resourcesPath, 'icon.png')
  const iconB64 = readFileSync(iconFile).toString('base64')

  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 400,
      height: 340,
      resizable: false,
      minimizable: false,
      maximizable: false,
      titleBarStyle: 'default',
      title: 'Slurminal',
      backgroundColor: '#0a0a0f',
      webPreferences: { nodeIntegration: true, contextIsolation: false },
    })

    const html = `<!DOCTYPE html>
<html><head><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'SF Mono', 'JetBrains Mono', monospace; background: #0a0a0f; color: #e0e0e0; padding: 28px 32px; display: flex; flex-direction: column; align-items: center; overflow: hidden; }
  img { width: 64px; height: 64px; margin-bottom: 12px; }
  h2 { font-size: 18px; color: #00ff88; margin-bottom: 4px; font-weight: 600; }
  .sub { font-size: 12px; color: #555; margin-bottom: 24px; }
  label { font-size: 13px; color: #888; align-self: flex-start; margin-bottom: 6px; }
  input { width: 100%; padding: 10px 12px; font-size: 14px; font-family: inherit; border: 1px solid #333; border-radius: 6px; background: #111; color: #e0e0e0; outline: none; margin-bottom: 16px; }
  input:focus { border-color: #00ff88; }
  input::placeholder { color: #444; }
  .go { width: 100%; padding: 10px; font-size: 14px; font-family: inherit; border: none; border-radius: 6px; cursor: pointer; background: #00ff88; color: #000; font-weight: 600; margin-top: 4px; }
  .go:disabled { background: #222; color: #555; cursor: not-allowed; }
</style></head><body>
  <img src="data:image/png;base64,${iconB64}" />
  <h2>Slurminal</h2>
  <div class="sub">SSH-based SLURM cluster monitor</div>
  <label>SSH Login</label>
  <input id="login" placeholder="user@host" autofocus />
  <label>Title</label>
  <input id="title" placeholder="Slurminal" />
  <button class="go" id="go" disabled>Connect</button>
  <script>
    const { ipcRenderer } = require('electron');
    const login = document.getElementById('login');
    const titleEl = document.getElementById('title');
    const go = document.getElementById('go');
    function updateGo() { go.disabled = !login.value.includes('@'); }
    login.addEventListener('input', updateGo);
    function submit() {
      if (go.disabled) return;
      const [user, ...rest] = login.value.split('@');
      const host = rest.join('@');
      const name = titleEl.value.trim() || 'Slurminal';
      ipcRenderer.send('setup-result', JSON.stringify({ user, host, name }));
    }
    go.addEventListener('click', submit);
    login.addEventListener('keydown', e => { if (e.key === 'Enter') { if (!go.disabled) submit(); } });
    titleEl.addEventListener('keydown', e => { if (e.key === 'Enter') { if (!go.disabled) submit(); } });
  </script>
</body></html>`

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    win.setMenu(null)

    let resolved = false
    ipcMain.once('setup-result', (_e, value: string) => {
      resolved = true
      win.close()
      if (!value) return resolve(null)
      try { resolve(JSON.parse(value)) } catch { resolve(null) }
    })

    win.on('closed', () => { if (!resolved) resolve(null) })
  })
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.slurminal.app')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  // Load or prompt for config
  const loaded = loadConfig()
  if (loaded) {
    config = loaded
  } else {
    const prompted = await promptForConfig()
    if (!prompted) {
      app.quit()
      return
    }
    config = prompted
    saveConfig(config)
  }

  sshManager = new SSHManager(config.host, config.user)
  sshManager.onStatusChange((status) => {
    mainWindow?.webContents.send(IPC_CHANNELS.CONNECTION_STATUS, status)
  })
  slurmFetcher = new SlurmFetcher(sshManager, config.user)

  ipcMain.on(IPC_CHANNELS.REQUEST_REFRESH, () => fetchAndSend())
  ipcMain.handle(IPC_CHANNELS.REQUEST_LOG_TAIL, async (_event, filePath: string) => {
    return slurmFetcher.fetchLogTail(filePath)
  })
  ipcMain.handle(IPC_CHANNELS.GET_CONFIG, () => config)

  createWindow()

  // Only pause/resume polling on hide/show — don't start before SSH is ready
  mainWindow?.on('hide', stopPolling)
  mainWindow?.on('minimize', stopPolling)
  mainWindow?.on('show', () => { if (sshReady) startPolling() })
  mainWindow?.on('restore', () => { if (sshReady) startPolling() })

  // Connect SSH and start polling immediately
  try {
    await sshManager.connect()
    sshReady = true
    startPolling()
  } catch (err) {
    console.error('Initial SSH connection failed:', err)
    mainWindow?.webContents.send(IPC_CHANNELS.CONNECTION_STATUS, 'disconnected')
  }
})

app.on('window-all-closed', () => {
  // Don't quit during setup — only when main window is closed
  if (!mainWindow) return
  stopPolling()
  mainWindow = null  // prevent statusCb from sending to destroyed window
  sshManager?.dispose()
  app.quit()
})
