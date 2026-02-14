import type { ClusterData, ConnectionStatus, HpcConfig } from '../shared/types'

declare global {
  interface Window {
    ozstar: {
      onClusterData: (callback: (data: ClusterData) => void) => void
      onConnectionStatus: (callback: (status: ConnectionStatus) => void) => void
      requestRefresh: () => void
      requestLogTail: (filePath: string) => Promise<string>
      getConfig: () => Promise<HpcConfig>
    }
  }
}
