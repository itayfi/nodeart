import { useState } from "react"
import { Copy, FolderOpen, Plus, Trash2, Upload, X } from "lucide-react"
import type { LibraryProject } from "../project-library"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog"

export function ProjectBrowser({
  open,
  onOpenChange,
  projects,
  activeId,
  busy,
  onChoose,
  onNew,
  onDuplicate,
  onDelete,
  onImport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: LibraryProject[]
  activeId: string
  busy: boolean
  onChoose: (project: LibraryProject) => void
  onNew: () => void
  onDuplicate: (project: LibraryProject) => void
  onDelete: (project: LibraryProject) => Promise<boolean>
  onImport: () => void
}) {
  const [search, setSearch] = useState("")
  const [removing, setRemoving] = useState<LibraryProject | null>(null)
  const filtered = projects
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt)
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="modal-surface flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)]! max-w-3xl! flex-col overflow-hidden rounded-2xl p-6"
        >
          <div className="flex shrink-0 items-center justify-between gap-4">
            <DialogTitle className="font-semibold">Your projects</DialogTitle>
            <Button
              autoFocus
              variant="secondary"
              size="icon-sm"
              aria-label="Close dialog"
              onClick={() => onOpenChange(false)}
            >
              <X />
            </Button>
          </div>
          <DialogDescription>
            Saved on this device. Changes save automatically; download graph
            JSON for a portable backup.
          </DialogDescription>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Input
              className="min-w-36 flex-1"
              placeholder="Search projects…"
              aria-label="Search projects"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button disabled={busy} onClick={onNew}>
              <Plus />
              New project
            </Button>
            <Button variant="secondary" disabled={busy} onClick={onImport}>
              <Upload />
              Import JSON
            </Button>
          </div>
          <div className="grid min-h-0 grid-cols-1 gap-5 overflow-y-auto overscroll-contain p-1 sm:grid-cols-2 md:grid-cols-3">
            {filtered.map((project) => (
              <article key={project.id} className="space-y-2">
                <Button
                  variant="secondary"
                  className="project-tile h-auto w-full flex-col gap-3 p-3! text-left"
                  disabled={busy}
                  onClick={() => onChoose(project)}
                  aria-label={`Open ${project.name || "Untitled study"}`}
                >
                  {project.thumbnail ? (
                    <img
                      src={project.thumbnail}
                      alt=""
                      className="aspect-square w-full rounded-md object-cover"
                    />
                  ) : (
                    <div className="project-placeholder flex aspect-square w-full items-center justify-center rounded-md">
                      <FolderOpen className="size-8" />
                    </div>
                  )}
                  <span className="w-full truncate text-sm font-semibold">
                    {project.name || "Untitled study"}
                  </span>
                  <span className="w-full text-[12px] font-normal">
                    {project.id === activeId ? "Current · " : ""}
                    {new Date(project.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </Button>
                <div className="flex justify-between gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    aria-label={`Duplicate ${project.name}`}
                    onClick={() => onDuplicate(project)}
                  >
                    <Copy />
                    Duplicate
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    disabled={busy || project.id === activeId}
                    aria-label={`Delete ${project.name}`}
                    onClick={() => setRemoving(project)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </article>
            ))}
            {!filtered.length && (
              <p className="col-span-full py-8 text-center text-sm">
                No projects match your search.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!removing}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
      >
        <DialogContent className="modal-surface !max-w-sm">
          <DialogTitle>Delete project?</DialogTitle>
          <DialogDescription>
            Delete “{removing?.name}” from this device? This cannot be undone.
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (removing && (await onDelete(removing))) setRemoving(null)
              }}
            >
              Delete project
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
