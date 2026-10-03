// Cache the network stream before Transformers.js reads the full model buffer.
// Its usual cache write constructs a Response from that buffer, copying it.
export async function primeModelCache(
  cache: Pick<Cache, "match" | "put">,
  url: string,
  expectedBytes: number,
  progress: (loaded: number, total: number) => void,
  fetchModel: typeof fetch = fetch
) {
  const cached = await cache.match(url)
  if (cached) {
    await cached.body?.cancel()
    return
  }
  const response = await fetchModel(url)
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    throw new Error(`Model download failed (${response.status}).`)
  }
  const total = Number(response.headers.get("content-length")) || expectedBytes
  let loaded = 0
  let lastUpdate = 0
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        loaded += chunk.byteLength
        if (Date.now() - lastUpdate >= 200) {
          progress(loaded, total)
          lastUpdate = Date.now()
        }
        controller.enqueue(chunk)
      },
    })
  )
  const headers = new Headers(response.headers)
  headers.set("content-length", String(total))
  try {
    await cache.put(url, new Response(body, { headers }))
  } catch {
    await body.cancel().catch(() => {})
    throw new Error(
      "Unable to store the model. Free browser storage and retry."
    )
  }
  progress(loaded, total)
}
