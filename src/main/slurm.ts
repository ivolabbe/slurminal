/**
 * SLURM data fetcher for OzStar.
 *
 * Runs SLURM commands in parallel over SSH, parses the JSON output,
 * and returns a typed ClusterData snapshot.
 */

import type { ClusterData } from '../shared/types'
import type { SSHManager } from './ssh'
import { parseMyJobs, parseNodeSummary, parseTopUsers, parseFairShare } from './slurm-parser'

/** SLURM commands to run on OzStar. */
const COMMANDS = {
  squeue: 'squeue -u ilabbe --json',
  squeueAll: 'squeue --all --json',
  sinfo: 'sinfo --json',
  sshare: 'sshare -u ilabbe --json',
  sacct: 'sacct -u ilabbe --starttime=now-24hours --json',
} as const

export class SlurmFetcher {
  constructor(private ssh: SSHManager) {}

  /** Fetch all SLURM data in parallel, parse, and return a ClusterData snapshot. */
  async fetchAll(): Promise<ClusterData> {
    const [squeueRaw, squeueAllRaw, sinfoRaw, sshareRaw, sacctRaw] = await Promise.all([
      this.ssh.exec(COMMANDS.squeue),
      this.ssh.exec(COMMANDS.squeueAll),
      this.ssh.exec(COMMANDS.sinfo),
      this.ssh.exec(COMMANDS.sshare),
      this.ssh.exec(COMMANDS.sacct),
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
      fair_share: parseFairShare(sshareJson),
      last_updated: new Date().toISOString(),
    }
  }

  /** Fetch the last N lines of a remote file (e.g. job stdout log). */
  async fetchLogTail(path: string, lines = 15): Promise<string> {
    return this.ssh.exec(`tail -n ${lines} ${path}`)
  }
}
