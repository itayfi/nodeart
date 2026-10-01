import "fake-indexeddb/auto"
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  loadLibrary,
  newProject,
  saveProject,
  deleteProject,
} from "../src/project-library.ts"
import { preset } from "../src/engine.ts"

const legacy = { ...preset(1), name: "My legacy artwork", presetIndex: 1 }
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) =>
      key === "nodeart-project" ? JSON.stringify(legacy) : null,
  },
  configurable: true,
})

async function readStorage() {
  return new Promise<{ projects: unknown[]; activeId: string }>(
    (resolve, reject) => {
      const request = indexedDB.open("nodeart-library", 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result,
          tx = db.transaction(["projects", "settings"], "readonly")
        const projects = tx.objectStore("projects").getAll(),
          active = tx.objectStore("settings").get("activeId")
        tx.oncomplete = () => {
          resolve({ projects: projects.result, activeId: active.result })
          db.close()
        }
        tx.onerror = () => reject(tx.error)
      }
    }
  )
}

test("legacy migration runs once under concurrent startup and preserves the existing artwork", async () => {
  const [first, second] = await Promise.all([loadLibrary(), loadLibrary()])
  assert.deepEqual(first, second)
  assert.equal(first.projects.length, 1)
  assert.equal(first.projects[0].name, legacy.name)
  assert.deepEqual(first.projects[0].nodes, legacy.nodes)
  assert.equal((await readStorage()).projects.length, 1)
})

test("autosaving one project preserves others, stores image assets, and updates active recovery", async () => {
  const initial = await loadLibrary(),
    first = initial.projects[0]
  const second = newProject("Image project")
  second.nodes[0].data.image = {
    src: "data:image/png;base64,aGVsbG8=",
    name: "image.png",
    width: 1,
    height: 1,
  }
  await saveProject(second)
  const updated = {
    ...second,
    name: "Renamed project",
    updatedAt: Date.now() + 1,
  }
  await saveProject(updated)
  const result = await readStorage()
  assert.equal(result.projects.length, 2)
  assert.equal(result.activeId, second.id)
  assert.deepEqual(
    result.projects.find((p) => (p as { id: string }).id === first.id),
    first
  )
  assert.deepEqual(
    result.projects.find((p) => (p as { id: string }).id === second.id),
    updated
  )
  await deleteProject(second.id)
  const remaining = await readStorage()
  assert.equal(remaining.projects.length, 1)
  assert.deepEqual(remaining.projects[0], first)
})
