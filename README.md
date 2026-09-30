# Nodeart · Gel lab

React + TypeScript + Vite, Tailwind CSS v4, shadcn/ui (Base UI / nova), Icons8 Flat Color category icons, Lucide action icons, and React Flow.

Use pnpm:

```sh
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm dlx shadcn@latest add tooltip
```

The project and six UI components were generated with the official shadcn CLI. components.json keeps the Base UI preset and Lucide configuration. Nodeart is a node-based generative art tool; see AGENTS.md for development rules.

src/glossy.css adapts source.css without importing its page-level resets. Tailwind handles layout, spacing, and sizing; CSS handles relative HSL gradient math, highlights, bevels, and animations. Original source.css is preserved. Button variants expose data-variant so surface colors follow the shadcn API. Slider squish uses Base UI data-dragging and scale independently of the thumb positioning; reduced motion removes animation. Inputs and cards have inset/lift effects; checkboxes and round radio controls have beveled surfaces and indicator pops.

src/App.tsx includes the component playground and React Flow custom nodes. Interactive node controls use nodrag/nopan/nowheel to avoid canvas gesture conflicts. Nodes and edges are local demo state, with connection creation and reset.

The starter uses a light glossy palette. For new components, add optical styling using their data-slot selectors in src/glossy.css. Avoid overwriting customized components with the CLI unless you intend to reapply the local changes.

Interaction sounds use Cuelume, synthesized through Web Audio with no audio assets. The header Sound toggle persists the preference; volume defaults to 25%. Shared buttons and inputs use delegated attributes, while checkbox/radio/slider changes and React Flow interactions use semantic cues. Slider sounds are throttled to one per 100ms. No hover or page-load sounds. See https://cuelume-site.pages.dev/agents.md for cue selection and API guidance.

Icons8 Flat Color icons are imported as SVG components from react-icons/fc and used for category markers through src/components/category-icon.tsx. Lucide supplies action icons and control indicators. Flat Color Icons are offered under MIT: https://github.com/icons8/flat-color-icons. The app retains an Icons8 credit and the default React Flow attribution.

References:
- https://ui.shadcn.com/docs/installation/vite
- https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
- https://base-ui.com/react/components/slider
- https://reactflow.dev/learn/customization/custom-nodes

