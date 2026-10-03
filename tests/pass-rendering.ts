import { PassRenderer } from "../src/pass-renderer"
import { glslSnippets, insertGLSLSnippet } from "../src/glsl-snippets"
import {
  creativeExamples,
  creativeProject,
  passPresets,
  presetPass,
} from "../src/pass-presets"
import {
  makePass,
  port,
  connect,
  type PassProject,
  type PassNode,
} from "../src/passes"

const results: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try {
    await run()
    results.push(`PASS ${name}`)
  } catch (error) {
    results.push(`FAIL ${name}: ${String(error)}`)
  }
  document.querySelector("#results")!.textContent = results.join("\n")
}
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}
function project(
  nodes: PassNode[],
  edges: PassProject["edges"] = [],
  output = nodes.at(-1)!.id
): PassProject {
  return {
    version: 2,
    id: crypto.randomUUID(),
    name: "test",
    nodes,
    edges,
    output,
  }
}
function solid(r: number, g: number, b: number) {
  const n = makePass("glsl")
  n.data.code = `void main(){gl_FragColor=vec4(${r.toFixed(3)},${g.toFixed(3)},${b.toFixed(3)},1.0);}`
  return n
}
async function renderer(p: PassProject, size = 4) {
  const canvas = document.createElement("canvas"),
    r = new PassRenderer(canvas, p, size)
  await r.initialize()
  return { r, canvas }
}
function pixels(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl")!,
    data = new Uint8Array(canvas.width * canvas.height * 4)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.readPixels(
    0,
    0,
    canvas.width,
    canvas.height,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    data
  )
  return data
}

