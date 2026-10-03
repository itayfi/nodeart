import { test } from "node:test"
import assert from "node:assert/strict"
import {
  creativeExamples,
  creativeProject,
  passPresets,
  presetPass,
} from "../src/pass-presets.ts"
import { parsePassProject, passOrder } from "../src/passes.ts"

test("creative projects preserve topology and distinct identities on repeated creation", () => {
  for (const example of creativeExamples) {
    const project = creativeProject(example.id)
    const restored = parsePassProject(JSON.parse(JSON.stringify(project)))
    assert.equal(restored.name, example.label)
    assert.equal(
      passOrder(restored.nodes, restored.edges).length,
      project.nodes.length
    )
    assert.equal(restored.edges.length, project.edges.length)
    assert.ok(project.nodes.some((n) => n.id === project.output))
    assert.notEqual(creativeProject(example.id).id, project.id)
    assert.ok(project.nodes.length >= 3)
  }
  const loom = creativeProject("loom")
  assert.ok(loom.nodes.some((n) => n.data.kind === "previous"))
  assert.equal(
    loom.nodes.find((n) => n.id === loom.output)?.data.label,
    "Screen bloom"
  )
  const prism = creativeProject("prism")
  assert.equal(
    prism.edges.filter((e) => e.source === prism.nodes[0].id).length,
    2
  )
})
test("presets are ordinary editable nodes with independent input and node IDs", () => {
  for (const preset of passPresets) {
    const a = presetPass(preset.id),
      b = presetPass(preset.id)
    assert.equal(a.data.kind, preset.kind)
    assert.equal(a.data.code, preset.code)
    assert.notEqual(a.id, b.id)
    assert.deepEqual(
      a.data.inputs.map((p) => p.name),
      preset.inputs
    )
    assert.ok(a.data.inputs.every((p, i) => p.id !== b.data.inputs[i].id))
  }
})
