/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API server, e.g. "https://api.example.com". Empty = same origin. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
