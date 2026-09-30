# Project

Nodeart is a node-based generative art tool.

# Rules

- Use pnpm exclusively for dependency installation, scripts, and CLI commands. Do not use npm, npx, or yarn.
- Use shadcn/ui with Base UI for UI components. Add components through the official CLI (`pnpm dlx shadcn@latest add <component>`), then customize the generated source instead of recreating the primitives manually.
- Use Tailwind CSS v4 utilities for structure: layout, spacing, sizing, and responsive behavior.
- Use custom CSS for optical surfaces and motion: gradients, relative color math, highlights, shadows, bevels, and animations. Keep shared surface styles in `src/glossy.css`, target shadcn `data-slot` and state attributes, and use CSS variables for reusable parameters.
- Maintain a Flash / Y2K-inspired gel UI: glossy highlights, inset inputs, gradient cards, beveled selection controls, and playful tactile motion. Treat `src/glossy.css` as the styling reference and extend its existing surface rules consistently.
- Preserve component accessibility and honor `prefers-reduced-motion` when customizing animations.
