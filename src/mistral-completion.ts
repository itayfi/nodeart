import { cleanCompletion } from "./completion-text.ts"

export async function mistralCompletion(
  key: string,
  prefix: string,
  suffix: string,
  api: string,
  language: string,
  signal: AbortSignal
) {
  const context =
    language === "GLSL"
      ? api
      : api
          .split("\n")
          .map((line) => `// ${line}`)
          .join("\n")
  let response: Response
  try {
    response = await fetch("https://api.mistral.ai/v1/fim/completions", {
      method: "POST",
      credentials: "omit",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "codestral-latest",
        prompt: `// ${language}\n${context.slice(0, 8000)}\n${prefix.slice(-6000)}`,
        suffix: suffix.slice(0, 1500),
        max_tokens: 64,
        temperature: 0,
        stream: false,
      }),
      signal,
    })
  } catch {
    if (signal.aborted)
      throw new Error("Mistral completion was cancelled or timed out.")
    throw new Error(
      "Cannot reach Mistral. Check your connection and browser access (CORS)."
    )
  }
  if (!response.ok) {
    // Never include an upstream body in diagnostics: it can echo request data.
    const detail =
      response.status === 401
        ? "API key was rejected."
        : response.status === 403
          ? "Your API key does not have access to Codestral."
          : response.status === 402
            ? "Check your Mistral billing and credits."
            : response.status === 429
              ? "Rate limit reached. Wait before trying again."
              : "The request failed. Try again later."
    throw new Error(`Mistral (${response.status}): ${detail}`)
  }
  let result
  try {
    result = await response.json()
  } catch {
    throw new Error("Mistral returned an unreadable completion response.")
  }
  const content = result.choices?.[0]?.message?.content
  if (typeof content !== "string")
    throw new Error("Mistral returned an unexpected completion format.")
  return cleanCompletion(content, suffix)
}
