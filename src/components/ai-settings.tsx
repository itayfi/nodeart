import { useEffect, useState } from "react"
import { Sparkles, Download, Square } from "lucide-react"
import { Button } from "./ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select"
import { Checkbox } from "./ui/checkbox"
import {
  localCompletion,
  type AIState,
  type AIModel,
  type AIDevice,
} from "../ai"
import { aiModelConfig } from "../ai-config"
function preference(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* Preferences are optional. */
  }
}

export function AISettings({
  state,
  automatic,
  onAutomatic,
}: {
  state: AIState
  automatic: boolean
  onAutomatic: (enabled: boolean) => void
}) {
  const [open, setOpen] = useState(false),
    [model, setModel] = useState<AIModel>(() =>
      preference("nodeart-ai-model", "0.5B") === "1.5B" ? "1.5B" : "0.5B"
    ),
    [device, setDevice] = useState<AIDevice>(() =>
      preference("nodeart-ai-device", "wasm") === "webgpu" ? "webgpu" : "wasm"
    )
  const [gpu, setGpu] = useState<"checking" | "available" | "unavailable">(
    "checking"
  )
  const [cacheRevision, setCacheRevision] = useState(0),
    [cacheError, setCacheError] = useState("")
  useEffect(() => {
    const gpuAPI = (
      navigator as Navigator & {
        gpu?: {
          requestAdapter: (options: {
            powerPreference: "high-performance"
          }) => Promise<{
            features: { has: (feature: string) => boolean }
          } | null>
        }
      }
    ).gpu
    let active = true
    void (
      gpuAPI?.requestAdapter({ powerPreference: "high-performance" }) ??
      Promise.resolve(null)
    )
      .then((adapter) => {
        if (active) {
          const available = adapter?.features.has("shader-f16") ?? false
          setGpu(available ? "available" : "unavailable")
          if (available && !preference("nodeart-ai-device", ""))
            setDevice("webgpu")
          if (!available) setDevice("wasm")
        }
      })
      .catch(() => {
        if (active) setGpu("unavailable")
      })
    return () => {
      active = false
    }
  }, [])
  let cached = false
  const config = aiModelConfig(model, device)
  try {
    cached = localStorage.getItem(config.cacheKey) === "true"
  } catch {
    /* Optional cache hint. */
  }
  void cacheRevision
  const loading = state.phase === "loading",
    loaded = state.phase === "ready" || state.phase === "generating"
  const same = state.loaded?.model === model && state.loaded.device === device
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        data-cuelume-tap="open"
        onClick={() => setOpen(true)}
      >
        <Sparkles />
        AI completion{loaded ? " · on" : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogTitle>AI completion</DialogTitle>
          <DialogDescription>
            Qwen 2.5 Coder base runs locally. Model files download only when you
            press the button below. Your code stays on this device.
          </DialogDescription>
          <label className="grid gap-2">
            Model
            <Select
              value={model}
              onValueChange={(v) => {
                if (v) {
                  setModel(v as AIModel)
                  remember("nodeart-ai-model", v)
                }
              }}
            >
              <SelectTrigger aria-label="AI model">
                <SelectValue>Qwen 2.5 Coder · {model}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5B" data-cuelume-tap="select">
                  Qwen 2.5 Coder · 0.5B
                </SelectItem>
                <SelectItem value="1.5B" data-cuelume-tap="select">
                  Qwen 2.5 Coder · 1.5B
                </SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-2">
            Run on
            <Select
              value={device}
              onValueChange={(v) => {
                if (v) {
                  setDevice(v as AIDevice)
                  remember("nodeart-ai-device", v)
                }
              }}
            >
              <SelectTrigger aria-label="AI execution backend">
                <SelectValue>
                  {device === "webgpu" ? "WebGPU · GPU" : "WASM · CPU"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="webgpu"
                  disabled={gpu !== "available"}
                  data-cuelume-tap="select"
                >
                  WebGPU · GPU
                </SelectItem>
                <SelectItem value="wasm" data-cuelume-tap="select">
                  WASM · CPU
                </SelectItem>
              </SelectContent>
            </Select>
          </label>
          <p className="text-sm">
            {gpu === "available"
              ? "WebGPU available. Large models can still exceed mobile browser memory. WebGPU shares your GPU with the artwork."
              : gpu === "checking"
                ? "Checking WebGPU…"
                : "WebGPU with float16 is unavailable in this browser. Use WASM."}
          </p>
          <p className="text-sm">
            {config.dtype === "q8"
              ? "8-bit weights (q8)"
              : "4-bit weights + float16 (q4f16)"}{" "}
            · approximately {(config.bytes / 1e9).toFixed(2)} GB, plus
            supporting files.{" "}
            {cached
              ? "Previously loaded; cached files will be reused if still available."
              : "Not yet loaded."}
          </p>
          {device === "wasm" && (
            <p className="text-sm">
              CPU suggestions use a shorter context and up to 24 new tokens,
              with a 30-second limit.
            </p>
          )}
          <p className="text-sm break-words" role="status">
            {state.detail}
          </p>
          {loaded && state.loaded && (
            <p className="text-sm">
              Loaded: Qwen {state.loaded.model} ·{" "}
              {state.loaded.device === "webgpu" ? "WebGPU (GPU)" : "WASM (CPU)"}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={loading || (loaded && same)}
              data-cuelume-tap="tap"
              onClick={() => localCompletion.load(model, device)}
            >
              <Download />
              {loaded && !same
                ? "Apply"
                : cached
                  ? "Load & enable"
                  : "Download & enable"}
            </Button>
            {(loading || loaded) && (
              <Button
                variant="secondary"
                data-cuelume-tap="tap"
                onClick={() => localCompletion.stop()}
              >
                <Square />
                {loading ? "Cancel" : "Disable & unload"}
              </Button>
            )}
          </div>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={automatic}
              data-cuelume-tap="toggle"
              onCheckedChange={(value) => onAutomatic(value === true)}
            />
            Automatic suggestions after a typing pause
          </label>
          <p className="text-sm">
            Use Suggest or Alt+Enter for a completion. Tab accepts; Escape
            dismisses. Switching configurations never downloads until Apply.
          </p>
          <Button
            variant="secondary"
            data-cuelume-tap="tap"
            onClick={async () => {
              localCompletion.stop()
              try {
                await caches.delete("nodeart-ai")
                for (const m of ["0.5B", "1.5B"]) {
                  localStorage.removeItem(`nodeart-ai-cached-base-${m}-q4`)
                  localStorage.removeItem(`nodeart-ai-cached-base-${m}-q4f16`)
                  localStorage.removeItem(`nodeart-ai-cached-base-${m}-q8`)
                  // Clear hints from the previous Instruct models too.
                  localStorage.removeItem(`nodeart-ai-cached-${m}-q4`)
                }
                setCacheRevision((v) => v + 1)
                setCacheError("Cached models removed.")
              } catch {
                setCacheError("Unable to remove cache in this browser.")
              }
            }}
          >
            Remove cached models
          </Button>
          {cacheError && <p role="status">{cacheError}</p>}
        </DialogContent>
      </Dialog>
    </>
  )
}
