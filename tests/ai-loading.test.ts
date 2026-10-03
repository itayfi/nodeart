import { test } from "node:test"
import assert from "node:assert/strict"
import { primeModelCache } from "../src/ai-model-cache.ts"
import { completionPrompt } from "../src/completion-prompt.ts"
import { aiModelConfig, isMobileDevice } from "../src/ai-config.ts"

test("model caching consumes a network stream without materializing or cloning its Response", async () => {
  const bytes = Uint8Array.from([1, 2, 3, 4, 5])
  const network = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 2))
        controller.enqueue(bytes.slice(2))
        controller.close()
      },
    })
  )
  network.arrayBuffer = async () => {
    throw new Error("full network buffer copy")
  }
  network.clone = () => {
    throw new Error("network stream tee")
  }
  let saved: Uint8Array | undefined
  let savedLength: string | null = null
  const updates: number[] = []
  const url = "https://example.com/model.onnx"
  const cache: Pick<Cache, "match" | "put"> = {
    match: async () => undefined,
    put: async (key, response) => {
      assert.equal(key, url)
      savedLength = response.headers.get("content-length")
      saved = new Uint8Array(await response.arrayBuffer())
    },
  }
  await primeModelCache(
    cache,
    url,
    bytes.length,
    (loaded) => updates.push(loaded),
    async () => network
  )
  assert.deepEqual(saved, bytes)
  assert.equal(savedLength, "5")
  assert.equal(updates.at(-1), 5)
})

test("cached weights avoid a second download and release the unused response stream", async () => {
  let cancelled = false
  await primeModelCache(
    {
      match: async () =>
        new Response(
          new ReadableStream({
            cancel() {
              cancelled = true
            },
          })
        ),
      put: async () => assert.fail("cache hit should not write"),
    },
    "https://example.com/model.onnx",
    5,
    () => {},
    async () => {
      assert.fail("cache hit should not fetch")
    }
  )
  assert.equal(cancelled, true)
})

test("failed streaming storage stops before loading a model instead of retrying with a full buffer", async () => {
  await assert.rejects(
    primeModelCache(
      {
        match: async () => undefined,
        put: async () => {
          throw new Error("quota exceeded")
        },
      },
      "https://example.com/model.onnx",
      5,
      () => {},
      async () => new Response("model")
    ),
    /Free browser storage/
  )
})

test("CPU prompt trimming preserves FIM markers and the code at both sides of the cursor", () => {
  // Character tokens make truncation boundaries observable without a model download.
  const tokenizer = {
    encode: (text: string) => Array.from(text, (char) => char.codePointAt(0)!),
    decode: (tokens: number[]) => String.fromCodePoint(...tokens),
  }
  const prompt = completionPrompt(
    tokenizer,
    "old context ".repeat(1000) + "CURSOR_LEFT",
    "CURSOR_RIGHT" + "far context ".repeat(1000),
    "uniform float uTime;\n".repeat(1000),
    "GLSL",
    true
  )
  assert.ok(prompt.startsWith("<|fim_prefix|>// GLSL\n"))
  assert.ok(prompt.endsWith("<|fim_middle|>"))
  assert.ok(prompt.includes("CURSOR_LEFT<|fim_suffix|>CURSOR_RIGHT"))
  assert.ok(prompt.length < 500)
  assert.ok(!prompt.includes("old context ".repeat(30)))
})

test("CPU JavaScript prompts keep API hints in comments and GPU receives a larger context", () => {
  const tokenizer = {
    encode: (text: string) => Array.from(text, (char) => char.codePointAt(0)!),
    decode: (tokens: number[]) => String.fromCodePoint(...tokens),
  }
  const prefix = "let x = 1;\n".repeat(100)
  const cpu = completionPrompt(
    tokenizer,
    prefix,
    "}",
    "setup(p)\ndraw(p)",
    "p5.js JavaScript",
    true
  )
  const gpu = completionPrompt(
    tokenizer,
    prefix,
    "}",
    "setup(p)\ndraw(p)",
    "p5.js JavaScript",
    false
  )
  assert.ok(cpu.includes("// setup(p)\n// draw(p)"))
  assert.ok(gpu.length > cpu.length)
})

test("CPU and GPU exports have separate cache identities and iPad desktop UAs receive mobile memory policy", () => {
  const cpu = aiModelConfig("0.5B", "wasm")
  const gpu = aiModelConfig("0.5B", "webgpu")
  assert.notEqual(cpu.cacheKey, gpu.cacheKey)
  assert.ok(cpu.bytes < 777000000 && gpu.bytes < 777000000)
  assert.ok(!cpu.repo.includes("Instruct") && !gpu.repo.includes("Instruct"))
  assert.equal(
    isMobileDevice({
      userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 8)",
      maxTouchPoints: 5,
    }),
    true
  )
  assert.equal(
    isMobileDevice({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
      maxTouchPoints: 5,
    }),
    true
  )
  assert.equal(
    isMobileDevice({
      userAgent: "Mozilla/5.0 (Windows NT 10.0)",
      maxTouchPoints: 10,
    }),
    false
  )
})
