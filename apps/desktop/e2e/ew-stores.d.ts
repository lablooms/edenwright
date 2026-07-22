import type { EdenwrightApi } from "../src/preload/api";

/**
 * Shared e2e window typing (specs compile under the Node, no-DOM tsconfig
 * but drive the renderer through page.evaluate). ONE declaration lives here
 * — per-file copies drifted into TS2717 conflicts twice already.
 */
declare global {
  interface Window {
    edenwright: EdenwrightApi;
    __ewStores: {
      app: {
        getState(): {
          setMainView(view: "editor" | "timeline" | "corkboard"): void;
          setSideView(
            view: "files" | "search" | "codex" | "worlds" | "themes",
          ): void;
          setExportOpen(open: boolean): void;
          openFileAt(path: string): Promise<void>;
        };
      };
      themes: {
        getState(): {
          refresh(): Promise<void>;
          apply(id: string): Promise<void>;
        };
      };
    };
  }

  const window: Window;

  /** The two DOM bits specs assert on (Node tsconfig has no DOM lib). */
  function getComputedStyle(element: unknown): {
    getPropertyValue(name: string): string;
  };
  const document: { documentElement: unknown };
}

export {};
