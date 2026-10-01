import { test } from "node:test"
import assert from "node:assert/strict"
import {
  compile,
  makeNode,
  preset,
  definitions,
  presetNames,
  collapseTiles,
  parameterPorts,
  type Kind,
} from "../src/engine.ts"
const wire = (source: string, target: string, input = 0) => ({
  id: `${source}-${target}-${input}`,
  source,
  target,
  targetHandle: String(input),
})
test("all presets compile into unique, dependency-ordered shader variables", () => {
  for (let i = 0; i < presetNames.length; i++) {
    const graph = preset(i),
      { source, textures } = compile(graph.nodes, graph.edges)
    const names = [...source.matchAll(/vec3 (n\d+) =/g)].map((m) => m[1])
    assert.equal(names.length, new Set(names).size)
    const seen = new Set<string>()
    for (const match of source.matchAll(/vec3 (n\d+) = ([^;]+);/g)) {
      const [, lhs, rhs] = match
      for (const ref of rhs.matchAll(/\bn\d+\b/g))
        assert.ok(seen.has(ref[0]), `${ref[0]} must be defined before use`)
      seen.add(lhs.match(/n\d+/)![0])
    }
    assert.equal(textures.length, i === 3 || i === 4 ? 1 : 0)
    assert.match(source, /gl_FragColor/)
  }
})
test("every node supports disconnected inputs with valid defaults", () => {
  for (const kind of Object.keys(definitions) as Kind[]) {
    const nodes = [makeNode(kind, "a", 0, 0), makeNode("output", "out", 250, 0)]
    if (["affine", "ifsset", "tile", "tileset"].includes(kind)) {
      const generator = makeNode(
        kind === "affine" || kind === "ifsset" ? "ifs" : "wfc",
        "generator",
        200,
        0
      )
      const result = compile(
        [nodes[0], generator, nodes[1]],
        [wire("a", "generator", 1), wire("generator", "out")]
      )
      assert.match(result.source, /uTex0/)
      continue
    }
    const result = compile(
      kind === "output" ? [nodes[0]] : nodes,
      kind === "output" ? [] : [wire("a", "out")]
    )
    assert.ok(!result.source.includes("NaN"))
    assert.ok(!result.source.includes("undefined"))
    assert.ok(!result.source.includes("Infinity"))
  }
})
test("cycles are rejected while previous-frame feedback is legal", () => {
  const nodes = [
    makeNode("add", "a", 0, 0),
    makeNode("multiply", "b", 250, 0),
    makeNode("output", "out", 500, 0),
  ]
  assert.throws(
    () => compile(nodes, [wire("a", "b"), wire("b", "a"), wire("b", "out")]),
    /cycle/i
  )
  assert.doesNotThrow(() =>
    compile([makeNode("previous", "a", 0, 0), nodes[2]], [wire("a", "out")])
  )
  assert.throws(() => compile([], []), /Image output/)
})
const rng = (initial: number) => {
  let seed = initial
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) | 0
    return (seed >>> 0) / 4294967296
  }
}
test("WFC tile edges match for varied seeds and grid sizes", () => {
  for (const n of [8, 16, 32])
    for (let seed = 1; seed <= 30; seed++) {
      const tiles = collapseTiles(n, rng(seed))
      assert.equal(tiles.length, n * n)
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const t = tiles[y * n + x]
          assert.ok([0, 3, 6, 12, 9, 5, 10, 15].includes(t))
          if (x + 1 < n)
            assert.equal(Boolean(t & 2), Boolean(tiles[y * n + x + 1] & 8))
          if (y + 1 < n)
            assert.equal(Boolean(t & 4), Boolean(tiles[(y + 1) * n + x] & 1))
        }
    }
  assert.deepEqual(collapseTiles(16, rng(32)), collapseTiles(16, rng(32)))
})
import { parseProject } from "../src/project.ts"

test("every numeric parameter has a socket, preserving legacy socket indices", () => {
  assert.equal(parameterPorts.circle.radius, 2)
  assert.equal(parameterPorts.line.width, 3)
  assert.equal(parameterPorts.ifs.seed, 2)
  assert.equal(parameterPorts.noise.scale, 2)
  assert.equal(parameterPorts.mix.amount, 2)
  for (const kind of Object.keys(definitions) as Kind[]) {
    for (const param of definitions[kind].params)
      assert.ok(
        Number.isInteger(parameterPorts[kind][param.key]),
        `${kind}.${param.key}`
      )
  }
})

