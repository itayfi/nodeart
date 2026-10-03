import {
  aiModelConfig,
  isMobileDevice,
  type AIModel,
  type AIDevice,
} from "./ai-config.ts"
export type { AIModel, AIDevice } from "./ai-config.ts"
export type AIState = {
  phase: "off" | "loading" | "ready" | "generating" | "error"
  detail: string
  loaded?: { model: AIModel; device: AIDevice }
}
type Request = {
  resolve: (value: string) => void
  timer: ReturnType<typeof setTimeout>
  heartbeat: ReturnType<typeof setInterval>
  started: number
  tokens: number
  inputTokens?: number
}
const diagnosticKey = "nodeart-ai-last-status"
function initialState(): AIState {
  try {
    const last = JSON.parse(localStorage.getItem(diagnosticKey) ?? "null")
    if (last?.phase === "loading" || last?.phase === "generating") {
      return {
        phase: "error",
        detail: `Previous AI session was interrupted by a reload, closed tab, or browser crash. Last status: ${String(last.detail)}`,
      }
    }
    if (last?.phase === "error" && typeof last.detail === "string") {
      return { phase: "error", detail: last.detail }
    }
  } catch {
    /* Diagnostic storage is optional. */
  }
  return { phase: "off", detail: "No model loaded" }
}
export class LocalCompletion {
  private gpuInfo: unknown
  private worker?: Worker
  private requests = new Map<number, Request>()
  private id = 0
  private state: AIState = initialState()
  private listeners = new Set<(state: AIState) => void>()
  subscribe(listener: (state: AIState) => void) {
    this.listeners.add(listener)
    listener(this.state)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private update(state: AIState) {
    this.state = state
    try {
      localStorage.setItem(
        diagnosticKey,
        JSON.stringify({
          ...state,
          gpu: this.gpuInfo,
          updatedAt: new Date().toISOString(),
        })
      )
    } catch {
      /* Diagnostic storage is optional. */
    }
    this.listeners.forEach((l) => l(state))
  }
  diagnosticReport() {
    let lastStatus: unknown
    try {
      lastStatus = JSON.parse(localStorage.getItem(diagnosticKey) ?? "null")
    } catch {
      /* Optional storage. */
    }
    return JSON.stringify(
      {
        browser: navigator.userAgent,
        state: this.state,
        gpu: this.gpuInfo,
        lastStatus,
      },
      null,
      2
    )
  }
  private generationStatus(id: number) {
    const request = this.requests.get(id)
    if (!request) return
    const seconds = Math.floor((performance.now() - request.started) / 1000)
    const context = request.inputTokens
      ? ` · ${request.inputTokens} input tokens`
      : ""
    this.update({
      ...this.state,
      phase: "generating",
      detail: request.tokens
        ? `Generating suggestion… ${request.tokens} output tokens · ${seconds}s${context}`
        : `Waiting for first token… ${seconds}s${context}`,
    })
  }
  load(model: AIModel, device: AIDevice) {
    this.stop()
    this.gpuInfo = undefined
    const loaded = { model, device }
    this.update({
      phase: "loading",
      detail: `Loading selected model (${aiModelConfig(model, device).dtype})…`,
      loaded,
    })
    try {
      const worker = new Worker(new URL("./ai.worker.ts", import.meta.url), {
        type: "module",
      })
      this.worker = worker
      worker.onmessage = (event) => {
        if (this.worker !== worker) return
        const message = event.data
        if (message.type === "gpu-info") {
          this.gpuInfo = message.gpu
          this.update({ ...this.state })
        }
        if (message.type === "stage") {
          this.update({ phase: "loading", detail: message.detail, loaded })
        }
        if (
          message.type === "generation-start" ||
          message.type === "generation-progress"
        ) {
          const request = this.requests.get(message.id)
          if (request) {
            if (message.type === "generation-start")
              request.inputTokens = message.inputTokens
            else request.tokens = message.tokens
            this.generationStatus(message.id)
          }
        }
        if (message.type === "progress") {
          const p = message.progress
          this.update({
            phase: "loading",
            detail:
              p.status === "progress"
                ? `${p.file}: ${Math.round(p.progress ?? 0)}% · ${Math.round((p.loaded ?? 0) / 1048576)} / ${Math.round((p.total ?? 0) / 1048576)} MB`
                : `${p.status}: ${p.file ?? "Preparing model"}`,
            loaded,
          })
        }
        if (message.type === "ready") {
          try {
            localStorage.setItem(aiModelConfig(model, device).cacheKey, "true")
          } catch {
            /* Cache hint is optional. */
          }
          this.update({
            phase: "ready",
            detail: "Ready · inference stays on this device",
            loaded,
          })
        }
        if (message.type === "completion") {
          const request = this.requests.get(message.id)
          if (!request) return
          clearTimeout(request.timer)
          clearInterval(request.heartbeat)
          request.resolve(message.text)
          this.requests.delete(message.id)
          const seconds = (
            (performance.now() - request.started) /
            1000
          ).toFixed(1)
          this.update({
            phase: "ready",
            detail: message.text
              ? `Suggestion finished in ${seconds}s · ${request.tokens} output tokens`
              : `Model returned no insertable suggestion after ${seconds}s · ${request.tokens} output tokens`,
            loaded,
          })
        }
        if (message.type === "error") this.fail(message.error, loaded)
      }
      worker.onerror = (event) => {
        if (this.worker !== worker) return
        this.fail(
          event.message || "AI worker failed. Try WASM or the smaller model.",
          loaded
        )
      }
      worker.onmessageerror = () => {
        if (this.worker === worker)
          this.fail("Unable to receive a message from the AI worker.", loaded)
      }
      // WorkerNavigator does not expose maxTouchPoints, which is needed to
      // recognize iPads that send a desktop Macintosh user agent.
      worker.postMessage({
        type: "load",
        model,
        device,
        mobile: isMobileDevice(navigator),
      })
    } catch (error) {
      this.fail(String(error), loaded)
    }
  }
  private fail(detail: string, loaded: AIState["loaded"]) {
    this.stop()
    this.update({ phase: "error", detail, loaded })
  }
  stop() {
    this.worker?.terminate()
    this.worker = undefined
    this.requests.forEach((r) => {
      clearTimeout(r.timer)
      clearInterval(r.heartbeat)
      r.resolve("")
    })
    this.requests.clear()
    this.update({ phase: "off", detail: "No model loaded" })
  }
  complete(
    prefix: string,
    suffix: string,
    api: string,
    language: string
  ): Promise<string> {
    if (this.state.phase !== "ready" || !this.worker) return Promise.resolve("")
    const id = ++this.id
    const device = this.state.loaded!.device
    this.update({ ...this.state, phase: "generating", detail: "Suggesting…" })
    return new Promise((resolve) => {
      const timer = setTimeout(
        () => {
          this.fail(
            `Completion timed out. Last status: ${this.state.detail}`,
            this.state.loaded
          )
        },
        device === "wasm" ? 30000 : 90000
      )
      const heartbeat = setInterval(() => this.generationStatus(id), 1000)
      this.requests.set(id, {
        resolve,
        timer,
        heartbeat,
        started: performance.now(),
        tokens: 0,
      })
      this.generationStatus(id)
      this.worker!.postMessage({
        type: "complete",
        device,
        id,
        prefix: prefix.slice(-6000),
        suffix: suffix.slice(0, 1500),
        api,
        language,
      })
    })
  }
}
export const localCompletion = new LocalCompletion()
if (import.meta.hot) import.meta.hot.dispose(() => localCompletion.stop())
