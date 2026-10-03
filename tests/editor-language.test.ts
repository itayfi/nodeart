import { test } from "node:test"
import assert from "node:assert/strict"
import {
  p5Mirror,
  vectorColors,
  vectorColorText,
} from "../src/editor-language.ts"

test("GLSL color recognition preserves offsets and ignores expressions, comments, and HDR vectors", () => {
  const source = `// vec3(1.0)\nvec3(0.2, .4, 6e-1); vec4(.25); /* vec3(0.0) */\nvec3(2.0); vec4(vec3(.3), 1.0); vec3(x, y, z);`
  const colors = vectorColors(source)
  assert.deepEqual(
    colors.map((c) => c.rgba),
    [
      [0.2, 0.4, 0.6, 1],
      [0.25, 0.25, 0.25, 0.25],
      [0.3, 0.3, 0.3, 1],
    ]
  )
  assert.equal(
    source.slice(colors[0].start, colors[0].end),
    "vec3(0.2, .4, 6e-1)"
  )
  assert.equal(
    vectorColorText(4, [0.2, 0.5, 1, 0.75]),
    "vec4(0.2, 0.5, 1.0, 0.75)"
  )
  assert.equal(vectorColorText(3, [0, 0.5, 1, 0.1]), "vec3(0.0, 0.5, 1.0)")
})

test("p5 mirror annotates runtime callbacks and named image inputs with exact cursor mapping", () => {
  const source = `function setup(sketch) { sketch.noStroke(); }\nfunction draw(p, textures, seconds, tick) {\n  textures.source.width; p.circle(0, 0, 10);\n}`
  const mirror = p5Mirror(source, ["source", "mask"])
  assert.match(mirror.text, /@param \{import\('p5'\)\} sketch/)
  assert.match(
    mirror.text,
    /source: import\('p5'\).Image \| null; mask: import\('p5'\).Image \| null/
  )
  assert.match(mirror.text, /@param \{number\} seconds/)
  for (const word of ["sketch.noStroke", "textures.source.width", "p.circle"]) {
    const offset = source.indexOf(word)
    assert.equal(
      mirror.text.slice(
        mirror.offset(offset),
        mirror.offset(offset) + word.length
      ),
      word
    )
  }
  assert.match(
    p5Mirror("const draw = (p, inputs) => { p.clear(); }", []).text,
    /@type/
  )
  assert.equal(
    p5Mirror("// function draw(p) {}\nconst text = 'function setup(p) {}';", [])
      .text,
    "// function draw(p) {}\nconst text = 'function setup(p) {}';"
  )
})
