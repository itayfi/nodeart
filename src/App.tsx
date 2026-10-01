import {
  useCallback,
  useEffect,
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useNodesInitialized,
  type Connection,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { play } from "cuelume"
import {
  Aperture,
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CircleHelp,
  Code2,
  Copy,
  Expand,
  FolderOpen,
  Layers3,
  Maximize2,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Workflow,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import {
  graphTypes,
  inputSpec,
  canConnect,
  newNodeId,
  type GraphType,
} from "./graph"
import { SoundToggle } from "@/components/sound-toggle"
import { CategoryIcon, type CategoryIconName } from "@/components/category-icon"
import {
  definitions,
  makeNode,
  preset,
  presetNames,
  compile,
  type ArtNode,
  type Kind,
} from "./engine"
import { Preview } from "./Preview"
import { parseProject } from "./project"
import {
  loadLibrary,
  saveProject,
  deleteProject,
  newProject,
  type Library,
  type LibraryProject,
} from "./project-library"
import { ParameterEditor } from "./components/parameter-editor"
import { ProjectBrowser } from "./components/project-browser"
import { ImageEditor } from "./components/image-editor"
import type { Edge } from "@xyflow/react"
type Actions = {
  select: (id: string) => void
  remove: (id: string) => void
  duplicate: (id: string) => void
  disconnect: (id: string) => void
  types: Map<string, GraphType>
}
const NodeActions = createContext<Actions | null>(null)
function ArtCard({ id, data, selected }: NodeProps<ArtNode>) {
  const actions = useContext(NodeActions)!
  const outputType = actions.types.get(id)
  const def = definitions[data.kind]
  return (
    <div
      className={`art-node w-[240px] rounded-xl ${selected ? "is-selected" : ""}`}
      style={{ "--node-color": def.color } as CSSProperties}
    >
      <div className="node-heading flex items-center gap-2 rounded-t-xl px-3 py-3">
        <CategoryIcon name={def.category} className="size-4" />
        <span className="flex-1 text-[12px] font-semibold">{def.title}</span>
        <DropdownMenu
          onOpenChange={(open) => {
            if (open) actions.select(id)
          }}
        >
          <DropdownMenuTrigger
            render={
              <Button
                className="nodrag nopan node-menu"
                variant="secondary"
                size="icon-sm"
                aria-label={`Actions for ${def.title}`}
                data-cuelume-tap="open"
                onClick={(e) => e.stopPropagation()}
              />
            }
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="node-menu-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem
              data-cuelume-tap="select"
              onClick={() => actions.select(id)}
            >
              Edit properties
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={data.kind === "output"}
              data-cuelume-tap="tap"
              onClick={() => actions.duplicate(id)}
            >
              <Copy />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              data-cuelume-tap="close"
              onClick={() => actions.disconnect(id)}
            >
              Disconnect wires
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              data-cuelume-tap="close"
              onClick={() => actions.remove(id)}
            >
              <Trash2 />
              Delete node
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="space-y-3 px-3 py-3">
        {def.inputs.map((label, i) => (
          <div
            key={label}
            className="relative flex items-center gap-2 text-[12px] text-[#294d65]"
          >
            <Handle
              type="target"
              position={Position.Left}
              id={String(i)}
              style={{ left: -19, top: "50%" }}
            />
            <span className="port-dot" />
            {label}
            <span className="ml-auto font-mono text-[12px] opacity-70">
              {inputSpec(data.kind, i).types[0] === "numeric"
                ? inputSpec(data.kind, i).uniform
                  ? "uniform"
                  : "pixel / U"
                : inputSpec(data.kind, i).types.join(" / ")}
            </span>
          </div>
        ))}
        {data.kind === "uv" && (
          <div className="coordinate-chip grid grid-cols-2 gap-1 rounded-md p-2 text-[12px]">
            <span>
              X <b className="float-right font-mono">0 → 1</b>
            </span>
            <span>
              Y <b className="float-right font-mono">0 → 1</b>
            </span>
          </div>
        )}
        {data.kind === "time" && (
          <div className="text-[12px] text-[#294d65]">
            seconds ×{" "}
            <span className="font-mono">{data.params.speed.toFixed(2)}</span>
            <span className="live-dot ml-2 inline-block" />
          </div>
        )}
        {def.params
          .filter(
            (p) => p.key !== "theme" && p.key !== "seed" && p.key !== "speed"
          )
          .slice(0, 2)
          .map((p) => (
            <div
              key={p.key}
              className="node-value flex justify-between rounded-md px-2 py-1.5 text-[12px]"
            >
              <span>{p.label}</span>
              <span className="font-mono">{data.params[p.key].toFixed(2)}</span>
            </div>
          ))}
        {data.kind === "palette" && (
          <div
            className={`palette-strip palette-${Math.round(data.params.theme)} h-6 rounded-md`}
          />
        )}
        {data.kind === "ifs" && (
          <div className="text-[12px] text-[#294d65]">
            Custom transforms · texture
          </div>
        )}
        {data.kind === "wfc" && (
          <div className="text-[12px] text-[#294d65]">
            Custom tiles · texture
          </div>
        )}
        {data.kind === "output" && (
          <div className="output-chip flex items-center gap-2 rounded-md px-2 py-2 text-[12px]">
            <span className="live-dot" />
            Final render
            <ArrowUpRight className="ml-auto size-3" />
          </div>
        )}
        {def.output && (
          <div className="relative mt-2 flex justify-end gap-2 text-[12px] text-[#294d65]">
            <span>
              {def.output === "vector"
                ? "Coordinates"
                : def.output === "scalar"
                  ? "Value"
                  : def.output === "color"
                    ? "Color"
                    : "Result"}
            </span>
            <span
              className="font-mono text-[12px]"
              title="Uniform values are shared by every pixel; fragment values vary per pixel."
            >
              {outputType?.scope === "uniform" ? "UNIFORM" : "PIXEL"}
            </span>
            <span className="port-dot" />
            <Handle
              type="source"
              position={Position.Right}
              style={{ right: -19, top: "50%" }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
const nodeTypes = { art: ArtCard }
const categories: CategoryIconName[] = [
  "Inputs",
  "Fields",
  "Math",
  "Color",
  "Generators",
  "Output",
]
function Workspace({ library }: { library: Library }) {
  const [initial] = useState(() =>
    library.projects.find((p) => p.id === library.activeId)!
  )
  const [projects, setProjects] = useState(library.projects)
  const [projectId, setProjectId] = useState(library.activeId)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [storageError, setStorageError] = useState(library.error ?? "")
  const [nodes, setNodes, onNodesChange] = useNodesState<ArtNode>(
    initial?.nodes ?? preset(0).nodes
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initial?.edges ?? preset(0).edges
  )
  const [name, setName] = useState(initial?.name ?? "Chromatic flow")
  const [presetIndex, setPresetIndex] = useState(initial?.presetIndex ?? 0)
  const [search, setSearch] = useState("")
  const [selectedEdgeId, setSelectedEdgeId] = useState("")
  const [selectedId, setSelectedId] = useState(
    initial?.nodes.find((n) =>
      ["Fields", "Generators"].includes(definitions[n.data.kind].category)
    )?.id ?? "noise"
  )
  const [playing, setPlaying] = useState(
    () => !matchMedia("(prefers-reduced-motion: reduce)").matches
  )
  const [time, setTime] = useState(0)
  const [reset, setReset] = useState(0)
  const [resolution, setResolution] = useState(512)
  const [status, setStatus] = useState("Compiling…")
  const [notice, setNotice] = useState("")
  const [showCode, setShowCode] = useState(false)
  const [help, setHelp] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [full, setFull] = useState(false)
  const [dirty, setDirty] = useState(!initial)
  const canvas = useRef<HTMLCanvasElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flow = useReactFlow<ArtNode>()
  const nodesInitialized = useNodesInitialized()
  const [pendingFit, setPendingFit] = useState(false)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapshot = useMemo(
    () =>
      JSON.stringify({
        nodes: nodes.map((n) => ({
          id: n.id,
          type: "art",
          position: n.position,
          data: n.data,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          targetHandle: e.targetHandle,
        })),
        name,
        presetIndex,
      }),
    [nodes, edges, name, presetIndex]
  )
  const latestSnapshot = useRef(snapshot)
  const savedSnapshot = useRef("")
  useEffect(() => {
    latestSnapshot.current = snapshot
  }, [snapshot])
  useEffect(() => {
    if (!pendingFit || !nodesInitialized) return
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        void flow.fitView({ padding: 0.18, duration: 300 })
        setPendingFit(false)
      })
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [pendingFit, nodesInitialized, flow])
  const selected = nodes.find((n) => n.id === selectedId)
  const signature = useMemo(
    () => JSON.stringify(nodes.map((n) => ({ id: n.id, data: n.data }))),
    [nodes]
  )
  const edgeSignature = useMemo(
    () =>
      JSON.stringify(
        edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          targetHandle: e.targetHandle,
        }))
      ),
    [edges]
  )
  // Positions and selection do not recompile the shader or clear frame history.
  const renderNodes = useMemo(
    () => JSON.parse(signature) as ArtNode[],
    [signature]
  )
  const renderEdges = useMemo(
    () => JSON.parse(edgeSignature) as Edge[],
    [edgeSignature]
  )
  const notify = useCallback((message: string) => {
    setNotice(message)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(""), 3200)
  }, [])
  const persist = useCallback(async () => {
    const project: LibraryProject = {
      ...JSON.parse(snapshot),
      id: projectId,
      updatedAt: Date.now(),
    }
    if (canvas.current && status === "Compiled") {
      const thumbnail = document.createElement("canvas")
      thumbnail.width = thumbnail.height = 200
      thumbnail.getContext("2d")?.drawImage(canvas.current, 0, 0, 200, 200)
      project.thumbnail = thumbnail.toDataURL("image/jpeg", 0.7)
    }
    const task = queue.current.catch(() => {}).then(() => saveProject(project))
    queue.current = task
    try {
      await task
      setProjects((previous) => [
        project,
        ...previous.filter((p) => p.id !== project.id),
      ])
      savedSnapshot.current = snapshot
      if (latestSnapshot.current === snapshot) setDirty(false)
      setStorageError("")
      return true
    } catch {
      setStorageError(
        "Unable to save locally. Download graph JSON to keep your work."
      )
      return false
    }
  }, [snapshot, projectId, status])
  useEffect(() => {
    if (busy || (savedSnapshot.current === snapshot && status !== "Compiled"))
      return
    autosaveTimer.current = setTimeout(() => {
      void persist()
    }, 650)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [snapshot, persist, busy, status])
  useEffect(() => {
    const flush = () => {
      if (
        document.visibilityState === "hidden" &&
        savedSnapshot.current !== snapshot
      )
        void persist()
    }
    const warn = (event: BeforeUnloadEvent) => {
      if (savedSnapshot.current !== latestSnapshot.current) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    document.addEventListener("visibilitychange", flush)
    window.addEventListener("beforeunload", warn)
    return () => {
      document.removeEventListener("visibilitychange", flush)
      window.removeEventListener("beforeunload", warn)
    }
  }, [snapshot, persist])
  const activate = (project: LibraryProject) => {
    setProjectId(project.id)
    setNodes(project.nodes)
    setEdges(project.edges)
    setName(project.name)
    setPresetIndex(project.presetIndex)
    setSelectedId("")
    setSelectedEdgeId("")
    setDirty(false)
    setReset((r) => r + 1)
    setPendingFit(true)
    setProjectsOpen(false)
    savedSnapshot.current = ""
  }
  const chooseProject = async (project: LibraryProject) => {
    if (project.id === projectId) {
      setProjectsOpen(false)
      return
    }
    setBusy(true)
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    try {
      if (!(await persist())) {
        notify("Save failed. Download a backup before switching projects.")
        return
      }
      await saveProject(project)
      activate(project)
      play("select", { emphasis: "subtle" })
    } catch {
      notify("Unable to open this project.")
    } finally {
      setBusy(false)
    }
  }
  const createProject = async (project: LibraryProject) => {
    setBusy(true)
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    try {
      if (!(await persist())) {
        notify("Save failed. Download a backup before creating a project.")
        return
      }
      await saveProject(project)
      setProjects((previous) => [project, ...previous])
      activate(project)
    } catch {
      notify("Unable to create this project.")
    } finally {
      setBusy(false)
    }
  }
  const changeData = (data: Partial<ArtNode["data"]>) => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedId ? { ...n, data: { ...n.data, ...data } } : n
      )
    )
    setDirty(true)
  }
  const changeParam = (key: string, value: number) => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedId
          ? {
              ...n,
              data: { ...n.data, params: { ...n.data.params, [key]: value } },
            }
          : n
      )
    )
    setDirty(true)
  }
  const connect = useCallback(
    (c: Connection) => {
      setEdges((es) =>
        addEdge(
          c,
          es.filter(
            (e) => !(e.target === c.target && e.targetHandle === c.targetHandle)
          )
        )
      )
      setDirty(true)
      play("select", { emphasis: "subtle" })
    },
    [setEdges]
  )
  const loadPreset = (index: number) => {
    void createProject(
      newProject(presetNames[index], {
        ...preset(index),
        name: presetNames[index],
        presetIndex: index,
      })
    )
  }
  const addNode = (kind: Kind) => {
    if (kind === "output" && nodes.some((n) => n.data.kind === "output")) {
      setSelectedId(nodes.find((n) => n.data.kind === "output")!.id)
      notify("This graph already has an image output.")
      return
    }
    const id = newNodeId(),
      el = document.querySelector(".graph-workspace")!.getBoundingClientRect(),
      pos = flow.screenToFlowPosition({
        x: el.x + el.width / 2 - 100,
        y: el.y + el.height / 2 - 80,
      })
    setNodes((ns) => [...ns, makeNode(kind, id, pos.x, pos.y)])
    setSelectedId(id)
    setDirty(true)
  }
  const save = async () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    if (await persist()) {
      notify("Project saved on this device.")
      play("success", { emphasis: "subtle" })
    }
  }
  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const exportPng = () => {
    canvas.current?.toBlob((blob) => {
      if (blob) {
        download(blob, `${name.replace(/[^a-z0-9-]/gi, "-")}.png`)
        notify("PNG exported.")
        play("success", { emphasis: "subtle" })
      }
    })
  }
  const removeNode = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
    setSelectedId("")
    setDirty(true)
  }
  const remove = () => removeNode(selectedId)
  const disconnectNode = (id: string) => {
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
    setDirty(true)
  }
  const duplicateNode = (id: string) => {
    const original = nodes.find((n) => n.id === id)
    if (!original || original.data.kind === "output") return
    const copyId = newNodeId()
    setNodes((ns) => [
      ...ns,
      {
        ...original,
        id: copyId,
        position: { x: original.position.x + 50, y: original.position.y + 70 },
      },
    ])
    setSelectedId(copyId)
    setDirty(true)
  }
  const types = useMemo(() => {
    try {
      return graphTypes(renderNodes, renderEdges)
    } catch {
      return new Map<string, GraphType>()
    }
  }, [renderNodes, renderEdges])
  const importGraph = async (f: File) => {
    try {
      const g = parseProject(JSON.parse(await f.text()))
      compile(g.nodes, g.edges)
      await createProject(newProject(g.name || "Untitled study", g))
    } catch {
      notify("Unable to import: choose a valid Nodeart graph JSON.")
    }
  }
  let code = ""
  try {
    code = compile(renderNodes, renderEdges).source
  } catch (error) {
    code = String(error)
  }
  return (
    <NodeActions.Provider
      value={{
        select: setSelectedId,
        remove: removeNode,
        duplicate: duplicateNode,
        disconnect: disconnectNode,
        types,
      }}
    >
      <main className="app-shell flex h-dvh min-h-0 flex-col overflow-hidden max-[600px]:h-auto max-[600px]:min-h-dvh max-[600px]:overflow-auto">
        <header className="app-header flex h-[68px] shrink-0 items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-3">
            <span className="brand-orb">
              <Workflow className="size-5" />
            </span>
            <span className="text-[20px] font-semibold tracking-[-.8px]">
              nodeart<span className="text-[#294d65]">.</span>
            </span>
            <span className="ml-3 hidden pl-5 text-[12px] tracking-wider text-[#294d65] md:block">
              A SPACE FOR HAPPY ACCIDENTS
            </span>
          </div>
          <div className="flex items-center gap-2">
            <SoundToggle />
            <Button
              variant="secondary"
              size="icon"
              aria-label="Editor help"
              onClick={() => setHelp(true)}
            >
              <CircleHelp className="size-4" />
            </Button>
          </div>
        </header>
        <div className="project-bar mx-4 flex h-[59px] shrink-0 items-center justify-between gap-3 rounded-xl px-5">
          <div className="flex min-w-0 items-center gap-3">
            <FolderOpen className="size-4 text-[#294d65]" />
            <Input
              className="project-name max-w-[180px]"
              aria-label="Project name"
              maxLength={120}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setDirty(true)
              }}
            />
            <span className="hidden rounded-full px-2 py-1 text-[12px] text-[#294d65] sm:block">
              {storageError
                ? "Save unavailable"
                : dirty
                  ? "Saving…"
                  : "Saved locally"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => setProjectsOpen(true)}
            >
              <FolderOpen />
              Projects
            </Button>
            <input
              type="file"
              accept=".json"
              className="hidden"
              ref={file}
              onChange={(e) => {
                if (e.target.files?.[0]) void importGraph(e.target.files[0])
                e.target.value = ""
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={save}
              disabled={busy}
              data-cuelume-tap={undefined}
            >
              <Save />
              Save
            </Button>
            <Button
              size="sm"
              onClick={exportPng}
              data-cuelume-tap={undefined}
              disabled={status !== "Compiled"}
            >
              <ArrowDownToLine />
              Export PNG
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label="Project options"
                    data-cuelume-tap="open"
                  />
                }
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuItem
                  onClick={() =>
                    void createProject(
                      newProject("Untitled study", {
                        nodes: [makeNode("output", "out", 300, 150)],
                        edges: [],
                        name: "Untitled study",
                        presetIndex: 0,
                      })
                    )
                  }
                >
                  <Plus />
                  New project
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => file.current?.click()}>
                  <FolderOpen />
                  Import graph JSON
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Sparkles />
                    Example graphs
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[220px]">
                    {presetNames.map((presetName, i) => (
                      <DropdownMenuItem
                        key={presetName}
                        data-cuelume-tap={undefined}
                        onClick={() => loadPreset(i)}
                      >
                        {presetName}
                        {presetIndex === i && <Check className="ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem
                  data-cuelume-tap="tap"
                  onClick={() =>
                    download(
                      new Blob(
                        [
                          JSON.stringify(
                            { nodes, edges, name, presetIndex },
                            null,
                            2
                          ),
                        ],
                        { type: "application/json" }
                      ),
                      "nodeart-graph.json"
                    )
                  }
                >
                  <ArrowDownToLine />
                  Download graph JSON
                </DropdownMenuItem>
                <DropdownMenuItem
                  data-cuelume-tap="open"
                  onClick={() => setShowCode(true)}
                >
                  <Code2 />
                  View GLSL
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="hidden! max-[850px]:flex!"
                  data-cuelume-tap="open"
                  onClick={() => setLibraryOpen(true)}
                >
                  <Plus />
                  Add a node
                </DropdownMenuItem>
                {edges.some((edge) => edge.id === selectedEdgeId) && (
                  <DropdownMenuItem
                    data-cuelume-tap="close"
                    onClick={() => {
                      setEdges((es) =>
                        es.filter((edge) => edge.id !== selectedEdgeId)
                      )
                      setSelectedEdgeId("")
                      setDirty(true)
                    }}
                  >
                    <Trash2 />
                    Delete selected wire
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="workspace-grid grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_370px] gap-4 px-4 pb-4 max-[1100px]:grid-cols-[210px_minmax(0,1fr)_310px] max-[850px]:grid-cols-[minmax(0,1fr)_300px] max-[600px]:grid-cols-1 max-[600px]:grid-rows-[minmax(320px,1fr)_minmax(280px,1fr)] max-[600px]:overflow-y-auto min-[1500px]:grid-cols-[260px_minmax(0,1fr)_420px]">
          <aside className="library-panel flex min-h-0 flex-col rounded-xl max-[850px]:hidden">
            <div className="px-4 pt-5">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold">Node library</h2>
                <span className="rounded px-1.5 text-[12px] text-[#294d65]">
                  {Object.keys(definitions).length}
                </span>
              </div>
              <p className="mb-4 text-[12px] text-[#294d65]">
                Little pieces. Endless possibilities.
              </p>
              <div className="relative">
                <Search className="absolute top-2.5 left-2.5 z-10 size-3.5 text-[#294d65]" />
                <Input
                  className="library-search pl-8!"
                  placeholder="Find a node…"
                  aria-label="Search nodes"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="library-scroll mx-3 mt-4 min-h-0 flex-1 overflow-y-auto rounded-lg px-3 pt-4 pb-4">
              {categories.map((category) => {
                const items = (
                  Object.entries(definitions) as [
                    Kind,
                    (typeof definitions)[Kind],
                  ][]
                ).filter(
                  ([, d]) =>
                    d.category === category &&
                    `${d.title} ${d.description}`
                      .toLowerCase()
                      .includes(search.toLowerCase())
                )
                return (
                  items.length > 0 && (
                    <section className="mb-7" key={category}>
                      <h3 className="mb-2 flex items-center gap-2 px-2 text-[12px] font-semibold tracking-[.13em] text-[#294d65] uppercase">
                        <CategoryIcon name={category} className="size-3.5" />
                        {category}
                      </h3>
                      {items.map(([kind, d]) => (
                        <Button
                          key={kind}
                          variant="secondary"
                          data-slot="library-item"
                          className="library-item mb-1 flex w-full justify-start gap-2.5 rounded-md px-2 text-[12px]"
                          title={d.description}
                          onClick={() => addNode(kind)}
                          data-cuelume-tap=""
                        >
                          <span
                            className="library-dot"
                            style={{ background: d.color }}
                          />
                          <span className="flex-1 text-left">{d.title}</span>
                          <Plus className="add-indicator size-3" />
                        </Button>
                      ))}
                    </section>
                  )
                )
              })}
              {!Object.entries(definitions).some(([, d]) =>
                `${d.title} ${d.description}`
                  .toLowerCase()
                  .includes(search.toLowerCase())
              ) && (
                <p className="p-2 text-xs text-[#294d65]">No matching nodes.</p>
              )}
            </div>
          </aside>
          <section className="flex min-h-0 min-w-0 flex-col">
            <div className="graph-workspace relative min-h-0 flex-1">
              <ReactFlow
                nodes={nodes.map((n) => ({
                  ...n,
                  selected: n.id === selectedId,
                }))}
                edges={edges}
                onNodesChange={(changes) => {
                  onNodesChange(changes)
                  if (
                    changes.some(
                      (c) => c.type === "remove" || c.type === "position"
                    )
                  )
                    setDirty(true)
                }}
                onEdgesChange={(changes) => {
                  onEdgesChange(changes)
                  setDirty(true)
                }}
                onConnect={connect}
                nodeTypes={nodeTypes}
                onNodeClick={(_, n) => {
                  setSelectedId(n.id)
                  play("select", { emphasis: "subtle" })
                }}
                onPaneClick={() => {
                  setSelectedId("")
                  setSelectedEdgeId("")
                }}
                isValidConnection={(c) => canConnect(c, nodes, edges)}
                connectOnClick
                connectionRadius={30}
                onEdgeClick={(_, edge) => {
                  setSelectedEdgeId(edge.id)
                  setSelectedId("")
                }}
                onConnectEnd={(_, state) => {
                  if (state.fromNode && state.toNode && !state.isValid)
                    notify(
                      "Incompatible connection. Generator controls require uniforms; definition ports require matching types."
                    )
                }}
                fitView
                fitViewOptions={{ padding: 0.18 }}
                minZoom={0.25}
                maxZoom={1.8}
                deleteKeyCode={["Backspace", "Delete"]}
                defaultEdgeOptions={{
                  type: "default",
                  style: { stroke: "#346988", strokeWidth: 2 },
                }}
              >
                <Background gap={18} size={1} color="#ccdce7" />
                <Controls showInteractive={false} />
                <MiniMap
                  nodeColor={(n) => definitions[(n as ArtNode).data.kind].color}
                  maskColor="#ffffffcc"
                  pannable
                  zoomable
                  className="!h-[75px] !w-[115px]"
                />
              </ReactFlow>
            </div>
          </section>
          <aside className="preview-panel flex min-h-0 flex-col rounded-xl">
            <div className="flex h-[54px] shrink-0 items-center justify-between px-4">
              <h2 className="flex items-center gap-2 text-[12px] font-semibold">
                <Aperture className="size-4 text-[#294d65]" />
                Live preview
              </h2>
              <span className="flex items-center gap-1.5 text-[12px] text-[#294d65]">
                <span className="live-dot" />
                WEBGL
              </span>
            </div>
            <ResizablePanelGroup
              orientation="vertical"
              className="preview-split min-h-0 flex-1"
            >
              <ResizablePanel id="preview" defaultSize="55%" minSize="180px">
                <div className="preview-content h-full overflow-y-auto px-4 pb-3">
                  <div
                    className={
                      full
                        ? "preview-full fixed inset-8 z-40 flex items-center justify-center rounded-2xl p-10"
                        : "preview-frame relative mx-auto max-w-[280px] overflow-hidden rounded-lg"
                    }
                  >
                    <div
                      className={
                        full ? "aspect-square w-full max-w-[75vh]" : ""
                      }
                    >
                      <Preview
                        nodes={renderNodes}
                        edges={renderEdges}
                        playing={playing}
                        reset={reset}
                        resolution={resolution}
                        canvasRef={canvas}
                        onStatus={setStatus}
                        onTime={setTime}
                      />
                    </div>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      className="preview-expand absolute right-3 bottom-3"
                      aria-label={
                        full ? "Close expanded preview" : "Expand preview"
                      }
                      onClick={() => setFull(!full)}
                    >
                      {full ? <X /> : <Expand />}
                    </Button>
                  </div>
                  {status !== "Compiled" && (
                    <p role="alert" className="mt-2 text-[12px] text-red-700">
                      {status}
                    </p>
                  )}

                  <div className="transport mt-3 flex items-center gap-2 rounded-lg py-2">
                    <Button
                      variant="primary"
                      size="icon-sm"
                      aria-label={
                        playing ? "Pause animation" : "Play animation"
                      }
                      onClick={() => setPlaying(!playing)}
                    >
                      {playing ? (
                        <Pause className="size-3" />
                      ) : (
                        <Play className="size-3" />
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label="Reset time and frame history"
                      onClick={() => {
                        setReset((r) => r + 1)
                        setTime(0)
                      }}
                    >
                      <RotateCcw className="size-3" />
                    </Button>
                    <span className="ml-1 font-mono text-[12px] text-[#294d65]">
                      {time.toFixed(2)}
                      <span className="ml-1 text-[12px] opacity-50">s</span>
                    </span>
                    <div className="ml-auto">
                      <Select
                        value={resolution}
                        onValueChange={(v) => {
                          if (v) {
                            setResolution(Number(v))
                            play("select", { emphasis: "subtle" })
                          }
                        }}
                      >
                        <SelectTrigger
                          className="resolution-select"
                          aria-label="Render resolution"
                        >
                          <SelectValue>
                            {resolution === 512 ? "Standard" : "High quality"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={512}>Standard · 512</SelectItem>
                          <SelectItem value={1024}>
                            High quality · 1024
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle
                withHandle
                aria-label="Resize preview and properties"
              />
              <ResizablePanel id="properties" defaultSize="45%" minSize="160px">
                <div className="inspector h-full overflow-y-auto px-4 pt-4 pb-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[12px] font-semibold tracking-[.14em] text-[#294d65] uppercase">
                      Node properties
                    </span>
                    {selected && (
                      <span className="rounded px-1.5 py-0.5 text-[12px] text-[#294d65]">
                        {definitions[selected.data.kind].category}
                      </span>
                    )}
                  </div>
                  {selected ? (
                    <>
                      <h3 className="mb-1 flex items-center gap-2 text-[14px] font-semibold">
                        <CategoryIcon
                          name={definitions[selected.data.kind].category}
                        />
                        {definitions[selected.data.kind].title}
                      </h3>
                      <p className="mb-5 text-[12px] leading-relaxed text-[#294d65]">
                        {definitions[selected.data.kind].description}
                      </p>
                      <div className="parameters-surface rounded-lg p-4">
                        {["image", "alpha"].includes(selected.data.kind) && (
                          <ImageEditor
                            key={selected.id}
                            node={selected}
                            nodes={nodes}
                            onData={changeData}
                            onAlpha={() => {
                              const id = newNodeId(),
                                alpha = makeNode(
                                  "alpha",
                                  id,
                                  selected.position.x,
                                  selected.position.y + 200
                                )
                              alpha.data.image = selected.data.image
                              const coordinates = edges.find(
                                (edge) =>
                                  edge.target === selected.id &&
                                  edge.targetHandle === "0"
                              )
                              setNodes((previous) => [...previous, alpha])
                              if (coordinates)
                                setEdges((previous) => [
                                  ...previous,
                                  {
                                    ...coordinates,
                                    id: newNodeId(),
                                    target: id,
                                  },
                                ])
                              setSelectedId(id)
                              setDirty(true)
                            }}
                          />
                        )}
                        <ParameterEditor
                          key={selected.id}
                          node={selected}
                          nodes={nodes}
                          edges={edges}
                          onParam={changeParam}
                          onData={changeData}
                          onSelect={setSelectedId}
                          onDisconnect={(id) => {
                            setEdges((previous) =>
                              previous.filter((edge) => edge.id !== id)
                            )
                            setDirty(true)
                          }}
                        />
                      </div>
                      <div className="mt-5 flex gap-2">
                        <Button
                          disabled={selected.data.kind === "output"}
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const id = newNodeId()
                            setNodes((ns) => [
                              ...ns,
                              {
                                ...selected,
                                id,
                                position: {
                                  x: selected.position.x + 50,
                                  y: selected.position.y + 70,
                                },
                              },
                            ])
                            setSelectedId(id)
                            setDirty(true)
                          }}
                        >
                          <Copy className="size-3" />
                          Duplicate
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label="Delete selected node"
                          onClick={remove}
                        >
                          <Trash2 className="size-3" />
                          Delete
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="py-5 text-center text-[12px] leading-relaxed text-[#294d65]">
                      <Layers3 className="mx-auto mb-3 size-6 opacity-50" />
                      Select a node to explore
                      <br />
                      its possibilities.
                    </div>
                  )}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </aside>
        </div>

        {storageError && (
          <div
            role="alert"
            className="fixed bottom-3 left-4 z-40 max-w-[80vw] rounded-lg bg-[#edf1f4] px-4 py-2 text-[12px] text-red-800"
          >
            {storageError}
          </div>
        )}
        <ProjectBrowser
          open={projectsOpen}
          onOpenChange={setProjectsOpen}
          projects={projects}
          activeId={projectId}
          busy={busy}
          onChoose={(project) => void chooseProject(project)}
          onNew={() =>
            void createProject(
              newProject("Untitled study", {
                nodes: [makeNode("output", "out", 300, 150)],
                edges: [],
                name: "Untitled study",
                presetIndex: 0,
              })
            )
          }
          onDuplicate={(project) =>
            void createProject(
              newProject(
                `${project.name} copy`,
                project.id === projectId ? JSON.parse(snapshot) : project
              )
            )
          }
          onImport={() => file.current?.click()}
          onDelete={async (project) => {
            if (project.id === projectId) return false
            setBusy(true)
            try {
              await deleteProject(project.id)
              setProjects((previous) =>
                previous.filter((p) => p.id !== project.id)
              )
              play("success", { emphasis: "subtle" })
              return true
            } catch {
              notify("Unable to delete this project.")
              return false
            } finally {
              setBusy(false)
            }
          }}
        />
        {notice && (
          <div
            role="status"
            className="toast fixed bottom-12 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-xs"
          >
            <Check className="size-3.5" />
            {notice}
          </div>
        )}
        <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
          <DialogContent className="modal-surface !max-w-lg">
            <DialogTitle>Add a node</DialogTitle>
            <Input
              placeholder="Find a node…"
              aria-label="Search node picker"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto">
              {(
                Object.entries(definitions) as [
                  Kind,
                  (typeof definitions)[Kind],
                ][]
              )
                .filter(([, d]) =>
                  d.title.toLowerCase().includes(search.toLowerCase())
                )
                .map(([kind, d]) => (
                  <Button
                    variant="secondary"
                    key={kind}
                    className="justify-start"
                    onClick={() => {
                      addNode(kind)
                      setLibraryOpen(false)
                    }}
                  >
                    <Plus className="size-3" />
                    {d.title}
                  </Button>
                ))}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={showCode || help}
          onOpenChange={(open) => {
            if (!open) {
              setShowCode(false)
              setHelp(false)
            }
          }}
        >
          <DialogContent
            showCloseButton={false}
            className="modal-surface !max-w-2xl rounded-2xl p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <DialogTitle className="font-semibold">
                {help
                  ? "A little guide to the playground"
                  : "Your graph, in GLSL"}
              </DialogTitle>
              <Button
                autoFocus
                variant="secondary"
                size="icon-sm"
                aria-label="Close dialog"
                onClick={() => {
                  setShowCode(false)
                  setHelp(false)
                }}
              >
                <X />
              </Button>
            </div>
            {help ? (
              <div className="space-y-4 text-sm leading-relaxed text-[#294d65]">
                <p>
                  Click a library node to add it. Drag from its right socket to
                  an input on another node. Select a node to adjust its
                  properties. Select a wire and press Delete to disconnect it.
                </p>
                <p>
                  Coordinates describe each pixel. Fields produce numbers,
                  palettes turn them into colors, and Image output displays the
                  result. Scalar values broadcast across color channels;
                  coordinates use the first two channels.
                </p>
                <p>
                  IFS and wave collapse generate textures. Connect warped
                  coordinates to sample them, then use a palette or blend them
                  with any other field. Previous frame samples the last image
                  for feedback without a graph cycle.
                </p>
                <p>
                  Projects opens your local project library. Changes save
                  automatically on this device. Example graphs create separate
                  projects; Download graph JSON includes imported images in a
                  portable backup.
                </p>
                <p>
                  Enter exact parameter values and press Enter, or use Shift +
                  arrow keys for fine adjustments. Parameter sockets accept
                  uniforms from Time, Value, and math nodes. Image texture and
                  Image alpha use imported project images; Composite blends them
                  with masks and procedural artwork.
                </p>
                <Button
                  onClick={() => {
                    setHelp(false)
                    flow.fitView({ padding: 0.18 })
                  }}
                >
                  <Maximize2 />
                  Back to the playground
                </Button>
              </div>
            ) : (
              <>
                <pre className="max-h-[60vh] overflow-auto rounded-lg bg-transparent p-4 text-[12px] leading-relaxed text-[#294d65]">
                  {code}
                </pre>
                <Button
                  className="mt-4"
                  onClick={() =>
                    download(
                      new Blob([code], { type: "text/plain" }),
                      "nodeart.frag"
                    )
                  }
                >
                  <ArrowDownToLine />
                  Download shader
                </Button>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </NodeActions.Provider>
  )
}
export default function App() {
  const [library, setLibrary] = useState<Library | null>(null)
  useEffect(() => {
    let cancelled = false
    void loadLibrary().then((value) => {
      if (!cancelled) setLibrary(value)
    })
    return () => {
      cancelled = true
    }
  }, [])
  if (!library)
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm"
        role="status"
      >
        Opening your projects…
      </div>
    )
  return (
    <ReactFlowProvider>
      <Workspace library={library} />
    </ReactFlowProvider>
  )
}
