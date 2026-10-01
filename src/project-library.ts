import { parseProject, type Project } from "./project.ts"
import { preset } from "./engine.ts"
import { newNodeId } from "./graph.ts"

export type LibraryProject = Project & {
  id: string
  updatedAt: number
  thumbnail?: string
}
export type Library = {
  projects: LibraryProject[]
  activeId: string
  error?: string
}
let database: Promise<IDBDatabase> | undefined
function openDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("nodeart-library", 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore("projects", { keyPath: "id" })
      request.result.createObjectStore("settings")
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      database = undefined
      reject(request.error)
    }
    request.onblocked = () => {
      database = undefined
      reject(new Error("Close other Nodeart tabs to enable project storage."))
    }
  })
  return database
}
export function newProject(
  name = "Untitled study",
  graph: Project = { ...preset(0), name, presetIndex: 0 }
): LibraryProject {
  return { ...graph, name, id: newNodeId(), updatedAt: Date.now() }
}
export async function saveProject(project: LibraryProject) {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(["projects", "settings"], "readwrite")
    transaction.objectStore("projects").put(project)
    transaction.objectStore("settings").put(project.id, "activeId")
    transaction.oncomplete = () => resolve()
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Unable to save project."))
    transaction.onerror = () => reject(transaction.error)
  })
}
export async function deleteProject(id: string) {
  const db = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("projects", "readwrite")
    transaction.objectStore("projects").delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
  })
}
let startup: Promise<Library> | undefined
export function loadLibrary(): Promise<Library> {
  startup ??= readLibrary()
  return startup
}
async function readLibrary(): Promise<Library> {
  let projects: LibraryProject[] = [],
    activeId = ""
  let legacy: Project | undefined
  try {
    const saved = localStorage.getItem("nodeart-project")
    if (saved) legacy = parseProject(JSON.parse(saved))
  } catch {
    /* An invalid old backup must not prevent opening the editor. */
  }
  let skipped = 0
  try {
    const db = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(["projects", "settings"], "readonly")
      const all = transaction.objectStore("projects").getAll()
      const active = transaction.objectStore("settings").get("activeId")
      all.onsuccess = () => {
        projects = all.result.flatMap((p: LibraryProject) => {
          try {
            return [{ ...p, ...parseProject(p) }]
          } catch {
            skipped++
            return []
          }
        })
      }
      active.onsuccess = () => {
        activeId = active.result ?? ""
      }
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error)
      transaction.onerror = () => reject(transaction.error)
    })
    if (!projects.length) {
      const project = newProject(legacy?.name ?? "Chromatic flow", legacy)
      projects = [project]
      activeId = project.id
      await saveProject(project)
    }
    return {
      projects,
      activeId: projects.some((p) => p.id === activeId)
        ? activeId
        : projects[0].id,
      ...(skipped
        ? {
            error:
              "Some saved projects could not be read. Their stored data has been preserved.",
          }
        : {}),
    }
  } catch {
    const project =
      projects.find((p) => p.id === activeId) ??
      projects[0] ??
      newProject(legacy?.name ?? "Chromatic flow", legacy)
    return {
      projects: projects.length ? projects : [project],
      activeId: project.id,
      error:
        "Local storage is unavailable. Download a graph backup to keep your work.",
    }
  }
}
