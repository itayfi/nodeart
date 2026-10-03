import * as monaco from "monaco-editor"
import type * as ts from "typescript"
import p5Index from "../node_modules/@types/p5/index.d.ts?raw"
import {
  codeOnly,
  glslFunctions,
  p5Mirror,
  vectorColors,
  vectorColorText,
} from "./editor-language"
import type { PassNode } from "./passes"

const typings = import.meta.glob<string>(
  "../node_modules/@types/p5/src/**/*.d.ts",
  {
    query: "?raw",
    import: "default",
    eager: true,
  }
)
const defaults = monaco.typescript.javascriptDefaults
defaults.setCompilerOptions({
  allowJs: true,
  checkJs: true,
  strict: true,
  target: monaco.typescript.ScriptTarget.ESNext,
  moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
  allowNonTsExtensions: true,
})
defaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: false,
})
// Our providers use typed mirror models, with the user's original model left intact.
defaults.setModeConfiguration({
  ...defaults.modeConfiguration,
  completionItems: false,
  hovers: false,
  signatureHelp: false,
})
defaults.addExtraLib(p5Index, "file:///node_modules/@types/p5/index.d.ts")
for (const [path, text] of Object.entries(typings)) {
  defaults.addExtraLib(text, `file:///${path.slice("../".length)}`)
}

monaco.editor.defineTheme("nodeart", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "menu.background": "#c5d9e6",
    "menu.foreground": "#16364a",
    "menu.selectionBackground": "#339ee0",
    "menu.selectionForeground": "#111111",
    "menu.border": "#46657d",
    "menu.separatorBackground": "#627f94",
    "editorWidget.background": "#c5d9e6",
    "editorWidget.border": "#46657d",
    "editorHoverWidget.background": "#c5d9e6",
    "editorHoverWidget.foreground": "#16364a",
    "editorSuggestWidget.background": "#c5d9e6",
    "editorSuggestWidget.foreground": "#16364a",
    "editorSuggestWidget.selectedBackground": "#339ee0",
    "editorSuggestWidget.selectedForeground": "#111111",
  },
})
monaco.languages.registerColorProvider("glsl", {
  provideDocumentColors(model) {
    return vectorColors(model.getValue()).map(({ start, end, rgba }) => ({
      range: monaco.Range.fromPositions(
        model.getPositionAt(start),
        model.getPositionAt(end)
      ),
      color: { red: rgba[0], green: rgba[1], blue: rgba[2], alpha: rgba[3] },
    }))
  },
  provideColorPresentations(model, info) {
    const size = model.getValueInRange(info.range).trim().startsWith("vec4")
      ? 4
      : 3
    const { red, green, blue, alpha } = info.color
    const label = vectorColorText(size, [red, green, blue, alpha])
    return [{ label, textEdit: { range: info.range, text: label } }]
  },
})

const display = (parts?: readonly ts.SymbolDisplayPart[]) =>
  (parts?.map((p) => p.text).join("") ?? "").replace(
    /import\("file:\/\/\/node_modules\/@types\/p5\/index\.d\.ts"\)/g,
    "p5"
  )
function kind(kind: string) {
  const K = monaco.languages.CompletionItemKind
  return kind === "method"
    ? K.Method
    : kind === "function"
      ? K.Function
      : kind === "class"
        ? K.Class
        : kind === "keyword"
          ? K.Keyword
          : K.Property
}

