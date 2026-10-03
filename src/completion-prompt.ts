type Tokenizer = {
  encode: (text: string, options: { add_special_tokens: boolean }) => number[]
  decode: (
    tokens: number[],
    options: { skip_special_tokens: boolean }
  ) => string
}

// Trim each part separately so truncation never removes the FIM delimiters or
// the code immediately surrounding the insertion point.
export function completionPrompt(
  tokenizer: Tokenizer,
  prefix: string,
  suffix: string,
  api: string,
  language: string,
  cpu: boolean
) {
  const trim = (text: string, budget: number, keepEnd = false) => {
    const tokens = tokenizer.encode(text, { add_special_tokens: false })
    if (tokens.length <= budget) return text
    return tokenizer.decode(
      keepEnd ? tokens.slice(-budget) : tokens.slice(0, budget),
      {
        skip_special_tokens: false,
      }
    )
  }
  const context =
    language === "GLSL"
      ? api
      : api
          .split("\n")
          .map((line) => `// ${line}`)
          .join("\n")
  return `<|fim_prefix|>// ${language}\n${trim(context, cpu ? 96 : 256)}\n${trim(prefix, cpu ? 256 : 1024, true)}<|fim_suffix|>${trim(suffix, cpu ? 64 : 256)}<|fim_middle|>`
}
