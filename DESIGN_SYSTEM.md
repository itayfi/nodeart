# Nodeart design system

Nodeart is a node-based generative art tool. Its UI is Flash / Y2K-inspired gel, with modern legibility and interaction behavior. The visual reference is the blue glossy component collection established in this project, not a general retro theme.

## Hierarchy

Use spacing, typography, alignment, and grouping to communicate importance. Do not create hierarchy by assigning different background colors to headers, categories, nested sections, numeric values, or status labels.

- Panel headings: 16px, semibold. Selected-node title: 18px, semibold. Node titles: 14px, semibold.
- Labels, actions, and supporting text: 12–14px at normal workspace scale. Use weight and position to separate a label from its value.
- Use Geist for UI text and controls. Preserve monospace for numeric values, port types, and code, with tabular numerals for numbers. Avoid tiny type merely to fit more controls.
- Use a 4px spacing rhythm: 8px within related controls, 16px panel padding and workspace gutters, 24–28px between sections.
- Keep captions readable in dark blue. Do not make essential information faint. React Flow zoom scales nodes; keep their source typography readable.

## Surfaces and palette

The page background is light cool grey (`#edf1f4`); the graph canvas is pure white (`#fff`). Three separate sections use the light blue card gradient, `linear-gradient(#c5d9e6, #9ab9cf)`: the project bar (the second top row), the node-library panel, and the preview/inspector panel. Each section restarts its own gradient and has a rounded surface rim. The scrollable node list inside the library is white with an inset border. Floating menus, dialogs, toasts, and graph nodes use the same card surface.

| Token | Value | Purpose |
| --- | --- | --- |
| `--panel-top` | `#c5d9e6` | Card gradient top |
| `--panel-bottom` | `#9ab9cf` | Card gradient bottom |
| `--surface-rim` | `#46657d` | Purposeful surface edges |
| `--ink` | `#16364a` | Main text |
| `--ink-muted` | `#294d65` | Supporting text |
| Primary gel midpoint | `#339ee0` | Primary action and slider |
| Primary gel rim | `#173d59` | Gel edges and focus/selection |

Headers, transport controls, library groups, parameter rows, badges, and node headings inherit their parent surface. Do not add sage, dark code panels, white header bars, or alternate section fills. Palette swatches, rendered artwork, icons, socket markers, and small status indicators represent content or state and may use color; they are not panel backgrounds.

## Components

- **Buttons:** use `primary` and `secondary` for normal actions; reserve `destructive` for a primary destructive action, such as Delete in a confirmation dialog. Primary is blue gel for the main action; secondary is lighter neutral blue gel (`#aecbdd`) with a soft shadow for supporting actions, including icon buttons. No ghost, outline, or link button variants. A Delete action beside other toolbar actions stays secondary; use destructive gel only when deletion is the primary action. Destructive actions use explicit labels and an appropriate icon. Keep native disabled and keyboard behavior.
- **Gel surface:** retain the relative HSL gradient math, top and bottom reflections, rounded silhouette, and pressed inset shadow. Do not replace this with a flat or softly tinted modern button.
- **Inputs and selects:** share the same light inset blue gradient (`#aecbdd` to `#d4e5ef`), 8px corners, rim, and subtle inner shadow through a common CSS surface rule. Editable project names retain an input affordance.
- **Sliders:** blue gel track/range and a rounded glossy thumb. Preserve drag squish through `scale`, independently of the primitive's positioning. Keep a generous hit area.
- **Checkboxes and radios:** opposing bevel gradients; checkboxes are square with softened corners and radios are round, including their inner bevel and selected dot.
- **Nodes:** card gradient, readable title, spaced port/value rows, and purposeful sockets. Use a narrow category-colored top border to identify node families; keep header backgrounds on the card gradient. Selection uses an outline, not a new fill.
- **Selects and menus:** shadcn/Base UI semantics with the shared blue surface. Hovered and keyboard-highlighted options use the primary button's blue gel gradient and glossy highlight, with a subtle rim. Include submenu triggers; disabled items retain their disabled treatment. This interactive state is an exception to the rule against using background colors for hierarchy.

## Borders and separators

Every line must identify a surface edge, connection, interactive affordance, or meaningful boundary. Sparse separators are allowed only when spacing alone is insufficient.

- Surface rims on nodes, graph, preview, inputs, and buttons explain their bounds or affordances.
- Wires represent graph connections. Focus/selection outlines explain interaction state.
- The adjustable preview/properties split uses a draggable embossed divider with a visible grip. Both regions scroll independently; preserve keyboard resizing, accessible naming, and minimum usable sizes.
- Do not put flat rules under every heading, between every toolbar, around badges, or around individual read-only values. Do not duplicate a border with an ornamental inner border.

## Icons, motion, and sound

Use Lucide for actions and controls; use Icons8 Flat Color SVGs sparingly for category markers through `category-icon.tsx`. Keep clear labels and accessible names. Icons8 Flat Color does not require visible attribution; do not add attribution UI for this pack.

Animations should communicate touch: gentle gel compression, slider squish, and selection indicator pops. Respect `prefers-reduced-motion`; avoid ongoing decorative motion. Interaction sounds use Cuelume, chosen by job, kept subtle for frequent actions, and controlled by the persistent Sound toggle. Never add hover sounds or a node-drop sound.

## Implementation and review

Use Tailwind CSS v4 for structure, spacing, sizing, and responsive layout. Shared surface tokens, gradients, color math, bevels, and motion live in `src/glossy.css`. Extend the existing system instead of appending a competing theme. Account for Base UI trigger slots as well as ordinary button slots.

Before delivering a UI change, inspect the live app: graph is white; panels use the blue gradient; normal actions use primary/secondary and destructive styling is reserved for a primary destructive action; hierarchy comes from spacing and type; separators have a purpose and embossed treatment; focus, disabled states, sound settings, and reduced motion remain usable. Check narrow layouts and a dialog/menu as well as the main workspace. Keep generative-art behavior intact.

Keep the graph free of top and bottom toolbar bars. Example graphs, JSON downloads, and GLSL access live in the Project options dropdown beside Open, Save, and Export. Do not add decorative avatars or a persistent status footer.

The library is wider to fit readable node names; omit decorative footer captions so the list uses the available space. Keep the preview/properties split usable on narrow screens as well as desktop.

Preview controls occupy one row: play/pause, reset, elapsed time, and quality selection. Show resolution only in the quality options; omit redundant playback text and separate resolution/ratio captions.
