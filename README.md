# Nodeart · Gel lab

React + TypeScript + Vite, Tailwind CSS v4, shadcn/ui (Base UI / nova), Lucide icons, and React Flow.

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

References:
- https://ui.shadcn.com/docs/installation/vite
- https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
- https://base-ui.com/react/components/slider
- https://reactflow.dev/learn/customization/custom-nodes
