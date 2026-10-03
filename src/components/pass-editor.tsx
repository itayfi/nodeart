import { useEffect, useRef } from "react"
import Editor, { loader, type OnMount } from "@monaco-editor/react"
import * as monaco from "monaco-editor"
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker"
import TSWorker from "monaco-editor/language/typescript/ts.worker.js?worker"
import { localCompletion } from "../ai"
import { passAPI, type PassNode } from "../passes"
import { play } from "cuelume"

self.MonacoEnvironment = {
  getWorker: (_id, label) =>
    label === "javascript" || label === "typescript"
      ? new TSWorker()
      : new EditorWorker(),
}
loader.config({ monaco })
monaco.languages.register({ id: "glsl" })
monaco.languages.setMonarchTokensProvider("glsl", {
  tokenizer: {
    root: [
      [/\/\/.*$/, "comment"],
      [/\/\*/, "comment", "@comment"],
      [
        /\b(?:void|float|int|bool|vec[234]|mat[234]|sampler2D|precision|highp|mediump|uniform|varying|attribute|if|else|for|while|return|in|out|const)\b/,
        "keyword",
      ],
      [
        /\b(?:texture2D|mix|sin|cos|fract|clamp|smoothstep|step|normalize|length|dot|pow|abs|min|max)\b/,
        "type.identifier",
      ],
      [/\d*\.?\d+(?:[eE][-+]?\d+)?/, "number"],
      [/[a-zA-Z_]\w*/, "identifier"],
    ],
    comment: [
      [/[^/*]+/, "comment"],
      [/\*\//, "comment", "@pop"],
      [/[/*]/, "comment"],
    ],
  },
})
monaco.languages.setLanguageConfiguration("glsl", {
  comments: { lineComment: "//", blockComment: ["/*", "*/"] },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "(", close: ")" },
    { open: "[", close: "]" },
  ],
})

export function PassEditor({
  node,
  onChange,
  automatic,
  error,
  onReady,
}: {
  node: PassNode
  onChange: (code: string) => void
  automatic: boolean
  error: string
  onReady: (editor: monaco.editor.IStandaloneCodeEditor) => void
}) {
  const current = useRef({ node, automatic })
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  useEffect(() => {
    current.current = { node, automatic }
  }, [node, automatic])
  useEffect(() => {
    const editor = editorRef.current,
      model = editor?.getModel()
    if (!model) return
    const relevant = error.startsWith(`${node.data.label}:`)
    const match = error.match(/ERROR:\s*\d+:(\d+):/)
    const line = Math.max(
      1,
      Math.min(model.getLineCount(), Number(match?.[1] ?? 1))
    )
    monaco.editor.setModelMarkers(
      model,
      "nodeart",
      relevant
        ? [
            {
              severity: monaco.MarkerSeverity.Error,
              message: error,
              startLineNumber: line,
              endLineNumber: line,
              startColumn: 1,
              endColumn: model.getLineMaxColumn(line),
            },
          ]
        : []
    )
  }, [error, node.id, node.data.label, node.data.code])
  useEffect(() => {
    const disposables = ["glsl", "javascript"].map((language) =>
      monaco.languages.registerInlineCompletionsProvider(language, {
        provideInlineCompletions: async (model, position, context, token) => {
          const { node, automatic } = current.current
          if (
            model !== editorRef.current?.getModel() ||
            (!automatic &&
              context.triggerKind !==
                monaco.languages.InlineCompletionTriggerKind.Explicit)
          )
            return { items: [] }
          const version = model.getVersionId(),
            id = node.id,
            api = passAPI(node)
          if (
            context.triggerKind !==
            monaco.languages.InlineCompletionTriggerKind.Explicit
          )
            await new Promise((resolve) => setTimeout(resolve, 900))
          if (token.isCancellationRequested || version !== model.getVersionId())
            return { items: [] }
          const value = model.getValue(),
            offset = model.getOffsetAt(position)
          const text = await localCompletion.complete(
            value.slice(0, offset),
            value.slice(offset),
            api,
            node.data.kind === "glsl" ? "GLSL" : "p5.js JavaScript"
          )
          if (
            !text ||
            token.isCancellationRequested ||
            model.isDisposed() ||
            version !== model.getVersionId() ||
            id !== current.current.node.id ||
            api !== passAPI(current.current.node)
          )
            return { items: [] }
          return {
            items: [
              {
                insertText: text,
                range: new monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column
                ),
                command: {
                  id: "nodeart.acceptCompletion",
                  title: "Accept completion",
                },
              },
            ],
          }
        },
        disposeInlineCompletions: () => {},
      })
    )
    const accept = monaco.editor.registerCommand(
      "nodeart.acceptCompletion",
      () => play("select", { emphasis: "subtle" })
    )
    return () => {
      disposables.forEach((d) => d.dispose())
      accept.dispose()
    }
  }, [])
  const mount: OnMount = (editor) => {
    editorRef.current = editor
    onReady(editor)
    editor.addAction({
      id: "nodeart.suggest",
      label: "Suggest with local AI",
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.Enter],
      run: () => editor.getAction("editor.action.inlineSuggest.trigger")?.run(),
    })
  }
  return (
    <Editor
      path={`${node.id}.${node.data.kind === "glsl" ? "glsl" : "js"}`}
      language={node.data.kind === "glsl" ? "glsl" : "javascript"}
      theme="vs"
      value={node.data.code}
      onChange={(value) => onChange(value ?? "")}
      onMount={mount}
      options={{
        automaticLayout: true,
        editContext: false,
        minimap: { enabled: false },
        fontSize: 14,
        tabSize: 2,
        scrollBeyondLastLine: false,
        inlineSuggest: { enabled: true },
        padding: { top: 16 },
        fixedOverflowWidgets: true,
      }}
      loading={<p className="p-4">Loading code editor…</p>}
    />
  )
}
