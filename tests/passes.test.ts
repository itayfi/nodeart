import { test } from "node:test"
import assert from "node:assert/strict"
import {
  starterProject,
  makePass,
  port,
  connect,
  passOrder,
  parsePassProject,
  validatePorts,
  renamePortCode,
  shaderSource,
  exampleProject,
} from "../src/passes.ts"

test("dependency order allows explicit feedback but rejects current-frame cycles", () => {
  const p = starterProject(),
    order = passOrder([...p.nodes].reverse(), p.edges)
  assert.ok(
    order.findIndex((n) => n.id === p.nodes[0].id) <
      order.findIndex((n) => n.id === p.nodes[1].id)
  )
  const a = makePass("glsl"),
    b = makePass("glsl")
  a.data.inputs = [port("source")]
  b.data.inputs = [port("source")]
  assert.throws(
    () => passOrder([a, b], [connect(a, b, 0), connect(b, a, 0)]),
    /Previous frame/
  )
  assert.throws(() => passOrder([a], [connect(a, a, 0)]), /Previous frame/)
})
test("stable input IDs preserve connections through rename and reorder", () => {
  const p = starterProject(),
    b = p.nodes[1],
    before = p.edges.filter((e) => e.target === b.id).map((e) => e.targetHandle)
  b.data.inputs = b.data.inputs
    .reverse()
    .map((input) => ({
      ...input,
      name: input.name === "source" ? "image" : input.name,
    }))
  passOrder(p.nodes, p.edges)
  assert.deepEqual(
    p.edges.filter((e) => e.target === b.id).map((e) => e.targetHandle),
    before
  )
  assert.throws(
    () => passOrder(p.nodes, [...p.edges, { ...p.edges[0], id: "duplicate" }]),
    /one connection/
  )
})
test("port names reserve built-ins and generated metadata, with bounded input counts", () => {
  assert.throws(() => validatePorts([port("uTime")]))
  assert.throws(() => validatePorts([port("source"), port("sourceResolution")]))
  assert.throws(() => validatePorts([port("__proto__")]))
  assert.throws(() =>
    validatePorts(Array.from({ length: 9 }, (_, i) => port(`texture${i}`)))
  )
  validatePorts([port("source"), port("mask")])
})
test("token-aware renaming preserves comments, strings, and unrelated properties", () => {
  assert.equal(
    renamePortCode(
      'source + sourceResolution.x + sourceConnected; // source\nobj.source; "source";',
      "glsl",
      "source",
      "color"
    ),
    'color + colorResolution.x + colorConnected; // source\nobj.source; "source";'
  )
  assert.equal(
    renamePortCode(
      'inputs.source; inputs["source"]; obj.source; // inputs.source\n"inputs.source"',
      "p5",
      "source",
      "color"
    ),
    'inputs.color; inputs["color"]; obj.source; // inputs.source\n"inputs.source"'
  )
})
test("generated uniforms map to draft line numbers and reject duplicate declarations", () => {
  const n = makePass("glsl")
  n.data.inputs = [port("source")]
  assert.match(shaderSource(n), /uniform sampler2D source;/)
  assert.match(shaderSource(n), /#line 1\nvoid main/)
  n.data.code = "uniform sampler2D source; void main() {}"
  assert.throws(() => shaderSource(n), /conflict|generates/)
})
test("projects and examples roundtrip and reject invalid assets and handles", () => {
  for (const kind of ["feedback", "blend", "mixed"] as const) {
    const p = exampleProject(kind)
    assert.deepEqual(parsePassProject(JSON.parse(JSON.stringify(p))), {
      ...p,
      edges: p.edges.map((e, i) => ({ ...e, id: `edge-${i}` })),
    })
  }
  const p = starterProject()
  p.edges[0].targetHandle = "missing"
  assert.throws(() => parsePassProject(p), /connection/)
  assert.throws(() => parsePassProject({ version: 1 }), /legacy/)
  const image = makePass("image")
  image.data.image = {
    src: "https://example.com/a.png",
    name: "external",
    width: 2,
    height: 2,
  }
  assert.throws(
    () =>
      parsePassProject({
        ...starterProject(),
        nodes: [image],
        edges: [],
        output: image.id,
      }),
    /asset/
  )
})
