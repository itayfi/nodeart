// GLSL ES 1.00 built-ins supported by the WebGL renderer.
export const glslFunctions = [
  ["radians", "genType degrees", "Convert degrees to radians."],
  ["degrees", "genType radians", "Convert radians to degrees."],
  ["sin", "genType angle", "Sine of an angle in radians."],
  ["cos", "genType angle", "Cosine of an angle in radians."],
  ["tan", "genType angle", "Tangent of an angle in radians."],
  ["asin", "genType x", "Inverse sine; x must be in [-1, 1]."],
  ["acos", "genType x", "Inverse cosine; x must be in [-1, 1]."],
  [
    "atan",
    "genType y, genType x",
    "Inverse tangent. Also accepts one argument.",
  ],
  ["pow", "genType x, genType y", "Raise x to the power y."],
  ["exp", "genType x", "Natural exponential."],
  ["log", "genType x", "Natural logarithm."],
  ["exp2", "genType x", "Base-two exponential."],
  ["log2", "genType x", "Base-two logarithm."],
  ["sqrt", "genType x", "Square root."],
  ["inversesqrt", "genType x", "Inverse square root."],
  ["abs", "genType x", "Absolute value."],
  ["sign", "genType x", "Returns -1, 0, or 1."],
  ["floor", "genType x", "Round down."],
  ["ceil", "genType x", "Round up."],
  ["fract", "genType x", "Fractional part: x - floor(x)."],
  ["mod", "genType x, genType y", "Modulo: x - y * floor(x / y)."],
  ["min", "genType x, genType y", "Component-wise minimum."],
  ["max", "genType x, genType y", "Component-wise maximum."],
  [
    "clamp",
    "genType x, genType minVal, genType maxVal",
    "Limit x to the given range.",
  ],
  [
    "mix",
    "genType x, genType y, genType a",
    "Linear interpolation between x and y.",
  ],
  ["step", "genType edge, genType x", "Zero below edge; one otherwise."],
  [
    "smoothstep",
    "genType edge0, genType edge1, genType x",
    "Smooth interpolation between two edges.",
  ],
  ["length", "genType x", "Vector length (returns float)."],
  [
    "distance",
    "genType p0, genType p1",
    "Distance between two points (returns float).",
  ],
  ["dot", "genType x, genType y", "Dot product (returns float)."],
  ["cross", "vec3 x, vec3 y", "Cross product (returns vec3)."],
  ["normalize", "genType x", "Unit-length vector."],
  [
    "faceforward",
    "genType N, genType I, genType Nref",
    "Orient N against the reference direction.",
  ],
  [
    "reflect",
    "genType I, genType N",
    "Reflection of incident I around normalized N.",
  ],
  [
    "refract",
    "genType I, genType N, float eta",
    "Refraction using the index ratio eta.",
  ],
  [
    "matrixCompMult",
    "matType x, matType y",
    "Component-wise matrix multiplication.",
  ],
  [
    "lessThan",
    "vecType x, vecType y",
    "Component-wise comparison (returns bvec).",
  ],
  [
    "lessThanEqual",
    "vecType x, vecType y",
    "Component-wise comparison (returns bvec).",
  ],
  [
    "greaterThan",
    "vecType x, vecType y",
    "Component-wise comparison (returns bvec).",
  ],
  [
    "greaterThanEqual",
    "vecType x, vecType y",
    "Component-wise comparison (returns bvec).",
  ],
  ["equal", "vecType x, vecType y", "Component-wise equality (returns bvec)."],
  [
    "notEqual",
    "vecType x, vecType y",
    "Component-wise inequality (returns bvec).",
  ],
  ["any", "bvecType x", "True if any component is true."],
  ["all", "bvecType x", "True if every component is true."],
  ["not", "bvecType x", "Component-wise boolean negation."],
  [
    "texture2D",
    "sampler2D sampler, vec2 coord",
    "Sample an input texture at normalized coordinates (returns vec4).",
  ],
  [
    "texture2DProj",
    "sampler2D sampler, vec3 coord",
    "Sample using projected coordinates (also accepts vec4).",
  ],
  [
    "textureCube",
    "samplerCube sampler, vec3 coord",
    "Sample a cube-map texture (returns vec4).",
  ],
] as const

// Retain offsets and line numbers while excluding comments and strings.
export function codeOnly(code: string) {
  return code.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g,
    (text) => text.replace(/[^\n]/g, " ")
  )
}
export type VectorColor = {
  start: number
  end: number
  size: 3 | 4
  rgba: number[]
}
export function vectorColors(code: string): VectorColor[] {
  const result: VectorColor[] = []
  const number = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i
  for (const match of codeOnly(code).matchAll(/\bvec([34])\s*\(([^()]*)\)/g)) {
    const args = match[2].split(",").map((v) => v.trim())
    const size = Number(match[1]) as 3 | 4
    if (
      !args.every((v) => number.test(v)) ||
      (args.length !== 1 && args.length !== size)
    )
      continue
    const values = args.map(Number)
    if (values.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) continue
    const rgba = args.length === 1 ? Array(size).fill(values[0]) : values
    if (size === 3) rgba.push(1)
    result.push({
      start: match.index,
      end: match.index + match[0].length,
      size,
      rgba,
    })
  }
  return result
}
export function vectorColorText(size: 3 | 4, rgba: number[]) {
  return `vec${size}(${rgba
    .slice(0, size)
    .map((v) => {
      const value = Math.min(1, Math.max(0, v)).toFixed(4).replace(/0+$/, "")
      return value.endsWith(".") ? `${value}0` : value
    })
    .join(", ")})`
}

// Mirror code is used only by the language service; saved/executed code stays unchanged.
export function p5Mirror(code: string, inputNames: string[]) {
  const types = [
    "import('p5')",
    `{ ${inputNames.map((name) => `${name}: import('p5').Image | null`).join("; ")} }`,
    "number",
    "number",
  ]
  const clean = codeOnly(code)
  const insertions: { offset: number; text: string }[] = []
  for (const match of clean.matchAll(
    /\bfunction\s+(setup|draw)\s*\(([^)]*)\)/g
  )) {
    const params = match[2].split(",").map((p) => p.trim())
    const docs = params
      .slice(0, match[1] === "setup" ? 1 : 4)
      .flatMap((param, i) =>
        /^[a-zA-Z_$][\w$]*$/.test(param)
          ? [`@param {${types[i]}} ${param}`]
          : []
      )
    if (docs.length)
      insertions.push({
        offset: match.index,
        text: `/** ${docs.join("\n * ")} */\n`,
      })
  }
  for (const match of clean.matchAll(
    /\b(?:const|let|var)\s+(setup|draw)\s*=\s*(?:async\s*)?\(/g
  )) {
    const args =
      match[1] === "setup"
        ? "p: import('p5')"
        : `p: import('p5'), inputs: ${types[1]}, time: number, frame: number`
    insertions.push({
      offset: match.index,
      text: `/** @type {(${args}) => void} */\n`,
    })
  }
  insertions.sort((a, b) => a.offset - b.offset)
  let text = "",
    cursor = 0
  for (const insertion of insertions) {
    text += code.slice(cursor, insertion.offset) + insertion.text
    cursor = insertion.offset
  }
  text += code.slice(cursor)
  return {
    text,
    offset: (offset: number) =>
      offset +
      insertions
        .filter((i) => i.offset <= offset)
        .reduce((sum, i) => sum + i.text.length, 0),
  }
}
