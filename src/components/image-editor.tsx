import { useRef, useState } from "react"
import { Upload, X, Layers3 } from "lucide-react"
import { play } from "cuelume"
import type { ArtNode } from "../engine"
import { importImage } from "../image-assets"
import { Button } from "./ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select"

export function ImageEditor({
  node,
  nodes,
  onData,
  onAlpha,
}: {
  node: ArtNode
  nodes: ArtNode[]
  onData: (data: Partial<ArtNode["data"]>) => void
  onAlpha: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const assets = [
    ...new Map(
      nodes.flatMap((n) =>
        n.data.image ? [[n.data.image.src, n.data.image] as const] : []
      )
    ).values(),
  ]
  return (
    <div className="mb-6 space-y-3">
      {node.data.image && (
        <>
          <img
            src={node.data.image.src}
            alt={node.data.image.name}
            className="image-asset-preview max-h-40 w-full rounded-lg object-contain"
          />
          <p className="truncate text-[12px]">
            {node.data.image.name} ·{" "}
            <span className="font-mono">
              {node.data.image.width} × {node.data.image.height}
            </span>
          </p>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Upload />
          {busy
            ? "Importing…"
            : node.data.image
              ? "Replace image"
              : "Import image"}
        </Button>
        {node.data.image && (
          <Button
            variant="secondary"
            size="icon"
            aria-label="Remove image"
            onClick={() => onData({ image: undefined })}
          >
            <X />
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="hidden"
        aria-label="Import image file"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (!file) return
          setBusy(true)
          setError("")
          try {
            const image = await importImage(file)
            onData({ image })
            play("success", { emphasis: "subtle" })
          } catch (error) {
            setError(
              error instanceof Error ? error.message : "Unable to import image."
            )
          } finally {
            setBusy(false)
          }
        }}
      />
      {assets.length > 0 && (
        <Select
          value={
            node.data.image
              ? assets.findIndex((asset) => asset.src === node.data.image!.src)
              : null
          }
          onValueChange={(value) => {
            if (value !== null) {
              onData({ image: assets[Number(value)] })
              play("select", { emphasis: "subtle" })
            }
          }}
        >
          <SelectTrigger aria-label="Use a project image" className="w-full">
            <SelectValue placeholder="Use a project image…">
              {node.data.image?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {assets.map((asset, i) => (
              <SelectItem key={i} value={i}>
                {asset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {node.data.kind === "image" && node.data.image && (
        <Button variant="secondary" size="sm" onClick={onAlpha}>
          <Layers3 />
          Add matching alpha mask
        </Button>
      )}
      <p className="text-[12px] leading-relaxed">
        Images stay with your project and JSON backups. Imports are resized to
        at most 2048 pixels. Connect Transform or Domain warp to Coordinates to
        position the image.
      </p>
      {error && (
        <p role="alert" className="text-[12px] text-red-800">
          {error}
        </p>
      )}
    </div>
  )
}
