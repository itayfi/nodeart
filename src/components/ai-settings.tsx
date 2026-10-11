import { useEffect, useState } from "react"
import { Sparkles, Download, Square, KeyRound, CircleHelp } from "lucide-react"
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
import { Input } from "./ui/input"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./ui/tooltip"
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
    /* Optional preference. */
  }
}
function Help({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        data-slot="button"
        closeOnClick={false}
        onClick={() => setOpen(true)}
        render={
          <Button
            variant="secondary"
            size="icon-sm"
            className="size-6! min-h-0! p-0!"
            aria-label={label}
          />
        }
      >
        <CircleHelp className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-sm">{children}</TooltipContent>
    </Tooltip>
  )
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
  const [open, setOpen] = useState(false)
  const [provider, setProvider] = useState<"local" | "mistral">(() =>
    preference("nodeart-ai-provider", "local") === "mistral"
      ? "mistral"
      : "local"
  )
  const [model, setModel] = useState<AIModel>(() =>
    preference("nodeart-ai-model", "0.5B") === "1.5B" ? "1.5B" : "0.5B"
  )
  const [device, setDevice] = useState<AIDevice>(() =>
    preference("nodeart-ai-device", "wasm") === "webgpu" ? "webgpu" : "wasm"
  )
  const [apiKey, setApiKey] = useState("")
  const [gpu, setGpu] = useState(false)
  const [cacheRevision, setCacheRevision] = useState(0)
  const [cacheStatus, setCacheStatus] = useState("")
  useEffect(() => {
    let active = true
    void navigator.gpu
      ?.requestAdapter({ powerPreference: "high-performance" })
      .then((adapter) => {
        if (!active) return
        const available = adapter?.features.has("shader-f16") ?? false
        setGpu(available)
        if (available && !preference("nodeart-ai-device", ""))
          setDevice("webgpu")
        if (!available) setDevice("wasm")
      })
      .catch(() => {
        if (active) setGpu(false)
      })
    return () => {
      active = false
    }
  }, [])
  const config = aiModelConfig(model, device)
  const cached = preference(config.cacheKey, "false") === "true"
  void cacheRevision
  const loading = state.phase === "loading"
  const loaded = state.phase === "ready" || state.phase === "generating"
  const same = state.loaded?.model === model && state.loaded.device === device
  return (
    <TooltipProvider>
      <Button
        variant="secondary"
        size="sm"
        data-cuelume-tap="open"
        onClick={() => setOpen(true)}
      >
        <Sparkles /> AI completion
        {state.phase === "error"
          ? " · error"
          : state.phase === "generating"
            ? " · generating"
            : loaded
              ? " · on"
              : ""}
      </Button>
      {state.phase === "error" && (
        <span className="max-w-64 text-xs break-words" role="alert">
          {state.detail}
        </span>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-sm">
          <DialogTitle>AI completion</DialogTitle>
          <DialogDescription className="sr-only">
            Choose a provider and enable code suggestions.
          </DialogDescription>
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              Provider{" "}
              <Help label="About AI providers">
                Local keeps code on your device. Mistral sends code around your
                cursor to Codestral using your API credits.
              </Help>
            </div>
            <Select
              value={provider}
              onValueChange={(value) => {
                if (value) {
                  setProvider(value as "local" | "mistral")
                  remember("nodeart-ai-provider", value)
                }
              }}
            >
              <SelectTrigger aria-label="AI provider">
                <SelectValue>
                  {provider === "mistral"
                    ? "Mistral · Codestral"
                    : "Local · Qwen"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local" data-cuelume-tap="select">
                  Local · Qwen
                </SelectItem>
                <SelectItem value="mistral" data-cuelume-tap="select">
                  Mistral · Codestral
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {provider === "mistral" ? (
            <>
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <label htmlFor="mistral-api-key">API key</label>
                  <Help label="About the Mistral API key">
                    Kept in memory until you reload. Create a key in Mistral
                    Studio.
                  </Help>
                </div>
                <Input
                  id="mistral-api-key"
                  type="password"
                  value={apiKey}
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="none"
                  placeholder="Mistral API key"
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                data-cuelume-tap="tap"
                onClick={() =>
                  window.open(
                    "https://console.mistral.ai/api-keys/",
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                <KeyRound /> Get API key
              </Button>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  Model{" "}
                  <Help label="About local models">
                    1.5B uses more memory and can give better suggestions. This
                    selection downloads about {(config.bytes / 1e9).toFixed(2)}{" "}
                    GB when first enabled.
                  </Help>
                </div>
                <Select
                  value={model}
                  onValueChange={(value) => {
                    if (value) {
                      setModel(value as AIModel)
                      remember("nodeart-ai-model", value)
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
              </div>
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  Run on{" "}
                  <Help label="About GPU and CPU">
                    GPU is faster but can exceed mobile memory. CPU is slower.
                    GPU requires float16 support.
                  </Help>
                </div>
                <Select
                  value={device}
                  onValueChange={(value) => {
                    if (value) {
                      setDevice(value as AIDevice)
                      remember("nodeart-ai-device", value)
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
                      disabled={!gpu}
                      data-cuelume-tap="select"
                    >
                      WebGPU · GPU
                    </SelectItem>
                    <SelectItem value="wasm" data-cuelume-tap="select">
                      WASM · CPU
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={automatic}
                data-cuelume-tap="toggle"
                onCheckedChange={(value) => onAutomatic(value === true)}
              />{" "}
              Automatic suggestions
            </label>
            <Help label="About automatic suggestions">
              Suggest after a typing pause. Mistral requests use API credits.
              Alt+Enter suggests manually; Tab accepts and Escape dismisses.
            </Help>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                loading ||
                (provider === "local" && loaded && same) ||
                (provider === "mistral" && !apiKey.trim())
              }
              data-cuelume-tap="tap"
              onClick={() =>
                provider === "mistral"
                  ? localCompletion.enableMistral(apiKey)
                  : localCompletion.load(model, device)
              }
            >
              {provider === "mistral" ? <KeyRound /> : <Download />}
              {provider === "mistral"
                ? "Enable Codestral"
                : loaded && !same
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
                {loading || state.phase === "generating"
                  ? "Cancel & disable"
                  : "Disable"}
              </Button>
            )}
          </div>
          {provider === "local" && (
            <Button
              variant="secondary"
              data-cuelume-tap="tap"
              onClick={async () => {
                localCompletion.stop()
                try {
                  await caches.delete("nodeart-ai")
                  for (const size of ["0.5B", "1.5B"])
                    for (const format of ["q4", "q4f16", "q8"])
                      localStorage.removeItem(
                        `nodeart-ai-cached-base-${size}-${format}`
                      )
                  for (const size of ["0.5B", "1.5B"])
                    localStorage.removeItem(`nodeart-ai-cached-${size}-q4`)
                  setCacheRevision((value) => value + 1)
                  setCacheStatus("Cached models removed.")
                } catch {
                  setCacheStatus("Unable to remove cached models.")
                }
              }}
            >
              Remove cached models
            </Button>
          )}
          {state.phase === "loading" && (
            <p className="text-sm break-words" role="status">
              {state.detail}
            </p>
          )}
          {state.phase === "error" && (
            <p className="text-sm break-words" role="alert">
              {state.detail}
            </p>
          )}
          {provider === "local" && cacheStatus && (
            <p className="text-sm" role="status">
              {cacheStatus}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
