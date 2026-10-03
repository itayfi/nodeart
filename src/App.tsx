import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  lazy,
  Suspense,
  type CSSProperties,
} from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeProps,
  type Connection,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { editor } from "monaco-editor"
import {
  Workflow,
  FolderOpen,
  Save,
  Download,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Undo2,
  Redo2,
  CircleHelp,
  Maximize,
  Minimize,
  Video,
  Upload,
} from "lucide-react"
import { play } from "cuelume"
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./components/ui/select"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./components/ui/dropdown-menu"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./components/ui/resizable"
import { SoundToggle } from "./components/sound-toggle"
import { CategoryIcon, type CategoryIconName } from "./components/category-icon"
import { PassPreview } from "./components/pass-preview"
import { AISettings } from "./components/ai-settings"
import { VideoExport } from "./components/video-export"
import { SnippetLibrary } from "./components/snippet-library"
import { insertGLSLSnippet } from "./glsl-snippets"
import { supportedVideoFormats } from "./video-export"
import {
  creativeExamples,
  creativeProject,
  passPresets,
  presetPass,
} from "./pass-presets"
import { localCompletion, type AIState } from "./ai"
import {
  MAX_INPUTS,
  labels,
  makePass,
  port,
  starterProject,
  exampleProject,
  parsePassProject,
  passAPI,
  validatePorts,
  renamePortCode,
  canWire,
  type PassKind,
  type PassNode,
  type PassProject,
  type TexturePort,
} from "./passes"
import {
  readPassLibrary,
  savePassProject,
  readPassPreviews,
  savePassPreview,
} from "./pass-library"

