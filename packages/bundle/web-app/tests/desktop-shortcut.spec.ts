/**
 * Desktop-shortcut installer: ICO wrapping, platform refusal, and the
 * side-effect sequence, over a fake IO seam. The launcher assets themselves
 * are read from the real `launcher/` directory next to `src/`.
 */

import { describe, expect, it } from 'vitest'
import { buildIco, installDesktopShortcut, type ShortcutIo } from '../src/desktop-shortcut.ts'

/** The checkout root baked into the launcher's server command. */
const REPO = 'D:\\src\\deepseek-harness'

/** Fake side effects: record every write and shell-out. */
function fakeIo(runResult: { status: number | null; stdout: string; stderr: string }): ShortcutIo & {
  writes: Map<string, string | Buffer>
  runs: string[]
} {
  const writes = new Map<string, string | Buffer>()
  const runs: string[] = []
  return {
    writes,
    runs,
    mkdir: () => {},
    writeFile: (path, data) => { writes.set(path, data) },
    run: (command, args) => {
      runs.push([command, ...args].join(' '))
      return runResult
    },
  }
}

const env = { platform: 'win32', home: 'C:\\Users\\whale\\.dsh', repoRoot: REPO }

describe('buildIco', () => {
  it('wraps a PNG in a minimal 256px ICO container', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
    const ico = buildIco(png)
    expect(ico.readUInt16LE(0)).toBe(0) // reserved
    expect(ico.readUInt16LE(2)).toBe(1) // icon type
    expect(ico.readUInt16LE(4)).toBe(1) // one image
    expect(ico.readUInt8(6)).toBe(0) // 0 encodes 256px
    expect(ico.readUInt16LE(12)).toBe(32) // 32bpp
    expect(ico.readUInt32LE(14)).toBe(png.length)
    expect(ico.readUInt32LE(18)).toBe(22)
    expect(ico.subarray(22)).toEqual(png)
  })
})

describe('installDesktopShortcut', () => {
  it('refuses non-Windows platforms before touching anything', () => {
    const io = fakeIo({ status: 0, stdout: '', stderr: '' })
    const result = installDesktopShortcut({ ...env, platform: 'linux' }, io)
    expect(result).toEqual({ ok: false, reason: '--install-shortcut is only supported on Windows (this is linux)' })
    expect(io.writes.size).toBe(0)
    expect(io.runs).toEqual([])
  })

  it('copies the launcher bundle, bakes the checkout root, and creates the shortcut', () => {
    const io = fakeIo({ status: 0, stdout: 'C:\\Users\\whale\\Desktop\\dsh Web.lnk\n', stderr: '' })
    const result = installDesktopShortcut(env, io)
    expect(result).toEqual({
      ok: true,
      shortcut: 'C:\\Users\\whale\\Desktop\\dsh Web.lnk',
      dir: 'C:\\Users\\whale\\.dsh\\web-app',
    })
    const names = [...io.writes.keys()].map(path => path.replace('C:\\Users\\whale\\.dsh\\web-app\\', ''))
    expect(names.sort()).toEqual([
      'dsh-web-install-shortcut.ps1',
      'dsh-web-launching.html',
      'dsh-web-status.mjs',
      'dsh-web.ico',
      'dsh-web.ps1',
      'dsh-web.vbs',
    ])
    const launcher = io.writes.get('C:\\Users\\whale\\.dsh\\web-app\\dsh-web.ps1') as string
    expect(launcher).toContain(REPO)
    expect(launcher).not.toContain('__REPO__')
    const ico = io.writes.get('C:\\Users\\whale\\.dsh\\web-app\\dsh-web.ico') as Buffer
    expect(ico.readUInt32LE(18)).toBe(22)
    expect(ico.readUInt8(22)).toBe(0x89) // PNG magic
    expect(io.runs).toHaveLength(1)
    expect(io.runs[0]).toContain('powershell')
    expect(io.runs[0]).toContain('dsh-web-install-shortcut.ps1')
  })

  it('reports the powershell failure instead of claiming success', () => {
    const io = fakeIo({ status: 1, stdout: '', stderr: 'execution policy blocked' })
    const result = installDesktopShortcut(env, io)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('execution policy blocked')
  })
})
