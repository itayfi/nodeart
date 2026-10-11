import { useState } from "react"
import { BookOpen, MoreHorizontal, Sparkles } from "lucide-react"
import type { AIState } from "../ai"
import { AISettings } from "./ai-settings"
import { SnippetLibrary } from "./snippet-library"
import { Button } from "./ui/button"
import { ButtonGroup } from "./ui/button-group"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu"

export function EditorActions({
  state,
  automatic,
  onAutomatic,
  snippetsDisabled,
  suggestDisabled,
  onInsert,
  onSuggest,
}: {
  state: AIState
  automatic: boolean
  onAutomatic: (enabled: boolean) => void
  snippetsDisabled: boolean
  suggestDisabled: boolean
  onInsert: (id: string) => void
  onSuggest: () => void
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [snippetsOpen, setSnippetsOpen] = useState(false)
  const enabled = state.phase === "ready" || state.phase === "generating"
  const status =
    state.phase === "error"
      ? " · error"
      : state.phase === "loading"
        ? " · loading"
        : state.phase === "generating"
          ? " · generating"
          : enabled
            ? " · on"
            : ""

  return (
    <>
      <ButtonGroup className="gel-group shrink-0" aria-label="Code assistance">
        <Button
          variant="secondary"
          size="sm"
          disabled={enabled && suggestDisabled}
          data-cuelume-tap={enabled ? "tap" : "open"}
          onClick={enabled ? onSuggest : () => setSettingsOpen(true)}
          title={state.detail}
        >
          <Sparkles />
          {enabled ? "Suggest" : `AI Completion${status}`}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="secondary" size="icon-sm" />}
            aria-label="Code assistance actions"
            data-cuelume-tap="open"
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem
              data-cuelume-tap="select"
              onClick={() => setSettingsOpen(true)}
            >
              <Sparkles /> AI Completion{status}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={snippetsDisabled}
              data-cuelume-tap="select"
              onClick={() => setSnippetsOpen(true)}
            >
              <BookOpen /> GLSL snippets
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={suggestDisabled}
              data-cuelume-tap="select"
              onClick={onSuggest}
            >
              <Sparkles /> Suggest
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
      <AISettings
        state={state}
        automatic={automatic}
        onAutomatic={onAutomatic}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
      <SnippetLibrary
        disabled={snippetsDisabled}
        onInsert={onInsert}
        open={snippetsOpen}
        onOpenChange={setSnippetsOpen}
      />
    </>
  )
}
