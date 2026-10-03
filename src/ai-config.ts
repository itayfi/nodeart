export type AIModel = "0.5B" | "1.5B"
export type AIDevice = "webgpu" | "wasm"

export function aiModelConfig(model: AIModel, device: AIDevice) {
  const dtype = device === "wasm" ? "q8" : "q4f16"
  const repo =
    model === "0.5B"
      ? "onnx-community/Qwen2.5-Coder-0.5B-ONNX"
      : "onnx-community/Qwen2.5-Coder-1.5B"
  const file = `onnx/model_${dtype === "q8" ? "quantized" : dtype}.onnx`
  const bytes =
    model === "0.5B"
      ? dtype === "q8"
        ? 502904549
        : 478028810
      : dtype === "q8"
        ? 1578954293
        : 1221878940
  return {
    repo,
    dtype,
    file,
    bytes,
    url: `https://huggingface.co/${repo}/resolve/main/${file}`,
    cacheKey: `nodeart-ai-cached-base-${model}-${dtype}`,
  } as const
}

export function isMobileDevice(device: {
  userAgent: string
  maxTouchPoints: number
}) {
  return (
    /Android|iPhone|iPad|iPod/i.test(device.userAgent) ||
    (/Macintosh/i.test(device.userAgent) && device.maxTouchPoints > 1)
  )
}
