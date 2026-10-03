import { parsePassProject, starterProject, type PassProject } from "./passes.ts"

let database: Promise<IDBDatabase> | undefined
function open() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("nodeart-passes", 1)
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
      reject(new Error("Close other Nodeart tabs to enable storage."))
    }
  })
  return database
}
export async function savePassProject(project: PassProject) {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["projects", "settings"], "readwrite")
    tx.objectStore("projects").put(project)
    tx.objectStore("settings").put(project.id, "active")
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error)
    tx.onerror = () => reject(tx.error)
  })
}
let startup: ReturnType<typeof readLibrary> | undefined
// Preview metadata is separate from executable projects and portable JSON.
export async function savePassPreview(id: string, thumbnail: string) {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("settings", "readwrite")
    tx.objectStore("settings").put(thumbnail, `preview:${id}`)
    tx.oncomplete = () => resolve()
    tx.onabort = tx.onerror = () => reject(tx.error)
  })
}
export async function readPassPreviews(): Promise<Record<string, string>> {
  try {
    const db = await open()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("settings", "readonly"),
        store = tx.objectStore("settings")
      const keys = store.getAllKeys(),
        values = store.getAll()
      tx.oncomplete = () =>
        resolve(
          Object.fromEntries(
            keys.result.flatMap((key, i) => {
              const value = values.result[i]
              return typeof key === "string" &&
                key.startsWith("preview:") &&
                typeof value === "string" &&
                value.startsWith("data:image/jpeg;base64,") &&
                value.length < 250_000
                ? [[key.slice(8), value]]
                : []
            })
          )
        )
      tx.onabort = tx.onerror = () => reject(tx.error)
    })
  } catch {
    return {}
  }
}
export function readPassLibrary() {
  return (startup ??= readLibrary())
}
async function readLibrary(): Promise<{
  projects: PassProject[]
  active: PassProject
  error?: string
}> {
  try {
    const db = await open()
    const { values, activeId } = await new Promise<{
      values: unknown[]
      activeId: string
    }>((resolve, reject) => {
      const tx = db.transaction(["projects", "settings"], "readonly"),
        all = tx.objectStore("projects").getAll(),
        active = tx.objectStore("settings").get("active")
      tx.oncomplete = () =>
        resolve({ values: all.result, activeId: active.result })
      tx.onabort = () => reject(tx.error)
      tx.onerror = () => reject(tx.error)
    })
    const projects: PassProject[] = []
    for (const value of values) {
      try {
        projects.push(parsePassProject(value))
      } catch {
        /* Preserve unreadable data in storage. */
      }
    }
    if (!projects.length) {
      const p = starterProject()
      await savePassProject(p)
      projects.push(p)
    }
    return {
      projects,
      active: projects.find((p) => p.id === activeId) ?? projects[0],
      ...(projects.length < values.length
        ? {
            error:
              "Some projects could not be read. Their stored data is preserved.",
          }
        : {}),
    }
  } catch {
    const p = starterProject()
    return {
      projects: [p],
      active: p,
      error: "Local storage is unavailable. Download JSON to keep your work.",
    }
  }
}
