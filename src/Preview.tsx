import { useEffect, useRef, useState, useMemo, type RefObject } from "react"
import { compile, generateTexture, type ArtNode } from "./engine"
import { resolveGenerator, generatorIsAnimated } from "./graph"
import type { Edge } from "@xyflow/react"
import { loadImage, imageCanvas, releaseUnusedImages } from "./image-assets"
const vertex =
  "attribute vec2 aPosition; varying vec2 vUv; void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}"
export function Preview({
  nodes,
  edges,
  playing,
  reset,
  resolution,
  canvasRef,
  onStatus,
  onTime,
}: {
  nodes: ArtNode[]
  edges: Edge[]
  playing: boolean
  reset: number
  resolution: number
  canvasRef: RefObject<HTMLCanvasElement | null>
  onStatus: (s: string) => void
  onTime: (t: number) => void
}) {
  const playback = useRef(playing)
  const time = useRef(0)
  const imageSources = useMemo(
    () =>
      JSON.stringify([
        ...new Set(
          nodes.flatMap((n) => (n.data.image ? [n.data.image.src] : []))
        ),
      ]),
    [nodes]
  )
  const [readySources, setReadySources] = useState("")
  useEffect(() => {
    let cancelled = false
    const sources = JSON.parse(imageSources) as string[]
    onStatus(sources.length ? "Loading images…" : "Compiling…")
    releaseUnusedImages(new Set(sources))
    void Promise.all(sources.map(loadImage))
      .then(() => {
        if (!cancelled) setReadySources(imageSources)
      })
      .catch((error) => {
        if (!cancelled)
          onStatus(
            error instanceof Error ? error.message : "Unable to load images."
          )
      })
    return () => {
      cancelled = true
    }
  }, [imageSources, onStatus])
  useEffect(() => {
    playback.current = playing
  }, [playing])
  useEffect(() => {
    time.current = 0
  }, [reset])
  useEffect(() => {
    if (readySources !== imageSources) return
    const canvas = canvasRef.current!
    canvas.width = canvas.height = resolution
    const gl = canvas.getContext("webgl", {
      preserveDrawingBuffer: true,
      alpha: false,
    })
    if (!gl) {
      onStatus("WebGL is unavailable in this browser.")
      return
    }
    let raf = 0
    const shaders: WebGLShader[] = [],
      programs: WebGLProgram[] = [],
      textures: WebGLTexture[] = [],
      buffers: WebGLBuffer[] = [],
      frames: WebGLFramebuffer[] = []
    try {
      const compiled = compile(nodes, edges)
      if (
        compiled.textures.length + 1 >
        gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)
      )
        throw new Error(
          "This graph exceeds the GPU texture limit. Use fewer image or generator nodes."
        )
      const program = (fragment: string) => {
        const prog = gl.createProgram()!
        programs.push(prog)
        for (const [type, source] of [
          [gl.VERTEX_SHADER, vertex],
          [gl.FRAGMENT_SHADER, fragment],
        ] as const) {
          const s = gl.createShader(type)!
          shaders.push(s)
          gl.shaderSource(s, source)
          gl.compileShader(s)
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
            throw new Error(
              gl.getShaderInfoLog(s) ?? "Shader compilation failed"
            )
          gl.attachShader(prog, s)
        }
        gl.linkProgram(prog)
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
          throw new Error(gl.getProgramInfoLog(prog) ?? "Shader linking failed")
        return prog
      }
      const main = program(compiled.source),
        copy = program(
          "precision mediump float; varying vec2 vUv; uniform sampler2D image; void main(){gl_FragColor=texture2D(image,vUv);}"
        )
      const buffer = gl.createBuffer()!
      buffers.push(buffer)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      )
      const texture = (image?: HTMLCanvasElement) => {
        const t = gl.createTexture()!
        textures.push(t)
        gl.bindTexture(gl.TEXTURE_2D, t)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        if (image) {
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
          )
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
        } else
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            resolution,
            resolution,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
          )
        return t
      }
      const history = [texture(), texture()]
      for (const t of history) {
        const frame = gl.createFramebuffer()!
        frames.push(frame)
        gl.bindFramebuffer(gl.FRAMEBUFFER, frame)
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          t,
          0
        )
        if (
          gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE
        )
          throw new Error("Unable to allocate preview framebuffer")
        gl.clearColor(0, 0, 0, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)
      }
      const generated = compiled.textures.map((n) =>
        texture(
          n.data.kind === "image" || n.data.kind === "alpha"
            ? imageCanvas(n.data.image?.src)
            : generateTexture(
                n,
                resolveGenerator(n, nodes, edges, time.current)
              )
        )
      )
      const animated = compiled.textures.map(
        (n) =>
          ["ifs", "wfc"].includes(n.data.kind) &&
          generatorIsAnimated(n, nodes, edges)
      )
      let lastGeneration = -1
      const setup = (p: WebGLProgram) => {
        gl.useProgram(p)
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        const a = gl.getAttribLocation(p, "aPosition")
        gl.enableVertexAttribArray(a)
        gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
      }
      const bind = (
        p: WebGLProgram,
        name: string,
        t: WebGLTexture,
        unit: number
      ) => {
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, t)
        gl.uniform1i(gl.getUniformLocation(p, name), unit)
      }
      let front = 0,
        last = performance.now(),
        reported = last,
        first = true
      const draw = (now: number) => {
        const delta = Math.max(0, Math.min((now - last) / 1000, 0.1))
        last = now
        if (playback.current) time.current += delta
        if (playback.current || first) {
          if (time.current - lastGeneration >= 0.1) {
            try {
              compiled.textures.forEach((n, i) => {
                if (!animated[i]) return
                const image = generateTexture(
                  n,
                  resolveGenerator(n, nodes, edges, time.current)
                )
                gl.activeTexture(gl.TEXTURE0 + i + 1)
                gl.bindTexture(gl.TEXTURE_2D, generated[i])
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
                gl.texImage2D(
                  gl.TEXTURE_2D,
                  0,
                  gl.RGBA,
                  gl.RGBA,
                  gl.UNSIGNED_BYTE,
                  image
                )
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
              })
              lastGeneration = time.current
            } catch (error) {
              onStatus(
                error instanceof Error
                  ? error.message
                  : "Generator evaluation failed"
              )
              raf = requestAnimationFrame(draw)
              return
            }
          }
          setup(main)
          gl.bindFramebuffer(gl.FRAMEBUFFER, frames[1 - front])
          gl.viewport(0, 0, resolution, resolution)
          gl.uniform1f(gl.getUniformLocation(main, "uTime"), time.current)
          gl.uniform2f(
            gl.getUniformLocation(main, "uResolution"),
            resolution,
            resolution
          )
          bind(main, "uPrevious", history[front], 0)
          generated.forEach((t, i) => bind(main, `uTex${i}`, t, i + 1))
          gl.drawArrays(gl.TRIANGLES, 0, 6)
          front = 1 - front
          setup(copy)
          gl.bindFramebuffer(gl.FRAMEBUFFER, null)
          bind(copy, "image", history[front], 0)
          gl.drawArrays(gl.TRIANGLES, 0, 6)
          first = false
        }
        if (now - reported > 150) {
          onTime(time.current)
          reported = now
        }
        raf = requestAnimationFrame(draw)
      }
      onStatus("Compiled")
      raf = requestAnimationFrame(draw)
    } catch (error) {
      onStatus(
        error instanceof Error ? error.message : "Unable to render graph"
      )
    }
    return () => {
      cancelAnimationFrame(raf)
      shaders.forEach((s) => gl.deleteShader(s))
      programs.forEach((p) => gl.deleteProgram(p))
      textures.forEach((t) => gl.deleteTexture(t))
      buffers.forEach((b) => gl.deleteBuffer(b))
      frames.forEach((f) => gl.deleteFramebuffer(f))
    }
  }, [
    nodes,
    edges,
    reset,
    resolution,
    canvasRef,
    onStatus,
    onTime,
    imageSources,
    readySources,
  ])
  return (
    <canvas
      ref={canvasRef}
      className="block aspect-square w-full"
      aria-label="Live generative art preview"
    />
  )
}