test("image assets and custom colors survive JSON round trips and reject invalid data", () => {
  const image = makeNode("image", "image", 0, 0)
  image.data.image = {
    src: "data:image/png;base64,aGVsbG8=",
    name: "image.png",
    width: 4,
    height: 8,
  }
  const gradient = makeNode("gradient", "gradient", 250, 0)
  gradient.data.colors = ["#000000", "#ff0000", "#00ff00", "#ffffff"]
  const project = {
    nodes: [image, gradient],
    edges: [],
    name: "Image study",
    presetIndex: 0,
  }
  const restored = parseProject(JSON.parse(JSON.stringify(project)))
  assert.deepEqual(restored.nodes[0].data.image, image.data.image)
  assert.deepEqual(restored.nodes[1].data.colors, gradient.data.colors)
  image.data.image.src = "https://example.com/image.png"
  assert.throws(() => parseProject(project), /Invalid image/)
  image.data.image.src = "data:image/png;base64,aGVsbG8="
  gradient.data.colors = ["red"]
  assert.throws(() => parseProject(project), /Invalid palette/)
})
test("project loading rejects invalid connections and unbounded generator parameters", () => {
  const graph = { ...preset(4), name: "Tile study", presetIndex: 4 }
  assert.equal(parseProject(graph).nodes.length, graph.nodes.length)
  const invalid = structuredClone(graph)
  invalid.nodes.find((n) => n.data.kind === "wfc")!.data.params.grid = 100000
  assert.throws(() => parseProject(invalid), /Invalid Grid/)
  assert.throws(
    () =>
      parseProject({
        ...graph,
        edges: [
          { id: "bad", source: "unknown", target: "out", targetHandle: "0" },
        ],
      }),
    /Invalid connection/
  )
  assert.throws(
    () => parseProject({ ...graph, nodes: [...graph.nodes, graph.nodes[0]] }),
    /Invalid node/
  )
})
import {
  graphTypes,
  canConnect,
  numericEvaluator,
  resolveGenerator,
  seededRandom,
  newNodeId,
} from "../src/graph.ts"
test("uniform scope propagates through math and rejects fragment values in generator controls", () => {
  const nodes = [
    makeNode("time", "t", 0, 0),
    makeNode("sine", "s", 0, 0),
    makeNode("circle", "circle", 0, 0),
    makeNode("uv", "uv", 0, 0),
    makeNode("noise", "noise", 0, 0),
  ]
  const edges = [wire("t", "s"), wire("s", "circle", 2)]
  assert.equal(graphTypes(nodes, edges).get("s")!.scope, "uniform")
  assert.equal(graphTypes(nodes, edges).get("circle")!.scope, "fragment")
  assert.equal(canConnect(wire("noise", "circle", 2), nodes, edges), false)
  assert.equal(canConnect(wire("uv", "circle", 1), nodes, edges), false)
  assert.equal(canConnect(wire("s", "circle", 2), nodes, edges), true)
  assert.throws(
    () =>
      compile(
        [...nodes, makeNode("output", "out", 0, 0)],
        [wire("noise", "circle", 2), wire("circle", "out")]
      ),
    /requires a uniform/
  )
})

test("new shader parameter sockets consume uniform drivers and reject pixel drivers", () => {
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
    for (const param of definitions[kind].params) {
      const target = makeNode(kind, "target", 0, 0),
        uniform = makeNode("time", "uniform", 0, 0),
        pixel = makeNode("uv", "pixel", 0, 0),
        out = makeNode("output", "out", 0, 0)
      const port = parameterPorts[kind][param.key],
        nodes = [target, uniform, pixel, out]
      assert.equal(
        canConnect(wire("pixel", "target", port), nodes, []),
        false,
        `${kind}.${param.key} must reject pixel values`
      )
      const compiled = compile(nodes, [
        wire("uniform", "target", port),
        wire("target", "out"),
      ])
      assert.match(compiled.source, /vec3 n0 = vec3\(uTime/)
      assert.match(
        compiled.source,
        /vec3 n1 = [^;]*n0/,
        `${kind}.${param.key} must be read by its shader`
      )
    }
  }
})

test("uniform transform parameters change CPU coordinates and IFS viewport bounds", () => {
  const transform = makeNode("transform", "transform", 0, 0),
    value = makeNode("constant", "value", 0, 0, { value: 2 })
  const evaluate = numericEvaluator(
    [transform, value],
    [wire("value", "transform", parameterPorts.transform.scale)]
  )
  assert.deepEqual(evaluate("transform", 0, [0.75, 0.5, 0]), [1, 0.5, 0])
  const ifs = makeNode("ifs", "ifs", 0, 0)
  const config = resolveGenerator(
    ifs,
    [ifs, value],
    [wire("value", "ifs", parameterPorts.ifs.maxX)],
    0,
    false
  )
  assert.deepEqual(config.bounds, [0, 2, 0, 1])
})

