// Configure @monaco-editor/react to use the *bundled* monaco-editor package
// (no CDN fetch) so the editor works offline and under a strict CSP.
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

self.MonacoEnvironment = {
  getWorker() {
    return new editorWorker()
  },
}

// A theme matching the app palette (indigo / teal / rose on near-black).
monaco.editor.defineTheme('precision-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '818cf8' },
    { token: 'type', foreground: '2dd4bf' },
    { token: 'number', foreground: 'f59e0b' },
    { token: 'string', foreground: '2dd4bf' },
    { token: 'comment', foreground: '4b5563', fontStyle: 'italic' },
  ],
  colors: {
    'editor.background': '#0a0e17',
    'editor.foreground': '#e2e8f0',
    'editorLineNumber.foreground': '#334155',
    'editorLineNumber.activeForeground': '#818cf8',
    'editor.selectionBackground': '#6366f133',
    'editor.lineHighlightBackground': '#ffffff08',
    'editorCursor.foreground': '#818cf8',
    'editorGutter.background': '#0a0e17',
  },
})

loader.config({ monaco })

export default monaco
