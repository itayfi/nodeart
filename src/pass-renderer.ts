import p5 from "p5"
import {
  passOrder,
  shaderSource,
  type TexturePort,
  type PassProject,
} from "./passes"

const vertex =
  "attribute vec2 aPosition; varying vec2 vUv; void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}"
const copy =
  "precision highp float; varying vec2 vUv; uniform sampler2D uTex0; void main(){gl_FragColor=texture2D(uTex0,vUv);}"
type Surface = {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
  width: number
  height: number
}
type Sketch = {
  instance: p5
  canvas: HTMLCanvasElement
  draw: (
    p: p5,
    inputs: Record<string, p5.Image | null>,
    time: number,
    frame: number
  ) => void
}

export class PassRenderer {
  private gl: WebGLRenderingContext
  private surfaces = new Map<string, [Surface, Surface]>()
  private allocated = new Set<Surface>()
  private programs = new Map<string, WebGLProgram>()
  private sketches = new Map<string, Sketch>()
  private shaders: WebGLShader[] = []
  private buffer: WebGLBuffer
  private blank: Surface
  private copier: WebGLProgram
  private order: ReturnType<typeof passOrder>
  private front = 0
  private frame = 0
  private disposed = false
  private hosts: HTMLElement[] = []
  private instances = new Set<p5>()
  private project: PassProject
  private size: number
  constructor(canvas: HTMLCanvasElement, project: PassProject, size: number) {
    this.project = project
    this.size = size
    this.order = passOrder(project.nodes, project.edges)
    canvas.width = canvas.height = size
    const gl = canvas.getContext("webgl", {
      preserveDrawingBuffer: true,
      alpha: true,
      premultipliedAlpha: false,
    })
    if (!gl) throw new Error("WebGL is unavailable in this browser.")
    this.gl = gl
    this.buffer = gl.createBuffer()!
    this.blank = this.surface()
    this.copier = this.program(copy)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    )
  }
  async initialize() {
    try {
      for (const node of this.order) {
        if (this.disposed) return
        const image = node.data.image
        this.surfaces.set(node.id, [
          this.surface(image?.width, image?.height),
          this.surface(image?.width, image?.height),
        ])
        if (
          node.data.inputs.length >
          this.gl.getParameter(this.gl.MAX_TEXTURE_IMAGE_UNITS)
        )
          throw new Error(
            `${node.data.label}: too many texture inputs for this GPU.`
          )
        try {
          if (node.data.kind === "glsl")
            this.programs.set(node.id, this.program(shaderSource(node)))
          if (node.data.kind === "image" && image) {
            const bitmap = await createImageBitmap(
              await (await fetch(image.src)).blob()
            )
            try {
              if (
                bitmap.width !== image.width ||
                bitmap.height !== image.height
              )
                throw new Error("Image dimensions do not match the asset.")
              if (this.disposed) return
              for (const surface of this.surfaces.get(node.id)!) {
                this.gl.bindTexture(this.gl.TEXTURE_2D, surface.texture)
                // ImageBitmap ignores UNPACK_FLIP_Y_WEBGL; flip using a canvas.
                const flipped = document.createElement("canvas")
                flipped.width = image.width
                flipped.height = image.height
                const ctx = flipped.getContext("2d")!
                ctx.translate(0, image.height)
                ctx.scale(1, -1)
                ctx.drawImage(bitmap, 0, 0)
                this.gl.texImage2D(
                  this.gl.TEXTURE_2D,
                  0,
                  this.gl.RGBA,
                  this.gl.RGBA,
                  this.gl.UNSIGNED_BYTE,
                  flipped
                )
              }
            } finally {
              bitmap.close()
            }
          }
          if (node.data.kind === "p5") {
            const functions = new Function(
              `${node.data.code}\nreturn { setup: typeof setup === 'function' ? setup : undefined, draw: typeof draw === 'function' ? draw : undefined };`
            )() as { setup?: (p: p5) => void; draw?: Sketch["draw"] }
            if (!functions.draw)
              throw new Error("Define function draw(p, inputs, time, frame).")
            const host = document.createElement("div")
            host.hidden = true
            document.body.append(host)
            this.hosts.push(host)
            await new Promise<void>((resolve, reject) => {
              const instance = new p5((p) => {
                p.setup = () => {
                  try {
                    p.pixelDensity(1)
                    const renderer = p.createCanvas(this.size, this.size)
                    functions.setup?.(p)
                    p.noLoop()
                    if (this.disposed) {
                      p.remove()
                      resolve()
                      return
                    }
                    this.sketches.set(node.id, {
                      instance: p,
                      canvas: renderer.elt as HTMLCanvasElement,
                      draw: functions.draw!,
                    })
                    resolve()
                  } catch (error) {
                    p.remove()
                    reject(error)
                  }
                }
              }, host)
              this.instances.add(instance)
            })
          }
        } catch (error) {
          throw new Error(
            `${node.data.label}: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error }
          )
        }
      }
    } catch (error) {
      this.dispose()
      throw error
    }
  }
  private surface(width = this.size, height = this.size): Surface {
    const limit = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)
    if (width > limit || height > limit)
      throw new Error("Texture exceeds the GPU size limit.")
    const gl = this.gl,
      texture = gl.createTexture()!,
      framebuffer = gl.createFramebuffer()!
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    )
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    )
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(texture)
      gl.deleteFramebuffer(framebuffer)
      throw new Error("Unable to allocate pass texture.")
    }
    gl.viewport(0, 0, width, height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    const surface = { texture, framebuffer, width, height }
    this.allocated.add(surface)
    return surface
  }
  private program(source: string) {
    const gl = this.gl,
      program = gl.createProgram()!
    try {
      for (const [type, code] of [
        [gl.VERTEX_SHADER, vertex],
        [gl.FRAGMENT_SHADER, source],
      ] as const) {
        const shader = gl.createShader(type)!
        this.shaders.push(shader)
        gl.shaderSource(shader, code)
        gl.compileShader(shader)
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
          throw new Error(
            gl.getShaderInfoLog(shader) ?? "Shader compilation failed."
          )
        gl.attachShader(program, shader)
      }
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(
          gl.getProgramInfoLog(program) ?? "Shader linking failed."
        )
      return program
    } catch (error) {
      gl.deleteProgram(program)
      throw error
    }
  }
  private drawProgram(
    program: WebGLProgram,
    target: Surface | null,
    textures: Surface[],
    time: number,
    ports?: TexturePort[],
    connected?: boolean[]
  ) {
    const gl = this.gl
    gl.useProgram(program)
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null)
    gl.viewport(0, 0, target?.width ?? this.size, target?.height ?? this.size)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    const attr = gl.getAttribLocation(program, "aPosition")
    gl.enableVertexAttribArray(attr)
    gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0)
    gl.uniform1f(gl.getUniformLocation(program, "uTime"), time)
    gl.uniform1i(gl.getUniformLocation(program, "uFrame"), this.frame)
    gl.uniform2f(
      gl.getUniformLocation(program, "uResolution"),
      this.size,
      this.size
    )
    textures.forEach((surface, i) => {
      const name = ports?.[i].name ?? `uTex${i}`
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, surface.texture)
      gl.uniform1i(gl.getUniformLocation(program, name), i)
      gl.uniform2f(
        gl.getUniformLocation(program, `${name}Resolution`),
        surface.width,
        surface.height
      )
      gl.uniform1i(
        gl.getUniformLocation(program, `${name}Connected`),
        connected?.[i] ? 1 : 0
      )
    })
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }
  render(time: number, output = this.project.output) {
    if (this.disposed) return
    const gl = this.gl,
      current = new Map<string, Surface>()
    // All delay nodes expose the same immutable previous-frame snapshot.
    for (const n of this.order)
      if (n.data.kind === "previous")
        current.set(n.id, this.surfaces.get(n.id)![this.front])
    for (const n of this.order) {
      if (n.data.kind === "previous") continue
      const target = this.surfaces.get(n.id)![1 - this.front]
      if (n.data.kind === "image") {
        current.set(n.id, target)
        continue
      }
      const connected: boolean[] = []
      const inputs = n.data.inputs.map((port) => {
        const e = this.project.edges.find(
          (e) => e.target === n.id && e.targetHandle === port.id
        )
        connected.push(!!e)
        return e ? current.get(e.source)! : this.blank
      })
      try {
        if (n.data.kind === "glsl")
          this.drawProgram(
            this.programs.get(n.id)!,
            target,
            inputs,
            time,
            n.data.inputs,
            connected
          )
        else {
          const sketch = this.sketches.get(n.id)!,
            p = sketch.instance
          const images = Object.fromEntries(
            inputs.map((surface, i) => {
              const name = n.data.inputs[i].name
              if (!connected[i]) return [name, null]
              const { width, height } = surface
              const pixels = new Uint8Array(width * height * 4)
              gl.bindFramebuffer(gl.FRAMEBUFFER, surface.framebuffer)
              gl.readPixels(
                0,
                0,
                width,
                height,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                pixels
              )
              const image = p.createImage(width, height)
              image.loadPixels()
              for (let y = 0; y < height; y++) {
                ;(image.pixels as unknown as Uint8ClampedArray).set(
                  pixels.subarray(
                    (height - 1 - y) * width * 4,
                    (height - y) * width * 4
                  ),
                  y * width * 4
                )
              }
              image.updatePixels()
              return [name, image]
            })
          )
          p.push()
          try {
            p.resetMatrix()
            sketch.draw(p, images, time, this.frame)
          } finally {
            p.pop()
          }
          gl.bindTexture(gl.TEXTURE_2D, target.texture)
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            sketch.canvas
          )
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
        }
      } catch (error) {
        throw new Error(
          `${n.data.label}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error }
        )
      }
      current.set(n.id, target)
    }
    // Capture into the other buffer only after every pass, including delay chains.
    for (const n of this.order)
      if (n.data.kind === "previous") {
        const e = this.project.edges.find((e) => e.target === n.id)
        this.drawProgram(
          this.copier,
          this.surfaces.get(n.id)![1 - this.front],
          [e ? current.get(e.source)! : this.blank],
          time
        )
      }
    this.drawProgram(
      this.copier,
      null,
      [current.get(output) ?? this.blank],
      time
    )
    this.front = 1 - this.front
    this.frame++
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true
    const gl = this.gl
    this.instances.forEach((p) => p.remove())
    this.hosts.forEach((h) => h.remove())
    for (const surface of this.allocated) {
      gl.deleteTexture(surface.texture)
      gl.deleteFramebuffer(surface.framebuffer)
    }
    this.allocated.clear()
    this.programs.forEach((p) => gl.deleteProgram(p))
    gl.deleteProgram(this.copier)
    this.shaders.forEach((s) => gl.deleteShader(s))
    gl.deleteBuffer(this.buffer)
  }
}
