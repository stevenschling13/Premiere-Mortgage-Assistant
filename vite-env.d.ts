interface ImportMetaEnv {
  readonly API_KEY: string;
  readonly VITE_API_KEY?: string;
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
