import { validateGraph, type GeneratorConfig } from "./graph.ts"
import type { Edge, Node } from "@xyflow/react"
export type Category =
  "Inputs" | "Fields" | "Math" | "Color" | "Generators" | "Output"
export type Kind =
  | "image"
  | "alpha"
  | "composite"
  | "gradient"
  | "line"
  | "affine"
  | "ifsset"
  | "tile"
  | "tileset"
  | "uv"
  | "time"
  | "constant"
  | "noise"
  | "white"
  | "warp"
  | "palette"
  | "circle"
  | "box"
  | "ifs"
  | "wfc"
  | "previous"
  | "add"
  | "multiply"
  | "sine"
  | "mix"
  | "output"
  | "subtract"
  | "divide"
  | "fract"
  | "length"
  | "clamp"
  | "threshold"
  | "vector"
  | "color"
  | "transform"
  | "x"
  | "y"
export type ArtNode = Node<
  {
    kind: Kind
    params: Record<string, number>
    image?: { src: string; name: string; width: number; height: number }
    colors?: string[]
  },
  "art"
>
type Param = {
  key: string
  label: string
  min: number
  max: number
  value: number
  step: number
}
type Def = {
  title: string
  category: Category
  description: string
  inputs: string[]
  output: string
  color: string
  params: Param[]
}
const p = (
  key: string,
  label: string,
  min: number,
  max: number,
  value: number,
  step = 0.01
): Param => ({ key, label, min, max, value, step })
const d = (
  title: string,
  category: Category,
  description: string,
  inputs: string[],
  output: string,
  params: Param[] = []
): Def => ({
  title,
  category,
  description,
  inputs,
  output,
  params,
  color: (
    {
      Inputs: "#6399aa",
      Fields: "#9987bd",
      Color: "#c58e70",
      Generators: "#80a078",
      Math: "#7c93af",
      Output: "#65a593",
    } as Record<string, string>
  )[category],
})
export const definitions: Record<Kind, Def> = {
  image: d(
    "Image texture",
    "Inputs",
    "Import an image and sample it with transformed or warped coordinates. Transparent pixels retain their color; use Image alpha as a mask.",
    ["Coordinates"],
    "color",
    [p("opacity", "Opacity", 0, 1, 1)]
  ),
  alpha: d(
    "Image alpha",
    "Inputs",
    "Sample the transparency of an imported image. Choose the same image as your Image texture node.",
    ["Coordinates"],
    "scalar",
    []
  ),
  composite: d(
    "Composite",
    "Color",
    "Blend a foreground over a background using a mask and opacity. Modes: normal, multiply, screen, overlay, and add.",
    ["Background", "Foreground", "Mask"],
    "color",
    [p("opacity", "Opacity", 0, 1, 1), p("mode", "Mode", 0, 4, 0, 1)]
  ),
  gradient: d(
    "Custom palette",
    "Color",
    "Map a field through four editable color stops. Cycles, phase, and each color can be driven by uniforms.",
    ["Field", "Cycles", "Phase", "Color 1", "Color 2", "Color 3", "Color 4"],
    "color",
    [p("frequency", "Cycles", 0.2, 8, 1), p("offset", "Phase", 0, 1, 0)]
  ),
  line: d(
    "Line",
    "Generators",
    "A line segment driven by uniform Start, End, Width, and Softness inputs.",
    ["Coordinates", "Start", "End", "Width", "Softness"],
    "scalar",
    [
      p("ax", "Start X", 0, 1, 0.2),
      p("ay", "Start Y", 0, 1, 0.3),
      p("bx", "End X", 0, 1, 0.8),
      p("by", "End Y", 0, 1, 0.7),
      p("width", "Width", 0.001, 0.2, 0.015, 0.001),
      p("softness", "Softness", 0.001, 0.1, 0.005, 0.001),
    ]
  ),
  affine: d(
    "Affine transform",
    "Generators",
    "Define x′=a·x+b·y+tx, y′=c·x+d·y+ty and its selection weight. Uniform inputs can animate any coefficient.",
    ["A", "B", "C", "D", "Translate X", "Translate Y", "Weight"],
    "affine",
    [
      p("a", "A", -2, 2, 0.5),
      p("b", "B", -2, 2, 0),
      p("c", "C", -2, 2, 0),
      p("d", "D", -2, 2, 0.5),
      p("tx", "Translate X", -5, 5, 0),
      p("ty", "Translate Y", -5, 5, 0),
      p("weight", "Weight", 0.001, 100, 1),
    ]
  ),
  ifsset: d(
    "IFS system",
    "Generators",
    "Collect up to four transforms or nested IFS systems into a custom iteration system.",
    ["Transform 1", "Transform 2", "Transform 3", "Transform 4"],
    "ifs-set"
  ),
  tile: d(
    "Tile rule",
    "Generators",
    "Define tile artwork with a pixel graph; set matching edge labels and selection weight with uniforms. Labels are rounded to integers.",
    ["Image", "Top", "Right", "Bottom", "Left", "Weight"],
    "tile",
    [
      p("top", "Top label", 0, 15, 0, 1),
      p("right", "Right label", 0, 15, 0, 1),
      p("bottom", "Bottom label", 0, 15, 0, 1),
      p("left", "Left label", 0, 15, 0, 1),
      p("weight", "Weight", 0.001, 100, 1),
    ]
  ),
  tileset: d(
    "Tile set",
    "Generators",
    "Collect four tile rules or nested tile sets. Matching edge labels define allowed neighbors.",
    ["Tile 1", "Tile 2", "Tile 3", "Tile 4"],
    "tile-set"
  ),
  subtract: d(
    "Subtract",
    "Math",
    "Subtract two fields component by component.",
    ["A", "B"],
    "any",
    [p("value", "B fallback", -2, 2, 0.5)]
  ),
  divide: d(
    "Divide",
    "Math",
    "Divide fields with a guard against zero.",
    ["A", "B"],
    "any",
    [p("value", "B fallback", 0.01, 5, 2)]
  ),
  fract: d(
    "Fraction",
    "Math",
    "Keep the fractional part; useful for repeating patterns.",
    ["Field"],
    "any"
  ),
  length: d(
    "Length",
    "Math",
    "Distance from the origin of a two-dimensional vector.",
    ["Coordinates"],
    "scalar"
  ),
  clamp: d(
    "Clamp",
    "Math",
    "Keep values in the zero-to-one range.",
    ["Field"],
    "any"
  ),
  threshold: d(
    "Threshold",
    "Math",
    "Turn a field into a soft binary mask.",
    ["Field"],
    "scalar",
    [
      p("level", "Level", 0, 1, 0.5),
      p("softness", "Softness", 0.001, 0.2, 0.01, 0.001),
    ]
  ),
  vector: d(
    "Compose vector",
    "Math",
    "Combine scalar fields into sampling coordinates.",
    ["X", "Y"],
    "vector",
    [p("x", "X fallback", -2, 2, 0.5), p("y", "Y fallback", -2, 2, 0.5)]
  ),
  x: d(
    "X channel",
    "Math",
    "Extract the first channel of a vector or color.",
    ["Field"],
    "scalar"
  ),
  y: d(
    "Y channel",
    "Math",
    "Extract the second channel of a vector or color.",
    ["Field"],
    "scalar"
  ),
  color: d(
    "RGB color",
    "Color",
    "Compose a color from three scalar inputs or constant channel values.",
    ["Red", "Green", "Blue"],
    "color",
    [
      p("r", "Red", 0, 1, 0.8),
      p("g", "Green", 0, 1, 0.4),
      p("b", "Blue", 0, 1, 0.2),
    ]
  ),
  transform: d(
    "Transform",
    "Fields",
    "Scale, rotate, and translate sampling coordinates around the image center.",
    ["Coordinates"],
    "vector",
    [
      p("scale", "Scale", 0.1, 5, 1),
      p("angle", "Rotation", -180, 180, 0, 1),
      p("x", "Offset X", -1, 1, 0),
      p("y", "Offset Y", -1, 1, 0),
    ]
  ),
  uv: d(
    "Coordinates",
    "Inputs",
    "Normalized pixel coordinates, from 0 to 1.",
    [],
    "vector"
  ),
  time: d(
    "Time",
    "Inputs",
    "Playback time in seconds, scaled by speed.",
    [],
    "scalar",
    [p("speed", "Speed", 0, 3, 0.18)]
  ),
  constant: d("Value", "Inputs", "A constant scalar value.", [], "scalar", [
    p("value", "Value", -10, 10, 0.5),
  ]),
  previous: d(
    "Previous frame",
    "Inputs",
    "Sample the last rendered frame at connected coordinates. Reset clears history.",
    ["Coordinates"],
    "color",
    [p("decay", "Persistence", 0, 1, 0.92)]
  ),
  noise: d(
    "Perlin noise",
    "Fields",
    "Smooth gradient noise with four octaves. Connect Time to animate.",
    ["Coordinates", "Time"],
    "scalar",
    [
      p("scale", "Scale", 1, 12, 3.2),
      p("detail", "Detail", 0, 1, 0.55),
      p("seed", "Seed", 0, 100, 7, 1),
    ]
  ),
  white: d(
    "White noise",
    "Fields",
    "Independent pseudorandom values for every pixel.",
    ["Coordinates", "Time"],
    "scalar",
    [p("seed", "Seed", 0, 100, 12, 1)]
  ),
  warp: d(
    "Domain warp",
    "Fields",
    "Displace coordinates with a flowing noise field.",
    ["Coordinates", "Time"],
    "vector",
    [p("amount", "Strength", 0, 2, 0.65), p("scale", "Frequency", 1, 10, 3)]
  ),
  palette: d(
    "Color palette",
    "Color",
    "Map a scalar field to a smooth cosine gradient.",
    ["Field"],
    "color",
    [
      p("frequency", "Cycles", 0.2, 8, 2.4),
      p("offset", "Phase", 0, 1, 0.12),
      p("theme", "Palette", 0, 3, 0, 1),
    ]
  ),
  circle: d(
    "Circle",
    "Generators",
    "Uniform Center, Radius, and Softness inputs can be driven by Time and math.",
    ["Coordinates", "Center", "Radius", "Softness"],
    "scalar",
    [
      p("cx", "Center X", 0, 1, 0.5),
      p("cy", "Center Y", 0, 1, 0.5),
      p("radius", "Radius", 0.01, 0.7, 0.28),
      p("softness", "Softness", 0.001, 0.3, 0.012, 0.001),
    ]
  ),
  box: d(
    "Rectangle",
    "Generators",
    "Uniform Center, Size, and Softness inputs define an animated rectangular mask.",
    ["Coordinates", "Center", "Size", "Softness"],
    "scalar",
    [
      p("cx", "Center X", 0, 1, 0.5),
      p("cy", "Center Y", 0, 1, 0.5),
      p("width", "Width", 0.01, 1, 0.55),
      p("height", "Height", 0.01, 1, 0.35),
      p("softness", "Softness", 0.001, 0.2, 0.01),
    ]
  ),
  ifs: d(
    "IFS fractal",
    "Generators",
    "Iterate a custom IFS system. Transform coefficients, seed, and iteration count accept uniforms.",
    ["Coordinates", "System", "Seed", "Iterations"],
    "scalar",
    [
      p("seed", "Seed", 1, 100, 18, 1),
      p("iterations", "Iterations", 1000, 70000, 18000, 1000),
      p("minX", "View min X", -10, 10, 0),
      p("maxX", "View max X", -10, 10, 1),
      p("minY", "View min Y", -10, 10, 0),
      p("maxY", "View max Y", -10, 10, 1),
    ]
  ),
  wfc: d(
    "Wave collapse",
    "Generators",
    "Collapse a custom tile set with matching edge labels. Artwork is authored with pixel nodes.",
    ["Coordinates", "Tile set", "Seed", "Grid size"],
    "scalar",
    [p("seed", "Seed", 1, 100, 32, 1), p("grid", "Grid size", 8, 32, 16, 1)]
  ),
  add: d(
    "Add",
    "Math",
    "Add two fields or colors component by component.",
    ["A", "B"],
    "any",
    [p("value", "B fallback", -2, 2, 0.25)]
  ),
  multiply: d(
    "Multiply",
    "Math",
    "Multiply a color by a mask, or scale a field.",
    ["A", "B"],
    "any",
    [p("value", "B fallback", 0, 3, 1)]
  ),
  sine: d(
    "Sine",
    "Math",
    "Turn a field into repeating wave bands.",
    ["Field"],
    "scalar",
    [p("frequency", "Frequency", 1, 30, 10)]
  ),
  mix: d(
    "Blend",
    "Color",
    "Interpolate two colors or fields, optionally using a mask.",
    ["A", "B", "Mask"],
    "color",
    [p("amount", "Blend", 0, 1, 0.5)]
  ),
  output: d(
    "Image output",
    "Output",
    "The final image, rendered on the GPU.",
    ["Color"],
    ""
  ),
}
// Append new parameter sockets so saved graphs retain their original handle indices.
export const parameterPorts = {} as Record<Kind, Record<string, number>>
for (const kind of Object.keys(definitions) as Kind[]) {
  const def = definitions[kind]
  const ports: Record<string, number> = {}
  for (const param of def.params) {
    const aliases: Record<string, string> = {
      cx: "Center",
      cy: "Center",
      ax: "Start",
      ay: "Start",
      bx: "End",
      by: "End",
    }
    const label =
      kind === "box" && ["width", "height"].includes(param.key)
        ? "Size"
        : kind === "mix" && param.key === "amount"
          ? "Mask"
          : (aliases[param.key] ??
            param.label.replace(/ fallback$| label$/, ""))
    let index = def.inputs.indexOf(label)
    if (index < 0) {
      index = def.inputs.length
      def.inputs.push(label)
    }
    ports[param.key] = index
  }
  parameterPorts[kind] = ports
}
export const defaultColors = ["#16364a", "#339ee0", "#f4ab76", "#fff1c6"]
export function colorVector(color: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ]
}
export function makeNode(
  kind: Kind,
  id: string,
  x: number,
  y: number,
  params = {}
): ArtNode {
  return {
    id,
    type: "art",
    position: { x, y },
    data: {
      kind,
      params: {
        ...Object.fromEntries(
          definitions[kind].params.map((p) => [p.key, p.value])
        ),
        ...params,
      },
    },
  }
}
const edge = (source: string, target: string, input = 0): Edge => ({
  id: `${source}-${target}-${input}`,
  source,
  target,
  targetHandle: String(input),
})
export const presetNames = [
  "Chromatic flow",
  "Iridescent flow",
  "Soft geometry",
  "Custom IFS",
  "Custom tile garden",
  "Animated line",
]
export function preset(index: number): { nodes: ArtNode[]; edges: Edge[] } {
  const graph = presetGraph(index)
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: { ...node.position, y: node.position.y * 1.8 },
    })),
  }
}
function presetGraph(index: number): { nodes: ArtNode[]; edges: Edge[] } {
  if (index === 0)
    return {
      nodes: [
        makeNode("uv", "uv", 20, 50),
        makeNode("time", "time", 20, 250),
        makeNode("warp", "warp", 290, 60),
        makeNode("noise", "noise", 560, 60),
        makeNode("palette", "palette", 290, 330),
        makeNode("output", "out", 560, 340),
      ],
      edges: [
        edge("uv", "warp"),
        edge("time", "warp", 1),
        edge("warp", "noise"),
        edge("time", "noise", 1),
        edge("noise", "palette"),
        edge("palette", "out"),
      ],
    }
  if (index === 1)
    return {
      nodes: [
        makeNode("uv", "uv", 0, 0),
        makeNode("time", "time", 0, 190),
        makeNode("warp", "warp", 270, 0, { amount: 0.04 }),
        makeNode("previous", "prev", 540, 0, { decay: 1 }),
        makeNode("noise", "noise", 270, 250),
        makeNode("palette", "palette", 540, 250),
        makeNode("mix", "mix", 810, 100, { amount: 0.04 }),
        makeNode("output", "out", 1080, 100),
      ],
      edges: [
        edge("uv", "warp"),
        edge("time", "warp", 1),
        edge("warp", "prev"),
        edge("time", "noise", 1),
        edge("noise", "palette"),
        edge("prev", "mix"),
        edge("palette", "mix", 1),
        edge("mix", "out"),
      ],
    }
  if (index === 2 || index === 5) {
    const kind: Kind = index === 2 ? "circle" : "line"
    const nodes = [
      makeNode("time", "time", 0, 0, { speed: 0.8 }),
      makeNode("sine", "pulse", 250, 0, { frequency: 2 }),
      makeNode("multiply", "amplitude", 500, 0, {
        value: index === 2 ? 0.18 : 0.6,
      }),
      makeNode("add", "offset", 750, 0, { value: index === 2 ? 0.1 : 0.2 }),
      makeNode(kind, "generator", 750, 280),
      makeNode("palette", "palette", 1000, 280, { theme: 1, frequency: 1 }),
      makeNode("output", "out", 1250, 280),
    ]
    const edges = [
      edge("time", "pulse"),
      edge("pulse", "amplitude"),
      edge("amplitude", "offset"),
      edge("generator", "palette"),
      edge("palette", "out"),
    ]
    if (index === 2) edges.push(edge("offset", "generator", 2))
    else {
      nodes.push(makeNode("vector", "endpoint", 500, 280, { y: 0.8 }))
      edges.push(edge("offset", "endpoint"), edge("endpoint", "generator", 2))
    }
    return { nodes, edges }
  }
  if (index === 3)
    return {
      nodes: [
        makeNode("affine", "left", 0, 0),
        makeNode("affine", "right", 0, 340, { tx: 0.5 }),
        makeNode("affine", "top", 300, 0, { tx: 0.25, ty: 0.5 }),
        makeNode("ifsset", "system", 600, 50),
        makeNode("ifs", "generator", 900, 50),
        makeNode("palette", "palette", 1200, 50, {
          theme: 2,
          frequency: 1,
          offset: 0,
        }),
        makeNode("output", "out", 1500, 50),
      ],
      edges: [
        edge("left", "system"),
        edge("right", "system", 1),
        edge("top", "system", 2),
        edge("system", "generator", 1),
        edge("generator", "palette"),
        edge("palette", "out"),
      ],
    }
  return {
    nodes: [
      makeNode("line", "vertical", 0, 0, {
        ax: 0.5,
        ay: 0,
        bx: 0.5,
        by: 1,
        width: 0.07,
      }),
      makeNode("line", "horizontal", 0, 360, {
        ax: 0,
        ay: 0.5,
        bx: 1,
        by: 0.5,
        width: 0.07,
      }),
      makeNode("add", "cross", 300, 0),
      makeNode("constant", "blank", 300, 300, { value: 0 }),
      makeNode("tile", "v-rule", 600, 0, { top: 1, bottom: 1 }),
      makeNode("tile", "h-rule", 600, 400, { left: 1, right: 1 }),
      makeNode("tile", "cross-rule", 900, 0, {
        top: 1,
        right: 1,
        bottom: 1,
        left: 1,
      }),
      makeNode("tile", "blank-rule", 900, 400),
      makeNode("tileset", "tiles", 1200, 100),
      makeNode("wfc", "generator", 1500, 100),
      makeNode("palette", "palette", 1800, 100, { theme: 1, frequency: 1 }),
      makeNode("output", "out", 2100, 100),
    ],
    edges: [
      edge("vertical", "cross"),
      edge("horizontal", "cross", 1),
      edge("vertical", "v-rule"),
      edge("horizontal", "h-rule"),
      edge("cross", "cross-rule"),
      edge("blank", "blank-rule"),
      edge("v-rule", "tiles"),
      edge("h-rule", "tiles", 1),
      edge("cross-rule", "tiles", 2),
      edge("blank-rule", "tiles", 3),
      edge("tiles", "generator", 1),
      edge("generator", "palette"),
      edge("palette", "out"),
    ],
  }
}

