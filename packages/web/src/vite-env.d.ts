/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GIWA_RPC_URL?: string;
  readonly VITE_GIWA_FLASHBLOCKS_RPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
