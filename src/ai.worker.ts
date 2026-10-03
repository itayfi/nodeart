import {
  env,
  pipeline,
  TextStreamer,
  type TextGenerationPipeline,
} from "@huggingface/transformers"
import { cleanCompletion } from "./completion-text"
import { aiModelConfig } from "./ai-config"
import { primeModelCache } from "./ai-model-cache"
import { completionPrompt } from "./completion-prompt"

// Configure ONNX before creating any session. Inference already runs in this
// app's worker, so an additional WASM proxy worker is unnecessary.
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.proxy = false
  env.backends.onnx.wasm.numThreads = 1
}
// This is an adapter hint; the browser/OS still chooses the actual GPU.
if (env.backends.onnx.webgpu) {
  env.backends.onnx.webgpu.powerPreference = "high-performance"
}

let generator: TextGenerationPipeline | undefined
let gpuDevice: GPUDevice | undefined
let busy = false
self.onmessage = async (event: MessageEvent) => {
  const message = event.data as {
    type: string
    model: "0.5B" | "1.5B"
    device: "wasm" | "webgpu"
    mobile: boolean
    id: number
    prefix: string
    suffix: string
    api: string
    language: string
  }
  try {
    if (message.type === "load") {
      const config = aiModelConfig(message.model, message.device)
      if (message.device === "webgpu") {
        const adapter = await navigator.gpu?.requestAdapter({
          powerPreference: "high-performance",
        })
        if (!adapter) throw new Error("WebGPU is unavailable. Choose WASM.")
        if (!adapter.features.has("shader-f16")) {
          throw new Error("This GPU does not support float16. Choose WASM.")
        }
        // The large embedding tensor needs more than WebGPU's default device
        // limits. Request the adapter's supported limits, without allocating
        // buffers here. Supplying this device also preserves GPU selection.
        gpuDevice = await adapter.requestDevice({
          requiredFeatures: [
            "shader-f16",
            ...(adapter.features.has("subgroups")
              ? ["subgroups" as const]
              : []),
          ],
          requiredLimits: {
            maxBufferSize: adapter.limits.maxBufferSize,
            maxStorageBufferBindingSize:
              adapter.limits.maxStorageBufferBindingSize,
            maxComputeWorkgroupStorageSize:
              adapter.limits.maxComputeWorkgroupStorageSize,
            maxComputeInvocationsPerWorkgroup:
              adapter.limits.maxComputeInvocationsPerWorkgroup,
            maxComputeWorkgroupSizeX: adapter.limits.maxComputeWorkgroupSizeX,
            maxComputeWorkgroupSizeY: adapter.limits.maxComputeWorkgroupSizeY,
            maxComputeWorkgroupSizeZ: adapter.limits.maxComputeWorkgroupSizeZ,
          },
        })
        gpuDevice.lost.then((info) => {
          if (info.reason !== "destroyed")
            self.postMessage({
              type: "error",
              error: `GPU device lost: ${info.message || "browser memory or driver failure"}`,
            })
        })
      }
      env.allowLocalModels = false
      env.useBrowserCache = typeof caches !== "undefined"
      if (typeof caches !== "undefined") {
        env.useCustomCache = true
        const cache = await caches.open("nodeart-ai")
        env.customCache = cache
        await primeModelCache(
          cache,
          config.url,
          config.bytes,
          (loaded, total) =>
            self.postMessage({
              type: "progress",
              progress: {
                status: "progress",
                file: config.file,
                loaded,
                total,
                progress: (loaded / total) * 100,
              },
            })
        )
      }
      self.postMessage({ type: "stage", detail: "Preparing model session…" })
      generator = await pipeline("text-generation", config.repo, {
        device: message.device,
        // q4f16 reduces GPU floating-point tensors; q8 is smaller for WASM in
        // these repositories because it also quantizes the large embeddings.
        dtype: config.dtype,
        session_options: {
          executionProviders:
            message.device === "webgpu"
              ? [
                  {
                    name: "webgpu",
                    device: gpuDevice,
                    ...(message.mobile
                      ? {
                          storageBufferCacheMode: "disabled",
                        }
                      : {}),
                  },
                ]
              : ["wasm"],
          freeDimensionOverrides: { batch_size: 1 },
          // Keep sequence_length and KV-cache dimensions dynamic: overrides
          // fix input shapes, rather than setting initial buffer capacities.
          // preferredOutputChannelType is not an ONNX Runtime session option.
        },
        progress_callback: (progress) =>
          self.postMessage({ type: "progress", progress }),
      })
      self.postMessage({ type: "ready" })
    }
    if (message.type === "complete" && generator && !busy) {
      busy = true
      // Qwen's fill-in-the-middle tokens describe the insertion precisely.
      // Chat prompting often causes small models to rewrite the whole shader.
      const cpu = message.device === "wasm"
      const prompt = completionPrompt(
        generator.tokenizer,
        message.prefix,
        message.suffix,
        message.api,
        message.language,
        cpu
      )
      const stops = [
        "<|endoftext|>",
        "<|im_end|>",
        "<|fim_pad|>",
        "<|fim_suffix|>",
      ].flatMap((token) =>
        generator!.tokenizer.encode(token, { add_special_tokens: false })
      )
      let tokens = 0
      const started = performance.now()
      const result = await generator(prompt, {
        max_new_tokens: cpu ? 24 : 64,
        do_sample: false,
        return_full_text: false,
        eos_token_id: stops,
        streamer: new TextStreamer(generator.tokenizer, {
          skip_prompt: true,
          token_callback_function: () => {
            tokens += 1
            self.postMessage({
              type: "generation-progress",
              id: message.id,
              tokens,
              seconds: Math.round((performance.now() - started) / 1000),
            })
          },
          callback_function: () => {},
        }),
      })
      const output = result as unknown as {
        generated_text: string | { role: string; content: string }[]
      }[]
      const raw = output[0]?.generated_text
      const text = cleanCompletion(
        typeof raw === "string" ? raw : (raw?.at(-1)?.content ?? ""),
        message.suffix
      )
      self.postMessage({ type: "completion", id: message.id, text })
      busy = false
    }
  } catch (error) {
    busy = false
    if (message.type === "load") {
      gpuDevice?.destroy()
      gpuDevice = undefined
    }
    self.postMessage({
      type: "error",
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
