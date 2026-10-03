import { useEffect, useRef, useState, type RefObject } from "react"
import { Video, Square, Download } from "lucide-react"
import { play } from "cuelume"
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
import { recordCanvas, supportedVideoFormats } from "../video-export"
import { safeFilename } from "../filename"

export function VideoExport({
  canvasRef,
  name,
  playing,
  ready,
  onPlaying,
  onRecording,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>
  name: string
  playing: boolean
  ready: boolean
  onPlaying: (playing: boolean) => void
  onRecording: (recording: boolean) => void
}) {
  const [open, setOpen] = useState(false),
    [seconds, setSeconds] = useState(10),
    [fps, setFps] = useState(30)
  const [mime, setMime] = useState(() => supportedVideoFormats()[0]?.mime ?? "")
  const [recording, setRecording] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [message, setMessage] = useState("")
  const session = useRef<ReturnType<typeof recordCanvas> | null>(null),
    mounted = useRef(true)
  const restorePlaying = useRef(playing)
  const formats = supportedVideoFormats()
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      session.current?.cancel()
    }
  }, [])
  useEffect(() => {
    if (recording && !playing) {
      restorePlaying.current = false
      session.current?.cancel()
    }
  }, [recording, playing])
  async function start() {
    const canvas = canvasRef.current
    if (!canvas || session.current) return
    setMessage("")
    setElapsed(0)
    restorePlaying.current = playing
    try {
      const capture = recordCanvas(canvas, { seconds, fps, mime }, (value) => {
        if (mounted.current) setElapsed(value)
      })
      session.current = capture
      setRecording(true)
      onRecording(true)
      onPlaying(true)
      const result = await capture.done
      if (!mounted.current) return
      if (result) {
        const url = URL.createObjectURL(result.blob),
          anchor = document.createElement("a")
        anchor.href = url
        anchor.download = `${safeFilename(name)}.${result.extension}`
        anchor.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
        setMessage("Video downloaded.")
        play("ready", { emphasis: "subtle" })
      } else setMessage("Recording canceled.")
    } catch (error) {
      if (mounted.current)
        setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      session.current = null
      if (mounted.current) {
        setRecording(false)
        onRecording(false)
        onPlaying(restorePlaying.current)
      }
    }
  }
  return (
    <>
      <Button
        variant="secondary"
        data-cuelume-tap="open"
        disabled={
          !ready ||
          formats.length === 0 ||
          !HTMLCanvasElement.prototype.captureStream
        }
        onClick={() => setOpen(true)}
      >
        <Video />
        Export video
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) session.current?.cancel()
          setOpen(value)
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogTitle>Export video</DialogTitle>
          <DialogDescription>
            Record the running preview at its current resolution, without audio.
            Recording resumes playback; closing this window cancels it.
          </DialogDescription>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2">
              Duration
              <Select
                value={String(seconds)}
                disabled={recording}
                onValueChange={(v) => v && setSeconds(Number(v))}
              >
                <SelectTrigger aria-label="Video duration">
                  <SelectValue>{seconds} seconds</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 30, 60].map((n) => (
                    <SelectItem
                      key={n}
                      value={String(n)}
                      data-cuelume-tap="select"
                    >
                      {n} seconds
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-2">
              Frame rate
              <Select
                value={String(fps)}
                disabled={recording}
                onValueChange={(v) => v && setFps(Number(v))}
              >
                <SelectTrigger aria-label="Video frame rate">
                  <SelectValue>{fps} fps</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[24, 30, 60].map((n) => (
                    <SelectItem
                      key={n}
                      value={String(n)}
                      data-cuelume-tap="select"
                    >
                      {n} fps
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="col-span-2 grid gap-2">
              Format
              <Select
                value={mime}
                disabled={recording}
                onValueChange={(v) => v && setMime(v as typeof mime)}
              >
                <SelectTrigger aria-label="Video format">
                  <SelectValue>
                    {formats.find((format) => format.mime === mime)?.label ??
                      "Choose format"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {formats.map((f) => (
                    <SelectItem
                      key={f.mime}
                      value={f.mime}
                      data-cuelume-tap="select"
                    >
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <p className="text-xs">
            Captures the applied graph in real time. Run draft edits first.
            Actual frame rate depends on rendering speed; keep this tab visible
            while recording.
          </p>
          <p role="status">
            {recording
              ? `Recording ${elapsed.toFixed(1)} / ${seconds}s…`
              : message}
          </p>
          <div className="flex flex-wrap gap-2">
            {recording ? (
              <>
                <Button
                  data-cuelume-tap="tap"
                  onClick={() => session.current?.stop()}
                >
                  <Square />
                  Stop & download
                </Button>
                <Button
                  variant="secondary"
                  data-cuelume-tap="tap"
                  onClick={() => session.current?.cancel()}
                >
                  Cancel recording
                </Button>
              </>
            ) : (
              <Button
                disabled={!ready || !mime}
                data-cuelume-tap="tap"
                onClick={() => void start()}
              >
                <Download />
                Record & download
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
