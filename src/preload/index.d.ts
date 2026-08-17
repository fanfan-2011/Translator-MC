// Type declaration for the API exposed by the preload script.
// The renderer's typed facade (src/renderer/src/api.ts) wraps this.
export {}

declare global {
  interface Window {
    api: any
  }
}
