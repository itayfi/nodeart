import { test } from "node:test"
import assert from "node:assert/strict"
import { unzipSync, strFromU8 } from "fflate"
import { projectCodeZip, safeFilename } from "../src/code-export.ts"
import { creativeProject } from "../src/pass-presets.ts"
import { makePass, parsePassProject } from "../src/passes.ts"

test("ZIP keeps exact drafts, generated shader API, topology, and image bytes without unsafe paths", () => {
  const project = creativeProject("loom")
  project.nodes[1].data.code += "\n// Draft edit, intentionally not run.\n"
  project.nodes[0].data.label = "../../CON: ribbons"
  project.nodes[1].data.label = project.nodes[0].data.label
  const image = makePass("image")
  image.data.image = {
    src: "data:image/png;base64,AQIDBA==",
    width: 1,
    height: 1,
    name: "photo.png",
  }
  project.nodes.push(image)
  const files = unzipSync(projectCodeZip(project))
  assert.ok(
    Object.keys(files).every(
      (path) => !path.includes("..") && !path.includes(":")
    )
  )
  const manifest = JSON.parse(strFromU8(files["manifest.json"]))
  assert.equal(manifest.output, project.output)
  assert.deepEqual(manifest.connections, project.edges)
  for (let i = 0; i < project.nodes.length; i++) {
    const file = manifest.passes[i].file
    if (file) assert.equal(strFromU8(files[file]), project.nodes[i].data.code)
    else assert.ok(["previous", "image"].includes(project.nodes[i].data.kind))
  }
  assert.match(
    strFromU8(files["shaders/02-CON-ribbons.frag"]),
    /uniform sampler2D history;/
  )
  assert.deepEqual(
    files[manifest.passes.at(-1).image],
    Uint8Array.from([1, 2, 3, 4])
  )
  assert.equal(
    parsePassProject(JSON.parse(strFromU8(files["project.json"]))).edges.length,
    project.edges.length
  )
  assert.equal(safeFilename("../../💫"), "nodeart")
})
