# Nodeart

A local, node-based generative art workspace. Every programmable node is a GLSL or p5.js rendering pass. Connections carry rendered textures, and explicit Previous frame nodes enable feedback from any pass, including itself.

The workspace uses Monaco, React Flow, Tailwind CSS v4, shadcn/Base UI, and the gel surfaces in `src/glossy.css`.

```sh
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
```

## The workspace

Code is on the left; preview and graph are on the right. Select a node to edit it. All three dividers support dragging and keyboard resizing, and their layouts are remembered. Narrow screens stack the workspace vertically with page scrolling.

Add GLSL, p5.js, Previous frame, or Image input nodes from Project options. The same menu contains feedback, two-texture blending, and mixed p5.js/GLSL examples, JSON import, and JSON download.

**Run** compiles the complete draft and resets its time and history. A failed compilation keeps the previous valid graph running. **Reset** restarts that valid graph; **Pause** freezes its time and history. Code edits, graph changes, and node selection do not automatically replace the running graph. Quality controls select 256, 512, or 1024 pixel pass resolution. PNG export captures the displayed output.

## Named texture inputs

Programmable passes start with no inputs. Use Add input below the code to create named ports. Each has a stable ID, a display label, and a code identifier. Labels and order can change without changing connections. One source can feed multiple ports; each input accepts one connection.

GLSL's generated Pass API supplies:

```glsl
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform int uFrame;
uniform vec2 uResolution;

// For an input named source:
uniform sampler2D source;
uniform vec2 sourceResolution;
uniform bool sourceConnected;
```

Do not redeclare these generated names in editable code. GLSL uses WebGL 1 fragment shader syntax:

```glsl
void main() {
  gl_FragColor = texture2D(source, vUv);
}
```

p5.js uses instance mode:

```js
function setup(p) {
  p.noStroke()
}

function draw(p, inputs, time, frame) {
  p.clear()
  if (inputs.source) {
    p.image(inputs.source, 0, 0, p.width, p.height)
  }
  p.fill(255, 180, 90)
  p.circle(p.width / 2, p.height / 2, 80)
}
```

Nodeart owns the p5 canvas and animation loop: do not call createCanvas, resizeCanvas, loop, or redraw. setup runs once per successful rebuild; draw receives elapsed seconds and a zero-based frame number. Sketch state can persist on the p instance.

Unconnected GLSL inputs sample transparent black and report Connected=false. p5 inputs are null. Connected p5 inputs are p5.Image objects; imported images retain their native dimensions. GLSL samples normalized coordinates and exposes each source's dimensions. Current-frame passes and delay outputs use the project resolution.

Port edits show the proposed code before applying a rename. Renaming updates GLSL identifier tokens and direct p5 inputs.name / inputs["name"] accesses, excluding comments and unrelated properties. Aliased, dynamically computed, or destructured JavaScript access needs manual review. Removing a port shows its connection and code references; references remain for manual correction. Graph Undo restores the full edit.

Inputs are limited to eight per pass and the GPU's available texture units. Graphs support up to 64 nodes. Image input accepts local PNG, JPEG, WebP, GIF, and AVIF files up to 20 MB and 4096 pixels per side; assets are stored as PNG in the project.

## Multi-pass and feedback

The renderer executes passes in dependency order. Each pass has its own render targets, and branches can sample the same output independently. Every Previous frame node exposes an immutable previous-frame snapshot throughout the current frame. It captures its source only after all current-frame passes finish. Chains of delay nodes therefore add one frame each. The initial history is transparent black.

GLSL-to-GLSL transfer stays on the GPU. GLSL/image-to-p5 transfer reads pixels back to a p5.Image, so mixed graphs can be slower, especially at high resolution. p5 outputs upload back to a GPU texture.

## Editor suggestions and colors

IntelliSense works without an AI model. Press Ctrl+Space for suggestions. p5.js
uses its TypeScript declarations for method completion, hover documentation, and
parameter help. `setup`/`draw` callback parameters are typed automatically, including
named inputs as nullable `p5.Image` values. Saved code remains JavaScript.

GLSL suggestions include WebGL 1 built-in functions, type keywords, and the current
pass's generated uniforms and texture inputs. This is a built-in catalog, not a full
GLSL language server. Click a swatch beside a literal `vec3` or `vec4` with components
in 0–1 to edit its color. Expressions and HDR values are left alone; literal vectors
may also represent positions or other data, so use the picker where appropriate.

## Browser-local AI completion

Open AI completion in the code toolbar:

- Choose Qwen 2.5 Coder 0.5B or 1.5B.
- Choose WebGPU (GPU) or WASM (CPU). WebGPU availability is checked; a runtime failure remains visible and does not silently switch backends.
- Press Download & enable, or Load & enable for previously loaded configurations. Changing a selection does not download anything; Apply activates the new selection.
- Cancel terminates the worker and its pending load. Disable & unload releases the worker and model. Remove cached models clears Nodeart's dedicated model cache.
- Use Suggest or Alt+Enter to request inline code; Tab accepts and Escape dismisses. Automatic suggestions after a typing pause are optional.

Inference runs in a dedicated worker through Transformers.js, using q4 weights from the ONNX Community Qwen repositories. The 1.5B q4 weights are about 1.92 GB; download progress reports actual bytes. Browser cache eviction or quota limits can require a later download. Cache labels are hints, not guarantees. The first load requires network access to Hugging Face and runtime assets; code prompts are processed on the device, with no application inference server or paid API.

Completion context includes the selected pass's API and a bounded prefix/suffix around the cursor. Stale suggestions are discarded when code, selection, or port definitions change. Concurrent requests are bounded to one. WASM can be substantially slower, and WebGPU competes with art rendering for GPU resources.

## Local projects and compatibility

Pass projects use version 2 JSON and a separate `nodeart-passes` IndexedDB database. Changes autosave after a short pause; Save flushes immediately. Project switching preserves pending edits. JSON imports create new project IDs and wait for an explicit Run before executing code.

Earlier node graphs and their original IndexedDB/localStorage data remain untouched. This release does not automatically translate the old parameter-node graphs into editable passes; use the previous version to open those graphs. Legacy parser/renderer modules and tests remain available for compatibility reference.

p5 code is ordinary JavaScript executing in the page, not a sandbox. Review imported code before Run. The persistent Sound toggle controls subtle Cuelume interaction cues; surface motion honors prefers-reduced-motion.

## Verification

`pnpm test` covers graph order, cycle rejection, port identity, input validation, code renaming, project roundtrips, and existing legacy behavior.

With the dev server running, open `/tests/passes.html` for actual WebGL/p5 pixel tests: multi-input blending, disconnected inputs, self-feedback, reset, delay chains, transfers in both directions, image dimensions/orientation, and shader errors. The page prints PASS/FAIL results. The earlier renderer's harness remains at `/tests/shaders.html`.

AI end-to-end testing requires loading the selected model on a browser/device supporting that backend; model availability and device memory can vary.
