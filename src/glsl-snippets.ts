export const glslSnippets = [
  {
    id: "hash",
    label: "2D hash",
    category: "Noise",
    description: "Repeatable random value from a 2D coordinate.",
    usage: "float grain = na_hash21(vUv * uResolution);",
    code: `float na_hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}`,
  },
  {
    id: "noise",
    label: "Value noise",
    category: "Noise",
    description: "Smooth noise for displacement, clouds and organic motion.",
    dependencies: ["hash"],
    usage: "float n = na_noise2(vUv * 8.0 + uTime * 0.2);",
    code: `float na_noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(na_hash21(i), na_hash21(i + vec2(1.0, 0.0)), u.x),
             mix(na_hash21(i + vec2(0.0, 1.0)), na_hash21(i + vec2(1.0)), u.x), u.y);
}`,
  },
  {
    id: "fbm",
    label: "Fractal noise",
    category: "Noise",
    description: "Five octaves of noise, ready for domain warping.",
    dependencies: ["noise"],
    usage: "float clouds = na_fbm(vUv * 6.0 + uTime * 0.1);",
    code: `float na_fbm(vec2 p) {
  float value = 0.0, amplitude = 0.5;
  mat2 rotation = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    value += amplitude * na_noise2(p);
    p = rotation * p * 2.0 + vec2(17.0, 9.0);
    amplitude *= 0.5;
  }
  return value;
}`,
  },
  {
    id: "circle",
    label: "Circle distance",
    category: "Shapes",
    description: "Signed distance: negative inside the circle.",
    usage:
      "float mask = 1.0 - smoothstep(0.0, 0.005, na_circle(vUv - 0.5, 0.3));",
    code: `float na_circle(vec2 p, float radius) {
  return length(p) - radius;
}`,
  },
  {
    id: "box",
    label: "Rounded box distance",
    category: "Shapes",
    description: "A box with adjustable half-size and corner radius.",
    usage: "float d = na_roundBox(vUv - 0.5, vec2(0.3, 0.2), 0.05);",
    code: `float na_roundBox(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}`,
  },
  {
    id: "segment",
    label: "Line segment distance",
    category: "Shapes",
    description: "Distance to a segment, including degenerate endpoints.",
    usage: "float d = na_segment(vUv, vec2(0.2), vec2(0.8));",
    code: `float na_segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.000001), 0.0, 1.0);
  return length(pa - ba * h);
}`,
  },
  {
    id: "smooth-min",
    label: "Smooth union",
    category: "Shapes",
    description: "Blend two distance fields into soft metaballs.",
    usage: "float d = na_smoothMin(distanceA, distanceB, 0.15);",
    code: `float na_smoothMin(float a, float b, float k) {
  k = max(k, 0.000001);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}`,
  },
  {
    id: "rotate",
    label: "2D rotation",
    category: "Transforms",
    description:
      "Rotate UVs or a distance field around its origin, in radians.",
    usage: "vec2 uv = na_rotate2(uTime * 0.2) * (vUv - 0.5) + 0.5;",
    code: `mat2 na_rotate2(float angle) {
  float c = cos(angle), s = sin(angle);
  return mat2(c, s, -s, c);
}`,
  },
  {
    id: "palette",
    label: "Cosine palette",
    category: "Color",
    description: "Smooth color bands controlled by four color vectors.",
    usage:
      "vec3 color = na_palette(vUv.x, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));",
    code: `vec3 na_palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.2831853 * (c * t + d));
}`,
  },
  {
    id: "hsv",
    label: "HSV to RGB",
    category: "Color",
    description:
      "Animate hue in the 0–1 range; saturation and value also use 0–1.",
    usage: "vec3 color = na_hsvToRgb(vec3(fract(uTime * 0.1), 0.8, 1.0));",
    code: `vec3 na_hsvToRgb(vec3 hsv) {
  vec3 rgb = clamp(abs(fract(hsv.x + vec3(0.0, 0.6666667, 0.3333333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  return hsv.z * mix(vec3(1.0), rgb, hsv.y);
}`,
  },
  {
    id: "luminance",
    label: "Luminance",
    category: "Color",
    description: "Perceived brightness for masks and threshold effects.",
    usage: "float brightness = na_luminance(texture2D(source, vUv).rgb);",
    code: `float na_luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}`,
  },
  {
    id: "screen",
    label: "Screen blend",
    category: "Blending",
    description: "Lighten two textures, useful for glows and light trails.",
    usage:
      "vec3 color = na_screen(texture2D(source, vUv).rgb, texture2D(glow, vUv).rgb);",
    code: `vec3 na_screen(vec3 base, vec3 layer) {
  return 1.0 - (1.0 - base) * (1.0 - layer);
}`,
  },
  {
    id: "overlay",
    label: "Overlay blend",
    category: "Blending",
    description:
      "Combine texture detail while preserving light and dark regions.",
    usage:
      "vec3 color = na_overlay(texture2D(source, vUv).rgb, texture2D(detail, vUv).rgb);",
    code: `vec3 na_overlay(vec3 base, vec3 layer) {
  return mix(2.0 * base * layer, 1.0 - 2.0 * (1.0 - base) * (1.0 - layer), step(vec3(0.5), base));
}`,
  },
] satisfies {
  id: string
  label: string
  category: string
  description: string
  usage: string
  code: string
  dependencies?: string[]
}[]

