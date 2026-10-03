import { recordCanvas, supportedVideoFormats } from "../src/video-export"
const results: string[] = []
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}
async function check(name: string, run: () => Promise<void>) {
  try {
    await run()
    results.push(`PASS ${name}`)
  } catch (e) {
    results.push(`FAIL ${name}: ${String(e)}`)
  }
  document.querySelector("#results")!.textContent = results.join("\n")
}
const canvas = document.createElement("canvas")
canvas.width = canvas.height = 64
document.body.append(canvas)
const ctx = canvas.getContext("2d")!
let frame = 0
const animation = setInterval(() => {
  ctx.fillStyle = `hsl(${frame++ * 10} 90% 50%)`
  ctx.fillRect(0, 0, 64, 64)
}, 30)
const formats = supportedVideoFormats()
await check(
  "supported formats encode playable video at canvas resolution",
  async () => {
    assert(formats.length, "No supported encoder")
    // Verify WebM and MP4 when the browser provides them.
    for (const format of formats.filter(
      (f, i) => formats.findIndex((v) => v.extension === f.extension) === i
    )) {
      const capture = recordCanvas(
        canvas,
        { seconds: 0.8, fps: 30, mime: format.mime },
        () => {}
      )
      const result = await capture.done
      assert(result && result.blob.size > 100, "Empty video")
      const url = URL.createObjectURL(result!.blob),
        video = document.createElement("video")
      video.muted = true
      document.body.append(video)
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Video metadata timeout")),
            5000
          )
          video.onloadedmetadata = () => {
            clearTimeout(timeout)
            resolve()
          }
          video.onerror = () => {
            clearTimeout(timeout)
            reject(new Error("Video decode failed"))
          }
          video.src = url
        })
        assert(
          video.videoWidth === 64 && video.videoHeight === 64,
          "Wrong resolution"
        )
        await video.play()
        await new Promise((resolve) => setTimeout(resolve, 150))
        assert(video.currentTime > 0, "Playback did not advance")
      } finally {
        video.pause()
        video.remove()
        URL.revokeObjectURL(url)
      }
    }
  }
)
await check(
  "cancel discards video and manual stop returns partial video",
  async () => {
    const mime = formats[0].mime
    const canceled = recordCanvas(
      canvas,
      { seconds: 5, fps: 24, mime },
      () => {}
    )
    canceled.cancel()
    assert((await canceled.done) === null, "Cancellation returned a video")
    const stopped = recordCanvas(
      canvas,
      { seconds: 5, fps: 24, mime },
      () => {}
    )
    await new Promise((resolve) => setTimeout(resolve, 400))
    stopped.stop()
    assert((await stopped.done)?.blob.size, "Manual stop returned empty video")
  }
)
clearInterval(animation)
document.body.dataset.result = results.some((r) => r.startsWith("FAIL"))
  ? "failed"
  : "passed"
