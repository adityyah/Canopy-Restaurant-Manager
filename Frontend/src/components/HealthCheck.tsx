// frontend/src/components/HealthCheck.tsx
// =============================================================================
// HealthCheck — Backend Connection Test Component
// =============================================================================
// Pings GET /health on the FastAPI backend and displays the response.
// This is a Phase 4 DIAGNOSTIC tool — it proves the Axios client, Vite proxy,
// and backend are all wired together correctly.
//
// Mount it temporarily in App.tsx.  Remove it (or hide it behind a flag) once
// Phase 4 is confirmed working.
//
// The /health route on the FastAPI backend returns:
//   { "status": "ok", "version": "...", "timestamp": "..." }
// =============================================================================

import { useEffect, useState } from 'react'
import { api } from '@/api/client'

// Shape of the FastAPI /health response
interface HealthResponse {
  status: string
  version: string
  timestamp: string
}

type ConnectionState = 'idle' | 'loading' | 'success' | 'error'

export default function HealthCheck() {
  const [state, setState] = useState<ConnectionState>('idle')
  const [data, setData] = useState<HealthResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')

  const ping = async () => {
    setState('loading')
    setErrorMsg('')
    try {
      // Calls GET /api/health → Vite proxy → http://localhost:8000/health
      const response = await api.get<HealthResponse>('/health')
      setData(response)
      setState('success')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error — is the backend running?'
      setErrorMsg(message)
      setState('error')
    }
  }

  // Auto-ping once on mount so the dev immediately sees the connection state
  useEffect(() => {
    void ping()
  }, [])

  return (
    <div className="card p-5 max-w-sm w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text-heading">
          Backend Connection
        </h2>
        {/* Status dot */}
        <span
          className={[
            'w-2.5 h-2.5 rounded-full',
            state === 'loading' ? 'bg-warning-yellow animate-pulse' : '',
            state === 'success' ? 'bg-accent-green' : '',
            state === 'error'   ? 'bg-danger-red'   : '',
            state === 'idle'    ? 'bg-bg-border'     : '',
          ].join(' ')}
        />
      </div>

      {/* Body */}
      {state === 'loading' && (
        <p className="text-text-muted text-xs">Pinging <code className="text-accent-teal">GET /health</code>…</p>
      )}

      {state === 'success' && data && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Status</span>
            <span className="text-accent-green font-semibold uppercase">{data.status}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Version</span>
            <span className="text-text-primary font-mono">{data.version}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">Server time</span>
            <span className="text-text-primary font-mono">
              {new Date(data.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="space-y-2">
          <p className="text-danger-red text-xs font-semibold">Connection failed</p>
          <p className="text-text-muted text-xs break-all">{errorMsg}</p>
          <p className="text-text-muted text-xs">
            Make sure the FastAPI server is running:{' '}
            <code className="text-accent-teal">uvicorn app.main:app --reload</code>
          </p>
        </div>
      )}

      {/* Retry button */}
      {state !== 'loading' && (
        <button
          onClick={() => void ping()}
          className="btn-ghost mt-4 w-full text-xs"
        >
          {state === 'error' ? 'Retry' : 'Ping again'}
        </button>
      )}
    </div>
  )
}
