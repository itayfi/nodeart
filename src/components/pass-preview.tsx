import { useEffect, useRef, type RefObject } from "react"
import { PassRenderer } from "../pass-renderer"
import type { PassProject } from "../passes"

export function PassPreview({
  request,
  playing,
  resolution,
  canvasRef,
  onStatus,
  onTime,
  onApplied,
  onRuntimeError,
}: {
  request: { project: PassProject; revision: number }
  playing: boolean
  resolution: number
  canvasRef: RefObject<HTMLCanvasElement | null>
  onStatus: (status: string) => void
  onTime: (time: number) => void
  onApplied: (project: PassProject) => void
  onRuntimeError: () => void
}) {
  const active = useRef<{
    renderer: PassRenderer
    canvas: HTMLCanvasElement
    time: number
  } | null>(null)
  const playback = useRef(playing)
  useEffect(() => {
    playback.current = playing
  }, [playing])
  useEffect(() => {
    let canceled = false
    const canvas = document.createElement("canvas")
    let candidate: PassRenderer | undefined
    void (async () => {
      try {
        onStatus("Compiling…")
        candidate = new PassRenderer(canvas, request.project, resolution)
        await candidate.initialize()
        if (canceled) {
          candidate.dispose()
          return
        }
        candidate.render(0)
        const visible = canvasRef.current!
        visible.width = visible.height = resolution
        visible.getContext("2d")!.drawImage(canvas, 0, 0)
        active.current?.renderer.dispose()
        active.current = { renderer: candidate, canvas, time: 0 }
        candidate = undefined
        onTime(0)
        onApplied(request.project)
        onStatus("Running")
      } catch (error) {
        candidate?.dispose()
        if (!canceled)
          onStatus(error instanceof Error ? error.message : String(error))
      }
    })()
    return () => {
      canceled = true
      candidate?.dispose()
    }
  }, [request, resolution, canvasRef, onStatus, onTime, onApplied])
  useEffect(() => {
    let raf = 0,
      last = performance.now(),
      reported = last
    const tick = (now: number) => {
      const delta = Math.max(0, Math.min((now - last) / 1000, 0.1))
      last = now
      const running = active.current
      if (running && playback.current) {
        try {
          running.time += delta
          running.renderer.render(running.time)
          canvasRef.current?.getContext("2d")?.drawImage(running.canvas, 0, 0)
        } catch (error) {
          playback.current = false
          onRuntimeError()
          onStatus(error instanceof Error ? error.message : String(error))
        }
        if (now - reported > 150) {
          onTime(running.time)
          reported = now
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      active.current?.renderer.dispose()
      active.current = null
    }
  }, [canvasRef, onStatus, onTime, onRuntimeError])
  return (
    <canvas
      ref={canvasRef}
      className="block aspect-square max-h-full w-full object-contain"
      aria-label="Live generative art preview"
    />
  )
}
