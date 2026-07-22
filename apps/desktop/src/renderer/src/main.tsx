// Bundled OFL fonts (SPEC §3.2) — no network font fetches, ever.
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/literata/400.css";
import "@fontsource/literata/400-italic.css";
import "@fontsource/literata/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/courier-prime/400.css";

import "@edenwright/ui/styles/tokens.css";
import "@edenwright/ui/styles/global.css";
import "./app.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { usePluginStore } from "./plugins/plugin-store";
import { useAppStore } from "./store";
import { useThemeStore } from "./themes/theme-store";

// Introspection hook for e2e/devtools (read-only access to live stores).
(window as unknown as Record<string, unknown>).__ewStores = {
  app: useAppStore,
  plugins: usePluginStore,
  themes: useThemeStore,
};

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Renderer root element missing from index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
