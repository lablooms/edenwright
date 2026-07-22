/// <reference types="vite/client" />

import type { EdenwrightApi } from "../../preload/api";

declare global {
  interface Window {
    /** The preload bridge — the renderer's only line to the platform. */
    edenwright: EdenwrightApi;
  }
}

export {};
