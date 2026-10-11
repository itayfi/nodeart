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

test("Mistral sends native FIM context directly without persisting keys or code", async (t) => {
  const { client, worker, state } = loadedClient()
  t.after(() => client.stop())
  let calls = 0
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      calls++
      assert.equal(url, "https://api.mistral.ai/v1/fim/completions")
      assert.equal(options.credentials, "omit")
      assert.equal(
        (options.headers as Record<string, string>).Authorization,
        "Bearer secret-test-key"
      )
      const body = JSON.parse(options.body as string)
      assert.equal(body.model, "codestral-latest")
      assert.ok(body.prompt.endsWith("float noise(vec2 p) { return "))
      assert.equal(body.suffix, "\n}")
      assert.ok(!body.prompt.includes("<|fim_"))
      assert.equal(body.max_tokens, 64)
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "dot(p, p);\n}" } }] })
      )
    }
  )
  client.enableMistral(" secret-test-key ")
  assert.equal(calls, 0)
  assert.equal(worker.terminated, true)
  assert.equal(state().loaded?.device, "mistral")
  assert.equal(
    await client.complete(
      "float noise(vec2 p) { return ",
      "\n}",
      "uniform float uTime;",
      "GLSL"
    ),
    "dot(p, p);"
  )
  assert.equal(state().phase, "ready")
  const saved = JSON.stringify([...storage])
  assert.ok(!saved.includes("secret-test-key"))
  assert.ok(!saved.includes("float noise"))
})

test("Mistral errors are actionable without echoing provider response data", async (t) => {
  const { client, state } = loadedClient()
  t.after(() => client.stop())
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response("secret-test-key and private shader", { status: 401 })
  )
  client.enableMistral("secret-test-key")
  assert.equal(await client.complete("private shader", "", "", "GLSL"), "")
  assert.match(state().detail, /API key was rejected/)
  assert.ok(!state().detail.includes("secret-test-key"))
})

test("disabling Mistral aborts the request and a late response cannot overwrite a new local session", async (t) => {
  const { client, state } = loadedClient()
  t.after(() => client.stop())
  let finish!: (response: Response) => void
  let signal: AbortSignal | undefined
  t.mock.method(globalThis, "fetch", (_url: string, options: RequestInit) => {
    signal = options.signal as AbortSignal
    return new Promise<Response>((resolve) => {
      finish = resolve
    })
  })
  client.enableMistral("key")
  const pending = client.complete("prefix", "suffix", "", "GLSL")
  client.load("0.5B", "wasm")
  assert.equal(signal?.aborted, true)
  finish(
    new Response(
      JSON.stringify({ choices: [{ message: { content: "stale" } }] })
    )
  )
  assert.equal(await pending, "")
  assert.equal(state().phase, "loading")
  assert.equal(state().loaded?.device, "wasm")
})

test("Mistral has a bounded timeout and reports it visibly", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const { client, state } = loadedClient()
  t.after(() => client.stop())
  t.mock.method(
    globalThis,
    "fetch",
    (_url: string, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal!.addEventListener(
          "abort",
          () => reject(new Error("abort")),
          { once: true }
        )
      })
  )
  client.enableMistral("key")
  const pending = client.complete("prefix", "suffix", "", "GLSL")
  t.mock.timers.tick(30000)
  assert.equal(await pending, "")
  assert.match(state().detail, /timed out after 30 seconds/)
})

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
