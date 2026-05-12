/// <reference types="vitest/config" />
import { spawn } from 'node:child_process'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [localOcrModelInstallerPlugin(), vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
      '^/ocr(?:/|$)': {
        target: process.env.VITE_OCR_API_TARGET ?? process.env.VITE_API_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
})

type OcrInstallEngine = 'pp-ocrv5' | 'paddleocr-vl'
type OcrInstallStatus = 'idle' | 'running' | 'succeeded' | 'failed'

interface OcrInstallJob {
  status: OcrInstallStatus
  running: boolean
  engine: OcrInstallEngine | null
  startedAt: string | null
  finishedAt: string | null
  exitCode: number | null
  output: string[]
  error: string
}

const OCR_INSTALL_OUTPUT_LIMIT = 120
const OCR_INSTALL_ENGINES = new Set<OcrInstallEngine>(['pp-ocrv5', 'paddleocr-vl'])

function localOcrModelInstallerPlugin(): Plugin {
  const job: OcrInstallJob = {
    status: 'idle',
    running: false,
    engine: null,
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    output: [],
    error: '',
  }

  return {
    name: 'local-ocr-model-installer',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost')

        if (url.pathname === '/ocr/install-models/status') {
          if (request.method !== 'GET') {
            sendJson(response, 405, { detail: 'Method not allowed' })
            return
          }
          sendJson(response, 200, installSnapshot(job))
          return
        }

        if (url.pathname !== '/ocr/install-models') {
          next()
          return
        }

        if (request.method !== 'POST') {
          sendJson(response, 405, { detail: 'Method not allowed' })
          return
        }

        const requestedEngine = url.searchParams.get('engine') ?? 'pp-ocrv5'
        if (!isOcrInstallEngine(requestedEngine)) {
          sendJson(response, 400, { detail: `Unsupported OCR engine: ${requestedEngine}` })
          return
        }

        if (!job.running) {
          startLocalOcrModelInstall(job, requestedEngine)
        }
        sendJson(response, 202, installSnapshot(job))
      })
    },
  }
}

function isOcrInstallEngine(value: string): value is OcrInstallEngine {
  return OCR_INSTALL_ENGINES.has(value as OcrInstallEngine)
}

function startLocalOcrModelInstall(job: OcrInstallJob, engine: OcrInstallEngine): void {
  job.status = 'running'
  job.running = true
  job.engine = engine
  job.startedAt = new Date().toISOString()
  job.finishedAt = null
  job.exitCode = null
  job.output = [`Starting local OCR model install for ${engine}.`]
  job.error = ''

  const child = spawn(
    process.env.PYTHON ?? 'python3',
    ['scripts/ocr-service/install_models.py', '--engine', engine],
    {
      cwd: __dirname,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let finalized = false

  child.stdout.on('data', (chunk: Buffer) => appendInstallOutput(job, chunk.toString('utf8')))
  child.stderr.on('data', (chunk: Buffer) => appendInstallOutput(job, chunk.toString('utf8')))
  child.on('error', (error) => {
    if (finalized) return
    finalized = true
    job.status = 'failed'
    job.running = false
    job.finishedAt = new Date().toISOString()
    job.exitCode = null
    job.error = error.message
    appendInstallOutput(job, `Install failed: ${error.message}`)
  })
  child.on('close', (exitCode) => {
    if (finalized) return
    finalized = true
    job.status = exitCode === 0 ? 'succeeded' : 'failed'
    job.running = false
    job.finishedAt = new Date().toISOString()
    job.exitCode = exitCode
    if (exitCode === 0) {
      appendInstallOutput(job, 'Local OCR model install completed.')
    } else {
      job.error = `Install process exited with code ${exitCode}.`
    }
  })
}

function appendInstallOutput(job: OcrInstallJob, output: string): void {
  const lines = output.split(/\r?\n/).filter(Boolean)
  job.output.push(...lines)
  if (job.output.length > OCR_INSTALL_OUTPUT_LIMIT) {
    job.output = job.output.slice(-OCR_INSTALL_OUTPUT_LIMIT)
  }
}

function installSnapshot(job: OcrInstallJob): Record<string, unknown> {
  return {
    status: job.status,
    running: job.running,
    engine: job.engine,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    exitCode: job.exitCode,
    error: job.error,
    outputTail: job.output.slice(-OCR_INSTALL_OUTPUT_LIMIT).join('\n'),
  }
}

function sendJson(response: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }, status: number, payload: unknown): void {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}
