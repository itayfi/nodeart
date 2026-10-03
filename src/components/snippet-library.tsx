import { useState } from "react"
import { BookOpen, Plus } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog"
import { glslSnippets } from "../glsl-snippets"

export function SnippetLibrary({
  disabled,
  onInsert,
}: {
  disabled: boolean
  onInsert: (id: string) => void
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState("fbm"),
    [error, setError] = useState("")
  const filtered = glslSnippets.filter((s) =>
    `${s.label} ${s.category} ${s.description}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )
  const snippet = filtered.find((s) => s.id === selected) ?? filtered[0]
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled}
        data-cuelume-tap="open"
        onClick={() => {
          setError("")
          setOpen(true)
        }}
      >
        <BookOpen />
        GLSL snippets
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-3xl">
          <DialogTitle>GLSL snippet library</DialogTitle>
          <DialogDescription>
            Insert editable helper functions into this pass. Dependencies are
            included once. Copy the usage example into main() and adapt the
            texture names to your inputs.
          </DialogDescription>
          <Input
            aria-label="Search GLSL snippets"
            placeholder="Search noise, shapes, color, blending…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setError("")
            }}
          />
          <div className="grid min-h-0 flex-1 gap-4 overflow-auto sm:grid-cols-[220px_1fr]">
            <div className="library-scroll max-h-56 overflow-auto rounded-lg p-2 sm:max-h-none">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  data-slot="library-item"
                  aria-pressed={s.id === snippet?.id}
                  className="library-item flex w-full flex-col items-start gap-1 rounded-md p-3 text-left"
                  data-cuelume-tap="select"
                  onClick={() => {
                    setSelected(s.id)
                    setError("")
                  }}
                >
                  <span className="text-sm font-semibold">{s.label}</span>
                  <span className="text-xs">{s.category}</span>
                </button>
              ))}
              {!filtered.length && (
                <p className="p-3 text-sm">No snippets match your search.</p>
              )}
            </div>
            {snippet && (
              <div className="min-w-0 overflow-auto">
                <h3 className="mb-2 font-semibold">{snippet.label}</h3>
                <p className="mb-4 text-sm">{snippet.description}</p>
                <pre className="overflow-x-auto font-mono text-xs whitespace-pre-wrap">
                  {snippet.code}
                </pre>
                {snippet.dependencies?.length ? (
                  <p className="mt-3 text-xs">
                    Includes:{" "}
                    {snippet.dependencies
                      .map((id) => glslSnippets.find((s) => s.id === id)?.label)
                      .join(", ")}{" "}
                    (and their dependencies).
                  </p>
                ) : null}
                <h3 className="mt-5 mb-2 text-sm font-semibold">
                  Usage in main()
                </h3>
                <pre className="font-mono text-xs break-words whitespace-pre-wrap">
                  {snippet.usage}
                </pre>
              </div>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm">
              {error}
            </p>
          )}
          <Button
            className="self-start"
            disabled={!snippet || disabled}
            data-cuelume-tap="tap"
            onClick={() => {
              if (!snippet) return
              try {
                onInsert(snippet.id)
                setOpen(false)
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e))
              }
            }}
          >
            <Plus />
            Insert functions
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
