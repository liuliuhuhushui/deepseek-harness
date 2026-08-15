/**
 * Backend of `dsh web --install-shortcut`: copy the desktop launcher bundle
 * (hidden service start, default-browser app window, waiting page,
 * stop-on-close) from this package's `launcher/` directory into
 * `$DSH_HOME/web-app/`, bake in the repository root, and create the desktop
 * shortcut that opens it. Windows only; other platforms get a clear refusal.
 * @module @deepseek-ai/dsh-web-app/desktop-shortcut
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { WHALE_ICON_PNG_BASE64 } from './desktop-shortcut-icon.ts'

/** Side effects the installer needs, injectable for tests. */
export interface ShortcutIo {
  mkdir: (dir: string) => void
  writeFile: (path: string, data: string | Buffer) => void
  run: (command: string, args: readonly string[]) => { status: number | null; stdout: string; stderr: string }
}

/** Where the bundle lands and what its server command points at. */
export interface ShortcutEnv {
  /** `process.platform`; the installer only acts on `win32`. */
  platform: string
  /** Resolved `$DSH_HOME`; the bundle is copied into `web-app/` under it. */
  home: string
  /** The dsh source checkout the launcher's hidden `node … web` runs from. */
  repoRoot: string
}

/** Installer outcome; `reason` is a program.error-ready message when not ok. */
export type ShortcutResult = { ok: true; shortcut: string; dir: string } | { ok: false; reason: string }

/** Launcher assets copied verbatim; only the ps1 needs the checkout baked in. */
const LAUNCHER_FILES = [
  'dsh-web.ps1',
  'dsh-web.vbs',
  'dsh-web-launching.html',
  'dsh-web-status.mjs',
  'dsh-web-install-shortcut.ps1',
] as const

/** This package's own directory, source plane and built plane alike. */
const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url))

/**
 * Resolve the dsh source checkout this package runs from.
 * @returns the repository root (the directory holding `apps/cli/src/bin.ts`).
 */
export function resolveRepoRoot(): string {
  // packages/bundle/web-app → the checkout root is three levels up.
  const root = join(PACKAGE_DIR, '..', '..', '..')
  if (!existsSync(join(root, 'apps', 'cli', 'src', 'bin.ts'))) {
    throw new Error('web-app: --install-shortcut needs a source checkout (apps/cli/src/bin.ts not found)')
  }
  return root
}

/**
 * Wrap a PNG in a minimal ICO container (PNG-compressed icon, 256px entry).
 * @param png - the PNG payload.
 * @returns the `.ico` bytes.
 */
export function buildIco(png: Buffer): Buffer {
  const ico = Buffer.alloc(22)
  ico.writeUInt16LE(0, 0) // reserved
  ico.writeUInt16LE(1, 2) // type: icon
  ico.writeUInt16LE(1, 4) // one image
  ico.writeUInt8(0, 6) // width byte: 0 means 256
  ico.writeUInt8(0, 7) // height byte: 0 means 256
  ico.writeUInt16LE(1, 10) // planes
  ico.writeUInt16LE(32, 12) // bits per pixel
  ico.writeUInt32LE(png.length, 14) // payload size
  ico.writeUInt32LE(22, 18) // payload offset
  return Buffer.concat([ico, png])
}

/**
 * Copy the launcher bundle into `$DSH_HOME/web-app/` and create the shortcut.
 * @param env - platform, harness home, and the checkout the launcher boots.
 * @param io - filesystem/process side effects (faked in tests).
 * @returns the created shortcut path, or a refusal reason.
 */
export function installDesktopShortcut(env: ShortcutEnv = defaultEnv(), io: ShortcutIo = systemIo()): ShortcutResult {
  if (env.platform !== 'win32') {
    return { ok: false, reason: `--install-shortcut is only supported on Windows (this is ${env.platform})` }
  }
  const dir = join(env.home, 'web-app')
  const launcherDir = join(PACKAGE_DIR, 'launcher')
  io.mkdir(dir)
  for (const name of LAUNCHER_FILES) {
    let content = readFileSync(join(launcherDir, name), 'utf8')
    if (name === 'dsh-web.ps1') content = content.replaceAll('__REPO__', env.repoRoot)
    io.writeFile(join(dir, name), content)
  }
  io.writeFile(join(dir, 'dsh-web.ico'), buildIco(Buffer.from(WHALE_ICON_PNG_BASE64, 'base64')))
  const install = io.run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(dir, 'dsh-web-install-shortcut.ps1')])
  if (install.status !== 0) {
    return { ok: false, reason: `shortcut creation failed: ${install.stderr.trim() || `exit ${String(install.status)}`}` }
  }
  const shortcut = install.stdout.trim().split(/\r?\n/).pop() ?? ''
  return { ok: true, shortcut, dir }
}

/** The live environment: this platform, `$DSH_HOME`, and this checkout. */
function defaultEnv(): ShortcutEnv {
  return { platform: process.platform, home: resolveDshHome(), repoRoot: resolveRepoRoot() }
}

/** Real side effects. */
function systemIo(): ShortcutIo {
  return {
    mkdir: (dir) => { mkdirSync(dir, { recursive: true }) },
    writeFile: (path, data) => { writeFileSync(path, data) },
    run: (command, args) => {
      const result = spawnSync(command, [...args], { encoding: 'utf8' })
      return { status: result.status, stdout: result.stdout, stderr: result.stderr }
    },
  }
}

/** Test hook: the flag action calls through this seam. */
export const internals: { installDesktopShortcut: typeof installDesktopShortcut } = { installDesktopShortcut }
