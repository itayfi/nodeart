import "fake-indexeddb/auto"
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  readPassLibrary,
  savePassProject,
  readPassPreviews,
  savePassPreview,
} from "../src/pass-library.ts"
import { exampleProject } from "../src/passes.ts"

test("concurrent startup creates one project; saving preserves independent projects and active recovery", async () => {
  const [a, b] = await Promise.all([readPassLibrary(), readPassLibrary()])
  assert.equal(a.active.id, b.active.id)
  const p = exampleProject("mixed")
  await savePassProject(p)
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("nodeart-passes", 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const snapshot = await new Promise<{ projects: unknown[]; active: string }>(
    (resolve, reject) => {
      const tx = database.transaction(["projects", "settings"], "readonly"),
        all = tx.objectStore("projects").getAll(),
        active = tx.objectStore("settings").get("active")
      tx.oncomplete = () =>
        resolve({ projects: all.result, active: active.result })
      tx.onerror = () => reject(tx.error)
    }
  )
  assert.equal(snapshot.projects.length, 2)
  assert.equal(snapshot.active, p.id)
  database.close()
})
test("preview metadata persists independently without changing the active project or project JSON", async () => {
  const project = exampleProject("blend")
  await savePassProject(project)
  const image = "data:image/jpeg;base64,AQID"
  await savePassPreview("other-project", image)
  assert.equal((await readPassPreviews())["other-project"], image)
  const request = indexedDB.open("nodeart-passes", 1)
  const db = await new Promise<IDBDatabase>((resolve) => {
    request.onsuccess = () => resolve(request.result)
  })
  const tx = db.transaction(["projects", "settings"], "readonly")
  const active = tx.objectStore("settings").get("active"),
    stored = tx.objectStore("projects").get(project.id)
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  assert.equal(active.result, project.id)
  assert.deepEqual(stored.result, project)
  db.close()
})
