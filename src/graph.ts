import {
  definitions,
  parameterPorts,
  defaultColors,
  colorVector,
  type ArtNode,
  type Kind,
} from "./engine.ts"
import type { Edge, Connection } from "@xyflow/react"
import { sampleImage } from "./image-assets.ts"
export type Scope = "uniform" | "fragment"
export type ValueType = "numeric" | "affine" | "ifs-set" | "tile" | "tile-set"
export type GraphType = { type: ValueType; scope: Scope }
export type Affine = { matrix: number[]; weight: number }
export type TileRule = {
  sockets: number[]
  weight: number
  image?: HTMLCanvasElement
  imageNode?: string
}
export type GeneratorConfig = {
  seed: number
  iterations?: number
  grid?: number
  transforms?: Affine[]
  tiles?: TileRule[]
  bounds?: number[]
}
const structural: Partial<Record<Kind, ValueType>> = {
  affine: "affine",
  ifsset: "ifs-set",
  tile: "tile",
  tileset: "tile-set",
}
export function parameterInput(kind: Kind, key: string): number | undefined {
  return parameterPorts[kind][key]
}
export function inputSpec(
  kind: Kind,
  index: number
): { types: ValueType[]; uniform: boolean } {
  if (kind === "ifs" && index === 1)
    return { types: ["affine", "ifs-set"], uniform: true }
  if (kind === "wfc" && index === 1)
    return { types: ["tile", "tile-set"], uniform: true }
  if (kind === "ifsset") return { types: ["affine", "ifs-set"], uniform: true }
  if (kind === "tileset") return { types: ["tile", "tile-set"], uniform: true }
  return {
    types: ["numeric"],
    uniform:
      (kind === "gradient" && index > 0) ||
      (Object.values(parameterPorts[kind]).includes(index) &&
        ![
          "color",
          "vector",
          "add",
          "subtract",
          "multiply",
          "divide",
          "mix",
        ].includes(kind)) ||
      kind === "affine" ||
      (kind === "tile" && index > 0) ||
      ((kind === "ifs" || kind === "wfc") && index > 1) ||
      (["circle", "box", "line"].includes(kind) && index > 0),
  }
}
export function graphTypes(
  nodes: ArtNode[],
  edges: Edge[]
): Map<string, GraphType> {
  const result = new Map<string, GraphType>(),
    visiting = new Set<string>()
  const visit = (id: string): GraphType => {
    if (result.has(id)) return result.get(id)!
    if (visiting.has(id))
      throw new Error("Graph cycle detected. Use Previous frame for feedback.")
    const node = nodes.find((n) => n.id === id)
    if (!node) throw new Error("A connected node is missing.")
    visiting.add(id)
    const kind = node.data.kind
    let scope: Scope = [
      "uv",
      "previous",
      "ifs",
      "wfc",
      "image",
      "alpha",
    ].includes(kind)
      ? "fragment"
      : "uniform"
    const implicitCoordinates = [
      "noise",
      "white",
      "warp",
      "circle",
      "box",
      "line",
      "transform",
      "length",
      "fract",
      "sine",
      "x",
      "y",
    ].includes(kind)
    if (
      implicitCoordinates &&
      !edges.some((e) => e.target === id && e.targetHandle === "0")
    )
      scope = "fragment"
    for (const e of edges.filter((e) => e.target === id)) {
      const index = Number(e.targetHandle)
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= definitions[kind].inputs.length
      )
        throw new Error("Invalid input socket.")
      const source = visit(e.source),
        spec = inputSpec(kind, index)
      if (!spec.types.includes(source.type))
        throw new Error(
          `${definitions[kind].title} · ${definitions[kind].inputs[index]} requires ${spec.types.join(" or ")} data.`
        )
      if (spec.uniform && source.scope === "fragment")
        throw new Error(
          `${definitions[kind].title} · ${definitions[kind].inputs[index]} requires a uniform. Pixel values vary across the image; use Time, Value, and uniform math.`
        )
      if (source.scope === "fragment" && !(kind === "tile" && index === 0))
        scope = "fragment"
    }
    const value = { type: structural[kind] ?? "numeric", scope }
    result.set(id, value)
    visiting.delete(id)
    return value
  }
  nodes.forEach((n) => visit(n.id))
  return result
}
export function validateGraph(nodes: ArtNode[], edges: Edge[]) {
  graphTypes(nodes, edges)
}
export function canConnect(
  connection: Connection | Edge,
  nodes: ArtNode[],
  edges: Edge[]
): boolean {
  if (connection.source === connection.target) return false
  try {
    validateGraph(nodes, [
      ...edges.filter(
        (e) =>
          !(
            e.target === connection.target &&
            e.targetHandle === connection.targetHandle
          )
      ),
      { ...connection, id: "candidate" } as Edge,
    ])
    return true
  } catch {
    return false
  }
}
export function newNodeId(): string {
  // Local graph identifiers need uniqueness, not a secure context or cryptographic randomness.
  return `node-${Date.now().toString(36)}-${nextId++}`
}
let nextId = 0
export function seededRandom(initial: number) {
  let seed = initial | 0
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) | 0
    return (seed >>> 0) / 4294967296
  }
}
type V = [number, number, number]
const vec = (n: number): V => [n, n, n]
const fract = (n: number) => n - Math.floor(n)
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (a: number, b: number, n: number) => {
  const t = clamp((n - a) / Math.max(0.000001, b - a))
  return t * t * (3 - 2 * t)
}
const hash = (x: number, y: number) =>
  fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453)
