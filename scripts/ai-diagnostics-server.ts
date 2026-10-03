import { createServer } from "node:http"
import { appendFile, mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import type { Plugin } from "vite"

export function createDiagnosticsServer(directory: string) {
  let writes = Promise.resolve()
  return createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store")
    if (request.method === "GET" && request.url === "/health") {
      response.end("AI diagnostics collector ready")
      return
    }
    if (request.method !== "POST" || request.url !== "/events") {
      response.writeHead(404).end()
      return
    }
    try {
      const chunks: Buffer[] = []
      let bytes = 0
      for await (const chunk of request) {
        bytes += chunk.length
        if (bytes > 32768) {
          response.writeHead(413).end()
          return
        }
        chunks.push(chunk)
      }
      const event = JSON.parse(Buffer.concat(chunks).toString("utf8"))
      if (
        typeof event.session !== "string" ||
        !/^[a-zA-Z0-9-]{1,80}$/.test(event.session) ||
        typeof event.event !== "string" ||
        typeof event.source !== "string" ||
        !Number.isSafeInteger(event.sequence)
      ) {
        response.writeHead(400).end()
        return
      }
      const line =
        JSON.stringify({ ...event, receivedAt: new Date().toISOString() }) +
        "\n"
      const write = writes.then(async () => {
        await mkdir(directory, { recursive: true })
        await appendFile(resolve(directory, `${event.session}.jsonl`), line)
      })
      // A failed write must not poison later requests. Acknowledge only after
      // the append completes, so a received 204 means the event is on disk.
      writes = write.catch(() => {})
      await write
      response.writeHead(204).end()
    } catch (error) {
      const malformed = error instanceof SyntaxError
      response.writeHead(malformed ? 400 : 500).end()
    }
  })
}

export function aiDiagnosticsPlugin(): Plugin {
  let collector: ReturnType<typeof createDiagnosticsServer> | undefined
  return {
    name: "nodeart-ai-diagnostics",
    apply: "serve",
    async config(config) {
      collector = createDiagnosticsServer(
        resolve(config.root ?? process.cwd(), "logs/ai-diagnostics")
      )
      await new Promise<void>((resolve, reject) => {
        collector!.once("error", reject)
        collector!.listen(0, "127.0.0.1", resolve)
      })
      collector.unref()
      const address = collector.address()
      if (!address || typeof address === "string")
        throw new Error("Unable to start AI diagnostics collector")
      const prefix = `${config.base ?? "/"}__ai-diagnostics`
      return {
        server: {
          proxy: {
            [prefix]: {
              target: `http://127.0.0.1:${address.port}`,
              rewrite: (path: string) => path.slice(prefix.length),
            },
          },
        },
      }
    },
    configureServer(server) {
      server.config.logger.info(
        "[AI diagnostics] Saving reports to logs/ai-diagnostics/*.jsonl"
      )
      server.httpServer?.once("close", () => collector?.close())
    },
  }
}
