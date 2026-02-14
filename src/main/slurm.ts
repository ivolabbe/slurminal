/**
 * SLURM data fetcher for OzStar.
 *
 * Runs SLURM commands in parallel over SSH, parses the JSON output,
 * and returns a typed ClusterData snapshot.
 */

import type { ClusterData } from '../shared/types'
import type { SSHManager } from './ssh'
import { parseMyJobs, parseNodeSummary, parseTopUsers, parseFairShare } from './slurm-parser'

export class SlurmFetcher {
  private commands: Record<string, string>

  constructor(
    private ssh: SSHManager,
    private user: string
  ) {
    this.commands = {
      squeue: `squeue -u ${user} --json`,
      squeueAll: 'squeue --all --json',
      sinfo: 'sinfo --json',
      sshare: `sshare -u ${user} --json`,
      sacct: `sacct -u ${user} --starttime=now-24hours --json`,
    }
  }

  /** Fetch all SLURM data in parallel, parse, and return a ClusterData snapshot. */
  async fetchAll(): Promise<ClusterData> {
    const [squeueRaw, squeueAllRaw, sinfoRaw, sshareRaw, sacctRaw] = await Promise.all([
      this.ssh.exec(this.commands.squeue),
      this.ssh.exec(this.commands.squeueAll),
      this.ssh.exec(this.commands.sinfo),
      this.ssh.exec(this.commands.sshare),
      this.ssh.exec(this.commands.sacct),
    ])

    const squeueJson = JSON.parse(squeueRaw)
    const squeueAllJson = JSON.parse(squeueAllRaw)
    const sinfoJson = JSON.parse(sinfoRaw)
    const sshareJson = JSON.parse(sshareRaw)
    const sacctJson = JSON.parse(sacctRaw)

    return {
      my_jobs: parseMyJobs(squeueJson, sacctJson),
      node_summary: parseNodeSummary(sinfoJson),
      top_users: parseTopUsers(squeueAllJson),
      fair_share: parseFairShare(sshareJson, this.user),
      last_updated: new Date().toISOString(),
    }
  }

  /** Fetch the last N lines of a remote file (e.g. job stdout log). */
  async fetchLogTail(path: string, lines = 15): Promise<string> {
    return this.ssh.exec(`tail -n ${lines} ${path}`)
  }
}
