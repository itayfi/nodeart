// Keep the insertion separate from text the model repeats from the suffix.
export function cleanCompletion(raw: string, suffix: string) {
  let text = raw
    .replace(/^\s*```[\w]*\n?/, "")
    .split("```")[0]
    .split(/<\|[^>]+\|>/)[0]
  const close = suffix.trimStart()[0],
    open: Record<string, string> = { "}": "{", ")": "(", "]": "[" }
  if (open[close]) {
    let depth = 0
    const tokens =
      /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[{}()[\]]/g
    for (const match of text.matchAll(tokens)) {
      if (match[0] === open[close]) depth++
      else if (match[0] === close) {
        if (depth === 0) {
          text = text.slice(0, match.index)
          break
        }
        depth--
      }
    }
  }
  return text.trimEnd()
}
