import type { Edge, Node, Connection } from "@xyflow/react"

export type PassKind = "glsl" | "p5" | "previous" | "image"
export type TexturePort = { id: string; name: string; label: string }
export type PassData = {
  kind: PassKind
  label: string
  code: string
  inputs: TexturePort[]
  image?: { src: string; name: string; width: number; height: number }
}
export type PassNode = Node<PassData, "pass">
export type PassProject = {
  version: 2
  id: string
  name: string
  nodes: PassNode[]
  edges: Edge[]
  output: string
}
export const MAX_INPUTS = 8
export const labels: Record<PassKind, string> = {
  glsl: "GLSL pass",
  p5: "p5.js pass",
  previous: "Previous frame",
  image: "Image input",
}
export const templates: Record<PassKind, string> = {
  glsl: `void main() {
  vec2 uv = vUv;
  vec3 color = 0.5 + 0.5 * cos(uTime + uv.xyx * 6.0 + vec3(0, 2, 4));
  gl_FragColor = vec4(color, 1.0);
}
`,
  p5: `function setup(p) {
  p.noStroke();
}

function draw(p, inputs, time, frame) {
  p.background(18, 35, 60);
  p.fill(255, 180, 90);
  p.circle(p.width * (0.5 + 0.3 * Math.sin(time)), p.height / 2, 80);
}
`,
  previous: "",
  image: "",
}
export function port(name: string, label = name): TexturePort {
  return { id: crypto.randomUUID(), name, label }
}
export function makePass(kind: PassKind, index = 0): PassNode {
  return {
    id: crypto.randomUUID(),
    type: "pass",
    position: { x: 40 + index * 250, y: 70 },
    data: {
      kind,
      label: labels[kind],
      code: templates[kind],
      inputs: kind === "previous" ? [port("source", "Source")] : [],
    },
  }
}
export function connect(
  source: PassNode,
  target: PassNode,
  input: number
): Edge {
  return {
    id: crypto.randomUUID(),
    source: source.id,
    target: target.id,
    targetHandle: target.data.inputs[input].id,
  }
}
export function starterProject(): PassProject {
  const a = makePass("glsl"),
    b = makePass("glsl", 1),
    history = makePass("previous", 2)
  a.data.label = "Color field"
  b.data.label = "Afterimage"
  b.data.inputs = [port("source", "Color field"), port("history", "History")]
  b.data.code = `void main() {
  vec2 drift = vec2(0.003 * sin(uTime), 0.003);
  vec3 fresh = texture2D(source, vUv).rgb;
  vec3 trail = texture2D(history, clamp(vUv - drift, 0.0, 1.0)).rgb;
  gl_FragColor = vec4(mix(fresh, trail, uFrame == 0 ? 0.0 : 0.94), 1.0);
}
`
  history.position = { x: 285, y: 310 }
  return {
    version: 2,
    id: crypto.randomUUID(),
    name: "Afterimage",
    nodes: [a, b, history],
    edges: [connect(a, b, 0), connect(b, history, 0), connect(history, b, 1)],
    output: b.id,
  }
}
export function exampleProject(
  kind: "feedback" | "blend" | "mixed"
): PassProject {
  if (kind === "feedback") return starterProject()
  const project = starterProject(),
    a = project.nodes[0],
    b = makePass("p5", 1),
    c = makePass("glsl", 2)
  b.data.label = "Orbit"
  b.position.y = 270
  c.data.label = "Blend"
  c.data.inputs = [port("source", "Color field"), port("overlay", "Orbit")]
  c.data.code = `void main() {
  vec4 a = texture2D(source, vUv);
  vec4 b = texture2D(overlay, vUv);
  gl_FragColor = mix(a, b, 0.5);
}
`
  if (kind === "mixed") {
    b.data.inputs = [port("source", "Color field")]
    b.data.code = b.data.code.replace(
      "p.background(18, 35, 60);",
      "p.clear();\n  if (inputs.source) p.image(inputs.source, 0, 0, p.width, p.height);"
    )
  } else {
    b.data.kind = "glsl"
    b.data.label = "Stripes"
    b.data.code = `void main() {\n  float stripe = step(0.5, fract(vUv.y * 20.0 + uTime * 0.1));\n  gl_FragColor = vec4(vec3(stripe), 1.0);\n}\n`
  }
  return {
    ...project,
    id: crypto.randomUUID(),
    name: kind === "mixed" ? "Orbit composite" : "Two texture blend",
    nodes: [a, b, c],
    edges: [
      ...(kind === "mixed" ? [connect(a, b, 0)] : []),
      connect(a, c, 0),
      connect(b, c, 1),
    ],
    output: c.id,
  }
}
const reserved = new Set([
  "vUv",
  "uTime",
  "uFrame",
  "uResolution",
  "inputs",
  "p",
  "time",
  "frame",
  "gl_FragColor",
  "gl_Position",
  "main",
  "texture2D",
  "precision",
  "uniform",
  "varying",
  "attribute",
  "sampler2D",
  "float",
  "int",
  "bool",
  "vec2",
  "vec3",
  "vec4",
  "mat2",
  "mat3",
  "mat4",
  "void",
  "if",
  "else",
  "for",
  "while",
  "return",
  "true",
  "false",
  "setup",
  "draw",
  "connected",
  "constructor",
  "prototype",
  "__proto__",
])
export function validatePorts(inputs: TexturePort[]) {
  if (!Array.isArray(inputs) || inputs.length > MAX_INPUTS)
    throw new Error(`A pass supports up to ${MAX_INPUTS} texture inputs.`)
  const ids = new Set<string>(),
    names = new Set<string>()
  for (const p of inputs) {
    if (
      !p ||
      typeof p.id !== "string" ||
      !p.id ||
      ids.has(p.id) ||
      typeof p.label !== "string" ||
      typeof p.name !== "string" ||
      !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(p.name) ||
      reserved.has(p.name) ||
      p.name.startsWith("gl_") ||
      p.name.startsWith("uTex")
    )
      throw new Error(
        "Use a unique texture identifier, starting with a letter; built-in names are reserved."
      )
    ids.add(p.id)
    for (const name of [p.name, `${p.name}Resolution`, `${p.name}Connected`]) {
      if (names.has(name))
        throw new Error(
          "Texture identifiers and generated metadata names must be unique."
        )
      names.add(name)
    }
  }
}
export function passAPI(node: PassNode) {
  if (node.data.kind === "glsl")
    return `precision highp float;\nvarying vec2 vUv;\nuniform float uTime;\nuniform int uFrame;\nuniform vec2 uResolution;\n${node.data.inputs.map((p) => `uniform sampler2D ${p.name};\nuniform vec2 ${p.name}Resolution;\nuniform bool ${p.name}Connected;`).join("\n")}`
  if (node.data.kind === "p5")
    return `setup(p)\ndraw(p, inputs, time, frame)\n\n${node.data.inputs.map((p) => `inputs.${p.name}: p5.Image | null`).join("\n")}\n\nImages retain their source size. Missing inputs are null.\nNodeart owns the canvas and frame loop.`
  return node.data.kind === "previous"
    ? "Output = source from the previous completed frame.\nFirst frame and reset = transparent black."
    : "A local image becomes a texture at its original dimensions."
}
export function shaderSource(node: PassNode) {
  const tokens = codeTokens(node.data.code)
  const names = new Set([
    "vUv",
    "uTime",
    "uFrame",
    "uResolution",
    ...node.data.inputs.flatMap((p) => [
      p.name,
      `${p.name}Resolution`,
      `${p.name}Connected`,
    ]),
  ])
  for (let i = 0; i < tokens.length; i++) {
    if (
      ["uniform", "varying", "attribute"].includes(tokens[i].text) &&
      names.has(tokens[i + 2]?.text)
    )
      throw new Error(
        "Nodeart generates this uniform or varying. Remove the conflicting declaration; see Pass API."
      )
    if (
      ["float", "int", "bool", "sampler2D", "vec2", "vec3", "vec4"].includes(
        tokens[i].text
      ) &&
      names.has(tokens[i + 1]?.text)
    )
      throw new Error("A declaration conflicts with the generated Pass API.")
  }
  return `${passAPI(node)}\n#line 1\n${node.data.code}`
}
// Token boundaries exclude comments and string literals; p5 property access is scoped to inputs.
function codeTokens(code: string) {
  const pattern =
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[A-Za-z_$][\w$]*|[^\s]/g
  return [...code.matchAll(pattern)]
    .filter((m) => !m[0].startsWith("//") && !m[0].startsWith("/*"))
    .map((m) => ({ text: m[0], start: m.index, end: m.index + m[0].length }))
}
export function renamePortCode(
  code: string,
  kind: PassKind,
  from: string,
  to: string
) {
  const tokens = codeTokens(code),
    edits: { start: number; end: number; text: string }[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (kind === "glsl") {
      for (const suffix of ["", "Resolution", "Connected"])
        if (token.text === `${from}${suffix}` && tokens[i - 1]?.text !== ".")
          edits.push({ ...token, text: `${to}${suffix}` })
    } else if (kind === "p5") {
      if (
        tokens[i - 2]?.text === "inputs" &&
        tokens[i - 1]?.text === "." &&
        token.text === from
      )
        edits.push({ ...token, text: to })
      if (
        tokens[i - 2]?.text === "inputs" &&
        tokens[i - 1]?.text === "[" &&
        (token.text === `'${from}'` || token.text === `"${from}"`)
      )
        edits.push({ ...token, text: `${token.text[0]}${to}${token.text[0]}` })
    }
  }
  for (const edit of edits.reverse())
    code = code.slice(0, edit.start) + edit.text + code.slice(edit.end)
  return code
}
// Incoming delay edges are captured only after all current-frame passes have run.
export function passOrder(nodes: PassNode[], edges: Edge[]): PassNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n])),
    sockets = new Set<string>()
  if (byId.size !== nodes.length) throw new Error("Pass IDs must be unique.")
  nodes.forEach((n) => validatePorts(n.data.inputs))
  for (const e of edges) {
    const target = byId.get(e.target)
    if (
      !byId.has(e.source) ||
      !target ||
      !target.data.inputs.some((p) => p.id === e.targetHandle)
    )
      throw new Error("Invalid texture connection.")
    const key = `${e.target}/${e.targetHandle}`
    if (sockets.has(key))
      throw new Error("A texture input can have only one connection.")
    sockets.add(key)
  }
  const done = new Set<string>(),
    visiting = new Set<string>(),
    order: PassNode[] = []
  const visit = (node: PassNode) => {
    if (done.has(node.id)) return
    if (visiting.has(node.id))
      throw new Error("Feedback needs a Previous frame node.")
    visiting.add(node.id)
    if (node.data.kind !== "previous")
      for (const e of edges.filter((e) => e.target === node.id))
        visit(byId.get(e.source)!)
    visiting.delete(node.id)
    done.add(node.id)
    order.push(node)
  }
  nodes.forEach(visit)
  return order
}
export function canWire(
  connection: Connection | Edge,
  nodes: PassNode[],
  edges: Edge[]
) {
  try {
    passOrder(nodes, [
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
export function parsePassProject(value: unknown): PassProject {
  if (!value || typeof value !== "object") throw new Error("Invalid project.")
  const raw = value as PassProject
  if (raw.version !== 2)
    throw new Error(
      "This is a legacy graph. Open it in the previous Nodeart version; the original is preserved."
    )
  if (
    !Array.isArray(raw.nodes) ||
    !Array.isArray(raw.edges) ||
    raw.nodes.length > 64 ||
    raw.edges.length > 512 ||
    typeof raw.name !== "string"
  )
    throw new Error("Invalid project size.")
  const ids = new Set<string>()
  const nodes = raw.nodes.map((n) => {
    if (
      !n ||
      typeof n.id !== "string" ||
      !n.id ||
      ids.has(n.id) ||
      !n.position ||
      !Number.isFinite(n.position.x) ||
      !Number.isFinite(n.position.y) ||
      !n.data ||
      !["glsl", "p5", "previous", "image"].includes(n.data.kind) ||
      typeof n.data.code !== "string" ||
      n.data.code.length > 100000 ||
      typeof n.data.label !== "string"
    )
      throw new Error("Invalid pass.")
    validatePorts(n.data.inputs)
    if (
      (n.data.kind === "previous" &&
        (n.data.inputs.length !== 1 || n.data.inputs[0].name !== "source")) ||
      (n.data.kind === "image" && n.data.inputs.length)
    )
      throw new Error("Invalid utility inputs.")
    const image = n.data.image
    if (
      image &&
      (n.data.kind !== "image" ||
        typeof image.name !== "string" ||
        typeof image.src !== "string" ||
        image.src.length > 24 * 1024 * 1024 ||
        !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(image.src) ||
        !Number.isInteger(image.width) ||
        !Number.isInteger(image.height) ||
        image.width < 1 ||
        image.height < 1 ||
        image.width > 4096 ||
        image.height > 4096)
    )
      throw new Error("Invalid image asset.")
    ids.add(n.id)
    return {
      id: n.id,
      type: "pass" as const,
      position: { x: n.position.x, y: n.position.y },
      data: {
        kind: n.data.kind,
        label: n.data.label.slice(0, 80),
        code: n.data.code,
        inputs: n.data.inputs.map((p) => ({
          id: p.id,
          name: p.name,
          label: p.label.slice(0, 80),
        })),
        ...(image ? { image } : {}),
      },
    }
  })
  const edges = raw.edges.map((e, i) => {
    if (!e || typeof e.source !== "string" || typeof e.target !== "string")
      throw new Error("Invalid connection.")
    return {
      id: `edge-${i}`,
      source: e.source,
      target: e.target,
      targetHandle: e.targetHandle,
    }
  })
  passOrder(nodes, edges)
  if (nodes.length && !ids.has(raw.output))
    throw new Error("Choose an existing pass as output.")
  return {
    version: 2,
    id: typeof raw.id === "string" ? raw.id : crypto.randomUUID(),
    name: raw.name.slice(0, 120),
    nodes,
    edges,
    output: nodes.length ? raw.output : "",
  }
}
