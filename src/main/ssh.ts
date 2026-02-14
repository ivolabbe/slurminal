/**
 * SSH connection manager for OzStar.
 *
 * Maintains a persistent SSH connection to nt.swin.edu.au,
 * auto-reconnects on drop, and reports status changes via callback.
 */

import { NodeSSH } from 'node-ssh'
import { homedir } from 'os'
import { join } from 'path'
import { existsSync } from 'fs'
import type { ConnectionStatus } from '../shared/types'

const SSH_HOST = 'nt.swin.edu.au'
const SSH_USER = 'ilabbe'
const RECONNECT_DELAY_MS = 5_000
const KEY_CANDIDATES = ['id_ed25519', 'id_rsa', 'id_ecdsa']

export type StatusCallback = (status: ConnectionStatus) => void

export class SSHManager {
  private ssh: NodeSSH
  private statusCb: StatusCallback | null = null
  private currentStatus: ConnectionStatus = 'disconnected'
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.ssh = new NodeSSH()
  }

  /** Register a callback that fires on every status change. */
  onStatusChange(cb: StatusCallback): void {
    this.statusCb = cb
  }

  /** Current connection status. */
  get status(): ConnectionStatus {
    return this.currentStatus
  }

  /** Connect (or reconnect) to OzStar. */
  async connect(): Promise<void> {
    const keyPath = this.findSSHKey()
    if (!keyPath) throw new Error('No SSH key found in ~/.ssh')

    this.setStatus('reconnecting')

    try {
      await this.ssh.connect({
        host: SSH_HOST,
        username: SSH_USER,
        privateKeyPath: keyPath,
        readyTimeout: 15_000,
        keepaliveInterval: 30_000,
      })
      this.setStatus('connected')

      // Watch for disconnection
      this.ssh.connection?.on('error', () => this.handleDisconnect())
      this.ssh.connection?.on('close', () => this.handleDisconnect())
    } catch (err) {
      this.setStatus('disconnected')
      throw err
    }
  }

  /** Run a command over SSH and return stdout. */
  async exec(command: string): Promise<string> {
    if (!this.ssh.isConnected()) {
      throw new Error('SSH not connected')
    }
    const result = await this.ssh.execCommand(command)
    if (result.stderr && result.code !== 0) {
      throw new Error(`SSH command failed (code ${result.code}): ${result.stderr}`)
    }
    return result.stdout
  }

  /** Cleanly close the SSH connection. */
  dispose(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ssh.dispose()
    this.setStatus('disconnected')
  }

  /** Find the first available SSH private key in ~/.ssh. */
  findSSHKey(): string | null {
    const sshDir = join(homedir(), '.ssh')
    for (const name of KEY_CANDIDATES) {
      const p = join(sshDir, name)
      if (existsSync(p)) return p
    }
    return null
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private setStatus(status: ConnectionStatus): void {
    if (status === this.currentStatus) return
    this.currentStatus = status
    this.statusCb?.(status)
  }

  private handleDisconnect(): void {
    if (this.currentStatus === 'disconnected') return
    this.setStatus('reconnecting')
    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      try {
        await this.connect()
      } catch {
        // Will retry on next scheduled reconnect
        this.scheduleReconnect()
      }
    }, RECONNECT_DELAY_MS)
  }
}