await check(
  "two upstream textures blend regardless of node array order",
  async () => {
    const a = solid(1, 0, 0),
      b = solid(0, 0, 1),
      c = makePass("glsl")
    c.data.inputs = [port("source"), port("overlay")]
    c.data.code =
      "void main(){gl_FragColor=mix(texture2D(source,vUv),texture2D(overlay,vUv),0.5);}"
    const { r, canvas } = await renderer(
      project([c, b, a], [connect(a, c, 0), connect(b, c, 1)], c.id)
    )
    try {
      r.render(0)
      const px = pixels(canvas)
      assert(
        Math.abs(px[0] - 128) <= 1 && Math.abs(px[2] - 128) <= 1,
        "Expected purple multi-pass output"
      )
    } finally {
      r.dispose()
    }
  }
)
await check(
  "missing GLSL textures and connection flags are deterministic",
  async () => {
    const n = makePass("glsl")
    n.data.inputs = [port("source")]
    n.data.code =
      "void main(){gl_FragColor=vec4(texture2D(source,vUv).rgb,sourceConnected ? 0.0 : 1.0);}"
    const { r, canvas } = await renderer(project([n]))
    try {
      r.render(0)
      assert(
        pixels(canvas)[0] === 0 && pixels(canvas)[3] === 255,
        "Expected black disconnected input"
      )
    } finally {
      r.dispose()
    }
  }
)
await check(
  "self-feedback advances exactly one completed frame and reset clears it",
  async () => {
    const n = makePass("glsl"),
      h = makePass("previous")
    n.data.inputs = [port("history")]
    n.data.code =
      "void main(){gl_FragColor=vec4(texture2D(history,vUv).r+0.1,0.0,0.0,1.0);}"
    const p = project([n, h], [connect(n, h, 0), connect(h, n, 0)], n.id),
      { r, canvas } = await renderer(p)
    try {
      r.render(0)
      assert(
        Math.abs(pixels(canvas)[0] - 26) <= 1,
        "First frame must start empty"
      )
      r.render(1)
      assert(Math.abs(pixels(canvas)[0] - 52) <= 2, "History must advance once")
    } finally {
      r.dispose()
    }
    const next = await renderer(p)
    try {
      next.r.render(0)
      assert(
        Math.abs(pixels(next.canvas)[0] - 26) <= 1,
        "Reset must clear history"
      )
    } finally {
      next.r.dispose()
    }
  }
)
await check(
  "Previous frame captures any source and delay chains use immutable snapshots",
  async () => {
    const source = solid(1, 0, 0),
      a = makePass("previous"),
      b = makePass("previous")
    const { r, canvas } = await renderer(
      project([b, a, source], [connect(source, a, 0), connect(a, b, 0)], b.id)
    )
    try {
      r.render(0)
      assert(pixels(canvas)[0] === 0, "Frame zero is empty")
      r.render(1)
      assert(pixels(canvas)[0] === 0, "Two delays need two frames")
      r.render(2)
      assert(
        pixels(canvas)[0] === 255,
        "Arbitrary source should emerge after two frames"
      )
    } finally {
      r.dispose()
    }
  }
)
await check("p5 output feeds GLSL and setup runs once", async () => {
  const p = makePass("p5"),
    n = makePass("glsl")
  p.data.code =
    "function setup(p){p.red=64;} function draw(p,inputs,time,frame){p.background(p.red,frame===0?128:192,255);}"
  n.data.inputs = [port("source")]
  n.data.code = "void main(){gl_FragColor=texture2D(source,vUv);}"
  const { r, canvas } = await renderer(
    project([n, p], [connect(p, n, 0)], n.id)
  )
  try {
    r.render(0)
    let px = pixels(canvas)
    assert(
      px[0] === 64 && px[1] === 128 && px[2] === 255,
      "p5 to GLSL transfer failed"
    )
    r.render(1)
    px = pixels(canvas)
    assert(
      px[0] === 64 && px[1] === 192,
      "p5 persistent state or frame argument failed"
    )
  } finally {
    r.dispose()
  }
})
await check(
  "GLSL feeds named p5 images with consistent vertical orientation",
  async () => {
    const a = makePass("glsl"),
      p = makePass("p5")
    a.data.code =
      "void main(){gl_FragColor=vec4(vUv.y>0.5?1.0:0.0,0.0,0.0,1.0);}"
    p.data.inputs = [port("source"), port("missing")]
    p.data.code =
      'function draw(p,inputs){if(inputs.missing!==null)throw new Error("Missing input must be null");p.image(inputs.source,0,0,p.width,p.height);}'
    const { r, canvas } = await renderer(
      project([p, a], [connect(a, p, 0)], p.id)
    )
    try {
      r.render(0)
      const px = pixels(canvas)
      assert(
        px[0] === 0 && px[4 * 3 * 4] === 255,
        "GLSL/p5 input was vertically inverted"
      )
    } finally {
      r.dispose()
    }
  }
)
await check(
  "image sources preserve native dimensions through p5 and GLSL metadata",
  async () => {
    const image = makePass("image"),
      p = makePass("p5"),
      n = makePass("glsl"),
      asset = document.createElement("canvas")
    asset.width = 2
    asset.height = 3
    const ctx = asset.getContext("2d")!
    ctx.fillStyle = "red"
    ctx.fillRect(0, 0, 2, 1)
    ctx.fillStyle = "blue"
    ctx.fillRect(0, 1, 2, 2)
    image.data.image = {
      src: asset.toDataURL("image/png"),
      name: "test",
      width: 2,
      height: 3,
    }
    p.data.inputs = [port("source")]
    p.data.code =
      'function draw(p,inputs){if(inputs.source.width!==2||inputs.source.height!==3)throw new Error("Wrong native image size");p.image(inputs.source,0,0,p.width,p.height);}'
    n.data.inputs = [port("source")]
    n.data.code =
      "void main(){gl_FragColor=vec4(sourceResolution.x/2.0,sourceResolution.y/3.0,0.0,1.0);}"
    const { r, canvas } = await renderer(
      project(
        [image, p, n],
        [connect(image, p, 0), connect(image, n, 0)],
        n.id
      ),
      6
    )
    try {
      r.render(0)
      let px = pixels(canvas)
      assert(px[0] === 255 && px[1] === 255, "Native image metadata failed")
      r.render(1, p.id)
      px = pixels(canvas)
      assert(
        px[2] === 255 && px[5 * 6 * 4] === 255,
        "Image orientation or p5 transfer failed"
      )
    } finally {
      r.dispose()
    }
  }
)
await check(
  "invalid shaders produce pass-specific errors and clean up",
  async () => {
    const n = makePass("glsl")
    n.data.label = "Broken shader"
    n.data.code = "void main(){ this is invalid; }"
    let caught = ""
    try {
      await renderer(project([n]))
    } catch (error) {
      caught = String(error)
    }
    assert(
      caught.includes("Broken shader") && caught.includes("ERROR"),
      "Expected named compilation error"
    )
  }
)
await check(
  "all reusable passes compile and render with disconnected inputs",
  async () => {
    for (const preset of passPresets) {
      const { r } = await renderer(project([presetPass(preset.id)]), 64)
      try {
        r.render(0)
        r.render(0.2)
      } finally {
        r.dispose()
      }
    }
  }
)
await check(
  "creative multipass examples render non-empty evolving output",
  async () => {
    for (const example of creativeExamples) {
      const { r, canvas } = await renderer(creativeProject(example.id), 128)
      try {
        r.render(0)
        const first = pixels(canvas).slice()
        for (let i = 1; i <= 12; i++) r.render(i * 0.2)
        const last = pixels(canvas)
        assert(
          last.some((v, i) => i % 4 !== 3 && v > 30),
          `${example.label} is empty`
        )
        assert(
          last.some((v, i) => i % 4 !== 3 && Math.abs(v - first[i]) > 5),
          `${example.label} did not evolve`
        )
      } finally {
        r.dispose()
      }
    }
  }
)
await check(
  "snippet library helpers compile together in a real GLSL pass",
  async () => {
    const node = makePass("glsl")
    for (const s of glslSnippets)
      node.data.code = insertGLSLSnippet(node.data.code, s.id).code
    const { r } = await renderer(project([node]))
    try {
      r.render(0)
    } finally {
      r.dispose()
    }
  }
)
document.body.dataset.result = results.some((r) => r.startsWith("FAIL"))
  ? "failed"
  : "passed"
