import { useState, useRef } from "react"
import type { Edge } from "@xyflow/react"
import { RotateCcw, X } from "lucide-react"
import { play } from "cuelume"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { Slider } from "./ui/slider"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select"
import {
  definitions,
  defaultColors,
  colorVector,
  type ArtNode,
} from "../engine"
import { parameterInput } from "../graph"

function NumericInput({
  value,
  min,
  max,
  step,
  label,
  disabled,
  onChange,
}: {
  value: number
  min: number
  max: number
  step: number
  label: string
  disabled: boolean
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft !== null && draft.trim() && Number.isFinite(Number(draft)))
      onChange(
        Math.max(
          min,
          Math.min(max, step === 1 ? Math.round(Number(draft)) : Number(draft))
        )
      )
    setDraft(null)
  }
  return (
    <Input
      type="number"
      className="w-24 font-mono text-[12px]"
      aria-label={`${label} value`}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={draft ?? Number(value.toFixed(5))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
        if (e.key === "Escape") {
          setDraft(null)
          e.preventDefault()
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault()
          const base =
            draft !== null && draft.trim() && Number.isFinite(Number(draft))
              ? Number(draft)
              : value
          const increment = step === 1 ? 1 : step * (e.shiftKey ? 0.1 : 1)
          onChange(
            Math.max(
              min,
              Math.min(
                max,
                Number(
                  (
                    base + (e.key === "ArrowUp" ? increment : -increment)
                  ).toFixed(6)
                )
              )
            )
          )
          setDraft(null)
          play("select", { emphasis: "subtle" })
        }
      }}
    />
  )
}

export function ParameterEditor({
  node,
  nodes,
  edges,
  onParam,
  onData,
  onDisconnect,
  onSelect,
}: {
  node: ArtNode
  nodes: ArtNode[]
  edges: Edge[]
  onParam: (key: string, value: number) => void
  onData: (data: Partial<ArtNode["data"]>) => void
  onDisconnect: (id: string) => void
  onSelect: (id: string) => void
}) {
  const colorCue = useRef(0)
  const chooseColor = () => {
    const now = performance.now()
    if (now - colorCue.current >= 100) {
      colorCue.current = now
      play("select", { emphasis: "subtle" })
    }
  }
  const driverAt = (port?: number) =>
    port === undefined
      ? undefined
      : edges.find(
          (e) => e.target === node.id && e.targetHandle === String(port)
        )
  const colorDriven = [0, 1, 2].some((port) => driverAt(port))
  const rgb =
    "#" +
    ["r", "g", "b"]
      .map((key) =>
        Math.round(node.data.params[key] * 255)
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  return (
    <>
      {node.data.kind === "color" && (
        <label className="mb-5 flex items-center justify-between gap-3 text-sm">
          Color
          <Input
            type="color"
            aria-label="RGB color picker"
            className="color-picker w-20"
            value={rgb}
            disabled={colorDriven}
            data-cuelume-type={undefined}
            onChange={(e) => {
              const [r, g, b] = colorVector(e.target.value)
              onData({ params: { ...node.data.params, r, g, b } })
              chooseColor()
            }}
          />
        </label>
      )}
      {node.data.kind === "gradient" && (
        <div className="mb-5 space-y-3">
          <div
            className="palette-preview h-6 rounded-md"
            role="img"
            aria-label="Custom palette preview"
            style={{
              background: `linear-gradient(90deg,${(node.data.colors ?? defaultColors).join(",")})`,
            }}
          />
          {(node.data.colors ?? defaultColors).map((color, i) => {
            const driver = driverAt(i + 3)
            return (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 text-[12px]"
              >
                <label htmlFor={`stop-${node.id}-${i}`}>
                  Stop {i + 1} · {Math.round((i / 3) * 100)}%
                </label>
                <Input
                  id={`stop-${node.id}-${i}`}
                  type="color"
                  aria-label={`Palette stop ${i + 1}`}
                  className="color-picker w-16"
                  value={color}
                  disabled={!!driver}
                  data-cuelume-type={undefined}
                  onChange={(e) => {
                    const colors = [...(node.data.colors ?? defaultColors)]
                    colors[i] = e.target.value
                    onData({ colors })
                    chooseColor()
                  }}
                />
                {driver && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onDisconnect(driver.id)}
                  >
                    Disconnect stop {i + 1}
                  </Button>
                )}
              </div>
            )
          })}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onData({ colors: [...defaultColors] })}
          >
            <RotateCcw />
            Reset colors
          </Button>
        </div>
      )}
      {definitions[node.data.kind].params.map((p) => {
        const driver = driverAt(parameterInput(node.data.kind, p.key))
        const options =
          p.key === "theme"
            ? ["Prism", "Sunset", "Botanical", "Ocean"]
            : p.key === "mode"
              ? ["Normal", "Multiply", "Screen", "Overlay", "Add"]
              : undefined
        return (
          <div key={p.key} className="mb-5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label id={`param-${node.id}-${p.key}`} className="text-[12px]">
                {p.label}
              </label>
              <div className="flex items-center gap-1">
                {options ? (
                  <Select
                    value={node.data.params[p.key]}
                    disabled={!!driver}
                    onValueChange={(value) => {
                      if (value !== null) {
                        onParam(p.key, Number(value))
                        play("select", { emphasis: "subtle" })
                      }
                    }}
                  >
                    <SelectTrigger aria-label={p.label} className="w-28">
                      <SelectValue>
                        {options[Math.round(node.data.params[p.key])]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((option, i) => (
                        <SelectItem key={option} value={i}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <NumericInput
                    label={p.label}
                    value={node.data.params[p.key]}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    disabled={!!driver}
                    onChange={(value) => onParam(p.key, value)}
                  />
                )}
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label={`Reset ${p.label}`}
                  disabled={!!driver || node.data.params[p.key] === p.value}
                  onClick={() => onParam(p.key, p.value)}
                >
                  <RotateCcw className="size-3" />
                </Button>
              </div>
            </div>
            {!options && (
              <Slider
                disabled={!!driver}
                aria-label={p.label}
                aria-labelledby={`param-${node.id}-${p.key}`}
                min={p.min}
                max={p.max}
                step={p.step}
                value={node.data.params[p.key]}
                onValueChange={(value) =>
                  onParam(
                    p.key,
                    Array.isArray(value) ? value[0] : (value as number)
                  )
                }
              />
            )}
            {driver && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onSelect(driver.source)}
                >
                  Driven by{" "}
                  {
                    definitions[
                      nodes.find((n) => n.id === driver.source)!.data.kind
                    ].title
                  }
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Disconnect ${p.label}`}
                  onClick={() => onDisconnect(driver.id)}
                >
                  <X className="size-3" />
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        )
      })}
      <p className="mb-3 text-[12px] leading-relaxed">
        Connect uniforms to parameter sockets to animate them. Use Shift + ↑ / ↓
        in numeric fields for fine adjustments.
      </p>
    </>
  )
}
