import { test, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { LocalCompletion, type AIState } from "../src/ai.ts"

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage?: (event: { data: Record<string, unknown> }) => void
  onerror?: (event: { message: string }) => void
  onmessageerror?: () => void
  messages: Record<string, unknown>[] = []
  terminated = false
  constructor() {
    FakeWorker.instances.push(this)
  }
  postMessage(message: Record<string, unknown>) {
    this.messages.push(message)
  }
  terminate() {
    this.terminated = true
  }
  emit(data: Record<string, unknown>) {
    this.onmessage?.({ data })
  }
}
const originalWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker")
const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  "localStorage"
)
let storage: Map<string, string>
beforeEach(() => {
  storage = new Map()
  FakeWorker.instances = []
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: FakeWorker,
  })
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  })
})
afterEach(() => {
  if (originalWorker)
    Object.defineProperty(globalThis, "Worker", originalWorker)
  else Reflect.deleteProperty(globalThis, "Worker")
  if (originalStorage)
    Object.defineProperty(globalThis, "localStorage", originalStorage)
  else Reflect.deleteProperty(globalThis, "localStorage")
})
function loadedClient() {
  const client = new LocalCompletion()
  let state: AIState
  client.subscribe((next) => {
    state = next
  })
  client.load("0.5B", "webgpu")
  const worker = FakeWorker.instances.at(-1)!
  worker.emit({ type: "ready" })
  return { client, worker, state: () => state! }
}

test("silent generation times out with its last prefill status and releases the worker", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] })
  const { client, worker, state } = loadedClient()
  t.after(() => client.stop())
  const completion = client.complete("prefix", "suffix", "api", "GLSL")
  const id = worker.messages.at(-1)!.id
  worker.emit({ type: "generation-start", id, inputTokens: 417 })
  assert.match(state().detail, /Waiting for first token.*417 input tokens/)
  t.mock.timers.tick(90000)
  assert.equal(await completion, "")
  assert.equal(state().phase, "error")
  assert.match(state().detail, /timed out.*Waiting for first token.*417/)
  assert.equal(worker.terminated, true)
})

test("empty completions and worker failures remain distinguishable from successful suggestions", async (t) => {
  const { client, worker, state } = loadedClient()
  t.after(() => client.stop())
  const empty = client.complete("prefix", "suffix", "api", "GLSL")
  let id = worker.messages.at(-1)!.id
  worker.emit({ type: "generation-progress", id, tokens: 3 })
  worker.emit({ type: "completion", id, text: "" })
  assert.equal(await empty, "")
  assert.match(state().detail, /no insertable suggestion.*3 output tokens/)
  const failed = client.complete("prefix", "suffix", "api", "GLSL")
  id = worker.messages.at(-1)!.id
  worker.emit({ type: "error", id, error: "GPU validation failed" })
  assert.equal(await failed, "")
  assert.equal(state().detail, "GPU validation failed")
  assert.equal(state().phase, "error")
})

test("late errors from a replaced worker do not stop the new model", (t) => {
  const { client, worker, state } = loadedClient()
  t.after(() => client.stop())
  client.load("1.5B", "webgpu")
  const current = FakeWorker.instances.at(-1)!
  current.emit({ type: "ready" })
  worker.onerror?.({ message: "old GPU device lost" })
  worker.emit({ type: "error", error: "old worker failed" })
  assert.equal(state().phase, "ready")
  assert.equal(current.terminated, false)
})

test("interrupted runs survive reload with GPU diagnostics and no source code in the report", (t) => {
  const { client, worker } = loadedClient()
  t.after(() => client.stop())
  worker.emit({
    type: "gpu-info",
    gpu: { limits: { maxBufferSize: 268435456 } },
  })
  void client.complete(
    "PRIVATE_SOURCE",
    "PRIVATE_SUFFIX",
    "PRIVATE_API",
    "GLSL"
  )
  const reloaded = new LocalCompletion()
  let state: AIState
  reloaded.subscribe((next) => {
    state = next
  })
  assert.equal(state!.phase, "error")
  assert.match(state!.detail, /interrupted.*Waiting for first token/)
  const report = reloaded.diagnosticReport()
  assert.ok(report.includes("268435456"))
  assert.ok(!report.includes("PRIVATE_"))
})
