export type AIModel = "0.5B" | "1.5B"
export type AIDevice = "webgpu" | "wasm"
export type AIState = {
  phase: "off" | "loading" | "ready" | "generating" | "error"
  detail: string
  loaded?: { model: AIModel; device: AIDevice }
}
type Request = {
  resolve: (value: string) => void
  timer: ReturnType<typeof setTimeout>
}
class LocalCompletion {
  private worker?: Worker
  private requests = new Map<number, Request>()
  private id = 0
  private state: AIState = { phase: "off", detail: "No model loaded" }
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
    this.listeners.forEach((l) => l(state))
  }
  load(model: AIModel, device: AIDevice) {
    this.stop()
    const loaded = { model, device }
    this.update({
      phase: "loading",
      detail: "Loading selected model (q4)…",
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
            localStorage.setItem(`nodeart-ai-cached-${model}-q4`, "true")
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
          if (request) {
            clearTimeout(request.timer)
            request.resolve(message.text)
            this.requests.delete(message.id)
          }
          this.update({
            phase: "ready",
            detail: "Ready · inference stays on this device",
            loaded,
          })
        }
        if (message.type === "error") this.fail(message.error, loaded)
      }
      worker.onerror = (event) =>
        this.fail(
          event.message || "AI worker failed. Try WASM or the smaller model.",
          loaded
        )
      worker.postMessage({ type: "load", model, device })
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
    this.update({ ...this.state, phase: "generating", detail: "Suggesting…" })
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.fail(
          "Completion timed out. Reload or try the smaller model.",
          this.state.loaded
        )
      }, 90000)
      this.requests.set(id, { resolve, timer })
      this.worker!.postMessage({
        type: "complete",
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
