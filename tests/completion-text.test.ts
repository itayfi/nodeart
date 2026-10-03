import { test } from "node:test"
import assert from "node:assert/strict"
import { cleanCompletion } from "../src/completion-text.ts"
test("inline completions remove markdown explanations and repeated enclosing suffixes", () => {
  assert.equal(
    cleanCompletion(
      "x * (sin(x) + 0.5);\n}\nvec3 extra() {}\n```\nExplanation",
      "\n}"
    ),
    "x * (sin(x) + 0.5);"
  )
  assert.equal(
    cleanCompletion("```glsl\nsin(x);\n```\nExplanation", "\n}"),
    "sin(x);"
  )
  assert.equal(
    cleanCompletion("if (x) { foo(); }\n}\nOther", "\n}"),
    "if (x) { foo(); }"
  )
  assert.equal(
    cleanCompletion('"}"; // }\nfoo();\n}', "\n}"),
    '"}"; // }\nfoo();'
  )
  assert.equal(cleanCompletion("vec2(1.0, 0.0)); more", ");"), "vec2(1.0, 0.0)")
})
