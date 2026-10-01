import {
  compile,
  makeNode,
  definitions,
  parameterPorts,
  type ArtNode,
  type Kind,
} from "../src/engine.ts"
import { numericEvaluator } from "../src/graph.ts"
import { importImage, imageCanvas } from "../src/image-assets.ts"
import { parseProject } from "../src/project.ts"
import type { Edge } from "@xyflow/react"

const results: string[] = []
const wire = (source: string, target: string, input = 0): Edge => ({
  id: `${source}-${target}-${input}`,
  source,
  target,
  targetHandle: String(input),
})
const vertex =
  "attribute vec2 aPosition; varying vec2 vUv; void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}"
const canvas = document.createElement("canvas")
canvas.width = canvas.height = 2
const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true })!
function program(source: string) {
  const program = gl.createProgram()!
  for (const [type, code] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, source],
  ] as const) {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, code)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(
        gl.getShaderInfoLog(shader) ?? "Shader compilation failed"
      )
    gl.attachShader(program, shader)
    gl.deleteShader(shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) ?? "Shader linking failed")
  return program
}
async function check(name: string, run: () => void | Promise<void>) {
  try {
    await run()
    results.push(`PASS ${name}`)
  } catch (error) {
    results.push(`FAIL ${name}: ${String(error)}`)
  }
}
function comparePixels(nodes: ArtNode[], edges: Edge[], time = 0) {
  const compiled = compile(nodes, edges),
    p = program(compiled.source),
    buffer = gl.createBuffer()!,
    textures: WebGLTexture[] = []
  try {
    gl.useProgram(p)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    )
    const attr = gl.getAttribLocation(p, "aPosition")
    gl.enableVertexAttribArray(attr)
    gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0)
    gl.uniform1f(gl.getUniformLocation(p, "uTime"), time)
    gl.uniform2f(gl.getUniformLocation(p, "uResolution"), 2, 2)
    compiled.textures.forEach((node, i) => {
      const texture = gl.createTexture()!
      textures.push(texture)
      gl.activeTexture(gl.TEXTURE0 + i + 1)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imageCanvas(node.data.image?.src)
      )
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
      gl.uniform1i(gl.getUniformLocation(p, `uTex${i}`), i + 1)
    })
    gl.viewport(0, 0, 2, 2)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    const pixels = new Uint8Array(16)
    gl.readPixels(0, 0, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    const evaluate = numericEvaluator(nodes, edges)
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        const expected = evaluate("out", time, [
          (x + 0.5) / 2,
          (y + 0.5) / 2,
          0,
        ])
        expected.forEach((value, channel) => {
          const byte = Math.round(Math.max(0, Math.min(1, value)) * 255),
            actual = pixels[(y * 2 + x) * 4 + channel]
          if (Math.abs(byte - actual) > 3)
            throw new Error(
              `pixel ${x},${y} channel ${channel}: GPU ${actual}, CPU ${byte}`
            )
        })
      }
    if (gl.getError() !== gl.NO_ERROR) throw new Error("WebGL render failed")
  } finally {
    textures.forEach((t) => gl.deleteTexture(t))
    gl.deleteBuffer(buffer)
    gl.deleteProgram(p)
  }
}

for (const kind of [
  "time",
  "constant",
  "noise",
  "white",
  "warp",
  "palette",
  "previous",
  "transform",
  "sine",
  "threshold",
  "image",
  "composite",
  "gradient",
] as Kind[]) {
  for (const parameter of definitions[kind].params) {
    await check(`uniform shader ${kind}.${parameter.key}`, () => {
      const nodes = [
        makeNode("time", "driver", 0, 0),
        makeNode(kind, "target", 0, 0),
        makeNode("output", "out", 0, 0),
      ]
      const p = program(
        compile(nodes, [
          wire("driver", "target", parameterPorts[kind][parameter.key]),
          wire("target", "out"),
        ]).source
      )
      gl.deleteProgram(p)
    })
  }
}
const source = document.createElement("canvas")
source.width = source.height = 2
const ctx = source.getContext("2d")!
ctx.fillStyle = "#ff0000"
ctx.fillRect(0, 0, 1, 1)
ctx.fillStyle = "#0000ff"
ctx.fillRect(1, 1, 1, 1)
const blob = await new Promise<Blob>((resolve) =>
  source.toBlob((blob) => resolve(blob!), "image/png")
)
const image = makeNode("image", "image", 0, 0)
image.data.image = await importImage(
  new File([blob], "fixture.png", { type: "image/png" })
)
const alpha = makeNode("alpha", "alpha", 0, 0)
alpha.data.image = image.data.image
const out = makeNode("output", "out", 0, 0)
await check("image sampling and orientation match CPU", () =>
  comparePixels([image, out], [wire("image", "out")])
)
await check("imported transparency matches CPU", () =>
  comparePixels([alpha, out], [wire("alpha", "out")])
)
await check("image JSON backup restores embedded pixels", () => {
  const restored = parseProject(
    JSON.parse(
      JSON.stringify({
        nodes: [image, out],
        edges: [wire("image", "out")],
        name: "Image",
        presetIndex: 0,
      })
    )
  )
  comparePixels(restored.nodes, restored.edges)
})
for (let mode = 0; mode < 5; mode++) {
  const background = makeNode("color", "background", 0, 0, {
      r: 0.2,
      g: 0.4,
      b: 0.6,
    }),
    composite = makeNode("composite", "composite", 0, 0, {
      mode,
      opacity: 0.75,
    })
  await check(`image composite mode ${mode} matches CPU`, () =>
    comparePixels(
      [background, image, alpha, composite, out],
      [
        wire("background", "composite"),
        wire("image", "composite", 1),
        wire("alpha", "composite", 2),
        wire("composite", "out"),
      ]
    )
  )
}
const gradient = makeNode("gradient", "gradient", 0, 0)
gradient.data.colors = ["#ff0000", "#00ff00", "#0000ff", "#ffffff"]
const uv = makeNode("uv", "uv", 0, 0)
await check("custom color stops match CPU", () =>
  comparePixels(
    [uv, gradient, out],
    [wire("uv", "gradient"), wire("gradient", "out")]
  )
)
const target = document.createElement("pre")
target.id = "rendering-results"
target.textContent = results.join("\n")
document.body.appendChild(target)
