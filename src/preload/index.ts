import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'

contextBridge.exposeInMainWorld('ozstar', {
  onClusterData: (callback: (data: any) => void) => {
    ipcRenderer.on(IPC_CHANNELS.CLUSTER_DATA, (_event, data) => callback(data))
  },
  onConnectionStatus: (callback: (status: string) => void) => {
    ipcRenderer.on(IPC_CHANNELS.CONNECTION_STATUS, (_event, status) => callback(status))
  },
  requestRefresh: () => {
    ipcRenderer.send(IPC_CHANNELS.REQUEST_REFRESH)
  },
  requestLogTail: (filePath: string): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REQUEST_LOG_TAIL, filePath)
  },
  getConfig: (): Promise<any> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG)
  },
})