export function registerPassIntelliSense(
  getModel: () => monaco.editor.ITextModel | null | undefined,
  getNode: () => PassNode
) {
  let mirror: monaco.editor.ITextModel | undefined
  const pending = new WeakMap<
    monaco.languages.CompletionItem,
    { uri: string; offset: number }
  >()
  async function service(
    model: monaco.editor.ITextModel,
    position: monaco.IPosition
  ) {
    const node = getNode()
    const transformed = p5Mirror(
      model.getValue(),
      node.data.inputs.map((p) => p.name)
    )
    if (!mirror)
      mirror = monaco.editor.createModel(
        "",
        "javascript",
        monaco.Uri.parse(`file:///nodeart-intellisense/${node.id}.js`)
      )
    if (mirror.getValue() !== transformed.text)
      mirror.setValue(transformed.text)
    const uri = mirror.uri.toString(),
      offset = transformed.offset(model.getOffsetAt(position))
    const factory = await monaco.typescript.getJavaScriptWorker()
    return { worker: await factory(mirror.uri), uri, offset }
  }
  const owns = (model: monaco.editor.ITextModel) => model === getModel()
  const glslSymbols = () => {
    const node = getNode()
    return [
      ["uTime", "float", "Elapsed time in seconds."],
      ["uFrame", "int", "Completed frame number; starts at zero."],
      ["uResolution", "vec2", "Pass output dimensions."],
      ["vUv", "vec2", "Normalized coordinates."],
      ["gl_FragColor", "vec4", "Fragment output color."],
      ["gl_FragCoord", "vec4", "Fragment window coordinates."],
      ...node.data.inputs.flatMap((p) => [
        [p.name, "sampler2D", p.label],
        [`${p.name}Resolution`, "vec2", "Native input texture dimensions."],
        [`${p.name}Connected`, "bool", "Whether the input is connected."],
      ]),
    ]
  }
  const disposables = [
    monaco.languages.registerCompletionItemProvider("glsl", {
      provideCompletionItems(model, position) {
        if (!owns(model)) return { suggestions: [] }
        const clean = codeOnly(model.getValue()),
          offset = model.getOffsetAt(position)
        if (
          clean.slice(Math.max(0, offset - 1), offset) !==
          model.getValue().slice(Math.max(0, offset - 1), offset)
        )
          return { suggestions: [] }
        const word = model.getWordUntilPosition(position)
        const range = new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        )
        return {
          suggestions: [
            ...glslFunctions.map(([name, args, docs]) => ({
              label: name,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: `${name}(${args
                .split(", ")
                .map((arg, i) => `\${${i + 1}:${arg.split(" ").at(-1)}}`)
                .join(", ")})`,
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              detail: `${name}(${args})`,
              documentation: `${docs}\n\nGenType represents float or a matching vector type.`,
              range,
            })),
            ...glslSymbols().map(([name, type, docs]) => ({
              label: name,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: name,
              detail: type,
              documentation: docs,
              range,
            })),
            ...[
              "void",
              "float",
              "int",
              "bool",
              "vec2",
              "vec3",
              "vec4",
              "ivec2",
              "ivec3",
              "ivec4",
              "bvec2",
              "bvec3",
              "bvec4",
              "mat2",
              "mat3",
              "mat4",
              "const",
              "if",
              "else",
              "for",
              "while",
              "return",
            ].map((name) => ({
              label: name,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: name,
              range,
            })),
          ],
        }
      },
    }),
    monaco.languages.registerHoverProvider("glsl", {
      provideHover(model, position) {
        if (!owns(model)) return
        const word = model.getWordAtPosition(position)?.word
        const fn = glslFunctions.find(([name]) => name === word)
        const symbol = glslSymbols().find(([name]) => name === word)
        return fn
          ? {
              contents: [
                { value: `\`\`\`glsl\n${fn[0]}(${fn[1]})\n\`\`\`\n${fn[2]}` },
              ],
            }
          : symbol
            ? {
                contents: [
                  { value: `\`${symbol[1]} ${symbol[0]}\`\n\n${symbol[2]}` },
                ],
              }
            : undefined
      },
    }),
    monaco.languages.registerCompletionItemProvider("javascript", {
      triggerCharacters: ["."],
      async provideCompletionItems(model, position, _context, token) {
        if (!owns(model)) return { suggestions: [] }
        const version = model.getVersionId()
        const { worker, uri, offset } = await service(model, position)
        const info: ts.CompletionInfo | undefined =
          await worker.getCompletionsAtPosition(uri, offset)
        if (
          token.isCancellationRequested ||
          model.isDisposed() ||
          model.getVersionId() !== version ||
          !owns(model)
        )
          return { suggestions: [] }
        const word = model.getWordUntilPosition(position)
        const range = new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        )
        return {
          suggestions: (info?.entries ?? []).map((entry) => {
            const item = {
              label: entry.name,
              insertText: entry.name,
              kind: kind(entry.kind),
              sortText: entry.sortText,
              range,
            }
            pending.set(item, { uri, offset })
            return item
          }),
        }
      },
      async resolveCompletionItem(item, token) {
        const request = pending.get(item)
        if (!request || token.isCancellationRequested || !mirror) return item
        const factory = await monaco.typescript.getJavaScriptWorker()
        const worker = await factory(mirror.uri)
        const details: ts.CompletionEntryDetails | undefined =
          await worker.getCompletionEntryDetails(
            request.uri,
            request.offset,
            String(item.label)
          )
        return {
          ...item,
          detail: display(details?.displayParts),
          documentation: display(details?.documentation),
        }
      },
    }),
    monaco.languages.registerHoverProvider("javascript", {
      async provideHover(model, position, token) {
        if (!owns(model)) return
        const { worker, uri, offset } = await service(model, position)
        const info: ts.QuickInfo | undefined =
          await worker.getQuickInfoAtPosition(uri, offset)
        if (!info || token.isCancellationRequested || !owns(model)) return
        return {
          contents: [
            {
              value: `\`\`\`typescript\n${display(info.displayParts)}\n\`\`\``,
            },
            { value: display(info.documentation) },
          ],
        }
      },
    }),
    monaco.languages.registerSignatureHelpProvider("javascript", {
      signatureHelpTriggerCharacters: ["(", ","],
      signatureHelpRetriggerCharacters: [")"],
      async provideSignatureHelp(model, position, token) {
        if (!owns(model)) return
        const { worker, uri, offset } = await service(model, position)
        const info: ts.SignatureHelpItems | undefined =
          await worker.getSignatureHelpItems(uri, offset, {})
        if (!info || token.isCancellationRequested || !owns(model)) return
        return {
          value: {
            activeSignature: info.selectedItemIndex,
            activeParameter: info.argumentIndex,
            signatures: info.items.map((item) => ({
              label:
                display(item.prefixDisplayParts) +
                item.parameters
                  .map((p) => display(p.displayParts))
                  .join(display(item.separatorDisplayParts)) +
                display(item.suffixDisplayParts),
              documentation: display(item.documentation),
              parameters: item.parameters.map((p) => ({
                label: display(p.displayParts),
                documentation: display(p.documentation),
              })),
            })),
          },
          dispose() {},
        }
      },
    }),
  ]
  return () => {
    disposables.forEach((d) => d.dispose())
    mirror?.dispose()
  }
}
