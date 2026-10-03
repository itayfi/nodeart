import { test } from "node:test"
import assert from "node:assert/strict"
import { insertGLSLSnippet, glslSnippets } from "../src/glsl-snippets.ts"

test("fractal noise inserts ordered dependencies only once and retains main", () => {
  const main = "void main() { gl_FragColor = vec4(1.0); }"
  const result = insertGLSLSnippet(main, "fbm")
  assert.deepEqual(result.added, ["2D hash", "Value noise", "Fractal noise"])
  assert.ok(
    result.code.indexOf("float na_hash21") <
      result.code.indexOf("float na_noise2")
  )
  assert.ok(result.code.endsWith(main))
  assert.equal(insertGLSLSnippet(result.code, "noise").code, result.code)
  assert.deepEqual(insertGLSLSnippet(result.code, "fbm").added, [])
})
test("edited definitions cause a conflict without mutating source; comments do not", () => {
  const source = "float na_hash21(vec2 p) { return 0.0; }"
  assert.throws(
    () => insertGLSLSnippet(source, "fbm"),
    /already exists with different code/
  )
  assert.equal(source, "float na_hash21(vec2 p) { return 0.0; }")
  assert.equal(insertGLSLSnippet("// " + source, "hash").added.length, 1)
  const original = glslSnippets
    .find((s) => s.id === "hash")!
    .code.replace("return", "/* retained comment */ return")
  assert.equal(insertGLSLSnippet(original, "hash").added.length, 0)
})
test("version directive remains first and all snippets can coexist", () => {
  let source = "#version 100\nvoid main(){gl_FragColor=vec4(1.0);}"
  for (const s of glslSnippets) source = insertGLSLSnippet(source, s.id).code
  assert.ok(source.startsWith("#version 100\n"))
  assert.throws(() => insertGLSLSnippet(source, "missing"), /Unknown snippet/)
})
test("incremental noise insertion declares dependencies before calls", () => {
  const hash = insertGLSLSnippet("void main(){}", "hash").code
  const noise = insertGLSLSnippet(hash, "noise").code
  assert.ok(
    noise.indexOf("float na_hash21(vec2 p);") <
      noise.indexOf("float na_noise2(vec2 p) {")
  )
  const fbm = insertGLSLSnippet(noise, "fbm").code
  assert.ok(
    fbm.indexOf("float na_noise2(vec2 p);") <
      fbm.indexOf("float na_fbm(vec2 p) {")
  )
  assert.throws(
    () => insertGLSLSnippet("int na_hash21(vec2 p){return 0;}", "hash"),
    /different code/
  )
})