test("custom palette color inputs and masked compositing agree with their numeric behavior", () => {
  const gradient = makeNode("gradient", "gradient", 0, 0),
    color = makeNode("color", "color", 0, 0, { r: 1, g: 0, b: 0 })
  gradient.data.colors = ["#000000", "#000000", "#ffffff", "#ffffff"]
  const evaluate = numericEvaluator(
    [gradient, color],
    [wire("color", "gradient", 3)]
  )
  assert.deepEqual(evaluate("gradient", 0), [1, 0, 0])
  const background = makeNode("color", "background", 0, 0, {
      r: 0.2,
      g: 0.4,
      b: 0.6,
    }),
    foreground = makeNode("color", "foreground", 0, 0, {
      r: 0.8,
      g: 0.5,
      b: 0.1,
    }),
    mask = makeNode("constant", "mask", 0, 0, { value: 0.5 }),
    composite = makeNode("composite", "composite", 0, 0, {
      mode: 1,
      opacity: 0.5,
    })
  const compositeEvaluator = numericEvaluator(
    [background, foreground, mask, composite],
    [
      wire("background", "composite"),
      wire("foreground", "composite", 1),
      wire("mask", "composite", 2),
    ]
  )
  const result = compositeEvaluator("composite", 0)
  ;[0.19, 0.35, 0.465].forEach((expected, i) =>
    assert.ok(Math.abs(result[i] - expected) < 1e-10)
  )
})
test("animated shape dimensions and line endpoints evaluate differently over time", () => {
  for (const index of [2, 5]) {
    const graph = preset(index),
      evaluate = numericEvaluator(graph.nodes, graph.edges)
    assert.notDeepEqual(evaluate("offset", 0), evaluate("offset", 1))
    const types = graphTypes(graph.nodes, graph.edges)
    assert.equal(types.get("offset")!.scope, "uniform")
    assert.equal(types.get("generator")!.scope, "fragment")
  }
  const node = makeNode("line", "line", 0, 0, {
    ax: 0.5,
    ay: 0.5,
    bx: 0.5,
    by: 0.5,
  })
  const evaluate = numericEvaluator([node], [])
  assert.equal(evaluate("line", 0, [0.5, 0.5, 0])[0], 1)
  assert.equal(evaluate("line", 0, [0, 0, 0])[0], 0)
})
test("IFS transform coefficients can be animated with uniform subgraphs", () => {
  const nodes = [
      makeNode("time", "t", 0, 0, { speed: 1 }),
      makeNode("sine", "s", 0, 0),
      makeNode("affine", "affine", 0, 0),
      makeNode("ifsset", "set", 0, 0),
      makeNode("ifs", "ifs", 0, 0),
    ],
    edges = [
      wire("t", "s"),
      wire("s", "affine", 4),
      wire("affine", "set"),
      wire("set", "ifs", 1),
    ]
  const a = resolveGenerator(nodes[4], nodes, edges, 0),
    b = resolveGenerator(nodes[4], nodes, edges, 1)
  assert.equal(a.transforms!.length, 1)
  assert.notEqual(a.transforms![0].matrix[4], b.transforms![0].matrix[4])
  assert.equal(canConnect(wire("set", "s"), nodes, edges), false)
})
test("custom WFC socket labels and weighted tile rules drive collapse", () => {
  const graph = preset(4),
    generator = graph.nodes.find((n) => n.id === "generator")!,
    config = resolveGenerator(generator, graph.nodes, graph.edges, 0, false)
  assert.equal(config.tiles!.length, 4)
  for (let seed = 1; seed <= 15; seed++) {
    const n = 8,
      tiles = collapseTiles(n, seededRandom(seed), config.tiles)
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const tile = config.tiles![tiles[y * n + x]]
        if (x + 1 < n)
          assert.equal(
            tile.sockets[1],
            config.tiles![tiles[y * n + x + 1]].sockets[3]
          )
        if (y + 1 < n)
          assert.equal(
            tile.sockets[2],
            config.tiles![tiles[(y + 1) * n + x]].sockets[0]
          )
      }
  }
  const evaluate = numericEvaluator(graph.nodes, graph.edges)
  assert.equal(evaluate("vertical", 0, [0.5, 0.1, 0])[0], 1)
  assert.equal(evaluate("vertical", 0, [0.1, 0.1, 0])[0], 0)
})
test("graph identifiers work when Web Crypto is unavailable", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto")
  Object.defineProperty(globalThis, "crypto", {
    value: undefined,
    configurable: true,
  })
  try {
    assert.equal(
      new Set(Array.from({ length: 1000 }, () => newNodeId())).size,
      1000
    )
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor)
    else Reflect.deleteProperty(globalThis, "crypto")
  }
})
