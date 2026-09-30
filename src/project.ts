import { definitions, presetNames, type ArtNode, type Kind } from "./engine.ts"
import type { Edge } from "@xyflow/react"
export type Project = {
  nodes: ArtNode[]
  edges: Edge[]
  name: string
  presetIndex: number
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid graph data")
  return value as Record<string, unknown>
}
export function parseProject(value: unknown): Project {
  const graph = record(value)
  if (
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.edges) ||
    graph.nodes.length > 256 ||
    graph.edges.length > 1024
  )
    throw new Error("Invalid graph size")
  const ids = new Set<string>()
  const nodes: ArtNode[] = graph.nodes.map((value) => {
    const raw = record(value),
      data = record(raw.data),
      position = record(raw.position),
      params = record(data.params),
      kind = data.kind as Kind
    if (
      !Object.hasOwn(definitions, kind) ||
      typeof raw.id !== "string" ||
      !raw.id ||
      ids.has(raw.id) ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    )
      throw new Error("Invalid node")
    ids.add(raw.id)
    const normalized: Record<string, number> = {}
    for (const p of definitions[kind].params) {
      const v = params[p.key] ?? p.value
      if (
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        v < p.min ||
        v > p.max
      )
        throw new Error(`Invalid ${p.label}`)
      normalized[p.key] = v
    }
    return {
      id: raw.id,
      type: "art",
      position: { x: position.x as number, y: position.y as number },
      data: { kind, params: normalized },
    }
  })
  if (nodes.filter((n) => n.data.kind === "output").length > 1)
    throw new Error("Only one output is supported")
  const sockets = new Set<string>()
  const edges: Edge[] = graph.edges.map((value, i) => {
    const raw = record(value),
      source = raw.source as string,
      target = raw.target as string,
      targetHandle = String(raw.targetHandle),
      node = nodes.find((n) => n.id === target)
    if (
      !ids.has(source) ||
      !node ||
      !/^\d+$/.test(targetHandle) ||
      Number(targetHandle) >= definitions[node.data.kind].inputs.length ||
      sockets.has(`${target}/${targetHandle}`)
    )
      throw new Error("Invalid connection")
    sockets.add(`${target}/${targetHandle}`)
    return { id: `edge-${i}`, source, target, targetHandle }
  })
  return {
    nodes,
    edges,
    name:
      typeof graph.name === "string"
        ? graph.name.slice(0, 120)
        : "Untitled study",
    presetIndex:
      typeof graph.presetIndex === "number" &&
      Number.isInteger(graph.presetIndex) &&
      graph.presetIndex >= 0 &&
      graph.presetIndex < presetNames.length
        ? graph.presetIndex
        : 0,
  }
}
