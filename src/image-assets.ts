import type { ArtNode } from "./engine.ts"

type ImageAsset = NonNullable<ArtNode["data"]["image"]>
const decoded = new Map<
  string,
  { canvas: HTMLCanvasElement; pixels: ImageData }
>()
const pending = new Map<string, Promise<HTMLCanvasElement>>()

export function loadImage(src: string): Promise<HTMLCanvasElement> {
  const cached = decoded.get(src)
  if (cached) return Promise.resolve(cached.canvas)
  const existing = pending.get(src)
  if (existing) return existing
  const promise = new Promise<HTMLCanvasElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      try {
        if (
          !image.width ||
          !image.height ||
          image.width > 2048 ||
          image.height > 2048
        )
          throw new Error("Image dimensions exceed 2048 pixels.")
        const canvas = document.createElement("canvas")
        canvas.width = image.width
        canvas.height = image.height
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!
        ctx.drawImage(image, 0, 0)
        decoded.set(src, {
          canvas,
          pixels: ctx.getImageData(0, 0, canvas.width, canvas.height),
        })
        resolve(canvas)
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = () =>
      reject(new Error("Unable to decode the imported image."))
    image.src = src
  })
  pending.set(src, promise)
  void promise.finally(() => pending.delete(src)).catch(() => {})
  return promise
}

export function imageCanvas(src?: string): HTMLCanvasElement {
  if (src) {
    const image = decoded.get(src)
    if (!image) throw new Error("Image is still loading.")
    return image.canvas
  }
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1
  return canvas
}

export function sampleImage(
  src: string | undefined,
  u: number,
  v: number
): [number, number, number, number] {
  if (!src) return [0, 0, 0, 0]
  const image = decoded.get(src)
  if (!image) throw new Error("Image is still loading.")
  const { width, height, data } = image.pixels
  const px = Math.max(0, Math.min(width - 1, u * width - 0.5))
  const py = Math.max(0, Math.min(height - 1, (1 - v) * height - 0.5))
  const x = Math.floor(px),
    y = Math.floor(py),
    tx = px - x,
    ty = py - y
  return [0, 1, 2, 3].map((channel) => {
    const pixel = (dx: number, dy: number) =>
      data[
        (Math.min(height - 1, y + dy) * width + Math.min(width - 1, x + dx)) *
          4 +
          channel
      ] / 255
    return (
      (pixel(0, 0) * (1 - tx) + pixel(1, 0) * tx) * (1 - ty) +
      (pixel(0, 1) * (1 - tx) + pixel(1, 1) * tx) * ty
    )
  }) as [number, number, number, number]
}

export async function importImage(file: File): Promise<ImageAsset> {
  if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type))
    throw new Error("Choose a PNG, JPEG, WebP, GIF, or AVIF image.")
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Choose an image smaller than 20 MB.")
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const src = canvas.toDataURL("image/png")
    await loadImage(src)
    return {
      src,
      name: file.name.slice(0, 120),
      width: canvas.width,
      height: canvas.height,
    }
  } finally {
    bitmap.close()
  }
}

export function releaseUnusedImages(sources: Set<string>) {
  for (const src of decoded.keys()) if (!sources.has(src)) decoded.delete(src)
}
