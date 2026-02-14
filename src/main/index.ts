import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { SSHManager } from './ssh'
import { SlurmFetcher } from './slurm'
import { IPC_CHANNELS } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let sshManager: SSHManager
let slurmFetcher: SlurmFetcher
let pollInterval: ReturnType<typeof setInterval> | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function fetchAndSend(): Promise<void> {
  if (!mainWindow) return
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
  fetchAndSend()
  pollInterval = setInterval(fetchAndSend, 30_000)
}

function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.ozstar.monitor')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  sshManager = new SSHManager()
  sshManager.onStatusChange((status) => {
    mainWindow?.webContents.send(IPC_CHANNELS.CONNECTION_STATUS, status)
  })
  slurmFetcher = new SlurmFetcher(sshManager)

  ipcMain.on(IPC_CHANNELS.REQUEST_REFRESH, () => fetchAndSend())
  ipcMain.handle(IPC_CHANNELS.REQUEST_LOG_TAIL, async (_event, filePath: string) => {
    return slurmFetcher.fetchLogTail(filePath)
  })

  createWindow()

  mainWindow?.on('hide', stopPolling)
  mainWindow?.on('minimize', stopPolling)
  mainWindow?.on('show', startPolling)
  mainWindow?.on('restore', startPolling)

  try {
    await sshManager.connect()
    startPolling()
  } catch (err) {
    console.error('Initial SSH connection failed:', err)
    mainWindow?.webContents.send(IPC_CHANNELS.CONNECTION_STATUS, 'disconnected')
  }
})

app.on('window-all-closed', () => {
  stopPolling()
  sshManager?.dispose()
  app.quit()
})
