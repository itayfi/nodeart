type DiagnosticEvent = {
  session: string
  source: string
  sequence: number
  event: string
  clientTime: string
  elapsedMs: number
  data: unknown
}

export function heapMetrics() {
  const memory = (
    performance as Performance & {
      memory?: {
        usedJSHeapSize: number
        totalJSHeapSize: number
        jsHeapSizeLimit: number
      }
    }
  ).memory
  return memory
    ? {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      }
    : undefined
}

// Development only. Bound both the queue and concurrent uploads so diagnostics
// do not accumulate in the very tab whose memory use we are investigating.
export function diagnosticReporter(source: string, session: string) {
  const enabled = import.meta.env?.DEV === true
  const endpoint = `${import.meta.env?.BASE_URL ?? "/"}__ai-diagnostics/events`
  const started = performance.now()
  const queue: DiagnosticEvent[] = []
  const samples = new Map<string, number>()
  let sequence = 0
  let sending = false
  async function drain() {
    if (sending) return
    sending = true
    try {
      while (queue.length) {
        const event = queue.shift()!
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 3000)
        try {
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(event),
            keepalive: true,
            signal: controller.signal,
          })
        } catch {
          // Diagnostics must never interrupt loading or retry indefinitely.
        } finally {
          clearTimeout(timer)
        }
      }
    } finally {
      sending = false
    }
  }
  return {
    record(event: string, data: unknown, sample = false) {
      if (!enabled) return
      const now = performance.now()
      if (sample && now - (samples.get(event) ?? -Infinity) < 1000) return
      samples.set(event, now)
      if (queue.length >= 16) queue.shift()
      queue.push({
        session,
        source,
        sequence: ++sequence,
        event,
        clientTime: new Date().toISOString(),
        elapsedMs: Math.round(now - started),
        data,
      })
      void drain()
    },
  }
}

export const diagnosticSession =
  globalThis.crypto?.randomUUID?.() ?? `page-${Date.now()}`
export const pageDiagnostics = diagnosticReporter("page", diagnosticSession)

if (import.meta.env?.DEV && typeof window !== "undefined") {
  pageDiagnostics.record("page-start", {
    browser: navigator.userAgent,
    heap: heapMetrics(),
  })
  window.addEventListener("pagehide", () =>
    pageDiagnostics.record("pagehide", { heap: heapMetrics() })
  )
}
