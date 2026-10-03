export const videoFormats = [
  { mime: "video/webm;codecs=vp9", extension: "webm", label: "WebM · VP9" },
  { mime: "video/webm;codecs=vp8", extension: "webm", label: "WebM · VP8" },
  {
    mime: "video/mp4;codecs=avc1.42E01E",
    extension: "mp4",
    label: "MP4 · H.264",
  },
  { mime: "video/webm", extension: "webm", label: "WebM" },
  { mime: "video/mp4", extension: "mp4", label: "MP4" },
] as const
export function supportedVideoFormats() {
  return typeof MediaRecorder === "undefined"
    ? []
    : videoFormats.filter((f) => MediaRecorder.isTypeSupported(f.mime))
}
export function recordCanvas(
  canvas: HTMLCanvasElement,
  options: { seconds: number; fps: number; mime: string },
  onProgress: (seconds: number) => void
) {
  const format = videoFormats.find((f) => f.mime === options.mime)
  if (!format || !supportedVideoFormats().includes(format))
    throw new Error("This video format is unavailable in this browser.")
  if (!canvas.captureStream)
    throw new Error("Canvas video capture is unavailable in this browser.")
  if (
    !Number.isFinite(options.seconds) ||
    options.seconds <= 0 ||
    options.seconds > 60 ||
    ![24, 30, 60].includes(options.fps)
  )
    throw new Error("Choose a duration up to 60 seconds and 24, 30, or 60 fps.")
  const stream = canvas.captureStream(options.fps)
  let recorder: MediaRecorder
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: format.mime,
      videoBitsPerSecond: 8_000_000,
    })
  } catch (error) {
    stream.getTracks().forEach((t) => t.stop())
    throw error
  }
  let resolve!: (value: { blob: Blob; extension: string } | null) => void
  let reject!: (error: Error) => void
  const done = new Promise<{ blob: Blob; extension: string } | null>(
    (yes, no) => {
      resolve = yes
      reject = no
    }
  )
  const chunks: Blob[] = []
  let settled = false,
    timeout: ReturnType<typeof setTimeout> | undefined,
    progress: ReturnType<typeof setInterval> | undefined
  function cleanup() {
    clearTimeout(timeout)
    clearInterval(progress)
    recorder.ondataavailable = recorder.onstop = recorder.onerror = null
    if (recorder.state !== "inactive") recorder.stop()
    stream.getTracks().forEach((t) => t.stop())
  }
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data)
  }
  recorder.onstop = () => {
    if (settled) return
    settled = true
    const blob = new Blob(chunks, { type: recorder.mimeType || format.mime })
    cleanup()
    if (blob.size) resolve({ blob, extension: format.extension })
    else
      reject(
        new Error(
          "The browser produced an empty recording. Try another video format."
        )
      )
  }
  recorder.onerror = () => {
    if (settled) return
    settled = true
    cleanup()
    reject(
      new Error(
        "The browser could not encode the video. Try another format or lower preview quality."
      )
    )
  }
  const stop = () => {
    if (!settled && recorder.state !== "inactive") recorder.stop()
  }
  try {
    recorder.start(250)
    const start = performance.now()
    timeout = setTimeout(stop, options.seconds * 1000)
    progress = setInterval(
      () =>
        onProgress(
          Math.min(options.seconds, (performance.now() - start) / 1000)
        ),
      200
    )
  } catch (error) {
    settled = true
    cleanup()
    reject(error instanceof Error ? error : new Error(String(error)))
  }
  return {
    done,
    stop,
    cancel() {
      if (!settled) {
        settled = true
        cleanup()
        resolve(null)
      }
    },
  }
}