const category: Record<PassKind, CategoryIconName> = {
  glsl: "GLSL",
  p5: "p5.js",
  previous: "Previous frame",
  image: "Image",
}
const colors: Record<PassKind, string> = {
  glsl: "#368dd3",
  p5: "#c170aa",
  previous: "#bf974a",
  image: "#6f9c72",
}
function PassCard({ data, selected }: NodeProps<PassNode>) {
  return (
    <div
      className={`art-node w-52 rounded-xl ${selected ? "is-selected" : ""}`}
      style={{ "--node-color": colors[data.kind] } as CSSProperties}
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <CategoryIcon name={category[data.kind]} />
        <span className="text-sm font-semibold">{data.label}</span>
      </div>
      <p className="px-4 pb-3 text-xs">{labels[data.kind]}</p>
      {data.inputs.map((input) => (
        <div
          key={input.id}
          className="relative flex items-center justify-between gap-3 px-4 pb-3 text-xs"
        >
          <Handle
            type="target"
            position={Position.Left}
            id={input.id}
            style={{ top: 8, left: -5 }}
          />
          <span>{input.label}</span>
          <span className="font-mono">{input.name}</span>
        </div>
      ))}
      <div className="relative px-4 pt-1 pb-4 text-right font-mono text-xs">
        texture
        <Handle
          type="source"
          position={Position.Right}
          style={{ top: 9, right: -5 }}
        />
      </div>
    </div>
  )
}
const nodeTypes = { pass: PassCard }
const PassEditor = lazy(() =>
  import("./components/pass-editor").then((module) => ({
    default: module.PassEditor,
  }))
)
function subscribeMobile(callback: () => void) {
  const query = matchMedia("(max-width: 639px)")
  query.addEventListener("change", callback)
  return () => query.removeEventListener("change", callback)
}
function isMobile() {
  return matchMedia("(max-width: 639px)").matches
}
function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function signature(p: PassProject) {
  return JSON.stringify({
    nodes: p.nodes.map((n) => ({ id: n.id, data: n.data })),
    edges: p.edges.map((e) => ({
      source: e.source,
      target: e.target,
      targetHandle: e.targetHandle,
    })),
    output: p.output,
  })
}
function storedLayout(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? undefined
  } catch {
    return undefined
  }
}
function rememberLayout(key: string, layout: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(layout))
  } catch {
    /* Layout storage is optional. */
  }
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Workspace />
    </ReactFlowProvider>
  )
}
function Workspace() {
  const mobile = useSyncExternalStore(subscribeMobile, isMobile)
  const [project, setProject] = useState<PassProject>(starterProject)
  const [request, setRequest] = useState(() => ({ project, revision: 0 }))
  const [runningProject, setRunningProject] = useState(project)
  const [hasRendered, setHasRendered] = useState(false)
  const [selectedId, setSelectedId] = useState(project.output)
  const [projects, setProjects] = useState<PassProject[]>([])
  const [initialized, setInitialized] = useState(false)
  const [storage, setStorage] = useState("Loading projects…")
  const [notice, setNotice] = useState("")
  const [status, setStatus] = useState("Compiling…")
  const [recording, setRecording] = useState(false)
  const recordingRef = useRef(false)
  const previewFrameRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const onRecording = useCallback((value: boolean) => {
    recordingRef.current = value
    setRecording(value)
  }, [])
  useEffect(() => {
    const changed = () =>
      setFullscreen(document.fullscreenElement === previewFrameRef.current)
    document.addEventListener("fullscreenchange", changed)
    return () => document.removeEventListener("fullscreenchange", changed)
  }, [])
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === previewFrameRef.current)
        await document.exitFullscreen()
      else await previewFrameRef.current?.requestFullscreen()
    } catch (error) {
      setNotice(
        `Fullscreen unavailable: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
  const [playing, setPlaying] = useState(true),
    [time, setTime] = useState(0),
    [resolution, setResolution] = useState(512)
  const [libraryOpen, setLibraryOpen] = useState(false),
    [helpOpen, setHelpOpen] = useState(false),
    [search, setSearch] = useState("")
  const [ai, setAI] = useState<AIState>({
      phase: "off",
      detail: "No model loaded",
    }),
    [automatic, setAutomatic] = useState(false)
  const [portDialog, setPortDialog] = useState<{
    mode: "add" | "rename" | "remove"
    input?: TexturePort
  } | null>(null)
  const [portName, setPortName] = useState(""),
    [portLabel, setPortLabel] = useState(""),
    [portError, setPortError] = useState("")
  const [deleteNode, setDeleteNode] = useState(false)
  const [maxInputs, setMaxInputs] = useState(MAX_INPUTS)
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)
  const [videoOpen, setVideoOpen] = useState(false)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const canvasRef = useRef<HTMLCanvasElement>(null),
    editorRef = useRef<editor.IStandaloneCodeEditor | null>(null),
    jsonRef = useRef<HTMLInputElement>(null),
    imageRef = useRef<HTMLInputElement>(null)
  const history = useRef<PassProject[]>([]),
    future = useRef<PassProject[]>([]),
    lastCode = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    latest = useRef(project)
  useEffect(() => {
    latest.current = project
  }, [project])
  const selected = project.nodes.find((n) => n.id === selectedId)
  const dirty = signature(project) !== signature(runningProject)
  const onStatus = useCallback((value: string) => setStatus(value), [])
  const onTime = useCallback((value: number) => setTime(value), [])
  const onApplied = useCallback((value: PassProject) => {
    setRunningProject(value)
    setHasRendered(true)
  }, [])
  const onRuntimeError = useCallback(() => setPlaying(false), [])
  const onEditor = useCallback((value: editor.IStandaloneCodeEditor) => {
    editorRef.current = value
  }, [])
  useEffect(() => localCompletion.subscribe(setAI), [])
  useEffect(() => {
    let alive = true
    void readPassPreviews().then((value) => {
      if (alive) setPreviews(value)
    })
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => {
    if (!hasRendered) return
    const timeout = setTimeout(() => {
      const visible = canvasRef.current
      if (!visible?.width) return
      try {
        const thumbnail = document.createElement("canvas")
        thumbnail.width = thumbnail.height = 200
        thumbnail.getContext("2d")!.drawImage(visible, 0, 0, 200, 200)
        const image = thumbnail.toDataURL("image/jpeg", 0.7)
        setPreviews((previous) => ({ ...previous, [runningProject.id]: image }))
        void savePassPreview(runningProject.id, image).catch(() => {})
      } catch {
        /* A missing thumbnail must not interrupt artwork or saving. */
      }
    }, 1500)
    return () => clearTimeout(timeout)
  }, [runningProject, hasRendered, libraryOpen])
  useEffect(() => {
    let alive = true
    void readPassLibrary().then((library) => {
      if (!alive) return
      setProjects(library.projects)
      setProject(library.active)
      setRequest({ project: library.active, revision: 1 })
      setSelectedId(library.active.output)
      setNotice(library.error ?? "")
      setStorage("Saved locally")
      setInitialized(true)
    })
    const probe = document.createElement("canvas").getContext("webgl")
    if (probe) {
      const limit = Math.min(
        MAX_INPUTS,
        probe.getParameter(probe.MAX_TEXTURE_IMAGE_UNITS)
      )
      queueMicrotask(() => {
        if (alive) setMaxInputs(limit)
      })
      probe.getExtension("WEBGL_lose_context")?.loseContext()
    }
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => {
    if (!initialized) return
    let active = true
    const timeout = setTimeout(() => {
      setStorage("Saving…")
      void savePassProject(project)
        .then(() => {
          if (active) {
            setStorage("Saved locally")
            setProjects((previous) => [
              project,
              ...previous.filter((p) => p.id !== project.id),
            ])
          }
        })
        .catch(() => {
          if (active) setStorage("Save failed · download JSON backup")
        })
    }, 650)
    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [project, initialized])
  function change(next: PassProject, code = false) {
    if (!code || !lastCode.current) {
      history.current = [...history.current.slice(-39), project]
    }
    clearTimeout(lastCode.current)
    lastCode.current = code
      ? setTimeout(() => {
          lastCode.current = undefined
        }, 650)
      : undefined
    future.current = []
    setUndoCount(history.current.length)
    setRedoCount(0)
    setProject(next)
  }
  function patchNode(data: Partial<PassNode["data"]>, code = false) {
    if (!selected) return
    change(
      {
        ...project,
        nodes: project.nodes.map((n) =>
          n.id === selected.id ? { ...n, data: { ...n.data, ...data } } : n
        ),
      },
      code
    )
  }
  function run(p = project) {
    if (recordingRef.current) {
      setNotice("Finish recording before running another graph.")
      return
    }
    setRequest({ project: p, revision: request.revision + 1 })
    setPlaying(true)
    setNotice("")
  }
  function activate(p: PassProject, execute = true) {
    if (recordingRef.current) {
      setNotice("Finish recording before switching projects.")
      return
    }
    clearTimeout(lastCode.current)
    lastCode.current = undefined
    // Preserve edits even when the autosave debounce has not elapsed yet.
    if (initialized) {
      setProjects((previous) => [
        project,
        ...previous.filter((saved) => saved.id !== project.id),
      ])
      void savePassProject(project).catch(() =>
        setNotice(
          "Previous project is kept in this session, but local save failed."
        )
      )
    }
    history.current = []
    future.current = []
    setUndoCount(0)
    setRedoCount(0)
    setProject(p)
    setSelectedId(p.output)
    setLibraryOpen(false)
    if (execute) run(p)
  }
  function add(kind: PassKind, presetId?: string) {
    if (project.nodes.length >= 64) {
      setNotice("A project supports up to 64 nodes.")
      return
    }
    const n = presetId ? presetPass(presetId) : makePass(kind)
    n.position = {
      x: 60 + (project.nodes.length % 3) * 250,
      y: 60 + Math.floor(project.nodes.length / 3) * 190,
    }
    change({
      ...project,
      nodes: [...project.nodes, n],
      output: project.output || n.id,
    })
    setSelectedId(n.id)
  }
  function wire(connection: Connection) {
    if (!canWire(connection, project.nodes, project.edges)) {
      setNotice(
        "Feedback needs a Previous frame node. Each input accepts one texture."
      )
      return
    }
    change({
      ...project,
      edges: [
        ...project.edges.filter(
          (e) =>
            !(
              e.target === connection.target &&
              e.targetHandle === connection.targetHandle
            )
        ),
        { ...connection, id: crypto.randomUUID() },
      ],
    })
  }
  function undo() {
    clearTimeout(lastCode.current)
    lastCode.current = undefined
    const p = history.current.pop()
    if (p) {
      future.current.push(project)
      setProject(p)
      setUndoCount(history.current.length)
      setRedoCount(future.current.length)
    }
  }
  function redo() {
    clearTimeout(lastCode.current)
    lastCode.current = undefined
    const p = future.current.pop()
    if (p) {
      history.current.push(project)
      setProject(p)
      setUndoCount(history.current.length)
      setRedoCount(future.current.length)
    }
  }
  function openPort(mode: "add" | "rename" | "remove", input?: TexturePort) {
    let name = "source"
    let i = 2
    while (selected?.data.inputs.some((p) => p.name === name))
      name = `texture${i++}`
    setPortName(input?.name ?? name)
    setPortLabel(input?.label ?? "Source")
    setPortError("")
    setPortDialog({ mode, input })
  }
  const renamedCode =
    selected && portDialog?.input
      ? renamePortCode(
          selected.data.code,
          selected.data.kind,
          portDialog.input.name,
          portName
        )
      : (selected?.data.code ?? "")
  function applyPort() {
    if (!selected || !portDialog) return
    const { mode, input } = portDialog
    const inputs =
      mode === "add"
        ? [...selected.data.inputs, port(portName, portLabel || portName)]
        : mode === "remove"
          ? selected.data.inputs.filter((p) => p.id !== input!.id)
          : selected.data.inputs.map((p) =>
              p.id === input!.id
                ? { ...p, name: portName, label: portLabel || portName }
                : p
            )
    try {
      validatePorts(inputs)
      if (inputs.length > maxInputs)
        throw new Error("This GPU cannot support more texture inputs.")
    } catch (error) {
      setPortError(String(error))
      return
    }
    change({
      ...project,
      nodes: project.nodes.map((n) =>
        n.id === selected.id
          ? {
              ...n,
              data: {
                ...n.data,
                inputs,
                code: mode === "rename" ? renamedCode : n.data.code,
              },
            }
          : n
      ),
      edges:
        mode === "remove"
          ? project.edges.filter(
              (e) => !(e.target === selected.id && e.targetHandle === input!.id)
            )
          : project.edges,
    })
    setPortDialog(null)
  }
  async function importJSON(file?: File) {
    if (!file) return
    try {
      if (file.size > 48 * 1024 * 1024)
        throw new Error("Choose a project smaller than 48 MB.")
      const p = parsePassProject(JSON.parse(await file.text()))
      p.id = crypto.randomUUID()
      activate(p, false)
      setNotice("Imported as a new project. Review the code and press Run.")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    }
  }
  async function importImage(file?: File) {
    if (!file || !selected || selected.data.kind !== "image") return
    const id = selected.id
    try {
      if (
        !/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type) ||
        file.size > 20 * 1024 * 1024
      )
        throw new Error(
          "Choose a PNG, JPEG, WebP, GIF, or AVIF smaller than 20 MB."
        )
      const bitmap = await createImageBitmap(file)
      try {
        if (bitmap.width > 4096 || bitmap.height > 4096)
          throw new Error("Images may be up to 4096 × 4096 pixels.")
        const canvas = document.createElement("canvas")
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0)
        const src = canvas.toDataURL("image/png")
        if (src.length > 24 * 1024 * 1024)
          throw new Error("Decoded image is too large. Choose a smaller image.")
        const current = latest.current
        if (current.id !== project.id) return
        change({
          ...current,
          nodes: current.nodes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    image: {
                      src,
                      name: file.name,
                      width: bitmap.width,
                      height: bitmap.height,
                    },
                  },
                }
              : n
          ),
        })
      } finally {
        bitmap.close()
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    }
  }
  const graphNodes = useMemo(
    () => project.nodes.map((n) => ({ ...n, selected: n.id === selectedId })),
    [project.nodes, selectedId]
  )
  return (
    <main
      className={`app-shell flex min-h-0 flex-col gap-3 p-4 ${mobile ? "min-h-dvh" : "h-dvh"}`}
    >
      <header className="app-header flex shrink-0 flex-wrap items-center gap-4 px-2 pb-2">
        <div className="brand-orb flex items-center justify-center rounded-full">
          <Workflow className="size-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">nodeart.</h1>
        <p className="hidden text-xs tracking-widest md:block">
          A SPACE FOR HAPPY ACCIDENTS
        </p>
        <div className="ml-auto flex gap-2">
          <SoundToggle />
          <Button
            variant="secondary"
            size="icon"
            aria-label="Help"
            data-cuelume-tap="open"
            onClick={() => setHelpOpen(true)}
          >
            <CircleHelp />
          </Button>
        </div>
      </header>
      <section
        aria-label="Project"
        className="project-bar flex shrink-0 flex-wrap items-center gap-3 rounded-xl p-3"
      >
        <FolderOpen className="size-5" />
        <Input
          aria-label="Project name"
          className="w-48"
          value={project.name}
          data-cuelume-type=""
          onChange={(e) => change({ ...project, name: e.target.value })}
        />
        <span className="text-xs" role="status">
          {storage}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="secondary"
            data-cuelume-tap="open"
            onClick={() => setLibraryOpen(true)}
          >
            <FolderOpen />
            Projects
          </Button>
          <Button
            variant="secondary"
            data-cuelume-tap="tap"
            onClick={() =>
              void savePassProject(project)
                .then(() => {
                  setStorage("Saved locally")
                  play("success", { emphasis: "subtle" })
                })
                .catch(() => setStorage("Save failed · download JSON backup"))
            }
          >
            <Save />
            Save
          </Button>
          <Button
            data-cuelume-tap="tap"
            onClick={() =>
              canvasRef.current?.toBlob((blob) => {
                if (blob) {
                  download(`${project.name}.png`, blob)
                  play("ready", { emphasis: "subtle" })
                }
              })
            }
          >
            <Download />
            Export PNG
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Project options"
                  data-cuelume-tap="open"
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                data-cuelume-tap="open"
                disabled={
                  !initialized ||
                  !hasRendered ||
                  status === "Compiling…" ||
                  supportedVideoFormats().length === 0 ||
                  !HTMLCanvasElement.prototype.captureStream
                }
                onClick={() => setVideoOpen(true)}
              >
                <Video />
                Export video
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Examples</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {creativeExamples.map((example) => (
                    <DropdownMenuItem
                      key={example.id}
                      className="flex max-w-80 flex-col items-start gap-1 py-2 whitespace-normal"
                      data-cuelume-tap="select"
                      onClick={() => activate(creativeProject(example.id))}
                    >
                      <span>{example.label}</span>
                      <span className="text-xs">{example.description}</span>
                    </DropdownMenuItem>
                  ))}
                  {(["feedback", "blend", "mixed"] as const).map((kind) => (
                    <DropdownMenuItem
                      key={kind}
                      data-cuelume-tap="select"
                      onClick={() => activate(exampleProject(kind))}
                    >
                      {kind === "feedback"
                        ? "Afterimage feedback"
                        : kind === "blend"
                          ? "Two texture blend"
                          : "p5.js + GLSL"}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                data-cuelume-tap="tap"
                onClick={async () => {
                  try {
                    const { projectCodeZip, safeFilename } =
                      await import("./code-export")
                    const zip = projectCodeZip(project)
                    download(
                      `${safeFilename(project.name)}-code.zip`,
                      new Blob([new Uint8Array(zip).buffer], {
                        type: "application/zip",
                      })
                    )
                    play("success", { emphasis: "subtle" })
                  } catch (error) {
                    setNotice(
                      `Code export failed: ${error instanceof Error ? error.message : String(error)}`
                    )
                  }
                }}
              >
                <Download />
                Download code ZIP
              </DropdownMenuItem>
              <DropdownMenuItem
                data-cuelume-tap="tap"
                onClick={() => {
                  download(
                    `${project.name}.json`,
                    new Blob([JSON.stringify(project, null, 2)], {
                      type: "application/json",
                    })
                  )
                }}
              >
                Download JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                data-cuelume-tap="tap"
                onClick={() => jsonRef.current?.click()}
              >
                Import JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>
      {notice && (
        <div
          role="status"
          className="flex shrink-0 items-center gap-2 px-2 text-sm"
        >
          <span className="flex-1">{notice}</span>
          <Button variant="secondary" size="sm" onClick={() => setNotice("")}>
            Dismiss
          </Button>
        </div>
      )}
      <input
        ref={jsonRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          void importJSON(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <input
        ref={imageRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        hidden
        onChange={(e) => {
          void importImage(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      <div
        className={`pass-workspace min-h-0 ${mobile ? "h-[1480px] flex-none" : "flex-1"}`}
      >
        <ResizablePanelGroup
          key={mobile ? "mobile" : "desktop"}
          orientation={mobile ? "vertical" : "horizontal"}
          defaultLayout={storedLayout(
            mobile ? "nodeart-layout-mobile" : "nodeart-layout-main"
          )}
          onLayoutChanged={(layout) =>
            rememberLayout(
              mobile ? "nodeart-layout-mobile" : "nodeart-layout-main",
              layout
            )
          }
        >
          <ResizablePanel
            id="code"
            defaultSize={mobile ? "46%" : "64%"}
            minSize="25%"
          >
            <section className="pass-panel flex h-full min-h-0 flex-col rounded-xl">
              <div className="flex shrink-0 flex-wrap items-center gap-2 p-3">
                <h2 className="mr-auto">
                  Code{" "}
                  {dirty && (
                    <span className="ml-2 text-xs font-normal">· draft</span>
                  )}
                </h2>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label="Undo graph edit"
                  disabled={!undoCount}
                  data-cuelume-tap="navigate"
                  onClick={undo}
                >
                  <Undo2 />
                </Button>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label="Redo graph edit"
                  disabled={!redoCount}
                  data-cuelume-tap="navigate"
                  onClick={redo}
                >
                  <Redo2 />
                </Button>
                <AISettings
                  state={ai}
                  automatic={automatic}
                  onAutomatic={setAutomatic}
                />
                <SnippetLibrary
                  disabled={selected?.data.kind !== "glsl"}
                  onInsert={(id) => {
                    if (selected?.data.kind !== "glsl")
                      throw new Error("Select a GLSL pass first.")
                    const result = insertGLSLSnippet(selected.data.code, id)
                    if (!result.added.length) {
                      setNotice(
                        "These snippet functions are already in this pass."
                      )
                      return
                    }
                    const model = editorRef.current?.getModel()
                    if (model?.getValue() === selected.data.code) {
                      editorRef.current!.pushUndoStop()
                      editorRef.current!.executeEdits("nodeart.snippet", [
                        { range: model.getFullModelRange(), text: result.code },
                      ])
                      editorRef.current!.pushUndoStop()
                    } else patchNode({ code: result.code }, true)
                    setNotice(
                      `Inserted ${result.added.join(", ")}. Call the helpers in main(), then Run.`
                    )
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={
                    ai.phase !== "ready" ||
                    !selected ||
                    !["glsl", "p5"].includes(selected.data.kind)
                  }
                  data-cuelume-tap="tap"
                  onClick={() => {
                    editorRef.current?.focus()
                    void editorRef.current
                      ?.getAction("editor.action.inlineSuggest.trigger")
                      ?.run()
                  }}
                >
                  <Sparkles />
                  Suggest
                </Button>
                <Button
                  size="sm"
                  disabled={!initialized || recording}
                  data-cuelume-tap="tap"
                  onClick={() => run()}
                >
                  <Play />
                  Run
                </Button>
              </div>
              {selected ? (
                <>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 pb-3">
                    <CategoryIcon name={category[selected.data.kind]} />
                    <Input
                      aria-label="Pass name"
                      className="w-44"
                      value={selected.data.label}
                      data-cuelume-type=""
                      onChange={(e) => patchNode({ label: e.target.value })}
                    />
                    <span className="mr-auto text-xs">
                      {labels[selected.data.kind]}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      data-cuelume-tap="select"
                      aria-pressed={project.output === selected.id}
                      onClick={() =>
                        change({ ...project, output: selected.id })
                      }
                    >
                      {project.output === selected.id
                        ? "Output pass"
                        : "Use as output"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label="Duplicate pass"
                      data-cuelume-tap="tap"
                      onClick={() => {
                        if (project.nodes.length >= 64) return
                        const n = {
                          ...selected,
                          id: crypto.randomUUID(),
                          position: {
                            x: selected.position.x + 40,
                            y: selected.position.y + 40,
                          },
                          data: {
                            ...selected.data,
                            label: `${selected.data.label} copy`,
                            inputs: selected.data.inputs.map((p) => ({
                              ...p,
                              id: crypto.randomUUID(),
                            })),
                          },
                        }
                        change({ ...project, nodes: [...project.nodes, n] })
                        setSelectedId(n.id)
                      }}
                    >
                      <Copy />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label="Delete pass"
                      data-cuelume-tap="open"
                      onClick={() => setDeleteNode(true)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <ResizablePanelGroup
                    orientation="vertical"
                    defaultLayout={storedLayout("nodeart-layout-editor")}
                    onLayoutChanged={(layout) =>
                      rememberLayout("nodeart-layout-editor", layout)
                    }
                  >
                    <ResizablePanel id="editor" defaultSize="70%" minSize="25%">
                      <div
                        className="pass-editor h-full min-h-0 overflow-hidden"
                        data-cuelume-type=""
                        data-cuelume-emphasis="subtle"
                      >
                        {selected.data.kind === "glsl" ||
                        selected.data.kind === "p5" ? (
                          <Suspense
                            fallback={
                              <p className="p-4">Loading code editor…</p>
                            }
                          >
                            <PassEditor
                              node={selected}
                              onChange={(code) => patchNode({ code }, true)}
                              automatic={automatic}
                              error={status}
                              onReady={onEditor}
                            />
                          </Suspense>
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-4 overflow-auto p-6 text-center">
                            <CategoryIcon
                              name={category[selected.data.kind]}
                              className="size-12"
                            />
                            <h3 className="text-lg font-semibold">
                              {selected.data.label}
                            </h3>
                            <p className="max-w-md text-sm">
                              {passAPI(selected)}
                            </p>
                            {selected.data.kind === "image" && (
                              <>
                                {selected.data.image && (
                                  <img
                                    src={selected.data.image.src}
                                    className="max-h-40 max-w-full object-contain"
                                    alt={selected.data.image.name}
                                  />
                                )}
                                <Button
                                  variant="secondary"
                                  data-cuelume-tap="tap"
                                  onClick={() => imageRef.current?.click()}
                                >
                                  Choose image
                                </Button>
                                {selected.data.image && (
                                  <p className="font-mono text-xs">
                                    {selected.data.image.width} ×{" "}
                                    {selected.data.image.height}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </ResizablePanel>
                    <ResizableHandle
                      withHandle
                      aria-label="Resize code and texture inputs"
                    />
                    <ResizablePanel id="inputs" defaultSize="30%" minSize="12%">
                      <div className="h-full overflow-y-auto p-4">
                        <div className="mb-3 flex items-center gap-3">
                          <h2 className="mr-auto">Texture inputs</h2>
                          {["glsl", "p5"].includes(selected.data.kind) && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={
                                selected.data.inputs.length >= maxInputs
                              }
                              data-cuelume-tap="open"
                              onClick={() => openPort("add")}
                            >
                              <Plus />
                              Add input
                            </Button>
                          )}
                        </div>
                        {selected.data.inputs.length ? (
                          <div className="library-scroll rounded-lg p-2">
                            {selected.data.inputs.map((input, index) => {
                              const wire = project.edges.find(
                                  (e) =>
                                    e.target === selected.id &&
                                    e.targetHandle === input.id
                                ),
                                source = project.nodes.find(
                                  (n) => n.id === wire?.source
                                )
                              return (
                                <div
                                  className="flex flex-wrap items-center gap-2 p-2"
                                  key={input.id}
                                >
                                  <div className="mr-auto">
                                    <div className="text-sm font-medium">
                                      {input.label}{" "}
                                      <span className="ml-2 font-mono text-xs">
                                        {input.name}
                                      </span>
                                    </div>
                                    <div className="text-xs">
                                      {source
                                        ? source.data.label
                                        : "Unconnected · transparent black / null"}
                                    </div>
                                  </div>
                                  {wire && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      aria-label={`Disconnect ${input.label}`}
                                      onClick={() =>
                                        change({
                                          ...project,
                                          edges: project.edges.filter(
                                            (e) => e.id !== wire.id
                                          ),
                                        })
                                      }
                                    >
                                      Disconnect
                                    </Button>
                                  )}
                                  {selected.data.kind !== "previous" && (
                                    <>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        data-cuelume-tap="open"
                                        onClick={() =>
                                          openPort("rename", input)
                                        }
                                      >
                                        Edit
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        size="icon-sm"
                                        disabled={index === 0}
                                        aria-label={`Move ${input.label} up`}
                                        data-cuelume-tap="select"
                                        onClick={() => {
                                          const inputs = [
                                            ...selected.data.inputs,
                                          ]
                                          ;[inputs[index - 1], inputs[index]] =
                                            [inputs[index], inputs[index - 1]]
                                          patchNode({ inputs })
                                        }}
                                      >
                                        <ArrowUp />
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        size="icon-sm"
                                        disabled={
                                          index ===
                                          selected.data.inputs.length - 1
                                        }
                                        aria-label={`Move ${input.label} down`}
                                        data-cuelume-tap="select"
                                        onClick={() => {
                                          const inputs = [
                                            ...selected.data.inputs,
                                          ]
                                          ;[inputs[index + 1], inputs[index]] =
                                            [inputs[index], inputs[index + 1]]
                                          patchNode({ inputs })
                                        }}
                                      >
                                        <ArrowDown />
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        size="icon-sm"
                                        aria-label={`Remove ${input.label}`}
                                        data-cuelume-tap="open"
                                        onClick={() =>
                                          openPort("remove", input)
                                        }
                                      >
                                        <Trash2 />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="mb-4 text-sm">
                            {selected.data.kind === "image"
                              ? "Image sources have no texture inputs."
                              : "This pass generates artwork without incoming textures."}
                          </p>
                        )}
                        <details>
                          <summary className="cursor-pointer text-sm font-semibold">
                            Pass API
                          </summary>
                          <pre className="mt-3 overflow-x-auto font-mono text-xs whitespace-pre-wrap">
                            {passAPI(selected)}
                          </pre>
                        </details>
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
                  <h3>Select a node to edit its code</h3>
                  <Button variant="secondary" onClick={() => add("glsl")}>
                    <Plus />
                    Add GLSL pass
                  </Button>
                </div>
              )}
              <p
                className="max-h-24 shrink-0 overflow-auto px-4 py-2 text-xs"
                role="status"
              >
                {status === "Running"
                  ? dirty
                    ? "Draft changes · press Run to apply"
                    : "Running compiled graph"
                  : status}
              </p>
            </section>
          </ResizablePanel>
          <ResizableHandle
            withHandle
            className="pass-divider-main"
            aria-label="Resize code and preview workspace"
          />
          <ResizablePanel
            id="right"
            defaultSize={mobile ? "54%" : "36%"}
            minSize="25%"
          >
            <ResizablePanelGroup
              orientation="vertical"
              defaultLayout={storedLayout("nodeart-layout-right")}
              onLayoutChanged={(layout) =>
                rememberLayout("nodeart-layout-right", layout)
              }
            >
              <ResizablePanel id="preview" defaultSize="52%" minSize="22%">
                <section className="preview-panel flex h-full min-h-0 flex-col rounded-xl p-4">
                  <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                    <h2>Preview</h2>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label="Enter fullscreen preview"
                      data-cuelume-tap="open"
                      disabled={!document.fullscreenEnabled}
                      onClick={() => void toggleFullscreen()}
                    >
                      <Maximize />
                    </Button>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 pb-3">
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label={playing ? "Pause preview" : "Play preview"}
                      disabled={recording}
                      data-cuelume-tap="toggle"
                      onClick={() => setPlaying((v) => !v)}
                    >
                      {playing ? <Pause /> : <Play />}
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label="Reset preview"
                      disabled={recording}
                      data-cuelume-tap="tap"
                      onClick={() => run(runningProject)}
                    >
                      <RotateCcw />
                    </Button>
                    <span className="mr-auto font-mono text-xs">
                      {time.toFixed(1)}s
                    </span>
                    <Select
                      value={String(resolution)}
                      disabled={recording}
                      onValueChange={(v) => v && setResolution(Number(v))}
                    >
                      <SelectTrigger aria-label="Preview quality">
                        <SelectValue>
                          {resolution === 256
                            ? "Draft"
                            : resolution === 512
                              ? "Standard"
                              : "High"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {[256, 512, 1024].map((size) => (
                          <SelectItem
                            key={size}
                            value={String(size)}
                            data-cuelume-tap="select"
                          >
                            {size === 256
                              ? "Draft"
                              : size === 512
                                ? "Standard"
                                : "High"}{" "}
                            · {size} × {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
                    <div
                      ref={previewFrameRef}
                      className="preview-frame relative aspect-square max-h-full max-w-full overflow-hidden rounded-lg"
                    >
                      {fullscreen && (
                        <div className="absolute top-4 right-4 z-10">
                          <Button
                            variant="secondary"
                            data-cuelume-tap="close"
                            onClick={() => void toggleFullscreen()}
                          >
                            <Minimize />
                            Exit fullscreen
                          </Button>
                        </div>
                      )}
                      <PassPreview
                        request={request}
                        playing={playing}
                        resolution={resolution}
                        canvasRef={canvasRef}
                        onStatus={onStatus}
                        onTime={onTime}
                        onApplied={onApplied}
                        onRuntimeError={onRuntimeError}
                      />
                    </div>
                  </div>
                </section>
              </ResizablePanel>
              <ResizableHandle
                withHandle
                aria-label="Resize preview and node graph"
              />
              <ResizablePanel id="graph" defaultSize="48%" minSize="22%">
                <section className="library-panel flex h-full min-h-0 flex-col rounded-xl p-3">
                  <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                    <h2>Nodes</h2>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="secondary"
                            size="sm"
                            data-cuelume-tap="open"
                          />
                        }
                      >
                        <Plus /> Add node
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="max-h-[75dvh] overflow-y-auto"
                      >
                        {(Object.keys(labels) as PassKind[]).map((kind) => (
                          <DropdownMenuItem
                            key={kind}
                            data-cuelume-tap="select"
                            onClick={() => add(kind)}
                          >
                            <CategoryIcon name={category[kind]} />
                            {labels[kind]}
                          </DropdownMenuItem>
                        ))}
                        {["Generators", "Texture effects", "Compositing"].map(
                          (group) => (
                            <DropdownMenuSub key={group}>
                              <DropdownMenuSubTrigger>
                                {group}
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="max-h-[75dvh] overflow-y-auto">
                                {passPresets
                                  .filter((p) => p.group === group)
                                  .map((preset) => (
                                    <DropdownMenuItem
                                      key={preset.id}
                                      data-cuelume-tap="select"
                                      onClick={() =>
                                        add(preset.kind, preset.id)
                                      }
                                    >
                                      <CategoryIcon
                                        name={category[preset.kind]}
                                      />
                                      {preset.label}
                                    </DropdownMenuItem>
                                  ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          )
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="graph-workspace min-h-0 flex-1">
                    <ReactFlow
                      key={project.id}
                      nodes={graphNodes}
                      edges={project.edges}
                      nodeTypes={nodeTypes}
                      fitView
                      minZoom={0.25}
                      maxZoom={1.5}
                      onNodeClick={(_e, node) => setSelectedId(node.id)}
                      onNodesChange={(changes) => {
                        const edits = changes.filter((c) => c.type !== "select")
                        if (edits.length) {
                          const nodes = applyNodeChanges(edits, project.nodes)
                          if (
                            edits.every((edit) => edit.type === "dimensions")
                          ) {
                            setProject((current) => ({ ...current, nodes }))
                            return
                          }
                          const ids = new Set(nodes.map((n) => n.id))
                          change({
                            ...project,
                            nodes,
                            edges: project.edges.filter(
                              (e) => ids.has(e.source) && ids.has(e.target)
                            ),
                            output: ids.has(project.output)
                              ? project.output
                              : (nodes[0]?.id ?? ""),
                          })
                        }
                      }}
                      onEdgesChange={(changes) => {
                        const edits = changes.filter((c) => c.type !== "select")
                        if (edits.length)
                          change({
                            ...project,
                            edges: applyEdgeChanges(edits, project.edges),
                          })
                      }}
                      onConnect={wire}
                      isValidConnection={(connection) =>
                        canWire(connection, project.nodes, project.edges)
                      }
                      onConnectEnd={(_event, state) => {
                        if (state.toNode && !state.isValid)
                          setNotice(
                            "Connect to a texture input. Feedback must go through Previous frame."
                          )
                      }}
                      deleteKeyCode={null}
                      defaultEdgeOptions={{ type: "smoothstep" }}
                    >
                      <Background gap={20} size={1} />
                      <Controls showInteractive={false} />
                    </ReactFlow>
                  </div>
                </section>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <Dialog
        open={!!portDialog}
        onOpenChange={(open) => {
          if (!open) setPortDialog(null)
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogTitle>
            {portDialog?.mode === "remove"
              ? "Remove texture input"
              : portDialog?.mode === "rename"
                ? "Edit texture input"
                : "Add texture input"}
          </DialogTitle>
          <DialogDescription>
            Inputs keep a stable identity. Their order and labels do not change
            connections.
          </DialogDescription>
          {portDialog?.mode === "remove" ? (
            <>
              <p>
                The connection to <b>{portDialog.input?.label}</b> will be
                removed. Code references remain visible for you to update.
              </p>
              <pre className="max-h-40 overflow-auto text-xs whitespace-pre-wrap">
                {selected?.data.code
                  .split("\n")
                  .filter((line) => line.includes(portDialog.input?.name ?? ""))
                  .join("\n") || "No code references found."}
              </pre>
            </>
          ) : (
            <>
              <label className="grid gap-2">
                Label
                <Input
                  value={portLabel}
                  data-cuelume-type=""
                  onChange={(e) => setPortLabel(e.target.value)}
                />
              </label>
              <label className="grid gap-2">
                Code identifier
                <Input
                  value={portName}
                  className="font-mono"
                  data-cuelume-type=""
                  onChange={(e) => setPortName(e.target.value)}
                />
              </label>
              {portDialog?.mode === "rename" && (
                <>
                  <p className="text-xs">
                    Review updated code. Direct identifier references and
                    inputs.name / inputs["name"] accesses are updated; aliased
                    or dynamic accesses need manual review. Undo restores the
                    whole edit.
                  </p>
                  <pre className="max-h-48 overflow-auto font-mono text-xs whitespace-pre-wrap">
                    {renamedCode}
                  </pre>
                </>
              )}
            </>
          )}
          {portError && <p role="alert">{portError}</p>}
          <Button
            variant={portDialog?.mode === "remove" ? "destructive" : "primary"}
            data-cuelume-tap="tap"
            onClick={applyPort}
          >
            {portDialog?.mode === "remove" ? "Remove input" : "Apply"}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteNode} onOpenChange={setDeleteNode}>
        <DialogContent>
          <DialogTitle>Delete {selected?.data.label}?</DialogTitle>
          <DialogDescription>
            This removes the pass and its connections. You can undo this edit.
          </DialogDescription>
          <Button
            variant="destructive"
            data-cuelume-tap="tap"
            onClick={() => {
              if (selected) {
                const nodes = project.nodes.filter((n) => n.id !== selected.id)
                change({
                  ...project,
                  nodes,
                  edges: project.edges.filter(
                    (e) => e.source !== selected.id && e.target !== selected.id
                  ),
                  output:
                    project.output === selected.id
                      ? (nodes[0]?.id ?? "")
                      : project.output,
                })
                setSelectedId(nodes[0]?.id ?? "")
              }
              setDeleteNode(false)
            }}
          >
            <Trash2 />
            Delete pass
          </Button>
        </DialogContent>
      </Dialog>
      <VideoExport
        open={videoOpen}
        onOpenChange={setVideoOpen}
        canvasRef={canvasRef}
        name={runningProject.name}
        playing={playing}
        ready={initialized && hasRendered && status !== "Compiling…"}
        onPlaying={setPlaying}
        onRecording={onRecording}
      />
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-3xl">
          <DialogTitle>Projects</DialogTitle>
          <DialogDescription>
            Pass projects are saved locally. Earlier Nodeart graphs remain in
            their original storage.
          </DialogDescription>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Input
              className="min-w-36 flex-1"
              aria-label="Search projects"
              placeholder="Search projects"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              variant="secondary"
              data-cuelume-tap="tap"
              onClick={() => activate(starterProject())}
            >
              <Plus />
              New
            </Button>
            <Button
              variant="secondary"
              data-cuelume-tap="open"
              onClick={() => jsonRef.current?.click()}
            >
              <Upload />
              Import JSON
            </Button>
          </div>
          <div className="library-scroll grid min-h-0 auto-rows-max grid-cols-1 gap-3 overflow-auto rounded-lg p-3 sm:grid-cols-2 md:grid-cols-3">
            {projects
              .filter((p) =>
                p.name.toLowerCase().includes(search.toLowerCase())
              )
              .map((p) => (
                <button
                  className="library-item flex w-full flex-col items-start gap-2 self-start rounded-lg p-3 text-left"
                  key={p.id}
                  aria-label={`Open ${p.name}`}
                  data-cuelume-tap="select"
                  onClick={() => activate(p)}
                >
                  {previews[p.id] ? (
                    <img
                      src={previews[p.id]}
                      alt={`Last rendered preview of ${p.name}`}
                      className="aspect-square w-full rounded-md object-cover"
                    />
                  ) : (
                    <div className="project-placeholder flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-md">
                      <FolderOpen className="size-8" />
                      <span className="text-xs">Run to create a preview</span>
                    </div>
                  )}
                  <span className="w-full truncate text-sm font-semibold">
                    {p.name}
                  </span>
                  <span className="text-xs">
                    {p.id === project.id ? "Current · " : ""}
                    {p.nodes.length} nodes
                  </span>
                </button>
              ))}
            {!projects.some((p) =>
              p.name.toLowerCase().includes(search.toLowerCase())
            ) && (
              <p className="col-span-full py-6 text-center text-sm">
                No projects match your search.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-h-[85dvh] overflow-auto sm:max-w-lg">
          <DialogTitle>Every node is a pass</DialogTitle>
          <DialogDescription>
            Write code, connect textures, and build feedback loops.
          </DialogDescription>
          <p>
            Select a node to edit it. Add nodes and reusable passes from the
            Nodes header. Add named texture inputs below the code, then drag an
            output socket to an input socket.
          </p>
          <p>
            GLSL uniforms are generated in Pass API. p5.js uses setup(p) and
            draw(p, inputs, time, frame); Nodeart owns the canvas and animation
            loop. Use Previous frame between passes to create feedback,
            including a pass feeding itself.
          </p>
          <p>
            Run applies the entire draft and resets history. Invalid drafts
            leave the last valid graph running. Reset restarts the running
            graph; pause freezes its history. Drag or focus and use arrow keys
            on dividers to resize panes.
          </p>
          <p>
            AI models load only on demand from AI completion. Code inference
            happens locally. Imported p5.js is JavaScript executing in this
            page; review imported code before Run.
          </p>
        </DialogContent>
      </Dialog>
    </main>
  )
}
