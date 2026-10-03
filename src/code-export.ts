import { strToU8, zipSync } from "fflate"
import { passAPI, type PassProject } from "./passes.ts"

export function safeFilename(name: string) {
  return (
    name
      .normalize("NFKC")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "nodeart"
  )
}
export function projectCodeZip(project: PassProject): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  const manifest = project.nodes.map((node, i) => {
    const base = `${String(i + 1).padStart(2, "0")}-${safeFilename(node.data.label)}`
    const file =
      node.data.kind === "glsl"
        ? `passes/${base}.glsl`
        : node.data.kind === "p5"
          ? `passes/${base}.js`
          : null
    if (file) files[file] = strToU8(node.data.code)
    if (node.data.kind === "glsl")
      files[`shaders/${base}.frag`] = strToU8(
        `${passAPI(node)}\n#line 1\n${node.data.code}`
      )
    let image: string | null = null
    if (node.data.kind === "image" && node.data.image) {
      image = `assets/${base}.png`
      files[image] = Uint8Array.from(
        atob(node.data.image.src.split(",")[1]),
        (c) => c.charCodeAt(0)
      )
    }
    return {
      id: node.id,
      label: node.data.label,
      kind: node.data.kind,
      file,
      image,
      inputs: node.data.inputs,
    }
  })
  files["project.json"] = strToU8(JSON.stringify(project, null, 2))
  files["manifest.json"] = strToU8(
    JSON.stringify(
      {
        name: project.name,
        output: project.output,
        passes: manifest,
        connections: project.edges,
      },
      null,
      2
    )
  )
  files["README.txt"] = strToU8(
    `Nodeart — ${project.name}\n\nThis ZIP contains the current editable draft, including unapplied changes.\npasses/: exact GLSL and p5.js source.\nshaders/: GLSL fragment sources with the generated Pass API.\nassets/: image inputs as PNG.\nproject.json: complete project for importing into Nodeart.\nmanifest.json: node IDs, named texture ports, wires, and output selection.\n\np5.js is instance mode: setup(p) once; draw(p, inputs, time, frame) each frame.\nInputs are p5.Image or null. GLSL targets WebGL 1.\nPrevious frame nodes are scheduling/texture buffers, not code files.\nThe .frag files require Nodeart's full-screen vertex stage and named uniform/texture bindings.\nThis archive is source and project data, not a standalone application.\n`
  )
  return zipSync(files, { level: 6 })
}
