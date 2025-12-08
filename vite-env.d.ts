// /// <reference types="vite/client" />

// Fallback definitions in case the reference is not resolvable
declare module 'vite/client' {
  // Minimal placeholder
  export const meta: any;
}

interface ImportMetaEnv {
  readonly API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}