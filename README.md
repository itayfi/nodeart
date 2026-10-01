# Nodeart

A local, node-based generative art workspace. React Flow provides the graph editor; WebGL renders the connected graph as a fragment shader. The UI uses Tailwind CSS v4, shadcn/ui with Base UI, and the shared gel surfaces in `src/glossy.css`.

```sh
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
```

## Working with graphs

Click a library entry to add a node. Drag between sockets to connect nodes; each input accepts one connection. Select a node to edit its parameters, duplicate it, or delete it. Use the node menu for touch-accessible actions, or select a wire and use Delete wire in the footer. The Nodes button opens the library on smaller screens.

Six example graphs demonstrate animated noise, previous-frame feedback, a pulsing circle, an animated line, a custom affine IFS, and a custom WFC tile set. Playback can be paused, and Reset clears time and frame history. Rendering supports square 512 and 1024 pixel output. Export PNG downloads the current image.

Projects opens a searchable local library with thumbnails, recent projects, duplication, and confirmed deletion. Changes autosave to IndexedDB after a short pause; reopening restores the active project. Existing single-workspace saves migrate automatically. New projects, examples, and JSON imports create separate projects so existing artwork is preserved. Save flushes changes immediately. Storage failures stay visible, and leaving with unsaved changes prompts a warning. Download graph JSON creates a portable backup including imported images and custom palettes. The GLSL panel shows and exports the generated fragment shader. External shader hosts must supply its uniforms and textures.

## How the node families connect

`src/engine.ts` defines 37 node types and compiles reachable nodes in dependency order. Values use three channels internally: scalars broadcast across channels, coordinate consumers read XY, and scalar consumers read X. RGB color and Compose vector construct multi-channel values; X/Y channel nodes extract channels. Unconnected inputs use defined fallback values. Graph cycles are rejected; temporal feedback uses Previous frame.

IFS and WFC run on the CPU and become textures. Their Coordinates input controls sampling, so shader operations can warp, transform, color, mask, and blend their output. IFS accepts graph-authored affine systems and weighted transforms. WFC accepts graph-authored tile artwork, edge labels, and selection weights, with minimum-entropy collapse, adjacency propagation, and retries on contradiction. Original fern and Wang tile definitions remain fallbacks for older graphs.

`src/Preview.tsx` owns GPU programs, generated textures, and two framebuffers for previous-frame feedback. It releases resources when rebuilding the shader. Dragging or selecting nodes does not recompile the graph. Changing parameters or graph connections rebuilds the pipeline and clears feedback history.

The Sound toggle persists separately. Cuelume supplies subtle semantic interaction cues; slider cues are throttled. Reduced motion starts playback paused and disables surface animation. Category icons are [Icons8 Flat Color](https://github.com/icons8/flat-color-icons); action icons use Lucide.

## Verification

`pnpm test` checks shader dependency order, default inputs, cycle rejection, legacy and custom WFC edge constraints, uniform propagation, animated geometry and IFS coefficients, image/palette backup validation, and isolated IndexedDB persistence and migration using fake-indexeddb. With the development server running, open `/tests/shaders.html` to compile and link every node, preset, and new uniform parameter against actual WebGL, and compare image sampling, alpha, all composite modes, and custom palettes against CPU pixel evaluation.

Add further Base UI components with `pnpm dlx shadcn@latest add <component>`. Preserve customized generated components. Tailwind owns layout and responsive behavior; `src/glossy.css` owns optical surfaces and motion.

## Uniforms and custom generators

Ports distinguish **uniform** values (one value for the entire frame) from **pixel** values. Time and Value start as uniforms. Math, vector composition, and color composition preserve uniform scope when all their inputs are uniform. Coordinates and image sampling produce pixel values. The editor and compiler reject pixel values at uniform-only inputs; numeric scalar/vector/color values still use the channel conventions above.

Circle accepts Center, Radius, and Softness inputs; Rectangle accepts Center, Size, and Softness; Line accepts Start, End, Width, and Softness. Compose vector builds centers or endpoints from scalar math. The Soft geometry and Animated line presets demonstrate Time → Sine → math → shape controls.

For custom IFS, connect **Affine transform → IFS system → IFS fractal**. Each transform exposes six affine coefficients and a selection weight as uniform inputs. Nest IFS system nodes to collect more than four transforms. The Custom IFS preset builds a Sierpinski triangle from three transforms. The generator exposes seed, iteration count, and viewport bounds. Legacy graphs without a connected system retain their fern fallback.

For custom WFC, connect **pixel artwork → Tile rule → Tile set → Wave collapse**. A Tile rule specifies top, right, bottom, and left edge labels plus a selection weight. Neighboring labels must match. Nest Tile set nodes to collect more than four rules. The Custom tile garden preset builds tile artwork from Line and Add nodes and explicitly connects four rules. Legacy graphs without a tile set retain their original Wang tile fallback.

Tile artwork is rasterized at 32 × 32 pixels from numeric pixel nodes and imported images; nested IFS/WFC/previous-frame textures inside a tile are currently unsupported. Time can animate artwork and rule uniforms. CPU generators update at most ten times per second while the GPU preview remains animated.

## Precise controls and image compositing

Each numeric parameter has a graph socket, including noise scale/detail/seed, palette cycles/phase/theme, transform scale/rotation/offsets, threshold controls, feedback persistence, Time speed, and IFS viewport bounds. Newly exposed sockets are appended to preserve existing graph connections. Pixel inputs remain available for math, RGB/vector composition, and blending; other parameter sockets require uniforms. Custom palette exposes four editable color stops with uniform color inputs.

The inspector pairs sliders with numeric fields. Press Enter or leave the field to commit; values are bounded to the documented range. Arrow keys adjust by one step; Shift + arrows use a tenth-step for continuous values. Per-property reset restores defaults without disconnecting drivers. Connected properties show their driver and a disconnect action. RGB color has a native color picker; palette themes and composite modes use named choices.

Image texture imports PNG, JPEG, WebP, GIF, and AVIF up to 20 MB, normalizing a still frame to an embedded PNG at at most 2048 pixels on the longest edge. Other image nodes can reuse the asset. Image alpha samples transparency, and Add matching alpha mask copies the image and its coordinate connection into a new alpha node. Use Transform or Domain warp to change sampling coordinates. Composite combines Background, Foreground, and Mask with uniform Opacity and Mode inputs; available modes are normal, multiply, screen, overlay, and add. Image sampling and compositing also work in custom WFC tile artwork.

The node **… menu** supports Edit properties, Duplicate, Disconnect wires, and Delete node. Selecting a wire exposes **Delete wire** in the graph footer. On touch screens, tap an output socket and then an input socket to connect; pinch to zoom. Node IDs no longer depend on Web Crypto and work over local-network HTTP. Run `pnpm dev --host 0.0.0.0` for LAN access.

UI changes must follow [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md): blue gel controls, white graph, card-gradient panels, and hierarchy through spacing and typography.
