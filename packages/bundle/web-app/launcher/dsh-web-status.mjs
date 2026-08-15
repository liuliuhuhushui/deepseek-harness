// dsh Web launcher status server: serves dsh-web-status.json on 127.0.0.1:3199
// with CORS enabled, so the waiting page (file:// or any tab) can poll real progress.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const statusFile = join(dir, 'dsh-web-status.json')

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  try {
    res.end(await readFile(statusFile, 'utf8'))
  } catch {
    res.end(JSON.stringify({ stage: 'booting', text: 'Starting…' }))
  }
}).listen(3199, '127.0.0.1')
