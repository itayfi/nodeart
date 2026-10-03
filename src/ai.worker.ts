import {
  env,
  pipeline,
  type TextGenerationPipeline,
} from "@huggingface/transformers"
import { cleanCompletion } from "./completion-text"

let generator: TextGenerationPipeline | undefined
let busy = false
self.onmessage = async (event: MessageEvent) => {
  const message = event.data as {
    type: string
    model: "0.5B" | "1.5B"
    device: "wasm" | "webgpu"
    id: number
    prefix: string
    suffix: string
    api: string
    language: string
  }
  try {
    if (message.type === "load") {
      env.allowLocalModels = false
      env.useBrowserCache = true
      if (typeof caches !== "undefined") {
        env.useCustomCache = true
        env.customCache = await caches.open("nodeart-ai")
      }
      generator = await pipeline(
        "text-generation",
        `onnx-community/Qwen2.5-Coder-${message.model}-Instruct`,
        {
          device: message.device,
          dtype: "q4",
          progress_callback: (progress) =>
            self.postMessage({ type: "progress", progress }),
        }
      )
      self.postMessage({ type: "ready" })
    }
    if (message.type === "complete" && generator && !busy) {
      busy = true
      // Qwen's fill-in-the-middle tokens describe the insertion precisely.
      // Chat prompting often causes small models to rewrite the whole shader.
      const api =
        message.language === "GLSL"
          ? message.api
          : message.api
              .split("\n")
              .map((line) => `// ${line}`)
              .join("\n")
      const prompt = `<|fim_prefix|>// ${message.language}\n${api}\n${message.prefix}<|fim_suffix|>${message.suffix}<|fim_middle|>`
      const stops = [
        "<|endoftext|>",
        "<|im_end|>",
        "<|fim_pad|>",
        "<|fim_suffix|>",
      ].flatMap((token) =>
        generator!.tokenizer.encode(token, { add_special_tokens: false })
      )
      const result = await generator(prompt, {
        max_new_tokens: 64,
        do_sample: false,
        return_full_text: false,
        eos_token_id: stops,
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
    self.postMessage({
      type: "error",
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
