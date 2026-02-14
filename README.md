<p align="center">
  <img src="slurminal.png" width="128" height="128" alt="Slurminal">
</p>

<h1 align="center">Slurminal</h1>

<p align="center">
  SSH-based SLURM cluster monitor for your desktop.
</p>

---

Slurminal connects to any HPC cluster over SSH and gives you a live dashboard of your SLURM jobs, cluster utilization, top users, and fair-share priority. Dark terminal aesthetic, zero setup on the cluster side.

## Features

- **My Jobs** -- running, pending, and recently completed jobs with expandable log tails
- **Cluster Overview** -- node/core utilization bars, top users by core count
- **Fair-Share** -- your current priority factor and effective usage
- **Auto-refresh** every 30 seconds with manual refresh on click
- **First-launch setup** -- prompted for `user@host`, saved to `~/.slurminal.json`

## Install

```bash
git clone https://github.com/ivolabbe/slurminal.git
cd slurminal
npm install
```

## Run

```bash
npm run slurminal
```

## Configuration

On first launch, Slurminal prompts for your SSH login (`user@host`) and a display title. This is saved to `~/.slurminal.json`:

```json
{
  "host": "login.hpc.example.edu",
  "user": "jsmith",
  "name": "Slurminal"
}
```

CLI flags override the config file:

```bash
npm run slurminal -- --host login.hpc.example.edu --user jsmith --title "My Cluster"
```

### Requirements

- SSH key in `~/.ssh/` (ed25519, RSA, or ECDSA)
- SLURM commands available on the remote host (`squeue`, `sinfo`, `sshare`, `sacct`)

## Build

```bash
# macOS
npm run build:mac

# Linux
npm run build:linux

# Windows
npm run build:win
```

## Tech Stack

Electron + React + TypeScript, built with [electron-vite](https://electron-vite.org). SSH via [node-ssh](https://github.com/steelbrain/node-ssh).