const f = (v: number) => (Number.isFinite(v) ? v.toFixed(5) : "0.0")
export function compile(nodes: ArtNode[], edges: Edge[]) {
  validateGraph(nodes, edges)
  const output = nodes.find((n) => n.data.kind === "output")
  if (!output) throw new Error("Add an Image output node to render your graph.")
  const lines: string[] = [],
    done = new Map<string, string>(),
    visiting = new Set<string>(),
    textures: ArtNode[] = []
  function visit(id: string): string {
    if (visiting.has(id))
      throw new Error("Graph cycle detected. Use Previous frame for feedback.")
    if (done.has(id)) return done.get(id)!
    const n = nodes.find((n) => n.id === id)
    if (!n) throw new Error("A connected node is missing.")
    visiting.add(id)
    const { kind, params: p } = n.data
    const input = (i: number, fallback: string) => {
      const e = edges.find(
        (e) => e.target === id && e.targetHandle === String(i)
      )
      return e ? visit(e.source) : fallback
    }
    const param = (key: string) => {
      const port = parameterPorts[kind][key]
      return port === undefined
        ? f(p[key])
        : `(${input(port, `vec3(${f(p[key])})`)}.x)`
    }
    let expr = ""
    switch (kind) {
      case "uv":
        expr = "vec3(vUv,0.)"
        break
      case "time":
        expr = `vec3(uTime*${param("speed")})`
        break
      case "constant":
        expr = `vec3(${param("value")})`
        break
      case "warp": {
        const uv = input(0, "vec3(vUv,0.)"),
          t = input(1, "vec3(0.)")
        expr = `vec3(${uv}.xy+${param("amount")}*vec2(fbm(${uv}.xy*${param("scale")}+${t}.x)-.5,fbm(${uv}.yx*${param("scale")}-${t}.x+12.)-.5),0.)`
        break
      }
      case "noise": {
        const uv = input(0, "vec3(vUv,0.)"),
          t = input(1, "vec3(0.)")
        expr = `vec3(mix(perlin(${uv}.xy*${param("scale")}+${t}.x+${param("seed")}),fbm(${uv}.xy*${param("scale")}+${t}.x+${param("seed")}),${param("detail")}))`
        break
      }
      case "white":
        expr = `vec3(hash(${input(0, "vec3(vUv,0.)")}.xy*uResolution+${input(1, "vec3(0.)")}.x+${param("seed")}))`
        break
      case "palette": {
        expr = `paletteColor(${input(0, "vec3(0.)")}.x,${param("frequency")},${param("offset")},${param("theme")})`
        break
      }
      case "gradient": {
        const colors = (n.data.colors ?? defaultColors).map((color, i) =>
          input(i + 3, `vec3(${colorVector(color).map(f).join(",")})`)
        )
        expr = `colorRamp(clamp(${input(0, "vec3(0.)")}.x*${param("frequency")}+${param("offset")},0.,1.),${colors.join(",")})`
        break
      }
      case "composite":
        expr = `mix(${input(0, "vec3(0.)")},blendColor(${input(0, "vec3(0.)")},${input(1, "vec3(1.)")},${param("mode")}),clamp(${input(2, "vec3(1.)")}*${param("opacity")},0.,1.))`
        break
      case "subtract":
        expr = `(${input(0, "vec3(0.)")}-${input(1, `vec3(${f(p.value)})`)})`
        break
      case "divide": {
        const b = input(1, `vec3(${f(p.value)})`)
        expr = `(${input(0, "vec3(0.)")}/(mix(vec3(-1.),vec3(1.),step(vec3(0.),${b}))*max(abs(${b}),vec3(.00001))))`
        break
      }
      case "fract":
        expr = `fract(${input(0, "vec3(vUv,0.)")})`
        break
      case "length":
        expr = `vec3(length(${input(0, "vec3(vUv,0.)")}.xy))`
        break
      case "clamp":
        expr = `clamp(${input(0, "vec3(0.)")},0.,1.)`
        break
      case "threshold":
        expr = `smoothstep(vec3(${param("level")}-${param("softness")}),vec3(${param("level")}+max(.0001,${param("softness")})),${input(0, "vec3(0.)")})`
        break
      case "vector":
        expr = `vec3(${input(0, `vec3(${f(p.x)})`)}.x,${input(1, `vec3(${f(p.y)})`)}.x,0.)`
        break
      case "x":
      case "y":
        expr = `vec3(${input(0, "vec3(vUv,0.)")}.${kind})`
        break
      case "color":
        expr = `vec3(${input(0, `vec3(${f(p.r)})`)}.x,${input(1, `vec3(${f(p.g)})`)}.x,${input(2, `vec3(${f(p.b)})`)}.x)`
        break
      case "transform": {
        const a = `(${param("angle")}*0.01745329252)`
        expr = `vec3(mat2(cos(${a}),sin(${a}),-sin(${a}),cos(${a}))*(${input(0, "vec3(vUv,0.)")}.xy-.5)*${param("scale")}+.5+vec2(${param("x")},${param("y")}),0.)`
        break
      }
      case "circle": {
        const uv = input(0, "vec3(vUv,0.)"),
          center = input(1, `vec3(${f(p.cx)},${f(p.cy)},0.)`),
          radius = input(2, `vec3(${f(p.radius)})`),
          soft = input(3, `vec3(${f(p.softness)})`)
        expr = `vec3(1.-smoothstep(max(.0,${radius}.x),max(.0,${radius}.x)+max(.0001,${soft}.x),length(${uv}.xy-${center}.xy)))`
        break
      }
      case "box": {
        const uv = input(0, "vec3(vUv,0.)"),
          center = input(1, `vec3(${f(p.cx)},${f(p.cy)},0.)`),
          size = input(2, `vec3(${f(p.width)},${f(p.height)},0.)`),
          soft = input(3, `vec3(${f(p.softness)})`)
        expr = `vec3(1.-smoothstep(0.,max(.0001,${soft}.x),max(abs(${uv}.x-${center}.x)-abs(${size}.x)*.5,abs(${uv}.y-${center}.y)-abs(${size}.y)*.5)))`
        break
      }
      case "line": {
        const uv = input(0, "vec3(vUv,0.)"),
          a = input(1, `vec3(${f(p.ax)},${f(p.ay)},0.)`),
          b = input(2, `vec3(${f(p.bx)},${f(p.by)},0.)`),
          width = input(3, `vec3(${f(p.width)})`),
          soft = input(4, `vec3(${f(p.softness)})`)
        expr = `vec3(1.-smoothstep(max(0.,${width}.x),max(0.,${width}.x)+max(.0001,${soft}.x),segmentDistance(${uv}.xy,${a}.xy,${b}.xy)))`
        break
      }
      case "affine":
      case "ifsset":
      case "tile":
      case "tileset":
        throw new Error(
          "Connect definition nodes to an IFS or WFC generator, not directly to pixel inputs."
        )
      case "image":
      case "alpha":
      case "ifs":
      case "wfc": {
        const i = textures.length
        textures.push(n)
        expr =
          kind === "alpha"
            ? `vec3(texture2D(uTex${i},${input(0, "vec3(vUv,0.)")}.xy).a)`
            : `texture2D(uTex${i},${input(0, "vec3(vUv,0.)")}.xy).rgb${kind === "image" ? `*${param("opacity")}` : ""}`
        break
      }
      case "previous":
        expr = `(texture2D(uPrevious,${input(0, "vec3(vUv,0.)")}.xy).rgb*${param("decay")})`
        break
      case "add":
        expr = `(${input(0, "vec3(0.)")}+${input(1, `vec3(${f(p.value)})`)})`
        break
      case "multiply":
        expr = `(${input(0, "vec3(1.)")}*${input(1, `vec3(${f(p.value)})`)})`
        break
      case "sine":
        expr = `(.5+.5*sin(${input(0, "vec3(vUv,0.)")}*${param("frequency")}))`
        break
      case "mix":
        expr = `mix(${input(0, "vec3(0.)")},${input(1, "vec3(1.)")},clamp(${input(2, `vec3(${f(p.amount)})`)},0.,1.))`
        break
      case "output":
        expr = input(0, "vec3(0.)")
        break
    }
    const name = `n${done.size}`
    lines.push(`vec3 ${name} = ${expr};`)
    done.set(id, name)
    visiting.delete(id)
    return name
  }
  const result = visit(output.id)
  return {
    textures,
    source: `precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;
uniform sampler2D uPrevious;
${textures.map((_, i) => `uniform sampler2D uTex${i};`).join("\n")}
vec3 colorRamp(float t,vec3 a,vec3 b,vec3 c,vec3 d){return t<.333333?mix(a,b,t*3.):t<.666667?mix(b,c,t*3.-1.):mix(c,d,t*3.-2.);}
vec3 blendColor(vec3 a,vec3 b,float mode){if(mode<.5)return b;if(mode<1.5)return a*b;if(mode<2.5)return 1.-(1.-a)*(1.-b);if(mode<3.5)return mix(2.*a*b,1.-2.*(1.-a)*(1.-b),step(vec3(.5),a));return a+b;}
vec3 paletteColor(float t,float cycles,float phase,float theme){if(theme<.5)return .62+.34*cos(6.2831853*(t*cycles+phase+vec3(.05,.23,.43)));if(theme<1.5)return mix(vec3(.22,.19,.35),vec3(.96,.68,.44),.5-.5*cos(t*cycles*3.14159265+phase));if(theme<2.5)return mix(vec3(.08,.23,.17),vec3(.83,.88,.57),clamp(t*cycles+phase,0.,1.));return mix(vec3(.06,.24,.32),vec3(.57,.89,.82),.5+.5*sin(t*cycles*6.2831853+phase));}
float segmentDistance(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;float t=clamp(dot(p-a,ab)/max(dot(ab,ab),.000001),0.,1.);return length(p-a-t*ab);}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec2 gradient(vec2 p){float a=hash(p)*6.2831853;return vec2(cos(a),sin(a));}
float perlin(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);return .5+.7*mix(mix(dot(gradient(i),f),dot(gradient(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(gradient(i+vec2(0,1)),f-vec2(0,1)),dot(gradient(i+vec2(1)),f-vec2(1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.533333;for(int i=0;i<4;i++){v+=a*perlin(p);p=p*2.03+7.1;a*=.5;}return v;}
void main(){${lines.join("\n")}gl_FragColor=vec4(clamp(${result},0.,1.),1.);}`,
  }
}
export function generateTexture(node: ArtNode, config?: GeneratorConfig) {
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 512
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, 512, 512)
  let seed = (config?.seed ?? node.data.params.seed) | 0
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) | 0
    return (seed >>> 0) / 4294967296
  }
  if (node.data.kind === "ifs") {
    let x = 0,
      y = 0
    ctx.fillStyle = "#fff"
    const transforms = config?.transforms ?? [
      { matrix: [0, 0, 0, 0.16, 0, 0], weight: 1 },
      { matrix: [0.85, 0.04, -0.04, 0.85, 0, 1.6], weight: 85 },
      { matrix: [0.2, -0.26, 0.23, 0.22, 0, 1.6], weight: 7 },
      { matrix: [-0.15, 0.28, 0.26, 0.24, 0, 0.44], weight: 7 },
    ]
    const total = transforms.reduce((sum, t) => sum + t.weight, 0)
    const iterations = Math.round(
      Math.max(
        1000,
        Math.min(
          70000,
          config?.iterations ?? node.data.params.iterations ?? 18000
        )
      )
    )
    const custom = Boolean(config?.transforms)
    const minX = config?.bounds?.[0] ?? (custom ? node.data.params.minX : -2.7),
      maxX = config?.bounds?.[1] ?? (custom ? node.data.params.maxX : 2.7),
      minY = config?.bounds?.[2] ?? (custom ? node.data.params.minY : 0),
      maxY = config?.bounds?.[3] ?? (custom ? node.data.params.maxY : 10.5)
    if (maxX <= minX || maxY <= minY)
      throw new Error("IFS view maximum must exceed minimum.")
    for (let i = 0; i < iterations; i++) {
      let choice = random() * total
      let transform = transforms[transforms.length - 1]
      for (const t of transforms) {
        choice -= t.weight
        if (choice <= 0) {
          transform = t
          break
        }
      }
      const [a, b, c, d, tx, ty] = transform.matrix,
        ox = x
      x = a * x + b * y + tx
      y = c * ox + d * y + ty
      if (!Number.isFinite(x) || !Number.isFinite(y))
        throw new Error("IFS diverged. Reduce transform scales.")
      if (i > 20)
        ctx.fillRect(
          ((x - minX) / (maxX - minX)) * 512,
          512 - ((y - minY) / (maxY - minY)) * 512,
          1.6,
          1.6
        )
    }
  } else {
    const n = Math.round(
        Math.max(8, Math.min(32, config?.grid ?? node.data.params.grid))
      ),
      size = 512 / n
    const cells = collapseTiles(n, random, config?.tiles)
    ctx.strokeStyle = "#fff"
    ctx.fillStyle = "#fff"
    ctx.lineWidth = size * 0.15
    ctx.lineCap = "round"
    cells.forEach((c, i) => {
      if (config?.tiles) {
        const tile = config.tiles[c]
        ctx.drawImage(
          tile.image!,
          (i % n) * size,
          Math.floor(i / n) * size,
          size,
          size
        )
        return
      }
      const t = c,
        x = ((i % n) + 0.5) * size,
        y = (Math.floor(i / n) + 0.5) * size
      for (const [bit, dx, dy] of [
        [1, 0, -0.5],
        [2, 0.5, 0],
        [4, 0, 0.5],
        [8, -0.5, 0],
      ])
        if (t & bit) {
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x + dx * size, y + dy * size)
          ctx.stroke()
        }
      if (t) {
        ctx.beginPath()
        ctx.arc(x, y, size * 0.075, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  }
  return canvas
}

export function collapseTiles(
  n: number,
  random: () => number,
  custom?: GeneratorConfig["tiles"]
): number[] {
  const tiles = custom ? custom.map((_, i) => i) : [0, 3, 6, 12, 9, 5, 10, 15]
  if (!tiles.length) throw new Error("Connect at least one tile rule.")
  let cells: number[][] = []
  for (let attempt = 0; attempt < 20; attempt++) {
    cells = Array.from({ length: n * n }, () => [...tiles])
    let failed = false
    for (;;) {
      let min = tiles.length + 1,
        candidates: number[] = []
      cells.forEach((c, i) => {
        if (c.length > 1 && c.length < min) {
          min = c.length
          candidates = [i]
        } else if (c.length === min) candidates.push(i)
      })
      if (!candidates.length) break
      const chosen = candidates[Math.floor(random() * candidates.length)]
      const options = cells[chosen],
        total = options.reduce((sum, t) => sum + (custom?.[t].weight ?? 1), 0)
      let pick = random() * total,
        chosenTile = options[options.length - 1]
      for (const t of options) {
        pick -= custom?.[t].weight ?? 1
        if (pick <= 0) {
          chosenTile = t
          break
        }
      }
      cells[chosen] = [chosenTile]
      const queue = [chosen]
      while (queue.length && !failed) {
        const i = queue.shift()!,
          x = i % n,
          y = Math.floor(i / n)
        for (const [nx, ny, a, b] of [
          [x, y - 1, 1, 4],
          [x + 1, y, 2, 8],
          [x, y + 1, 4, 1],
          [x - 1, y, 8, 2],
        ]) {
          if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue
          const j = ny * n + nx,
            filtered = cells[j].filter((t) =>
              cells[i].some((s) =>
                custom
                  ? custom[s].sockets[[1, 2, 4, 8].indexOf(a)] ===
                    custom[t].sockets[[1, 2, 4, 8].indexOf(b)]
                  : Boolean(s & a) === Boolean(t & b)
              )
            )
          if (!filtered.length) {
            failed = true
            break
          }
          if (filtered.length < cells[j].length) {
            cells[j] = filtered
            queue.push(j)
          }
        }
      }
      if (failed) break
    }
    if (!failed) return cells.map((c) => c[0])
  }

  throw new Error(
    "Tile constraints could not be solved. Check matching edge labels or try another seed."
  )
}