function perlin(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = fract(x),
    fy = fract(y),
    ease = (n: number) => n * n * n * (n * (n * 6 - 15) + 10),
    dot = (dx: number, dy: number) => {
      const angle = hash(ix + dx, iy + dy) * Math.PI * 2
      return Math.cos(angle) * (fx - dx) + Math.sin(angle) * (fy - dy)
    }
  return (
    0.5 +
    0.7 *
      mix(
        mix(dot(0, 0), dot(1, 0), ease(fx)),
        mix(dot(0, 1), dot(1, 1), ease(fx)),
        ease(fy)
      )
  )
}
function fbm(x: number, y: number) {
  let sum = 0,
    a = 0.533333
  for (let i = 0; i < 4; i++) {
    sum += a * perlin(x, y)
    x = x * 2.03 + 7.1
    y = y * 2.03 + 7.1
    a *= 0.5
  }
  return sum
}
export function numericEvaluator(nodes: ArtNode[], edges: Edge[]) {
  const byId = new Map(nodes.map((n) => [n.id, n])),
    connections = new Map(
      edges.map((e) => [`${e.target}/${e.targetHandle}`, e.source])
    )
  return function evaluate(id: string, time: number, uv: V = [0.5, 0.5, 0]): V {
    const values = new Map<string, V>(),
      visiting = new Set<string>()
    const visit = (id: string): V => {
      if (values.has(id)) return values.get(id)!
      if (visiting.has(id)) throw new Error("Numeric graph contains a cycle.")
      const node = byId.get(id)
      if (!node) throw new Error("Uniform input is missing.")
      visiting.add(id)
      const { kind } = node.data
      const input = (i: number, fallback: V): V => {
        const source = connections.get(`${id}/${i}`)
        return source ? visit(source) : fallback
      }
      const scalar = (i: number, v: number) => input(i, vec(v))[0]
      const p = { ...node.data.params }
      for (const [key, port] of Object.entries(parameterPorts[kind])) {
        const channel =
          ["cy", "ay", "by"].includes(key) ||
          (kind === "box" && key === "height")
            ? 1
            : 0
        p[key] = input(port, vec(p[key]))[channel]
      }
      let v: V
      switch (kind) {
        case "uv":
          v = uv
          break
        case "image":
        case "alpha": {
          const coordinates = input(0, uv),
            sampled = sampleImage(
              node.data.image?.src,
              coordinates[0],
              coordinates[1]
            )
          v =
            kind === "alpha"
              ? vec(sampled[3])
              : (sampled.slice(0, 3).map((value) => value * p.opacity) as V)
          break
        }
        case "time":
          v = vec(time * p.speed)
          break
        case "constant":
          v = vec(p.value)
          break
        case "color":
          v = [scalar(0, p.r), scalar(1, p.g), scalar(2, p.b)]
          break
        case "vector":
          v = [scalar(0, p.x), scalar(1, p.y), 0]
          break
        case "x":
        case "y":
          v = vec(input(0, uv)[kind === "x" ? 0 : 1])
          break
        case "add":
        case "subtract":
        case "multiply":
        case "divide": {
          const a = input(0, vec(kind === "multiply" ? 1 : 0)),
            b = input(1, vec(p.value))
          v = a.map((a, i) =>
            kind === "add"
              ? a + b[i]
              : kind === "subtract"
                ? a - b[i]
                : kind === "multiply"
                  ? a * b[i]
                  : a /
                    (Math.sign(b[i]) || 1) /
                    Math.max(0.00001, Math.abs(b[i]))
          ) as V
          break
        }
        case "sine":
          v = input(0, uv).map(
            (n) => 0.5 + 0.5 * Math.sin(n * p.frequency)
          ) as V
          break
        case "fract":
          v = input(0, uv).map(fract) as V
          break
        case "clamp":
          v = input(0, vec(0)).map((n) => clamp(n)) as V
          break
        case "length": {
          const a = input(0, uv)
          v = vec(Math.hypot(a[0], a[1]))
          break
        }
        case "threshold":
          v = input(0, vec(0)).map((n) =>
            smooth(p.level - p.softness, p.level + p.softness, n)
          ) as V
          break
        case "mix": {
          const a = input(0, vec(0)),
            b = input(1, vec(1)),
            m = input(2, vec(p.amount))
          v = a.map((a, i) => mix(a, b[i], clamp(m[i]))) as V
          break
        }
        case "transform": {
          const a = input(0, uv),
            angle = (p.angle * Math.PI) / 180,
            x = (a[0] - 0.5) * p.scale,
            y = (a[1] - 0.5) * p.scale
          v = [
            Math.cos(angle) * x - Math.sin(angle) * y + 0.5 + p.x,
            Math.sin(angle) * x + Math.cos(angle) * y + 0.5 + p.y,
            0,
          ]
          break
        }
        case "noise": {
          const a = input(0, uv),
            t = scalar(1, 0),
            x = a[0] * p.scale + t + p.seed,
            y = a[1] * p.scale + t + p.seed
          v = vec(mix(perlin(x, y), fbm(x, y), p.detail))
          break
        }
        case "white": {
          const a = input(0, uv),
            t = scalar(1, 0)
          v = vec(hash(a[0] * 512 + t + p.seed, a[1] * 512 + t + p.seed))
          break
        }
        case "warp": {
          const a = input(0, uv),
            t = scalar(1, 0)
          v = [
            a[0] +
              p.amount * (fbm(a[0] * p.scale + t, a[1] * p.scale + t) - 0.5),
            a[1] +
              p.amount *
                (fbm(a[1] * p.scale - t + 12, a[0] * p.scale - t + 12) - 0.5),
            0,
          ]
          break
        }
        case "palette": {
          const a = scalar(0, 0),
            theme = Math.round(p.theme)
          if (theme === 1)
            v = [0.22, 0.19, 0.35].map((c, i) =>
              mix(
                c,
                [0.96, 0.68, 0.44][i],
                0.5 - 0.5 * Math.cos(a * p.frequency * Math.PI + p.offset)
              )
            ) as V
          else if (theme === 2)
            v = [0.08, 0.23, 0.17].map((c, i) =>
              mix(c, [0.83, 0.88, 0.57][i], clamp(a * p.frequency + p.offset))
            ) as V
          else if (theme === 3)
            v = [0.06, 0.24, 0.32].map((c, i) =>
              mix(
                c,
                [0.57, 0.89, 0.82][i],
                0.5 + 0.5 * Math.sin(a * p.frequency * 2 * Math.PI + p.offset)
              )
            ) as V
          else
            v = [0.05, 0.23, 0.43].map(
              (c) =>
                0.62 +
                0.34 * Math.cos(2 * Math.PI * (a * p.frequency + p.offset + c))
            ) as V
          break
        }
        case "circle": {
          const a = input(0, uv),
            c = input(1, [p.cx, p.cy, 0]),
            r = Math.max(0, scalar(2, p.radius)),
            soft = Math.max(0.0001, scalar(3, p.softness))
          v = vec(1 - smooth(r, r + soft, Math.hypot(a[0] - c[0], a[1] - c[1])))
          break
        }
        case "box": {
          const a = input(0, uv),
            c = input(1, [p.cx, p.cy, 0]),
            size = input(2, [p.width, p.height, 0])
          v = vec(
            1 -
              smooth(
                0,
                Math.max(0.0001, scalar(3, p.softness)),
                Math.max(
                  Math.abs(a[0] - c[0]) - Math.abs(size[0]) * 0.5,
                  Math.abs(a[1] - c[1]) - Math.abs(size[1]) * 0.5
                )
              )
          )
          break
        }
        case "line": {
          const q = input(0, uv),
            a = input(1, [p.ax, p.ay, 0]),
            b = input(2, [p.bx, p.by, 0]),
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            t = clamp(
              ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) /
                Math.max(0.000001, dx * dx + dy * dy)
            ),
            w = Math.max(0, scalar(3, p.width))
          v = vec(
            1 -
              smooth(
                w,
                w + Math.max(0.0001, scalar(4, p.softness)),
                Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy)
              )
          )
          break
        }
        case "gradient": {
          const t = clamp(scalar(0, 0) * p.frequency + p.offset) * 3
          const segment = Math.min(2, Math.floor(t)),
            fraction = t - segment
          const colors = (node.data.colors ?? defaultColors).map((color, i) =>
            input(i + 3, colorVector(color))
          )
          v = colors[segment].map((n, i) =>
            mix(n, colors[segment + 1][i], fraction)
          ) as V
          break
        }
        case "composite": {
          const a = input(0, vec(0)),
            b = input(1, vec(1)),
            mask = input(2, vec(1))
          v = a.map((n, i) => {
            const mode = Math.round(p.mode),
              foreground = b[i]
            const blended =
              mode === 1
                ? n * foreground
                : mode === 2
                  ? 1 - (1 - n) * (1 - foreground)
                  : mode === 3
                    ? n < 0.5
                      ? 2 * n * foreground
                      : 1 - 2 * (1 - n) * (1 - foreground)
                    : mode === 4
                      ? n + foreground
                      : foreground
            return mix(n, blended, clamp(mask[i] * p.opacity))
          }) as V
          break
        }
        case "output":
          v = input(0, vec(0))
          break
        default:
          throw new Error(
            "Tile artwork supports numeric pixel nodes; nested IFS, WFC, and Previous frame textures are not supported inside a tile."
          )
      }
      if (!v.every(Number.isFinite))
        throw new Error(
          `${definitions[kind].title} produced a non-finite uniform.`
        )
      values.set(id, v)
      visiting.delete(id)
      return v
    }
    return visit(id)
  }
}
export function resolveGenerator(
  node: ArtNode,
  nodes: ArtNode[],
  edges: Edge[],
  time: number,
  rasterize = true
): GeneratorConfig {
  const evaluate = numericEvaluator(nodes, edges),
    source = (id: string, i: number) =>
      edges.find((e) => e.target === id && e.targetHandle === String(i))?.source
  const scalar = (id: string, i: number, fallback: number) => {
    const s = source(id, i)
    return s ? evaluate(s, time)[0] : fallback
  }
  const config: GeneratorConfig = {
    seed: Math.round(scalar(node.id, 2, node.data.params.seed)),
  }
  if (node.data.kind === "ifs") {
    config.iterations = scalar(node.id, 3, node.data.params.iterations)
    const boundsKeys = ["minX", "maxX", "minY", "maxY"]
    if (
      source(node.id, 1) ||
      boundsKeys.some((key) => source(node.id, parameterPorts.ifs[key]))
    )
      config.bounds = boundsKeys.map((key) =>
        scalar(node.id, parameterPorts.ifs[key], node.data.params[key])
      )
    const system = source(node.id, 1)
    const collect = (id: string): Affine[] => {
      const n = nodes.find((n) => n.id === id)!
      if (n.data.kind === "ifsset")
        return [0, 1, 2, 3].flatMap((i) => {
          const s = source(id, i)
          return s ? collect(s) : []
        })
      const keys = ["a", "b", "c", "d", "tx", "ty"]
      return [
        {
          matrix: keys.map((key, i) => scalar(id, i, n.data.params[key])),
          weight: Math.max(0.001, scalar(id, 6, n.data.params.weight)),
        },
      ]
    }
    if (system) {
      config.transforms = collect(system)
      if (!config.transforms.length)
        throw new Error(
          "Connect at least one affine transform to the IFS system."
        )
    }
  } else {
    config.grid = scalar(node.id, 3, node.data.params.grid)
    const set = source(node.id, 1)
    const collect = (id: string): TileRule[] => {
      const n = nodes.find((n) => n.id === id)!
      if (n.data.kind === "tileset")
        return [0, 1, 2, 3].flatMap((i) => {
          const s = source(id, i)
          return s ? collect(s) : []
        })
      const imageNode = source(id, 0)
      return [
        {
          imageNode,
          sockets: ["top", "right", "bottom", "left"].map((key, i) =>
            Math.round(scalar(id, i + 1, n.data.params[key]))
          ),
          weight: Math.max(0.001, scalar(id, 5, n.data.params.weight)),
        },
      ]
    }
    if (set) {
      config.tiles = collect(set)
      if (!config.tiles.length)
        throw new Error("Connect at least one tile rule to the tile set.")
      if (rasterize)
        for (const tile of config.tiles) {
          const canvas = document.createElement("canvas")
          canvas.width = canvas.height = 32
          const ctx = canvas.getContext("2d")!,
            pixels = ctx.createImageData(32, 32)
          for (let y = 0; y < 32; y++)
            for (let x = 0; x < 32; x++) {
              const c = tile.imageNode
                ? evaluate(tile.imageNode, time, [
                    (x + 0.5) / 32,
                    1 - (y + 0.5) / 32,
                    0,
                  ])
                : [1, 1, 1]
              const i = (y * 32 + x) * 4
              c.forEach(
                (v, k) => (pixels.data[i + k] = Math.round(clamp(v) * 255))
              )
              pixels.data[i + 3] = 255
            }
          ctx.putImageData(pixels, 0, 0)
          tile.image = canvas
        }
    }
  }
  return config
}
export function generatorIsAnimated(
  node: ArtNode,
  nodes: ArtNode[],
  edges: Edge[]
): boolean {
  const seen = new Set<string>()
  const visit = (id: string): boolean => {
    if (seen.has(id)) return false
    seen.add(id)
    const n = nodes.find((n) => n.id === id)
    return (
      n?.data.kind === "time" ||
      edges.filter((e) => e.target === id).some((e) => visit(e.source))
    )
  }
  return edges
    .filter((e) => e.target === node.id && e.targetHandle !== "0")
    .some((e) => visit(e.source))
}
