import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createDiagnosticsServer } from "../scripts/ai-diagnostics-server.ts"

test("collector persists events before acknowledgment and rejects unsafe session paths and oversized reports", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "nodeart-diagnostics-"))
  const server = createDiagnosticsServer(directory)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(directory, { recursive: true, force: true })
  })
  const address = server.address()
  assert.ok(address && typeof address !== "string")
  const endpoint = `http://127.0.0.1:${address.port}/events`
  const event = {
    session: "pixel-test",
    source: "worker",
    sequence: 1,
    event: "stage",
    data: { detail: "Preparing model session" },
  }
  const saved = await fetch(endpoint, {
    method: "POST",
    body: JSON.stringify(event),
  })
  assert.equal(saved.status, 204)
  const log = JSON.parse(
    (await readFile(join(directory, "pixel-test.jsonl"), "utf8")).trim()
  )
  assert.equal(log.data.detail, event.data.detail)
  assert.ok(log.receivedAt)
  const invalid = await fetch(endpoint, {
    method: "POST",
    body: JSON.stringify({ ...event, session: "../escape" }),
  })
  assert.equal(invalid.status, 400)
  const oversized = await fetch(endpoint, {
    method: "POST",
    body: "x".repeat(32769),
  })
  assert.equal(oversized.status, 413)
  assert.deepEqual(await readdir(directory), ["pixel-test.jsonl"])
})