function codeOnly(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (comment) =>
    comment.replace(/[^\n]/g, " ")
  )
}
export function insertGLSLSnippet(source: string, id: string) {
  const ordered: typeof glslSnippets = [],
    seen = new Set<string>()
  function visit(key: string) {
    if (seen.has(key)) return
    const snippet = glslSnippets.find((s) => s.id === key)
    if (!snippet) throw new Error(`Unknown snippet: ${key}`)
    seen.add(key)
    snippet.dependencies?.forEach(visit)
    ordered.push(snippet)
  }
  visit(id)
  const clean = codeOnly(source),
    added: string[] = [],
    blocks: string[] = [],
    declarations: string[] = []
  for (const snippet of ordered) {
    const name = snippet.code.match(/\b(na_\w+)\s*\(/)![1]
    const match = new RegExp(
      `\\b(?:void|bool|int|uint|float|[biu]?vec[234]|mat[234])\\s+${name}\\s*\\([^)]*\\)\\s*\\{`
    ).exec(clean)
    if (match) {
      let depth = 1,
        end = match.index + match[0].length
      while (end < clean.length && depth) {
        if (clean[end] === "{") depth++
        if (clean[end] === "}") depth--
        end++
      }
      const existing = clean.slice(match.index, end).replace(/\s/g, "")
      if (existing !== codeOnly(snippet.code).replace(/\s/g, ""))
        throw new Error(
          `${name} already exists with different code. Rename your function or use the existing version before inserting this snippet.`
        )
      // New helpers are prepended, so existing dependencies need forward declarations.
      declarations.push(
        snippet.code.slice(0, snippet.code.indexOf("{")).trim() + ";"
      )
    } else {
      added.push(snippet.label)
      blocks.push(snippet.code)
    }
  }
  // Keep a leading GLSL version directive in its required first position.
  const directive = source.match(/^\s*#version[^\n]*\n/)?.[0] ?? ""
  // GLSL ES forbids duplicate prototypes. Move previously inserted declarations
  // to the new prefix rather than adding another copy further up the file.
  if (blocks.length) {
    const removals: { start: number; end: number }[] = []
    for (const declaration of declarations) {
      const pattern = declaration
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\s+/g, "\\s+")
      for (const match of clean.matchAll(new RegExp(pattern, "g")))
        removals.push({
          start: match.index,
          end: match.index + match[0].length,
        })
    }
    for (const range of removals.sort((a, b) => b.start - a.start))
      source = source.slice(0, range.start) + source.slice(range.end)
  }
  const prefix = blocks.length
    ? [...declarations, ...blocks].join("\n\n") + "\n\n"
    : ""
  return { code: directive + prefix + source.slice(directive.length), added }
}
