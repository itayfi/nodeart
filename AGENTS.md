# Project

Nodeart is a node-based generative art tool.

# Rules

- Commit substantial completed changes as part of the implementation turn after the required verification passes. Include only changes belonging to the task, and honor any user instruction to leave changes uncommitted. Before commiting, verify linter, typecheck and formatting.
- Use pnpm exclusively for dependency installation, scripts, and CLI commands. Do not use npm, npx, or yarn.
- Use shadcn/ui with Base UI for UI components. Add components through the official CLI (`pnpm dlx shadcn@latest add <component>`), then customize the generated source instead of recreating the primitives manually.
- Use Tailwind CSS v4 utilities for structure: layout, spacing, sizing, and responsive behavior.
- Use custom CSS for optical surfaces and motion: gradients, relative color math, highlights, shadows, bevels, and animations. Keep shared surface styles in `src/glossy.css`, target shadcn `data-slot` and state attributes, and use CSS variables for reusable parameters.
- Maintain a Flash / Y2K-inspired gel UI: glossy highlights, inset inputs, gradient cards, beveled selection controls, and playful tactile motion. Treat `src/glossy.css` as the styling reference and extend its existing surface rules consistently.
- Follow `DESIGN_SYSTEM.md` for all UI changes. Establish hierarchy with spacing and typography, not background colors. The page is light cool grey and the graph is white; the project bar and each side panel use separate light blue card gradients. The scrollable node list is white with an inset border. Use `primary` and `secondary` for ordinary actions (never ghost); allow `destructive` only for a primary destructive action, such as Delete in a confirmation dialog, never beside other toolbar actions. Use sparse embossed separators only where a boundary has a clear purpose; avoid ornamental borders, tinted node headers, and boxed read-only values. Use narrow category-colored top borders on nodes for family identification.
- Use Geist for UI text and controls, preserving monospace for numeric values, port types, and code. Keep secondary gel buttons and card surfaces light, with soft shadows. The preview and properties use an accessible adjustable split with independent scrolling.
- Preserve component accessibility and honor `prefers-reduced-motion` when customizing animations.
- Use Lucide for actions and control indicators. Use Icons8 Flat Color SVG icons from `react-icons/fc` for category markers through `src/components/category-icon.tsx`; prefer Lucide when no suitable color icon exists. Keep icons secondary to clear labels and prioritize usability over nostalgia.
- Give interactions appropriate Cuelume sound cues chosen by their job: tap for activation, type for text entry, toggle for checkboxes, select for choices and slider steps, and outcome cues only for actual outcomes. Follow https://cuelume-site.pages.dev/agents.md. Keep frequent cues subtle, throttle continuous interactions, never play on hover or initial render, avoid duplicate cues, and respect the persistent Sound toggle. Sound supplements visible feedback.
