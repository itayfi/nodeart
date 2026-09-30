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

Save stores one workspace in local storage on this device. Graph downloads a JSON backup, and Open imports it. The GLSL panel shows and exports the generated fragment shader. External shader hosts must supply its uniforms and textures.

## How the node families connect

`src/engine.ts` defines 33 node types and compiles reachable nodes in dependency order. Values use three channels internally: scalars broadcast across channels, coordinate consumers read XY, and scalar consumers read X. RGB color and Compose vector construct multi-channel values; X/Y channel nodes extract channels. Unconnected inputs use defined fallback values. Graph cycles are rejected; temporal feedback uses Previous frame.

IFS and WFC run on the CPU and become textures. Their Coordinates input controls sampling, so shader operations can warp, transform, color, mask, and blend their output. IFS accepts graph-authored affine systems and weighted transforms. WFC accepts graph-authored tile artwork, edge labels, and selection weights, with minimum-entropy collapse, adjacency propagation, and retries on contradiction. Original fern and Wang tile definitions remain fallbacks for older graphs.

`src/Preview.tsx` owns GPU programs, generated textures, and two framebuffers for previous-frame feedback. It releases resources when rebuilding the shader. Dragging or selecting nodes does not recompile the graph. Changing parameters or graph connections rebuilds the pipeline and clears feedback history.

The Sound toggle persists separately. Cuelume supplies subtle semantic interaction cues; slider cues are throttled. Reduced motion starts playback paused and disables surface animation. Category icons are [Icons8 Flat Color](https://github.com/icons8/flat-color-icons); action icons use Lucide.

## Verification

`pnpm test` checks shader dependency order, default inputs, cycle rejection, legacy and custom WFC edge constraints, uniform propagation, animated geometry and IFS coefficients, and identifiers without Web Crypto. With the development server running, open `/tests/shaders.html` to compile and link every node and preset against actual WebGL.

Add further Base UI components with `pnpm dlx shadcn@latest add <component>`. Preserve customized generated components. Tailwind owns layout and responsive behavior; `src/glossy.css` owns optical surfaces and motion.

## Uniforms and custom generators

Ports distinguish **uniform** values (one value for the entire frame) from **pixel** values. Time and Value start as uniforms. Math, vector composition, and color composition preserve uniform scope when all their inputs are uniform. Coordinates and image sampling produce pixel values. The editor and compiler reject pixel values at uniform-only inputs; numeric scalar/vector/color values still use the channel conventions above.

Circle accepts Center, Radius, and Softness inputs; Rectangle accepts Center, Size, and Softness; Line accepts Start, End, Width, and Softness. Compose vector builds centers or endpoints from scalar math. The Soft geometry and Animated line presets demonstrate Time → Sine → math → shape controls.

For custom IFS, connect **Affine transform → IFS system → IFS fractal**. Each transform exposes six affine coefficients and a selection weight as uniform inputs. Nest IFS system nodes to collect more than four transforms. The Custom IFS preset builds a Sierpinski triangle from three transforms. The generator exposes seed, iteration count, and viewport bounds. Legacy graphs without a connected system retain their fern fallback.

For custom WFC, connect **pixel artwork → Tile rule → Tile set → Wave collapse**. A Tile rule specifies top, right, bottom, and left edge labels plus a selection weight. Neighboring labels must match. Nest Tile set nodes to collect more than four rules. The Custom tile garden preset builds tile artwork from Line and Add nodes and explicitly connects four rules. Legacy graphs without a tile set retain their original Wang tile fallback.

Tile artwork is rasterized at 32 × 32 pixels from numeric pixel nodes; nested IFS/WFC/previous-frame textures inside a tile are currently unsupported. Time can animate artwork and rule uniforms. CPU generators update at most ten times per second while the GPU preview remains animated.

The node **… menu** supports Edit properties, Duplicate, Disconnect wires, and Delete node. Selecting a wire exposes **Delete wire** in the graph footer. On touch screens, tap an output socket and then an input socket to connect; pinch to zoom. Node IDs no longer depend on Web Crypto and work over local-network HTTP. Run `pnpm dev --host 0.0.0.0` for LAN access.
