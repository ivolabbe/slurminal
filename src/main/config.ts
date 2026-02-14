/**
 * Configuration loader for HPC Monitor.
 *
 * Priority: CLI args > config file > defaults.
 * Config file: ~/.slurminal.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { HpcConfig } from '../shared/types'
export type { HpcConfig }

const CONFIG_PATH = join(homedir(), '.slurminal.json')

const DEFAULTS: HpcConfig = {
  host: '',
  user: '',
  name: 'Slurminal',
}

/** Load config from file. Returns null if no config file exists. */
function loadFromFile(): Partial<HpcConfig> | null {
  if (!existsSync(CONFIG_PATH)) return null
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Parse CLI args: --host <host> --user <user> --title <title> */
function parseCliArgs(): Partial<HpcConfig> {
  const args = process.argv.slice(1)
  const result: Partial<HpcConfig> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--host' && args[i + 1]) result.host = args[++i]
    else if (args[i] === '--user' && args[i + 1]) result.user = args[++i]
    else if (args[i] === '--title' && args[i + 1]) result.name = args[++i]
  }
  return result
}

/** Save config to ~/.slurminal.json */
export function saveConfig(config: HpcConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n')
}

/** Load config with priority: CLI > file > defaults. Returns null if host or user missing. */
export function loadConfig(): HpcConfig | null {
  const fileConfig = loadFromFile() ?? {}
  const cliConfig = parseCliArgs()

  const merged: HpcConfig = {
    host: cliConfig.host || fileConfig.host || DEFAULTS.host,
    user: cliConfig.user || fileConfig.user || DEFAULTS.user,
    name: cliConfig.name || fileConfig.name || DEFAULTS.name,
  }

  if (!merged.host || !merged.user) return null
  return merged
}

export function configExists(): boolean {
  return existsSync(CONFIG_PATH)
}

export { CONFIG_PATH }
