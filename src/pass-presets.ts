import {
  connect,
  makePass,
  port,
  type PassKind,
  type PassProject,
} from "./passes.ts"

type Preset = {
  id: string
  label: string
  group: string
  kind: PassKind
  inputs: string[]
  code: string
}
const noise = `float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1)), f.x), f.y);
}
float fbm(vec2 p) {
  float value = 0.0, amplitude = 0.5;
  for (int i = 0; i < 5; i++) { value += amplitude * noise(p); p = p * 2.03 + 7.1; amplitude *= 0.5; }
  return value;
}
`
function blur(axis: string) {
  return `// Separable Gaussian blur. Chain horizontal and vertical passes.
void main() {
  vec2 d = ${axis} / max(sourceResolution, vec2(1.0)) * 2.5;
  vec4 c = texture2D(source, vUv) * 0.227027;
  c += (texture2D(source, clamp(vUv + d * 1.384615, 0.0, 1.0)) + texture2D(source, clamp(vUv - d * 1.384615, 0.0, 1.0))) * 0.316216;
  c += (texture2D(source, clamp(vUv + d * 3.230769, 0.0, 1.0)) + texture2D(source, clamp(vUv - d * 3.230769, 0.0, 1.0))) * 0.070270;
  gl_FragColor = c;
}
`
}
export const passPresets: Preset[] = [
  {
    id: "ribbons",
    label: "Orbit ribbons",
    group: "Generators",
    kind: "p5",
    inputs: [],
    code: `function setup(p) { p.noFill(); }
function draw(p, inputs, time, frame) {
  p.clear(); p.strokeWeight(Math.max(1, p.width / 320));
  for (let j = 0; j < 7; j++) {
    p.stroke(100 + 140 * Math.sin(j * 0.7 + time), 180 + 70 * Math.cos(j), 255, 230);
    p.beginShape();
    for (let i = 0; i <= 150; i++) {
      const a = i / 150 * Math.PI * 2;
      const r = 0.22 + 0.035 * Math.sin(a * 3 + time + j * 0.6);
      p.vertex(p.width * (0.5 + r * Math.cos(a + time * 0.1 + j * 0.15)), p.height * (0.5 + r * Math.sin(a) * Math.cos(time * 0.3 + j * 0.3)));
    }
    p.endShape();
  }
}
`,
  },
  {
    id: "noise",
    label: "Domain-warped noise",
    group: "Generators",
    kind: "glsl",
    inputs: [],
    code:
      noise +
      `void main() {
  vec2 p = vUv * 4.0;
  vec2 warp = vec2(fbm(p + uTime * 0.09), fbm(p + 9.2 - uTime * 0.07));
  float n = fbm(p + warp * 3.0);
  gl_FragColor = vec4(n, fbm(p + warp + 17.0), 0.5 + 0.5 * sin(n * 8.0 + uTime * 0.2), 1.0);
}
`,
  },
  {
    id: "poster",
    label: "Kinetic type poster",
    group: "Generators",
    kind: "p5",
    inputs: [],
    code: `function setup(p) { p.textFont("Geist Variable"); p.textAlign(p.CENTER, p.CENTER); }
function draw(p, inputs, time, frame) {
  p.background(248, 236, 213); p.noStroke();
  p.fill(18, 45, 64); p.textStyle(p.BOLD); p.textSize(p.width * 0.18);
  p.text("MAKE", p.width / 2, p.height * 0.29);
  p.text("WAVES", p.width / 2, p.height * 0.47);
  p.fill(242, 71, 70);
  p.circle(p.width * (0.5 + 0.24 * Math.sin(time * 0.6)), p.height * 0.72, p.width * 0.24);
  p.stroke(18, 45, 64); p.strokeWeight(p.width * 0.008);
  for (let i = 0; i < 8; i++) {
    const y = p.height * (0.65 + i * 0.035);
    p.line(p.width * 0.12, y, p.width * 0.88, y + Math.sin(time + i) * p.height * 0.025);
  }
}
`,
  },
  {
    id: "blur-x",
    label: "Gaussian blur · horizontal",
    group: "Texture effects",
    kind: "glsl",
    inputs: ["source"],
    code: blur("vec2(1.0, 0.0)"),
  },
  {
    id: "blur-y",
    label: "Gaussian blur · vertical",
    group: "Texture effects",
    kind: "glsl",
    inputs: ["source"],
    code: blur("vec2(0.0, 1.0)"),
  },
  {
    id: "kaleidoscope",
    label: "Warped kaleidoscope",
    group: "Texture effects",
    kind: "glsl",
    inputs: ["source", "displacement"],
    code: `void main() {
  vec2 p = vUv - 0.5;
  float angle = atan(p.y, p.x) + uTime * 0.06;
  float sector = 6.2831853 / 8.0;
  angle = abs(mod(angle, sector) - sector * 0.5);
  vec2 uv = 0.5 + length(p) * vec2(cos(angle), sin(angle));
  vec2 warp = displacementConnected ? texture2D(displacement, clamp(uv, 0.0, 1.0)).rg - 0.5 : vec2(0.0);
  gl_FragColor = texture2D(source, clamp(uv + warp * 0.13, 0.0, 1.0));
}
`,
  },
  {
    id: "halftone",
    label: "CMY halftone",
    group: "Texture effects",
    kind: "glsl",
    inputs: ["source"],
    code: `float dotInk(vec2 uv, float angle, float ink) {
  mat2 rotate = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  vec2 cell = fract(rotate * (uv - 0.5) * 65.0) - 0.5;
  float radius = sqrt(max(ink, 0.0)) * 0.64;
  return 1.0 - smoothstep(radius - 0.035, radius + 0.035, length(cell));
}
void main() {
  vec3 c = texture2D(source, vUv).rgb;
  vec3 ink = 1.0 - c;
  vec3 dots = vec3(dotInk(vUv, 0.26, ink.r), dotInk(vUv + vec2(0.003, 0), 1.31, ink.g), dotInk(vUv, 0.78, ink.b));
  gl_FragColor = vec4((1.0 - dots * 0.9) * vec3(0.98, 0.94, 0.86), 1.0);
}
`,
  },
  {
    id: "chromatic",
    label: "Chromatic lens",
    group: "Texture effects",
    kind: "glsl",
    inputs: ["source"],
    code: `void main() {
  vec2 p = vUv - 0.5, d = p * dot(p, p) * 0.04;
  vec3 c = vec3(texture2D(source, clamp(vUv + d, 0.0, 1.0)).r, texture2D(source, vUv).g, texture2D(source, clamp(vUv - d, 0.0, 1.0)).b);
  gl_FragColor = vec4(c * (1.0 - dot(p, p) * 0.55), 1.0);
}
`,
  },
  {
    id: "palette",
    label: "Cosine palette",
    group: "Texture effects",
    kind: "glsl",
    inputs: ["source"],
    code: `vec3 palette(float t) {
  return 0.5 + 0.5 * cos(6.2831853 * (vec3(1.0) * t + vec3(0.0, 0.33, 0.67)));
}
void main() {
  float luma = dot(texture2D(source, vUv).rgb, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(palette(luma * 2.5 + uTime * 0.025), 1.0);
}
`,
  },
  {
    id: "feedback",
    label: "Spiral feedback",
    group: "Compositing",
    kind: "glsl",
    inputs: ["source", "history"],
    code: `// Connect this output to a Previous frame node, then connect it to history.
void main() {
  vec2 p = (vUv - 0.5) * 1.006;
  float a = 0.008;
  p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
  vec3 fresh = texture2D(source, vUv).rgb;
  vec3 past = uFrame == 0 ? vec3(0.0) : texture2D(history, clamp(p + 0.5, 0.0, 1.0)).rgb * 0.975;
  gl_FragColor = vec4(max(fresh, past), 1.0);
}
`,
  },
  {
    id: "bloom",
    label: "Screen bloom",
    group: "Compositing",
    kind: "glsl",
    inputs: ["source", "glow"],
    code: `void main() {
  vec3 sharp = texture2D(source, vUv).rgb;
  vec3 bloom = texture2D(glow, vUv).rgb * 1.6;
  vec3 c = 1.0 - (1.0 - sharp) * (1.0 - clamp(bloom, 0.0, 1.0));
  gl_FragColor = vec4(c, 1.0);
}
`,
  },
]
export function presetPass(id: string) {
  const preset = passPresets.find((p) => p.id === id)
  if (!preset) throw new Error(`Unknown pass preset: ${id}`)
  const node = makePass(preset.kind)
  node.data = {
    kind: preset.kind,
    label: preset.label,
    code: preset.code,
    inputs: preset.inputs.map((name) => port(name)),
  }
  return node
}
export const creativeExamples = [
  {
    id: "loom",
    label: "Photon loom",
    description: "p5 ribbons → spiral feedback → two-pass blur → screen bloom",
  },
  {
    id: "prism",
    label: "Prismatic tide",
    description:
      "Noise feeds both palette and displacement → kaleidoscope → lens",
  },
  {
    id: "print",
    label: "Make waves · risograph",
    description: "p5 kinetic type → CMY halftone → chromatic lens",
  },
] as const
export function creativeProject(id: string): PassProject {
  const example = creativeExamples.find((e) => e.id === id)
  if (!example) throw new Error(`Unknown example: ${id}`)
  const nodes = (
    id === "loom"
      ? ["ribbons", "feedback", "blur-x", "blur-y", "bloom"]
      : id === "prism"
        ? ["noise", "palette", "kaleidoscope", "chromatic"]
        : ["poster", "halftone", "chromatic"]
  ).map(presetPass)
  nodes.forEach((n, i) => {
    n.position = { x: 40 + (i % 3) * 265, y: 50 + Math.floor(i / 3) * 240 }
  })
  let edges: PassProject["edges"]
  if (id === "loom") {
    const delay = makePass("previous")
    delay.position = { x: 305, y: 290 }
    nodes[3].position = { x: 570, y: 290 }
    nodes[4].position = { x: 835, y: 50 }
    edges = [
      connect(nodes[0], nodes[1], 0),
      connect(nodes[1], delay, 0),
      connect(delay, nodes[1], 1),
      connect(nodes[1], nodes[2], 0),
      connect(nodes[2], nodes[3], 0),
      connect(nodes[1], nodes[4], 0),
      connect(nodes[3], nodes[4], 1),
    ]
    nodes.push(delay)
  } else if (id === "prism") {
    edges = [
      connect(nodes[0], nodes[1], 0),
      connect(nodes[1], nodes[2], 0),
      connect(nodes[0], nodes[2], 1),
      connect(nodes[2], nodes[3], 0),
    ]
  } else
    edges = [connect(nodes[0], nodes[1], 0), connect(nodes[1], nodes[2], 0)]
  return {
    version: 2,
    id: crypto.randomUUID(),
    name: example.label,
    nodes,
    edges,
    output: nodes[id === "loom" ? 4 : nodes.length - 1].id,
  }
}
